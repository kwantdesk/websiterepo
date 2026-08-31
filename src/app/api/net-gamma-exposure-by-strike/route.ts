import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  buildNetGammaProfile,
  defaultNetGammaSource,
  type GammaExpirationMode,
  type MappedStrikeAggregationMode,
  type NetGammaProfileSnapshot,
  type NetGammaProviderMode,
} from "@/lib/netGammaExposureByStrike";
import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import { getConfiguredQuantDataApiKey, getNetGammaExposureSurface, getQuantDataHttpError, QuantDataError } from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const QUERY_KEYS = new Set([
  "display", "source", "provider", "displayPrice", "expirationMode",
  "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies",
  "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte",
]);
const PROVIDERS = new Set<NetGammaProviderMode>(["quantdata", "databento-custom", "hybrid-validation"]);
const EXPIRATIONS = new Set<GammaExpirationMode>(["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"]);
const AGGREGATIONS = new Set<MappedStrikeAggregationMode>(["exact-display-tick", "auto-bin", "custom-bin"]);
const MAX_CACHE_ENTRIES = 64;
const MAX_ROWS = 2_048;
const MAX_SOURCE_STRIKES_PER_ROW = 512;
const MAX_EXPIRATIONS = 64;
const MAX_CONTRIBUTIONS_PER_ROW = 64;
const MAX_TOTAL_CONTRIBUTIONS = 32_768;

type NetGammaReceipt = NetGammaProfileSnapshot & {
  asOfMs: number;
  replayAsOfMs: null;
  revision: string;
};

const payloadCache = new Map<string, { expiresAt: number; payload: NetGammaReceipt }>();

