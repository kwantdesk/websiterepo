import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse, after } from "next/server";
import {
  BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT,
  BOUNCE_LEVELS_HISTORY_DAYS,
  buildBounceLevelsSnapshot,
  mergeBounceIntervalSurfaces,
  selectLookaheadSafeBounceBucket,
} from "@/lib/bounceLevels";
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

type BouncePayload = Awaited<ReturnType<typeof buildBounceLevelsSnapshot>>;
const payloadCache = new Map<string, { expiresAt: number; payload: BouncePayload }>();
/** One background rebuild per cache key; extra hits ride the same promise. */
const backgroundRefreshes = new Map<string, Promise<unknown>>();
/**
 * How long a cached surface may still be SERVED after it goes stale.
 *
 * Bounce Levels needs a full rolling week of exposure history plus the live
 * session, which is seconds of provider work. Rebuilding that before answering
 * meant every newly opened chart waited on it, so the levels landed long after
 * the candles. A surface a few seconds past its refresh window is visually
 * identical, so it is returned immediately and rebuilt behind the response.
 */
const STALE_SERVE_WINDOW_MS = 10 * 60_000;
/** A replayed minute is immutable, so it is worth retaining for a session. */
const REPLAY_PAYLOAD_CACHE_MS = 6 * 60 * 60_000;
const DISPLAYS = new Set(["NQ", "MNQ", "ES", "MES", "RTY", "M2K", "QQQ", "NDX", "SPY", "SPX", "SPXW", "IWM"]);
const SOURCES = new Set(["QQQ", "NDX", "SPY", "SPX", "SPXW", "IWM"]);
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

