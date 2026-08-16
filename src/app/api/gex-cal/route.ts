import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { buildGexCalMatrix, type GexCalGreek, type GexCalOptionSide, type GexCalRepresentation } from "@/lib/gexCalendar";
import { OPTIONS_FLOW_TICKERS } from "@/lib/optionsFlow";
import { getConfiguredQuantDataApiKey, getGexIntervalMapSurface, getQuantDataHttpError } from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const cache = new Map<string, { expiresAt: number; payload: unknown }>();
const GREEKS = new Set<GexCalGreek>(["GAMMA", "VANNA", "DELTA", "CHARM"]);
const SIDES = new Set<GexCalOptionSide>(["NET", "CALL", "PUT", "GROSS"]);
const REPRESENTATIONS = new Set<GexCalRepresentation>(["RAW", "PER_ONE_DOLLAR_MOVE", "PER_ONE_PERCENT_MOVE"]);

async function authenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (isSiteAccessConfigured() && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const client = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  const { data } = await client.auth.getUser();
  return Boolean(data.user);
}

function previousBusinessDate(sessionDate: string) {
  const date = new Date(`${sessionDate}T12:00:00.000Z`);
  do date.setUTCDate(date.getUTCDate() - 1); while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!(await authenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "GEX CAL options data is not configured." }, { status: 503 });
  const query = request.nextUrl.searchParams;
  const source = (query.get("source") || "SPX").trim().toUpperCase();
  const greek = (query.get("greek") || "GAMMA").trim().toUpperCase() as GexCalGreek;
  const side = (query.get("side") || "NET").trim().toUpperCase() as GexCalOptionSide;
  const representation = (query.get("representation") || "PER_ONE_PERCENT_MOVE").trim().toUpperCase() as GexCalRepresentation;
  const sessionDate = query.get("sessionDate") || undefined;
  const asOf = query.get("asOf");
  const baseline = query.get("baseline");
  const baselineMode = query.get("baselineMode") || "previous-bucket";
  if (!new Set<string>(OPTIONS_FLOW_TICKERS).has(source)) return NextResponse.json({ error: "Unsupported options series." }, { status: 400 });
  if (!GREEKS.has(greek) || !SIDES.has(side) || !REPRESENTATIONS.has(representation)) return NextResponse.json({ error: "Unsupported GEX CAL mode." }, { status: 400 });
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return NextResponse.json({ error: "sessionDate must use YYYY-MM-DD." }, { status: 400 });
  const asOfTimestamp = asOf ? Date.parse(asOf) : null;
  const baselineTimestamp = baseline ? Date.parse(baseline) : null;
  if (asOf && !Number.isFinite(asOfTimestamp)) return NextResponse.json({ error: "Invalid as-of timestamp." }, { status: 400 });
  if (baseline && !Number.isFinite(baselineTimestamp)) return NextResponse.json({ error: "Invalid comparison timestamp." }, { status: 400 });
  const key = [source, greek, side, representation, sessionDate ?? "current", asOf ?? "latest", baselineMode, baseline ?? "auto"].join(":");
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return NextResponse.json(hit.payload, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const surface = await getGexIntervalMapSurface({ sourceTicker: source, sessionDate, aggregationPeriod: "1m", greekMode: greek, representationMode: representation });
    const baselineSurface = baselineMode === "previous-close"
      ? await getGexIntervalMapSurface({ sourceTicker: source, sessionDate: previousBusinessDate(surface.sessionDate), aggregationPeriod: "1m", greekMode: greek, representationMode: representation })
      : null;
    const payload = buildGexCalMatrix({
      surface,
      asOfTimestamp,
      baselineTimestamp: baselineSurface ? null : baselineTimestamp,
      baselineSurface,
      side,
    });
    const expiresIn = payload.status === "LIVE" ? 4_000 : 60_000;
    if (cache.size > 80) for (const [cacheKey, entry] of cache) if (entry.expiresAt <= Date.now()) cache.delete(cacheKey);
    cache.set(key, { expiresAt: Date.now() + expiresIn, payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
