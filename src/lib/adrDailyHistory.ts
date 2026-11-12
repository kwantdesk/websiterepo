import type { Candle } from "./backtester";
import { isMarketIndexSymbol } from "./marketIndices";
import { fetchJsonWithBudget } from "./marketDataRequest";

const DAY_MS = 86_400_000;
const PAGE_DAYS = 28;
const pending = new Map<string, Promise<Candle[]>>();
const cached = new Map<string, { until: number; candles: Candle[] }>();

export function adrDailyHistoryDays(period: string, length: number) {
  const days = period === "monthly" ? 31 * (length + 1)
    : period === "weekly" ? 7 * (length + 1) : Math.ceil(length * 7 / 5) + 7;
  return Math.max(14, Math.min(112, days));
}

export function loadAdrDailyHistory(symbol: string, days: number, day: number, now = Date.now()) {
  const cash = isMarketIndexSymbol(symbol);
  const dayStart = day * DAY_MS;
  const end = Math.min(now, dayStart + DAY_MS);
  const start = dayStart - days * DAY_MS;
  const key = `${symbol}:${day}:${days}`;
  const existing = cached.get(key);
  if (existing && existing.until > now) return Promise.resolve(existing.candles);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const request = (async () => {
    const bars = new Map<number, Candle>();
    for (let to = end; to > start;) {
      // The overlap supplies complete opening bars across adjacent pages.
      const from = Math.max(start, to - PAGE_DAYS * DAY_MS);
      const query = new URLSearchParams({ symbol, timeframe: "1D", from: String(from), to: String(to) });
      const path = cash ? "/api/market-indices" : "/api/cme-history";
      const { response, payload } = await fetchJsonWithBudget<{ candles?: Candle[] }>(`${path}?${query}`, 30_000);
      if (!response.ok || !Array.isArray(payload.candles)) throw new Error("ADR daily history unavailable");
      for (const candle of payload.candles) {
        if (candle.timestamp >= from && candle.timestamp <= to && !bars.has(candle.timestamp)) {
          bars.set(candle.timestamp, candle);
        }
      }
      if (from === start) break;
      to = from + 2 * DAY_MS;
    }
    const candles = [...bars.values()].sort((a, b) => a.timestamp - b.timestamp);
    if (candles.length) {
      cached.delete(key);
      cached.set(key, { until: now + 5 * 60_000, candles });
      if (cached.size > 48) cached.delete(cached.keys().next().value!);
    }
    return candles;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
