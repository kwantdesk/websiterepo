import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  defaultGexIntervalMapSource,
  type GexIntervalProviderBucket,
  type GexIntervalProviderSurface,
} from "@/lib/gexIntervalMap";
import { conditionalJson } from "@/lib/conditionalJson";
import { normalizeGammaHeatmapInstrument } from "@/lib/gammaHeatmap";
import {
  getConfiguredQuantDataApiKey,
  getGexIntervalMapSurface,
  getQuantDataHttpError,
  QuantDataError,
} from "@/lib/quantData.server";
import type { GreekMode } from "@/lib/optionsFlow";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const QUERY_KEYS = new Set([
  "display", "source", "sessionDate", "startTime", "endTime",
  "aggregationPeriod", "greekMode",
]);
const ALLOWED_SOURCES = new Set(["QQQ", "NDX", "NQ", "SPY", "SPX", "SPXW"]);
const ALLOWED_DISPLAYS = new Set(["QQQ", "NDX", "NQ", "MNQ", "SPY", "SPX", "SPXW", "ES", "MES"]);
const AGGREGATION_PERIODS = new Set(["1m", "2m", "3m", "4m", "5m", "10m", "15m", "20m", "30m", "1h", "2h", "4h"]);
const MAX_CACHE_ENTRIES = 64;
const MAX_BUCKETS = 720;
const MAX_ROWS_PER_BUCKET = 2_048;
const MAX_TOTAL_ROWS = 368_640;
const MAX_LIMITATIONS = 32;
const MAX_HISTORY_MS = 9 * 31 * 24 * 60 * 60_000;

type GexIntervalMapReceipt = GexIntervalProviderSurface & {
  displayInstrument: string;
  rangeStartMs: number | null;
  rangeEndMs: number | null;
  receivedAtMs: number;
  asOfMs: number;
  replayAsOfMs: number | null;
  revision: string;
};

const payloadCache = new Map<string, { expiresAt: number; payload: GexIntervalMapReceipt }>();

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
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function validateQueryShape(request: NextRequest) {
  if (request.nextUrl.search.length > 12_000) throw new QuantDataError("The GEX Interval Map query is too large.", 400, null);
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const values = request.nextUrl.searchParams.getAll(key);
    if (!QUERY_KEYS.has(key) || values.length !== 1 || values[0].length > 1_000) {
      throw new QuantDataError("The GEX Interval Map query is invalid.", 400, null);
    }
  }
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function familyMatches(display: string, source: string) {
  if (/^(NQ|MNQ|NDX|QQQ)$/.test(display)) return /^(QQQ|NDX|NQ)$/.test(source);
  return /^(SPY|SPX|SPXW)$/.test(source);
}

function parseHistory(request: NextRequest, nowMs: number) {
  const sessionDate = request.nextUrl.searchParams.get("sessionDate") || undefined;
  const startTime = request.nextUrl.searchParams.get("startTime") || undefined;
  const endTime = request.nextUrl.searchParams.get("endTime") || undefined;
  if (sessionDate && (startTime || endTime)) throw new QuantDataError("Choose either a session date or a custom history range.", 400, null);
  if (sessionDate) {
    if (!validDate(sessionDate)) throw new QuantDataError("Historical session date must use YYYY-MM-DD.", 400, null);
    const requested = Date.parse(`${sessionDate}T00:00:00.000Z`);
    if (requested < nowMs - MAX_HISTORY_MS || requested > nowMs) {
      throw new QuantDataError("Historical Interval Map sessions are available for the previous nine months.", 400, null);
    }
    return { sessionDate, startTime: undefined, endTime: undefined, startMs: null, endMs: null, historical: true };
  }
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new QuantDataError("Both startTime and endTime are required for a custom history range.", 400, null);
  }
  if (startTime && endTime) {
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs ||
        endMs - startMs > MAX_HISTORY_MS || startMs < nowMs - MAX_HISTORY_MS || endMs > nowMs) {
      throw new QuantDataError("Custom Interval Map history is limited to the previous nine months.", 400, null);
    }
    return {
      sessionDate: undefined,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      startMs,
      endMs,
      historical: true,
    };
  }
  return { sessionDate: undefined, startTime: undefined, endTime: undefined, startMs: null, endMs: null, historical: false };
}

