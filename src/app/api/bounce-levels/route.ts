import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { buildBounceLevelsSnapshot, selectLookaheadSafeBounceBucket } from "@/lib/bounceLevels";
import { defaultGexIntervalMapSource } from "@/lib/gexIntervalMap";
import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import {
  buildNetGammaProfile,
  type GammaExpirationMode,
  type NetGammaProviderSurface,
} from "@/lib/netGammaExposureByStrike";
import {
  getConfiguredQuantDataApiKey,
  getGexIntervalMapSurface,
  getNetGammaExposureSurface,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import type { GreekMode } from "@/lib/optionsFlow";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const payloadCache = new Map<string, { expiresAt: number; payload: unknown }>();
const DISPLAYS = new Set(["NQ", "MNQ", "ES", "MES", "RTY", "M2K", "QQQ", "NDX", "SPY", "SPX", "IWM"]);
const SOURCES = new Set(["QQQ", "NDX", "SPY", "SPX", "IWM"]);
const EXPIRATIONS = new Set<GammaExpirationMode>(["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"]);
const GREEKS = new Set<GreekMode>(["GAMMA", "DELTA", "VANNA", "CHARM"]);

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

const finite = (request: NextRequest, key: string, fallback: number) => {
  const value = Number(request.nextUrl.searchParams.get(key));
  return Number.isFinite(value) ? value : fallback;
};

function historicalSurface(input: {
  sourceTicker: string;
  displayInstrument: string;
  displayPrice: number;
  asOf: number;
  interval: Awaited<ReturnType<typeof getGexIntervalMapSurface>>;
}): NetGammaProviderSurface {
  const bucket = selectLookaheadSafeBounceBucket(input.interval, input.asOf);
  if (!bucket?.rows.length || !(bucket.sourcePrice && bucket.sourcePrice > 0)) throw new Error("No lookahead-safe Gamma snapshot exists at the selected replay time.");
  const expiryStrikes = bucket.rows.map((row) => ({
    strike: row.sourceStrike,
    call: row.callExposure,
    put: row.putExposure,
    net: row.callExposure + row.putExposure,
    expiration: row.expirationDate,
  }));
  return {
    sourceTicker: input.sourceTicker,
    sourceSpotPrice: bucket.sourcePrice,
    displayPrice: input.displayPrice,
    displayInstrument: input.displayInstrument,
    sessionDate: input.interval.sessionDate,
    marketOpen: false,
    checkedAt: new Date(bucket.timestamp).toISOString(),
    status: "LAST_SESSION",
    refreshAfterMs: 6 * 60 * 60_000,
    strikes: [],
    expiryStrikes,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Bounce Levels options data is not configured." }, { status: 503 });
  const display = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
  if (!DISPLAYS.has(display)) return NextResponse.json({ error: "GEX Bounce supports the available index and ETF option underlyings plus their mapped futures." }, { status: 400 });
  const automaticSource = /^(ES|MES)$/.test(display) ? "SPY" : /^(RTY|M2K)$/.test(display) ? "IWM" : defaultGexIntervalMapSource(display);
  const source = (request.nextUrl.searchParams.get("source") || automaticSource).toUpperCase();
  if (!SOURCES.has(source)) return NextResponse.json({ error: "This Bounce Levels options source is unsupported." }, { status: 400 });
  const displayPrice = finite(request, "displayPrice", 0);
  if (!(displayPrice > 0)) return NextResponse.json({ error: "A current chart price is required for dynamic strike mapping." }, { status: 400 });
  const expirationMode = (request.nextUrl.searchParams.get("expirationMode") || "zero-to-one-dte") as GammaExpirationMode;
  if (!EXPIRATIONS.has(expirationMode)) return NextResponse.json({ error: "Unsupported expiration filter." }, { status: 400 });
  const greekMode = (request.nextUrl.searchParams.get("greekMode") || "GAMMA").toUpperCase() as GreekMode;
  if (!GREEKS.has(greekMode)) return NextResponse.json({ error: "Unsupported exposure Greek." }, { status: 400 });
  const sessionDate = request.nextUrl.searchParams.get("sessionDate") || undefined;
  const asOfRaw = request.nextUrl.searchParams.get("asOf");
  const asOf = asOfRaw ? Date.parse(asOfRaw) : null;
  if (asOfRaw && !Number.isFinite(asOf)) return NextResponse.json({ error: "Replay asOf must be an ISO timestamp." }, { status: 400 });
  const cacheKey = request.nextUrl.searchParams.toString();
  const cached = payloadCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const interval = await getGexIntervalMapSurface({ sourceTicker: source, sessionDate, aggregationPeriod: "1m", greekMode });
    const profileSurface = asOf
      ? historicalSurface({ sourceTicker: source, displayInstrument: display, displayPrice, asOf, interval })
      : await getNetGammaExposureSurface({ sourceTicker: source, displayInstrument: display, displayPrice, greekMode });
    const profile = buildNetGammaProfile(profileSurface, {
      expiration: {
        mode: expirationMode,
        minimumDte: finite(request, "minimumDte", 0),
        maximumDte: finite(request, "maximumDte", 7),
        expirationDates: (request.nextUrl.searchParams.get("expirationDates") || "").split(",").map((value) => value.trim()).filter(Boolean),
        includeWeeklies: request.nextUrl.searchParams.get("includeWeeklies") !== "false",
        includeMonthlies: request.nextUrl.searchParams.get("includeMonthlies") !== "false",
        includeQuarterlies: request.nextUrl.searchParams.get("includeQuarterlies") !== "false",
      },
      aggregationMode: "auto-bin",
    });
    const payload = buildBounceLevelsSnapshot(profile, interval, {
      greekMode,
      maximumLevels: finite(request, "maximumLevels", 8),
      maximumGatekeepers: finite(request, "maximumGatekeepers", 2),
      maximumMajorNodes: finite(request, "maximumMajorNodes", 4),
      minimumExposurePercentile: finite(request, "minimumExposurePercentile", 90) / 100,
      minimumPercentOfKing: finite(request, "minimumPercentOfKing", 15) / 100,
      minimumRelevanceScore: finite(request, "minimumRelevanceScore", 55),
      maximumDistancePoints: finite(request, "maximumDistancePoints", 0),
      clusterDistancePoints: finite(request, "clusterDistancePoints", /^(NQ|MNQ)$/.test(display) ? 25 : 6),
      airPocketRatio: finite(request, "airPocketRatio", 20) / 100,
      historyBuckets: finite(request, "historyBuckets", 120),
      maximumNodesPerSlice: finite(request, "maximumNodesPerSlice", 24),
      magnitudeWeight: finite(request, "magnitudeWeight", 45) / 100,
      proximityWeight: finite(request, "proximityWeight", 15) / 100,
      accumulationWeight: finite(request, "accumulationWeight", 15) / 100,
      persistenceWeight: finite(request, "persistenceWeight", 10) / 100,
      freshnessWeight: finite(request, "freshnessWeight", 10) / 100,
      clusterWeight: finite(request, "clusterWeight", 5) / 100,
      proximityDecayPercent: finite(request, "proximityDecayPercent", 3) / 100,
      developingMinimumPercentile: finite(request, "developingMinimumPercentile", 75) / 100,
      developingMinimumGrowthPercent: finite(request, "developingMinimumGrowthPercent", 10),
      weakeningThresholdPercent: finite(request, "weakeningThresholdPercent", -10),
      weakeningRelevanceThreshold: finite(request, "weakeningRelevanceThreshold", 45),
      retirementRelevanceThreshold: finite(request, "retirementRelevanceThreshold", 30),
      retirementExposurePercentile: finite(request, "retirementExposurePercentile", 65) / 100,
      minimumGatekeeperRelevance: finite(request, "minimumGatekeeperRelevance", 60),
      minimumGatekeeperPercentOfKing: finite(request, "minimumGatekeeperPercentOfKing", 20) / 100,
      minimumClusterNodes: finite(request, "minimumClusterNodes", 2),
      minimumAirPocketWidthPercent: finite(request, "minimumAirPocketWidthPercent", 0.3) / 100,
      touchTolerancePercent: finite(request, "touchTolerancePercent", 0.05) / 100,
      touchDecayFactor: finite(request, "touchDecayFactor", 85) / 100,
    });
    if (payloadCache.size > 64) for (const [key, entry] of payloadCache) if (entry.expiresAt <= Date.now()) payloadCache.delete(key);
    payloadCache.set(cacheKey, { expiresAt: Date.now() + Math.max(2_000, Math.min(15_000, payload.refreshAfterMs)), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
