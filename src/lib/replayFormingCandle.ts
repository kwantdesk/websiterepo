import type { Candle } from "@/lib/backtester";

type ReplayPrint = { timestamp: number; close: number; volume?: number; trades?: number; delta?: number; bidVolume?: number; askVolume?: number; flowOnly?: boolean };

/** Fold only observed executions. Never inherit a closed bar's final wick/flow. */
export function replayFormingCandle(timestamp: number, clock: number, prints: readonly ReplayPrint[]): Candle | null {
  let lo = 0, hi = prints.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (prints[mid].timestamp < timestamp) lo = mid + 1; else hi = mid; }
  let result: Candle | null = null, delta = 0, deltaHigh = 0, deltaLow = 0;
  let bidVolume = 0, askVolume = 0;
  for (let i = lo; i < prints.length && prints[i].timestamp <= clock; i++) {
    const print = prints[i], price = print.close;
    if (print.flowOnly || !Number.isFinite(price) || price <= 0) continue;
    if (!result) result = { timestamp, open: price, high: price, low: price, close: price, volume: 0, trades: 0 };
    result.high = Math.max(result.high, price); result.low = Math.min(result.low, price); result.close = price;
    result.volume = (result.volume ?? 0) + Math.max(0, Number(print.volume ?? 0));
    result.trades = (result.trades ?? 0) + Math.max(1, Number(print.trades ?? 1));
    bidVolume += Math.max(0, Number(print.bidVolume ?? 0)); askVolume += Math.max(0, Number(print.askVolume ?? 0));
    delta += Number.isFinite(print.delta) ? Number(print.delta) : Number(print.askVolume ?? 0) - Number(print.bidVolume ?? 0);
    deltaHigh = Math.max(deltaHigh, delta); deltaLow = Math.min(deltaLow, delta);
  }
  return result ? { ...result, bidVolume, askVolume, delta, deltaOpen: 0, deltaHigh, deltaLow, deltaClose: delta } : null;
}
