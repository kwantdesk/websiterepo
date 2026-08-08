import type { Candle } from "@/lib/backtester";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

type CachedHistory = {
  key: string;
  symbol: string;
  timeframe: string;
  candles: Candle[];
  updatedAt: number;
};

type CachedExecutionTape = {
  key: string;
  symbol: string;
  timeframe: string;
  records: InstitutionalTrade[];
  updatedAt: number;
  kind: "execution-tape";
};

const DATABASE_NAME = "kwantdesk-market-data";
const DATABASE_VERSION = 1;
const STORE_NAME = "cme-history";
const MAX_CACHE_AGE_MS = 12 * 24 * 60 * 60_000;
const MAX_CANDLES_PER_SERIES = 120_000;
// Historical Big Trades is a time-distributed, server-compacted tape. Retain
// enough of it to cover the loaded chart instead of silently reducing it to
// only the most recent minutes.
const MAX_EXECUTIONS_PER_SERIES = 50_000;
const memoryCache = new Map<string, CachedHistory>();
const executionTapeMemoryCache = new Map<string, CachedExecutionTape>();
let databasePromise: Promise<IDBDatabase> | null = null;

function cacheKey(symbol: string, timeframe: string) {
  // Event-bar schema v3 rejects discontinuity staircases and requires a full
  // five-session backfill. Keep earlier partial event caches isolated so they
  // cannot make a newly selected range/volume chart start at the current tick.
  return isEventBasedChartInterval(timeframe)
    ? `event-v3::${symbol}::${timeframe}`
    : `${symbol}::${timeframe}`;
}

function executionTapeCacheKey(symbol: string, timeframe: string) {
  return `tape::${symbol}::${timeframe}`;
}

function timeframeDurationMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  const unitMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  };
  return value * unitMs[match[2]];
}

function normalizeCandles(candles: Candle[]) {
  const byTimestamp = new Map<number, Candle>();
  const cutoff = Date.now() - MAX_CACHE_AGE_MS;

  for (const candle of candles) {
    const timestamp = Number(candle.timestamp);
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);
    if (
      !Number.isFinite(timestamp)
      || timestamp < cutoff
      || ![open, high, low, close].every((value) => Number.isFinite(value) && value > 0)
    ) {
      continue;
    }
    const normalized: Candle = {
      timestamp,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
      volume: Number.isFinite(Number(candle.volume)) ? Number(candle.volume) : undefined,
    };
    // Order-flow fields are part of chart history, not disposable rendering
    // metadata. Keeping them makes KWANT Effort/CVD available on the first
    // paint instead of forcing a fresh execution download after every reload.
    const flowKeys = [
      "trades",
      "bidVolume",
      "askVolume",
      "bidTrades",
      "askTrades",
      "delta",
      "deltaOpen",
      "deltaHigh",
      "deltaLow",
      "deltaClose",
    ] as const;
    flowKeys.forEach((key) => {
      const value = Number(candle[key]);
      if (Number.isFinite(value)) normalized[key] = value;
    });
    byTimestamp.set(timestamp, normalized);
  }

  return [...byTimestamp.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_CANDLES_PER_SERIES);
}

function normalizeExecutionTape(records: InstitutionalTrade[]) {
  const byId = new Map<string, InstitutionalTrade>();
  records.forEach((record, index) => {
    const timestamp = Number(record.timestamp);
    const close = Number(record.close);
    const volume = Number(record.volume);
    if (
      !Number.isFinite(timestamp)
      || !Number.isFinite(close)
      || !Number.isFinite(volume)
      || timestamp <= 0
      || close <= 0
      || volume <= 0
    ) return;
    const normalized: InstitutionalTrade = {
      ...record,
      eventId: record.eventId ? String(record.eventId) : undefined,
      recordIndex: Number.isFinite(Number(record.recordIndex)) ? Number(record.recordIndex) : index,
      timestamp,
      open: Number.isFinite(Number(record.open)) ? Number(record.open) : close,
      high: Number.isFinite(Number(record.high)) ? Number(record.high) : close,
      low: Number.isFinite(Number(record.low)) ? Number(record.low) : close,
      close,
      trades: Math.max(1, Number(record.trades) || 1),
      volume,
      bidVolume: Math.max(0, Number(record.bidVolume) || 0),
      askVolume: Math.max(0, Number(record.askVolume) || 0),
      delta: Number.isFinite(Number(record.delta))
        ? Number(record.delta)
        : Number(record.askVolume ?? 0) - Number(record.bidVolume ?? 0),
      aggressor: record.aggressor === "BUY" || record.aggressor === "SELL"
        ? record.aggressor
        : "UNKNOWN",
      sideSemanticsVersion: Number(record.sideSemanticsVersion ?? 2),
    };
    const key = normalized.eventId
      || `${normalized.timestamp}:${normalized.recordIndex}:${normalized.close}:${normalized.volume}`;
    byId.set(key, normalized);
  });
  return [...byId.values()]
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex)
    .slice(-MAX_EXECUTIONS_PER_SERIES);
}

