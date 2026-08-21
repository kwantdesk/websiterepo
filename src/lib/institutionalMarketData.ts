import type { Candle } from "@/lib/backtester";
import { cmeEventTailCutoffMs, cmeSessionDateKey } from "@/lib/chartHistoryWindow";
import {
  calculateVolumeProfileValueArea,
  STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  volumeProfileBinTick,
} from "@/lib/volumeProfileMath";

type JsonRecord = Record<string, unknown>;

export type InstitutionalInstrument = {
  root: string;
  contractSymbol: string;
  displayName: string;
  exchange: "CME" | "CBOT" | "COMEX" | "NYMEX";
  contractLabel: string;
  contractMonth: number;
  contractYear: number;
  asOf: string | null;
  lastPrice: number | null;
  ageMs: number | null;
  status: "LIVE" | "STALE" | "NOT_OPEN";
  isPrimary: boolean;
};

export type InstitutionalSnapshot = {
  root: string;
  contractSymbol: string;
  displayName: string;
  exchange: InstitutionalInstrument["exchange"];
  contractLabel: string;
  asOf: string;
  asOfMs: number;
  lastPrice: number;
  bid: number | null;
  ask: number | null;
  tickSize: number | null;
  orderFlowAvailable: boolean;
  status: InstitutionalInstrument["status"];
  ageMs: number;
  recordCount: number;
  candles: Candle[];
};

export type InstitutionalTrade = {
  eventId?: string;
  recordIndex: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  trades: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  aggressor: "BUY" | "SELL" | "UNKNOWN";
  sideSemanticsVersion?: number;
  // Historical CVD buckets preserve signed flow but are not individual
  // prints. Execution-marker studies must not present them as block trades.
  flowOnly?: boolean;
};

export type InstitutionalVolumeProfileLevel = {
  price: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  trades: number;
};

export type InstitutionalVolumeProfile = {
  schemaVersion: "kwantify-volume-profile-v1";
  provider: "Databento" | "Rithmic" | "Chart";
  source: string;
  root: string;
  contractSymbol: string;
  period: "daily" | "weekly" | "custom";
  tradingDate?: string | null;
  /**
   * Which session window this profile covers, when the study is splitting a
   * day rather than profiling all of it. Several profiles then share one
   * trading date — Asia, London and New York — so consumers must key on the
   * pair, never on the date alone.
   */
  sessionId?: string;
  sessionLabel?: string;
  startMs: number;
  endMs: number;
  coverageStartMs?: number | null;
  coverageEndMs?: number | null;
  tickSize: number;
  groupTicks: number;
  valueAreaPercent: number;
  minTradeVolume: number;
  maxTradeVolume: number;
  totalVolume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  trades: number;
  poc: number | null;
  vah: number | null;
  val: number | null;
  vwap: number | null;
  standardDeviation: number;
  levels: InstitutionalVolumeProfileLevel[];
  developingPoc: Array<{ timestamp: number; price: number }>;
  asOf: string;
};

// Candle-backed profiles are the honest primary for feeds that can never
// have an execution tape (cash indices / options underlyings): they are built
// from real provider bar volume, carry a neutral buy/sell split, and must
// never masquerade as execution data. They are only accepted through this
// explicit guard, never through isExecutionBackedVolumeProfile.
export function isCandleBackedVolumeProfile(
  profile: InstitutionalVolumeProfile | null | undefined,
): profile is InstitutionalVolumeProfile {
  if (!profile || profile.schemaVersion !== "kwantify-volume-profile-v1") return false;
  if (profile.provider !== "Chart") return false;
  return Array.isArray(profile.levels) && profile.levels.length > 0;
}

export function isExecutionBackedVolumeProfile(
  profile: InstitutionalVolumeProfile | null | undefined,
): profile is InstitutionalVolumeProfile {
  if (!profile || profile.schemaVersion !== "kwantify-volume-profile-v1") return false;
  if (profile.provider !== "Databento" && profile.provider !== "Rithmic") return false;
  // Defensive provenance guard for old browser caches and older gateway
  // builds that may have labelled an OHLCV reconstruction as a native
  // profile. Those rows must never flash before the execution tape arrives.
  if (/\b(?:OHLCV|APPROX(?:IMATION|IMATE)?)\b/i.test(profile.source ?? "")) return false;
  return Array.isArray(profile.levels) && profile.levels.length > 0;
}

const volumeProfileResponseCache = new Map<string, {
  profile: InstitutionalVolumeProfile;
  storedAt: number;
}>();
const volumeProfileRequests = new Map<string, Promise<InstitutionalVolumeProfile | null>>();
const VOLUME_PROFILE_RESPONSE_CACHE_MS = 10_000;
// Each profile holds a full per-tick level array; cap the in-memory response
// cache so distinct sessions/symbols cannot accumulate for the tab lifetime.
const VOLUME_PROFILE_RESPONSE_CACHE_MAX = 16;
const INDICATOR_CACHE_NAME = "kwantify-indicator-data-v3";
const INDICATOR_IDB_NAME = "kwantify-indicator-data-v3";
const INDICATOR_IDB_STORE = "entries";
const INDICATOR_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

function indicatorCacheRequest(key: string) {
  if (typeof window === "undefined") return null;
  return new Request(
    `${window.location.origin}/__kwantify_indicator_cache__/${encodeURIComponent(key)}`,
  );
}

type PersistentIndicatorEntry<T = unknown> = {
  key: string;
  storedAt: number;
  value: T;
};

function openIndicatorDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(INDICATOR_IDB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(INDICATOR_IDB_STORE)) {
          request.result.createObjectStore(INDICATOR_IDB_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readIndicatorDatabaseEntry<T>(
  key: string,
  maxAgeMs: number,
): Promise<T | null> {
  const database = await openIndicatorDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(INDICATOR_IDB_STORE, "readwrite");
      const store = transaction.objectStore(INDICATOR_IDB_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as PersistentIndicatorEntry<T> | undefined;
        if (
          !entry
          || !Number.isFinite(entry.storedAt)
          || Date.now() - entry.storedAt > maxAgeMs
        ) {
          if (entry) store.delete(key);
          resolve(null);
          return;
        }
        resolve(entry.value ?? null);
      };
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
      transaction.onabort = () => database.close();
    } catch {
      database.close();
      resolve(null);
    }
  });
}

async function readIndicatorDatabasePrefix<T>(prefix: string): Promise<T[]> {
  const database = await openIndicatorDatabase();
  if (!database) return [];
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(INDICATOR_IDB_STORE, "readwrite");
      const store = transaction.objectStore(INDICATOR_IDB_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        const now = Date.now();
        const values: T[] = [];
        for (const entry of request.result as PersistentIndicatorEntry<T>[]) {
          if (!entry.key.startsWith(prefix)) continue;
          if (
            !Number.isFinite(entry.storedAt)
            || now - entry.storedAt > INDICATOR_CACHE_MAX_AGE_MS
          ) {
            store.delete(entry.key);
            continue;
          }
          if (entry.value !== null && entry.value !== undefined) values.push(entry.value);
        }
        resolve(values);
      };
      request.onerror = () => resolve([]);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
      transaction.onabort = () => database.close();
    } catch {
      database.close();
      resolve([]);
    }
  });
}

async function writeIndicatorDatabaseEntry<T>(key: string, value: T) {
  const database = await openIndicatorDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    try {
      const transaction = database.transaction(INDICATOR_IDB_STORE, "readwrite");
      transaction.objectStore(INDICATOR_IDB_STORE).put({
        key,
        storedAt: Date.now(),
        value,
      } satisfies PersistentIndicatorEntry<T>);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        resolve();
      };
      transaction.onabort = () => {
        database.close();
        resolve();
      };
    } catch {
      database.close();
      resolve();
    }
  });
}

async function readPersistentIndicatorCache<T>(
  key: string,
  maxAgeMs = INDICATOR_CACHE_MAX_AGE_MS,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  if ("caches" in window) {
    try {
      const request = indicatorCacheRequest(key);
      if (request) {
        const cache = await window.caches.open(INDICATOR_CACHE_NAME);
        const response = await cache.match(request);
        if (response) {
          const payload = await response.json() as { storedAt?: number; value?: T };
          if (
            !Number.isFinite(payload.storedAt)
            || Date.now() - Number(payload.storedAt) > maxAgeMs
          ) {
            await cache.delete(request);
          } else {
            return payload.value ?? null;
          }
        }
      }
    } catch {
      // Fall through to IndexedDB, which is supported by more embedded browsers.
    }
  }
  return readIndicatorDatabaseEntry<T>(key, maxAgeMs);
}

