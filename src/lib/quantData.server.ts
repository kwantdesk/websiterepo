import "server-only";
import { unstable_cache } from "next/cache";

import {
  OPTIONS_FLOW_TICKERS,
  canonicalOptionsSourceForRoot,
  classifyGammaEnvironment,
  isOptionsFuturesRatioSane,
  type ExposureExpiry,
  type ExposureStrike,
  type ExposureSummary,
  type FlowBoardItem,
  type GammaChangeWindow,
  type GreekMode,
  type IntradayExposureSeries,
  type MarketMapIntelligence,
  type OpenInterestStrike,
  type OptionsCandle,
  type OptionsFlowPayload,
  type OptionsFlowPrint,
  type OptionsKeyLevel,
  type OptionsMarketPulsePayload,
  type OptionsPositioningPulsePayload,
  type OptionsPriceMode,
  type PremiumDriftPoint,
  type TradeSidePremiumSummary,
  type VolatilitySkewPoint,
} from "@/lib/optionsFlow";
import {
  gexMapProviderTicker,
  latestGexMapStrikesFromFrames,
  type GexMapFrame,
  type GexMapPanelPayload,
} from "@/lib/gexMap";
import { resolveCashLevelOne } from "@/lib/optionsLevelOne.server";
import {
  filterUsRegularCashSessionCandles,
  normalizeMarketTimestamp,
} from "@/lib/optionsLevelOne";
import { resolveOptionsMarketData } from "@/lib/optionsMarketData.server";
import {
  getNativeFuturesSessionClose,
  getNativeFuturesSpot,
  getNativeGammaSnapshot,
  newYorkCashCloseIso,
  type NativeGammaRoot,
} from "@/lib/databentoGamma.server";
import {
  mergeGammaLevelsAtSamePrice,
  type ChartGammaLevelsPayload,
  type ChartGammaPositioningSnapshot,
  type ChartGammaSourceLevel,
  type ChartGammaSourceSnapshot,
} from "@/lib/chartGammaLevels";
import {
  buildGexDeskPayload,
  emptyGexDeskPressure,
  type GexDeskHistoryPayload,
  type GexDeskHistoryInstrument,
  type GexDeskHistorySourceSymbol,
  type GexDeskOptionPrint,
  type GexDeskPayload,
  type GexDeskPressurePoint,
  type GexDeskPressure,
  type GexDeskPressureSource,
  type GexDeskSourceSnapshot,
  type GexDeskSourceSymbol,
  type GexDeskZeroGammaPayload,
} from "@/lib/gexDesk";
import { getDatabentoBars } from "@/lib/databento";
import {
  classicGexMajor,
  classicGexStatus,
  mapClassicGexPrice,
  normalizeClassicGexRow,
  selectClassicGexRows,
  type ClassicGexExpiry,
  type ClassicGexMappingSource,
  type ClassicGexProfilePayload,
  type ClassicGexProfileRow,
  type ClassicGexSource,
} from "@/lib/classicGexProfile";
import { expectedMoveRange } from "@/lib/expectedMove";
import {
  deriveGammaCage,
  filterGammaExposureHorizon,
  gammaCageLabel,
  type GammaCageExpiryScope,
} from "@/lib/gammaCage";
import type { HedgeExposureSurface } from "@/lib/hedgeLevels";
import type { NetGammaProviderSurface } from "@/lib/netGammaExposureByStrike";
import {
  buildIvRankSnapshot,
  type IvRankContractMode,
  type IvRankSnapshot,
} from "@/lib/impliedVolatilityRank";
import { normalizeGexIntervalProviderPayload, type GexIntervalProviderSurface } from "@/lib/gexIntervalMap";
import {
  GEX_FLOW_SCORE_VERSION,
  deriveGexFlowContractRatios,
  estimateGexFlowDirection,
  gexFlowContractRatioFromTradeSideStatistics,
  gexFlowContractKey,
  gexFlowMoneyness,
  gexFlowOiAnalysis,
  gexFlowPremium,
  gexFlowSpreadPosition,
  filterGexFlowRowsAtCutoff,
  normalizeGexFlowSide,
  scoreGexFlowRows,
  summarizeGexFlow,
  type GexFlowMode,
  type GexFlowPayload,
  type GexFlowContractRatio,
  type GexFlowRow,
} from "@/lib/gexFlow";
import { getGexBotFlowSnapshot } from "@/lib/gexBotFlow.server";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";

const CACHE_TTL_MS = 4_000;
// KwantData exposes these snapshots over REST rather than a push stream. Four
// source surfaces at this cadence remain below the documented rolling-minute
// allowance when NQ and ES are both visible, while detecting revisions quickly.
const CHART_GAMMA_CACHE_TTL_MS = 2_500;
const REQUEST_TIMEOUT_MS = 10_000;
const API_KEY_NAME_PATTERN = /^qd_[A-Za-z0-9]{20,80}$/;

type JsonRecord = Record<string, unknown>;
type CachedRequest = {
  expiresAt: number;
  promise: Promise<OptionsFlowPayload>;
};
type CachedEndpoint = {
  expiresAt: number;
  promise: Promise<{ payload: unknown; remaining: number | null }>;
};

const requestCache = new Map<string, CachedRequest>();
const endpointCache = new Map<string, CachedEndpoint>();
// A provider refresh must never erase the most recent verified Gamma frame.
// This survives warm server invocations and complements the browser workspace
// cache, so transient entitlement/network responses degrade to stale data
// instead of a blank Gamma workspace.
const lastGoodOptionsFlowByInstrument = new Map<string, OptionsFlowPayload>();
const lastGoodGexFlowByRequest = new Map<string, GexFlowPayload>();
const gexFlowContractRatioCache = new Map<string, {
  expiresAt: number;
  promise: Promise<GexFlowContractRatio | null>;
}>();
// Last AUTO-mapping ratio formed while both legs (live futures, live cash
// source) were fresh, per source symbol. Used to pin the scale overnight so
// mapped levels stop tracking the futures price. Per-lambda: a cold instance
// falls back to the provider's frozen close pair, which is also pinned.
const lastLiveAutoScaleBySource = new Map<string, number>();
let gexDeskCache: { expiresAt: number; promise: Promise<GexDeskPayload> } | null = null;
const lastGoodGexMapPanelBySurface = new Map<string, GexMapPanelPayload>();

class QuantDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly remaining: number | null,
  ) {
    super(message);
  }
}

