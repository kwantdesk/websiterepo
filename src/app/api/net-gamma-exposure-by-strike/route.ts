import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  buildNetGammaProfile,
  defaultNetGammaSource,
  type GammaExpirationMode,
  type MappedStrikeAggregationMode,
  type NetGammaProviderMode,
} from "@/lib/netGammaExposureByStrike";
import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import { getConfiguredQuantDataApiKey, getNetGammaExposureSurface, getQuantDataHttpError } from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const payloadCache = new Map<string, { expiresAt: number; payload: unknown }>();
const PROVIDERS = new Set<NetGammaProviderMode>(["quantdata", "databento-custom", "hybrid-validation"]);
const EXPIRATIONS = new Set<GammaExpirationMode>(["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"]);
const AGGREGATIONS = new Set<MappedStrikeAggregationMode>(["exact-display-tick", "auto-bin", "custom-bin"]);

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

function finiteQuery(request: NextRequest, key: string) {
  const raw = request.nextUrl.searchParams.get(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function boolQuery(request: NextRequest, key: string, fallback: boolean) {
  const raw = request.nextUrl.searchParams.get(key);
  return raw === null ? fallback : raw !== "false";
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const displayInstrument = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
  if (!/^(NQ|MNQ|ES|MES)$/.test(displayInstrument)) return NextResponse.json({ error: "Net Gamma Exposure supports NQ, MNQ, ES and MES charts." }, { status: 400 });
  const sourceTicker = (request.nextUrl.searchParams.get("source") || defaultNetGammaSource(displayInstrument)).toUpperCase();
  const provider = (request.nextUrl.searchParams.get("provider") || "quantdata") as NetGammaProviderMode;
  if (!PROVIDERS.has(provider)) return NextResponse.json({ error: "Unsupported Gamma provider mode." }, { status: 400 });
  if (provider !== "quantdata") return NextResponse.json({ error: `${provider} is disabled because the validated option definitions, IV and open-interest fields are not available. No proxy values were shown.` }, { status: 422 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Net Gamma exposure is not configured." }, { status: 503 });
  const expirationMode = (request.nextUrl.searchParams.get("expirationMode") || "zero-to-one-dte") as GammaExpirationMode;
  const aggregationMode = (request.nextUrl.searchParams.get("aggregationMode") || "auto-bin") as MappedStrikeAggregationMode;
  if (!EXPIRATIONS.has(expirationMode) || !AGGREGATIONS.has(aggregationMode)) return NextResponse.json({ error: "Unsupported Net Gamma filter." }, { status: 400 });
  const displayPrice = Number(request.nextUrl.searchParams.get("displayPrice"));
  if (!(displayPrice > 0)) return NextResponse.json({ error: "A current futures price is required for strike mapping." }, { status: 400 });
  const expirationDates = (request.nextUrl.searchParams.get("expirationDates") || "").split(",").map((value) => value.trim()).filter(Boolean);
  const key = request.nextUrl.searchParams.toString();
  const cached = payloadCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });

  try {
    const surface = await getNetGammaExposureSurface({ sourceTicker, displayInstrument, displayPrice });
    const payload = buildNetGammaProfile(surface, {
      provider,
      expiration: {
        mode: expirationMode,
        minimumDte: finiteQuery(request, "minimumDte") ?? undefined,
        maximumDte: finiteQuery(request, "maximumDte") ?? undefined,
        expirationDates,
        includeWeeklies: boolQuery(request, "includeWeeklies", true),
        includeMonthlies: boolQuery(request, "includeMonthlies", true),
        includeQuarterlies: boolQuery(request, "includeQuarterlies", true),
      },
      aggregationMode,
      customBinSizePoints: finiteQuery(request, "customBinSizePoints") ?? undefined,
      minimumAbsoluteExposure: finiteQuery(request, "minimumAbsoluteExposure") ?? undefined,
      sourceStrikeMinimum: finiteQuery(request, "sourceStrikeMinimum"),
      sourceStrikeMaximum: finiteQuery(request, "sourceStrikeMaximum"),
      maximumDistanceFromSourceSpot: finiteQuery(request, "maximumDistanceFromSourceSpot"),
    });
    if (payloadCache.size > 64) for (const [cacheKey, entry] of payloadCache) if (entry.expiresAt <= Date.now()) payloadCache.delete(cacheKey);
    payloadCache.set(key, { expiresAt: Date.now() + Math.max(2_000, Math.min(15_000, payload.refreshAfterMs)), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