async function readPersistentIndicatorCachePrefix<T>(prefix: string): Promise<T[]> {
  if (typeof window === "undefined") return [];
  if ("caches" in window) {
    try {
      const cache = await window.caches.open(INDICATOR_CACHE_NAME);
      const requests = await cache.keys();
      const matches = requests.filter((request) => {
        const encodedKey = new URL(request.url).pathname.split("/").at(-1) ?? "";
        try {
          return decodeURIComponent(encodedKey).startsWith(prefix);
        } catch {
          return false;
        }
      });
      const values = await Promise.all(matches.map(async (request) => {
        const response = await cache.match(request);
        if (!response) return null;
        const payload = await response.json() as { storedAt?: number; value?: T };
        if (
          !Number.isFinite(payload.storedAt)
          || Date.now() - Number(payload.storedAt) > INDICATOR_CACHE_MAX_AGE_MS
        ) {
          await cache.delete(request);
          return null;
        }
        return payload.value ?? null;
      }));
      const cached = values.filter((value) => value !== null) as T[];
      if (cached.length > 0) return cached;
    } catch {
      // Fall through to IndexedDB, which is supported by more embedded browsers.
    }
  }
  return readIndicatorDatabasePrefix<T>(prefix);
}

async function writePersistentIndicatorCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  if ("caches" in window) {
    try {
      const request = indicatorCacheRequest(key);
      if (request) {
        const cache = await window.caches.open(INDICATOR_CACHE_NAME);
        await cache.put(request, new Response(JSON.stringify({
          storedAt: Date.now(),
          value,
        }), {
          headers: { "Content-Type": "application/json" },
        }));
        return;
      }
    } catch {
      // Fall through to IndexedDB, which is supported by more embedded browsers.
    }
  }
  await writeIndicatorDatabaseEntry(key, value);
}

export async function readCachedInstitutionalVolumeProfiles(
  symbol: string,
  period: InstitutionalVolumeProfile["period"],
) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const profiles = await readPersistentIndicatorCachePrefix<InstitutionalVolumeProfile>(
    "volume-profile:",
  );
  return profiles
    .filter((profile) => profile.root === normalizedSymbol && profile.period === period)
    .sort((left, right) => left.startMs - right.startMs);
}

export function buildChartVolumeProfile(args: {
  candles: Candle[];
  root: string;
  contractSymbol: string;
  startMs: number;
  endMs: number;
  tickSize: number;
  groupTicks?: number;
  valueAreaPercent?: number;
  minTradeVolume?: number;
  maxTradeVolume?: number;
}): InstitutionalVolumeProfile | null {
  const tickSize = Number(args.tickSize);
  const groupTicks = Math.max(1, Math.round(args.groupTicks ?? 1));
  const valueAreaPercent = STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT;
  const minTradeVolume = Math.max(0, Number(args.minTradeVolume ?? 0));
  const maxTradeVolume = Math.max(0, Number(args.maxTradeVolume ?? 0));
  if (
    !Number.isFinite(tickSize)
    || tickSize <= 0
    || !Number.isFinite(args.startMs)
    || !Number.isFinite(args.endMs)
    || args.endMs <= args.startMs
  ) return null;

  const rows = new Map<number, InstitutionalVolumeProfileLevel>();
  let totalVolume = 0;
  let bidVolume = 0;
  let askVolume = 0;
  let totalTrades = 0;
  let priceVolume = 0;
  let priceSquaredVolume = 0;

  for (const candle of args.candles) {
    if (candle.timestamp < args.startMs || candle.timestamp >= args.endMs) continue;
    const volume = Math.max(0, Number(candle.volume ?? 0));
    if (
      volume <= 0
      || volume < minTradeVolume
      || (maxTradeVolume > 0 && volume > maxTradeVolume)
    ) continue;

    const lowTick = Math.round(Math.min(candle.low, candle.high) / tickSize);
    const highTick = Math.round(Math.max(candle.low, candle.high) / tickSize);
    const firstBin = volumeProfileBinTick(lowTick, groupTicks);
    const lastBin = volumeProfileBinTick(highTick, groupTicks);
    const typicalTick = Math.round(((candle.high + candle.low + candle.close) / 3) / tickSize);
    const binTicks: number[] = [];
    const weights: number[] = [];
    const span = Math.max(groupTicks, lastBin - firstBin);
    for (let binTick = firstBin; binTick <= lastBin; binTick += groupTicks) {
      binTicks.push(binTick);
      // OHLCV does not reveal the exact within-bar execution distribution.
      // A bounded triangular allocation keeps the fallback stable and close to
      // the bar's typical traded price without inventing a single-price spike.
      weights.push(Math.max(0.15, 1 - Math.abs(binTick - typicalTick) / span));
    }
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const suppliedBid = Math.max(0, Number(candle.bidVolume ?? 0));
    const suppliedAsk = Math.max(0, Number(candle.askVolume ?? 0));
    const suppliedTotal = suppliedBid + suppliedAsk;
    const boundedDelta = Math.max(-volume, Math.min(volume, Number(candle.delta ?? 0)));
    // Without a supplied bid/ask split or a real delta there is no buy/sell
    // information in an OHLCV bar. The split stays neutral (delta 0) — candle
    // direction must never be dressed up as order-flow aggression.
    const inferredAskShare = suppliedTotal > 0
      ? suppliedAsk / suppliedTotal
      : candle.delta !== undefined
        ? (volume + boundedDelta) / (2 * volume)
        : 0.5;
    const candleTrades = Math.max(0, Number(candle.trades ?? 1));

    binTicks.forEach((binTick, index) => {
      const share = weights[index] / weightTotal;
      const rowVolume = volume * share;
      const rowAsk = rowVolume * inferredAskShare;
      const rowBid = rowVolume - rowAsk;
      const rowTrades = candleTrades * share;
      const price = Number((binTick * tickSize).toFixed(10));
      const current = rows.get(binTick) ?? {
        price,
        volume: 0,
        bidVolume: 0,
        askVolume: 0,
        delta: 0,
        trades: 0,
      };
      current.volume += rowVolume;
      current.bidVolume += rowBid;
      current.askVolume += rowAsk;
      current.delta = current.askVolume - current.bidVolume;
      current.trades += rowTrades;
      rows.set(binTick, current);
      totalVolume += rowVolume;
      bidVolume += rowBid;
      askVolume += rowAsk;
      totalTrades += rowTrades;
      priceVolume += price * rowVolume;
      priceSquaredVolume += price * price * rowVolume;
    });
  }

  const levels = [...rows.values()].sort((a, b) => a.price - b.price);
  if (!levels.length || totalVolume <= 0) return null;
  const valueArea = calculateVolumeProfileValueArea(
    levels,
    tickSize * groupTicks,
    valueAreaPercent,
  );
  const vwap = priceVolume / totalVolume;
  const variance = Math.max(0, priceSquaredVolume / totalVolume - vwap * vwap);
  return {
    schemaVersion: "kwantify-volume-profile-v1",
    provider: "Chart",
    source: "Candle volume · this feed has no execution tape",
    root: args.root,
    contractSymbol: args.contractSymbol,
    period: "custom",
    startMs: args.startMs,
    endMs: args.endMs,
    tickSize,
    groupTicks,
    valueAreaPercent,
    minTradeVolume,
    maxTradeVolume,
    totalVolume,
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    trades: totalTrades,
    poc: valueArea.poc,
    vah: valueArea.vah,
    val: valueArea.val,
    vwap,
    standardDeviation: Math.sqrt(variance),
    levels,
    developingPoc: [],
    asOf: new Date(Math.min(args.endMs - 1, Date.now())).toISOString(),
  };
}

export function clipVolumeProfileToPriceRange(
  profile: InstitutionalVolumeProfile,
  firstPrice: number,
  secondPrice: number,
): InstitutionalVolumeProfile | null {
  const low = Math.min(firstPrice, secondPrice);
  const high = Math.max(firstPrice, secondPrice);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return profile;
  const levels = profile.levels.filter((level) => level.price >= low && level.price <= high);
  if (!levels.length) return null;
  const totalVolume = levels.reduce((sum, level) => sum + level.volume, 0);
  if (totalVolume <= 0) return null;
  const bidVolume = levels.reduce((sum, level) => sum + level.bidVolume, 0);
  const askVolume = levels.reduce((sum, level) => sum + level.askVolume, 0);
  const trades = levels.reduce((sum, level) => sum + level.trades, 0);
  const priceVolume = levels.reduce((sum, level) => sum + level.price * level.volume, 0);
  const priceSquaredVolume = levels.reduce(
    (sum, level) => sum + level.price * level.price * level.volume,
    0,
  );
  const vwap = priceVolume / totalVolume;
  const variance = Math.max(0, priceSquaredVolume / totalVolume - vwap * vwap);
  const valueArea = calculateVolumeProfileValueArea(
    levels,
    profile.tickSize * profile.groupTicks,
    STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  );
  return {
    ...profile,
    valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    totalVolume,
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    trades,
    poc: valueArea.poc,
    vah: valueArea.vah,
    val: valueArea.val,
    vwap,
    standardDeviation: Math.sqrt(variance),
    levels,
  };
}

