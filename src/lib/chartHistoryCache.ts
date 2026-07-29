import type { Candle } from "@/lib/backtester";

type CachedHistory = {
  key: string;
  symbol: string;
  timeframe: string;
  candles: Candle[];
  updatedAt: number;
};

const DATABASE_NAME = "kwantdesk-market-data";
const DATABASE_VERSION = 1;
const STORE_NAME = "cme-history";
const MAX_CACHE_AGE_MS = 12 * 24 * 60 * 60_000;
const MAX_CANDLES_PER_SERIES = 120_000;
const memoryCache = new Map<string, CachedHistory>();
let databasePromise: Promise<IDBDatabase> | null = null;

function cacheKey(symbol: string, timeframe: string) {
  return `${symbol}::${timeframe}`;
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
    byTimestamp.set(timestamp, {
      timestamp,
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
      volume: Number.isFinite(Number(candle.volume)) ? Number(candle.volume) : undefined,
    });
  }

  return [...byTimestamp.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_CANDLES_PER_SERIES);
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
    const storedRecords = await new Promise<CachedHistory[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as CachedHistory[] | undefined) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached market data."));
    });
    for (const record of storedRecords) {
      records.set(record.key, record);
    }
  } catch {
    // The in-memory records can still supply a compatible timeframe.
  }
  return [...records.values()];
}

/**
 * Returns exact history when available, otherwise builds a larger time-based
 * interval from the finest compatible series already stored for this symbol.
 * Event-based charts deliberately require their own trades and are never
 * fabricated from OHLC candles.
 */
export async function readCompatibleChartHistoryCache(symbol: string, timeframe: string) {
  const exact = await readChartHistoryCache(symbol, timeframe);
  if (exact?.candles.length) return exact;

  const targetDuration = timeframeDurationMs(timeframe);
  if (!targetDuration) return null;

  const candidates = (await readAllCachedHistory())
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

  const record: CachedHistory = {
    key: cacheKey(symbol, timeframe),
    symbol,
    timeframe,
    candles,
    updatedAt: source.updatedAt,
  };
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

export function mergeChartHistory(cached: Candle[], incoming: Candle[]) {
  return normalizeCandles([...cached, ...incoming]);
}
