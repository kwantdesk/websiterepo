import "server-only";
import { unstable_cache } from "next/cache";

import {
  OPTIONS_FLOW_TICKERS,
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
  type ChartGammaSourceLevel,
  type ChartGammaSourceSnapshot,
} from "@/lib/chartGammaLevels";
import {
  buildGexDeskPayload,
  emptyGexDeskPressure,
  type GexDeskHistoryPayload,
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

const API_BASE = "https://api.quantdata.us/v1";
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
let gexDeskCache: { expiresAt: number; promise: Promise<GexDeskPayload> } | null = null;

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
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      });
      const remaining = finiteNumber(response.headers.get("x-ratelimit-remaining"));
      const payload = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        // Rate limited: honour Retry-After (or back off) and try again.
        if (response.status === 429 && attempt < QD_MAX_RETRIES) {
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
        throw new QuantDataError("KwantData timed out while loading this workspace.", 504, null);
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

function parseExposure(payload: unknown, symbol: string, mode: GreekMode, expirationFilter?: string): ExposureSummary | null {
  if (!isRecord(payload) || !isRecord(payload.data)) return null;
  const tickerNode = payload.data[symbol] ?? payload.data[symbol.toUpperCase()];
  if (!isRecord(tickerNode) || !isRecord(tickerNode.exposureMap)) return null;

  const byStrike = new Map<number, ExposureStrike>();
  const expiries: ExposureExpiry[] = [];

  for (const [expiration, strikeMap] of Object.entries(tickerNode.exposureMap)) {
    if (expirationFilter && expiration !== expirationFilter) continue;
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

function parseIvRank(payload: unknown, sessionDate: string) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return { ivRank: null, callIv: null, putIv: null, atmIv: null, ivPercentile: null, historySessions: 0, expiration: null, priorAtmIv: null };
  }
  const ordered = Object.entries(payload.data).sort(([a], [b]) => a.localeCompare(b));
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

function expectedMoveRange(args: {
  priorAtmIv: number | null;
  expiration: string | null;
  dailyCandles: OptionsCandle[];
  sessionDate: string;
  fallbackPrice: number | null;
}): MarketMapIntelligence["expectedMove"] {
  const ordered = [...args.dailyCandles].sort((a, b) => a.timestamp - b.timestamp);
  const sessionIndex = ordered.findIndex((candle) => new Date(candle.timestamp).toISOString().slice(0, 10) === args.sessionDate);
  const sessionCandle = sessionIndex >= 0 ? ordered[sessionIndex] : null;
  const anchorPrice = sessionCandle?.open ?? args.fallbackPrice;
  const anchorLabel: "SESSION_OPEN" | "LATEST_PRICE" = sessionCandle ? "SESSION_OPEN" : "LATEST_PRICE";
  if (anchorPrice === null || anchorPrice <= 0) return null;
  const priorCandle = ordered.filter((candle) => new Date(candle.timestamp).toISOString().slice(0, 10) < args.sessionDate).at(-1) ?? null;
  const approximate = args.priorAtmIv === null || args.priorAtmIv <= 0;
  const movePercent = !approximate
    ? args.priorAtmIv! / Math.sqrt(365)
    : priorCandle && priorCandle.close > 0
      ? (priorCandle.high - priorCandle.low) / (2 * priorCandle.close)
      : 0;
  if (movePercent <= 0) return null;
  const moveDollars = anchorPrice * movePercent;
  return {
    method: approximate ? "PRIOR_REALIZED_RANGE" : "QD_PRIOR_IV_ONE_SIGMA",
    anchorPrice,
    anchorLabel,
    annualizedIv: approximate ? movePercent * Math.sqrt(365) : args.priorAtmIv!,
    movePercent,
    moveDollars,
    min: anchorPrice - moveDollars,
    max: anchorPrice + moveDollars,
    sourceExpiration: args.expiration,
    approximate,
    exactMenthorQEquivalent: false,
  };
}

function chartSessionExpectedMove(args: {
  sessionDate: string;
  marketOpen: boolean;
  iv: ReturnType<typeof parseIvRank>;
  dailyCandles: OptionsCandle[];
  fallbackPrice: number | null;
}): MarketMapIntelligence["expectedMove"] {
  const ordered = [...args.dailyCandles].sort((left, right) => left.timestamp - right.timestamp);
  const completed = ordered.filter((candle) => {
    const date = new Date(candle.timestamp).toISOString().slice(0, 10);
    return args.marketOpen ? date < args.sessionDate : date <= args.sessionDate;
  });
  const anchorCandle = completed.at(-1) ?? null;
  const anchorPrice = anchorCandle?.close ?? args.fallbackPrice;
  if (anchorPrice === null || anchorPrice <= 0) return null;

  const annualizedIv = args.marketOpen
    ? args.iv.priorAtmIv
    : args.iv.atmIv ?? args.iv.priorAtmIv;
  const priorCandle = completed.at(-2) ?? null;
  const approximate = annualizedIv === null || annualizedIv <= 0;
  const movePercent = !approximate
    ? annualizedIv! / Math.sqrt(252)
    : priorCandle && priorCandle.close > 0
      ? (priorCandle.high - priorCandle.low) / (2 * priorCandle.close)
      : 0;
  if (!Number.isFinite(movePercent) || movePercent <= 0) return null;

  const moveDollars = anchorPrice * movePercent;
  return {
    method: approximate ? "PRIOR_REALIZED_RANGE" : "QD_PRIOR_IV_ONE_SIGMA",
    anchorPrice,
    anchorLabel: "LATEST_PRICE",
    annualizedIv: approximate ? movePercent * Math.sqrt(252) : annualizedIv!,
    movePercent,
    moveDollars,
    min: anchorPrice - moveDollars,
    max: anchorPrice + moveDollars,
    sourceExpiration: args.iv.expiration,
    approximate,
    exactMenthorQEquivalent: false,
  };
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

function deriveGammaLevels(gamma: ExposureSummary | null, spot: number | null) {
  if (!gamma || !gamma.strikes.length) {
    return { callWall: null, putWall: null, gammaHvl: null, gammaMagnet: null, gammaCenter: null, majorPositiveOi: null };
  }
  const relevant = spot === null
    ? gamma.strikes
    : gamma.strikes.filter((strike) => strike.strike >= spot * 0.97 && strike.strike <= spot * 1.03);
  if (!relevant.length) return { callWall: null, putWall: null, gammaHvl: null, gammaMagnet: null, gammaCenter: null, majorPositiveOi: null };
  const callWall = relevant.reduce((best, strike) => strike.call > best.call ? strike : best).strike;
  const putWall = relevant.reduce((best, strike) => Math.abs(strike.put) > Math.abs(best.put) ? strike : best).strike;
  const gammaMagnet = relevant.reduce((best, strike) => Math.abs(strike.net) > Math.abs(best.net) ? strike : best).strike;
  const hvlRows = gamma.strikes
    .filter((strike) => Number.isFinite(strike.net))
    .sort((left, right) => left.strike - right.strike);
  const smoothed = hvlRows.map((row, index) => {
    const from = Math.max(0, index - 1);
    const to = Math.min(hvlRows.length - 1, index + 1);
    let total = 0;
    for (let offset = from; offset <= to; offset += 1) total += hvlRows[offset].net;
    return { strike: row.strike, net: total / (to - from + 1) };
  });
  const slopes = smoothed.slice(1, -1).map((row, index) => {
    const left = smoothed[index];
    const right = smoothed[index + 2];
    return {
      strike: row.strike,
      slope: (right.net - left.net) / Math.max(right.strike - left.strike, 1e-9),
    };
  });
  const hvlCandidates = slopes.filter((row, index) => {
    if (index === 0 || index === slopes.length - 1) return false;
    if (spot !== null && Math.abs(row.strike - spot) / spot > 0.03) return false;
    const magnitude = Math.abs(row.slope);
    return magnitude >= Math.abs(slopes[index - 1].slope)
      && magnitude >= Math.abs(slopes[index + 1].slope);
  });
  const rankedHvlCandidates = (hvlCandidates.length ? hvlCandidates : slopes)
    .filter((row) => spot === null || Math.abs(row.strike - spot) / spot <= 0.03)
    .sort((left, right) => Math.abs(right.slope) - Math.abs(left.slope)
      || (spot === null ? 0 : Math.abs(left.strike - spot) - Math.abs(right.strike - spot)));
  const gammaHvl = Math.abs(rankedHvlCandidates[0]?.slope ?? 0) > 0
    ? rankedHvlCandidates[0].strike
    : null;
  const totalWeight = relevant.reduce((sum, strike) => sum + Math.abs(strike.net), 0);
  const gammaCenter = totalWeight > 0
    ? relevant.reduce((sum, strike) => sum + strike.strike * Math.abs(strike.net), 0) / totalWeight
    : null;
  const positiveOiRows = gamma.strikes.filter((strike) => strike.net > 0);
  const majorPositiveOi = positiveOiRows.length
    ? positiveOiRows.reduce((best, strike) => strike.net > best.net ? strike : best)
    : null;
  return { callWall, putWall, gammaHvl, gammaMagnet, gammaCenter, majorPositiveOi };
}

/**
 * Estimate the current-session volume GEX profile using the same volume/OI
 * scaling used by GEX Desk. Consolidated flow can contain several prints for
 * one contract, while `volume` and `openInterest` are contract snapshots, so
 * only the largest observed snapshot is retained before rolling up by strike.
 */
function deriveSessionVolumeGamma(
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
  expectedMove: MarketMapIntelligence["expectedMove"] = null,
  delta: ExposureSummary | null = null,
  sessionVolumeGamma: ExposureSummary | null = null,
): ChartGammaSourceLevel[] {
  const key = deriveGammaLevels(gamma, spot);
  const majorPositiveVolume = majorPositiveGamma(sessionVolumeGamma);
  const lowerBound = expectedMove?.min ?? spot * 0.97;
  const upperBound = expectedMove?.max ?? spot * 1.03;
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
      label: "Call wall",
      price: key.callWall,
      value: strikeMetric(gamma, key.callWall, "call"),
      rank: 1,
    },
    key.putWall === null ? null : {
      id: "put-wall",
      kind: "PUT_WALL",
      label: "Put wall",
      price: key.putWall,
      value: strikeMetric(gamma, key.putWall, "put"),
      rank: 1,
    },
    key.gammaHvl === null ? null : {
      id: "hvl",
      kind: "HIGH_VOL_LEVEL",
      label: "HVL",
      price: key.gammaHvl,
      value: null,
      rank: 1,
    },
    key.gammaMagnet === null ? null : {
      id: "gamma-magnet",
      kind: "GAMMA_MAGNET",
      label: "Gamma magnet",
      price: key.gammaMagnet,
      value: strikeMetric(gamma, key.gammaMagnet, "net"),
      rank: 1,
    },
    key.gammaCenter === null ? null : {
      id: "gamma-centre",
      kind: "GAMMA_CENTRE",
      label: "GEX centre",
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
    expectedMove === null ? null : {
      id: "expected-move-max",
      kind: "EXPECTED_MOVE_MAX",
      label: "1D Max",
      price: expectedMove.max,
      value: expectedMove.movePercent,
      rank: 1,
    },
    expectedMove === null ? null : {
      id: "expected-move-min",
      kind: "EXPECTED_MOVE_MIN",
      label: "1D Min",
      price: expectedMove.min,
      value: -expectedMove.movePercent,
      rank: 1,
    },
    ...rankedGex.map((row, index) => ({
      id: `gex-${index + 1}`,
      kind: row.net > 0 ? "POSITIVE_GEX" as const : "NEGATIVE_GEX" as const,
      label: `GEX ${index + 1}`,
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
  expectedMove: MarketMapIntelligence["expectedMove"] = null,
  delta: ExposureSummary | null = null,
  flowPayload: unknown = null,
): ChartGammaSourceSnapshot | null {
  const gamma = parseExposure(payload, symbol, "GAMMA");
  const stockPrice = readStockPrice(payload, symbol);
  if (!gamma || stockPrice === null || stockPrice <= 0) return null;
  const sessionVolumeGamma = deriveSessionVolumeGamma(gamma, parseFlow(flowPayload));
  const levels = chartGammaSourceLevels(gamma, stockPrice, expectedMove, delta, sessionVolumeGamma);
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
  expectedMove: MarketMapIntelligence["expectedMove"];
  gexClusters: ReturnType<typeof deriveGexClusters>;
}) {
  const sessionMajorPositive = majorPositiveGamma(args.sessionVolumeGamma);
  const rows: Array<OptionsKeyLevel | null> = [
    args.fullLevels.callWall === null ? null : {
      id: "call-wall",
      kind: "CALL_WALL",
      label: "Call wall",
      price: args.fullLevels.callWall,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.callWall, "call"),
      rank: 1,
      derived: true,
      explanation: "Strike with the largest positive call gamma exposure across all expirations.",
    },
    args.fullLevels.putWall === null ? null : {
      id: "put-wall",
      kind: "PUT_WALL",
      label: "Put wall",
      price: args.fullLevels.putWall,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.putWall, "put"),
      rank: 1,
      derived: true,
      explanation: "Strike with the largest absolute put gamma exposure across all expirations.",
    },
    args.fullLevels.gammaHvl === null ? null : {
      id: "hvl",
      kind: "HIGH_VOL_LEVEL",
      label: "HVL",
      price: args.fullLevels.gammaHvl,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.gammaHvl, "net"),
      rank: 1,
      derived: true,
      explanation: "High Volatility Level: the strongest nearby inflection or steepest transition in the smoothed gamma-exposure profile. It is separate from the scenario-repriced Zero Gamma crossing.",
    },
    args.fullLevels.gammaMagnet === null ? null : {
      id: "gamma-magnet",
      kind: "GAMMA_MAGNET",
      label: "Gamma magnet",
      price: args.fullLevels.gammaMagnet,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: strikeMetric(args.gamma, args.fullLevels.gammaMagnet, "net"),
      rank: 1,
      derived: true,
      explanation: "Strike with the largest absolute net gamma concentration.",
    },
    args.fullLevels.gammaCenter === null ? null : {
      id: "gamma-centre",
      kind: "GAMMA_CENTRE",
      label: "GEX centre",
      price: args.fullLevels.gammaCenter,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: null,
      rank: 1,
      derived: true,
      explanation: "Absolute-net-GEX weighted average strike across the full chain.",
    },
    args.fullLevels.majorPositiveOi === null ? null : {
      id: "major-positive-oi",
      kind: "MAJOR_POSITIVE_OI",
      label: "MPO",
      price: args.fullLevels.majorPositiveOi.strike,
      scope: "FULL_CHAIN",
      metric: "GEX",
      value: args.fullLevels.majorPositiveOi.net,
      rank: 1,
      derived: true,
      explanation: "Major Positive Open Interest: the strike with the largest positive net gamma exposure in the open-interest structure.",
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
    args.expectedMove === null ? null : {
      id: "expected-move-max",
      kind: "EXPECTED_MOVE_MAX",
      label: "1D Max",
      price: args.expectedMove.max,
      scope: "SESSION",
      metric: "EXPECTED_MOVE_1SIGMA",
      value: args.expectedMove.movePercent,
      rank: 1,
      derived: true,
      explanation: args.expectedMove.approximate
        ? "Approximate 1D maximum from the prior realized range because prior-session KwantData IV was unavailable."
        : "One-sigma 1D maximum from prior-session KwantData 30-day ATM IV divided by sqrt(365), anchored to the session open.",
    },
    args.expectedMove === null ? null : {
      id: "expected-move-min",
      kind: "EXPECTED_MOVE_MIN",
      label: "1D Min",
      price: args.expectedMove.min,
      scope: "SESSION",
      metric: "EXPECTED_MOVE_1SIGMA",
      value: -args.expectedMove.movePercent,
      rank: 1,
      derived: true,
      explanation: args.expectedMove.approximate
        ? "Approximate 1D minimum from the prior realized range because prior-session KwantData IV was unavailable."
        : "One-sigma 1D minimum from prior-session KwantData 30-day ATM IV divided by sqrt(365), anchored to the session open.",
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
      explanation: "Largest absolute net GEX strike for the same-day expiration only.",
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

async function buildOptionsFlowPayload(symbol: string, requestedPriceMode: OptionsPriceMode): Promise<OptionsFlowPayload> {
  const session = getUsOptionsSession();
  const sessionScope = { sessionDate: session.sessionDate };
  const dailyRange = {
    startTime: `${offsetIsoDate(session.sessionDate, -60)}T00:00:00Z`,
    endTime: `${offsetIsoDate(session.sessionDate, 1)}T23:59:59Z`,
  };
  const exposureModes: GreekMode[] = ["GAMMA", "DELTA", "VANNA", "CHARM"];
  const exposureRequests = exposureModes.map((greekMode) =>
    quantDataPost("/options/tool/exposure-by-strike", {
      ...sessionScope,
      greekMode,
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol },
    }, greekMode === "GAMMA" ? 4_000 : greekMode === "DELTA" ? 15_000 : 60_000),
  );

  const requests = await Promise.allSettled([
    ...exposureRequests,
    quantDataPost("/options/tool/exposure-by-strike", {
      ...sessionScope,
      greekMode: "GAMMA",
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 4_000),
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol },
    }, 60_000),
    quantDataPost("/options/tool/open-interest-by-strike", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 60_000),
    quantDataPost("/options/tool/max-pain", {
      sessionDate: session.sessionDate,
      filter: { ticker: symbol, expirationDate: session.sessionDate },
    }, 60_000),
    quantDataPost("/options/tool/order-flow/consolidated", {
      ...sessionScope,
      filter: { ticker: symbol },
      size: 36,
      sort: { field: "tradeTime", direction: "DESCENDING" },
    }, 4_000),
    quantDataPost("/options/tool/gainers-losers", {
      ...sessionScope,
      filter: { tickers: OPTIONS_FLOW_TICKERS },
    }, 60_000),
    quantDataPost("/options/tool/net-drift", {
      ...sessionScope,
      aggregationPeriod: "5m",
      filter: { ticker: symbol },
    }, 5_000),
    quantDataPost("/options/tool/iv-rank", {
      filter: { ticker: symbol },
      lookBackPeriod: 252,
      maturity: 30,
    }, 300_000),
    quantDataPost("/equities/tool/stock-price-over-time", {
      ...sessionScope,
      aggregationPeriod: "1m",
      filter: { ticker: symbol },
    }, 1_000),
    quantDataPost("/options/tool/contract-statistics", {
      ...sessionScope,
      filter: { ticker: symbol },
    }, 30_000),
    quantDataPost("/equities/tool/stock-price-over-time", {
      timeRange: dailyRange,
      aggregationPeriod: "1d",
      filter: { ticker: symbol },
    }, 300_000),
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
  const fullLevels = deriveGammaLevels(gamma, stockPrice);
  const sessionVolumeGamma = deriveSessionVolumeGamma(gamma, flow);
  const zeroDteLevels = deriveGammaLevels(zeroDteGamma, stockPrice);
  const frontExpiration = gamma?.expiries[0]?.expiration ?? null;
  const strikeRange = stockPrice === null ? null : {
    min: Math.floor(stockPrice * 0.93 * 100) / 100,
    max: Math.ceil(stockPrice * 1.07 * 100) / 100,
  };
  const positioningRequests = frontExpiration ? await Promise.allSettled([
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
  const gexClusters = deriveGexClusters(gamma, exposures.DELTA, stockPrice);
  const keyLevels = createKeyLevels({
    gamma,
    sessionVolumeGamma,
    zeroDteGamma,
    zeroDteMaxPain,
    fullLevels,
    zeroDteLevels,
    putSupport: putSupportRows,
    zeroDtePutSupport: zeroDtePutSupportRows,
    expectedMove,
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
    asOf: new Date().toISOString(),
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    session,
    stockPrice,
    stockPriceAsOf,
    environment: {
      ...gammaEnvironment,
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
    filter: { ticker: symbol },
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

export async function getGexMapPanel(
  symbolInput: string,
  greekModeInput: GreekMode,
  requestedSessionDate?: string,
): Promise<GexMapPanelPayload> {
  const symbol = symbolInput.trim().toUpperCase();
  const currentSession = getUsOptionsSession();
  const sessionDate = requestedSessionDate || currentSession.sessionDate;
  const historical = sessionDate !== currentSession.sessionDate;
  const endpointTtl = historical ? 300_000 : 5_000;

  const [exposureResult, candleResult] = await Promise.all([
    quantDataPost("/options/tool/exposure-by-strike", {
      sessionDate,
      greekMode: greekModeInput,
      representationMode: "PER_ONE_PERCENT_MOVE",
      filter: { ticker: symbol },
    }, endpointTtl),
    quantDataPost("/equities/tool/stock-price-over-time", {
      sessionDate,
      aggregationPeriod: "1m",
      filter: { ticker: symbol },
    }, historical ? 300_000 : 2_000),
  ]);

  const fullExposure = parseExposure(exposureResult.payload, symbol, greekModeInput);
  const expiration = fullExposure?.expiries
    .map((row) => row.expiration)
    .filter((value) => value >= sessionDate)
    .sort()[0] ?? fullExposure?.expiries[0]?.expiration ?? null;
  if (!expiration) {
    throw new QuantDataError(`No ${greekModeInput} exposure is available for ${symbol} on ${sessionDate}.`, 422, exposureResult.remaining);
  }

  const frontExposure = parseExposure(exposureResult.payload, symbol, greekModeInput, expiration);
  const intervalResult = await quantDataPost("/options/tool/interval-map", {
    sessionDate,
    aggregationPeriod: "1m",
    greekMode: greekModeInput,
    filter: {
      ticker: symbol,
      expirationDate: expiration,
    },
  }, endpointTtl);
  const frames = parseGexMapFrames(intervalResult.payload, expiration);
  const candles = parseCandles(candleResult.payload, true);
  const latestCandle = candles.at(-1) ?? null;
  const firstCandle = candles[0] ?? null;
  const stockPrice = readStockPrice(exposureResult.payload, symbol) ?? latestCandle?.close ?? null;
  const sessionChangePercent = firstCandle && stockPrice !== null && firstCandle.open > 0
    ? stockPrice / firstCandle.open - 1
    : null;
  const frameAsOf = Math.max(frames.at(-1)?.timestamp ?? 0, latestCandle?.timestamp ?? 0) || Date.now();
  const marketIsLive = !historical && currentSession.marketOpen;
  const stale = marketIsLive && Date.now() - frameAsOf > 3 * 60_000;
  const latestStrikes = frontExposure?.strikes ?? [];

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
): Promise<GexDeskHistoryPayload> {
  const requestedSource = sourceInput.trim().toUpperCase();
  const source: "COMBINED" | GexDeskSourceSymbol = requestedSource === "NDX" || requestedSource === "QQQ"
    ? requestedSource
    : "COMBINED";
  const symbols: GexDeskSourceSymbol[] = source === "COMBINED" ? ["NDX", "QQQ"] : [source];
  const session = getUsOptionsSession();
  const start = `${session.sessionDate}T00:00:00.000Z`;
  const end = new Date().toISOString();
  const [panelResults, nqResult] = await Promise.all([
    Promise.allSettled(symbols.map((symbol) => getGexMapPanel(symbol, "GAMMA", session.sessionDate))),
    getDatabentoBars("NQ.v.0", "1m", start, end),
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
  if (!nqResult.length) {
    throw new QuantDataError("NQ history is unavailable for timestamp-aligned gamma mapping.", 422, null);
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

  const latestNq = nqResult.at(-1)?.close ?? null;
  if (!latestNq) {
    throw new QuantDataError("NQ history does not contain a valid reference price.", 422, null);
  }
  const bucketSize = Math.max(10, Math.round((latestNq * 0.0007) / 5) * 5);
  const priceLow = Math.floor((latestNq * 0.965) / bucketSize) * bucketSize;
  const priceHigh = Math.ceil((latestNq * 1.035) / bucketSize) * bucketSize;
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
  const nqPrices: number[] = [];

  for (const timestamp of sampledTimestamps) {
    const nqBar = latestAtOrBefore(nqResult, timestamp);
    nqPrices.push(nqBar?.close ?? latestNq);
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
      mappingChecks += 1;
      if (!nqBar || !sourceBar || timestamp - nqBar.timestamp > 3 * 60_000 || timestamp - sourceBar.timestamp > 3 * 60_000) {
        continue;
      }
      mappingMatches += 1;
      for (const strike of state.strikes.values()) {
        const mapped = nqBar.close * strike.strike / sourceBar.close;
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
      : session.marketOpen
        ? "LIVE"
        : "LAST_SESSION";
  return {
    instrument: "NQ",
    source,
    sessionDate: session.sessionDate,
    expiration: panels.map(({ panel }) => panel.expiration).filter(Boolean).join(" / ") || null,
    asOf: new Date(Math.max(...sampledTimestamps)).toISOString(),
    status,
    bucketSize,
    priceLow,
    priceHigh,
    timestamps: sampledTimestamps,
    nqPrices,
    rows,
    mappingCoverage: mappingChecks > 0 ? mappingMatches / mappingChecks : 0,
    errors,
    disclosure: "Intraday gamma exposure mapped with timestamp-aligned source and NQ prices. Change shows each bucket versus its prior sampled frame.",
  };
}

export async function getOptionsFlowPayload(symbolInput: string, priceModeInput: string = "CASH") {
  const symbol = symbolInput.trim().toUpperCase();
  const priceMode: OptionsPriceMode = priceModeInput.trim().toUpperCase() === "FUTURES" ? "FUTURES" : "CASH";
  const session = getUsOptionsSession();
  const cacheKey = `${symbol}:${priceMode}`;
  const cached = requestCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (session.marketOpen
    ? buildOptionsFlowPayload(symbol, priceMode)
    : unstable_cache(
      () => buildOptionsFlowPayload(symbol, priceMode),
      ["completed-new-york-options-flow-v1", symbol, priceMode, session.sessionDate],
      { revalidate: 6 * 60 * 60 },
    )()
  ).catch((error) => {
    requestCache.delete(cacheKey);
    throw error;
  });
  requestCache.set(cacheKey, {
    expiresAt: Date.now() + (session.marketOpen ? CACHE_TTL_MS : 5 * 60_000),
    promise,
  });
  return promise;
}

export async function getChartGammaLevels(
  rootInput: string,
  sourceInput: string,
): Promise<ChartGammaLevelsPayload> {
  const root = rootInput.trim().toUpperCase();
  if (root !== "NQ" && root !== "ES") {
    throw new QuantDataError("Gamma Levels currently supports NQ and ES only.", 400, null);
  }
  const compatibleSymbols = root === "NQ"
    ? (["NDX", "QQQ"] as const)
    : (["SPX", "SPY"] as const);
  const requestedSource = sourceInput.trim().toUpperCase();
  // NATIVE futures-options gamma (Databento): the source IS the futures root (NQ/ES).
  // NDX/QQQ/SPX/SPY keep the KwantData cash-conversion path below.
  if (requestedSource === root) {
    return buildNativeChartGamma(root as NativeGammaRoot);
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
  const session = getUsOptionsSession();
  const symbol = symbols[0];
  const dailyRange = {
    startTime: `${offsetIsoDate(session.sessionDate, -60)}T00:00:00Z`,
    endTime: `${offsetIsoDate(session.sessionDate, 1)}T23:59:59Z`,
  };
  const [exposureResult, deltaResult, flowResult, ivResult, dailyResult] = await Promise.allSettled([
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
    quantDataPost("/options/tool/iv-rank", {
      filter: { ticker: symbol },
      lookBackPeriod: 252,
      maturity: 30,
    }, 300_000),
    quantDataPost("/equities/tool/stock-price-over-time", {
      timeRange: dailyRange,
      aggregationPeriod: "1d",
      filter: { ticker: symbol },
    }, 300_000),
  ]);
  const exposurePayload = exposureResult.status === "fulfilled" ? exposureResult.value.payload : null;
  const parsedGamma = parseExposure(exposurePayload, symbol, "GAMMA");
  const parsedDelta = parseExposure(
    deltaResult.status === "fulfilled" ? deltaResult.value.payload : null,
    symbol,
    "DELTA",
  );
  const stockPrice = readStockPrice(exposurePayload, symbol);
  const iv = parseIvRank(ivResult.status === "fulfilled" ? ivResult.value.payload : null, session.sessionDate);
  const dailyCandles = parseCandles(dailyResult.status === "fulfilled" ? dailyResult.value.payload : null);
  const expectedMove = chartSessionExpectedMove({
    sessionDate: session.sessionDate,
    marketOpen: session.marketOpen,
    iv,
    dailyCandles,
    fallbackPrice: stockPrice,
  });
  const parsedSource = chartGammaSourceSnapshot(
    symbol,
    exposurePayload,
    expectedMove,
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

  const environment = classifyGammaEnvironment(parsedGamma?.net ?? null, parsedGamma?.gross ?? null);
  const revision = JSON.stringify(sources.map((source) => [source.symbol, source.revision]));

  return {
    root,
    requestedSource: symbol,
    checkedAt: new Date().toISOString(),
    refreshAfterMs: session.marketOpen ? 5_000 : 60_000,
    marketOpen: session.marketOpen,
    snapshotMode: session.marketOpen ? "LIVE" : "NEW_YORK_EOD",
    sessionDate: session.sessionDate,
    environment,
    revision,
    sources,
    dataOrigin: "CASH_INDEX",
  };
}

/** Current US options session date (YYYY-MM-DD) — used by the gamma warming cron. */
export function getUsOptionsSessionDate(): string {
  return getUsOptionsSession().sessionDate;
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

async function buildNativeChartGamma(root: NativeGammaRoot): Promise<ChartGammaLevelsPayload> {
  try {
    const session = getUsOptionsSession();
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
      levels: snap.levels,
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
      return await getCashCalibratedChartGammaLevels(root);
    } catch {
      throw nativeError;
    }
  }
}

export async function getCashCalibratedChartGammaLevels(
  root: NativeGammaRoot,
  sourceInput?: string,
): Promise<ChartGammaLevelsPayload> {
  const defaultSource = root === "NQ" ? "QQQ" : "SPY";
  const normalizedSource = (sourceInput || defaultSource).trim().toUpperCase();
  const compatibleSources = root === "NQ" ? new Set(["NDX", "QQQ"]) : new Set(["SPX", "SPY"]);
  if (!compatibleSources.has(normalizedSource)) {
    throw new QuantDataError(`${normalizedSource || "The requested source"} cannot be calibrated to ${root}.`, 400, null);
  }
  const calibrationSource = normalizedSource as ChartGammaSourceSnapshot["symbol"];
  const cashPayload = await getChartGammaLevels(root, calibrationSource);
  const cashSource = cashPayload.sources.find((source) => source.symbol === calibrationSource);
  if (!cashSource || !cashSource.levels.length || !Number.isFinite(cashSource.stockPrice) || cashSource.stockPrice <= 0) {
    throw new QuantDataError(`No ${calibrationSource} gamma snapshot is available to calibrate ${root}.`, 422, null);
  }

  const futuresPrice = cashPayload.marketOpen
    ? await getNativeFuturesSpot(root)
    : await getNativeFuturesSessionClose(root, cashPayload.sessionDate)
      ?? await getNativeFuturesSpot(root);
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
    levels: mergeGammaLevelsAtSamePrice(cashSource.levels.map((level) => ({
      ...level,
      id: `calibrated-${calibrationSource.toLowerCase()}-${level.id}`,
      price: toFuturesPrice(level.price),
    })), 0.25),
  };

  return {
    ...cashPayload,
    requestedSource: root,
    revision,
    sources: [calibratedSource],
    dataOrigin: "CASH_CALIBRATED_FALLBACK",
    calibrationSource,
    levelPriceScale: scale,
  };
}

export function getQuantDataHttpError(error: unknown) {
  if (error instanceof QuantDataError) {
    return { status: error.status, message: error.message, remaining: error.remaining };
  }
  return { status: 500, message: "Options Flow could not be loaded.", remaining: null };
}