const LOCAL_GATEWAY_ORIGIN = "/api/institutional-market-data";
const ORDER_FLOW_CACHE_SCHEMA = "v6";
const orderFlowRecordCache = new Map<string, InstitutionalTrade[]>();
// Each entry is a fully-merged execution tape (~7-15 MB). Unbounded, this Map
// accumulated one permanent entry per symbol/timeframe visited and was the
// dominant "out of memory" driver across a long session. LRU-cap it.
const ORDER_FLOW_RECORD_CACHE_MAX = 6;
function setOrderFlowRecordCache(key: string, records: InstitutionalTrade[]) {
  if (orderFlowRecordCache.has(key)) orderFlowRecordCache.delete(key);
  orderFlowRecordCache.set(key, records);
  while (orderFlowRecordCache.size > ORDER_FLOW_RECORD_CACHE_MAX) {
    const oldest = orderFlowRecordCache.keys().next().value;
    if (oldest === undefined) break;
    orderFlowRecordCache.delete(oldest);
  }
}
const orderFlowCacheMergeQueue = new Map<
  string,
  Promise<InstitutionalOrderFlowResult>
>();

function orderFlowRecordCacheKey(symbol: string, timeframe: string, contractSymbol?: string) {
  const root = String(symbol || "").trim().toUpperCase();
  const contract = String(contractSymbol || "").trim().toUpperCase();
  return `${root}:${contract || "ROOT"}:${String(timeframe || "").trim()}`;
}

export function getCachedInstitutionalOrderFlowRecords(
  symbol: string,
  timeframe: string,
  contractSymbol?: string,
) {
  const key = orderFlowRecordCacheKey(symbol, timeframe, contractSymbol);
  const records = orderFlowRecordCache.get(key);
  if (records) {
    // Refresh recency so an actively-used tape is not evicted first.
    orderFlowRecordCache.delete(key);
    orderFlowRecordCache.set(key, records);
  }
  return records ?? [];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function timestampMs(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number !== null) return number < 10_000_000_000 ? number * 1000 : number;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeExchange(value: unknown): InstitutionalInstrument["exchange"] | null {
  const exchange = String(value || "").toUpperCase();
  return exchange === "CME" || exchange === "CBOT" || exchange === "COMEX" || exchange === "NYMEX"
    ? exchange
    : null;
}

export function futuresContractRoot(contractSymbol: string) {
  return String(contractSymbol || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/)?.[1] ?? null;
}

const INSTITUTIONAL_PARENT_ROOTS: Record<string, string> = {
  MNQ: "NQ",
  MES: "ES",
  MYM: "YM",
  M2K: "RTY",
  MGC: "GC",
  MCL: "CL",
};

function institutionalParentRoot(root: string | null) {
  const normalized = String(root || "").trim().toUpperCase();
  return INSTITUTIONAL_PARENT_ROOTS[normalized] || normalized;
}

function normalizeCandles(value: unknown, limit = 600): Candle[] {
  if (!Array.isArray(value)) return [];
  const candles = new Map<number, Candle>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const timestamp = timestampMs(item.timestamp ?? item.time);
    const open = finiteNumber(item.open);
    const high = finiteNumber(item.high);
    const low = finiteNumber(item.low);
    const close = finiteNumber(item.close);
    const volume = finiteNumber(item.volume) ?? 0;
    const trades = finiteNumber(item.trades) ?? 0;
    const bidVolume = finiteNumber(item.bidVolume) ?? 0;
    const askVolume = finiteNumber(item.askVolume) ?? 0;
    const bidTrades = finiteNumber(item.bidTrades);
    const askTrades = finiteNumber(item.askTrades);
    const delta = finiteNumber(item.delta) ?? askVolume - bidVolume;
    const deltaOpen = finiteNumber(item.deltaOpen);
    const deltaHigh = finiteNumber(item.deltaHigh);
    const deltaLow = finiteNumber(item.deltaLow);
    const deltaClose = finiteNumber(item.deltaClose);
    if (timestamp === null || open === null || high === null || low === null || close === null) continue;
    if (open <= 0 || low <= 0 || high < Math.max(open, close) || low > Math.min(open, close)) continue;
    candles.set(timestamp, {
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      trades,
      bidVolume,
      askVolume,
      ...(bidTrades !== null ? { bidTrades } : {}),
      ...(askTrades !== null ? { askTrades } : {}),
      delta,
      ...(deltaOpen !== null ? { deltaOpen } : {}),
      ...(deltaHigh !== null ? { deltaHigh } : {}),
      ...(deltaLow !== null ? { deltaLow } : {}),
      ...(deltaClose !== null ? { deltaClose } : {}),
    });
  }
  return [...candles.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-Math.max(1, limit));
}

export async function readCachedInstitutionalChartCandles(
  symbol: string,
  timeframe: string,
  period: string,
  contractSymbol?: string,
) {
  const cached = await readPersistentIndicatorCache<Candle[]>(
    `chart-candles:${orderFlowRecordCacheKey(symbol, timeframe, contractSymbol)}:${period}`,
    15 * 60_000,
  );
  return repairInstitutionalCandleSeries(normalizeCandles(cached, 500_000), timeframe, symbol);
}

export function cacheInstitutionalChartCandles(
  symbol: string,
  timeframe: string,
  period: string,
  candles: Candle[],
  contractSymbol?: string,
) {
  if (!candles.length) return;
  void writePersistentIndicatorCache(
    `chart-candles:${orderFlowRecordCacheKey(symbol, timeframe, contractSymbol)}:${period}`,
    repairInstitutionalCandleSeries(candles, timeframe, symbol).slice(-500_000),
  );
}

async function gatewayFetch(path: string, init?: RequestInit, timeoutMs = 4_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${LOCAL_GATEWAY_ORIGIN}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchInstitutionalInstruments(): Promise<InstitutionalInstrument[] | null> {
  try {
    const response = await gatewayFetch("/v1/market-data/instruments");
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || !Array.isArray(payload.instruments)) return null;
    return payload.instruments.flatMap((item) => {
      if (!isRecord(item)) return [];
      const root = String(item.root || "").toUpperCase();
      const contractSymbol = String(item.symbol || "").toUpperCase();
      const displayName = String(item.displayName || "").trim();
      const exchange = normalizeExchange(item.exchange);
      const contractMonth = finiteNumber(item.contractMonth);
      const contractYear = finiteNumber(item.contractYear);
      const asOfMs = timestampMs(item.asOf);
      const lastPrice = finiteNumber(item.lastPrice);
      const ageMs = finiteNumber(item.ageMs);
      const status = item.status === "LIVE" ? "LIVE" : item.status === "STALE" ? "STALE" : "NOT_OPEN";
      if (
        !root
        || !contractSymbol
        || futuresContractRoot(contractSymbol) !== root
        || !displayName
        || !exchange
        || contractMonth === null
        || contractYear === null
        || (status !== "NOT_OPEN" && (asOfMs === null || lastPrice === null || lastPrice <= 0))
      ) {
        return [];
      }
      return [{
        root,
        contractSymbol,
        displayName,
        exchange,
        contractLabel: String(item.contractLabel || "").trim(),
        contractMonth,
        contractYear,
        asOf: asOfMs === null ? null : new Date(asOfMs).toISOString(),
        lastPrice,
        ageMs: asOfMs === null ? null : Math.max(0, ageMs ?? Date.now() - asOfMs),
        status,
        isPrimary: item.isPrimary === true,
      } satisfies InstitutionalInstrument];
    });
  } catch {
    return null;
  }
}

