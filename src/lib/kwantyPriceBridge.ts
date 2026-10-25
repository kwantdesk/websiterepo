"use client";

import { getMarketIndexDefinition } from "@/lib/marketIndices";
import { subscribeMarketIndexSnapshot } from "@/lib/marketIndexLiveClient";
import { fetchInstitutionalFrontMonth, fetchInstitutionalSnapshot, type InstitutionalTrade } from "@/lib/institutionalMarketData";
import { subscribeRithmicIndicatorTrades } from "@/lib/rithmicIndicatorStream";
import { cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";

export type KwantyPriceBar = { time: number; open: number; high: number; low: number; close: number; volume?: number };
export type KwantyPriceFrame = { symbol: string; timestamp: number; lastPrice: number; candle?: KwantyPriceBar; sessionDate?: string };
export type KwantyPriceHost = {
  priceHistory(symbol: string, sessionDate?: string): Promise<KwantyPriceBar[]>;
  subscribePrice(symbol: string, listener: (frame: KwantyPriceFrame) => void, onError?: (error: Error) => void): () => void;
};
const pools = new Map<string, { users: number; pool: ReturnType<typeof createKwantyPricePool> }>();
export function kwantyPriceSymbol(value: string) {
  const symbol = String(value).trim().toUpperCase();
  if (symbol === "ES_SPX") return "ES";
  if (symbol === "NQ_NDX") return "NQ";
  if (symbol === "SPXW") return "SPX";
  if (symbol === "ES" || symbol === "NQ") return symbol;
  if (getMarketIndexDefinition(symbol)) return symbol;
  throw new Error("Price data is unavailable for this instrument.");
}
function bars(value: unknown): KwantyPriceBar[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const time = Number(item.time ?? item.timestamp);
    const [open, high, low, close] = [item.open, item.high, item.low, item.close].map(Number);
    if (!Number.isFinite(time) || time < 1e11 || time % 60_000 || ![open, high, low, close].every(n => Number.isFinite(n) && n > 0) || low > Math.min(open, close) || high < Math.max(open, close)) return [];
    return [{ time, open, high, low, close, ...(typeof item.volume === "number" && Number.isFinite(item.volume) && item.volume >= 0 ? {volume: item.volume} : {}) }];
  }).slice(-6_000);
}
type PriceDependencies = {
  fetch: typeof fetch;
  frontMonth: typeof fetchInstitutionalFrontMonth;
  snapshot: typeof fetchInstitutionalSnapshot;
  subscribeIndices: typeof subscribeMarketIndexSnapshot;
  subscribeTrades: typeof subscribeRithmicIndicatorTrades;
};
/** Exported for deterministic transport/lifecycle tests; production uses shared clients. */
export function createKwantyPricePool(overrides: Partial<PriceDependencies> = {}) {
  const dependencies = {fetch: (...args: Parameters<typeof fetch>) => fetch(...args), frontMonth: fetchInstitutionalFrontMonth,
    snapshot: fetchInstitutionalSnapshot, subscribeIndices: subscribeMarketIndexSnapshot,
    subscribeTrades: subscribeRithmicIndicatorTrades, ...overrides};
  const history = new Map<string, { until: number; bucket: number; value: KwantyPriceBar[] }>();
  const pending = new Map<string, Promise<KwantyPriceBar[]>>();
  const contracts = new Map<string, Promise<string>>();
  const disposers = new Set<() => void>();
  const controllers = new Set<AbortController>();
  let disposed = false;
  const contract = (symbol: string) => {
    let job = contracts.get(symbol);
    if (!job) { job = dependencies.frontMonth(symbol).then(result => { if (!result) throw new Error("Futures price data unavailable."); return result.contractSymbol; }).catch(error => { contracts.delete(symbol); throw error; }); contracts.set(symbol, job); }
    return job;
  };
  const priceHistory = async (input: string, sessionDate?: string) => {
    if (disposed) throw new Error("Price workspace is closed.");
    const symbol = kwantyPriceSymbol(input), date = sessionDate && /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ? sessionDate : "latest";
    const key = `${symbol}:${date}`, cached = history.get(key), bucket = Math.floor(Date.now() / 60_000);
    if (cached && cached.until > Date.now() && (date !== "latest" || cached.bucket === bucket)) return cached.value.map(row => ({...row}));
    let job = pending.get(key);
    if (!job) {
      if (pending.size >= 24) throw new Error("Too many price history requests.");
      job = (async () => {
        let value: KwantyPriceBar[];
        if (symbol === "ES" || symbol === "NQ") {
          // Never substitute the cash index for a futures-converted price axis.
          if (date !== "latest") {
            const window = cmeSessionWindowForDate(date);
            if (!window) throw new Error("Invalid historical futures session.");
            const controller = new AbortController(); controllers.add(controller);
            const timeout = setTimeout(() => controller.abort(), 35_000);
            try {
              const query = new URLSearchParams({ symbol: `${symbol}.c.0`, timeframe: "1m", days: "2", exec: "0",
                from: String(window.startMs), to: String(window.endMs - 60 * 60_000) });
              const response = await dependencies.fetch(`/api/cme-history?${query}`, { signal: controller.signal, credentials: "same-origin" });
              const payload = await response.json();
              if (!response.ok) throw new Error("Historical futures price is unavailable for this session.");
              value = bars(payload.candles).filter(row => row.time >= window.startMs && row.time < window.endMs - 60 * 60_000);
            } finally { clearTimeout(timeout); controllers.delete(controller); }
          } else {
            const snapshot = await dependencies.snapshot({ symbol, contractSymbol: await contract(symbol), timeframe: "1m", lookbackBars: 2_000, timeoutMs: 20_000 });
            value = bars(snapshot?.candles);
          }
        } else {
          const now = Date.now(), to = date === "latest" ? Math.floor(now / 60_000) * 60_000 + 59_999 : Math.min(now, Date.parse(`${date}T00:00:00Z`) + 30 * 3_600_000);
          const from = date === "latest" ? to - 5 * 86_400_000 : Date.parse(`${date}T00:00:00Z`);
          const controller = new AbortController(); controllers.add(controller);
          const timeout = setTimeout(() => controller.abort(), 25_000);
          try {
            const response = await dependencies.fetch(`/api/market-indices?${new URLSearchParams({ symbol, timeframe: "1m", from: String(from), to: String(to) })}`, { signal: controller.signal, credentials: "same-origin" });
            const payload = await response.json();
            if (!response.ok) throw new Error("Price history unavailable.");
            value = bars(payload.candles ?? payload.data?.candles);
          } finally { clearTimeout(timeout); controllers.delete(controller); }
        }
        if (!value.length) throw new Error("Price history unavailable.");
        if (!disposed) {
          history.delete(key); history.set(key, { value, bucket, until: Date.now() + (date === "latest" ? 15_000 : 300_000) });
          while (history.size > 24) history.delete(history.keys().next().value!);
        }
        return value;
      })().finally(() => pending.delete(key));
      pending.set(key, job);
    }
    return (await job).map(row => ({...row}));
  };
  const subscribePrice = (input: string, listener: (frame: KwantyPriceFrame) => void, onError?: (error: Error) => void) => {
    if (disposed) throw new Error("Price workspace is closed.");
    const symbol = kwantyPriceSymbol(input);
    let closed = false, stop: (() => void) | undefined;
    const send = (frame: KwantyPriceFrame) => { if (!closed && !disposed) listener(frame); };
    const end = () => { closed = true; stop?.(); disposers.delete(end); }; disposers.add(end);
    if (symbol === "ES" || symbol === "NQ") {
      void contract(symbol).then(contractSymbol => {
        if (closed || disposed) return;
        const candles = new Map<number, KwantyPriceBar>();
        let continuous = false, firstCompleteMinute: number | null = null, lastTimestamp = -Infinity;
        const ingest = (records: InstitutionalTrade[], seed = false) => {
          if (seed) { candles.clear(); firstCompleteMinute = null; lastTimestamp = -Infinity; }
          const changed = new Map<number, KwantyPriceFrame>();
          for (const record of records) {
            if (record.flowOnly || !Number.isFinite(record.timestamp) || record.timestamp < lastTimestamp || record.timestamp < 1e11
              || ![record.open, record.high, record.low, record.close].every(value => Number.isFinite(value) && value > 0)
              || record.high < Math.max(record.open, record.close) || record.low > Math.min(record.open, record.close)) continue;
            lastTimestamp = record.timestamp;
            const time = Math.floor(record.timestamp / 60_000) * 60_000;
            if (continuous && !seed && firstCompleteMinute === null) firstCompleteMinute = time + 60_000;
            if (seed || !continuous || firstCompleteMinute === null || time < firstCompleteMinute) {
              changed.set(time, {symbol, timestamp: record.timestamp, lastPrice: record.close}); continue;
            }
            const previous = candles.get(time);
            const candle = { time, open: previous?.open ?? record.open, high: Math.max(previous?.high ?? record.high, record.high), low: Math.min(previous?.low ?? record.low, record.low), close: record.close };
            candles.set(time, candle);
            changed.set(time, {symbol, timestamp: record.timestamp, lastPrice: record.close, candle: {...candle}});
          }
          while (candles.size > 2_000) candles.delete(candles.keys().next().value!);
          if (seed) {const last = [...changed.values()].at(-1); if (last) send(last);}
          else for (const frame of changed.values()) send(frame);
        };
        stop = dependencies.subscribeTrades({ symbol, contractSymbol, onSeed: records => ingest(records, true), onTrades: records => ingest(records),
          onContinuity: value => { continuous = value === "continuous"; if (!continuous) {firstCompleteMinute = null; candles.clear();} },
          onStatus: status => {if (status !== "connected") {continuous = false; firstCompleteMinute = null; candles.clear();}},
        });
      }).catch(error => { if (!closed) onError?.(error); });
    } else stop = dependencies.subscribeIndices(symbol, snapshot => send({ ...snapshot, candle: bars([snapshot.candle])[0] }), onError);
    return end;
  };
  return { priceHistory, subscribePrice, dispose() { disposed = true; disposers.forEach(stop => stop()); controllers.forEach(controller => controller.abort()); history.clear(); contracts.clear(); } };
}
export function acquireKwantyPrices(accountKey: string) {
  let entry = pools.get(accountKey);
  if (!entry) { entry = { users: 0, pool: createKwantyPricePool() }; pools.set(accountKey, entry); }
  entry.users++; let released = false;
  return { priceHistory: entry.pool.priceHistory, subscribePrice: entry.pool.subscribePrice, release() { if (released) return; released = true; if (--entry.users === 0) { entry.pool.dispose(); pools.delete(accountKey); } } };
}