async function isAuthenticated(request: NextRequest) {
  const expectedInternalToken = String(process.env.KWANTDESK_ANALYTICS_SERVICE_TOKEN || "").trim();
  const suppliedInternalToken = String(request.headers.get("x-kwantdesk-internal-analytics-token") || "").trim();
  if (expectedInternalToken.length >= 32 && suppliedInternalToken.length === expectedInternalToken.length) {
    const supplied = Buffer.from(suppliedInternalToken, "utf8");
    const expected = Buffer.from(expectedInternalToken, "utf8");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
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

function finiteQuery(request: NextRequest, key: string, fallback: number, minimum: number, maximum: number) {
  const raw = request.nextUrl.searchParams.get(key);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new QuantDataError(`Invalid ${key}.`, 400, null);
  return value;
}

function boolQuery(request: NextRequest, key: string, fallback: boolean) {
  const raw = request.nextUrl.searchParams.get(key);
  if (raw === null) return fallback;
  if (raw !== "true" && raw !== "false") throw new QuantDataError(`Invalid ${key}.`, 400, null);
  return raw === "true";
}

function validateQueryShape(request: NextRequest) {
  if (request.nextUrl.search.length > 12_000) throw new QuantDataError("The Net Gamma query is too large.", 400, null);
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const values = request.nextUrl.searchParams.getAll(key);
    if (!QUERY_KEYS.has(key) || values.length !== 1 || values[0].length > 1_000) {
      throw new QuantDataError("The Net Gamma query is invalid.", 400, null);
    }
  }
}

function boundedReceipt(payload: NetGammaProfileSnapshot, receivedAtMs: number): NetGammaReceipt {
  if (payload.rows.length > MAX_ROWS || payload.expirationDates.length > MAX_EXPIRATIONS) {
    throw new QuantDataError("The Net Gamma profile exceeds the bounded desktop contract.", 422, null);
  }
  let totalContributions = 0;
  for (const row of payload.rows) {
    if (row.sourceStrikes.length > MAX_SOURCE_STRIKES_PER_ROW || row.expirationContributions.length > MAX_CONTRIBUTIONS_PER_ROW) {
      throw new QuantDataError("A Net Gamma strike row exceeds the bounded desktop contract.", 422, null);
    }
    totalContributions += row.expirationContributions.length;
    if (totalContributions > MAX_TOTAL_CONTRIBUTIONS) {
      throw new QuantDataError("The Net Gamma contribution surface exceeds the bounded desktop contract.", 422, null);
    }
  }
  if (!Number.isFinite(payload.snapshotTimeMs) || payload.snapshotTimeMs <= 0 ||
      payload.snapshotTimeMs > receivedAtMs + 60_000 || payload.receivedTimeMs > receivedAtMs + 60_000 ||
      payload.mapping.calculatedAtMs > receivedAtMs + 60_000) {
    throw new QuantDataError("The Net Gamma receipt clocks are invalid.", 502, null);
  }
  const revision = createHash("sha256").update(JSON.stringify({
    source: payload.sourceTicker,
    display: payload.displayInstrument,
    snapshotTimeMs: payload.snapshotTimeMs,
    mapping: [payload.mapping.method, payload.mapping.alpha, payload.mapping.beta],
    rows: payload.rows.map((row) => [row.mappedDisplayTick, row.callExposure, row.putExposure, row.netExposure]),
  })).digest("hex");
  return { ...payload, asOfMs: payload.snapshotTimeMs, replayAsOfMs: null, revision };
}

function evictCache(nowMs: number) {
  for (const [key, entry] of payloadCache) if (entry.expiresAt <= nowMs) payloadCache.delete(key);
  while (payloadCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = payloadCache.keys().next().value;
    if (typeof oldest !== "string") break;
    payloadCache.delete(oldest);
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    validateQueryShape(request);
    const displayInstrument = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
    if (!/^(NQ|MNQ|ES|MES)$/.test(displayInstrument)) throw new QuantDataError("Net Gamma Exposure supports NQ, MNQ, ES and MES charts.", 400, null);
    const sourceTicker = (request.nextUrl.searchParams.get("source") || defaultNetGammaSource(displayInstrument)).toUpperCase();
    const familySources = /^(NQ|MNQ)$/.test(displayInstrument) ? new Set(["QQQ", "NDX", "NQ"]) : new Set(["SPY", "SPX", "SPXW"]);
    if (!familySources.has(sourceTicker)) throw new QuantDataError("The options source does not match the display family.", 400, null);
    const provider = (request.nextUrl.searchParams.get("provider") || "quantdata") as NetGammaProviderMode;
    if (!PROVIDERS.has(provider)) throw new QuantDataError("Unsupported Gamma provider mode.", 400, null);
    if (provider !== "quantdata") throw new QuantDataError(`${provider} is disabled because the validated option definitions, IV and open-interest fields are not available. No proxy values were shown.`, 422, null);
    if (!getConfiguredQuantDataApiKey()) throw new QuantDataError("Net Gamma exposure is not configured.", 503, null);
    const expirationMode = (request.nextUrl.searchParams.get("expirationMode") || "zero-to-one-dte") as GammaExpirationMode;
    const aggregationMode = (request.nextUrl.searchParams.get("aggregationMode") || "auto-bin") as MappedStrikeAggregationMode;
    if (!EXPIRATIONS.has(expirationMode) || !AGGREGATIONS.has(aggregationMode)) throw new QuantDataError("Unsupported Net Gamma filter.", 400, null);
    const displayPrice = finiteQuery(request, "displayPrice", 0, 0.000001, 1_000_000);
    const minimumDte = finiteQuery(request, "minimumDte", 0, 0, 365);
    const maximumDte = finiteQuery(request, "maximumDte", 7, 0, 365);
    if (minimumDte > maximumDte) throw new QuantDataError("Minimum DTE cannot exceed maximum DTE.", 400, null);
    const customBinSizePoints = finiteQuery(request, "customBinSizePoints", 1, 0.25, 100);
    const expirationDates = (request.nextUrl.searchParams.get("expirationDates") || "").split(",").map((value) => value.trim()).filter(Boolean);
    if (expirationDates.length > MAX_EXPIRATIONS || expirationDates.some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)))) {
      throw new QuantDataError("Specific expiration dates are invalid.", 400, null);
    }
    if (expirationMode === "specific-expirations" && expirationDates.length === 0) throw new QuantDataError("Specific expiration mode requires at least one date.", 400, null);

    const cacheKey = request.nextUrl.searchParams.toString();
    const nowMs = Date.now();
    const cached = payloadCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });

    const surface = await getNetGammaExposureSurface({ sourceTicker, displayInstrument, displayPrice });
    const payload = boundedReceipt(buildNetGammaProfile(surface, {
      provider,
      expiration: {
        mode: expirationMode,
        minimumDte,
        maximumDte,
        expirationDates,
        includeWeeklies: boolQuery(request, "includeWeeklies", true),
        includeMonthlies: boolQuery(request, "includeMonthlies", true),
        includeQuarterlies: boolQuery(request, "includeQuarterlies", true),
      },
      aggregationMode,
      customBinSizePoints,
    }), Date.now());
    evictCache(nowMs);
    payloadCache.set(cacheKey, { expiresAt: nowMs + Math.max(2_000, Math.min(15_000, payload.refreshAfterMs)), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store", ETag: `"${payload.revision}"` } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