export async function fetchInstitutionalSnapshot(args: {
  symbol: string;
  contractSymbol?: string;
  timeframe: string;
  lookbackBars?: number;
  timeoutMs?: number;
}): Promise<InstitutionalSnapshot | null> {
  try {
    const response = await gatewayFetch("/v1/market-data/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaVersion: "kwantify-market-data-v1",
        operation: "snapshot",
        root: args.symbol,
        symbol: args.symbol,
        contractSymbol: args.contractSymbol,
        interval: args.timeframe,
        lookbackBars: Math.min(100_000, Math.max(1, args.lookbackBars ?? 100_000)),
      }),
    }, args.timeoutMs ?? 180_000);
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      console.warn("Institutional chart snapshot returned an invalid response.", response.status);
      return null;
    }
    const root = String(payload.root || "").toUpperCase();
    const contractSymbol = String(payload.symbol || "").toUpperCase();
    const requestedRoot = String(args.symbol || "").trim().toUpperCase();
    const requestedContract = String(args.contractSymbol || "").trim().toUpperCase();
    const displayName = String(payload.displayName || "").trim();
    const exchange = normalizeExchange(payload.exchange);
    const asOfMs = timestampMs(payload.asOf);
    const lastPrice = finiteNumber(payload.lastPrice);
    const requestedParentRoot = institutionalParentRoot(requestedRoot);
    if (
      !root
      || institutionalParentRoot(root) !== requestedParentRoot
      || !contractSymbol
      || institutionalParentRoot(futuresContractRoot(contractSymbol)) !== requestedParentRoot
      || (requestedContract && contractSymbol !== requestedContract)
      || !displayName
      || !exchange
      || asOfMs === null
      || lastPrice === null
      || lastPrice <= 0
    ) {
      return null;
    }
    return {
      // The gateway intentionally serves micro charts from the price-identical
      // e-mini parent tape. Keep the user's requested root in chart state.
      root: requestedRoot,
      contractSymbol,
      displayName,
      exchange,
      contractLabel: String(payload.contractLabel || "").trim(),
      asOf: new Date(asOfMs).toISOString(),
      asOfMs,
      lastPrice,
      bid: finiteNumber(payload.bid),
      ask: finiteNumber(payload.ask),
      tickSize: finiteNumber(payload.tickSize),
      orderFlowAvailable: payload.orderFlowAvailable === true,
      status: payload.status === "LIVE" ? "LIVE" : payload.status === "STALE" ? "STALE" : "NOT_OPEN",
      ageMs: Math.max(0, finiteNumber(payload.ageMs) ?? Date.now() - asOfMs),
      recordCount: Math.max(0, Math.floor(finiteNumber(payload.recordCount) ?? 0)),
      candles: normalizeCandles(
        payload.candles ?? payload.bars,
        Math.min(100_000, Math.max(1, args.lookbackBars ?? 100_000)),
      ),
    };
  } catch (error) {
    console.warn("Institutional chart snapshot request failed.", error);
    return null;
  }
}

export async function fetchInstitutionalVolumeProfile(args: {
  symbol: string;
  contractSymbol?: string;
  period: InstitutionalVolumeProfile["period"];
  tradingDate?: string;
  startMs?: number;
  endMs?: number;
  groupTicks?: number;
  valueAreaPercent?: number;
  minTradeVolume?: number;
  maxTradeVolume?: number;
  /** Filter/Split Time. Defaults reproduce the unfiltered whole-session profile. */
  filterMode?: "none" | "filter" | "splitted" | "triple";
  filterTime?: "rth" | "eth" | "custom";
  sessionStartMinutes?: number;
  sessionEndMinutes?: number;
  useEndSessionAsStartDay?: boolean;
}): Promise<InstitutionalVolumeProfile | null> {
  const requestedValueArea = Number(args.valueAreaPercent);
  const query = new URLSearchParams({
    profileSchema: "2",
    symbol: args.symbol,
    period: args.period,
    groupTicks: String(Math.max(1, Math.round(args.groupTicks ?? 1))),
    // The trader's own % Value Area. This was previously pinned to the 70%
    // convention here as well as on the route, so the setting never arrived.
    valueAreaPercent: String(
      Number.isFinite(requestedValueArea) && requestedValueArea > 0
        ? Math.min(100, requestedValueArea)
        : STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    ),
    minTradeVolume: String(Math.max(0, args.minTradeVolume ?? 0)),
    maxTradeVolume: String(Math.max(0, args.maxTradeVolume ?? 0)),
    filterMode: args.filterMode ?? "none",
    filterTime: args.filterTime ?? "rth",
  });
  if (Number.isFinite(args.sessionStartMinutes)) {
    query.set("sessionStartMinutes", String(args.sessionStartMinutes));
  }
  if (Number.isFinite(args.sessionEndMinutes)) {
    query.set("sessionEndMinutes", String(args.sessionEndMinutes));
  }
  if (args.useEndSessionAsStartDay) query.set("useEndSessionAsStartDay", "true");
  if (args.contractSymbol) query.set("contractSymbol", args.contractSymbol);
  if (/^\d{4}-\d{2}-\d{2}$/.test(args.tradingDate ?? "")) query.set("tradingDate", args.tradingDate!);
  if (Number.isFinite(args.startMs)) query.set("startMs", String(args.startMs));
  if (Number.isFinite(args.endMs)) query.set("endMs", String(args.endMs));
  const cacheKey = query.toString();
  const cached = volumeProfileResponseCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt <= VOLUME_PROFILE_RESPONSE_CACHE_MS) {
    return cached.profile;
  }
  const pending = volumeProfileRequests.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(`${LOCAL_GATEWAY_ORIGIN}/v1/market-data/volume-profile?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        console.warn(
          `Exact volume profile request failed: HTTP ${response.status} · ${args.symbol}`
          + ` · ${args.contractSymbol ?? "continuous"} · ${args.period}`
          + ` · ${args.tradingDate ?? "current"}`,
        );
        return null;
      }
      const payload = await response.json() as InstitutionalVolumeProfile;
      if (
        payload.schemaVersion !== "kwantify-volume-profile-v1"
        || !Array.isArray(payload.levels)
        || payload.levels.length === 0
        || !Number.isFinite(payload.startMs)
        || payload.startMs <= 0
        || !Number.isFinite(payload.endMs)
        || payload.endMs <= payload.startMs
      ) {
        console.warn(
          `Exact volume profile response was incomplete: ${payload.provider ?? "unknown"}`
          + ` · ${args.symbol} · ${args.contractSymbol ?? "continuous"}`
          + ` · ${args.period} · ${args.tradingDate ?? "current"}`
          + ` · ${Array.isArray(payload.levels) ? payload.levels.length : 0} levels`,
        );
        return null;
      }
      const valueArea = calculateVolumeProfileValueArea(
        payload.levels,
        payload.tickSize * payload.groupTicks,
        STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
      );
      const normalizedPayload = {
        ...payload,
        valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
        poc: valueArea.poc,
        vah: valueArea.vah,
        val: valueArea.val,
      };
      if (volumeProfileResponseCache.has(cacheKey)) volumeProfileResponseCache.delete(cacheKey);
      volumeProfileResponseCache.set(cacheKey, { profile: normalizedPayload, storedAt: Date.now() });
      while (volumeProfileResponseCache.size > VOLUME_PROFILE_RESPONSE_CACHE_MAX) {
        const oldest = volumeProfileResponseCache.keys().next().value;
        if (oldest === undefined) break;
        volumeProfileResponseCache.delete(oldest);
      }
      void writePersistentIndicatorCache(`volume-profile:${cacheKey}`, normalizedPayload);
      return normalizedPayload;
    } catch (error) {
      console.warn(
        `Exact volume profile request could not complete: ${args.symbol}`
        + ` · ${args.contractSymbol ?? "continuous"} · ${args.period}`
        + ` · ${args.tradingDate ?? "current"}`
        + ` · ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      volumeProfileRequests.delete(cacheKey);
    }
  })();
  volumeProfileRequests.set(cacheKey, request);
  return request;
}

function cmeTradingWeekKey(timestamp: number) {
  const tradingDate = cmeSessionDateKey(timestamp);
  if (!tradingDate) return null;
  const monday = new Date(`${tradingDate}T00:00:00.000Z`);
  const weekday = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return monday.toISOString().slice(0, 10);
}