function resampleCandles(candles: Candle[], timeframe: string) {
  const durationMs = timeframeDurationMs(timeframe);
  if (!durationMs) return [];

  const buckets = new Map<number, Candle>();
  for (const candle of normalizeCandles(candles)) {
    const timestamp = Math.floor(candle.timestamp / durationMs) * durationMs;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...candle, timestamp });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume = Number(existing.volume ?? 0) + Number(candle.volume ?? 0);
    existing.trades = Number(existing.trades ?? 0) + Number(candle.trades ?? 0);
    existing.bidVolume = Number(existing.bidVolume ?? 0) + Number(candle.bidVolume ?? 0);
    existing.askVolume = Number(existing.askVolume ?? 0) + Number(candle.askVolume ?? 0);
    existing.bidTrades = Number(existing.bidTrades ?? 0) + Number(candle.bidTrades ?? 0);
    existing.askTrades = Number(existing.askTrades ?? 0) + Number(candle.askTrades ?? 0);
    const previousDelta = Number(existing.delta ?? 0);
    const candleDelta = Number(candle.delta ?? candle.deltaClose ?? 0);
    existing.delta = previousDelta + candleDelta;
    existing.deltaOpen = 0;
    existing.deltaHigh = Math.max(
      Number(existing.deltaHigh ?? previousDelta),
      previousDelta + Number(candle.deltaHigh ?? candleDelta),
    );
    existing.deltaLow = Math.min(
      Number(existing.deltaLow ?? previousDelta),
      previousDelta + Number(candle.deltaLow ?? candleDelta),
    );
    existing.deltaClose = existing.delta;
  }
  return [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function openDatabase() {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the market cache."));
  });

  return databasePromise;
}

export async function readChartHistoryCache(symbol: string, timeframe: string) {
  const key = cacheKey(symbol, timeframe);
  const memoryRecord = memoryCache.get(key);
  if (memoryRecord) return memoryRecord;

  try {
    const database = await openDatabase();
    const record = await new Promise<CachedHistory | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CachedHistory | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached market data."));
    });
    if (!record) return null;
    const normalized = { ...record, candles: normalizeCandles(record.candles ?? []) };
    if (!normalized.candles.length) return null;
    memoryCache.set(key, normalized);
    return normalized;
  } catch {
    return memoryRecord ?? null;
  }
}

async function readAllCachedHistory() {
  const records = new Map<string, CachedHistory>(memoryCache);
  try {
    const database = await openDatabase();
    const storedRecords = await new Promise<Array<CachedHistory | CachedExecutionTape>>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(
        (request.result as Array<CachedHistory | CachedExecutionTape> | undefined) ?? [],
      );
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached market data."));
    });
    for (const record of storedRecords) {
      if ("candles" in record && Array.isArray(record.candles)) {
        records.set(record.key, record);
      }
    }
  } catch {
    // The in-memory records can still supply a compatible timeframe.
  }
  return [...records.values()];
}

function buildCompatibleRecord(
  records: CachedHistory[],
  symbol: string,
  timeframe: string,
) {
  const targetDuration = timeframeDurationMs(timeframe);
  if (!targetDuration) return null;

  const candidates = records
    .filter((record) => record.symbol === symbol)
    .map((record) => ({
      record,
      duration: timeframeDurationMs(record.timeframe),
    }))
    .filter((candidate): candidate is { record: CachedHistory; duration: number } =>
      candidate.duration !== null
      && candidate.duration <= targetDuration
      && targetDuration % candidate.duration === 0
      && candidate.record.candles.length > 0)
    .sort((left, right) =>
      (left.record.candles[0]?.timestamp ?? Number.POSITIVE_INFINITY)
      - (right.record.candles[0]?.timestamp ?? Number.POSITIVE_INFINITY)
      || left.duration - right.duration
      || right.record.updatedAt - left.record.updatedAt);

  const source = candidates[0]?.record;
  if (!source) return null;
  const candles = resampleCandles(source.candles, timeframe);
  if (!candles.length) return null;

  return {
    key: cacheKey(symbol, timeframe),
    symbol,
    timeframe,
    candles,
    updatedAt: source.updatedAt,
  } satisfies CachedHistory;
}

