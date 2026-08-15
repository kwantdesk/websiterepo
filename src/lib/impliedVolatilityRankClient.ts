import {
  impliedVolatilityRankCacheKey,
  validateIvRankSnapshot,
  type IvRankContractMode,
  type IvRankSnapshot,
} from "@/lib/impliedVolatilityRank";

export interface IvRankQuery {
  sourceTicker: string;
  displayInstrument: string;
  lookBackPeriodDays: number;
  targetMaturityDays: number;
  contractMode: IvRankContractMode;
  useLiveIntradayIv: boolean;
  refreshSeconds: number;
  staleAfterSeconds: number;
}

export interface IvRankResourceState {
  snapshot: IvRankSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAtMs: number;
}

type Listener = (state: IvRankResourceState) => void;
type CacheEntry = IvRankResourceState & {
  listeners: Set<Listener>;
  controller: AbortController | null;
  timer: ReturnType<typeof setTimeout> | null;
  request: Promise<void> | null;
  query: IvRankQuery;
  lastAccessMs: number;
};

const entries = new Map<string, CacheEntry>();
const retryDelays = [500, 1_500, 4_000];

export function impliedVolatilityRankQueryKey(query: IvRankQuery) {
  return impliedVolatilityRankCacheKey(query);
}

function publicState(entry: CacheEntry): IvRankResourceState {
  return {
    snapshot: entry.snapshot,
    loading: entry.loading,
    refreshing: entry.refreshing,
    error: entry.error,
    updatedAtMs: entry.updatedAtMs,
  };
}

function notify(entry: CacheEntry) {
  const state = publicState(entry);
  entry.listeners.forEach((listener) => listener(state));
}

function schedule(entry: CacheEntry) {
  if (entry.timer) clearTimeout(entry.timer);
  if (!entry.listeners.size) return;
  const delay = Math.max(2, entry.query.refreshSeconds) * 1_000;
  entry.timer = setTimeout(() => void fetchEntry(entry), delay);
}

async function fetchEntry(entry: CacheEntry, force = false) {
  if (entry.request && !force) return entry.request;
  if (entry.controller) entry.controller.abort();
  const controller = new AbortController();
  entry.controller = controller;
  entry.loading = !entry.snapshot;
  entry.refreshing = Boolean(entry.snapshot);
  entry.error = null;
  notify(entry);
  const task = (async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      try {
        const params = new URLSearchParams({
          source: entry.query.sourceTicker,
          display: entry.query.displayInstrument,
          lookback: String(entry.query.lookBackPeriodDays),
          maturity: String(entry.query.targetMaturityDays),
          contractMode: entry.query.contractMode,
          live: entry.query.useLiveIntradayIv ? "1" : "0",
        });
        const response = await fetch(`/api/implied-volatility-rank?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `IV Rank request failed (${response.status}).`);
        if (!validateIvRankSnapshot(payload)) throw new Error("IV Rank returned an invalid data contract.");
        entry.snapshot = payload;
        entry.updatedAtMs = Date.now();
        entry.error = null;
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        lastError = error;
        if (attempt < retryDelays.length) await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
      }
    }
    entry.error = lastError instanceof Error ? lastError.message : "IV Rank is unavailable.";
  })().finally(() => {
    if (entry.controller === controller) entry.controller = null;
    entry.request = null;
    entry.loading = false;
    entry.refreshing = false;
    notify(entry);
    schedule(entry);
  });
  entry.request = task;
  return task;
}

function prune() {
  if (entries.size <= 32) return;
  [...entries.entries()]
    .filter(([, entry]) => !entry.listeners.size && !entry.request)
    .sort((left, right) => left[1].lastAccessMs - right[1].lastAccessMs)
    .slice(0, entries.size - 32)
    .forEach(([key]) => entries.delete(key));
}

export function subscribeImpliedVolatilityRank(query: IvRankQuery, listener: Listener) {
  const key = impliedVolatilityRankQueryKey(query);
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      snapshot: null,
      loading: true,
      refreshing: false,
      error: null,
      updatedAtMs: 0,
      listeners: new Set(),
      controller: null,
      timer: null,
      request: null,
      query,
      lastAccessMs: Date.now(),
    };
    entries.set(key, entry);
  }
  entry.query = query;
  entry.lastAccessMs = Date.now();
  entry.listeners.add(listener);
  listener(publicState(entry));
  const stale = Date.now() - entry.updatedAtMs > Math.max(15, query.staleAfterSeconds) * 1_000;
  if (!entry.snapshot || stale) void fetchEntry(entry);
  else schedule(entry);
  prune();
  return () => {
    entry!.listeners.delete(listener);
    if (!entry!.listeners.size) {
      if (entry!.timer) clearTimeout(entry!.timer);
      entry!.timer = null;
      entry!.controller?.abort();
      entry!.controller = null;
    }
  };
}

export function refreshImpliedVolatilityRank(query: IvRankQuery) {
  const entry = entries.get(impliedVolatilityRankQueryKey(query));
  return entry ? fetchEntry(entry, true) : Promise.resolve();
}