export function getConfiguredQuantDataApiKey() {
  const conventionalValue = process.env.QUANTDATA_API_KEY?.trim();
  if (conventionalValue) return conventionalValue;

  if (vendorMarketDataConfigured("quantdata")) return "vps-market-data-edge";

  return Object.keys(process.env).find((name) => API_KEY_NAME_PATTERN.test(name)) ?? null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIv(value: unknown): number | null {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  const normalized = parsed > 3 ? parsed / 100 : parsed;
  return normalized > 0 && normalized < 3 ? normalized : null;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// --- KwantData request throttle -------------------------------------------------
// The options-flow workspace loads ~17 panels at once; firing them all instantly trips
// KwantData's per-second rate limit and the stragglers fail. Space out request STARTS
// and retry 429s with backoff so every panel resolves instead of erroring.
const QD_MIN_SPACING_MS = 80;
const QD_MAX_RETRIES = 4;
const QD_TRANSIENT_RETRIES = 1;
const qdSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let qdNextStartMs = 0;
async function qdSchedule() {
  const now = Date.now();
  const start = Math.max(now, qdNextStartMs);
  qdNextStartMs = start + QD_MIN_SPACING_MS;
  if (start > now) await qdSleep(start - now);
}

async function quantDataNetworkPost(path: string, body: JsonRecord) {
  const apiKey = getConfiguredQuantDataApiKey();
  if (!apiKey) {
    throw new QuantDataError("KwantData is not configured.", 503, null);
  }

  for (let attempt = 0; ; attempt += 1) {
    await qdSchedule();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await vendorMarketDataFetch("quantdata", `/v1${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const remaining = finiteNumber(response.headers.get("x-ratelimit-remaining"));
      const payload = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        // Rate limits and short VPS/upstream interruptions are recoverable.
        // Retrying only 429 left whichever GEX panel started last (usually
        // QQQ) as the sole failed surface after a transient 502/503/504.
        const transientUpstream = [502, 503, 504].includes(response.status);
        const retryLimit = response.status === 429 ? QD_MAX_RETRIES : QD_TRANSIENT_RETRIES;
        if ((response.status === 429 || transientUpstream) && attempt < retryLimit) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 400 * (attempt + 1);
          clearTimeout(timeoutId);
          await qdSleep(waitMs);
          continue;
        }
        const detail = isRecord(payload) ? textValue(payload.detail) || textValue(payload.title) : "";
        throw new QuantDataError(detail || `KwantData request failed (${response.status}).`, response.status, remaining);
      }

      return { payload, remaining };
    } catch (error) {
      if (error instanceof QuantDataError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt < QD_TRANSIENT_RETRIES) {
          await qdSleep(500 * (attempt + 1));
          continue;
        }
        throw new QuantDataError("KwantData timed out while loading this workspace.", 504, null);
      }
      if (attempt < QD_TRANSIENT_RETRIES) {
        await qdSleep(500 * (attempt + 1));
        continue;
      }
      throw new QuantDataError("KwantData is temporarily unavailable.", 502, null);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function quantDataPost(path: string, body: JsonRecord, ttlMs = 0) {
  const cacheKey = `${path}:${JSON.stringify(body)}`;
  const cached = endpointCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = quantDataNetworkPost(path, body).catch((error) => {
    endpointCache.delete(cacheKey);
    throw error;
  });
  if (ttlMs > 0) endpointCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, promise });
  return promise;
}

/**
 * Server-only Dark Pool Map adapters. Keeping these beside the existing
 * QuantData scheduler means all chart/workspace instances share the same
 * provider cache and rate-limit/backoff policy; no vendor credential or
 * vendor request is emitted by the browser.
 */
export async function getDarkPoolLevelsPayload(sourceTicker: string, startDate: string, endDate: string) {
  return (await quantDataPost("/equities/tool/dark-pool-levels", {
    sessionDateRange: { startDate, endDate },
    filter: { ticker: sourceTicker.toUpperCase() },
  }, 15_000)).payload;
}

type DarkPoolPrintWalk = {
  rows: unknown[];
  truncated: boolean;
};

const darkPoolPrintHistoryCache = new Map<string, {
  expiresAt: number;
  promise: Promise<DarkPoolPrintWalk>;
}>();

const DARK_POOL_PRINT_FIELDS = [
  "ID",
  "TICKER",
  "PRICE",
  "SIZE",
  "NOTIONAL_VALUE",
  "PRINT_TYPE",
  "TRADE_SIDE",
  "ASK_PRICE",
  "ASK_SIZE",
  "BID_PRICE",
  "BID_SIZE",
  "IS_DELAYED_PRINT",
  "TRADE_TIME",
] as const;

function utcDayAfter(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

function quantDataRows(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.prints)) return payload.prints;
  return [];
}

function quantDataCursor(payload: unknown): string[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.nextSearchAfter)) return null;
  const cursor = payload.nextSearchAfter.filter((part): part is string => typeof part === "string");
  return cursor.length ? cursor : null;
}

function darkPoolPrintRequest(
  sourceTicker: string,
  startDate: string,
  endDate: string,
  minimumNotional: number,
  searchAfter?: string[],
) {
  const request: JsonRecord = {
    timeRange: {
      startTime: `${startDate}T00:00:00.000Z`,
      endTime: utcDayAfter(endDate),
    },
    filter: {
      ticker: sourceTicker.toUpperCase(),
      equityPrintTypes: ["DARK_POOL"],
    },
    includes: [...DARK_POOL_PRINT_FIELDS],
    size: 100,
    sort: { field: "tradeTime", direction: "DESCENDING" },
  };
  if (minimumNotional > 0) {
    request.filterExpression = {
      field: "NOTIONAL_VALUE",
      operation: ">=",
      value: String(minimumNotional),
    };
  }
  if (searchAfter?.length) request.searchAfter = searchAfter;
  return request;
}

async function walkDarkPoolPrintHistory(
  sourceTicker: string,
  startDate: string,
  endDate: string,
  maximumRows: number,
  minimumNotional: number,
): Promise<DarkPoolPrintWalk> {
  const rows: unknown[] = [];
  let searchAfter: string[] | undefined;
  // Cursor walks are sequential. Fifty pages keeps the first load comfortably
  // inside the serverless duration and provider quota; the renderer retains a
  // much larger rolling set by merging later two-second head-page refreshes.
  const maximumPages = Math.min(50, Math.ceil(maximumRows / 100));
  let truncated = false;
  for (let page = 0; page < maximumPages && rows.length < maximumRows; page += 1) {
    const result = await quantDataPost(
      "/equities/tool/equity-prints",
      darkPoolPrintRequest(sourceTicker, startDate, endDate, minimumNotional, searchAfter),
      60_000,
    );
    rows.push(...quantDataRows(result.payload));
    const next = quantDataCursor(result.payload);
    if (!next) return { rows: rows.slice(0, maximumRows), truncated: false };
    searchAfter = next;
  }
  truncated = Boolean(searchAfter);
  return { rows: rows.slice(0, maximumRows), truncated };
}

const getDurableDarkPoolPrintHistory = unstable_cache(
  async (
    sourceTicker: string,
    startDate: string,
    endDate: string,
    maximumRows: number,
    minimumNotional: number,
  ) => walkDarkPoolPrintHistory(sourceTicker, startDate, endDate, maximumRows, minimumNotional),
  ["quantdata-dark-pool-print-history-v1"],
  { revalidate: 300 },
);

export async function getDarkPoolPrintsPayload(
  sourceTicker: string,
  startDate: string,
  endDate: string,
  maximumRows = 100_000,
  minimumNotional = 0,
) {
  const boundedRows = Math.max(100, Math.min(100_000, Math.round(maximumRows)));
  const boundedNotional = Math.max(0, minimumNotional);
  const historyKey = `${sourceTicker.toUpperCase()}:${startDate}:${endDate}:${boundedRows}:${boundedNotional}`;
  const now = Date.now();
  let history = darkPoolPrintHistoryCache.get(historyKey);
  if (!history || history.expiresAt <= now) {
    const promise = getDurableDarkPoolPrintHistory(
      sourceTicker,
      startDate,
      endDate,
      boundedRows,
      boundedNotional,
    ).catch((error) => {
      darkPoolPrintHistoryCache.delete(historyKey);
      throw error;
    });
    history = { expiresAt: now + 60_000, promise };
    darkPoolPrintHistoryCache.set(historyKey, history);
  }

  const [head, historical] = await Promise.all([
    quantDataPost(
      "/equities/tool/equity-prints",
      darkPoolPrintRequest(sourceTicker, startDate, endDate, boundedNotional),
      2_000,
    ),
    history.promise,
  ]);
  return {
    data: [...quantDataRows(head.payload), ...historical.rows].slice(0, boundedRows),
    nextSearchAfter: null,
    truncated: historical.truncated,
  };
}

function parseExposure(
  payload: unknown,
  symbol: string,
  mode: GreekMode,
  expirationFilter?: string | ((expiration: string) => boolean),
): ExposureSummary | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const tickerNode = payload.data[symbol] ?? payload.data[symbol.toUpperCase()];
  if (!isRecord(tickerNode) || !isRecord(tickerNode.exposureMap)) return null;

  const byStrike = new Map<number, ExposureStrike>();
  const expiries: ExposureExpiry[] = [];
  const expiryStrikes: Array<ExposureStrike & { expiration: string }> = [];

  for (const [expiration, strikeMap] of Object.entries(tickerNode.exposureMap)) {
    if (typeof expirationFilter === "string" && expiration !== expirationFilter) continue;
    if (typeof expirationFilter === "function" && !expirationFilter(expiration)) continue;
    if (!isRecord(strikeMap)) continue;
    let expiryCall = 0;
    let expiryPut = 0;

    for (const [strikeKey, exposureCell] of Object.entries(strikeMap)) {
      if (!isRecord(exposureCell)) continue;
      const strike = finiteNumber(strikeKey);
      if (strike === null) continue;
      const call = finiteNumber(exposureCell.callExposure) ?? 0;
      const put = finiteNumber(exposureCell.putExposure) ?? 0;
      const existing = byStrike.get(strike) ?? { strike, call: 0, put: 0, net: 0 };
      existing.call += call;
      existing.put += put;
      existing.net = existing.call + existing.put;
      byStrike.set(strike, existing);
      expiryStrikes.push({ expiration, strike, call, put, net: call + put });
      expiryCall += call;
      expiryPut += put;
    }

    expiries.push({ expiration, call: expiryCall, put: expiryPut, net: expiryCall + expiryPut });
  }

  const strikes = [...byStrike.values()].sort((a, b) => a.strike - b.strike);
  if (!strikes.length) return null;
  const net = strikes.reduce((sum, strike) => sum + strike.net, 0);
  const gross = strikes.reduce((sum, strike) => sum + Math.abs(strike.call) + Math.abs(strike.put), 0);

  return {
    mode,
    representation: "PER_ONE_PERCENT_MOVE",
    net,
    gross,
    strikes,
    expiries: expiries.sort((a, b) => a.expiration.localeCompare(b.expiration)),
    expiryStrikes,
  };
}

function readStockPrice(payload: unknown, symbol: string): number | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const tickerNode = payload.data[symbol] ?? payload.data[symbol.toUpperCase()];
  return isRecord(tickerNode) ? finiteNumber(tickerNode.stockPrice) : null;
}

function classifySentiment(row: JsonRecord): "BULLISH" | "BEARISH" | "NEUTRAL" {
  const direct = textValue(row.sentimentType).toUpperCase();
  if (direct.includes("BULL")) return "BULLISH";
  if (direct.includes("BEAR")) return "BEARISH";

  const side = (textValue(row.tradeSideCode) || textValue(row.tradeSide)).toUpperCase();
  const contract = textValue(row.contractType).toUpperCase();
  const bought = side.includes("ASK") || side === "AA" || side === "A";
  const sold = side.includes("BID") || side === "BB" || side === "B";
  if ((!bought && !sold) || (contract !== "CALL" && contract !== "PUT")) return "NEUTRAL";
  if ((bought && contract === "CALL") || (sold && contract === "PUT")) return "BULLISH";
  return "BEARISH";
}

function parseFlow(payload: unknown): OptionsFlowPrint[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((value, index) => {
    if (!isRecord(value)) return [];
    const contract = textValue(value.contractType).toUpperCase();
    const tradeTime = finiteNumber(value.tradeTime);
    return [{
      id: textValue(value.id) || `flow-${tradeTime ?? 0}-${index}`,
      ticker: textValue(value.ticker),
      contractType: contract === "CALL" || contract === "PUT" ? contract : "UNKNOWN",
      expirationDate: textValue(value.expirationDate) || null,
      dte: finiteNumber(value.dte),
      strikePrice: finiteNumber(value.strikePrice),
      premium: finiteNumber(value.premium) ?? 0,
      size: finiteNumber(value.size) ?? finiteNumber(value.quantity),
      volume: finiteNumber(value.volume),
      openInterest: finiteNumber(value.openInterest),
      optionPrice: finiteNumber(value.optionPrice),
      stockPrice: finiteNumber(value.stockPrice),
      impliedVolatility: finiteNumber(value.impliedVolatility),
      side: textValue(value.tradeSideCode) || textValue(value.tradeSide) || "MID",
      consolidationType: textValue(value.tradeConsolidationType) || "TRADE",
      sentiment: classifySentiment(value),
      unusual: value.isUnusual === true,
      opening: value.isOpeningPosition === true,
      tradeTime: tradeTime ?? 0,
    } satisfies OptionsFlowPrint];
  });
}

function parseFlowBoard(payload: unknown): FlowBoardItem[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  return Object.entries(payload.data)
    .flatMap(([ticker, raw]) => {
      if (!isRecord(raw)) return [];
      const bullishPremium = finiteNumber(raw.bullishPremium) ?? 0;
      const bearishPremium = finiteNumber(raw.bearishPremium) ?? 0;
      const totalPremium = finiteNumber(raw.premium) ?? bullishPremium + bearishPremium;
      return [{
        ticker,
        bullishPremium,
        bearishPremium,
        netPremium: bullishPremium - bearishPremium,
        totalPremium,
        bullishShare: totalPremium > 0 ? bullishPremium / totalPremium : 0.5,
        tradeCount: finiteNumber(raw.tradeCount) ?? 0,
        volume: finiteNumber(raw.volume) ?? 0,
      }];
    })
    .sort((a, b) => b.totalPremium - a.totalPremium);
}

function parseDrift(payload: unknown): PremiumDriftPoint[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  let cumulativeCallPremium = 0;
  let cumulativePutPremium = 0;
  return Object.entries(payload.data)
    .map(([timestamp, raw]) => ({ timestamp: finiteNumber(timestamp), raw }))
    .filter((entry): entry is { timestamp: number; raw: unknown } => entry.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .flatMap(({ timestamp, raw }) => {
      if (!isRecord(raw)) return [];
      const callPremium = finiteNumber(raw.netCallPremium) ?? 0;
      const putPremium = finiteNumber(raw.netPutPremium) ?? 0;
      cumulativeCallPremium += callPremium;
      cumulativePutPremium += putPremium;
      return [{
        timestamp,
        callPremium,
        putPremium,
        cumulativeCallPremium,
        cumulativePutPremium,
        stockPrice: finiteNumber(raw.stockPrice),
      }];
    });
}

function parseCandles(payload: unknown, regularCashSessionOnly = false): OptionsCandle[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  const candles = Object.entries(payload.data)
    .flatMap(([timestamp, raw]) => {
      if (!isRecord(raw)) return [];
      const time = finiteNumber(timestamp);
      const open = finiteNumber(raw.openPrice);
      const high = finiteNumber(raw.highPrice);
      const low = finiteNumber(raw.lowPrice);
      const close = finiteNumber(raw.closePrice);
      if (time === null || open === null || high === null || low === null || close === null) return [];
      return [{ timestamp: time, open, high, low, close, volume: 0 }];
    })
    .sort((a, b) => a.timestamp - b.timestamp);
  return (regularCashSessionOnly ? filterUsRegularCashSessionCandles(candles) : candles).slice(-600);
}

function parseUnderlyingHistoryCandles(payload: unknown): OptionsCandle[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  return Object.entries(payload.data)
    .flatMap(([timestamp, raw]) => {
      if (!isRecord(raw)) return [];
      const time = normalizeMarketTimestamp(timestamp);
      const open = finiteNumber(raw.openPrice ?? raw.open ?? raw.o);
      const high = finiteNumber(raw.highPrice ?? raw.high ?? raw.h);
      const low = finiteNumber(raw.lowPrice ?? raw.low ?? raw.l);
      const close = finiteNumber(raw.closePrice ?? raw.close ?? raw.c);
      if (time === null || open === null || high === null || low === null || close === null) return [];
      return [{
        timestamp: time,
        open,
        high,
        low,
        close,
        volume: finiteNumber(raw.volume ?? raw.totalVolume ?? raw.tradeVolume ?? raw.v) ?? 0,
      }];
    })
    .sort((left, right) => left.timestamp - right.timestamp);
}

function underlyingHistoryBucket(timestamp: number, timeframe: string, sessionAnchor?: number) {
  if (timeframe === "1W") {
    const date = new Date(timestamp);
    const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - day + 1);
    return monday.getTime();
  }
  if (timeframe === "1M") {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  const durationMs: Record<string, number> = {
    "2h": 2 * 60 * 60_000,
    "4h": 4 * 60 * 60_000,
  };
  const minuteMatch = timeframe.match(/^(\d+)m$/);
  const duration = minuteMatch ? Number(minuteMatch[1]) * 60_000 : durationMs[timeframe];
  if (!duration) return timestamp;
  const anchor = sessionAnchor ?? 0;
  return anchor + Math.floor((timestamp - anchor) / duration) * duration;
}

function aggregateUnderlyingHistory(candles: OptionsCandle[], timeframe: string, sourceAggregation: string) {
  if (timeframe.toLowerCase() === sourceAggregation.toLowerCase()) return candles;
  const sessionAnchors = new Map<string, number>();
  if (/^\d+m$/.test(timeframe)) {
    for (const candle of candles) {
      const sessionDate = marketDateKey(candle.timestamp);
      const current = sessionAnchors.get(sessionDate);
      if (current === undefined || candle.timestamp < current) sessionAnchors.set(sessionDate, candle.timestamp);
    }
  }
  const grouped = new Map<number, OptionsCandle[]>();
  for (const candle of candles) {
    const sessionAnchor = sessionAnchors.get(marketDateKey(candle.timestamp));
    const bucket = underlyingHistoryBucket(candle.timestamp, timeframe, sessionAnchor);
    const rows = grouped.get(bucket);
    if (rows) rows.push(candle);
    else grouped.set(bucket, [candle]);
  }
  return [...grouped.entries()].map(([timestamp, rows]) => ({
    timestamp,
    open: rows[0].open,
    high: Math.max(...rows.map((row) => row.high)),
    low: Math.min(...rows.map((row) => row.low)),
    close: rows.at(-1)!.close,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
  }));
}

const UNDERLYING_COMPLETED_SESSION_REVALIDATE_SECONDS = 6 * 60 * 60;

function underlyingHistoryPlan(timeframe: string) {
  const minuteMatch = timeframe.match(/^(\d+)m$/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) return null;
    // KwantData's documented native minute buckets are used as the source.
    // Non-native minute intervals are built deterministically in KwantDesk,
    // anchored to the first print of each New York cash session.
    const sourceMinutes = [30, 15, 5, 1].find((candidate) => minutes % candidate === 0) ?? 1;
    return { aggregationPeriod: `${sourceMinutes}m`, sessionScoped: true };
  }
  const providerAggregation: Record<string, string> = {
    "1h": "1h",
    "2h": "1h",
    "4h": "1h",
    "1D": "1d",
    "1W": "1d",
    "1M": "1d",
  };
  const aggregationPeriod = providerAggregation[timeframe];
  return aggregationPeriod ? { aggregationPeriod, sessionScoped: false } : null;
}

function marketDateKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function weekdaySessionDates(from: number, to: number) {
  const start = marketDateKey(from);
  const end = marketDateKey(to);
  const cursor = new Date(`${start}T12:00:00.000Z`);
  const final = new Date(`${end}T12:00:00.000Z`);
  const dates: string[] = [];
  while (cursor <= final) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function getOptionsUnderlyingSessionHistory(
  symbol: string,
  aggregationPeriod: string,
  sessionDate: string,
) {
  const body = {
    sessionDate,
    aggregationPeriod,
    filter: { ticker: symbol },
  };
  const load = async () => (await quantDataPost(
    "/equities/tool/stock-price-over-time",
    body,
    sessionDate === marketDateKey(Date.now()) ? 5_000 : 60_000,
  )).payload;

  // Minute history is intentionally requested one market session at a time.
  // KwantData documents minute granularity for session
  // windows; sending a ten-calendar-day 1m request made the route spend its
  // timeout restoring thousands of buckets and could return an empty chart.
  // Completed sessions are immutable enough to share through Next's data
  // cache, while today's session keeps its short live cache above.
  return sessionDate === marketDateKey(Date.now())
    ? load()
    : unstable_cache(
        load,
        ["options-underlying-session-history-v1", symbol, aggregationPeriod, sessionDate],
        { revalidate: UNDERLYING_COMPLETED_SESSION_REVALIDATE_SECONDS },
      )();
}

/**
 * Historical cash-underlying bars used by the normal chart. This stays on the
 * shared VPS/KwantData adapter so browser charts never need a vendor key and a
 * Massive aggregate entitlement cannot leave an otherwise supported symbol
 * with an empty chart.
 */
export async function getOptionsUnderlyingHistory(input: {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
}): Promise<OptionsCandle[]> {
  const symbol = input.symbol.trim().toUpperCase();
  // SPXW is an option-class root, not a separate cash index. Its chart and
  // live underlying must use the canonical SPX cash tape while all option
  // exposure/flow requests continue to use SPXW.
  const cashTicker = symbol === "SPXW" ? "SPX" : symbol;
  const plan = underlyingHistoryPlan(input.timeframe);
  if (!plan) {
    throw new QuantDataError(`${input.timeframe} is not supported for cash-underlying history.`, 400, null);
  }
  const { aggregationPeriod, sessionScoped } = plan;
  const from = Math.min(input.from, input.to);
  const to = Math.max(input.from, input.to);
  let payloads: unknown[];
  if (sessionScoped) {
    const sessionResults = await Promise.allSettled(
      weekdaySessionDates(from, to).map((sessionDate) =>
        getOptionsUnderlyingSessionHistory(cashTicker, aggregationPeriod, sessionDate)),
    );
    payloads = sessionResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []);
    // A single transient/holiday-session response must not discard all of the
    // other valid days. Only surface an upstream failure when no session could
    // be restored at all.
    if (!payloads.length) {
      const failure = sessionResults.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
  } else {
    payloads = [(await quantDataPost("/equities/tool/stock-price-over-time", {
      timeRange: {
        startTime: new Date(from).toISOString(),
        endTime: new Date(to).toISOString(),
      },
      aggregationPeriod,
      filter: { ticker: cashTicker },
    }, to < Date.now() - 5 * 60_000 ? 5 * 60_000 : 5_000)).payload];
  }
  const candles = payloads.flatMap(parseUnderlyingHistoryCandles)
    .filter((candle) => candle.timestamp >= from && candle.timestamp <= to);
  const deduplicated = [...new Map(candles.map((candle) => [candle.timestamp, candle])).values()]
    .sort((left, right) => left.timestamp - right.timestamp);
  return aggregateUnderlyingHistory(deduplicated, input.timeframe, aggregationPeriod);
}

function parseIvRank(payload: unknown, sessionDate: string) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return { ivRank: null, callIv: null, putIv: null, atmIv: null, ivPercentile: null, historySessions: 0, expiration: null, priorAtmIv: null };
  }
  // Never let a historical replay borrow an IV observation published after
  // its selected session. The endpoint can return a long history ending today.
  const ordered = Object.entries(payload.data)
    .filter(([date]) => date <= sessionDate)
    .sort(([a], [b]) => a.localeCompare(b));
  const latest = ordered.at(-1)?.[1];
  if (!isRecord(latest) || !isRecord(latest.contractTypeToIVData)) {
    return { ivRank: null, callIv: null, putIv: null, atmIv: null, ivPercentile: null, historySessions: 0, expiration: null, priorAtmIv: null };
  }

  const rankLeg = (leg: unknown) => {
    if (!isRecord(leg)) return { rank: null, iv: null };
    const iv = normalizeIv(leg.lastIv);
    const min = normalizeIv(leg.windowMinIv);
    const max = normalizeIv(leg.windowMaxIv);
    const rank = iv !== null && min !== null && max !== null && max > min ? (iv - min) / (max - min) : null;
    return { rank, iv };
  };
  const call = rankLeg(latest.contractTypeToIVData.CALL);
  const put = rankLeg(latest.contractTypeToIVData.PUT);
  const availableRanks = [call.rank, put.rank].filter((value): value is number => value !== null);
  const atmIv = [call.iv, put.iv].filter((value): value is number => value !== null);
  const history = ordered.flatMap(([date, raw]) => {
    if (!isRecord(raw) || !isRecord(raw.contractTypeToIVData)) return [];
    const callIv = isRecord(raw.contractTypeToIVData.CALL) ? normalizeIv(raw.contractTypeToIVData.CALL.lastIv) : null;
    const putIv = isRecord(raw.contractTypeToIVData.PUT) ? normalizeIv(raw.contractTypeToIVData.PUT.lastIv) : null;
    const values = [callIv, putIv].filter((value): value is number => value !== null);
    return values.length ? [{ date, iv: values.reduce((sum, value) => sum + value, 0) / values.length }] : [];
  });
  const latestIv = atmIv.length ? atmIv.reduce((sum, value) => sum + value, 0) / atmIv.length : null;
  const historyValues = history.map((row) => row.iv);
  const priorHistory = historyValues.slice(0, -1);
  const priorAtmIv = history.filter((row) => row.date < sessionDate).at(-1)?.iv ?? null;
  const ivPercentile = latestIv !== null && priorHistory.length
    ? priorHistory.filter((value) => value <= latestIv).length / priorHistory.length
    : null;
  return {
    ivRank: availableRanks.length ? availableRanks.reduce((sum, value) => sum + value, 0) / availableRanks.length : null,
    callIv: call.iv,
    putIv: put.iv,
    atmIv: latestIv,
    ivPercentile,
    historySessions: historyValues.length,
    expiration: textValue(latest.expirationDate) || null,
    priorAtmIv,
  };
}

function parseOpenInterest(payload: unknown): OpenInterestStrike[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  return Object.entries(payload.data)
    .flatMap(([strikeKey, raw]) => {
      if (!isRecord(raw)) return [];
      const strike = finiteNumber(strikeKey);
      if (strike === null) return [];
      const callOpenInterest = finiteNumber(raw.callOpenInterest) ?? 0;
      const putOpenInterest = finiteNumber(raw.putOpenInterest) ?? 0;
      return [{
        strike,
        callOpenInterest,
        putOpenInterest,
        totalOpenInterest: callOpenInterest + putOpenInterest,
      } satisfies OpenInterestStrike];
    })
    .sort((a, b) => a.strike - b.strike);
}

type ParsedIntervalMap = {
  series: IntradayExposureSeries | null;
  strikeSnapshots: Array<{ timestamp: number; strikes: Map<number, ExposureStrike> }>;
};

const easternClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function isOptionsSessionTimestamp(timestamp: number) {
  const parts = easternClock.formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const minutes = hour * 60 + minute;
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60 + 15;
}

function parseIntervalMap(
  payload: unknown,
  mode: GreekMode,
  expiration: string,
): ParsedIntervalMap {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return { series: null, strikeSnapshots: [] };
  }

  const orderedBuckets = Object.entries(payload.data)
    .map(([timestampKey, rawBucket]) => ({ timestamp: finiteNumber(timestampKey), rawBucket }))
    .filter((entry): entry is { timestamp: number; rawBucket: unknown } => entry.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
  const strikeSnapshots: ParsedIntervalMap["strikeSnapshots"] = [];

  for (const { timestamp, rawBucket } of orderedBuckets) {
    if (!isRecord(rawBucket)) continue;
    const bucketByStrike = new Map<number, ExposureStrike>();
    const expiryNode = rawBucket[expiration];
    if (isRecord(expiryNode)) {
      for (const [strikeKey, rawCell] of Object.entries(expiryNode)) {
        if (!isRecord(rawCell)) continue;
        const strike = finiteNumber(strikeKey);
        if (strike === null) continue;
        const call = finiteNumber(rawCell.CALL) ?? 0;
        const put = finiteNumber(rawCell.PUT) ?? 0;
        bucketByStrike.set(strike, { strike, call, put, net: call + put });
      }
    }
    if (bucketByStrike.size && isOptionsSessionTimestamp(timestamp)) {
      strikeSnapshots.push({ timestamp, strikes: bucketByStrike });
    }
  }

  if (!strikeSnapshots.length) return { series: null, strikeSnapshots: [] };
  const points = strikeSnapshots.map(({ timestamp, strikes }) => {
    const values = [...strikes.values()];
    const call = values.reduce((sum, row) => sum + row.call, 0);
    const put = values.reduce((sum, row) => sum + row.put, 0);
    return {
      timestamp,
      call,
      put,
      net: call + put,
      gross: values.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    };
  });
  const latestStrikes = [...strikeSnapshots.at(-1)!.strikes.values()].sort((a, b) => a.strike - b.strike);
  const latestTimestamp = strikeSnapshots.at(-1)!.timestamp;
  const lookbacks = ([5, 15, 30] as const).flatMap((minutes) => {
    const target = latestTimestamp - minutes * 60_000;
    const snapshot = [...strikeSnapshots].reverse().find((item) => item.timestamp <= target);
    return snapshot ? [{ minutes, strikes: [...snapshot.strikes.values()].sort((a, b) => a.strike - b.strike) }] : [];
  });

  return {
    series: {
      mode,
      expiration,
      aggregationPeriod: "1m",
      points: points.slice(-420),
      latestStrikes,
      lookbacks,
    },
    strikeSnapshots,
  };
}

export async function getOptionsPositioningPulse(
  symbolInput: string,
  modeInput: string,
  expirationInput: string,
  strikeRange: { min: number; max: number } | null = null,
): Promise<OptionsPositioningPulsePayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const mode = modeInput.trim().toUpperCase() as GreekMode;
  const expiration = expirationInput.trim();
  if (!OPTIONS_FLOW_TICKERS.includes(symbol as (typeof OPTIONS_FLOW_TICKERS)[number])) {
    throw new QuantDataError("This ticker is not supported by live positioning.", 400, null);
  }
  if (!["GAMMA", "DELTA", "VANNA", "CHARM"].includes(mode)) {
    throw new QuantDataError("A valid positioning Greek is required.", 400, null);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiration)) {
    throw new QuantDataError("A valid front expiration is required.", 400, null);
  }

  const session = getUsOptionsSession();
  const result = await quantDataPost("/options/tool/interval-map", {
    sessionDate: session.sessionDate,
    aggregationPeriod: "1m",
    greekMode: mode,
    filter: {
      ticker: symbol,
      expirationDate: expiration,
      ...(strikeRange ? {
        minStrikePrice: strikeRange.min,
        maxStrikePrice: strikeRange.max,
      } : {}),
    },
  }, session.marketOpen ? 4_000 : 60_000);
  const parsed = parseIntervalMap(result.payload, mode, expiration);
  if (!parsed.series?.points.length) {
    throw new QuantDataError(
      session.marketOpen
        ? "Live positioning is waiting for the first completed one-minute bucket."
        : "No completed positioning buckets are available for this session.",
      422,
      result.remaining,
    );
  }
  const latestTimestamp = parsed.series.points.at(-1)!.timestamp;
  const status: OptionsPositioningPulsePayload["status"] = session.marketOpen
    ? Date.now() - latestTimestamp <= 3 * 60_000
      ? "LIVE"
      : "DELAYED"
    : "LAST_SESSION";
  return {
    symbol,
    source: "KwantData",
    asOf: new Date(latestTimestamp).toISOString(),
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    status,
    session,
    mode,
    expiration,
    series: parsed.series,
    rateLimitRemaining: result.remaining,
  };
}

function parseGexMapFrames(payload: unknown, expiration: string): GexMapFrame[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  return Object.entries(payload.data)
    .map(([timestampKey, rawBucket]) => ({ timestamp: finiteNumber(timestampKey), rawBucket }))
    .filter((entry): entry is { timestamp: number; rawBucket: unknown } => entry.timestamp !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .flatMap(({ timestamp, rawBucket }) => {
      if (!isRecord(rawBucket) || !isOptionsSessionTimestamp(timestamp)) return [];
      const expiryNode = rawBucket[expiration];
      if (!isRecord(expiryNode)) return [];
      const updates = Object.entries(expiryNode).flatMap(([strikeKey, rawCell]) => {
        if (!isRecord(rawCell)) return [];
        const strike = finiteNumber(strikeKey);
        if (strike === null) return [];
        const call = finiteNumber(rawCell.CALL) ?? 0;
        const put = finiteNumber(rawCell.PUT) ?? 0;
        return [{ strike, call, put, net: call + put }];
      });
      return updates.length ? [{ timestamp, updates }] : [];
    })
    .slice(-480);
}

function parseFullChainGexMapFrames(payload: unknown): GexMapFrame[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  return Object.entries(payload.data)
    .map(([timestampKey, rawBucket]) => ({ timestamp: finiteNumber(timestampKey), rawBucket }))
    .filter((entry): entry is { timestamp: number; rawBucket: unknown } => entry.timestamp !== null)
    .sort((left, right) => left.timestamp - right.timestamp)
    .flatMap(({ timestamp, rawBucket }) => {
      if (!isRecord(rawBucket) || !isOptionsSessionTimestamp(timestamp)) return [];
      const strikes = new Map<number, ExposureStrike>();
      for (const rawExpiry of Object.values(rawBucket)) {
        if (!isRecord(rawExpiry)) continue;
        for (const [strikeKey, rawCell] of Object.entries(rawExpiry)) {
          if (!isRecord(rawCell)) continue;
          const strike = finiteNumber(strikeKey);
          if (strike === null) continue;
          const call = finiteNumber(rawCell.CALL) ?? 0;
          const put = finiteNumber(rawCell.PUT) ?? 0;
          const prior = strikes.get(strike) ?? { strike, call: 0, put: 0, net: 0 };
          prior.call += call;
          prior.put += put;
          prior.net += call + put;
          strikes.set(strike, prior);
        }
      }
      const updates = [...strikes.values()].sort((left, right) => left.strike - right.strike);
      return updates.length ? [{ timestamp, updates }] : [];
    })
    .slice(-480);
}

function deriveGammaChange(parsed: ParsedIntervalMap): GammaChangeWindow[] {
  const snapshots = parsed.strikeSnapshots;
  const latest = snapshots.at(-1);
  if (!latest) return [];

  return ([1, 5, 15, 30] as const).flatMap((minutes) => {
    const target = latest.timestamp - minutes * 60_000;
    const previous = [...snapshots].reverse().find((snapshot) => snapshot.timestamp <= target);
    if (!previous) return [];

    const strikes = new Set([...latest.strikes.keys(), ...previous.strikes.keys()]);
    const changes = [...strikes].map((strike) => {
      const currentValue = latest.strikes.get(strike)?.net ?? 0;
      const previousValue = previous.strikes.get(strike)?.net ?? 0;
      return { strike, currentValue, previousValue, change: currentValue - previousValue };
    });
    const largest = changes.reduce((best, row) => Math.abs(row.change) > Math.abs(best.change) ? row : best);
    const state: GammaChangeWindow["state"] = largest.currentValue >= 0
      ? largest.change >= 0 ? "POSITIVE_BUILD" : "POSITIVE_UNWIND"
      : largest.change <= 0 ? "NEGATIVE_BUILD" : "NEGATIVE_UNWIND";
    return [{ minutes, ...largest, state }];
  });
}

function parseVolatilitySkew(payload: unknown, expiration: string): VolatilitySkewPoint[] {
  if (!isRecord(payload) || !isRecord(payload.data)) return [];
  const expiryNode = payload.data[expiration];
  if (!isRecord(expiryNode)) return [];
  return Object.entries(expiryNode)
    .flatMap(([strikeKey, rawCell]) => {
      const strike = finiteNumber(strikeKey);
      if (strike === null || !isRecord(rawCell)) return [];
      return [{
        strike,
        callIv: normalizeIv(rawCell.CALL),
        putIv: normalizeIv(rawCell.PUT),
      } satisfies VolatilitySkewPoint];
    })
    .sort((a, b) => a.strike - b.strike);
}

function parseTradeSidePremium(payload: unknown): TradeSidePremiumSummary | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const data = payload.data;
  const premium = (contract: "CALL" | "PUT", side: string) => {
    const contractNode = data[contract];
    if (!isRecord(contractNode)) return 0;
    const sideNode = contractNode[side];
    if (!isRecord(sideNode)) return 0;
    return finiteNumber(sideNode.premium) ?? 0;
  };
  const callBought = premium("CALL", "ABOVE_ASK") + premium("CALL", "ASK");
  const callSold = premium("CALL", "BID") + premium("CALL", "BELOW_BID");
  const putBought = premium("PUT", "ABOVE_ASK") + premium("PUT", "ASK");
  const putSold = premium("PUT", "BID") + premium("PUT", "BELOW_BID");
  const neutral = premium("CALL", "MID_MARKET") + premium("PUT", "MID_MARKET");
  const longOptionPremium = callBought + putBought;
  const shortOptionPremium = callSold + putSold;
  const directionalTotal = longOptionPremium + shortOptionPremium;
  if (directionalTotal <= 0 && neutral <= 0) return null;
  return {
    callBought,
    callSold,
    putBought,
    putSold,
    neutral,
    longOptionPremium,
    shortOptionPremium,
    netLongPremium: longOptionPremium - shortOptionPremium,
    longShare: directionalTotal > 0 ? longOptionPremium / directionalTotal : null,
  };
}

function parseContractStatistics(payload: unknown): MarketMapIntelligence["putCallVolume"] {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const call = isRecord(payload.data.CALL) ? payload.data.CALL : null;
  const put = isRecord(payload.data.PUT) ? payload.data.PUT : null;
  const callVolume = call ? finiteNumber(call.volume) ?? 0 : 0;
  const putVolume = put ? finiteNumber(put.volume) ?? 0 : 0;
  const totalVolume = callVolume + putVolume;
  if (totalVolume <= 0) return null;
  return {
    callVolume,
    putVolume,
    totalVolume,
    putCallRatio: callVolume > 0 ? putVolume / callVolume : null,
    callPremium: call ? finiteNumber(call.premium) ?? 0 : 0,
    putPremium: put ? finiteNumber(put.premium) ?? 0 : 0,
  };
}

function sessionDte(sessionDate: string, expiration: string) {
  const sessionTime = Date.parse(`${sessionDate}T00:00:00Z`);
  const expirationTime = Date.parse(`${expiration}T00:00:00Z`);
  if (!Number.isFinite(sessionTime) || !Number.isFinite(expirationTime)) return null;
  return Math.round((expirationTime - sessionTime) / 86_400_000);
}

type DeltaIvCandidate = { distance: number; iv: number; strike: number };

function nearestDeltaCandidate(
  expiryNode: JsonRecord,
  contract: "CALL" | "PUT",
  targetDelta: number,
): DeltaIvCandidate | null {
  let best: DeltaIvCandidate | null = null;
  for (const [strikeKey, rawCell] of Object.entries(expiryNode)) {
    if (!isRecord(rawCell) || !isRecord(rawCell[contract])) continue;
    const strike = finiteNumber(strikeKey);
    const delta = finiteNumber(rawCell[contract].delta);
    const iv = normalizeIv(rawCell[contract].iv);
    if (strike === null || delta === null || iv === null) continue;
    const distance = Math.abs(delta - targetDelta);
    if (!best || distance < best.distance) best = { distance, iv, strike };
  }
  return best;
}

function skewSummary(
  expiration: string,
  dte: number,
  call: DeltaIvCandidate | null,
  put: DeltaIvCandidate | null,
): MarketMapIntelligence["volatility"]["skew0Dte"] {
  if (!call || !put) return null;
  if (call.distance > 0.12 || put.distance > 0.12) return null;
  const ivRatio = Math.max(call.iv, put.iv) / Math.max(0.0001, Math.min(call.iv, put.iv));
  if (ivRatio > 4) return null;
  const difference = put.iv - call.iv;
  const midpoint = (put.iv + call.iv) / 2;
  const relativeBias = midpoint > 0 ? difference / midpoint : 0;
  return {
    expiration,
    dte,
    put25DeltaIv: put.iv,
    call25DeltaIv: call.iv,
    difference,
    relativeBias,
    state: relativeBias > 0.05 ? "PUT_BIAS" : relativeBias < -0.05 ? "CALL_BIAS" : "BALANCED",
  };
}

function parseTermStructure(payload: unknown, sessionDate: string) {
  const empty = {
    termStructure: [] as MarketMapIntelligence["volatility"]["termStructure"],
    skew0Dte: null as MarketMapIntelligence["volatility"]["skew0Dte"],
    skew30Dte: null as MarketMapIntelligence["volatility"]["skew30Dte"],
    termStructureState: "UNAVAILABLE" as MarketMapIntelligence["volatility"]["termStructureState"],
  };
  if (!isRecord(payload) || !isRecord(payload.data)) return empty;

  const rows = Object.entries(payload.data).flatMap(([expiration, rawExpiry]) => {
    if (!isRecord(rawExpiry)) return [];
    const dte = sessionDte(sessionDate, expiration);
    if (dte === null || dte < 0) return [];
    const atmCall = nearestDeltaCandidate(rawExpiry, "CALL", 0.5);
    const atmPut = nearestDeltaCandidate(rawExpiry, "PUT", -0.5);
    const atmValues = [atmCall?.iv, atmPut?.iv].filter((value): value is number => value !== undefined);
    if (!atmValues.length) return [];
    const atmIv = atmValues.reduce((sum, value) => sum + value, 0) / atmValues.length;
    return [{
      point: {
        expiration,
        dte,
        strike: atmCall && atmPut ? (atmCall.strike + atmPut.strike) / 2 : (atmCall?.strike ?? atmPut!.strike),
        atmIv,
        callIv: atmCall?.iv ?? null,
        putIv: atmPut?.iv ?? null,
      },
      skew: skewSummary(
        expiration,
        dte,
        nearestDeltaCandidate(rawExpiry, "CALL", 0.25),
        nearestDeltaCandidate(rawExpiry, "PUT", -0.25),
      ),
    }];
  }).sort((a, b) => a.point.dte - b.point.dte);

  if (!rows.length) return empty;
  const nearest = (target: number) => rows.reduce((best, row) => Math.abs(row.point.dte - target) < Math.abs(best.point.dte - target) ? row : best);
  const front = rows.find((row) => row.point.dte >= 1) ?? rows[0];
  const back = nearest(90);
  const slope = front.point.atmIv > 0 ? back.point.atmIv / front.point.atmIv - 1 : 0;
  return {
    termStructure: rows.map((row) => row.point),
    skew0Dte: rows.find((row) => row.point.dte === 0)?.skew ?? null,
    skew30Dte: nearest(30).skew,
    termStructureState: slope > 0.03 ? "CONTANGO" as const : slope < -0.03 ? "BACKWARDATION" as const : "FLAT" as const,
  };
}

function historicalVolatility21d(candles: OptionsCandle[], sessionDate: string, marketOpen: boolean) {
  const completed = candles.filter((candle) => {
    const date = new Date(candle.timestamp).toISOString().slice(0, 10);
    return marketOpen ? date < sessionDate : date <= sessionDate;
  });
  const closes = completed.slice(-22).map((candle) => candle.close).filter((value) => value > 0);
  if (closes.length < 12) return null;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function deriveDteGamma(gamma: ExposureSummary | null, sessionDate: string): MarketMapIntelligence["dealerPositioning"]["dteGamma"] {
  const buckets: MarketMapIntelligence["dealerPositioning"]["dteGamma"] = [
    { label: "0-5 DTE", minDte: 0, maxDte: 5, call: 0, put: 0, net: 0, gross: 0 },
    { label: "6-20 DTE", minDte: 6, maxDte: 20, call: 0, put: 0, net: 0, gross: 0 },
    { label: ">20 DTE", minDte: 21, maxDte: null, call: 0, put: 0, net: 0, gross: 0 },
  ];
  for (const expiry of gamma?.expiries ?? []) {
    const dte = sessionDte(sessionDate, expiry.expiration);
    if (dte === null || dte < 0) continue;
    const bucket = buckets.find((row) => dte >= row.minDte && (row.maxDte === null || dte <= row.maxDte));
    if (!bucket) continue;
    bucket.call += expiry.call;
    bucket.put += expiry.put;
    bucket.net += expiry.net;
    bucket.gross += Math.abs(expiry.call) + Math.abs(expiry.put);
  }
  return buckets;
}

function intradayChange(series: IntradayExposureSeries | null, minutes: number) {
  const latest = series?.points.at(-1);
  if (!series || !latest) return null;
  const target = latest.timestamp - minutes * 60_000;
  const previous = [...series.points].reverse().find((point) => point.timestamp <= target);
  return previous ? latest.net - previous.net : null;
}

function lastGammaFlip(series: IntradayExposureSeries | null) {
  const points = series?.points ?? [];
  for (let index = points.length - 1; index > 0; index -= 1) {
    const currentSign = Math.sign(points[index].net);
    const previousSign = Math.sign(points[index - 1].net);
    if (currentSign !== 0 && previousSign !== 0 && currentSign !== previousSign) return points[index].timestamp;
  }
  return null;
}

function parseMaxPain(payload: unknown) {
  return isRecord(payload) ? finiteNumber(payload.maxPainStrikePrice) : null;
}

export function deriveGammaLevels(
  gamma: ExposureSummary | null,
  spot: number | null,
  expiryScope: GammaCageExpiryScope = "NEAR_TERM_7D",
) {
  return deriveGammaCage(gamma, spot, expiryScope);
}

/**
 * Estimate the current-session volume GEX profile using the same volume/OI
 * scaling used by GEX Desk. Consolidated flow can contain several prints for
 * one contract, while `volume` and `openInterest` are contract snapshots, so
 * only the largest observed snapshot is retained before rolling up by strike.
 */
export function deriveSessionVolumeGamma(
  gamma: ExposureSummary | null,
  flow: OptionsFlowPrint[],
): ExposureSummary | null {
  if (!gamma?.strikes.length || !flow.length) return null;
  const contracts = new Map<string, {
    strike: number;
    contractType: "CALL" | "PUT";
    volume: number;
    openInterest: number;
  }>();
  for (const row of flow) {
    if (
      (row.contractType !== "CALL" && row.contractType !== "PUT")
      || row.strikePrice === null
      || row.strikePrice <= 0
    ) continue;
    const volume = Math.max(0, row.volume ?? 0);
    const openInterest = Math.max(0, row.openInterest ?? 0);
    if (!volume || !openInterest) continue;
    const key = `${row.expirationDate ?? "unknown"}:${row.strikePrice}:${row.contractType}`;
    const previous = contracts.get(key);
    if (!previous || volume > previous.volume || openInterest > previous.openInterest) {
      contracts.set(key, {
        strike: row.strikePrice,
        contractType: row.contractType,
        volume,
        openInterest,
      });
    }
  }
  const ratios = new Map<number, { callVolume: number; callOi: number; putVolume: number; putOi: number }>();
  for (const contract of contracts.values()) {
    const aggregate = ratios.get(contract.strike) ?? { callVolume: 0, callOi: 0, putVolume: 0, putOi: 0 };
    if (contract.contractType === "CALL") {
      aggregate.callVolume += contract.volume;
      aggregate.callOi += contract.openInterest;
    } else {
      aggregate.putVolume += contract.volume;
      aggregate.putOi += contract.openInterest;
    }
    ratios.set(contract.strike, aggregate);
  }
  const strikes = gamma.strikes.map((strike) => {
    const ratio = ratios.get(strike.strike);
    const callScale = ratio?.callOi ? Math.min(8, ratio.callVolume / ratio.callOi) : 0;
    const putScale = ratio?.putOi ? Math.min(8, ratio.putVolume / ratio.putOi) : 0;
    const call = strike.call * callScale;
    const put = strike.put * putScale;
    return { strike: strike.strike, call, put, net: call + put };
  }).filter((strike) => strike.call !== 0 || strike.put !== 0);
  if (!strikes.length) return null;
  return {
    mode: "GAMMA",
    representation: "PER_ONE_PERCENT_MOVE",
    net: strikes.reduce((sum, strike) => sum + strike.net, 0),
    gross: strikes.reduce((sum, strike) => sum + Math.abs(strike.call) + Math.abs(strike.put), 0),
    strikes,
    expiries: [],
  };
}

function majorPositiveGamma(exposure: ExposureSummary | null) {
  const positive = exposure?.strikes.filter((strike) => strike.net > 0) ?? [];
  return positive.length
    ? positive.reduce((best, strike) => strike.net > best.net ? strike : best)
    : null;
}

function chartGammaSourceLevels(
  gamma: ExposureSummary,
  spot: number,
  delta: ExposureSummary | null = null,
  sessionVolumeGamma: ExposureSummary | null = null,
  expiryScope: GammaCageExpiryScope = "NEAR_TERM_7D",
): ChartGammaSourceLevel[] {
  const key = deriveGammaCage(gamma, spot, expiryScope);
  const majorPositiveVolume = majorPositiveGamma(sessionVolumeGamma);
  const lowerBound = spot * 0.97;
  const upperBound = spot * 1.03;
  const deltaByStrike = new Map(delta?.strikes.map((row) => [row.strike, row.net]) ?? []);
  const candidates = gamma.strikes.filter((row) =>
    row.strike >= lowerBound
    && row.strike <= upperBound
    && (row.net !== 0 || (deltaByStrike.get(row.strike) ?? 0) !== 0));
  const maxGex = Math.max(1, ...candidates.map((row) => Math.abs(row.net)));
  const maxDex = Math.max(1, ...candidates.map((row) => Math.abs(deltaByStrike.get(row.strike) ?? 0)));
  const rankedGex = candidates
    .map((row) => {
      const dex = deltaByStrike.get(row.strike) ?? 0;
      return {
        ...row,
        dex,
        score: Math.abs(row.net) / maxGex * 0.65 + Math.abs(dex) / maxDex * 0.35,
      };
    })
    .sort((left, right) =>
      right.score - left.score
      || Math.abs(right.net) - Math.abs(left.net)
      || Math.abs(right.dex) - Math.abs(left.dex))
    .slice(0, 10);
  const rows: Array<ChartGammaSourceLevel | null> = [
    key.callWall === null ? null : {
      id: "call-wall",
      kind: "CALL_WALL",
      label: gammaCageLabel("CALL_WALL", key.regime),
      price: key.callWall,
      value: strikeMetric(gamma, key.callWall, "call"),
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.callWall,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.putWall === null ? null : {
      id: "put-wall",
      kind: "PUT_WALL",
      label: gammaCageLabel("PUT_WALL", key.regime),
      price: key.putWall,
      value: strikeMetric(gamma, key.putWall, "put"),
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.putWall,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.gammaHvl === null ? null : {
      id: "hvl",
      kind: "HIGH_VOL_LEVEL",
      label: "HVL",
      price: key.gammaHvl,
      value: null,
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.gammaHvl,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.gammaMagnet === null ? null : {
      id: "gamma-magnet",
      kind: "GAMMA_MAGNET",
      label: gammaCageLabel("GAMMA_MAGNET", key.regime),
      price: key.gammaMagnet,
      value: strikeMetric(gamma, key.gammaMagnet, "net"),
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.gammaMagnet,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.gammaAccelerator === null ? null : {
      id: "gamma-accelerator",
      kind: "GAMMA_ACCELERATOR",
      label: gammaCageLabel("GAMMA_ACCELERATOR", key.regime),
      price: key.gammaAccelerator,
      value: strikeMetric(gamma, key.gammaAccelerator, "net"),
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.gammaAccelerator,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.gammaFlip === null ? null : {
      id: "gamma-flip",
      kind: "ZERO_GAMMA",
      label: gammaCageLabel("ZERO_GAMMA", key.regime),
      price: key.gammaFlip,
      value: null,
      rank: 1,
      expiryScope,
      dominantExpiry: key.dominantExpiry.gammaFlip,
      regime: key.regime,
      signConvention: key.signConvention,
    },
    key.gammaCenter === null ? null : {
      id: "gamma-centre",
      kind: "GAMMA_CENTRE",
      label: "KWANT center",
      price: key.gammaCenter,
      value: null,
      rank: 1,
    },
    key.majorPositiveOi === null ? null : {
      id: "major-positive-oi",
      kind: "MAJOR_POSITIVE_OI",
      label: "MPO",
      price: key.majorPositiveOi.strike,
      value: key.majorPositiveOi.net,
      rank: 0,
    },
    majorPositiveVolume === null ? null : {
      id: "major-positive-volume",
      kind: "MAJOR_POSITIVE_VOLUME",
      label: "MPV",
      price: majorPositiveVolume.strike,
      value: majorPositiveVolume.net,
      rank: 0,
    },
    ...rankedGex.map((row, index) => ({
      id: `gex-${index + 1}`,
      kind: row.net > 0 ? "POSITIVE_GEX" as const : "NEGATIVE_GEX" as const,
      label: `KWANT ${index + 1}`,
      price: row.strike,
      value: row.net,
      rank: index + 1,
    })),
  ];
  const merged = new Map<string, ChartGammaSourceLevel>();
  for (const row of rows.filter((candidate): candidate is ChartGammaSourceLevel => candidate !== null)) {
    const priceKey = row.price.toFixed(6);
    const existing = merged.get(priceKey);
    if (!existing) {
      merged.set(priceKey, row);
      continue;
    }
    const labels = new Set([...existing.label.split(" / "), ...row.label.split(" / ")]);
    merged.set(priceKey, {
      ...existing,
      id: `${existing.id}-${row.id}`,
      label: [...labels].join(" / "),
      value: Math.abs(row.value ?? 0) > Math.abs(existing.value ?? 0) ? row.value : existing.value,
      rank: Math.min(existing.rank, row.rank),
    });
  }
  return [...merged.values()];
}

function chartGammaSourceSnapshot(
  symbol: ChartGammaSourceSnapshot["symbol"],
  payload: unknown,
  sessionDate: string,
  delta: ExposureSummary | null = null,
  flowPayload: unknown = null,
): ChartGammaSourceSnapshot | null {
  const structuralGamma = parseExposure(payload, symbol, "GAMMA");
  const gamma = filterGammaExposureHorizon(structuralGamma, sessionDate, 7);
  const stockPrice = readStockPrice(payload, symbol);
  if (!gamma || stockPrice === null || stockPrice <= 0) return null;
  const nearTermDelta = filterGammaExposureHorizon(delta, sessionDate, 7);
  const sessionVolumeGamma = deriveSessionVolumeGamma(gamma, parseFlow(flowPayload));
  const cage = deriveGammaCage(gamma, stockPrice, "NEAR_TERM_7D");
  const levels = chartGammaSourceLevels(gamma, stockPrice, nearTermDelta, sessionVolumeGamma, "NEAR_TERM_7D");
  const validationStrikes = gamma.strikes
    .map((row) => row.strike)
    .filter((strike) => strike >= stockPrice * 0.97 && strike <= stockPrice * 1.03);
  return {
    symbol,
    stockPrice,
    revision: JSON.stringify({
      net: gamma.net,
      gross: gamma.gross,
      levels: levels.map((row) => [row.kind, row.price, row.value]),
    }),
    validationStrikes,
    levels,
    cage: {
      regime: cage.regime,
      flip: cage.gammaFlip,
      crossings: cage.gammaCrossings,
      flipNote: cage.flipNote,
      expiryScope: cage.expiryScope,
      signConvention: cage.signConvention,
    },
  };
}

function deriveGexClusters(
  gamma: ExposureSummary | null,
  delta: ExposureSummary | null,
  spot: number | null,
  limit = 5,
) {
  if (!gamma || !delta || spot === null) return [];
  const deltaByStrike = new Map(delta.strikes.map((row) => [row.strike, row.net]));
  const candidates = gamma.strikes.filter((row) => row.strike >= spot * 0.97 && row.strike <= spot * 1.03);
  if (!candidates.length) return [];
  const maxGex = Math.max(1, ...candidates.map((row) => Math.abs(row.net)));
  const maxDex = Math.max(1, ...candidates.map((row) => Math.abs(deltaByStrike.get(row.strike) ?? 0)));
  return candidates
    .map((row) => ({
      strike: row.strike,
      value: row.net,
      score: Math.abs(row.net) / maxGex * 0.65 + Math.abs(deltaByStrike.get(row.strike) ?? 0) / maxDex * 0.35,
    }))
    .sort((a, b) => b.score - a.score || Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);
}

function derivePutSupportLevels(
  gamma: ExposureSummary | null,
  openInterest: OpenInterestStrike[],
  spot: number | null,
  limit = 3,
) {
  if (!gamma || spot === null) return [];
  const oiByStrike = new Map(openInterest.map((row) => [row.strike, row]));
  const candidates = gamma.strikes.filter((row) => row.strike <= spot && row.strike >= spot * 0.95 && row.put !== 0);
  const maxPutGex = Math.max(1, ...candidates.map((row) => Math.abs(row.put)));
  const maxPutOi = Math.max(1, ...openInterest.map((row) => row.putOpenInterest));
  return candidates
    .map((row) => {
      const putOpenInterest = oiByStrike.get(row.strike)?.putOpenInterest ?? 0;
      const score = Math.abs(row.put) / maxPutGex * 0.75 + putOpenInterest / maxPutOi * 0.25;
      return { strike: row.strike, value: row.put, score };
    })
    .sort((a, b) => b.score - a.score || b.strike - a.strike)
    .slice(0, limit);
}

function strikeMetric(exposure: ExposureSummary | null, price: number | null, field: "call" | "put" | "net") {
  if (!exposure || price === null) return null;
  return exposure.strikes.find((row) => row.strike === price)?.[field] ?? null;
}

function createKeyLevels(args: {
  gamma: ExposureSummary | null;
  sessionVolumeGamma: ExposureSummary | null;
  zeroDteGamma: ExposureSummary | null;
  zeroDteMaxPain: number | null;
  fullLevels: ReturnType<typeof deriveGammaLevels>;
  zeroDteLevels: ReturnType<typeof deriveGammaLevels>;
  putSupport: ReturnType<typeof derivePutSupportLevels>;
  zeroDtePutSupport: ReturnType<typeof derivePutSupportLevels>;
  gexClusters: ReturnType<typeof deriveGexClusters>;
}) {
  const sessionMajorPositive = majorPositiveGamma(args.sessionVolumeGamma);
  const rows: Array<OptionsKeyLevel | null> = [
    args.fullLevels.callWall === null ? null : {
      id: "call-wall",
      kind: "CALL_WALL",
      label: gammaCageLabel("CALL_WALL", args.fullLevels.regime),
      price: args.fullLevels.callWall,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.callWall, "call"),
      rank: 1,
      derived: true,
      explanation: "The strongest near-term call-side cage object. Positive net exposure means dealer-long-gamma hedging opposes price movement; in negative regime the same strike becomes a rail rather than an automatic fade.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.callWall,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.putWall === null ? null : {
      id: "put-wall",
      kind: "PUT_WALL",
      label: gammaCageLabel("PUT_WALL", args.fullLevels.regime),
      price: args.fullLevels.putWall,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.putWall, "put"),
      rank: 1,
      derived: true,
      explanation: "The strongest near-term put-side cage object. Its holding language is valid only while the cumulative gamma regime at spot is positive.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.putWall,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.gammaHvl === null ? null : {
      id: "hvl",
      kind: "HIGH_VOL_LEVEL",
      label: "HVL",
      price: args.fullLevels.gammaHvl,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.gammaHvl, "net"),
      rank: 1,
      derived: true,
      explanation: "High Volatility Level: the strongest nearby inflection or steepest transition in the smoothed gamma-exposure profile. It is separate from the scenario-repriced Zero Gamma crossing.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.gammaHvl,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.gammaMagnet === null ? null : {
      id: "gamma-magnet",
      kind: "GAMMA_MAGNET",
      label: gammaCageLabel("GAMMA_MAGNET", args.fullLevels.regime),
      price: args.fullLevels.gammaMagnet,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.gammaMagnet, "net"),
      rank: 1,
      derived: true,
      explanation: "Largest positive net gamma strike within three percent of spot. Dealers are long gamma here, so mechanical hedging opposes price and can create glue.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.gammaMagnet,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.gammaAccelerator === null ? null : {
      id: "gamma-accelerator",
      kind: "GAMMA_ACCELERATOR",
      label: gammaCageLabel("GAMMA_ACCELERATOR", args.fullLevels.regime),
      price: args.fullLevels.gammaAccelerator,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.gammaAccelerator, "net"),
      rank: 1,
      derived: true,
      explanation: "Most negative net gamma strike within three percent of spot. Dealers are short gamma here, so hedge flows chase price; do not fade it or hide stops immediately behind it.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.gammaAccelerator,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.gammaFlip === null ? null : {
      id: "gamma-flip",
      kind: "ZERO_GAMMA",
      label: gammaCageLabel("ZERO_GAMMA", args.fullLevels.regime),
      price: args.fullLevels.gammaFlip,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: null,
      rank: 1,
      derived: true,
      explanation: args.fullLevels.flipNote ?? "Nearest cumulative signed-gamma zero crossing. It is the operational cage switch, not the HVL gradient shelf.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.dominantExpiry.gammaFlip,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.gammaCenter === null ? null : {
      id: "gamma-centre",
      kind: "GAMMA_CENTRE",
      label: "KWANT center",
      price: args.fullLevels.gammaCenter,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: null,
      rank: 1,
      derived: true,
      explanation: "Absolute-net-GEX weighted average strike across the near-term cage horizon.",
      expiryScope: "NEAR_TERM_7D",
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    args.fullLevels.majorPositiveOi === null ? null : {
      id: "major-positive-oi",
      kind: "MAJOR_POSITIVE_OI",
      label: "MPO",
      price: args.fullLevels.majorPositiveOi.strike,
      scope: "NEAR_TERM_7D",
      metric: "GEX",
      value: args.fullLevels.majorPositiveOi.net,
      rank: 1,
      derived: true,
      explanation: "Major Positive Open Interest: the strike with the largest positive net gamma exposure in the open-interest structure.",
      expiryScope: "NEAR_TERM_7D",
      dominantExpiry: args.fullLevels.majorPositiveOi.dominantExpiry,
      regime: args.fullLevels.regime,
      signConvention: args.fullLevels.signConvention,
    },
    sessionMajorPositive === null ? null : {
      id: "major-positive-volume",
      kind: "MAJOR_POSITIVE_VOLUME",
      label: "MPV",
      price: sessionMajorPositive.strike,
      scope: "SESSION",
      metric: "GEX",
      value: sessionMajorPositive.net,
      rank: 1,
      derived: true,
      explanation: "Major Positive Volume: the strike with the largest positive current-session volume GEX estimate. It is more responsive than the open-interest structure.",
    },
    ...args.gexClusters.map((row, index) => ({
      id: `gex-cluster-${index + 1}`,
      kind: "GEX_CLUSTER" as const,
      label: `G${index + 1}`,
      price: row.strike,
      scope: "SESSION" as const,
      metric: "GEX_DEX_COMPOSITE" as const,
      value: row.value,
      rank: index + 1,
      derived: true,
      explanation: "Single-source reaction-zone ranking inside ±3% of spot, re-normalized after the near-the-money filter: 65% absolute net GEX concentration and 35% absolute net DEX concentration.",
    })),
    ...args.putSupport.map((row, index) => ({
      id: `put-support-${index + 1}`,
      kind: "PUT_SUPPORT" as const,
      label: `Put support candidate ${index + 1}`,
      price: row.strike,
      scope: "FULL_CHAIN" as const,
      metric: "GEX_AND_OPEN_INTEREST" as const,
      value: row.value,
      rank: index + 1,
      derived: true,
      explanation: "Below-spot put concentration within 5% of spot, ranked 75% by absolute put GEX and 25% by matching-scope put open interest.",
    })),
    args.zeroDteLevels.callWall === null ? null : {
      id: "zero-dte-call-wall",
      kind: "ZERO_DTE_CALL_WALL",
      label: "0DTE call wall",
      price: args.zeroDteLevels.callWall,
      scope: "ZERO_DTE",
      metric: "GEX",
      value: strikeMetric(args.zeroDteGamma, args.zeroDteLevels.callWall, "call"),
      rank: 1,
      derived: true,
      explanation: "Largest call GEX strike for the same-day expiration only.",
    },
    args.zeroDteLevels.putWall === null ? null : {
      id: "zero-dte-put-wall",
      kind: "ZERO_DTE_PUT_WALL",
      label: "0DTE put wall",
      price: args.zeroDteLevels.putWall,
      scope: "ZERO_DTE",
      metric: "GEX",
      value: strikeMetric(args.zeroDteGamma, args.zeroDteLevels.putWall, "put"),
      rank: 1,
      derived: true,
      explanation: "Largest absolute put GEX strike for the same-day expiration only.",
    },
    args.zeroDteLevels.gammaMagnet === null ? null : {
      id: "zero-dte-magnet",
      kind: "ZERO_DTE_MAGNET",
      label: "0DTE gamma magnet",
      price: args.zeroDteLevels.gammaMagnet,
      scope: "ZERO_DTE",
      metric: "GEX",
      value: strikeMetric(args.zeroDteGamma, args.zeroDteLevels.gammaMagnet, "net"),
      rank: 1,
      derived: true,
      explanation: "Largest positive net GEX strike for the same-day expiration only; negative net is never mislabeled as a magnet.",
      expiryScope: "ZERO_DTE",
      dominantExpiry: args.zeroDteLevels.dominantExpiry.gammaMagnet,
      regime: args.zeroDteLevels.regime,
      signConvention: args.zeroDteLevels.signConvention,
    },
    args.zeroDteLevels.gammaAccelerator === null ? null : {
      id: "zero-dte-accelerator",
      kind: "GAMMA_ACCELERATOR",
      label: "0DTE accelerator",
      price: args.zeroDteLevels.gammaAccelerator,
      scope: "ZERO_DTE",
      metric: "GEX",
      value: strikeMetric(args.zeroDteGamma, args.zeroDteLevels.gammaAccelerator, "net"),
      rank: 1,
      derived: true,
      explanation: "Most negative same-day net GEX strike near spot. Dealer-short-gamma hedging can accelerate price through it.",
      expiryScope: "ZERO_DTE",
      dominantExpiry: args.zeroDteLevels.dominantExpiry.gammaAccelerator,
      regime: args.zeroDteLevels.regime,
      signConvention: args.zeroDteLevels.signConvention,
    },
    ...args.zeroDtePutSupport.map((row, index) => ({
      id: `zero-dte-put-support-${index + 1}`,
      kind: "ZERO_DTE_PUT_SUPPORT" as const,
      label: `0DTE put support ${index + 1}`,
      price: row.strike,
      scope: "ZERO_DTE" as const,
      metric: "GEX_AND_OPEN_INTEREST" as const,
      value: row.value,
      rank: index + 1,
      derived: true,
      explanation: "Same-day below-spot put concentration within 5% of spot, ranked by put GEX and same-expiry put open interest.",
    })),
    args.zeroDteMaxPain === null ? null : {
      id: "zero-dte-max-pain",
      kind: "ZERO_DTE_MAX_PAIN",
      label: "0DTE max pain",
      price: args.zeroDteMaxPain,
      scope: "ZERO_DTE",
      metric: "OPEN_INTEREST_MAX_PAIN",
      value: null,
      rank: 1,
      derived: false,
      explanation: "KwantData max-pain strike for the same-day expiration, calculated from open interest.",
    },
  ];
  return rows.filter((row): row is OptionsKeyLevel => row !== null);
}

function getUsOptionsSession(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  const minutes = read("hour") * 60 + read("minute");
  const easternDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = easternDate.getUTCDay();
  const marketOpen = weekday >= 1 && weekday <= 5 && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  const sessionDate = new Date(easternDate);

  if (!marketOpen && !(weekday >= 1 && weekday <= 5 && minutes >= 16 * 60)) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }
  while (sessionDate.getUTCDay() === 0 || sessionDate.getUTCDay() === 6) {
    sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  }

  return {
    marketOpen,
    sessionDate: sessionDate.toISOString().slice(0, 10),
  };
}

function offsetIsoDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function errorMessage(result: PromiseSettledResult<unknown>, label: string) {
  if (result.status === "fulfilled") return null;
  const message = result.reason instanceof Error ? result.reason.message : "unavailable";
  return `${label}: ${message}`;
}

async function buildOptionsFlowPayload(
  symbol: string,
  requestedPriceMode: OptionsPriceMode,
  requestedSessionDate?: string,
  detailMode: "CORE" | "GAMEPLAN" | "FULL" = "FULL",
): Promise<OptionsFlowPayload> {
  const currentSession = getUsOptionsSession();
  const historical = Boolean(requestedSessionDate && requestedSessionDate !== currentSession.sessionDate);
  const session = historical
    ? { marketOpen: false, sessionDate: requestedSessionDate! }
    : currentSession;
  const sessionScope = { sessionDate: session.sessionDate };
  const dailyRange = {
    startTime: `${offsetIsoDate(session.sessionDate, -60)}T00:00:00Z`,
    endTime: `${offsetIsoDate(session.sessionDate, 1)}T23:59:59Z`,
  };
  const exposureModes: GreekMode[] = ["GAMMA", "DELTA", "VANNA", "CHARM"];
  const fullDetail = detailMode === "FULL";
  // Gameplan/KWANT levels need the structural inputs that create the ladder,
  // but not the seven heavy interval-map, skew and term-structure panels used
  // by the full Gamma workspace. Keeping this as a dedicated mode prevents a
  // single level refresh from rebuilding the entire options dashboard.
  const gameplanDetail = detailMode === "GAMEPLAN";
  const structuralDetail = fullDetail || gameplanDetail;
  const skippedRequest = () => Promise.resolve({ payload: null as unknown, remaining: null as number | null });
  const exposureRequests = exposureModes.map((greekMode) =>
    fullDetail || greekMode === "GAMMA" || greekMode === "DELTA"
      ? quantDataPost("/options/tool/exposure-by-strike", {
        ...sessionScope,
        greekMode,
        representationMode: "PER_ONE_PERCENT_MOVE",
        filter: { ticker: symbol },
      }, greekMode === "GAMMA" ? 4_000 : greekMode === "DELTA" ? 15_000 : 60_000)
      : skippedRequest(),
  );

  const requests = await Promise.allSettled([
    ...exposureRequests,
    quantDataPost("/options/tool/exposure-by-strike", {
      ...sessionScope,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 4_000),
    structuralDetail ? quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol },
    }, 60_000) : skippedRequest(),
    structuralDetail ? quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 60_000) : skippedRequest(),
    structuralDetail ? quantDataPost("/options/tool/max-pain", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 60_000) : skippedRequest(),
    quantDataPost("/options/tool/order-flow/consolidated", {
      ...sessionScope,
      filter: { ticker: symbol },
      size: 36,
      sort: { field: "tradeTime", direction: "DESCENDING" },
    }, 4_000),
    fullDetail ? quantDataPost("/options/tool/gainers-losers", {
      ...sessionScope,
      filter: { tickers: OPTIONS_FLOW_TICKERS },
    }, 60_000) : skippedRequest(),
    quantDataPost("/options/tool/net-drift", {
      ...sessionScope,
      aggregationPeriod: "5m",
      filter: { ticker: symbol },
    }, 5_000),
    structuralDetail ? quantDataPost("/options/tool/iv-rank", {
      filter: { ticker: symbol },
      lookBackPeriod: 252,
      maturity: 30,
    }, 300_000) : skippedRequest(),
    quantDataPost("/equities/tool/stock-price-over-time", {
      ...sessionScope,
      aggregationPeriod: "1m",
      filter: { ticker: symbol },
    }, 1_000),
    fullDetail ? quantDataPost("/options/tool/contract-statistics", {
      ...sessionScope,
      filter: { ticker: symbol },
    }, 30_000) : skippedRequest(),
    structuralDetail ? quantDataPost("/equities/tool/stock-price-over-time", {
      timeRange: dailyRange,
      aggregationPeriod: "1d",
      filter: { ticker: symbol },
    }, 300_000) : skippedRequest(),
  ]);

  const resultPayload = (index: number) => requests[index].status === "fulfilled" ? requests[index].value.payload : null;
  const exposures = Object.fromEntries(
    exposureModes.map((mode, index) => [mode, parseExposure(resultPayload(index), symbol, mode)]),
  ) as Record<GreekMode, ExposureSummary | null>;
  const zeroDteGammaIndex = exposureModes.length;
  const openInterestIndex = zeroDteGammaIndex + 1;
  const zeroDteOpenInterestIndex = zeroDteGammaIndex + 2;
  const zeroDteMaxPainIndex = zeroDteGammaIndex + 3;
  const flowIndex = zeroDteGammaIndex + 4;
  const boardIndex = flowIndex + 1;
  const driftIndex = flowIndex + 2;
  const ivIndex = flowIndex + 3;
  const candlesIndex = flowIndex + 4;
  const contractStatisticsIndex = flowIndex + 5;
  const dailyCandlesIndex = flowIndex + 6;
  const flow = parseFlow(resultPayload(flowIndex));
  const flowBoard = parseFlowBoard(resultPayload(boardIndex));
  const drift = parseDrift(resultPayload(driftIndex));
  const candles = parseCandles(resultPayload(candlesIndex), true);
  const putCallVolume = parseContractStatistics(resultPayload(contractStatisticsIndex));
  const dailyCandles = parseCandles(resultPayload(dailyCandlesIndex));
  const gamma = exposures.GAMMA;
  const zeroDteGamma = parseExposure(resultPayload(zeroDteGammaIndex), symbol, "GAMMA");
  const openInterest = parseOpenInterest(resultPayload(openInterestIndex));
  const zeroDteOpenInterest = parseOpenInterest(resultPayload(zeroDteOpenInterestIndex));
  const zeroDteMaxPain = parseMaxPain(resultPayload(zeroDteMaxPainIndex));
  const gammaEnvironment = classifyGammaEnvironment(gamma?.net ?? null, gamma?.gross ?? null);
  const iv = parseIvRank(resultPayload(ivIndex), session.sessionDate);
  const selectedBoard = flowBoard.find((item) => item.ticker === symbol);
  const netPremium = selectedBoard?.netPremium ?? flow.reduce((sum, row) => sum + (row.sentiment === "BULLISH" ? row.premium : row.sentiment === "BEARISH" ? -row.premium : 0), 0);
  const bullishShare = selectedBoard?.bullishShare ?? (flow.length ? flow.filter((row) => row.sentiment === "BULLISH").length / flow.length : null);
  const volatilityState = gammaEnvironment.gammaRegime === "NEGATIVE" || (iv.ivRank !== null && iv.ivRank >= 0.7)
    ? "EXPANSION RISK"
    : gammaEnvironment.gammaRegime === "POSITIVE" && (iv.ivRank === null || iv.ivRank <= 0.45)
      ? "COMPRESSION"
      : "BALANCED";
  const providerStockPrice = readStockPrice(resultPayload(0), symbol) ?? drift.at(-1)?.stockPrice ?? null;
  const stockPrice = session.marketOpen
    ? providerStockPrice ?? candles.at(-1)?.close ?? null
    : candles.at(-1)?.close ?? providerStockPrice;
  const stockPriceAsOf = stockPrice === null
    ? null
    : session.marketOpen
      ? new Date().toISOString()
      : candles.length
        ? new Date(candles.at(-1)!.timestamp).toISOString()
        : null;
  const cageGamma = filterGammaExposureHorizon(gamma, session.sessionDate, 7);
  const fullLevels = deriveGammaCage(cageGamma, stockPrice, "NEAR_TERM_7D");
  const structuralLevels = deriveGammaCage(gamma, stockPrice, "FULL_CHAIN");
  const effectiveGammaEnvironment = fullLevels.regime === "UNKNOWN"
    ? gammaEnvironment
    : {
        ...gammaEnvironment,
        gammaRegime: fullLevels.regime,
        gammaStateLabel: `${fullLevels.regime} GAMMA · ${gammaEnvironment.gammaStrength}`,
      };
  const sessionVolumeGamma = deriveSessionVolumeGamma(gamma, flow);
  const zeroDteLevels = deriveGammaCage(zeroDteGamma, stockPrice, "ZERO_DTE");
  const frontExpiration = gamma?.expiries[0]?.expiration ?? null;
  const strikeRange = stockPrice === null ? null : {
    min: Math.floor(stockPrice * 0.93 * 100) / 100,
    max: Math.ceil(stockPrice * 1.07 * 100) / 100,
  };
  const positioningRequests = fullDetail && frontExpiration ? await Promise.allSettled([
    ...exposureModes.map((greekMode) => quantDataPost("/options/tool/interval-map", {
      ...sessionScope,
      aggregationPeriod: "1m",
      greekMode,
      filter: {
        ticker: symbol,
        expirationDate: frontExpiration,
        ...(strikeRange ? { minStrikePrice: strikeRange.min, maxStrikePrice: strikeRange.max } : {}),
      },
    }, greekMode === "GAMMA" ? 5_000 : greekMode === "DELTA" ? 15_000 : 30_000)),
    quantDataPost("/options/tool/volatility-skew", {
      ...sessionScope,
      filter: { ticker: symbol, expirationDate: frontExpiration },
    }, 60_000),
    quantDataPost("/options/tool/contract-trade-side-statistics", {
      ...sessionScope,
      dataMode: "PREMIUM",
      filter: { ticker: symbol, expirationDate: frontExpiration },
    }, 5_000),
    quantDataPost("/options/tool/term-structure", {
      ...sessionScope,
      filter: {
        ticker: symbol,
        expirationDateRange: { startDate: session.sessionDate, endDate: offsetIsoDate(session.sessionDate, 120) },
        ...(stockPrice === null ? {} : { strikePriceRange: { min: stockPrice * 0.8, max: stockPrice * 1.2 } }),
      },
    }, 60_000),
  ]) : [];
  const positioningPayload = (index: number) => positioningRequests[index]?.status === "fulfilled"
    ? positioningRequests[index].value.payload
    : null;
  const parsedHistory = Object.fromEntries(exposureModes.map((mode, index) => [
    mode,
    frontExpiration ? parseIntervalMap(positioningPayload(index), mode, frontExpiration) : { series: null, strikeSnapshots: [] },
  ])) as Record<GreekMode, ParsedIntervalMap>;
  const frontExposures = Object.fromEntries(exposureModes.map((mode, index) => [
    mode,
    frontExpiration ? parseExposure(resultPayload(index), symbol, mode, frontExpiration) : null,
  ])) as Record<GreekMode, ExposureSummary | null>;
  for (const mode of exposureModes) {
    if (parsedHistory[mode].series && frontExposures[mode]?.strikes.length) {
      parsedHistory[mode].series.latestStrikes = frontExposures[mode]!.strikes;
    }
  }
  const gammaHistory = parsedHistory.GAMMA;
  const latestGammaStrikes = gammaHistory.series?.latestStrikes ?? [];
  const positiveGamma = latestGammaStrikes.filter((row) => row.net > 0).sort((a, b) => b.net - a.net)[0] ?? null;
  const negativeGamma = latestGammaStrikes.filter((row) => row.net < 0).sort((a, b) => a.net - b.net)[0] ?? null;
  const volatilitySkew = frontExpiration ? parseVolatilitySkew(positioningPayload(exposureModes.length), frontExpiration)
    .filter((row) => !strikeRange || (row.strike >= strikeRange.min && row.strike <= strikeRange.max)) : [];
  const tradeSidePremium = parseTradeSidePremium(positioningPayload(exposureModes.length + 1));
  const termStructure = parseTermStructure(positioningPayload(exposureModes.length + 2), session.sessionDate);
  const putSupportRows = derivePutSupportLevels(gamma, openInterest, stockPrice);
  const zeroDtePutSupportRows = derivePutSupportLevels(zeroDteGamma, zeroDteOpenInterest, stockPrice);
  const expectedMove = expectedMoveRange({
    priorAtmIv: iv.priorAtmIv,
    expiration: iv.expiration,
    dailyCandles,
    sessionDate: session.sessionDate,
    fallbackPrice: stockPrice,
  });
  const historicalVol = historicalVolatility21d(dailyCandles, session.sessionDate, session.marketOpen);
  const vrp = iv.atmIv !== null && historicalVol !== null ? iv.atmIv - historicalVol : null;
  const normalizedVrp = iv.atmIv !== null && historicalVol !== null && historicalVol > 0 ? iv.atmIv / historicalVol - 1 : null;
  const vrpState: MarketMapIntelligence["volatility"]["volatilityState"] = normalizedVrp === null
    ? "UNAVAILABLE"
    : normalizedVrp > 0.1
      ? "RICH"
      : normalizedVrp < -0.1
        ? "DISCOUNTED"
        : "FAIR";
  const gexClusters = deriveGexClusters(cageGamma, exposures.DELTA, stockPrice);
  const keyLevels = createKeyLevels({
    gamma: cageGamma,
    sessionVolumeGamma,
    zeroDteGamma,
    zeroDteMaxPain,
    fullLevels,
    zeroDteLevels,
    putSupport: putSupportRows,
    zeroDtePutSupport: zeroDtePutSupportRows,
    gexClusters,
  });
  const marketMap: MarketMapIntelligence = {
    expectedMove,
    dealerPositioning: {
      netGex: gamma?.net ?? null,
      netDex: exposures.DELTA?.net ?? null,
      frontExpiryNetGex: gammaHistory.series?.points.at(-1)?.net ?? null,
      frontExpiryNetDex: parsedHistory.DELTA.series?.points.at(-1)?.net ?? null,
      frontExpiryGexChange1h: intradayChange(gammaHistory.series, 60),
      frontExpiryDexChange1h: intradayChange(parsedHistory.DELTA.series, 60),
      lastFrontExpiryGammaFlipAt: lastGammaFlip(gammaHistory.series),
      dteGamma: deriveDteGamma(gamma, session.sessionDate),
    },
    putCallVolume,
    volatility: {
      atmIv30d: iv.atmIv,
      historicalVol21d: historicalVol,
      ivRank: iv.ivRank,
      ivPercentile: iv.ivPercentile,
      ivHistorySessions: iv.historySessions,
      vrp,
      normalizedVrp,
      volatilityState: vrpState,
      skew0Dte: termStructure.skew0Dte,
      skew30Dte: termStructure.skew30Dte,
      termStructure: termStructure.termStructure,
      termStructureState: termStructure.termStructureState,
    },
  };
  const marketData = await resolveOptionsMarketData({
    symbol,
    requestedMode: requestedPriceMode,
    cashPrice: stockPrice,
    cashAsOf: stockPriceAsOf,
    cashCandles: candles,
    cashMarketOpen: session.marketOpen,
    sourceLevels: gamma?.strikes.map((row) => row.strike) ?? [],
  });
  const remaining = [...requests, ...positioningRequests].flatMap((result) => result.status === "fulfilled" && result.value.remaining !== null ? [result.value.remaining] : []);
  const labels = ["GEX", "DEX", "Vanna", "Charm", "0DTE GEX", "Open interest", "0DTE open interest", "0DTE max pain", "Flow", "Market board", "Premium drift", "IV rank", "Price chart", "Put/call volume", "Daily price history"];
  const zeroDteExpected = Boolean(gamma?.expiries.some((row) => row.expiration === session.sessionDate));
  const zeroDteAvailable = Boolean(zeroDteGamma?.strikes.length);
  const errors = requests
    .map((result, index) => {
      if (!zeroDteExpected && (index === zeroDteGammaIndex || index === zeroDteOpenInterestIndex || index === zeroDteMaxPainIndex)) return null;
      return errorMessage(result, labels[index]);
    })
    .filter((value): value is string => Boolean(value));
  if (frontExpiration) {
    const positioningLabels = ["Intraday GEX", "Intraday DEX", "Intraday Vanna", "Intraday Charm", "Volatility skew", "Trade-side premium", "Term structure"];
    errors.push(...positioningRequests
      .map((result, index) => errorMessage(result, positioningLabels[index]))
      .filter((value): value is string => Boolean(value)));
  }

  if (!gamma && !flow.length && !candles.length) {
    const firstFailure = requests.find((result) => result.status === "rejected");
    if (firstFailure?.status === "rejected" && firstFailure.reason instanceof QuantDataError) throw firstFailure.reason;
    throw new QuantDataError("No KwantData options data is available for this symbol.", 422, null);
  }

  return {
    symbol,
    source: "KwantData",
    // Outside New York options hours this payload is the last completed
    // options book, not a new live snapshot. Keep the source timestamp pinned
    // to that close so an EOD regime can never look freshly updated in Globex.
    asOf: session.marketOpen
      ? new Date().toISOString()
      : newYorkCashCloseIso(session.sessionDate),
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    snapshotMode: session.marketOpen ? "LIVE" : "NEW_YORK_EOD",
    session,
    stockPrice,
    stockPriceAsOf,
    environment: {
      ...effectiveGammaEnvironment,
      volatilityState,
      ivRank: iv.ivRank,
      callIv: iv.callIv,
      putIv: iv.putIv,
      netPremium,
      bullishShare,
    },
    levels: {
      callWall: fullLevels.callWall,
      putWall: fullLevels.putWall,
      gammaHvl: fullLevels.gammaHvl,
      gammaMagnet: fullLevels.gammaMagnet,
      gammaAccelerator: fullLevels.gammaAccelerator,
      gammaFlip: fullLevels.gammaFlip,
      gammaCrossings: fullLevels.gammaCrossings,
      flipNote: fullLevels.flipNote,
      regime: fullLevels.regime,
      expiryScope: "NEAR_TERM_7D",
      signConvention: fullLevels.signConvention,
      structural: {
        gammaMagnet: structuralLevels.gammaMagnet,
        gammaAccelerator: structuralLevels.gammaAccelerator,
        gammaFlip: structuralLevels.gammaFlip,
        gammaCrossings: structuralLevels.gammaCrossings,
        expiryScope: "FULL_CHAIN",
      },
      gammaCenter: fullLevels.gammaCenter,
      majorPositiveOi: fullLevels.majorPositiveOi?.strike ?? null,
      majorPositiveVolume: majorPositiveGamma(sessionVolumeGamma)?.strike ?? null,
      frontExpiration,
      zeroDteAvailable,
      zeroDteCallWall: zeroDteLevels.callWall,
      zeroDtePutWall: zeroDteLevels.putWall,
      zeroDteGammaMagnet: zeroDteLevels.gammaMagnet,
      zeroDteMaxPain,
      putSupport: putSupportRows.map((row) => row.strike),
      zeroDtePutSupport: zeroDtePutSupportRows.map((row) => row.strike),
      keyLevels,
    },
    exposures,
    openInterest,
    zeroDteGamma,
    zeroDteOpenInterest,
    positioning: {
      scope: "FRONT_EXPIRY",
      expiration: frontExpiration,
      aggregationPeriod: "1m",
      strikeRange,
      history: Object.fromEntries(exposureModes.map((mode) => [mode, parsedHistory[mode].series])) as Record<GreekMode, IntradayExposureSeries | null>,
      majorPositiveGamma: positiveGamma ? { strike: positiveGamma.strike, value: positiveGamma.net } : null,
      majorNegativeGamma: negativeGamma ? { strike: negativeGamma.strike, value: negativeGamma.net } : null,
      gammaChange: deriveGammaChange(gammaHistory),
      volatilitySkew,
      tradeSidePremium,
      methodology: {
        exposureSource: "KwantData Interval Map",
        classificationSource: "Kwant Data proprietary model",
        classificationConfidence: "PROPRIETARY",
        note: "Exposure histories and trade-side pressure are interpreted through Kwant Data's proprietary model, combining front-expiry exposure snapshots with prints at or through bid and ask.",
      },
    },
    marketMap,
    drift,
    flow,
    flowBoard,
    candles: marketData.candles,
    marketData,
    rateLimitRemaining: remaining.length ? Math.min(...remaining) : null,
    errors,
  };
}

export async function getOptionsMarketPulse(
  symbolInput: string,
  priceModeInput: string = "CASH",
  includeHistory = false,
): Promise<OptionsMarketPulsePayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const cashTicker = symbol === "SPXW" ? "SPX" : symbol;
  const priceMode: OptionsPriceMode = priceModeInput.trim().toUpperCase() === "FUTURES" ? "FUTURES" : "CASH";
  const session = getUsOptionsSession();

  // Keep the live cash-tape path independent from KwantData's one-minute
  // history endpoint. History is loaded separately by the chart and merged
  // behind this quote, so an instrument switch can paint immediately.
  if (priceMode === "CASH" && !includeHistory) {
    const liveCash = await resolveCashLevelOne({
      symbol,
      cashCandles: [],
      cashMarketOpen: session.marketOpen,
    });
    if (liveCash) {
      return {
        symbol,
        asOf: new Date().toISOString(),
        refreshAfterMs: session.marketOpen && liveCash.status === "LIVE" ? 500 : 2_000,
        marketData: liveCash,
        rateLimitRemaining: null,
      };
    }
  }

  const result = await quantDataPost("/equities/tool/stock-price-over-time", {
    sessionDate: session.sessionDate,
    aggregationPeriod: "1m",
    filter: { ticker: cashTicker },
  }, 1_000);
  const candles = parseCandles(result.payload, true);

  if (!candles.length) {
    throw new QuantDataError(`No current-session price bars are available for ${symbol}.`, 422, result.remaining);
  }

  const marketData = await resolveOptionsMarketData({
    symbol,
    requestedMode: priceMode,
    cashPrice: candles.at(-1)?.close ?? null,
    cashAsOf: candles.length ? new Date(candles.at(-1)!.timestamp).toISOString() : null,
    cashCandles: candles,
    cashMarketOpen: session.marketOpen,
  });
  const refreshAfterMs = session.marketOpen
    ? marketData.status === "LIVE"
      ? marketData.provider === "Massive" || marketData.mode === "FUTURES"
        ? 500
        : 1_000
      : 2_000
    : 30_000;

  return {
    symbol,
    asOf: new Date().toISOString(),
    refreshAfterMs,
    marketData: {
      ...marketData,
      candles: includeHistory ? marketData.candles : marketData.candles.slice(-3),
    },
    rateLimitRemaining: result.remaining,
  };
}

async function buildGexMapPanel(
  symbolInput: string,
  greekModeInput: GreekMode,
  requestedSessionDate?: string,
): Promise<GexMapPanelPayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const providerTicker = gexMapProviderTicker(symbol);
  const currentSession = getUsOptionsSession();
  const sessionDate = requestedSessionDate || currentSession.sessionDate;
  const historical = sessionDate !== currentSession.sessionDate;
  const endpointTtl = historical ? 300_000 : 5_000;

  const [exposureResult, candleResult] = await Promise.all([
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate,
      greekMode: greekModeInput,
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: providerTicker },
    }, endpointTtl),
    quantDataPost("/equities/tool/stock-price-over-time", {
      sessionDate,
      aggregationPeriod: "1m",
      filter: { ticker: providerTicker },
    }, historical ? 300_000 : 2_000),
  ]);

  const fullExposure = parseExposure(exposureResult.payload, providerTicker, greekModeInput);
  const expiration = fullExposure?.expiries
    .map((row) => row.expiration)
    .filter((value) => value >= sessionDate)
    .sort()[0] ?? fullExposure?.expiries[0]?.expiration ?? null;
  if (!expiration) {
    throw new QuantDataError(`No ${greekModeInput} exposure is available for ${symbol} on ${sessionDate}.`, 422, exposureResult.remaining);
  }

  const frontExposure = parseExposure(exposureResult.payload, providerTicker, greekModeInput, expiration);
  const intervalResult = await quantDataPost("/options/tool/interval-map", {
    sessionDate,
    aggregationPeriod: "1m",
    greekMode: greekModeInput,
    filter: {
      ticker: providerTicker,
      expirationDate: expiration,
    },
  }, endpointTtl);
  const frames = parseGexMapFrames(intervalResult.payload, expiration);
  const candles = parseCandles(candleResult.payload, true);
  const latestCandle = candles.at(-1) ?? null;
  const firstCandle = candles[0] ?? null;
  const stockPrice = readStockPrice(exposureResult.payload, providerTicker) ?? latestCandle?.close ?? null;
  const sessionChangePercent = firstCandle && stockPrice !== null && firstCandle.open > 0
    ? stockPrice / firstCandle.open - 1
    : null;
  const frameAsOf = Math.max(frames.at(-1)?.timestamp ?? 0, latestCandle?.timestamp ?? 0) || Date.now();
  const marketIsLive = !historical && currentSession.marketOpen;
  const stale = marketIsLive && Date.now() - frameAsOf > 3 * 60_000;
  // After the close, the expired front-expiry key can remain present while
  // its exposure-by-strike rows are cleared. The interval map is still the
  // authoritative session record, so rebuild the frozen close from every
  // incremental frame instead of returning a structurally valid black map.
  const latestStrikes = frontExposure?.strikes.length
    ? frontExposure.strikes
    : latestGexMapStrikesFromFrames(frames);

  if (!latestStrikes.length && !frames.length) {
    throw new QuantDataError(`No front-expiry ${greekModeInput} strikes are available for ${symbol}.`, 422, exposureResult.remaining);
  }

  return {
    symbol,
    greekMode: greekModeInput,
    sessionDate,
    expiration,
    scope: "FRONT_EXPIRY",
    representation: "PER_ONE_PERCENT_MOVE",
    source: "KwantData Interval Map",
    sourceTimeZone: "America/New_York",
    asOf: new Date(frameAsOf).toISOString(),
    status: historical || !currentSession.marketOpen ? "LAST_SESSION" : stale ? "DELAYED" : "LIVE",
    refreshAfterMs: marketIsLive ? 5_000 : 60_000,
    stockPrice,
    sessionChangePercent,
    latestStrikes,
    frames,
    candles,
    netExposure: latestStrikes.reduce((sum, row) => sum + row.net, 0),
    grossExposure: latestStrikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    rateLimitRemaining: [exposureResult.remaining, candleResult.remaining, intervalResult.remaining]
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)[0] ?? null,
  };
}

/**
 * Completed interval maps are immutable. Persist them in Next's server cache
 * so each replay-minute request can select its point-in-time frame without
 * rebuilding the same historical KwantData session in another serverless
 * invocation. The active session remains uncached and continues to tick live.
 */
export async function getGexMapPanel(
  symbolInput: string,
  greekModeInput: GreekMode,
  requestedSessionDate?: string,
): Promise<GexMapPanelPayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const currentSession = getUsOptionsSession();
  const sessionDate = requestedSessionDate || currentSession.sessionDate;
  const completedSession = sessionDate !== currentSession.sessionDate || !currentSession.marketOpen;
  // Keep fallbacks session-specific so a historical replay can never receive
  // a different day's surface merely because that panel was requested last.
  const surfaceKey = `${symbol}:${greekModeInput}:${sessionDate}`;
  try {
    const payload = completedSession
      ? await unstable_cache(
        () => buildGexMapPanel(symbol, greekModeInput, sessionDate),
        ["completed-gex-map-panel-v4", symbol, greekModeInput, sessionDate],
        { revalidate: 6 * 60 * 60 },
      )()
      : await buildGexMapPanel(symbol, greekModeInput, sessionDate);
    lastGoodGexMapPanelBySurface.set(surfaceKey, payload);
    return payload;
  } catch (error) {
    const lastGood = lastGoodGexMapPanelBySurface.get(surfaceKey);
    if (!lastGood) throw error;
    return {
      ...lastGood,
      status: "LAST_SESSION",
      refreshAfterMs: 15_000,
    };
  }
}

export type HistoricalPositioningWallFrames = {
  symbol: string;
  sessionDate: string;
  scope: "FULL_CHAIN" | "FRONT_EXPIRY";
  gammaFrames: GexMapFrame[];
  deltaFrames: GexMapFrame[];
  candles: OptionsCandle[];
  fallbackReason: string | null;
};

async function buildHistoricalPositioningWallFrames(
  symbol: string,
  sessionDate: string,
): Promise<HistoricalPositioningWallFrames> {
  try {
    const [gammaResult, deltaResult, candleResult] = await Promise.all([
      quantDataPost("/options/tool/interval-map", {
        sessionDate,
        aggregationPeriod: "1m",
        greekMode: "GAMMA",
        filter: { ticker: symbol },
      }, 300_000),
      quantDataPost("/options/tool/interval-map", {
        sessionDate,
        aggregationPeriod: "1m",
        greekMode: "DELTA",
        filter: { ticker: symbol },
      }, 300_000),
      quantDataPost("/equities/tool/stock-price-over-time", {
        sessionDate,
        aggregationPeriod: "1m",
        filter: { ticker: symbol },
      }, 300_000),
    ]);
    const gammaFrames = parseFullChainGexMapFrames(gammaResult.payload);
    const deltaFrames = parseFullChainGexMapFrames(deltaResult.payload);
    const candles = parseCandles(candleResult.payload, true);
    if (gammaFrames.length && deltaFrames.length && candles.length) {
      return {
        symbol,
        sessionDate,
        scope: "FULL_CHAIN",
        gammaFrames,
        deltaFrames,
        candles,
        fallbackReason: null,
      };
    }
    throw new Error("The provider did not return full-chain interval frames for this session.");
  } catch (error) {
    const [gammaPanel, deltaPanel] = await Promise.all([
      getGexMapPanel(symbol, "GAMMA", sessionDate),
      getGexMapPanel(symbol, "DELTA", sessionDate),
    ]);
    return {
      symbol,
      sessionDate,
      scope: "FRONT_EXPIRY",
      gammaFrames: gammaPanel.frames,
      deltaFrames: deltaPanel.frames,
      candles: gammaPanel.candles,
      fallbackReason: error instanceof Error ? error.message : "Full-chain interval history was unavailable.",
    };
  }
}

/** Historical full-chain Gamma/Delta frames used to audit generic Positioning Walls. */
export async function getHistoricalPositioningWallFrames(symbolInput: string, sessionDate: string) {
  const symbol = symbolInput.trim().toUpperCase();
  return unstable_cache(
    () => buildHistoricalPositioningWallFrames(symbol, sessionDate),
    ["historical-positioning-wall-frames-v1", symbol, sessionDate],
    { revalidate: 6 * 60 * 60 },
  )();
}

function gexDeskPressureSource(
  symbol: GexDeskSourceSymbol,
  payload: unknown,
): GexDeskPressureSource {
  const rows = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const timedTrades: Array<{
    timestamp: number;
    signedWeight: number;
    weight: number;
    confidence: number;
  }> = [];
  let signedWeight = 0;
  let totalWeight = 0;
  let confidenceWeight = 0;
  let callWeight = 0;
  let newestTimestamp = 0;
  let tradeCount = 0;

  for (const raw of rows) {
    if (!isRecord(raw)) continue;
    const contract = textValue(raw.contractType).toUpperCase();
    if (contract !== "CALL" && contract !== "PUT") continue;
    const side = (textValue(raw.tradeSideCode) || textValue(raw.tradeSide)).toUpperCase();
    const bought = side.includes("ASK") || side === "AA" || side === "A";
    const sold = side.includes("BID") || side === "BB" || side === "B";
    const consolidation = textValue(raw.tradeConsolidationType).toUpperCase();
    const confidence = bought || sold
      ? consolidation.includes("COMPLEX") || consolidation.includes("MULTI")
        ? 0.55
        : 1
      : 0.3;
    const sideSign = bought ? 1 : sold ? -1 : 0;
    const contractSign = contract === "CALL" ? 1 : -1;
    const sentiment = classifySentiment(raw);
    const fallbackSign = sentiment === "BULLISH" ? 1 : sentiment === "BEARISH" ? -1 : 0;
    const direction = sideSign ? sideSign * contractSign : fallbackSign;
    const delta = Math.abs(
      finiteNumber(raw.delta)
      ?? finiteNumber(raw.optionDelta)
      ?? finiteNumber(raw.greekDelta)
      ?? 0,
    );
    const size = Math.max(1, finiteNumber(raw.size) ?? finiteNumber(raw.quantity) ?? 1);
    const premium = Math.max(1, finiteNumber(raw.premium) ?? 1);
    const magnitude = delta > 0
      ? delta * size
      : Math.sqrt(premium);
    const weight = magnitude * confidence;
    signedWeight += direction * weight;
    totalWeight += Math.abs(weight);
    confidenceWeight += confidence * Math.abs(weight);
    if (contract === "CALL") callWeight += Math.abs(weight);
    const timestamp = normalizeMarketTimestamp(raw.tradeTime) ?? 0;
    newestTimestamp = Math.max(newestTimestamp, timestamp);
    if (timestamp > 0 && weight > 0) {
      timedTrades.push({
        timestamp,
        signedWeight: direction * weight,
        weight: Math.abs(weight),
        confidence,
      });
    }
    tradeCount += 1;
  }

  const minuteBuckets = new Map<number, {
    signedWeight: number;
    weight: number;
    confidenceWeight: number;
    tradeCount: number;
  }>();
  for (const trade of timedTrades) {
    const timestamp = Math.floor(trade.timestamp / 60_000) * 60_000;
    const current = minuteBuckets.get(timestamp) ?? {
      signedWeight: 0,
      weight: 0,
      confidenceWeight: 0,
      tradeCount: 0,
    };
    current.signedWeight += trade.signedWeight;
    current.weight += trade.weight;
    current.confidenceWeight += trade.confidence * trade.weight;
    current.tradeCount += 1;
    minuteBuckets.set(timestamp, current);
  }
  const series = [...minuteBuckets.entries()]
    .sort(([left], [right]) => left - right)
    .slice(-45)
    .map(([timestamp, bucket]) => ({
      timestamp,
      score: bucket.weight > 0
        ? Math.max(-100, Math.min(100, bucket.signedWeight / bucket.weight * 100))
        : 0,
      confidence: bucket.weight > 0
        ? Math.max(0, Math.min(1, bucket.confidenceWeight / bucket.weight))
        : 0,
      tradeCount: bucket.tradeCount,
    }));

  return {
    symbol,
    score: totalWeight > 0 ? Math.max(-100, Math.min(100, signedWeight / totalWeight * 100)) : 0,
    confidence: totalWeight > 0 ? Math.max(0, Math.min(1, confidenceWeight / totalWeight)) : 0,
    tradeCount,
    callShare: totalWeight > 0 ? callWeight / totalWeight : 0.5,
    asOf: newestTimestamp > 0 ? new Date(newestTimestamp).toISOString() : null,
    series,
  };
}

function normalPdf(value: number) {
  return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI);
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const absolute = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * absolute);
  const erf = 1 - (
    (
      (
        (
          (1.061405429 * t - 1.453152027) * t
          + 1.421413741
        ) * t - 0.284496736
      ) * t + 0.254829592
    ) * t
  ) * Math.exp(-absolute * absolute);
  return 0.5 * (1 + sign * erf);
}

function normalizedIv(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  const normalized = value > 5 ? value / 100 : value;
  return normalized >= 0.01 && normalized <= 5 ? normalized : null;
}

function easternMinutesAt(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function yearsToExpiry(dte: number | null, timestamp: number) {
  const providerDte = dte !== null && Number.isFinite(dte) ? Math.max(0, dte) : 0;
  const minutesRemaining = Math.max(1, 16 * 60 - easternMinutesAt(timestamp));
  const remainingDay = minutesRemaining / (24 * 60);
  return Math.max(1 / (365 * 24 * 60), (providerDte + remainingDay) / 365);
}

function optionPriceBlackScholes(
  contractType: "CALL" | "PUT",
  spot: number,
  strike: number,
  years: number,
  volatility: number,
) {
  if (spot <= 0 || strike <= 0 || years <= 0 || volatility <= 0) return null;
  const rootTime = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + 0.5 * volatility * volatility * years)
    / (volatility * rootTime);
  const d2 = d1 - volatility * rootTime;
  return contractType === "CALL"
    ? spot * normalCdf(d1) - strike * normalCdf(d2)
    : strike * normalCdf(-d2) - spot * normalCdf(-d1);
}

function impliedVolatilityFromPrice(
  contractType: "CALL" | "PUT",
  optionPrice: number | null,
  spot: number,
  strike: number,
  years: number,
) {
  if (
    optionPrice === null
    || !Number.isFinite(optionPrice)
    || optionPrice <= 0
    || optionPrice >= spot
  ) return null;
  const intrinsic = contractType === "CALL"
    ? Math.max(0, spot - strike)
    : Math.max(0, strike - spot);
  if (optionPrice < intrinsic - 0.01) return null;
  let low = 0.01;
  let high = 5;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (low + high) / 2;
    const modelPrice = optionPriceBlackScholes(contractType, spot, strike, years, middle);
    if (modelPrice === null) return null;
    if (modelPrice > optionPrice) high = middle;
    else low = middle;
  }
  const result = (low + high) / 2;
  return Number.isFinite(result) ? result : null;
}

function blackScholesTradeGreeks(args: {
  contractType: "CALL" | "PUT";
  spot: number;
  strike: number;
  years: number;
  volatility: number;
}) {
  const { contractType, spot, strike, years, volatility } = args;
  if (
    spot <= 0
    || strike <= 0
    || years <= 0
    || volatility <= 0
  ) return null;
  const rootTime = Math.sqrt(years);
  const d1 = (
    Math.log(spot / strike)
    + 0.5 * volatility * volatility * years
  ) / (volatility * rootTime);
  const density = normalPdf(d1);
  const delta = contractType === "CALL" ? normalCdf(d1) : normalCdf(d1) - 1;
  const gamma = density / (spot * volatility * rootTime);
  const bumpedVolatility = Math.min(5, volatility + 0.01);
  const bumpedD1 = (
    Math.log(spot / strike)
    + 0.5 * bumpedVolatility * bumpedVolatility * years
  ) / (bumpedVolatility * rootTime);
  const bumpedDelta = contractType === "CALL" ? normalCdf(bumpedD1) : normalCdf(bumpedD1) - 1;
  const vannaPerVolPoint = bumpedDelta - delta;
  const oneDay = 1 / 365;
  const elapsedDays = Math.min(1, Math.max(1 / (24 * 60), years * 365 * 0.5));
  const nextYears = Math.max(1 / (365 * 24 * 60), years - elapsedDays * oneDay);
  const nextRootTime = Math.sqrt(nextYears);
  const nextD1 = (
    Math.log(spot / strike)
    + 0.5 * volatility * volatility * nextYears
  ) / (volatility * nextRootTime);
  const nextDelta = contractType === "CALL" ? normalCdf(nextD1) : normalCdf(nextD1) - 1;
  const charmPerDay = (nextDelta - delta) / elapsedDays;
  if (![delta, gamma, vannaPerVolPoint, charmPerDay].every(Number.isFinite)) return null;
  return { delta, gamma, vannaPerVolPoint, charmPerDay };
}

function gexDeskOptionsTape(
  source: GexDeskSourceSymbol,
  payload: unknown,
  spot: number | null,
  nqPrice: number | null,
): GexDeskOptionPrint[] {
  if (!spot || spot <= 0 || !nqPrice || nqPrice <= 0) return [];
  return parseFlow(payload).flatMap((row) => {
    if (
      (row.contractType !== "CALL" && row.contractType !== "PUT")
      || row.strikePrice === null
      || row.strikePrice <= 0
    ) return [];
    const mappedPrice = nqPrice * row.strikePrice / spot;
    if (!Number.isFinite(mappedPrice) || Math.abs(mappedPrice / nqPrice - 1) > 0.09) return [];
    const rawSide = row.side.toUpperCase();
    const bought = rawSide.includes("ASK") || rawSide === "AA" || rawSide === "A";
    const sold = rawSide.includes("BID") || rawSide === "BB" || rawSide === "B";
    const timestamp = normalizeMarketTimestamp(row.tradeTime);
    if (timestamp === null) return [];
    const complex = row.consolidationType.toUpperCase().includes("COMPLEX")
      || row.consolidationType.toUpperCase().includes("MULTI");
    const underlyingPrice = row.stockPrice && row.stockPrice > 0 ? row.stockPrice : spot;
    const years = yearsToExpiry(row.dte, timestamp);
    const providerIv = normalizedIv(row.impliedVolatility);
    const solvedIv = providerIv ?? impliedVolatilityFromPrice(
      row.contractType,
      row.optionPrice,
      underlyingPrice,
      row.strikePrice,
      years,
    );
    const greeks = solvedIv === null
      ? null
      : blackScholesTradeGreeks({
          contractType: row.contractType,
          spot: underlyingPrice,
          strike: row.strikePrice,
          years,
          volatility: solvedIv,
        });
    return [{
      id: `${source}:${row.id}`,
      source,
      timestamp,
      expiration: row.expirationDate,
      contractType: row.contractType,
      side: bought ? "BOUGHT" : sold ? "SOLD" : "MID",
      strike: row.strikePrice,
      mappedPrice,
      premium: Math.max(0, row.premium),
      size: Math.max(0, row.size ?? 0),
      volume: Math.max(0, row.volume ?? 0),
      openInterest: Math.max(0, row.openInterest ?? 0),
      confidence: bought || sold ? complex ? 0.55 : 1 : 0.3,
      underlyingPrice,
      optionPrice: row.optionPrice,
      impliedVolatility: solvedIv,
      dte: row.dte,
      optionGamma: greeks?.gamma ?? null,
      optionDelta: greeks?.delta ?? null,
      optionVannaPerVolPoint: greeks?.vannaPerVolPoint ?? null,
      optionCharmPerDay: greeks?.charmPerDay ?? null,
      greekMethod: solvedIv === null
        ? null
        : providerIv !== null
          ? "PROVIDER_IV_BLACK_SCHOLES"
          : "PRICE_IMPLIED_BLACK_SCHOLES",
      complexTrade: complex,
    }];
  });
}

function combineGexDeskPressure(sources: GexDeskPressureSource[]): GexDeskPressure {
  const weighted = sources.map((source) => ({
    source,
    weight: Math.max(0.1, source.confidence) * Math.sqrt(Math.max(1, source.tradeCount)),
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight || !sources.some((source) => source.tradeCount > 0)) return emptyGexDeskPressure(sources);
  const score = weighted.reduce((sum, entry) => sum + entry.source.score * entry.weight, 0) / totalWeight;
  const confidence = weighted.reduce((sum, entry) => sum + entry.source.confidence * entry.weight, 0) / totalWeight;
  const timestamps = [...new Set(
    sources.flatMap((source) => source.series.map((point) => point.timestamp)),
  )].sort((left, right) => left - right);
  const series: GexDeskPressurePoint[] = timestamps.slice(-45).map((timestamp) => {
    const points = sources.flatMap((source) => {
      const point = source.series.find((candidate) => candidate.timestamp === timestamp);
      if (!point) return [];
      return [{
        point,
        weight: Math.max(0.1, point.confidence) * Math.sqrt(Math.max(1, point.tradeCount)),
      }];
    });
    const weight = points.reduce((sum, entry) => sum + entry.weight, 0);
    return {
      timestamp,
      score: weight > 0
        ? points.reduce((sum, entry) => sum + entry.point.score * entry.weight, 0) / weight
        : 0,
      confidence: weight > 0
        ? points.reduce((sum, entry) => sum + entry.point.confidence * entry.weight, 0) / weight
        : 0,
      tradeCount: points.reduce((sum, entry) => sum + entry.point.tradeCount, 0),
    };
  });
  const latestPoints = series.slice(-3);
  const priorPoints = series.slice(-6, -3);
  const latestPressure = latestPoints.reduce((sum, point) => sum + Math.abs(point.score), 0) / Math.max(1, latestPoints.length);
  const priorPressure = priorPoints.reduce((sum, point) => sum + Math.abs(point.score), 0) / Math.max(1, priorPoints.length);
  const persistence: GexDeskPressure["persistence"] = series.length < 4
    ? "STEADY"
    : latestPressure > priorPressure + 8
      ? "BUILDING"
      : latestPressure < priorPressure - 8
        ? "FADING"
        : "STEADY";
  return {
    score,
    state: score > 12 ? "CALL_PRESSURE" : score < -12 ? "PUT_PRESSURE" : "BALANCED",
    persistence,
    confidence,
    tradeCount: sources.reduce((sum, source) => sum + source.tradeCount, 0),
    method: "Estimated confidence-weighted signed delta demand; directional premium proxy where option delta is unavailable",
    sources,
    series,
  };
}

async function buildGexDeskServerPayload(): Promise<GexDeskPayload> {
  const session = getUsOptionsSession();
  const symbols = ["NDX", "QQQ"] as const;
  const [requests, nqPrice] = await Promise.all([
    Promise.allSettled([
    ...symbols.map((symbol) => quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: session.sessionDate,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol },
    }, 15_000)),
    ...symbols.map((symbol) => quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: session.sessionDate,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 15_000)),
    ...symbols.map((symbol) => quantDataPost("/options/tool/order-flow/consolidated", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol },
      // QuantData caps this cursor-paginated endpoint at 100 rows per request.
      size: 100,
      sort: { field: "tradeTime", direction: "DESCENDING" },
    }, 5_000)),
    ]),
    getNativeFuturesSpot("NQ").catch(() => null),
  ]);

  const fullResults = requests.slice(0, 2);
  const zeroDteResults = requests.slice(2, 4);
  const flowResults = requests.slice(4, 6);
  const sources: GexDeskSourceSnapshot[] = symbols.map((symbol, index) => {
    const full = fullResults[index];
    const zeroDte = zeroDteResults[index];
    const fullPayload = full?.status === "fulfilled" ? full.value.payload : null;
    const zeroPayload = zeroDte?.status === "fulfilled" ? zeroDte.value.payload : null;
    const exposure = parseExposure(fullPayload, symbol, "GAMMA");
    const zeroDteExposure = parseExposure(zeroPayload, symbol, "GAMMA", session.sessionDate);
    const oneDteExpiration = exposure?.expiries
      .map((row) => row.expiration)
      .find((expiration) => expiration > session.sessionDate) ?? null;
    const oneDteExposure = oneDteExpiration
      ? parseExposure(fullPayload, symbol, "GAMMA", oneDteExpiration)
      : null;
    const spot = readStockPrice(fullPayload, symbol);
    const failure = full?.status === "rejected"
      ? full.reason instanceof Error ? full.reason.message : "positioning unavailable"
      : exposure && spot
        ? null
        : "positioning snapshot is incomplete";
    return {
      symbol,
      spot,
      status: exposure && spot ? session.marketOpen ? "LIVE" : "LAST_GOOD" : "UNAVAILABLE",
      asOf: new Date().toISOString(),
      exposure,
      zeroDteExposure,
      oneDteExposure,
      error: failure,
    };
  });
  const pressureSources = symbols.map((symbol, index) => {
    const flow = flowResults[index];
    return gexDeskPressureSource(
      symbol,
      flow?.status === "fulfilled" ? flow.value.payload : null,
    );
  });
  const optionsTape = symbols.flatMap((symbol, index) => {
    const flow = flowResults[index];
    return gexDeskOptionsTape(
      symbol,
      flow?.status === "fulfilled" ? flow.value.payload : null,
      sources[index]?.spot ?? null,
      nqPrice,
    );
  });
  const flowErrors = symbols.flatMap((symbol, index) => {
    const flow = flowResults[index];
    if (flow?.status !== "rejected") return [];
    return [`${symbol} options tape: ${flow.reason instanceof Error ? flow.reason.message : "upstream request failed"}`];
  });
  return buildGexDeskPayload({
    sessionDate: session.sessionDate,
    marketOpen: session.marketOpen,
    nqPrice,
    sources,
    pressure: combineGexDeskPressure(pressureSources),
    optionsTape,
    upstreamErrors: flowErrors,
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
  });
}

export function getGexDeskPayload(): Promise<GexDeskPayload> {
  if (gexDeskCache && gexDeskCache.expiresAt > Date.now()) return gexDeskCache.promise;
  const promise = buildGexDeskServerPayload().catch((error) => {
    gexDeskCache = null;
    throw error;
  });
  gexDeskCache = { expiresAt: Date.now() + 4_000, promise };
  return promise;
}

function latestAtOrBefore<T extends { timestamp: number }>(rows: T[], timestamp: number): T | null {
  let low = 0;
  let high = rows.length - 1;
  let match: T | null = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const row = rows[middle];
    if (row.timestamp <= timestamp) {
      match = row;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
}

export async function getGexDeskHistory(
  sourceInput: string,
  instrumentInput: string = "NQ",
  requestedSessionDate?: string,
): Promise<GexDeskHistoryPayload> {
  const instrument: GexDeskHistoryInstrument = instrumentInput.trim().toUpperCase() === "ES" ? "ES" : "NQ";
  const compatibleSources: GexDeskHistorySourceSymbol[] = instrument === "ES"
    ? ["SPX", "SPXW", "SPY"]
    : ["NDX", "QQQ"];
  const requestedSource = sourceInput.trim().toUpperCase();
  const source: "COMBINED" | GexDeskHistorySourceSymbol = compatibleSources.includes(requestedSource as GexDeskHistorySourceSymbol)
    ? requestedSource as GexDeskHistorySourceSymbol
    : "COMBINED";
  const symbols: GexDeskHistorySourceSymbol[] = source === "COMBINED" ? compatibleSources : [source];
  const session = getUsOptionsSession();
  const sessionDate = requestedSessionDate?.trim() || session.sessionDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || Number.isNaN(Date.parse(`${sessionDate}T00:00:00Z`))) {
    throw new QuantDataError("A valid replay session date is required.", 400, null);
  }
  if (sessionDate > session.sessionDate) {
    throw new QuantDataError("A future options session cannot be replayed.", 400, null);
  }
  const currentSession = sessionDate === session.sessionDate;
  const start = `${sessionDate}T00:00:00.000Z`;
  const end = currentSession ? new Date().toISOString() : `${offsetIsoDate(sessionDate, 1)}T00:00:00.000Z`;
  const [panelResults, futuresResult] = await Promise.all([
    Promise.allSettled(symbols.map((symbol) => getGexMapPanel(symbol, "GAMMA", sessionDate))),
    getDatabentoBars(`${instrument}.v.0`, "1m", start, end),
  ]);
  const panels = panelResults.flatMap((result, index) => result.status === "fulfilled"
    ? [{ symbol: symbols[index], panel: result.value }]
    : []);
  const errors = panelResults.flatMap((result, index) => result.status === "rejected"
    ? [`${symbols[index]} history: ${result.reason instanceof Error ? result.reason.message : "unavailable"}`]
    : []);
  if (!panels.length) {
    throw new QuantDataError(errors.join(" | ") || "No intraday gamma history is available.", 422, null);
  }
  if (!futuresResult.length) {
    throw new QuantDataError(`${instrument} history is unavailable for timestamp-aligned gamma mapping.`, 422, null);
  }

  const allTimestamps = [...new Set(panels.flatMap(({ panel }) => panel.frames.map((frame) => frame.timestamp)))]
    .sort((left, right) => left - right);
  const timestampStep = Math.max(1, Math.ceil(allTimestamps.length / 72));
  const sampledTimestamps = allTimestamps.filter((_, index) => index % timestampStep === 0);
  const finalTimestamp = allTimestamps.at(-1);
  if (finalTimestamp && sampledTimestamps.at(-1) !== finalTimestamp) sampledTimestamps.push(finalTimestamp);
  if (!sampledTimestamps.length) {
    throw new QuantDataError("The intraday gamma map has no timestamped frames.", 422, null);
  }

  const latestFutures = futuresResult.at(-1)?.close ?? null;
  if (!latestFutures) {
    throw new QuantDataError(`${instrument} history does not contain a valid reference price.`, 422, null);
  }
  const minimumBucket = instrument === "ES" ? 5 : 10;
  const bucketIncrement = 5;
  const bucketSize = Math.max(minimumBucket, Math.round((latestFutures * 0.0007) / bucketIncrement) * bucketIncrement);
  const priceLow = Math.floor((latestFutures * 0.965) / bucketSize) * bucketSize;
  const priceHigh = Math.ceil((latestFutures * 1.035) / bucketSize) * bucketSize;
  const priceBuckets = Array.from(
    { length: Math.round((priceHigh - priceLow) / bucketSize) + 1 },
    (_, index) => priceLow + index * bucketSize,
  );
  const rowValues = new Map(priceBuckets.map((price) => [price, {
    call: [] as number[],
    put: [] as number[],
    net: [] as number[],
    gross: [] as number[],
    change: [] as number[],
  }]));
  const panelState = panels.map(({ symbol, panel }) => ({
    symbol,
    panel,
    frameIndex: 0,
    strikes: new Map<number, ExposureStrike>(),
  }));
  let mappingChecks = 0;
  let mappingMatches = 0;
  const futuresPrices: number[] = [];
  const underlierPrices: GexDeskHistoryPayload["underlierPrices"] = Object.fromEntries(
    panels.map(({ symbol }) => [symbol, [] as Array<number | null>]),
  );

  for (const timestamp of sampledTimestamps) {
    const futuresBar = latestAtOrBefore(futuresResult, timestamp);
    futuresPrices.push(futuresBar?.close ?? latestFutures);
    const combined = new Map<number, { call: number; put: number; net: number; gross: number }>();
    for (const state of panelState) {
      while (
        state.frameIndex < state.panel.frames.length
        && state.panel.frames[state.frameIndex].timestamp <= timestamp
      ) {
        for (const row of state.panel.frames[state.frameIndex].updates) {
          state.strikes.set(row.strike, row);
        }
        state.frameIndex += 1;
      }
      const sourceBar = latestAtOrBefore(state.panel.candles, timestamp);
      underlierPrices[state.symbol]?.push(sourceBar?.close ?? null);
      mappingChecks += 1;
      if (!futuresBar || !sourceBar || timestamp - futuresBar.timestamp > 3 * 60_000 || timestamp - sourceBar.timestamp > 3 * 60_000) {
        continue;
      }
      mappingMatches += 1;
      for (const strike of state.strikes.values()) {
        const mapped = futuresBar.close * strike.strike / sourceBar.close;
        if (!Number.isFinite(mapped) || mapped < priceLow || mapped > priceHigh) continue;
        const price = Math.round(mapped / bucketSize) * bucketSize;
        const current = combined.get(price) ?? { call: 0, put: 0, net: 0, gross: 0 };
        current.call += strike.call;
        current.put += strike.put;
        current.net += strike.net;
        current.gross += Math.abs(strike.call) + Math.abs(strike.put);
        combined.set(price, current);
      }
    }
    for (const price of priceBuckets) {
      const current = combined.get(price) ?? { call: 0, put: 0, net: 0, gross: 0 };
      const values = rowValues.get(price)!;
      const previous = values.net.at(-1) ?? current.net;
      values.call.push(current.call);
      values.put.push(current.put);
      values.net.push(current.net);
      values.gross.push(current.gross);
      values.change.push(current.net - previous);
    }
  }

  const rows = priceBuckets.map((price) => ({ price, ...rowValues.get(price)! }));
  const statuses = panels.map(({ panel }) => panel.status);
  const status: GexDeskHistoryPayload["status"] = panels.length < symbols.length
    ? "PARTIAL"
    : statuses.some((value) => value === "DELAYED")
      ? "DELAYED"
      : currentSession && session.marketOpen
        ? "LIVE"
        : "LAST_SESSION";
  return {
    instrument,
    source,
    sessionDate,
    expiration: panels.map(({ panel }) => panel.expiration).filter(Boolean).join(" / ") || null,
    asOf: new Date(Math.max(...sampledTimestamps)).toISOString(),
    status,
    bucketSize,
    priceLow,
    priceHigh,
    timestamps: sampledTimestamps,
    futuresPrices,
    underlierPrices,
    nqPrices: futuresPrices,
    rows,
    mappingCoverage: mappingChecks > 0 ? mappingMatches / mappingChecks : 0,
    errors,
    disclosure: `Intraday gamma exposure mapped with timestamp-aligned source and ${instrument} prices. Change shows each bucket versus its prior sampled frame.`,
  };
}

export async function getGexDeskReplaySessionDates(limitInput: number = 5): Promise<string[]> {
  const limit = Math.max(1, Math.min(10, Math.floor(limitInput)));
  const session = getUsOptionsSession();
  const result = await quantDataPost("/equities/tool/stock-price-over-time", {
    timeRange: {
      startTime: `${offsetIsoDate(session.sessionDate, -18)}T00:00:00.000Z`,
      endTime: `${offsetIsoDate(session.sessionDate, 1)}T00:00:00.000Z`,
    },
    aggregationPeriod: "1d",
    filter: { ticker: "QQQ" },
  }, 5 * 60_000);
  const sessionDates = [...new Set(parseCandles(result.payload)
    .map((candle) => new Date(candle.timestamp).toISOString().slice(0, 10))
    .filter((date) => date <= session.sessionDate))]
    .sort()
    .slice(-limit);
  if (!sessionDates.length) {
    throw new QuantDataError("No recent US options sessions are available for replay.", 422, result.remaining);
  }
  return sessionDates;
}

export async function getOptionsFlowPayload(
  symbolInput: string,
  priceModeInput: string = "CASH",
  requestedSessionDate?: string,
  detailModeInput: string = "FULL",
) {
  const symbol = symbolInput.trim().toUpperCase();
  const priceMode: OptionsPriceMode = priceModeInput.trim().toUpperCase() === "FUTURES" ? "FUTURES" : "CASH";
  const currentSession = getUsOptionsSession();
  const sessionDate = requestedSessionDate?.trim() || currentSession.sessionDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || Number.isNaN(Date.parse(`${sessionDate}T00:00:00Z`))) {
    throw new QuantDataError("A valid historical options session date is required.", 400, null);
  }
  if (sessionDate > currentSession.sessionDate) {
    throw new QuantDataError("Historical options sessions cannot be in the future.", 400, null);
  }
  const historical = sessionDate !== currentSession.sessionDate;
  const session = historical ? { marketOpen: false, sessionDate } : currentSession;
  const requestedDetailMode = detailModeInput.trim().toUpperCase();
  const detailMode: "CORE" | "GAMEPLAN" | "FULL" = requestedDetailMode === "CORE"
    ? "CORE"
    : requestedDetailMode === "GAMEPLAN"
      ? "GAMEPLAN"
      : "FULL";
  const cacheKey = `${symbol}:${priceMode}:${sessionDate}:${detailMode}`;
  const lastGoodKey = `${symbol}:${priceMode}:${detailMode}`;
  const cached = requestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (session.marketOpen
    ? buildOptionsFlowPayload(symbol, priceMode, undefined, detailMode)
    : unstable_cache(
      () => buildOptionsFlowPayload(symbol, priceMode, sessionDate, detailMode),
      ["completed-new-york-options-flow-v2", symbol, priceMode, session.sessionDate, detailMode],
      { revalidate: 6 * 60 * 60 },
    )()
  ).then((payload) => {
    lastGoodOptionsFlowByInstrument.set(lastGoodKey, payload);
    return payload;
  }).catch((error) => {
    requestCache.delete(cacheKey);
    const lastGood = historical ? null : lastGoodOptionsFlowByInstrument.get(lastGoodKey);
    if (!lastGood) throw error;
    const problem = getQuantDataHttpError(error);
    return {
      ...lastGood,
      refreshAfterMs: 15_000,
      errors: [
        ...lastGood.errors.filter((message) => !message.startsWith("Live Gamma refresh:")),
        `Live Gamma refresh: ${problem.message}. Holding the last verified snapshot.`,
      ],
    };
  });
  requestCache.set(cacheKey, {
    expiresAt: Date.now() + (session.marketOpen ? CACHE_TTL_MS : 5 * 60_000),
    promise,
  });
  return promise;
}

export async function getClassicGexProfilePayload(args: {
  sourceSymbol: ClassicGexMappingSource;
  expiry: ClassicGexExpiry;
  profileSource: ClassicGexSource;
  mappingMode: "AUTO" | "MANUAL";
  manualMultiplier: number;
  premiumOffset: number;
  futuresPrice?: number | null;
}): Promise<ClassicGexProfilePayload> {
  const base = await getOptionsFlowPayload(args.sourceSymbol, "FUTURES", undefined, "GAMEPLAN");
  const allGamma = base.exposures.GAMMA;
  const orderedExpirations = [...new Set(allGamma?.expiries.map((row) => row.expiration) ?? [])]
    .filter((expiration) => /^\d{4}-\d{2}-\d{2}$/.test(expiration))
    .sort();
  const expiration = args.expiry === "ALL"
    ? null
    : args.expiry === "ZERO_DTE"
      ? base.session.sessionDate
      : orderedExpirations.find((candidate) => candidate > base.session.sessionDate)
        ?? orderedExpirations[0]
        ?? null;

  let openInterestGamma = args.expiry === "ALL"
    ? allGamma
    : args.expiry === "ZERO_DTE"
      ? base.zeroDteGamma
      : null;
  let contractRows = args.expiry === "ALL"
    ? base.openInterest
    : args.expiry === "ZERO_DTE"
      ? base.zeroDteOpenInterest
      : [];

  if (args.expiry === "NEXT_EXPIRY" && expiration) {
    const [gammaResult, openInterestResult] = await Promise.all([
      quantDataPost("/options/tool/exposure-by-strike", {
        sessionDate: base.session.sessionDate,
        greekMode: "GAMMA",
        representationMode: "PER_ONE_PERCENT_MOVE",
        filter: { ticker: args.sourceSymbol, expirationDate: expiration },
      }, base.session.marketOpen ? 4_000 : 300_000),
      quantDataPost("/options/tool/open-interest-by-strike", {
        sessionDate: base.session.sessionDate,
        filter: { ticker: args.sourceSymbol, expirationDate: expiration },
      }, 60_000),
    ]);
    openInterestGamma = parseExposure(gammaResult.payload, args.sourceSymbol, "GAMMA", expiration);
    contractRows = parseOpenInterest(openInterestResult.payload);
  }

  const flow = expiration
    ? base.flow.filter((row) => row.expirationDate === expiration)
    : base.flow;
  const volumeGamma = deriveSessionVolumeGamma(openInterestGamma, flow);
  const sourcePrice = base.stockPrice;
  const requestedFuturesPrice = args.futuresPrice && Number.isFinite(args.futuresPrice) && args.futuresPrice > 0
    ? args.futuresPrice
    : null;
  const futuresPrice = requestedFuturesPrice ?? base.marketData.lastPrice;
  const providerScale = Number(base.marketData.levelPriceScale);
  // The AUTO scale is only a basis when BOTH legs are fresh. Overnight the
  // cash source freezes at the close while the client keeps sending the live
  // futures price - recomputing the ratio then makes every mapped line move
  // in lockstep with the tape (strike x ratio tracks the futures tick for
  // tick), so levels can never be approached. When the cash leg is frozen,
  // pin the scale: last live-verified ratio first, then the frozen PAIR the
  // provider captured together at the close (consistent snapshot), then the
  // provider's own scale.
  const sourceLive = base.session.marketOpen && !base.marketData.stale;
  const liveRatio = sourceLive && sourcePrice && futuresPrice
    ? futuresPrice / sourcePrice
    : Number.NaN;
  if (Number.isFinite(liveRatio) && liveRatio > 0) {
    lastLiveAutoScaleBySource.set(args.sourceSymbol, liveRatio);
  }
  const pinnedRatio = lastLiveAutoScaleBySource.get(args.sourceSymbol) ?? Number.NaN;
  const frozenPairRatio = sourcePrice && base.marketData.lastPrice
    ? base.marketData.lastPrice / sourcePrice
    : Number.NaN;
  const autoScale = Number.isFinite(liveRatio) && liveRatio > 0
    ? liveRatio
    : Number.isFinite(pinnedRatio) && pinnedRatio > 0
      ? pinnedRatio
      : Number.isFinite(frozenPairRatio) && frozenPairRatio > 0
        ? frozenPairRatio
        : Number.isFinite(providerScale) && providerScale > 0
          ? providerScale
          : 1;
  const mapping = {
    mode: args.mappingMode,
    scale: args.mappingMode === "MANUAL" ? Math.max(0.000001, args.manualMultiplier) : autoScale,
    offset: args.mappingMode === "MANUAL" ? args.premiumOffset : 0,
    referenceScale: Number.isFinite(liveRatio) && liveRatio > 0
      ? liveRatio
      : Number.isFinite(pinnedRatio) && pinnedRatio > 0
        ? pinnedRatio
        : null,
    basis: (Number.isFinite(liveRatio) && liveRatio > 0 ? "LIVE" : "PINNED") as "LIVE" | "PINNED",
  } as const;
  const oiByStrike = new Map(contractRows.map((row) => [row.strike, row]));
  const volumeByStrike = new Map<number, { call: number; put: number }>();
  for (const row of flow) {
    if (!row.strikePrice || !row.volume) continue;
    const current = volumeByStrike.get(row.strikePrice) ?? { call: 0, put: 0 };
    if (row.contractType === "CALL") current.call = Math.max(current.call, row.volume);
    if (row.contractType === "PUT") current.put = Math.max(current.put, row.volume);
    volumeByStrike.set(row.strikePrice, current);
  }
  const toRows = (exposure: ExposureSummary | null, contractsSource: ClassicGexSource): ClassicGexProfileRow[] => (
    exposure?.strikes.map((row) => {
      const oi = oiByStrike.get(row.strike);
      const volume = volumeByStrike.get(row.strike);
      return normalizeClassicGexRow({
        strike: row.strike,
        mappedPrice: mapClassicGexPrice(row.strike, mapping),
        call: row.call,
        put: row.put,
        callContracts: contractsSource === "VOLUME" ? volume?.call ?? null : oi?.callOpenInterest ?? null,
        putContracts: contractsSource === "VOLUME" ? volume?.put ?? null : oi?.putOpenInterest ?? null,
        gamma: null,
      });
    }).filter((row) => row.call !== 0 || row.put !== 0) ?? []
  );
  const volumeRows = toRows(volumeGamma, "VOLUME");
  const openInterestRows = toRows(openInterestGamma, "OPEN_INTEREST");
  const rows = selectClassicGexRows(args.profileSource, volumeRows, openInterestRows);
  const asOfMs = Date.parse(base.asOf);
  const dataAgeMs = Number.isFinite(asOfMs) ? Math.max(0, Date.now() - asOfMs) : 0;
  const status = classicGexStatus({
    marketOpen: base.session.marketOpen,
    providerStale: base.marketData.stale,
    dataAgeMs,
  });
  const stale = status === "STALE";

  return {
    instrument: "NQ",
    sourceSymbol: args.sourceSymbol,
    sessionDate: base.session.sessionDate,
    expiration,
    expiry: args.expiry,
    profileSource: args.profileSource,
    representation: "PER_ONE_PERCENT_MOVE",
    status,
    snapshotMode: base.snapshotMode,
    asOf: base.asOf,
    refreshAfterMs: Math.max(1_000, base.refreshAfterMs),
    dataAgeMs,
    stale,
    sourcePrice,
    futuresPrice,
    mapping,
    rows,
    majors: {
      positiveVolume: classicGexMajor(volumeRows, "POSITIVE"),
      negativeVolume: classicGexMajor(volumeRows, "NEGATIVE"),
      positiveOpenInterest: classicGexMajor(openInterestRows, "POSITIVE"),
      negativeOpenInterest: classicGexMajor(openInterestRows, "NEGATIVE"),
    },
    // Zero Gamma is deliberately not inferred from a sign change between
    // adjacent strikes. A scenario-repriced root can be supplied by the native
    // gamma engine when that calculation is available without delaying bars.
    zeroGamma: null,
    methodology: {
      exposureSource: `KwantData ${args.sourceSymbol} PER_ONE_PERCENT_MOVE`,
      contractSource: args.profileSource === "VOLUME" ? "KwantData consolidated session flow" : "KwantData dated open interest",
      volumeMethod: "Current-session contract volume/open-interest ratio applied to the matching structural strike GEX.",
      version: "classic-gex-profile-v1",
    },
  };
}

export async function getChartGammaLevels(
  rootInput: string,
  sourceInput: string,
  requestedSessionDate?: string,
): Promise<ChartGammaLevelsPayload> {
  const root = rootInput.trim().toUpperCase();
  if (root !== "NQ" && root !== "ES") {
    throw new QuantDataError("Gamma Levels currently supports NQ and ES only.", 400, null);
  }
  const compatibleSymbols = root === "NQ"
    ? (["NDX", "QQQ"] as const)
    : (["SPX", "SPXW", "SPY"] as const);
  const requestedSource = sourceInput.trim().toUpperCase();
  // NATIVE futures-options gamma (Databento): the source IS the futures root (NQ/ES).
  // NDX/QQQ/SPX/SPXW/SPY keep the KwantData cash-conversion path below.
  if (requestedSource === root) {
    return buildNativeChartGamma(root as NativeGammaRoot, requestedSessionDate);
  }
  if (!new Set<string>(compatibleSymbols).has(requestedSource)) {
    throw new QuantDataError(
      `Gamma source ${requestedSource || "(missing)"} is not compatible with ${root}.`,
      400,
      null,
    );
  }
  const symbols: ChartGammaSourceSnapshot["symbol"][] = [
    requestedSource as ChartGammaSourceSnapshot["symbol"],
  ];
  const currentSession = getUsOptionsSession();
  const sessionDate = requestedSessionDate?.trim() || currentSession.sessionDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || Number.isNaN(Date.parse(`${sessionDate}T00:00:00Z`))) {
    throw new QuantDataError("A valid historical gamma session date is required.", 400, null);
  }
  if (sessionDate > currentSession.sessionDate) {
    throw new QuantDataError("Historical gamma sessions cannot be in the future.", 400, null);
  }
  const session = sessionDate === currentSession.sessionDate
    ? currentSession
    : { marketOpen: false, sessionDate };
  const symbol = symbols[0];
  const [exposureResult, deltaResult, flowResult] = await Promise.allSettled([
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: session.sessionDate,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol },
    }, session.marketOpen ? CHART_GAMMA_CACHE_TTL_MS : 300_000),
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate: session.sessionDate,
      greekMode: "DELTA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol },
    }, session.marketOpen ? CHART_GAMMA_CACHE_TTL_MS : 300_000),
    quantDataPost("/options/tool/order-flow/consolidated", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol },
      size: 100,
      sort: { field: "tradeTime", direction: "DESCENDING" },
    }, session.marketOpen ? CHART_GAMMA_CACHE_TTL_MS : 300_000),
  ]);
  const exposurePayload = exposureResult.status === "fulfilled" ? exposureResult.value.payload : null;
  const parsedGamma = parseExposure(exposurePayload, symbol, "GAMMA");
  const parsedDelta = parseExposure(
    deltaResult.status === "fulfilled" ? deltaResult.value.payload : null,
    symbol,
    "DELTA",
  );
  const stockPrice = readStockPrice(exposurePayload, symbol);
  const parsedSource = chartGammaSourceSnapshot(
    symbol,
    exposurePayload,
    session.sessionDate,
    parsedDelta,
    flowResult.status === "fulfilled" ? flowResult.value.payload : null,
  );
  const sources = parsedSource ? [parsedSource] : [];
  if (!sources.length) {
    if (exposureResult.status === "rejected" && exposureResult.reason instanceof QuantDataError) {
      throw exposureResult.reason;
    }
    throw new QuantDataError(`No current gamma exposure is available for ${root}.`, 422, null);
  }

  const classifiedEnvironment = classifyGammaEnvironment(parsedGamma?.net ?? null, parsedGamma?.gross ?? null);
  const cageRegime = parsedSource?.cage?.regime ?? "UNKNOWN";
  const environment = cageRegime === "UNKNOWN"
    ? classifiedEnvironment
    : {
        ...classifiedEnvironment,
        gammaRegime: cageRegime,
        gammaStateLabel: `${cageRegime} GAMMA · ${classifiedEnvironment.gammaStrength}`,
      };
  const revision = JSON.stringify(sources.map((source) => [source.symbol, source.revision]));
  const checkedAt = session.marketOpen
    ? new Date().toISOString()
    : newYorkCashCloseIso(session.sessionDate);

  return {
    root,
    requestedSource: symbol,
    checkedAt,
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    marketOpen: session.marketOpen,
    snapshotMode: session.marketOpen ? "LIVE" : "NEW_YORK_EOD",
    sessionDate: session.sessionDate,
    environment,
    revision,
    sources,
    dataOrigin: "CASH_INDEX",
    positioning: parsedGamma && stockPrice !== null && stockPrice > 0
      ? chartGammaPositioningSnapshot({
          root: root as NativeGammaRoot,
          sourceSymbol: symbol as ChartGammaPositioningSnapshot["sourceSymbol"],
          expiration: null,
          asOf: Date.parse(checkedAt),
          status: session.marketOpen ? "LIVE" : "NEW_YORK_EOD",
          sourcePrice: stockPrice,
          futuresPrice: stockPrice,
          priceScale: 1,
          strikes: parsedGamma.strikes,
        })
      : undefined,
  };
}

/** Current US options session date (YYYY-MM-DD) — used by the gamma warming cron. */
export function getUsOptionsSessionDate(): string {
  return getUsOptionsSession().sessionDate;
}

/** True only while the regular New York options session is trading. */
export function isUsOptionsMarketOpen(): boolean {
  return getUsOptionsSession().marketOpen;
}

export type HedgeLevelsExposureInput = {
  root: "NQ";
  sourceSymbol: "NDX";
  sessionDate: string;
  marketOpen: boolean;
  checkedAt: string;
  sourceSpot: number;
  futuresSpot: number;
  surface: HedgeExposureSurface;
};

/**
 * The standalone Hedge Levels route reuses the same cached KwantData gamma
 * request as the rest of the options workspace, but receives the unranked
 * surface. No Kwant Levels or Gameplan derivation is imported into that
 * indicator.
 */
const LIVE_FLOW_SPOT_MAX_AGE_MS = 180_000;

async function getLiveNqSpotFromFlow(): Promise<number | null> {
  try {
    const flow = await getGexBotFlowSnapshot();
    const spot = flow.sample?.spot;
    const age = flow.dataAgeMs ?? Number.POSITIVE_INFINITY;
    if (
      flow.status === "LIVE"
      && typeof spot === "number"
      && Number.isFinite(spot)
      && spot > 0
      && age <= LIVE_FLOW_SPOT_MAX_AGE_MS
    ) {
      return spot;
    }
  } catch {
    // The flow poller failing must never take Hedge Levels down with it;
    // the Databento fallback path below still applies.
  }
  return null;
}

export async function getHedgeLevelsExposureInput(
  futuresPriceOverride?: number,
): Promise<HedgeLevelsExposureInput> {
  const session = getUsOptionsSession();
  const sourceSymbol = "NDX" as const;
  const response = await quantDataPost("/options/tool/exposure-by-strike", {
    sessionDate: session.sessionDate,
    greekMode: "GAMMA",
    representationMode: "PER_ONE_PERCENT_MOVE",
    filter: { ticker: sourceSymbol },
  }, session.marketOpen ? 60_000 : 6 * 60 * 60_000);
  const exposure = parseExposure(response.payload, sourceSymbol, "GAMMA");
  const sourceSpot = readStockPrice(response.payload, sourceSymbol);
  if (!exposure?.strikes.length || !sourceSpot || sourceSpot <= 0) {
    throw new QuantDataError("No NDX gamma exposure is available for Hedge Levels.", 422, response.remaining);
  }

  const override = Number.isFinite(futuresPriceOverride) && (futuresPriceOverride ?? 0) > 0
    ? futuresPriceOverride ?? null
    : null;
  // Live-session spot preference: the GEX Bot flow sample is a genuinely live
  // NQ-basis price with its own freshness gate. The Databento historical API
  // trails real time by 15-30 minutes and can require a very large fallback
  // pull that risks the route's execution limit, so it is the fallback here,
  // never the primary live leg.
  const futuresSpot = override
    ?? (session.marketOpen
      ? await getLiveNqSpotFromFlow() ?? await getNativeFuturesSpot("NQ")
      : await getNativeFuturesSessionClose("NQ", session.sessionDate)
        ?? await getNativeFuturesSpot("NQ"));
  if (!futuresSpot || futuresSpot <= 0) {
    throw new QuantDataError("No current or completed-session NQ price is available for Hedge Levels.", 503, response.remaining);
  }

  return {
    root: "NQ",
    sourceSymbol,
    sessionDate: session.sessionDate,
    marketOpen: session.marketOpen,
    checkedAt: session.marketOpen ? new Date().toISOString() : newYorkCashCloseIso(session.sessionDate),
    sourceSpot,
    futuresSpot,
    surface: {
      strikes: exposure.strikes,
      expiryStrikes: exposure.expiryStrikes,
    },
  };
}

/**
 * Returns the unranked, expiration-aware Gamma surface used by the current
 * Net-GEX profile. The call deliberately goes through quantDataPost so the
 * Gamma page, Gamma Heatmap and this indicator share the same server cache and
 * never establish parallel vendor sessions.
 */
export async function getNetGammaExposureSurface(input: {
  sourceTicker: string;
  displayInstrument: string;
  displayPrice: number;
  greekMode?: GreekMode;
}): Promise<NetGammaProviderSurface> {
  const session = getUsOptionsSession();
  const sourceTicker = input.sourceTicker.trim().toUpperCase();
  if (!new Set<string>([...OPTIONS_FLOW_TICKERS, "NQ"]).has(sourceTicker)) {
    throw new QuantDataError("This source is not supported by the shared Gamma exposure adapter.", 400, null);
  }
  const greekMode = input.greekMode ?? "GAMMA";
  const response = await quantDataPost("/options/tool/exposure-by-strike", {
    sessionDate: session.sessionDate,
    greekMode,
    representationMode: "PER_ONE_PERCENT_MOVE",
    filter: { ticker: sourceTicker },
  }, session.marketOpen ? 5_000 : 6 * 60 * 60_000);
  const exposure = parseExposure(response.payload, sourceTicker, greekMode);
  const sourceSpotPrice = readStockPrice(response.payload, sourceTicker);
  if (!exposure?.strikes.length || !sourceSpotPrice || sourceSpotPrice <= 0) {
    throw new QuantDataError(`No signed ${greekMode.toLowerCase()} exposure is available for ${sourceTicker}.`, 422, response.remaining);
  }
  const displayPrice = Number(input.displayPrice);
  if (!(displayPrice > 0)) {
    throw new QuantDataError("A current futures price is required for strike mapping.", 422, response.remaining);
  }
  return {
    sourceTicker,
    sourceSpotPrice,
    displayPrice,
    displayInstrument: input.displayInstrument,
    sessionDate: session.sessionDate,
    marketOpen: session.marketOpen,
    checkedAt: session.marketOpen ? new Date().toISOString() : newYorkCashCloseIso(session.sessionDate),
    status: session.marketOpen ? "LIVE" : "LAST_SESSION",
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    strikes: exposure.strikes,
    expiryStrikes: exposure.expiryStrikes ?? [],
  };
}

/**
 * Server-only IV Rank adapter. All browser instances share quantDataPost's
 * request cache, retry policy and one configured QuantData credential.
 */
export async function getImpliedVolatilityRankSnapshot(input: {
  sourceTicker: string;
  displayInstrument: string;
  lookBackPeriodDays: number;
  targetMaturityDays: number;
  contractMode: IvRankContractMode;
  useLiveIntradayIv?: boolean;
  maximumForwardFillMinutes?: number;
}): Promise<IvRankSnapshot> {
  const session = getUsOptionsSession();
  const sourceTicker = input.sourceTicker.trim().toUpperCase();
  const allowed = new Set<string>([...OPTIONS_FLOW_TICKERS, "QQQ", "SPY", "NDX", "SPX", "SPXW", "IWM", "DIA"]);
  if (!allowed.has(sourceTicker)) {
    throw new QuantDataError("This options source is not supported by IV Rank.", 400, null);
  }
  const lookBackPeriodDays = Math.max(2, Math.min(365, Math.round(input.lookBackPeriodDays)));
  const targetMaturityDays = Math.max(0, Math.min(365, Math.round(input.targetMaturityDays)));
  const ttlMs = session.marketOpen ? 15_000 : 5 * 60_000;
  const ivRankResult = await quantDataPost("/options/tool/iv-rank", {
    filter: { ticker: sourceTicker },
    lookBackPeriod: lookBackPeriodDays,
    maturity: targetMaturityDays,
  }, ttlMs);

  let volatilityDriftPayload: unknown = null;
  if (input.useLiveIntradayIv !== false && session.marketOpen) {
    volatilityDriftPayload = await quantDataPost("/options/tool/volatility-drift", {
      sessionDate: session.sessionDate,
      aggregationPeriod: "1m",
      filter: { ticker: sourceTicker },
    }, 10_000).then((result) => result.payload).catch(() => null);
  }

  return buildIvRankSnapshot(ivRankResult.payload, volatilityDriftPayload, {
    sourceTicker,
    displayInstrument: input.displayInstrument.trim().toUpperCase(),
    contractMode: input.contractMode,
    lookBackPeriodDays,
    targetMaturityDays,
    useLiveIntradayIv: input.useLiveIntradayIv,
    marketOpen: session.marketOpen,
    maximumForwardFillMinutes: input.maximumForwardFillMinutes,
  });
}

/**
 * Fetches the time-bucketed signed Gamma surface and its synchronized source
 * price series through the one shared, server-only QuantData adapter. No
 * credential or provider response is exposed directly to the browser.
 */
export async function getGexIntervalMapSurface(input: {
  sourceTicker: string;
  sessionDate?: string;
  aggregationPeriod?: string;
  startTime?: string;
  endTime?: string;
  greekMode?: GreekMode;
  representationMode?: "RAW" | "PER_ONE_DOLLAR_MOVE" | "PER_ONE_PERCENT_MOVE";
}): Promise<GexIntervalProviderSurface> {
  const session = getUsOptionsSession();
  const sourceTicker = input.sourceTicker.trim().toUpperCase();
  if (!new Set<string>([...OPTIONS_FLOW_TICKERS, "NQ"]).has(sourceTicker)) {
    throw new QuantDataError("This source is not supported by the shared Gamma interval adapter.", 400, null);
  }
  const sessionDate = input.sessionDate?.trim() || session.sessionDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new QuantDataError("A valid session date is required.", 400, null);
  const aggregationPeriod = input.aggregationPeriod?.trim() || "1m";
  const greekMode = input.greekMode ?? "GAMMA";
  const representationMode = input.representationMode ?? "PER_ONE_PERCENT_MOVE";
  const scope = input.startTime && input.endTime
    ? { timeRange: { startTime: input.startTime, endTime: input.endTime } }
    : { sessionDate };
  const customHistoryRange = Boolean(input.startTime && input.endTime);
  const ttl = !customHistoryRange && sessionDate === session.sessionDate && session.marketOpen ? 5_000 : 6 * 60 * 60_000;
  // SPXW is an option-class root rather than a separately quoted underlying in
  // KwantData's interval-map tool. The SPX surface contains the weekly/0DTE
  // series used by this workspace, while the product-facing identity remains
  // SPXW so saved workspaces and labels do not silently change instruments.
  const providerTicker = sourceTicker === "SPXW" ? "SPX" : sourceTicker;
  const [interval, pricesResult] = await Promise.all([
    quantDataPost("/options/tool/interval-map", {
      ...scope,
      aggregationPeriod,
      greekMode,
      representationMode,
      filter: { ticker: providerTicker },
    }, ttl),
    quantDataPost("/equities/tool/stock-price-over-time", {
      ...scope,
      aggregationPeriod,
      filter: { ticker: providerTicker },
    }, ttl).then((result) => result.payload).catch(() => null),
  ]);
  const historical = sessionDate !== session.sessionDate || Boolean(input.startTime && input.endTime);
  const normalized = normalizeGexIntervalProviderPayload({
    payload: interval.payload,
    pricePayload: pricesResult,
    sourceTicker,
    sessionDate,
    marketOpen: !historical && session.marketOpen,
    checkedAt: historical || !session.marketOpen ? newYorkCashCloseIso(sessionDate) : new Date().toISOString(),
    aggregationPeriod,
  });
  return historical ? { ...normalized, status: "HISTORICAL", refreshAfterMs: 6 * 60 * 60_000 } : normalized;
}

export async function getGexDeskZeroGammaPayload(): Promise<GexDeskZeroGammaPayload> {
  const session = getUsOptionsSession();
  try {
    const spot = await getNativeFuturesSpot("NQ");
    if (!spot) {
      throw new QuantDataError("No current or last-good NQ futures price is available.", 503, null);
    }
    const snapshot = await getNativeGammaSnapshot("NQ", session.sessionDate, spot);
    return {
      instrument: "NQ",
      sessionDate: snapshot.sessionDate,
      asOf: new Date().toISOString(),
      marketOpen: session.marketOpen,
      status: session.marketOpen ? "LIVE" : "EOD",
      spot,
      trueGammaFlip: snapshot.zeroGamma,
      netGex: snapshot.netGex,
      grossGex: snapshot.grossGex,
      curve: snapshot.gammaFlipCurve,
      method: "TRUE_OI_SCENARIO",
      disclosure: "True open-interest gamma flip from the included native CME NQ structural and current-session 0DTE chains. Every included option is repriced across hypothetical NQ futures prices using Black-76 gamma; the zero crossing nearest live NQ is selected and linearly interpolated.",
    };
  } catch (error) {
    if (error instanceof QuantDataError) throw error;
    throw new QuantDataError(
      "The native NQ zero-gamma scenario is temporarily unavailable.",
      503,
      null,
    );
  }
}

async function buildNativeChartGamma(
  root: NativeGammaRoot,
  requestedSessionDate?: string,
): Promise<ChartGammaLevelsPayload> {
  try {
    const currentSession = getUsOptionsSession();
    const sessionDate = requestedSessionDate?.trim() || currentSession.sessionDate;
    const session = sessionDate === currentSession.sessionDate
      ? currentSession
      : { marketOpen: false, sessionDate };
    const spot = session.marketOpen
      ? await getNativeFuturesSpot(root)
      : await getNativeFuturesSessionClose(root, session.sessionDate)
        ?? await getNativeFuturesSpot(root);
    if (!spot) {
      throw new QuantDataError(`No current or completed-session ${root} futures price is available.`, 503, null);
    }
    const snap = await getNativeGammaSnapshot(root, session.sessionDate, spot);
    if (!snap.levels.length) {
      throw new QuantDataError(`No native gamma map is available for ${root}.`, 422, null);
    }
    const environment = classifyGammaEnvironment(snap.netGex, snap.grossGex);
    const source: ChartGammaSourceSnapshot = {
      symbol: root,
      stockPrice: snap.spot,
      revision: snap.revision,
      validationStrikes: snap.validationStrikes,
      levels: snap.levels.filter((level) => level.kind !== "EXPECTED_MOVE_MAX" && level.kind !== "EXPECTED_MOVE_MIN"),
    };
    return {
      root,
      requestedSource: root,
      checkedAt: session.marketOpen ? new Date().toISOString() : newYorkCashCloseIso(snap.sessionDate),
      refreshAfterMs: session.marketOpen ? 60_000 : 300_000,
      marketOpen: session.marketOpen,
      snapshotMode: session.marketOpen ? "LIVE" : "NEW_YORK_EOD",
      sessionDate: snap.sessionDate,
      environment,
      revision: snap.revision,
      sources: [source],
      dataOrigin: "NATIVE_FUTURES",
    };
  } catch (nativeError) {
    try {
      return await getCashCalibratedChartGammaLevels(root, undefined, requestedSessionDate);
    } catch {
      throw nativeError;
    }
  }
}

export async function getCashCalibratedChartGammaLevels(
  root: NativeGammaRoot,
  sourceInput?: string,
  requestedSessionDate?: string,
  futuresPriceOverride?: number,
): Promise<ChartGammaLevelsPayload> {
  const defaultSource = canonicalOptionsSourceForRoot(root);
  const normalizedSource = (sourceInput || defaultSource).trim().toUpperCase();
  const compatibleSources = root === "NQ" ? new Set(["NDX", "QQQ"]) : new Set(["SPX", "SPXW", "SPY"]);
  if (!compatibleSources.has(normalizedSource)) {
    throw new QuantDataError(`${normalizedSource || "The requested source"} cannot be calibrated to ${root}.`, 400, null);
  }
  const calibrationSource = normalizedSource as ChartGammaSourceSnapshot["symbol"];
  const cashPayload = await getChartGammaLevels(root, calibrationSource, requestedSessionDate);
  const cashSource = cashPayload.sources.find((source) => source.symbol === calibrationSource);
  if (!cashSource || !cashSource.levels.length || !Number.isFinite(cashSource.stockPrice) || cashSource.stockPrice <= 0) {
    throw new QuantDataError(`No ${calibrationSource} gamma snapshot is available to calibrate ${root}.`, 422, null);
  }

  const verifiedReplayPrice = Number.isFinite(futuresPriceOverride) && (futuresPriceOverride ?? 0) > 0
    ? futuresPriceOverride ?? null
    : null;
  const futuresPrice = verifiedReplayPrice ?? (cashPayload.marketOpen
    ? await getNativeFuturesSpot(root)
    : await getNativeFuturesSessionClose(root, cashPayload.sessionDate)
      ?? await getNativeFuturesSpot(root));
  const scale = futuresPrice ? futuresPrice / cashSource.stockPrice : Number.NaN;
  if (!futuresPrice || !Number.isFinite(scale) || !isOptionsFuturesRatioSane(calibrationSource, scale)) {
    throw new QuantDataError(`No valid ${calibrationSource} to ${root} calibration is available.`, 503, null);
  }

  const toFuturesPrice = (price: number) => Math.round((price * scale) / 0.25) * 0.25;
  const revision = `cash-calibrated:${calibrationSource}:${root}:${cashSource.revision}:${scale.toFixed(8)}`;
  const calibratedSource: ChartGammaSourceSnapshot = {
    symbol: root,
    stockPrice: futuresPrice,
    revision,
    validationStrikes: cashSource.validationStrikes.map(toFuturesPrice),
    // The cage's flip and crossings are prices in the cash source's scale and
    // must be calibrated to futures exactly like every level and strike.
    cage: cashSource.cage
      ? {
          ...cashSource.cage,
          flip: typeof cashSource.cage.flip === "number" && Number.isFinite(cashSource.cage.flip)
            ? toFuturesPrice(cashSource.cage.flip)
            : cashSource.cage.flip,
          crossings: cashSource.cage.crossings.map(toFuturesPrice),
        }
      : undefined,
    levels: mergeGammaLevelsAtSamePrice(cashSource.levels.map((level) => ({
      ...level,
      id: `calibrated-${calibrationSource.toLowerCase()}-${level.id}`,
      price: toFuturesPrice(level.price),
    })), 0.25),
  };
  const positioning = cashPayload.positioning
    ? chartGammaPositioningSnapshot({
        root,
        sourceSymbol: calibrationSource as ChartGammaPositioningSnapshot["sourceSymbol"],
        expiration: cashPayload.positioning.expiration,
        asOf: Date.parse(cashPayload.positioning.asOf),
        status: cashPayload.positioning.status,
        sourcePrice: cashPayload.positioning.sourcePrice,
        futuresPrice,
        priceScale: scale,
        strikes: cashPayload.positioning.strikes.map((row) => ({
          strike: row.sourceStrike,
          call: row.call,
          put: row.put,
          net: row.net,
        })),
        lookbacks: cashPayload.positioning.lookbacks.map((lookback) => ({
          minutes: lookback.minutes,
          strikes: lookback.strikes.map((row) => ({
            strike: row.sourceStrike,
            call: row.call,
            put: row.put,
            net: row.net,
          })),
        })),
      })
    : undefined;

  return {
    ...cashPayload,
    requestedSource: root,
    revision,
    sources: [calibratedSource],
    dataOrigin: "CASH_CALIBRATED_FALLBACK",
    calibrationSource,
    levelPriceScale: scale,
    positioning,
  };
}

function previousWeekdayIso(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function exposureAtFrame(mode: "GAMMA" | "DELTA", frame: GexMapFrame): ExposureSummary {
  const strikes = frame.updates
    .filter((row) => Number.isFinite(row.strike) && row.strike > 0)
    .sort((left, right) => left.strike - right.strike);
  return {
    mode,
    representation: "PER_ONE_PERCENT_MOVE",
    net: strikes.reduce((sum, row) => sum + row.net, 0),
    gross: strikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    strikes,
    expiries: [],
  };
}

function chartGammaPositioningSnapshot(args: {
  root: NativeGammaRoot;
  sourceSymbol: ChartGammaPositioningSnapshot["sourceSymbol"];
  expiration: string | null;
  asOf: number;
  status: ChartGammaPositioningSnapshot["status"];
  sourcePrice: number;
  futuresPrice: number;
  priceScale: number;
  strikes: ExposureStrike[];
  lookbacks?: Array<{ minutes: 5 | 15 | 30; strikes: ExposureStrike[] }>;
}): ChartGammaPositioningSnapshot {
  const convert = (row: ExposureStrike) => ({
    sourceStrike: row.strike,
    futuresEquivalent: Math.round((row.strike * args.priceScale) / 0.25) * 0.25,
    call: row.call,
    put: row.put,
    net: row.net,
  });
  const strikes = args.strikes
    .filter((row) => Number.isFinite(row.strike) && row.strike > 0)
    .map(convert)
    .sort((left, right) => left.sourceStrike - right.sourceStrike);
  return {
    sourceSymbol: args.sourceSymbol,
    futuresRoot: args.root,
    expiration: args.expiration,
    asOf: new Date(args.asOf).toISOString(),
    status: args.status,
    sourcePrice: args.sourcePrice,
    futuresPrice: args.futuresPrice,
    priceScale: args.priceScale,
    totals: {
      call: strikes.reduce((sum, row) => sum + row.call, 0),
      put: strikes.reduce((sum, row) => sum + row.put, 0),
      net: strikes.reduce((sum, row) => sum + row.net, 0),
      gross: strikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    },
    strikes,
    lookbacks: (args.lookbacks ?? []).map((lookback) => ({
      minutes: lookback.minutes,
      strikes: lookback.strikes.map(convert).sort((left, right) => left.sourceStrike - right.sourceStrike),
    })),
  };
}

/**
 * Reconstruct the chart gamma state at a historical New York timestamp.
 * Only interval-map frames timestamped at or before `asOf` are eligible. The
 * moving front-expiry profile is combined with the previous completed New York
 * EOD structure, then translated onto the contemporaneous CME futures price.
 */
export async function getHistoricalCashCalibratedChartGammaLevelsAt(
  root: NativeGammaRoot,
  sourceInput: string,
  asOfInput: string,
  futuresPrice: number,
): Promise<ChartGammaLevelsPayload> {
  const asOf = Date.parse(asOfInput);
  if (!Number.isFinite(asOf) || asOf > Date.now()) {
    throw new QuantDataError("A valid historical gamma replay timestamp is required.", 400, null);
  }
  if (!Number.isFinite(futuresPrice) || futuresPrice <= 0) {
    throw new QuantDataError("A valid point-in-time CME futures price is required.", 400, null);
  }

  const source = (sourceInput || (root === "NQ" ? "QQQ" : "SPY")).trim().toUpperCase();
  const compatible = root === "NQ" ? new Set(["NDX", "QQQ"]) : new Set(["SPX", "SPXW", "SPY"]);
  if (!compatible.has(source)) {
    throw new QuantDataError(`${source || "The requested source"} cannot be calibrated to ${root}.`, 400, null);
  }
  const sessionParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(asOf));
  const readSessionPart = (type: Intl.DateTimeFormatPartTypes) =>
    sessionParts.find((part) => part.type === type)?.value ?? "";
  const sessionDate = `${readSessionPart("year")}-${readSessionPart("month")}-${readSessionPart("day")}`;

  const [gammaPanel, deltaPanel, priorEod] = await Promise.all([
    getGexMapPanel(source, "GAMMA", sessionDate),
    getGexMapPanel(source, "DELTA", sessionDate).catch(() => null),
    getChartGammaLevels(root, source, previousWeekdayIso(sessionDate)).catch(() => null),
  ]);
  const eligibleGammaFrames = gammaPanel.frames.filter((frame) => frame.timestamp <= asOf);
  const gammaFrame = eligibleGammaFrames.at(-1);
  if (!gammaFrame?.updates.length) {
    throw new QuantDataError(`No ${source} intraday gamma frame exists at or before the replay clock.`, 422, null);
  }
  const deltaFrame = deltaPanel
    ? [...deltaPanel.frames].reverse().find((frame) => frame.timestamp <= asOf) ?? null
    : null;
  const cashCandle = [...gammaPanel.candles].reverse().find((candle) => candle.timestamp <= asOf) ?? null;
  const cashPrice = cashCandle?.close ?? null;
  if (!cashPrice || cashPrice <= 0) {
    throw new QuantDataError(`No ${source} price exists at or before the replay clock.`, 422, null);
  }

  const scale = futuresPrice / cashPrice;
  if (!isOptionsFuturesRatioSane(source, scale)) {
    throw new QuantDataError(`The historical ${source} to ${root} calibration is outside its validated range.`, 422, null);
  }
  const toFuturesPrice = (price: number) => Math.round((price * scale) / 0.25) * 0.25;
  const gamma = exposureAtFrame("GAMMA", gammaFrame);
  const delta = deltaFrame ? exposureAtFrame("DELTA", deltaFrame) : null;
  const positioningLookbacks = ([5, 15, 30] as const).flatMap((minutes) => {
    const target = gammaFrame.timestamp - minutes * 60_000;
    const frame = [...eligibleGammaFrames].reverse().find((candidate) => candidate.timestamp <= target);
    return frame ? [{ minutes, strikes: exposureAtFrame("GAMMA", frame).strikes }] : [];
  });
  const dynamicLevels = chartGammaSourceLevels(gamma, cashPrice, null, delta)
    .map((level) => ({
      ...level,
      id: `historical-intraday-${level.id}`,
      label: `${level.label} · intraday`,
      price: toFuturesPrice(level.price),
    }));

  const structuralKinds = new Set<ChartGammaSourceLevel["kind"]>([
    "CALL_WALL",
    "PUT_WALL",
    "HIGH_VOL_LEVEL",
    "GAMMA_MAGNET",
    "GAMMA_CENTRE",
    "MAJOR_POSITIVE_OI",
  ]);
  const priorSource = priorEod?.sources.find((candidate) => candidate.symbol === source) ?? null;
  const structuralLevels = (priorSource?.levels ?? [])
    .filter((level) => structuralKinds.has(level.kind))
    .map((level) => ({
      ...level,
      id: `prior-eod-${level.id}`,
      label: `${level.label} · EOD`,
      price: toFuturesPrice(level.price),
    }));

  const priorExpectedMax = priorSource?.levels.find((level) => level.kind === "EXPECTED_MOVE_MAX") ?? null;
  const priorExpectedMin = priorSource?.levels.find((level) => level.kind === "EXPECTED_MOVE_MIN") ?? null;
  const sessionCashOpen = gammaPanel.candles.find((candle) => candle.timestamp <= asOf)?.open ?? cashPrice;
  const expectedMove = priorExpectedMax && priorExpectedMin
    ? Math.abs(priorExpectedMax.price - priorExpectedMin.price) / 2
    : null;
  const expectedLevels: ChartGammaSourceLevel[] = expectedMove && expectedMove > 0
    ? [
        {
          id: "historical-expected-move-max",
          kind: "EXPECTED_MOVE_MAX",
          label: "1D Max",
          price: toFuturesPrice(sessionCashOpen + expectedMove),
          value: null,
          rank: 1,
        },
        {
          id: "historical-expected-move-min",
          kind: "EXPECTED_MOVE_MIN",
          label: "1D Min",
          price: toFuturesPrice(sessionCashOpen - expectedMove),
          value: null,
          rank: 1,
        },
      ]
    : [];
  const levels = mergeGammaLevelsAtSamePrice([
    ...dynamicLevels,
    ...structuralLevels,
    ...expectedLevels,
  ], 0.25);
  const environment = classifyGammaEnvironment(gamma.net, gamma.gross);
  const revision = JSON.stringify({
    sessionDate,
    frame: gammaFrame.timestamp,
    scale: Number(scale.toFixed(8)),
    levels: levels.map((level) => [level.kind, level.price, level.value]),
  });
  const calibratedSource: ChartGammaSourceSnapshot = {
    symbol: root,
    stockPrice: futuresPrice,
    revision,
    validationStrikes: gamma.strikes
      .filter((row) => row.strike >= cashPrice * 0.97 && row.strike <= cashPrice * 1.03)
      .map((row) => toFuturesPrice(row.strike)),
    levels,
  };

  return {
    root,
    requestedSource: root,
    checkedAt: new Date(gammaFrame.timestamp).toISOString(),
    refreshAfterMs: 5 * 60_000,
    marketOpen: false,
    snapshotMode: "HISTORICAL_INTRADAY",
    sessionDate,
    environment,
    revision,
    sources: [calibratedSource],
    dataOrigin: "CASH_CALIBRATED_FALLBACK",
    calibrationSource: source as ChartGammaSourceSnapshot["symbol"],
    levelPriceScale: scale,
    positioning: chartGammaPositioningSnapshot({
      root,
      sourceSymbol: source as ChartGammaPositioningSnapshot["sourceSymbol"],
      expiration: gammaPanel.expiration,
      asOf: gammaFrame.timestamp,
      status: "HISTORICAL_INTRADAY",
      sourcePrice: cashPrice,
      futuresPrice,
      priceScale: scale,
      strikes: gamma.strikes,
      lookbacks: positioningLookbacks,
    }),
  };
}

function latestCompletedOptionsSessionAt(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const sessionDate = `${read("year")}-${read("month")}-${read("day")}`;
  const minute = Number(read("hour")) * 60 + Number(read("minute"));
  const weekday = new Date(`${sessionDate}T00:00:00.000Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5 && minute >= 16 * 60 + 5
    ? sessionDate
    : previousWeekdayIso(sessionDate);
}

/**
 * Resolve the latest completed structural options session at or before a replay
 * date. Weekends and exchange holidays are skipped without ever moving forward
 * from the requested cutoff.
 */
export async function getHistoricalCashCalibratedChartGammaLevelsAtOrBefore(
  root: NativeGammaRoot,
  sourceInput: string,
  requestedSessionDate: string,
  futuresPrice?: number,
): Promise<ChartGammaLevelsPayload> {
  let candidate = requestedSessionDate;
  let lastError: unknown = null;
  const requestedSource = sourceInput.trim().toUpperCase();
  const fallbackSource = root === "NQ"
    ? requestedSource === "QQQ" ? "NDX" : "QQQ"
    : requestedSource === "SPY" ? "SPX" : "SPY";
  const sources = [...new Set([requestedSource, fallbackSource])];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    for (const source of sources) {
      try {
        return await getCashCalibratedChartGammaLevels(root, source, candidate, futuresPrice);
      } catch (error) {
        lastError = error;
        const problem = getQuantDataHttpError(error);
        if (problem.status !== 404 && problem.status !== 422) throw error;
      }
    }
    candidate = previousWeekdayIso(candidate);
  }
  throw lastError ?? new QuantDataError("No completed historical gamma session is available before this replay date.", 422, null);
}

/**
 * Point-in-time replay resolver. Prefer the last intraday frame that existed at
 * the replay clock. Before the first frame (or beyond intraday-map retention),
 * fall back to the latest completed EOD structure, calibrated with the futures
 * price already visible in the replay rather than a second historical pull.
 */
export async function getHistoricalReplayChartGammaLevels(
  root: NativeGammaRoot,
  sourceInput: string,
  asOfInput: string,
  futuresPrice: number,
): Promise<ChartGammaLevelsPayload> {
  const asOf = Date.parse(asOfInput);
  if (!Number.isFinite(asOf) || asOf > Date.now()) {
    throw new QuantDataError("A valid historical gamma replay timestamp is required.", 400, null);
  }
  const requestedSource = sourceInput.trim().toUpperCase();
  const fallbackSource = root === "NQ"
    ? requestedSource === "QQQ" ? "NDX" : "QQQ"
    : requestedSource === "SPY" ? "SPX" : "SPY";
  for (const source of [...new Set([requestedSource, fallbackSource])]) {
    try {
      return await getHistoricalCashCalibratedChartGammaLevelsAt(root, source, asOfInput, futuresPrice);
    } catch (intradayError) {
      const problem = getQuantDataHttpError(intradayError);
      if (problem.status !== 404 && problem.status !== 422) throw intradayError;
    }
  }
  return getHistoricalCashCalibratedChartGammaLevelsAtOrBefore(
    root,
    requestedSource,
    latestCompletedOptionsSessionAt(asOf),
    futuresPrice,
  );
}

function gexFlowTimestamp(value: unknown): number {
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  let parsed = finiteNumber(value) ?? 0;
  if (parsed > 10_000_000_000_000_000) parsed /= 1_000_000;
  else if (parsed > 10_000_000_000_000) parsed /= 1_000;
  else if (parsed > 0 && parsed < 10_000_000_000) parsed *= 1_000;
  return Math.round(parsed);
}

function gexFlowBoolean(row: JsonRecord, ...keys: string[]) {
  return keys.some((key) => row[key] === true || row[key] === 1 || String(row[key] ?? "").toLowerCase() === "true");
}

function gexFlowNumber(row: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = finiteNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function gexFlowText(row: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = textValue(row[key]).trim();
    if (value) return value;
  }
  return "";
}

function gexFlowRows(payload: unknown, sourceKind: "CONSOLIDATED" | "RAW"): GexFlowRow[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((value, index) => {
    if (!isRecord(value)) return [];
    const ticker = gexFlowText(value, "ticker", "underlyingSymbol", "underlying")?.toUpperCase();
    if (!ticker) return [];
    const rawContract = gexFlowText(value, "contractType", "optionType", "putCall").toUpperCase();
    const contractType: GexFlowRow["contractType"] = rawContract.includes("CALL") || rawContract === "C"
      ? "CALL"
      : rawContract.includes("PUT") || rawContract === "P"
        ? "PUT"
        : "UNKNOWN";
    const tradeTime = gexFlowTimestamp(value.tradeTime ?? value.timestamp ?? value.tsEvent ?? value.time);
    const fill = gexFlowNumber(value, "optionPrice", "fillPrice", "averagePrice", "price");
    const bid = gexFlowNumber(value, "bidPrice", "bid", "bestBid");
    const ask = gexFlowNumber(value, "askPrice", "ask", "bestAsk");
    const mid = gexFlowNumber(value, "midPrice", "mid") ?? (bid !== null && ask !== null ? (bid + ask) / 2 : null);
    const providerSide = gexFlowText(value, "tradeSideCode", "tradeSide", "side");
    let side = normalizeGexFlowSide(providerSide);
    let sideSource: GexFlowRow["sideSource"] = side === "UNKNOWN" ? "UNAVAILABLE" : "PROVIDER";
    if (side === "UNKNOWN" && fill !== null && bid !== null && ask !== null) {
      side = fill > ask ? "ABOVE_ASK" : fill >= ask ? "ASK" : fill < bid ? "BELOW_BID" : fill <= bid ? "BID" : "MID";
      sideSource = "ESTIMATED";
    }
    const providerSentiment = gexFlowText(value, "sentimentType", "sentiment", "direction").toUpperCase();
    const sentiment: GexFlowRow["sentiment"] = providerSentiment.includes("BULL")
      ? "BULLISH"
      : providerSentiment.includes("BEAR")
        ? "BEARISH"
        : estimateGexFlowDirection(contractType, side);
    const sentimentSource: GexFlowRow["sentimentSource"] = providerSentiment.includes("BULL") || providerSentiment.includes("BEAR")
      ? "PROVIDER"
      : sentiment === "NEUTRAL" && side === "UNKNOWN"
        ? "UNAVAILABLE"
        : "ESTIMATED";
    const size = Math.max(0, gexFlowNumber(value, "size", "quantity", "contracts", "totalSize") ?? 0);
    const multiplier = Math.max(1, gexFlowNumber(value, "contractMultiplier", "multiplier") ?? 100);
    const premium = gexFlowPremium(fill, size, multiplier, gexFlowNumber(value, "premium", "notionalValue"));
    const volume = gexFlowNumber(value, "volume", "contractVolume", "sessionVolume");
    const openInterest = gexFlowNumber(value, "openInterest", "oi");
    const previousOpenInterest = gexFlowNumber(value, "previousOpenInterest", "priorOpenInterest", "previousOi");
    const deltaOpenInterest = openInterest !== null && previousOpenInterest !== null
      ? openInterest - previousOpenInterest
      : gexFlowNumber(value, "openInterestChange", "deltaOpenInterest", "oiChange");
    const oiAnalysis = gexFlowOiAnalysis(size, volume, openInterest);
    const stockPrice = gexFlowNumber(value, "stockPrice", "underlyingPrice", "spotPrice");
    const strikePrice = gexFlowNumber(value, "strikePrice", "strike");
    const moneyness = gexFlowMoneyness(contractType, strikePrice, stockPrice);
    const expirationDate = gexFlowText(value, "expirationDate", "expiration", "expiry") || null;
    const dte = gexFlowNumber(value, "dte") ?? (expirationDate && tradeTime
      ? Math.max(0, Math.ceil((Date.parse(`${expirationDate}T21:00:00.000Z`) - tradeTime) / 86_400_000))
      : null);
    const consolidationType = gexFlowText(value, "tradeConsolidationType", "consolidationType", "tradeType") || sourceKind;
    const consolidationUpper = consolidationType.toUpperCase();
    const strategy = gexFlowText(value, "strategy", "strategyType", "detectedStrategy") || null;
    const spreadPosition = gexFlowSpreadPosition(fill, bid, ask);
    const spreadWidth = bid !== null && ask !== null ? Math.max(0, ask - bid) : null;
    const spreadPercent = spreadWidth !== null && mid !== null && mid > 0 ? spreadWidth / mid : null;
    const impliedVolatility = normalizeIv(value.impliedVolatility ?? value.iv);
    const previousImpliedVolatility = normalizeIv(value.previousImpliedVolatility ?? value.previousIv);
    const ivDifference = impliedVolatility !== null && previousImpliedVolatility !== null ? impliedVolatility - previousImpliedVolatility : null;
    const osi = gexFlowText(value, "osi", "optionSymbol", "contractSymbol", "instrumentId") || null;
    const id = gexFlowText(value, "id", "tradeId", "eventId") || `${sourceKind.toLowerCase()}-${ticker}-${tradeTime}-${index}`;
    const childCount = Math.max(1, Math.round(gexFlowNumber(value, "childCount", "tradeCount", "printCount", "multiplierCount") ?? 1));
    const underlyingTypeText = gexFlowText(value, "underlyingType", "assetType", "securityType").toUpperCase();
    const underlyingType: GexFlowRow["underlyingType"] = underlyingTypeText.includes("INDEX") || ["SPX", "SPXW", "NDX"].includes(ticker)
      ? "INDEX"
      : underlyingTypeText.includes("ETF") || ["SPY", "QQQ", "IWM"].includes(ticker)
        ? "ETF"
        : underlyingTypeText.includes("STOCK") || underlyingTypeText.includes("EQUITY")
          ? "STOCK"
          : "UNKNOWN";
    const row: GexFlowRow = {
      id,
      parentId: gexFlowText(value, "parentId", "consolidatedId", "groupId") || null,
      childCount,
      ticker,
      osi,
      contractType,
      expirationDate,
      dte,
      strikePrice,
      fill,
      fillKind: sourceKind === "CONSOLIDATED" && childCount > 1 ? "WEIGHTED_AVERAGE" : fill === null ? "UNAVAILABLE" : "PROVIDER",
      bid,
      mid,
      ask,
      spreadWidth,
      spreadPercent,
      spreadPosition,
      side,
      sideSource,
      sentiment,
      sentimentSource,
      consolidationType,
      tradeType: gexFlowText(value, "tradeType", "tradeCondition", "condition") || sourceKind,
      strategy,
      strategyConfidence: strategy
        ? (["LOW", "MEDIUM", "HIGH"].includes(gexFlowText(value, "strategyConfidence").toUpperCase())
          ? gexFlowText(value, "strategyConfidence").toUpperCase() as GexFlowRow["strategyConfidence"]
          : "HIGH")
        : "UNAVAILABLE",
      size,
      premium: premium.value,
      premiumSource: premium.source,
      volume,
      openInterest,
      previousOpenInterest,
      deltaOpenInterest,
      ...oiAnalysis,
      stockPrice,
      moneynessPercent: moneyness.percent,
      moneynessType: moneyness.type,
      impliedVolatility,
      previousImpliedVolatility,
      ivReaction: ivDifference === null ? "UNKNOWN" : Math.abs(ivDifference) < 0.0001 ? "FLAT" : ivDifference > 0 ? "RISING" : "FALLING",
      delta: gexFlowNumber(value, "delta"),
      gamma: gexFlowNumber(value, "gamma"),
      theta: gexFlowNumber(value, "theta"),
      vega: gexFlowNumber(value, "vega"),
      vanna: gexFlowNumber(value, "vanna"),
      charm: gexFlowNumber(value, "charm"),
      unusual: gexFlowBoolean(value, "isUnusual", "unusual"),
      opening: gexFlowBoolean(value, "isOpeningPosition", "opening"),
      goldenSweep: gexFlowBoolean(value, "isGoldenSweep", "goldenSweep"),
      multiLeg: gexFlowBoolean(value, "isMultiLeg", "multiLeg", "complexTrade") || Boolean(strategy),
      sweep: gexFlowBoolean(value, "isSweep", "sweep") || consolidationUpper.includes("SWEEP"),
      block: gexFlowBoolean(value, "isBlock", "block") || consolidationUpper.includes("BLOCK"),
      split: gexFlowBoolean(value, "isSplit", "split") || consolidationUpper.includes("SPLIT"),
      exchange: gexFlowText(value, "exchange", "venue", "publisher") || null,
      sector: gexFlowText(value, "sector") || null,
      industry: gexFlowText(value, "industry") || null,
      underlyingType,
      tradeTime,
      dataSource: "KwantData",
      contractRatio: { bidContracts: 0, midContracts: 0, askContracts: 0, totalContracts: 0, classifiedShare: 0, bidRatio: 0, midRatio: 0, askRatio: 0, dominant: "UNAVAILABLE", source: "UNAVAILABLE" },
      flowScore: 0,
      flowScoreBreakdown: { direction: 0, directionSource: "UNAVAILABLE", premium: 0, size: 0, volumeOi: 0, sizeOi: 0, execution: 0, contractRatio: 0, unusual: 0, opening: 0, consolidation: 0, liquidity: 0 },
    };
    return [row];
  });
}

function gexFlowComprisingRows(payload: unknown): GexFlowRow[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((parent, parentIndex) => {
    if (!isRecord(parent) || !Array.isArray(parent.comprisingTrades)) return [];
    const parentId = gexFlowText(parent, "id", "tradeId", "eventId") || `consolidated-parent-${parentIndex}`;
    return parent.comprisingTrades.flatMap((child, childIndex) => {
      if (!isRecord(child)) return [];
      // Comprising trades are a deliberately smaller provider projection. Fill
      // missing contract identity from the authoritative parent, while the
      // child always wins for price, side, size, venue and timestamp.
      const merged: JsonRecord = {
        ...parent,
        ...child,
        id: gexFlowText(child, "id", "tradeId", "eventId") || `${parentId}:child:${childIndex}`,
        parentId,
        childCount: 1,
        tradeConsolidationType: "RAW_CHILD",
        comprisingTrades: undefined,
      };
      return gexFlowRows({ data: [merged] }, "RAW");
    });
  });
}

function gexFlowCursor(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.nextSearchAfter)) return null;
  const cursor = payload.nextSearchAfter
    .filter((part) => typeof part === "string" || typeof part === "number")
    .map(String);
  return cursor.length ? cursor : null;
}

function attachGexFlowRatios(rows: GexFlowRow[], ratios: Map<string, GexFlowContractRatio>) {
  return rows.map((row) => ({ ...row, contractRatio: ratios.get(gexFlowContractKey(row)) ?? row.contractRatio }));
}

type GexFlowContractIdentity = Pick<GexFlowRow, "osi" | "ticker" | "expirationDate" | "strikePrice" | "contractType">;

function requestGexFlowContractRatio(
  row: GexFlowContractIdentity,
  sessionDate: string,
  replayTimestamp: number | null,
  live: boolean,
) {
  if (row.contractType === "UNKNOWN" || row.expirationDate === null || row.strikePrice === null) {
    return Promise.resolve<GexFlowContractRatio | null>(null);
  }
  const windowKey = replayTimestamp === null ? sessionDate : `${sessionDate}:${replayTimestamp}`;
  const cacheKey = `${windowKey}:${gexFlowContractKey(row)}`;
  const now = Date.now();
  const cached = gexFlowContractRatioCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;

  const timeScope: JsonRecord = replayTimestamp === null
    ? { sessionDate }
    : {
        timeRange: {
          // US listed options do not trade before this UTC boundary. The end
          // is the replay clock, so the provider aggregate cannot see later
          // prints from the selected session.
          startTime: `${sessionDate}T00:00:00.000Z`,
          endTime: new Date(replayTimestamp).toISOString(),
        },
      };
  const promise = quantDataPost("/options/tool/contract-trade-side-statistics", {
    ...timeScope,
    dataMode: "VOLUME",
    filter: {
      ticker: row.ticker,
      expirationDate: row.expirationDate,
      strikePrice: row.strikePrice,
      contractType: row.contractType,
    },
  }, live ? 60_000 : 21_600_000)
    .then((result) => gexFlowContractRatioFromTradeSideStatistics(result.payload, row.contractType))
    .catch((error) => {
      gexFlowContractRatioCache.delete(cacheKey);
      throw error;
    });
  gexFlowContractRatioCache.set(cacheKey, {
    expiresAt: now + (live ? 60_000 : 21_600_000),
    promise,
  });
  return promise;
}

async function getGexFlowContractRatios(
  rows: GexFlowContractIdentity[],
  sessionDate: string,
  replayTimestamp: number | null,
  live: boolean,
) {
  const contracts = [...new Map(rows.map((row) => [gexFlowContractKey(row), row])).values()];
  const ratios = new Map<string, GexFlowContractRatio>();
  let unavailable = 0;
  // Keep pressure on the shared provider quota predictable. Cached contracts
  // resolve immediately; cold contracts are enriched in small bounded waves.
  for (let index = 0; index < contracts.length; index += 6) {
    const batch = contracts.slice(index, index + 6);
    const results = await Promise.allSettled(batch.map((row) => requestGexFlowContractRatio(
      row,
      sessionDate,
      replayTimestamp,
      live,
    )));
    results.forEach((result, resultIndex) => {
      const row = batch[resultIndex];
      if (result.status === "fulfilled" && result.value) ratios.set(gexFlowContractKey(row), result.value);
      else unavailable += 1;
    });
  }
  return { ratios, unavailable, requested: contracts.length };
}

export async function getGexFlowContractRatioEnrichment(args: {
  contracts: GexFlowContractIdentity[];
  sessionDate: string;
  replayAt?: string;
}) {
  const session = getUsOptionsSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.sessionDate)) throw new QuantDataError("A valid GEX FLOW session date is required.", 400, null);
  if (args.sessionDate > session.sessionDate) throw new QuantDataError("GEX FLOW cannot request a future options session.", 400, null);
  const replayTimestamp = args.replayAt ? Date.parse(args.replayAt) : null;
  if (args.replayAt && !Number.isFinite(replayTimestamp)) throw new QuantDataError("A valid GEX FLOW replay timestamp is required.", 400, null);
  const live = args.sessionDate === session.sessionDate && replayTimestamp === null && session.marketOpen;
  const result = await getGexFlowContractRatios(
    args.contracts.slice(0, 25),
    args.sessionDate,
    replayTimestamp,
    live,
  );
  return {
    ratios: Object.fromEntries(result.ratios),
    requested: result.requested,
    unavailable: result.unavailable,
    replayAt: replayTimestamp === null ? null : new Date(replayTimestamp).toISOString(),
    source: "QuantData exact-contract trade-side VOLUME statistics",
  };
}

