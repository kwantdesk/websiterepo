import type { Candle } from "./backtester.ts";
import { isEventBasedChartInterval } from "./chartIntervals.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";

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
const MAX_FLOW_BUCKETS_PER_SERIES = 30_000;
const MAX_EXACT_EXECUTIONS_PER_SERIES = 25_000;
// Browser persistence is only a warm-start cache. The VPS remains the source
// of truth, so allowing every visited symbol/timeframe to accumulate forever
// wastes storage and can make Chrome retain hundreds of megabytes for the
// site. Keep the newest working sets and evict older series globally.
const MAX_PERSISTENT_CACHE_BYTES = 48 * 1024 * 1024;
const MAX_PERSISTENT_CACHE_RECORDS = 36;
const CACHE_PRUNE_INTERVAL_MS = 60_000;
const memoryCache = new Map<string, CachedHistory>();
const executionTapeMemoryCache = new Map<string, CachedExecutionTape>();
let databasePromise: Promise<IDBDatabase> | null = null;
let lastCachePruneAt = 0;
let cachePrunePromise: Promise<void> | null = null;

function cacheKey(symbol: string, timeframe: string) {
  // Event-bar schema v6 stores one authoritative reconstruction instead of
  // merging successive rebuilds whose sequence timestamps can differ. Keep
  // the earlier overlapping event caches isolated from corrected charts.
  return isEventBasedChartInterval(timeframe)
    ? `event-v6::${symbol}::${timeframe}`
    // Time-flow v2 replaces the old six-hour-only aggressor enrichment. Keep
    // the partial cache isolated so returning browsers cannot restore a CVD
    // line that begins in the middle of the visible chart.
    : `time-v2::${symbol}::${timeframe}`;
}

function executionTapeCacheKey(symbol: string, timeframe: string) {
  // Tape v2 keeps compact historical flow separately from exact executions.
  // Post-halt subscription snapshots are retained in the raw tape for audit,
  // then rejected by the event-bar execution boundary during enrichment.
  // Ignore older tail-only records, otherwise a returning browser can restore
  // the broken cache and make CVD appear only on the newest candle again.
  return `tape-v2::${symbol}::${timeframe}`;
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
    // metadata. Keeping them makes Big Blocks/CVD available on the first
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

    // A fast OHLC/volume refresh and the slower aggressor-flow enrichment are
    // deliberately loaded on separate clocks. Never let the fast base candle
    // erase bid/ask metadata that is already persisted for the same event bar;
    // doing so forced CVD to redownload seven days of trades after an ordinary
    // chart refresh. New flow values still win whenever they are present.
    const existing = byTimestamp.get(timestamp);
    if (existing) {
      flowKeys.forEach((key) => {
        if (
          !Number.isFinite(Number(normalized[key]))
          && Number.isFinite(Number(existing[key]))
        ) {
          normalized[key] = existing[key];
        }
      });
    }
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
  const ordered = [...byId.values()]
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  // A global tail slice lets a dense exact-print tape evict every compact
  // historical CVD bucket. Preserve independent capacity for the two record
  // classes, matching the in-memory merger used by the chart workspace.
  const flow = ordered
    .filter((record) => record.flowOnly)
    .slice(-MAX_FLOW_BUCKETS_PER_SERIES);
  const exact = ordered
    .filter((record) => !record.flowOnly)
    .slice(-MAX_EXACT_EXECUTIONS_PER_SERIES);
  return [...flow, ...exact]
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
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

function estimatedRecordBytes(record: CachedHistory | CachedExecutionTape) {
  // Conservative structural estimates avoid serialising very large arrays on
  // the UI thread merely to decide which old cache entry should be removed.
  if ("candles" in record) return 512 + record.candles.length * 240;
  return 512 + record.records.length * 280;
}

export async function pruneChartHistoryCache(force = false) {
  const now = Date.now();
  if (!force && now - lastCachePruneAt < CACHE_PRUNE_INTERVAL_MS) return;
  if (cachePrunePromise) return cachePrunePromise;
  lastCachePruneAt = now;

  cachePrunePromise = (async () => {
    try {
      const database = await openDatabase();
      const records = await new Promise<Array<CachedHistory | CachedExecutionTape>>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(
          (request.result as Array<CachedHistory | CachedExecutionTape> | undefined) ?? [],
        );
        request.onerror = () => reject(request.error ?? new Error("Unable to inspect market cache."));
      });

      const newestFirst = records.sort((left, right) =>
        Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0));
      let retainedBytes = 0;
      const keysToDelete: string[] = [];
      newestFirst.forEach((record, index) => {
        const bytes = estimatedRecordBytes(record);
        if (
          index >= MAX_PERSISTENT_CACHE_RECORDS
          || (retainedBytes > 0 && retainedBytes + bytes > MAX_PERSISTENT_CACHE_BYTES)
        ) {
          keysToDelete.push(record.key);
          return;
        }
        retainedBytes += bytes;
      });
      if (!keysToDelete.length) return;

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        keysToDelete.forEach((key) => store.delete(key));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Unable to prune market cache."));
      });
      keysToDelete.forEach((key) => {
        memoryCache.delete(key);
        executionTapeMemoryCache.delete(key);
      });
    } catch {
      // Cache maintenance must never interrupt chart rendering.
    }
  })().finally(() => {
    cachePrunePromise = null;
  });
  return cachePrunePromise;
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
  const normalizedCandles = mergeAuthoritativeChartHistory(
    previous?.candles ?? [],
    candles,
    timeframe,
  );
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
    void pruneChartHistoryCache();
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
    void pruneChartHistoryCache();
  } catch {
    // Memory cache still prevents duplicate downloads during this session.
  }
  return record;
}

export function mergeChartHistory(cached: Candle[], incoming: Candle[]) {
  return normalizeCandles([...cached, ...incoming]);
}

/**
 * Clock candles have stable bucket timestamps and may be safely merged.
 * Event candles do not: rebuilding the same execution window from a different
 * start boundary can shift every sequence timestamp. Treat a complete event
 * response as authoritative or old and new bars are rendered side-by-side.
 */
export function mergeAuthoritativeChartHistory(
  cached: Candle[],
  incoming: Candle[],
  timeframe: string,
) {
  return isEventBasedChartInterval(timeframe)
    ? normalizeCandles(incoming)
    : normalizeCandles([...cached, ...incoming]);
}
