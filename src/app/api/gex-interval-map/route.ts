import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { defaultGexIntervalMapSource } from "@/lib/gexIntervalMap";
import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import { getConfiguredQuantDataApiKey, getGexIntervalMapSurface, getQuantDataHttpError } from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const payloadCache = new Map<string, { expiresAt: number; payload: unknown }>();
const ALLOWED_SOURCES = new Set(["QQQ", "NDX", "NQ", "SPY", "SPX"]);
const ALLOWED_DISPLAYS = new Set(["QQQ", "NDX", "NQ", "MNQ", "SPY", "SPX", "ES", "MES"]);

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (isSiteAccessConfigured() && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "GEX Interval Map options data is not configured." }, { status: 503 });
  const display = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
  const source = (request.nextUrl.searchParams.get("source") || defaultGexIntervalMapSource(display)).toUpperCase();
  const sessionDate = request.nextUrl.searchParams.get("sessionDate") || undefined;
  const startTime = request.nextUrl.searchParams.get("startTime") || undefined;
  const endTime = request.nextUrl.searchParams.get("endTime") || undefined;
  const aggregationPeriod = request.nextUrl.searchParams.get("aggregationPeriod") || "1m";
  if (!ALLOWED_DISPLAYS.has(display)) return NextResponse.json({ error: "This display instrument is not supported by GEX Interval Map." }, { status: 400 });
  if (!ALLOWED_SOURCES.has(source)) return NextResponse.json({ error: "This options source is not supported by GEX Interval Map." }, { status: 400 });
  if (!/^(1m|2m|3m|4m|5m|10m|15m|30m|1h)$/.test(aggregationPeriod)) return NextResponse.json({ error: "Unsupported interval aggregation." }, { status: 400 });
  if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return NextResponse.json({ error: "Historical session date must use YYYY-MM-DD." }, { status: 400 });
  if (sessionDate) {
    const requested = Date.parse(`${sessionDate}T00:00:00.000Z`);
    const oldest = new Date();
    oldest.setUTCMonth(oldest.getUTCMonth() - 9);
    if (!Number.isFinite(requested) || requested < oldest.getTime() || requested > Date.now()) {
      return NextResponse.json({ error: "Historical Interval Map sessions are available for the previous nine months." }, { status: 400 });
    }
  }
  if ((startTime && !endTime) || (!startTime && endTime)) return NextResponse.json({ error: "Both startTime and endTime are required for a custom history range." }, { status: 400 });
  if (startTime && endTime) {
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return NextResponse.json({ error: "Custom history range is invalid." }, { status: 400 });
    if (endMs - startMs > 9 * 31 * 24 * 60 * 60_000 || endMs > Date.now()) return NextResponse.json({ error: "Custom Interval Map history is limited to the previous nine months." }, { status: 400 });
  }
  const cacheKey = [source, display, sessionDate ?? "current", startTime ?? "", endTime ?? "", aggregationPeriod].join(":");
  const cached = payloadCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const payload = await getGexIntervalMapSurface({ sourceTicker: source, sessionDate, startTime, endTime, aggregationPeriod });
    if (payloadCache.size > 64) for (const [key, entry] of payloadCache) if (entry.expiresAt <= Date.now()) payloadCache.delete(key);
    payloadCache.set(cacheKey, { expiresAt: Date.now() + Math.max(2_000, Math.min(60_000, payload.refreshAfterMs)), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