export function applyInstitutionalTradesToVolumeProfile(
  profile: InstitutionalVolumeProfile,
  records: InstitutionalTrade[],
): InstitutionalVolumeProfile {
  if (!records.length) return profile;
  // The server profile already includes every execution through its coverage
  // watermark. Rithmic's first batches overlap that window after a reconnect
  // or profile refresh; applying them again doubles volume and distorts the
  // rear delta profile. Fold in genuinely newer prints only.
  const coverageEndMs = Number.isFinite(profile.coverageEndMs)
    ? Number(profile.coverageEndMs)
    : profile.startMs - 1;
  const dailyTradingDate = profile.period === "daily"
    ? profile.tradingDate ?? cmeSessionDateKey(profile.startMs)
    : null;
  const weeklyTradingWeek = profile.period === "weekly"
    ? cmeTradingWeekKey(
      Number.isFinite(profile.coverageEndMs)
        ? Number(profile.coverageEndMs)
        : profile.endMs - 1,
    )
    : null;
  const eligibleRecords = records.filter((record) =>
    record.timestamp >= profile.startMs
    && (
      profile.period === "daily"
        ? dailyTradingDate !== null && cmeSessionDateKey(record.timestamp) === dailyTradingDate
        : profile.period === "weekly"
          ? weeklyTradingWeek !== null && cmeTradingWeekKey(record.timestamp) === weeklyTradingWeek
          : record.timestamp < profile.endMs
    )
    && record.timestamp > coverageEndMs
    && record.volume >= profile.minTradeVolume
    && (profile.maxTradeVolume <= 0 || record.volume <= profile.maxTradeVolume));
  if (!eligibleRecords.length) return profile;
  const levels = new Map(
    profile.levels.map((level) => [Math.round(level.price / profile.tickSize), { ...level }]),
  );
  let totalVolume = profile.totalVolume;
  let bidVolume = profile.bidVolume;
  let askVolume = profile.askVolume;
  let trades = profile.trades;
  let weightedPrice = (profile.vwap ?? 0) * profile.totalVolume;
  let weightedSquaredPrice = (
    profile.standardDeviation * profile.standardDeviation + (profile.vwap ?? 0) * (profile.vwap ?? 0)
  ) * profile.totalVolume;
  for (const record of eligibleRecords) {
    const groupedTick = volumeProfileBinTick(
      Math.round(record.close / profile.tickSize),
      profile.groupTicks,
    );
    const price = Number((groupedTick * profile.tickSize).toFixed(10));
    const current = levels.get(groupedTick) ?? {
      price,
      volume: 0,
      bidVolume: 0,
      askVolume: 0,
      delta: 0,
      trades: 0,
    };
    current.volume += record.volume;
    current.bidVolume += record.bidVolume;
    current.askVolume += record.askVolume;
    current.delta = current.askVolume - current.bidVolume;
    current.trades += record.trades;
    levels.set(groupedTick, current);
    totalVolume += record.volume;
    bidVolume += record.bidVolume;
    askVolume += record.askVolume;
    trades += record.trades;
    weightedPrice += record.close * record.volume;
    weightedSquaredPrice += record.close * record.close * record.volume;
  }
  const nextLevels = [...levels.values()].sort((a, b) => a.price - b.price);
  const valueArea = calculateVolumeProfileValueArea(
    nextLevels,
    profile.tickSize * profile.groupTicks,
    STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  );
  const nextVwap = totalVolume > 0 ? weightedPrice / totalVolume : null;
  const variance = totalVolume > 0 && nextVwap !== null
    ? Math.max(0, weightedSquaredPrice / totalVolume - nextVwap * nextVwap)
    : 0;
  const latestTimestamp = eligibleRecords.at(-1)?.timestamp ?? profile.endMs;
  const latestMinute = Math.floor(latestTimestamp / 60_000) * 60_000;
  const developingPoc = [...profile.developingPoc];
  if (valueArea.poc !== null) {
    if (developingPoc.at(-1)?.timestamp === latestMinute) developingPoc[developingPoc.length - 1] = { timestamp: latestMinute, price: valueArea.poc };
    else developingPoc.push({ timestamp: latestMinute, price: valueArea.poc });
  }
  return {
    ...profile,
    valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    asOf: new Date(latestTimestamp).toISOString(),
    // Active daily and weekly profiles grow from the Rithmic execution tape.
    // Their original endMs is the snapshot edge, not a boundary that should
    // make the profile wait for the next server refresh.
    endMs: profile.period === "daily" || profile.period === "weekly"
      ? Math.max(profile.endMs, latestTimestamp + 1)
      : profile.endMs,
    coverageEndMs: Math.max(coverageEndMs, latestTimestamp),
    totalVolume,
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    trades,
    vwap: nextVwap,
    standardDeviation: Math.sqrt(variance),
    poc: valueArea.poc,
    vah: valueArea.vah,
    val: valueArea.val,
    levels: nextLevels,
    developingPoc: developingPoc.slice(-2_000),
  };
}

function timeframeMilliseconds(timeframe: string) {
  const match = timeframe.trim().match(/^(\d+)(s|m|h|D|W)$/);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  const unit = match[2];
  if (unit === "s") return value * 1_000;
  if (unit === "m") return value * 60_000;
  if (unit === "h") return value * 60 * 60_000;
  if (unit === "D") return value * 24 * 60 * 60_000;
  return value * 7 * 24 * 60 * 60_000;
}

function futuresTickSize(symbol: string) {
  const root = symbol.toUpperCase();
  if (["MNQ", "NQ", "MES", "ES"].includes(root)) return 0.25;
  if (["MYM", "YM"].includes(root)) return 1;
  if (["M2K", "RTY"].includes(root)) return 0.1;
  if (["MGC", "GC"].includes(root)) return 0.1;
  if (["SIL", "SI"].includes(root)) return 0.005;
  if (["MCL", "CL"].includes(root)) return 0.01;
  return 0.01;
}

function eventThreshold(timeframe: string, symbol: string) {
  const match = timeframe.trim().match(/^(\d+)(r|v|t|dv)$/);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  return {
    kind: match[2],
    value: match[2] === "r" ? value * futuresTickSize(symbol) : value,
  };
}

export function supportsInstitutionalTradeAggregation(timeframe: string) {
  return timeframeMilliseconds(timeframe) !== null || /^(\d+)(r|v|t|dv)$/.test(timeframe.trim());
}

export function repairInstitutionalCandleSeries(
  candles: Candle[],
  timeframe: string,
  symbol: string,
) {
  const threshold = eventThreshold(timeframe, symbol);
  if (threshold?.kind !== "r") return candles;
  const maximumRange = threshold.value + futuresTickSize(symbol) * 0.5;
  return candles.map((candle) => {
    const range = candle.high - candle.low;
    const body = Math.abs(candle.close - candle.open);
    if (range <= maximumRange && body <= maximumRange) return candle;
    // A range bar must never bridge a session or contract discontinuity. Keep
    // the real execution price and its order-flow totals, but start a fresh bar
    // at that price instead of drawing a hundreds-of-points synthetic candle.
    return {
      ...candle,
      open: candle.close,
      high: candle.close,
      low: candle.close,
    };
  });
}