function newYorkSessionDateAt(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

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

type BounceRequestContext = {
  display: string;
  source: string;
  displayPrice: number;
  expirationMode: GammaExpirationMode;
  greekMode: GreekMode;
  sessionDate: string | undefined;
  asOf: number | null;
};

/**
 * Build a Bounce Levels surface and record it in the process cache.
 *
 * Extracted from the handler so a stale response can trigger the same rebuild
 * behind `after()` instead of making the caller wait for it.
 */
async function buildBounceLevelsPayload(
  request: NextRequest,
  cacheKey: string,
  context: BounceRequestContext,
) {
  const { display, source, displayPrice, expirationMode, greekMode, sessionDate, asOf } = context;
  const intervalPromise = getGexIntervalMapSurface({ sourceTicker: source, sessionDate, aggregationPeriod: "1m", greekMode });
  const historyReferenceMs = asOf ?? (sessionDate ? Date.parse(`${sessionDate}T12:00:00.000Z`) : Date.now());
  // The historical range ends at the start of the selected UTC day. This
  // keeps its provider cache key stable all day; the separate one-minute
  // surface below supplies the selected/current session live.
  const historyEndMs = Date.parse(`${new Date(historyReferenceMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const historyStartMs = historyEndMs - BOUNCE_LEVELS_HISTORY_DAYS * 24 * 60 * 60_000;
  // A five-minute historical surface covers the full rolling week without
  // multiplying live canvas work by 10,080 one-minute buckets. The current
  // session remains one-minute resolution and wins timestamp collisions.
  const historyRequest = () => getGexIntervalMapSurface({
    sourceTicker: source,
    startTime: new Date(historyStartMs).toISOString(),
    endTime: new Date(historyEndMs).toISOString(),
    aggregationPeriod: "5m",
    greekMode,
  });
  // Do not wrap this surface in Next's incremental data cache. A seven-day
  // SPX/SPXW/QQQ interval response is commonly 7-36 MB, while Next rejects
  // cache entries over 2 MB and turns an otherwise valid replay request into
  // HTTP 500. The shared QuantData adapter already coalesces this exact
  // request and retains it for six hours in its bounded server process cache.
  // Keeping the large raw surface out of the framework cache also prevents a
  // failed cache write from blanking Bounce Levels on historical sessions.
  const historicalIntervalPromise = historyRequest().catch(() => null);
  // The live profile and interval history are independent provider surfaces.
  // Start them together so first paint takes one network round instead of two.
  const profilePromise = asOf
    ? intervalPromise.then((interval) => historicalSurface({ sourceTicker: source, displayInstrument: display, displayPrice, asOf, interval }))
    : getNetGammaExposureSurface({ sourceTicker: source, displayInstrument: display, displayPrice, greekMode });
  const [currentInterval, historicalInterval, profileSurface] = await Promise.all([
    intervalPromise,
    historicalIntervalPromise,
    profilePromise,
  ]);
  const interval = mergeBounceIntervalSurfaces(historicalInterval, currentInterval);
  if (!historicalInterval) {
    interval.limitations = [...interval.limitations, "The rolling one-week Bounce history could not refresh; the current session remains available."];
  }
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
    expirationMode,
    minimumDte: finite(request, "minimumDte", 0),
    maximumDte: finite(request, "maximumDte", 7),
    expirationDates: (request.nextUrl.searchParams.get("expirationDates") || "").split(",").map((value) => value.trim()).filter(Boolean),
    includeWeeklies: request.nextUrl.searchParams.get("includeWeeklies") !== "false",
    includeMonthlies: request.nextUrl.searchParams.get("includeMonthlies") !== "false",
    includeQuarterlies: request.nextUrl.searchParams.get("includeQuarterlies") !== "false",
    maximumLevels: finite(request, "maximumLevels", 8),
    maximumGatekeepers: finite(request, "maximumGatekeepers", 2),
    maximumMajorNodes: finite(request, "maximumMajorNodes", 4),
    minimumExposurePercentile: 1 - Math.max(1, Math.min(100, finite(request, "topExposurePercent", 10))) / 100,
    minimumPercentOfKing: finite(request, "minimumPercentOfKing", 15) / 100,
    minimumRelevanceScore: finite(request, "minimumRelevanceScore", 55),
    maximumDistancePoints: finite(request, "maximumDistancePoints", 0),
    clusterDistancePoints: finite(request, "clusterDistancePoints", /^(NQ|MNQ)$/.test(display) ? 25 : 6),
    airPocketRatio: finite(request, "airPocketRatio", 20) / 100,
    historyBuckets: Math.max(finite(request, "historyBuckets", BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT), BOUNCE_LEVELS_HISTORY_BUCKET_LIMIT),
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
    activeEnterThreshold: finite(request, "activeEnterThreshold", 15) / 100,
    activeExitThreshold: finite(request, "activeExitThreshold", 8) / 100,
    retirementConfirmationSnapshots: finite(request, "retirementConfirmationSnapshots", 3),
    visualStrengthBasis: (["absolute-exposure", "percent-of-king", "hybrid"].includes(request.nextUrl.searchParams.get("visualStrengthBasis") || "")
      ? request.nextUrl.searchParams.get("visualStrengthBasis")
      : "percent-of-king") as "absolute-exposure" | "percent-of-king" | "hybrid",
    absoluteExposureScale: finite(request, "absoluteExposureScale", 1_000_000_000),
    rollDetectionEnabled: request.nextUrl.searchParams.get("rollDetectionEnabled") !== "false",
    rollVisualizationEnabled: request.nextUrl.searchParams.get("rollVisualizationEnabled") === "true",
    rollWeakeningThreshold: finite(request, "rollWeakeningThreshold", 40),
    rollBuildingThreshold: finite(request, "rollBuildingThreshold", 40),
    maxRollDistance: finite(request, "maxRollDistance", 5),
    rollWindowMs: finite(request, "rollWindowSeconds", 120) * 1_000,
  });
  // Replay fills this with one entry per minute, so the sweep needs a real
  // ceiling rather than only dropping expired entries.
  if (payloadCache.size > 512) {
    const now = Date.now();
    for (const [key, entry] of payloadCache) if (entry.expiresAt <= now) payloadCache.delete(key);
    while (payloadCache.size > 512) {
      const oldest = payloadCache.keys().next();
      if (oldest.done) break;
      payloadCache.delete(oldest.value);
    }
  }
  // A replay surface describes a FIXED past instant, so it can never change.
  // Capping it at the live cadence meant every replay minute was rebuilt from
  // the provider on each pass, and scrubbing back refetched the whole session
  // again — the long stall after pressing play. Live surfaces keep the short
  // window because they genuinely do move.
  const cacheMs = asOf
    ? REPLAY_PAYLOAD_CACHE_MS
    : Math.max(2_000, Math.min(15_000, payload.refreshAfterMs));
  payloadCache.set(cacheKey, { expiresAt: Date.now() + cacheMs, payload });
  return payload;
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
  const asOfRaw = request.nextUrl.searchParams.get("asOf");
  const asOf = asOfRaw ? Date.parse(asOfRaw) : null;
  if (asOfRaw && !Number.isFinite(asOf)) return NextResponse.json({ error: "Replay asOf must be an ISO timestamp." }, { status: 400 });
  // Replay requests used to omit sessionDate, which made the QuantData
  // adapter load today's interval surface and then search it for a bucket at
  // the historical replay clock. Bind the surface to the selected New York
  // trading day so any replay date in the backtesting window is reconstructed
  // from its own point-in-time Gamma history with no lookahead.
  const requestedSessionDate = request.nextUrl.searchParams.get("sessionDate") || undefined;
  const sessionDate = requestedSessionDate || (asOf !== null ? newYorkSessionDateAt(asOf) : undefined);
  const cacheKey = request.nextUrl.searchParams.toString();
  const cached = payloadCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (cached && cached.expiresAt + STALE_SERVE_WINDOW_MS > now) {
    // Answer from the stale surface immediately and rebuild behind the
    // response, so the levels paint with the candles instead of after a full
    // provider round trip.
    if (!backgroundRefreshes.has(cacheKey)) {
      const refresh = buildBounceLevelsPayload(request, cacheKey, {
        display, source, displayPrice, expirationMode, greekMode, sessionDate, asOf,
      })
        .catch(() => undefined)
        .finally(() => backgroundRefreshes.delete(cacheKey));
      backgroundRefreshes.set(cacheKey, refresh);
      after(() => refresh);
    }
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const payload = await buildBounceLevelsPayload(request, cacheKey, {
      display, source, displayPrice, expirationMode, greekMode, sessionDate, asOf,
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