export async function getGexFlowPayload(args: {
  symbol: string;
  mode: GexFlowMode;
  sessionDate?: string;
  replayAt?: string;
  size?: number;
  cursor?: string[];
}): Promise<GexFlowPayload> {
  const startedAt = Date.now();
  const session = getUsOptionsSession();
  const symbol = args.symbol.trim().toUpperCase() || "SPX";
  const sessionDate = args.sessionDate?.trim() || session.sessionDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new QuantDataError("A valid GEX FLOW session date is required.", 400, null);
  if (sessionDate > session.sessionDate) throw new QuantDataError("GEX FLOW cannot request a future options session.", 400, null);
  const replayTimestamp = args.replayAt ? Date.parse(args.replayAt) : null;
  if (args.replayAt && !Number.isFinite(replayTimestamp)) throw new QuantDataError("A valid GEX FLOW replay timestamp is required.", 400, null);
  const mode = args.mode;
  const size = Math.max(25, Math.min(100, Math.round(args.size ?? 100)));
  const requestBody: JsonRecord = {
    sessionDate,
    size,
    sort: { field: "tradeTime", direction: "DESCENDING" },
  };
  // QuantData's order-flow endpoints are provider-wide when no ticker filter is
  // supplied. Keep ALL as one authoritative, globally sorted tape so replay,
  // cursors and refreshes do not fan out into one request per instrument.
  if (symbol !== "ALL") requestBody.filter = { ticker: symbol };
  if (args.cursor?.length) requestBody.searchAfter = args.cursor;
  const wantsConsolidated = mode !== "RAW";
  const wantsRaw = mode !== "CONSOLIDATED";
  const [consolidatedResult, rawResult] = await Promise.allSettled([
    wantsConsolidated ? quantDataPost("/options/tool/order-flow/consolidated", {
      ...requestBody,
      includeComprisingTrades: mode === "HYBRID",
    }, session.marketOpen ? 2_000 : 30_000) : Promise.resolve({ payload: { data: [] }, remaining: null }),
    wantsRaw ? quantDataPost("/options/tool/order-flow/unconsolidated", requestBody, session.marketOpen ? 2_000 : 30_000) : Promise.resolve({ payload: { data: [] }, remaining: null }),
  ]);
  const consolidatedPayload = consolidatedResult.status === "fulfilled" ? consolidatedResult.value.payload : null;
  const rawPayload = rawResult.status === "fulfilled" ? rawResult.value.payload : null;
  let consolidatedRows = gexFlowRows(consolidatedPayload, "CONSOLIDATED");
  let rawRows = gexFlowRows(rawPayload, "RAW");
  let comprisingRows = mode === "HYBRID" ? gexFlowComprisingRows(consolidatedPayload) : [];
  const cutoff = replayTimestamp && Number.isFinite(replayTimestamp) ? replayTimestamp : null;
  consolidatedRows = filterGexFlowRowsAtCutoff(consolidatedRows, cutoff);
  rawRows = filterGexFlowRowsAtCutoff(rawRows, cutoff);
  comprisingRows = filterGexFlowRowsAtCutoff(comprisingRows, cutoff);
  const rawAvailable = rawResult.status === "fulfilled";
  const consolidatedAvailable = consolidatedResult.status === "fulfilled";
  let rows = mode === "RAW" ? rawRows : consolidatedRows;
  if (!rows.length && mode === "HYBRID" && rawRows.length) rows = rawRows;
  if (!rows.length && mode === "RAW" && !rawAvailable) {
    const error = rawResult.status === "rejected" ? rawResult.reason : null;
    if (error instanceof QuantDataError) throw error;
    throw new QuantDataError("Raw options tape is unavailable for this entitlement.", 422, null);
  }
  if (!rows.length && !consolidatedAvailable && !rawAvailable) {
    const error = consolidatedResult.status === "rejected" ? consolidatedResult.reason : rawResult.status === "rejected" ? rawResult.reason : null;
    if (error instanceof QuantDataError) throw error;
    throw new QuantDataError("No GEX FLOW data is available for this request.", 422, null);
  }
  const historical = sessionDate !== session.sessionDate || cutoff !== null;
  const marketOpen = !historical && session.marketOpen;
  // A complete one-page raw response is a valid server aggregation fallback.
  // A paginated head page is deliberately NOT treated as a session ratio.
  const rawSessionComplete = rawAvailable && gexFlowCursor(rawPayload) === null;
  const fallbackRatios = rawSessionComplete ? deriveGexFlowContractRatios(rawRows) : new Map<string, GexFlowContractRatio>();
  rows = scoreGexFlowRows(attachGexFlowRatios(rows, fallbackRatios)).sort((left, right) => right.tradeTime - left.tradeTime);
  const hybridChildren = comprisingRows.length ? comprisingRows : rawRows;
  const children = mode === "HYBRID" ? scoreGexFlowRows(attachGexFlowRatios(hybridChildren, fallbackRatios)) : [];
  const status = historical ? "HISTORICAL" : marketOpen ? "LIVE" : "MARKET_CLOSED";
  const selectedPayload = mode === "RAW" ? rawPayload : consolidatedPayload ?? rawPayload;
  const remaining = [consolidatedResult, rawResult].flatMap((result) => result.status === "fulfilled" && result.value.remaining !== null ? [result.value.remaining] : []);
  const limitations: string[] = [];
  if (symbol === "ALL") limitations.push("All options uses the provider-wide options tape; ticker filters can still be applied from the table controls.");
  if (!rawAvailable && wantsRaw) limitations.push("The unconsolidated QuantData tape is unavailable for this entitlement; consolidated rows remain authoritative.");
  if (!rows.some((row) => row.previousOpenInterest !== null)) limitations.push("Daily OI change is unavailable when the provider does not return prior official OI.");
  if (!rows.some((row) => row.sector || row.industry)) limitations.push("Sector and industry enrichment are unavailable in the current projected flow payload.");
  limitations.push("Earnings enrichment is disabled until a validated earnings-calendar source is connected.");
  const payload: GexFlowPayload = {
    schemaVersion: 1,
    mode,
    status,
    asOf: new Date().toISOString(),
    sessionDate,
    marketOpen,
    replayAt: cutoff === null ? null : new Date(cutoff).toISOString(),
    source: "KwantData",
    rows,
    children,
    summary: summarizeGexFlow(rows),
    nextCursor: gexFlowCursor(selectedPayload),
    rawAvailable,
    consolidatedAvailable,
    stale: false,
    refreshAfterMs: marketOpen ? 2_000 : 30_000,
    diagnostics: {
      lastPoll: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      rateLimitRemaining: remaining.length ? Math.min(...remaining) : null,
      rowsFetched: consolidatedRows.length + rawRows.length + comprisingRows.length,
      rowsVisible: rows.length,
      contractRatioSource: rawSessionComplete
          ? "complete-session server aggregation of classified raw prints"
          : "exact-contract ratios load progressively from QuantData trade-side VOLUME statistics",
      oiSource: "KwantData official/reference open interest",
      earningsSource: "UNAVAILABLE",
      flowScoreVersion: GEX_FLOW_SCORE_VERSION,
      limitations,
    },
  };
  const lastGoodKey = `${symbol}:${mode}:${sessionDate}`;
  lastGoodGexFlowByRequest.set(lastGoodKey, payload);
  return payload;
}

export function getLastGoodGexFlowPayload(symbol: string, mode: GexFlowMode, sessionDate: string) {
  const exact = lastGoodGexFlowByRequest.get(`${symbol.toUpperCase()}:${mode}:${sessionDate}`);
  if (exact) return exact;
  const prefix = `${symbol.toUpperCase()}:${mode}:`;
  return [...lastGoodGexFlowByRequest.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .sort((left, right) => Date.parse(right[1].asOf) - Date.parse(left[1].asOf))[0]?.[1] ?? null;
}

export function getQuantDataHttpError(error: unknown) {
  if (error instanceof QuantDataError) {
    return { status: error.status, message: error.message, remaining: error.remaining };
  }
  return { status: 500, message: "Options Flow could not be loaded.", remaining: null };
}
