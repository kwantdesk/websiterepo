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
const MAX_MEMORY_HISTORY_RECORDS = 12;
const MAX_MEMORY_EXECUTION_RECORDS = 6;
const MAX_WRITE_FINGERPRINTS = 48;
const memoryCache = new Map<string, CachedHistory>();
const executionTapeMemoryCache = new Map<string, CachedExecutionTape>();
const lastWriteFingerprintByKey = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | null = null;
let lastCachePruneAt = 0;
let cachePrunePromise: Promise<void> | null = null;

function storeBounded<K, V>(map: Map<K, V>, key: K, value: V, limit: number) {
  // Map insertion order gives us a tiny allocation-free LRU. Refresh an
  // existing key so actively used series survive while abandoned workspace
  // panes release their large arrays.
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) {
    const oldest = map.keys().next().value as K | undefined;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function rememberWriteFingerprint(key: string, fingerprint: string) {
  storeBounded(lastWriteFingerprintByKey, key, fingerprint, MAX_WRITE_FINGERPRINTS);
}

function candleFingerprint(candles: Candle[]) {
  const first = candles[0];
  const last = candles.at(-1);
  if (!first || !last) return "empty";
  return [
    candles.length,
    first.timestamp,
    last.timestamp,
    last.open,
    last.high,
    last.low,
    last.close,
    last.volume ?? 0,
  ].join(":");
}

function executionFingerprint(records: InstitutionalTrade[]) {
  const first = records[0];
  const last = records.at(-1);
  if (!first || !last) return "empty";
  return [
    records.length,
    first.timestamp,
    last.timestamp,
    last.close,
    last.volume ?? 0,
    last.delta ?? 0,
    last.trades ?? 0,
  ].join(":");
}

function cacheKey(symbol: string, timeframe: string) {
  // Event-bar schema v7 is built from the ordered native execution tape and
  // carries source watermarks into live continuation. Keep v6's approximate
  // one-second reconstructions isolated so returning browsers cannot restore
  // the malformed volume/range/Renko history this pipeline replaces.
  return isEventBasedChartInterval(timeframe)
    ? `event-v7::${symbol}::${timeframe}`
    // Time-flow v2 replaces the old six-hour-only aggressor enrichment. Keep
    // the partial cache isolated so returning browsers cannot restore a CVD
    // line that begins in the middle of the visible chart.
    : `time-v2::${symbol}::${timeframe}`;
}

function executionTapeCacheKey(symbol: string, _timeframe: string) {
  // Execution prints are contract-level data, not timeframe-level data. Tape
  // v3 deliberately shares one warm cache across 1m, 5m and Footprint panes,
  // avoiding several identical 25k-55k arrays in IndexedDB and browser RAM.
  // Tape v2 kept compact historical flow separately from exact executions.
  // Post-halt subscription snapshots are retained in the raw tape for audit,
  // then rejected by the event-bar execution boundary during enrichment.
  // Ignore older tail-only records, otherwise a returning browser can restore
  // the broken cache and make CVD appear only on the newest candle again.
  return `tape-v3::${symbol}`;
}

function legacyExecutionTapeCacheKey(symbol: string, timeframe: string) {
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
    const sourceStartTimestamp = Number(candle.sourceStartTimestamp);
    const sourceEndTimestamp = Number(candle.sourceEndTimestamp);
    if (Number.isFinite(sourceStartTimestamp)) {
      normalized.sourceStartTimestamp = sourceStartTimestamp;
    }
    if (Number.isFinite(sourceEndTimestamp)) {
      normalized.sourceEndTimestamp = sourceEndTimestamp;
    }

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
      if (
        !Number.isFinite(Number(normalized.sourceStartTimestamp))
        && Number.isFinite(Number(existing.sourceStartTimestamp))
      ) normalized.sourceStartTimestamp = existing.sourceStartTimestamp;
      if (
        !Number.isFinite(Number(normalized.sourceEndTimestamp))
        && Number.isFinite(Number(existing.sourceEndTimestamp))
      ) normalized.sourceEndTimestamp = existing.sourceEndTimestamp;
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
      const records = await new Promise<Array<{ key: string; updatedAt: number; bytes: number }>>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).openCursor();
        const metadata: Array<{ key: string; updatedAt: number; bytes: number }> = [];
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve(metadata);
            return;
          }
          const record = cursor.value as CachedHistory | CachedExecutionTape;
          metadata.push({
            key: record.key,
            updatedAt: Number(record.updatedAt ?? 0),
            bytes: estimatedRecordBytes(record),
          });
          // Do not retain the candle/execution arrays. getAll() previously
          // cloned the entire ~48MB cache into one JS array during live use.
          cursor.continue();
        };
        request.onerror = () => reject(request.error ?? new Error("Unable to inspect market cache."));
      });

      const newestFirst = records.sort((left, right) =>
        Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0));
      let retainedBytes = 0;
      const keysToDelete: string[] = [];
      newestFirst.forEach((record, index) => {
        const bytes = record.bytes;
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
    storeBounded(memoryCache, key, normalized, MAX_MEMORY_HISTORY_RECORDS);
    return normalized;
  } catch {
    return memoryRecord ?? null;
  }
}