export function applyInstitutionalTradesToCandles(
  current: Candle[],
  records: InstitutionalTrade[],
  timeframe: string,
  symbol: string,
  limit = 600,
) {
  const bucketMs = timeframeMilliseconds(timeframe);
  const threshold = eventThreshold(timeframe, symbol);
  if ((!bucketMs && !threshold) || !records.length) return current;
  // Historical/event series are repaired when they enter the cache. Rewalking
  // every retained candle for each live Rithmic batch caused periodic browser
  // stalls on range charts and is unnecessary for an already-normalized tail.
  const next = [...current];

  for (const record of records) {
    if (!Number.isFinite(record.timestamp) || !Number.isFinite(record.close) || record.close <= 0) continue;
    const timestamp = bucketMs ? Math.floor(record.timestamp / bucketMs) * bucketMs : record.timestamp;
    const last = next.at(-1);
    const recordDelta = Number.isFinite(record.delta)
      ? record.delta
      : (record.askVolume || 0) - (record.bidVolume || 0);
    const lastIsComplete = Boolean(last && threshold && (
      threshold.kind === "r"
        ? last.high - last.low >= threshold.value
        : threshold.kind === "v"
          ? (last.volume || 0) >= threshold.value
          : threshold.kind === "t"
            ? (last.trades || 0) >= threshold.value
            : Math.abs(last.deltaClose ?? last.delta ?? 0) >= threshold.value
    ));
    const rangeWouldOverflow = Boolean(
      last
      && threshold?.kind === "r"
      && Math.max(last.high, record.close) - Math.min(last.low, record.close) > threshold.value,
    );

    if (!last || (bucketMs ? timestamp > last.timestamp : lastIsComplete || rangeWouldOverflow)) {
      const eventPrice = threshold ? record.close : null;
      // CME can publish several executions in the same millisecond. Event
      // charts still need a strictly increasing time key or the charting
      // library and merge layer collapse distinct bars into one.
      const candleTimestamp = threshold && last
        ? Math.max(timestamp, last.timestamp + 1)
        : timestamp;
      next.push({
        timestamp: candleTimestamp,
        open: (eventPrice ?? record.open) || record.close,
        high: eventPrice ?? Math.max(record.high || record.close, record.close),
        low: eventPrice ?? Math.min(record.low || record.close, record.close),
        close: record.close,
        volume: record.volume || 0,
        trades: record.trades || 0,
        bidVolume: record.bidVolume || 0,
        askVolume: record.askVolume || 0,
        bidTrades: record.aggressor === "SELL" ? record.trades || 0 : 0,
        askTrades: record.aggressor === "BUY" ? record.trades || 0 : 0,
        delta: recordDelta,
        deltaOpen: 0,
        deltaHigh: Math.max(0, recordDelta),
        deltaLow: Math.min(0, recordDelta),
        deltaClose: recordDelta,
      });
      continue;
    }
    if (bucketMs && timestamp < last.timestamp) continue;

    const deltaClose = (last.deltaClose ?? last.delta ?? 0) + recordDelta;
    next[next.length - 1] = {
      ...last,
      high: Math.max(last.high, record.high || record.close, record.close),
      low: Math.min(last.low, record.low || record.close, record.close),
      close: record.close,
      volume: (last.volume || 0) + (record.volume || 0),
      trades: (last.trades || 0) + (record.trades || 0),
      bidVolume: (last.bidVolume || 0) + (record.bidVolume || 0),
      askVolume: (last.askVolume || 0) + (record.askVolume || 0),
      bidTrades: (last.bidTrades || 0) + (record.aggressor === "SELL" ? record.trades || 0 : 0),
      askTrades: (last.askTrades || 0) + (record.aggressor === "BUY" ? record.trades || 0 : 0),
      delta: deltaClose,
      deltaOpen: last.deltaOpen ?? 0,
      deltaHigh: Math.max(last.deltaHigh ?? 0, deltaClose),
      deltaLow: Math.min(last.deltaLow ?? 0, deltaClose),
      deltaClose,
    };
  }

  return next.slice(-Math.max(1, limit));
}

export function mergeInstitutionalVolumeProfiles(
  historical: InstitutionalVolumeProfile,
  exact: InstitutionalVolumeProfile,
): InstitutionalVolumeProfile {
  const tickSize = exact.tickSize;
  const groupTicks = exact.groupTicks;
  const levels = new Map<number, InstitutionalVolumeProfileLevel>();
  for (const level of [...historical.levels, ...exact.levels]) {
    const groupedTick = volumeProfileBinTick(Math.round(level.price / tickSize), groupTicks);
    const current = levels.get(groupedTick) ?? {
      price: Number((groupedTick * tickSize).toFixed(10)),
      volume: 0,
      bidVolume: 0,
      askVolume: 0,
      delta: 0,
      trades: 0,
    };
    current.volume += level.volume;
    current.bidVolume += level.bidVolume;
    current.askVolume += level.askVolume;
    current.delta = current.askVolume - current.bidVolume;
    current.trades += level.trades;
    levels.set(groupedTick, current);
  }

  const nextLevels = [...levels.values()].sort((left, right) => left.price - right.price);
  const totalVolume = nextLevels.reduce((sum, level) => sum + level.volume, 0);
  const bidVolume = nextLevels.reduce((sum, level) => sum + level.bidVolume, 0);
  const askVolume = nextLevels.reduce((sum, level) => sum + level.askVolume, 0);
  const trades = nextLevels.reduce((sum, level) => sum + level.trades, 0);
  const weightedPrice = nextLevels.reduce(
    (sum, level) => sum + level.price * level.volume,
    0,
  );
  const weightedSquaredPrice = nextLevels.reduce(
    (sum, level) => sum + level.price * level.price * level.volume,
    0,
  );
  const vwap = totalVolume > 0 ? weightedPrice / totalVolume : null;
  const variance = totalVolume > 0 && vwap !== null
    ? Math.max(0, weightedSquaredPrice / totalVolume - vwap * vwap)
    : 0;
  const valueArea = calculateVolumeProfileValueArea(
    nextLevels,
    tickSize * groupTicks,
    STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
  );

  return {
    ...exact,
    valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    source: `${exact.source} + earlier-session CME bars`,
    startMs: Math.min(historical.startMs, exact.startMs),
    endMs: Math.max(historical.endMs, exact.endMs),
    totalVolume,
    bidVolume,
    askVolume,
    delta: askVolume - bidVolume,
    trades,
    poc: valueArea.poc,
    vah: valueArea.vah,
    val: valueArea.val,
    vwap,
    standardDeviation: Math.sqrt(variance),
    levels: nextLevels,
    developingPoc: [
      ...historical.developingPoc,
      ...exact.developingPoc,
    ].slice(-2_000),
  };
}

type InstitutionalCandleFlow = {
  volume: number;
  askVolume: number;
  bidVolume: number;
  askTrades: number;
  bidTrades: number;
  trades: number;
  delta: number;
  deltaHigh: number;
  deltaLow: number;
};

/**
 * Rebuild the order-flow fields on an existing chart series from the exact
 * execution tape without altering its OHLC geometry.
 *
 * Chart history and live price construction deliberately come from the CME
 * candle feed, while Rithmic supplies aggressor-side executions. Previously
 * only Big Trades consumed that tape; CVD, Big Blocks and the other
 * candle-based studies kept reading the candle feed's fallback side totals.
 * This projection gives every order-flow study the same execution source.
 */
