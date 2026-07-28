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