/**
 * Synchronous first-paint lookup. Once a series has been read or prewarmed,
 * timeframe switches can paint it in the same render instead of flashing a
 * loading surface while IndexedDB is opened again.
 */
export function peekCompatibleChartHistoryCache(symbol: string, timeframe: string) {
  const exact = memoryCache.get(cacheKey(symbol, timeframe));
  if (exact?.candles.length) return exact;

  const compatible = buildCompatibleRecord([...memoryCache.values()], symbol, timeframe);
  if (compatible) memoryCache.set(compatible.key, compatible);
  return compatible;
}

/**
 * Returns exact history when available, otherwise builds a larger time-based
 * interval from the finest compatible series already stored for this symbol.
 * Event-based charts deliberately require their own trades and are never
 * fabricated from OHLC candles.
 */
export async function readCompatibleChartHistoryCache(symbol: string, timeframe: string) {
  const memoryRecord = peekCompatibleChartHistoryCache(symbol, timeframe);
  if (memoryRecord?.candles.length) return memoryRecord;

  const exact = await readChartHistoryCache(symbol, timeframe);
  if (exact?.candles.length) return exact;

  const record = buildCompatibleRecord(await readAllCachedHistory(), symbol, timeframe);
  if (!record) return null;
  memoryCache.set(record.key, record);
  return record;
}

export async function writeChartHistoryCache(symbol: string, timeframe: string, candles: Candle[]) {
  const key = cacheKey(symbol, timeframe);
  const previous = await readChartHistoryCache(symbol, timeframe);
  const normalizedCandles = normalizeCandles([...(previous?.candles ?? []), ...candles]);
  if (!normalizedCandles.length) return null;

  const record: CachedHistory = {
    key,
    symbol,
    timeframe,
    candles: normalizedCandles,
    updatedAt: Date.now(),
  };
  memoryCache.set(key, record);

  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to save market data."));
    });
  } catch {
    // The in-memory cache still keeps the chart stable for this browser session.
  }

  return record;
}

export function peekExecutionTapeCache(symbol: string, timeframe: string) {
  return executionTapeMemoryCache.get(executionTapeCacheKey(symbol, timeframe)) ?? null;
}

export async function readExecutionTapeCache(symbol: string, timeframe: string) {
  const key = executionTapeCacheKey(symbol, timeframe);
  const memoryRecord = executionTapeMemoryCache.get(key);
  if (memoryRecord?.records.length) return memoryRecord;
  try {
    const database = await openDatabase();
    const record = await new Promise<CachedExecutionTape | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CachedExecutionTape | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached executions."));
    });
    if (!record || record.kind !== "execution-tape") return null;
    const normalized = { ...record, records: normalizeExecutionTape(record.records ?? []) };
    if (!normalized.records.length) return null;
    executionTapeMemoryCache.set(key, normalized);
    return normalized;
  } catch {
    return memoryRecord ?? null;
  }
}

export async function writeExecutionTapeCache(
  symbol: string,
  timeframe: string,
  records: InstitutionalTrade[],
) {
  const key = executionTapeCacheKey(symbol, timeframe);
  const previous = await readExecutionTapeCache(symbol, timeframe);
  const normalizedRecords = normalizeExecutionTape([...(previous?.records ?? []), ...records]);
  if (!normalizedRecords.length) return null;
  const record: CachedExecutionTape = {
    key,
    symbol,
    timeframe,
    records: normalizedRecords,
    updatedAt: Date.now(),
    kind: "execution-tape",
  };
  executionTapeMemoryCache.set(key, record);
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache executions."));
    });
  } catch {
    // Memory cache still prevents duplicate downloads during this session.
  }
  return record;
}

export function mergeChartHistory(cached: Candle[], incoming: Candle[]) {
  return normalizeCandles([...cached, ...incoming]);
}