export function enrichCandlesWithInstitutionalTrades(
  candles: Candle[],
  records: InstitutionalTrade[],
  limit = 1_500,
) {
  const base = candles.slice(-Math.max(1, limit));
  if (!base.length || !records.length) return base;

  const flows = new Map<number, InstitutionalCandleFlow>();
  const firstTimestamp = base[0].timestamp;
  const finalCandleIndex = base.length - 1;
  const finalCandleCutoff = cmeEventTailCutoffMs(base);

  for (const record of records) {
    if (
      !Number.isFinite(record.timestamp)
      || record.timestamp < firstTimestamp
      || !Number.isFinite(record.close)
      || record.close <= 0
    ) continue;

    // Resolve the latest candle whose opening time is not after this print.
    // This also works for volume/range/tick bars, whose timestamps need not be
    // aligned to a wall-clock interval.
    let low = 0;
    let high = base.length - 1;
    let candleIndex = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (base[middle].timestamp <= record.timestamp) {
        candleIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (candleIndex < 0) continue;
    const nextTimestamp = base[candleIndex + 1]?.timestamp;
    if (nextTimestamp != null && record.timestamp >= nextTimestamp) continue;
    if (
      candleIndex === finalCandleIndex
      && finalCandleCutoff !== null
      && record.timestamp >= finalCandleCutoff
    ) continue;

    const volume = Math.max(0, Number(record.volume) || 0);
    let askVolume = Math.max(0, Number(record.askVolume) || 0);
    let bidVolume = Math.max(0, Number(record.bidVolume) || 0);
    if (askVolume + bidVolume <= 0 && volume > 0) {
      if (record.aggressor === "BUY") askVolume = volume;
      if (record.aggressor === "SELL") bidVolume = volume;
    }
    const tradeCount = Math.max(1, Number(record.trades) || 1);
    const recordDelta = Number.isFinite(record.delta)
      ? Number(record.delta)
      : askVolume - bidVolume;
    const previous = flows.get(candleIndex) ?? {
      volume: 0,
      askVolume: 0,
      bidVolume: 0,
      askTrades: 0,
      bidTrades: 0,
      trades: 0,
      delta: 0,
      deltaHigh: 0,
      deltaLow: 0,
    };
    const delta = previous.delta + recordDelta;
    flows.set(candleIndex, {
      volume: previous.volume + volume,
      askVolume: previous.askVolume + askVolume,
      bidVolume: previous.bidVolume + bidVolume,
      askTrades: previous.askTrades + (record.aggressor === "BUY" ? tradeCount : 0),
      bidTrades: previous.bidTrades + (record.aggressor === "SELL" ? tradeCount : 0),
      trades: previous.trades + tradeCount,
      delta,
      deltaHigh: Math.max(previous.deltaHigh, delta),
      deltaLow: Math.min(previous.deltaLow, delta),
    });
  }

  if (!flows.size) return base;
  return base.map((candle, index) => {
    const flow = flows.get(index);
    if (!flow || flow.askVolume + flow.bidVolume <= 0) return candle;
    return {
      ...candle,
      // Use the execution tape's exact totals wherever that tape covers a
      // candle. Candles outside the retained tape keep their historical
      // provider values rather than being presented as zero order flow.
      volume: flow.volume || flow.askVolume + flow.bidVolume,
      trades: flow.trades,
      askVolume: flow.askVolume,
      bidVolume: flow.bidVolume,
      askTrades: flow.askTrades,
      bidTrades: flow.bidTrades,
      delta: flow.delta,
      deltaOpen: 0,
      deltaHigh: flow.deltaHigh,
      deltaLow: flow.deltaLow,
      deltaClose: flow.delta,
    };
  });
}

/**
 * Overlay an already aggregated execution history onto the matching chart
 * candles without replacing their provider OHLC geometry.
 *
 * Rithmic reports delta OHLC on a running-session basis. Chart indicators
 * consume bar-relative delta, so normalize each source candle back to a zero
 * open before CVD accumulates it. Without this conversion CVD double-counts
 * the running total on every historical bar.
 */
export function enrichCandlesWithInstitutionalCandleFlow(
  candles: Candle[],
  flowCandles: Candle[],
) {
  if (!candles.length || !flowCandles.length) return candles;
  const flowByTimestamp = new Map(
    flowCandles
      .filter((candle) => Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0)
      .map((candle) => [candle.timestamp, candle] as const),
  );
  if (!flowByTimestamp.size) return candles;
  return candles.map((candle) => {
    const flow = flowByTimestamp.get(candle.timestamp);
    if (!flow) return candle;
    const askVolume = Math.max(0, Number(flow.askVolume ?? 0));
    const bidVolume = Math.max(0, Number(flow.bidVolume ?? 0));
    const delta = Number.isFinite(Number(flow.delta))
      ? Number(flow.delta)
      : askVolume - bidVolume;
    const sourceOpen = Number.isFinite(Number(flow.deltaOpen)) ? Number(flow.deltaOpen) : 0;
    const sourceHigh = Number.isFinite(Number(flow.deltaHigh))
      ? Number(flow.deltaHigh)
      : sourceOpen + Math.max(0, delta);
    const sourceLow = Number.isFinite(Number(flow.deltaLow))
      ? Number(flow.deltaLow)
      : sourceOpen + Math.min(0, delta);
    return {
      ...candle,
      volume: Math.max(Number(candle.volume ?? 0), askVolume + bidVolume),
      trades: Math.max(1, Number(flow.trades ?? candle.trades ?? 1)),
      askVolume,
      bidVolume,
      askTrades: Math.max(0, Number(flow.askTrades ?? 0)),
      bidTrades: Math.max(0, Number(flow.bidTrades ?? 0)),
      delta,
      deltaOpen: 0,
      deltaHigh: sourceHigh - sourceOpen,
      deltaLow: sourceLow - sourceOpen,
      deltaClose: delta,
    };
  });
}

/**
 * How far a held bar may differ from the exchange-baked bar before it is
 * treated as under-counted, as a fraction of the baked bar and as an
 * absolute contract count. Baked totals wobble slightly between polls, so a
 * bar within these margins is left alone rather than forcing a series rebuild.
 */
export const FLOW_HEAL_RELATIVE_TOLERANCE = 0.02;
export const FLOW_HEAL_ABSOLUTE_TOLERANCE = 25;

/**
 * Repair closed bars whose aggressor flow disagrees with the exchange-baked
 * history, and report whether anything actually needed repairing.
 *
 * A live stream that fragments during a busy session leaves closed bars
 * holding a FRACTION of the executions that really traded in them. Those bars
 * are not empty, so a repair that only looks for empty bars never touches
 * them. CVD is a cumulative sum, so every one of those under-counted bars
 * shifts the entire remainder of the series: the session collapses onto the
 * zero line while the live edge — which does carry full flow — prints a
 * vertical jump at the right-hand end.
 *
 * Bars at or after `liveEdgeFromMs` keep whatever the live stream gave them.
 * The baked history lags the tape, so adopting its partial view of the
 * forming bar would drag the live edge backwards on every poll.
 *
 * Returns null when nothing is materially wrong, so the caller can skip the
 * commit entirely.
 */
export function healClosedCandleFlow(
  held: Candle[],
  baked: Candle[],
  liveEdgeFromMs: number,
): Candle[] | null {
  if (!held.length || !baked.length) return null;
  const enriched = enrichCandlesWithInstitutionalCandleFlow(held, baked);
  if (enriched === held || enriched.length !== held.length) return null;

  let repaired = false;
  const healed = enriched.map((candle, index) => {
    const before = held[index];
    // The live edge is the stream's to own.
    if (Number(before.timestamp) >= liveEdgeFromMs) return before;
    const bakedTotal = Math.max(0, Number(candle.askVolume ?? 0)) + Math.max(0, Number(candle.bidVolume ?? 0));
    if (bakedTotal <= 0) return before;
    const heldTotal = Math.max(0, Number(before.askVolume ?? 0)) + Math.max(0, Number(before.bidVolume ?? 0));
    const margin = Math.max(FLOW_HEAL_ABSOLUTE_TOLERANCE, bakedTotal * FLOW_HEAL_RELATIVE_TOLERANCE);
    const volumeDrift = Math.abs(bakedTotal - heldTotal);
    const deltaDrift = Math.abs(Number(candle.delta ?? 0) - Number(before.delta ?? 0));
    if (heldTotal > 0 && volumeDrift <= margin && deltaDrift <= margin) return before;
    repaired = true;
    return candle;
  });
  return repaired ? healed : null;
}
function normalizeInstitutionalTradeRecords(value: unknown): InstitutionalTrade[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const recordIndex = finiteNumber(item.recordIndex);
    const timestamp = timestampMs(item.timestamp);
    const open = finiteNumber(item.open);
    const high = finiteNumber(item.high);
    const low = finiteNumber(item.low);
    const close = finiteNumber(item.close);
    if (recordIndex === null || timestamp === null || open === null || high === null || low === null || close === null) {
      return [];
    }
    const rawAggressor = item.aggressor === "BUY" ? "BUY" : item.aggressor === "SELL" ? "SELL" : "UNKNOWN";
    const sideSemanticsVersion = finiteNumber(item.sideSemanticsVersion);
    const legacySideSemantics = sideSemanticsVersion === null || sideSemanticsVersion < 2;
    const rawBidVolume = finiteNumber(item.bidVolume) ?? 0;
    const rawAskVolume = finiteNumber(item.askVolume) ?? 0;
    // Version 1/unversioned workers inverted Databento's aggressor side. This
    // keeps live charts correct while those workers roll forward to version 2.
    const aggressor = legacySideSemantics
      ? rawAggressor === "BUY"
        ? "SELL"
        : rawAggressor === "SELL"
          ? "BUY"
          : "UNKNOWN"
      : rawAggressor;
    const bidVolume = legacySideSemantics ? rawAskVolume : rawBidVolume;
    const askVolume = legacySideSemantics ? rawBidVolume : rawAskVolume;
    return [{
      ...(typeof item.eventId === "string" && item.eventId
        ? { eventId: item.eventId }
        : {}),
      recordIndex,
      timestamp,
      open,
      high,
      low,
      close,
      trades: finiteNumber(item.trades) ?? 0,
      volume: finiteNumber(item.volume) ?? 0,
      bidVolume,
      askVolume,
      delta: askVolume - bidVolume,
      aggressor,
      sideSemanticsVersion: 2,
    } satisfies InstitutionalTrade];
  });
}

export function mergeInstitutionalTradeSeries(
  current: InstitutionalTrade[],
  incoming: InstitutionalTrade[],
  limit = 25_000,
) {
  if (!incoming.length) return current.slice(-Math.max(1, limit));
  const merged = new Map<string, InstitutionalTrade>();
  const identity = (record: InstitutionalTrade) => record.eventId
    ?? [
      record.timestamp,
      record.recordIndex,
      record.close,
      record.volume,
      record.aggressor,
    ].join(":");
  for (const record of current) merged.set(identity(record), record);
  for (const record of incoming) merged.set(identity(record), record);
  return [...merged.values()]
    .sort((left, right) => (
      left.timestamp - right.timestamp
      || left.recordIndex - right.recordIndex
    ))
    .slice(-Math.max(1, limit));
}

export type InstitutionalOrderFlowResult = {
  candles: Candle[];
  records: InstitutionalTrade[];
  trades: InstitutionalTrade[];
  sourceRecordCount: number;
  fromMs: number;
  toMs: number;
  truncated: boolean;
};