async function readAllCachedHistory(symbol: string) {
  const records = new Map<string, CachedHistory>(
    [...memoryCache].filter(([, record]) => record.symbol === symbol),
  );
  try {
    const database = await openDatabase();
    const storedKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached market data."));
    });
    const matchingKeys = storedKeys
      .map(String)
      .filter((key) => (
        key.startsWith(`time-v2::${symbol}::`)
        || key.startsWith(`event-v7::${symbol}::`)
      ));
    // Read only this symbol's candle series, sequentially. The former getAll
    // path also cloned every execution tape and every unrelated symbol merely
    // to resample one chart timeframe.
    for (const key of matchingKeys) {
      const record = await new Promise<CachedHistory | null>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(key);
        request.onsuccess = () => resolve((request.result as CachedHistory | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("Unable to read cached market data."));
      });
      if (record && Array.isArray(record.candles)) records.set(record.key, record);
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
  if (compatible) storeBounded(memoryCache, compatible.key, compatible, MAX_MEMORY_HISTORY_RECORDS);
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

  const record = buildCompatibleRecord(await readAllCachedHistory(symbol), symbol, timeframe);
  if (!record) return null;
  storeBounded(memoryCache, record.key, record, MAX_MEMORY_HISTORY_RECORDS);
  return record;
}

export async function writeChartHistoryCache(symbol: string, timeframe: string, candles: Candle[]) {
  const key = cacheKey(symbol, timeframe);
  const writeKey = `candles:${key}`;
  const inputFingerprint = candleFingerprint(candles);
  if (lastWriteFingerprintByKey.get(writeKey) === inputFingerprint) {
    const existing = memoryCache.get(key);
    if (existing) return existing;
  }
  // Claim this snapshot before any IndexedDB await. Sibling panes commonly
  // flush the same shared series together; only the first should serialize it.
  rememberWriteFingerprint(writeKey, inputFingerprint);
  const previous = await readChartHistoryCache(symbol, timeframe);
  if (previous && candleFingerprint(previous.candles) === inputFingerprint) {
    return previous;
  }
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
  storeBounded(memoryCache, key, record, MAX_MEMORY_HISTORY_RECORDS);

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
    let record = await new Promise<CachedExecutionTape | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CachedExecutionTape | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read cached executions."));
    });
    // One-release migration keeps an existing warm tape useful, then the next
    // write stores it under the shared v3 key. Old per-timeframe entries are
    // naturally removed by the bounded persistent-cache pruner.
    if (!record) {
      record = await new Promise<CachedExecutionTape | null>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readonly");
        const request = transaction.objectStore(STORE_NAME).get(
          legacyExecutionTapeCacheKey(symbol, timeframe),
        );
        request.onsuccess = () => resolve((request.result as CachedExecutionTape | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("Unable to read cached executions."));
      });
    }
    if (!record || record.kind !== "execution-tape") return null;
    const normalized = {
      ...record,
      key,
      symbol,
      records: normalizeExecutionTape(record.records ?? []),
    };
    if (!normalized.records.length) return null;
    storeBounded(executionTapeMemoryCache, key, normalized, MAX_MEMORY_EXECUTION_RECORDS);
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
  const writeKey = `executions:${key}`;
  const inputFingerprint = executionFingerprint(records);
  if (lastWriteFingerprintByKey.get(writeKey) === inputFingerprint) {
    const existing = executionTapeMemoryCache.get(key);
    if (existing) return existing;
  }
  rememberWriteFingerprint(writeKey, inputFingerprint);
  const previous = await readExecutionTapeCache(symbol, timeframe);
  if (previous && executionFingerprint(previous.records) === inputFingerprint) {
    return previous;
  }
  const incoming = normalizeExecutionTape(records);
  const previousRecords = previous?.records ?? [];
  const incomingContainsPrevious = Boolean(
    previousRecords.length
    && incoming.length >= previousRecords.length
    && incoming[0].timestamp <= previousRecords[0].timestamp
    && incoming.at(-1)!.timestamp >= previousRecords.at(-1)!.timestamp
  );
  // Workspace callers provide the complete canonical tape. Do not append the
  // stored copy to that complete array again; doing so briefly doubled tens of
  // thousands of records per pane during every persistence cycle.
  const normalizedRecords = incomingContainsPrevious
    ? incoming
    : normalizeExecutionTape([...previousRecords, ...incoming]);
  if (!normalizedRecords.length) return null;
  const record: CachedExecutionTape = {
    key,
    symbol,
    timeframe,
    records: normalizedRecords,
    updatedAt: Date.now(),
    kind: "execution-tape",
  };
  storeBounded(executionTapeMemoryCache, key, record, MAX_MEMORY_EXECUTION_RECORDS);
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