function boundedReceipt(
  surface: GexIntervalProviderSurface,
  displayInstrument: string,
  sourceTicker: string,
  aggregationPeriod: string,
  history: ReturnType<typeof parseHistory>,
  receivedAtMs: number,
): GexIntervalMapReceipt {
  if (surface.schemaVersion !== 1 || surface.provider !== "quantdata" ||
      surface.representation !== "provider-signed-exposure" ||
      surface.sourceTicker !== sourceTicker || surface.aggregationPeriod !== aggregationPeriod ||
      !validDate(surface.sessionDate) || typeof surface.marketOpen !== "boolean" ||
      !["LIVE", "LAST_SESSION", "DELAYED", "HISTORICAL"].includes(surface.status) ||
      !Number.isFinite(surface.refreshAfterMs) || surface.refreshAfterMs < 1_000 || surface.refreshAfterMs > 21_600_000 ||
      !Array.isArray(surface.buckets) || surface.buckets.length > MAX_BUCKETS ||
      !Array.isArray(surface.limitations) || surface.limitations.length > MAX_LIMITATIONS) {
    throw new QuantDataError("The GEX Interval Map surface is outside the bounded desktop contract.", 422, null);
  }
  const checkedAtMs = Date.parse(surface.checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs <= 0 || checkedAtMs > receivedAtMs + 60_000) {
    throw new QuantDataError("The GEX Interval Map receipt clock is invalid.", 502, null);
  }
  const buckets: GexIntervalProviderBucket[] = [];
  let previousTimestamp = 0;
  let totalRows = 0;
  for (const bucket of surface.buckets) {
    if (!bucket || !Number.isFinite(bucket.timestamp) || bucket.timestamp <= previousTimestamp ||
        bucket.timestamp > receivedAtMs + 60_000 ||
        history.startMs !== null && bucket.timestamp < history.startMs ||
        history.endMs !== null && bucket.timestamp > history.endMs ||
        bucket.sourcePrice !== null && (!Number.isFinite(bucket.sourcePrice) || bucket.sourcePrice <= 0) ||
        !Array.isArray(bucket.rows) || bucket.rows.length > MAX_ROWS_PER_BUCKET) {
      throw new QuantDataError("A GEX Interval Map bucket is invalid or unordered.", 422, null);
    }
    previousTimestamp = bucket.timestamp;
    totalRows += bucket.rows.length;
    if (totalRows > MAX_TOTAL_ROWS) throw new QuantDataError("The GEX Interval Map row surface exceeds its bound.", 422, null);
    let previousKey = "";
    const rows = [...bucket.rows].sort((left, right) =>
      left.expirationDate.localeCompare(right.expirationDate) || left.sourceStrike - right.sourceStrike);
    for (const row of rows) {
      const key = `${row.expirationDate}:${row.sourceStrike}`;
      if (!validDate(row.expirationDate) || !Number.isFinite(row.sourceStrike) ||
          !Number.isFinite(row.callExposure) || !Number.isFinite(row.putExposure) || key === previousKey) {
        throw new QuantDataError("A GEX Interval Map strike row is invalid or duplicated.", 422, null);
      }
      previousKey = key;
    }
    buckets.push({ timestamp: bucket.timestamp, sourcePrice: bucket.sourcePrice, rows });
  }
  for (const limitation of surface.limitations) {
    if (typeof limitation !== "string" || !limitation.trim() || limitation.length > 400) {
      throw new QuantDataError("A GEX Interval Map limitation is invalid.", 422, null);
    }
  }
  const asOfMs = buckets.at(-1)?.timestamp ?? checkedAtMs;
  const replayAsOfMs = history.historical ? asOfMs : null;
  const revision = createHash("sha256").update(JSON.stringify({
    sourceTicker,
    displayInstrument,
    sessionDate: surface.sessionDate,
    aggregationPeriod,
    asOfMs,
    buckets: buckets.map((bucket) => [
      bucket.timestamp,
      bucket.sourcePrice,
      bucket.rows.map((row) => [row.expirationDate, row.sourceStrike, row.callExposure, row.putExposure]),
    ]),
  })).digest("hex");
  return {
    ...surface,
    displayInstrument,
    buckets,
    rangeStartMs: history.startMs,
    rangeEndMs: history.endMs,
    receivedAtMs,
    asOfMs,
    replayAsOfMs,
    revision,
  };
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
    const nowMs = Date.now();
    const display = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
    if (!ALLOWED_DISPLAYS.has(display)) throw new QuantDataError("This display instrument is not supported by GEX Interval Map.", 400, null);
    const source = (request.nextUrl.searchParams.get("source") || defaultGexIntervalMapSource(display)).toUpperCase();
    if (!ALLOWED_SOURCES.has(source) || !familyMatches(display, source)) {
      throw new QuantDataError("The options source does not match the display family.", 400, null);
    }
    const aggregationPeriod = request.nextUrl.searchParams.get("aggregationPeriod") || "1m";
    if (!AGGREGATION_PERIODS.has(aggregationPeriod)) throw new QuantDataError("Unsupported interval aggregation.", 400, null);
    const requestedGreek = (request.nextUrl.searchParams.get("greekMode") || "GEX").toUpperCase();
    const greekMode = ({
      GEX: "GAMMA", GAMMA: "GAMMA", DEX: "DELTA", DELTA: "DELTA",
      VEX: "VANNA", VANNA: "VANNA", CHEX: "CHARM", CHARM: "CHARM",
    } as Record<string, GreekMode>)[requestedGreek];
    if (!greekMode) throw new QuantDataError("Unsupported interval Greek.", 400, null);
    if (!getConfiguredQuantDataApiKey()) throw new QuantDataError("GEX Interval Map options data is not configured.", 503, null);
    const history = parseHistory(request, nowMs);
    const cacheKey = request.nextUrl.searchParams.toString();
    const cached = payloadCache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      /*
       * This route already computed an ETag and then sent `no-store` beside
       * it, which forbids the browser from keeping the copy the ETag exists to
       * revalidate - so the tag could never match and the whole surface was
       * resent on every poll. The revision is a perfectly good identity; it
       * just needed a policy that allows a stored copy.
       */
      return conditionalJson(request, cached.payload, {
        identity: `${cacheKey}::${cached.payload.revision}`,
        maxAgeMs: Math.max(0, cached.expiresAt - nowMs),
      });
    }
    const surface = await getGexIntervalMapSurface({
      sourceTicker: source,
      sessionDate: history.sessionDate,
      startTime: history.startTime,
      endTime: history.endTime,
      aggregationPeriod,
      greekMode,
    });
    const payload = boundedReceipt(surface, display, source, aggregationPeriod, history, Date.now());
    evictCache(nowMs);
    payloadCache.set(cacheKey, {
      expiresAt: nowMs + Math.max(2_000, Math.min(60_000, payload.refreshAfterMs)),
      payload,
    });
    return conditionalJson(request, payload, {
      identity: `${cacheKey}::${payload.revision}`,
      // Just stored under this key for exactly this long.
      maxAgeMs: Math.max(2_000, Math.min(60_000, payload.refreshAfterMs)),
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, {
      status: problem.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