function mergeOrderFlowCandles(current: Candle[], incoming: Candle[]) {
  const merged = new Map<number, Candle>();
  for (const candle of current) merged.set(candle.timestamp, candle);
  for (const candle of incoming) merged.set(candle.timestamp, candle);
  return [...merged.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-20_000);
}

function mergeOrderFlowRecords(
  current: InstitutionalTrade[],
  incoming: InstitutionalTrade[],
  limit: number,
) {
  const merged = new Map<string, InstitutionalTrade>();
  const identity = (record: InstitutionalTrade) => record.eventId
    ?? [
      record.timestamp,
      record.recordIndex,
      record.close,
      record.volume,
      record.aggressor,
    ].join(":");
  for (const record of current) merged.set(identity(record), record);
  for (const record of incoming) merged.set(identity(record), record);
  return [...merged.values()]
    .sort((left, right) => (
      left.timestamp - right.timestamp
      || left.recordIndex - right.recordIndex
    ))
    .slice(-Math.max(1, limit));
}

export function mergeInstitutionalOrderFlowResults(
  current: InstitutionalOrderFlowResult | null,
  incoming: InstitutionalOrderFlowResult,
): InstitutionalOrderFlowResult {
  if (!current) return incoming;
  const rangesAreDisjoint = (
    incoming.toMs <= current.fromMs
    || incoming.fromMs >= current.toMs
  );
  return {
    candles: mergeOrderFlowCandles(current.candles, incoming.candles),
    records: mergeOrderFlowRecords(current.records, incoming.records, 180_000),
    trades: mergeOrderFlowRecords(current.trades, incoming.trades, 25_000),
    sourceRecordCount: rangesAreDisjoint
      ? current.sourceRecordCount + incoming.sourceRecordCount
      : Math.max(current.sourceRecordCount, incoming.sourceRecordCount),
    fromMs: Math.min(current.fromMs, incoming.fromMs),
    toMs: Math.max(current.toMs, incoming.toMs),
    truncated: current.truncated || incoming.truncated,
  };
}

async function persistMergedInstitutionalOrderFlowResult(
  key: string,
  incoming: InstitutionalOrderFlowResult,
) {
  const pending = orderFlowCacheMergeQueue.get(key);
  const write = (pending ?? Promise.resolve(null))
    .catch(() => null)
    .then(async (queued) => {
      const cached = queued ?? await readPersistentIndicatorCache<InstitutionalOrderFlowResult>(key);
      const merged = mergeInstitutionalOrderFlowResults(cached, incoming);
      await writePersistentIndicatorCache(key, merged);
      return merged;
    });
  orderFlowCacheMergeQueue.set(key, write);
  void write.finally(() => {
    if (orderFlowCacheMergeQueue.get(key) === write) {
      orderFlowCacheMergeQueue.delete(key);
    }
  });
  return write;
}

export function resolveInstitutionalOrderFlowHistoryWindow(args: {
  requestedFromMs: number;
  requestedToMs: number;
  latestChartTimestamp: number;
  intervalMs: number;
  existingStartMs?: number | null;
  existingEndMs?: number | null;
  nowMs?: number;
  maximumChunkMs?: number;
}) {
  const intervalMs = Math.max(1, Math.floor(args.intervalMs));
  const providerAvailabilityCap = Math.min(
    args.nowMs ?? Date.now(),
    args.latestChartTimestamp + intervalMs,
  );
  const requestedToMs = Math.min(args.requestedToMs, providerAvailabilityCap);
  if (requestedToMs <= args.requestedFromMs) return null;

  const existingStartMs = Number.isFinite(args.existingStartMs)
    ? Number(args.existingStartMs)
    : null;
  const existingEndMs = Number.isFinite(args.existingEndMs)
    ? Number(args.existingEndMs)
    : null;
  if (
    existingStartMs !== null
    && existingEndMs !== null
    && existingStartMs <= args.requestedFromMs + intervalMs
    && existingEndMs >= requestedToMs - intervalMs
  ) {
    return null;
  }

  const toMs = existingStartMs !== null && existingStartMs < requestedToMs
    ? existingStartMs
    : requestedToMs;
  const maximumChunkMs = Math.max(
    intervalMs,
    args.maximumChunkMs ?? Math.max(intervalMs * 12, 60 * 60_000),
  );
  const fromMs = Math.max(args.requestedFromMs, toMs - maximumChunkMs);
  return toMs > fromMs
    ? { fromMs, toMs, providerAvailabilityCap }
    : null;
}

export async function readCachedInstitutionalOrderFlowResult(
  symbol: string,
  timeframe: string,
  contractSymbol?: string,
) {
  return readPersistentIndicatorCache<InstitutionalOrderFlowResult>(
    `order-flow:${ORDER_FLOW_CACHE_SCHEMA}:${orderFlowRecordCacheKey(symbol, timeframe, contractSymbol)}`,
  );
}

export async function fetchInstitutionalOrderFlowLevels(args: {
  symbol: string;
  contractSymbol?: string;
  timeframe: string;
  fromMs: number;
  toMs: number;
  includeTrades?: boolean;
  timeoutMs?: number;
}): Promise<InstitutionalOrderFlowResult | null> {
  const query = new URLSearchParams({
    symbol: args.symbol,
    ...(args.contractSymbol ? { contractSymbol: args.contractSymbol } : {}),
    interval: args.timeframe,
    fromMs: String(Math.floor(args.fromMs)),
    toMs: String(Math.ceil(args.toMs)),
    orderFlowSchema: "6",
    includeTrades: args.includeTrades ? "true" : "false",
  });
  try {
    const response = await gatewayFetch(
      `/v1/market-data/order-flow-levels?${query}`,
      undefined,
      args.timeoutMs ?? 30_000,
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      console.warn("Order-flow levels request returned an invalid response.", response.status);
      return null;
    }
    const records = normalizeInstitutionalTradeRecords(payload.records);
    const candles = normalizeCandles(payload.candles, 20_000);
    const trades = normalizeInstitutionalTradeRecords(payload.trades);
    const result: InstitutionalOrderFlowResult = {
      candles,
      records,
      trades,
      sourceRecordCount: Math.max(0, finiteNumber(payload.sourceRecordCount) ?? 0),
      fromMs: finiteNumber(payload.fromMs) ?? args.fromMs,
      toMs: finiteNumber(payload.toMs) ?? args.toMs,
      truncated: payload.truncated === true,
    };
    const persistentKey =
      `order-flow:${ORDER_FLOW_CACHE_SCHEMA}:${orderFlowRecordCacheKey(args.symbol, args.timeframe, args.contractSymbol)}`;
    const merged = await persistMergedInstitutionalOrderFlowResult(persistentKey, result);
    if (merged.records.length) {
      setOrderFlowRecordCache(
        orderFlowRecordCacheKey(args.symbol, args.timeframe, args.contractSymbol),
        merged.records,
      );
    }
    return merged;
  } catch (error) {
    console.warn("Order-flow levels request failed.", error);
    return null;
  }
}

export function createInstitutionalTradeStream(args: {
  symbol: string;
  contractSymbol?: string;
  afterRecord?: number;
  onSeed?: (candles: Candle[], records: InstitutionalTrade[]) => void;
  onTrades: (records: InstitutionalTrade[], meta: { historicalSeed: boolean }) => void;
  onOpen?: () => void;
  onError?: () => void;
}) {
  const params = new URLSearchParams({
    symbol: args.symbol,
    ...(args.contractSymbol ? { contractSymbol: args.contractSymbol } : {}),
    ...(Number.isFinite(args.afterRecord) ? { afterRecord: String(args.afterRecord) } : {}),
  });
  const stream = new EventSource(`${LOCAL_GATEWAY_ORIGIN}/v1/market-data/trades?${params}`);
  stream.addEventListener("ready", () => args.onOpen?.());
  stream.addEventListener("seed", (event) => {
    try {
      const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (!isRecord(payload)) return;
      const candles = normalizeCandles(payload.candles, 7_200);
      const records = normalizeInstitutionalTradeRecords(payload.records);
      if (candles.length || records.length) args.onSeed?.(candles, records);
    } catch {
      // The live stream continues even if a historical seed is malformed.
    }
  });
  stream.addEventListener("trades", (event) => {
    try {
      const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (!isRecord(payload) || !Array.isArray(payload.records)) return;
      const records = normalizeInstitutionalTradeRecords(payload.records);
      if (records.length) args.onTrades(records, { historicalSeed: payload.historicalSeed === true });
    } catch {
      // Ignore a malformed batch and let the next snapshot reconcile it.
    }
  });
  stream.onerror = () => args.onError?.();
  return () => stream.close();
}
