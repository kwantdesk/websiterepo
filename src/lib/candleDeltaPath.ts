import type { Candle } from "./backtester.ts";

/** Aggressor-side totals define the body. Historical OHLC can be expressed
 * relative to the session, but the path must fit this bar's executed volume. */
export function candleDeltaPath(
  candle: Candle,
  delta = Math.max(0, Number(candle.askVolume ?? 0)) - Math.max(0, Number(candle.bidVolume ?? 0)),
) {
  const ask = Math.max(0, Number(candle.askVolume ?? 0));
  const bid = Math.max(0, Number(candle.bidVolume ?? 0));
  const open = Number(candle.deltaOpen ?? 0);
  const matchesCumulative = Number.isFinite(candle.deltaClose)
    && Number.isFinite(open) && Math.abs(Number(candle.deltaClose) - open - delta) < 1e-6;
  const minimum = Math.min(0, delta);
  const maximum = Math.max(0, delta);
  const low = Number(candle.deltaLow) - (matchesCumulative ? open : 0);
  const high = Number(candle.deltaHigh) - (matchesCumulative ? open : 0);
  return {
    low: Number.isFinite(low) && low >= -bid - 1e-6 && low <= minimum ? low : minimum,
    high: Number.isFinite(high) && high <= ask + 1e-6 && high >= maximum ? high : maximum,
  };
}
