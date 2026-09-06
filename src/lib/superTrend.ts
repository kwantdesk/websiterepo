import type { Candle } from "./backtester";

export type SuperTrendPoint = {
  time: number;
  value: number;
  difference: number;
  atr: number;
  direction: "up" | "down";
  reversed: boolean;
  breakBefore?: boolean;
};

export const SUPER_TREND_PARAMETERS = { length: 10, multiplier: 3 } as const;

/** Conventional HL2/ATR trailing bands, not recovered vendor IL.
 * Wilder ATR starts with the mean of length true ranges (first = high-low).
 * First ready point seeds bearish; strict close crossings reverse the trend.
 * Recalculate from source bars so updating the live bar never double-counts it.
 * Invalid/duplicate/backwards data resets state and cannot bridge a plot gap.
 */
export function calculateSuperTrendValues(
  candles: readonly Candle[],
  parameters: { length: number; multiplier: number } = SUPER_TREND_PARAMETERS,
): SuperTrendPoint[] {
  const { length, multiplier } = parameters;
  if (!Number.isInteger(length) || length < 1 || length > 1000
    || !Number.isFinite(multiplier) || multiplier < 0.01 || multiplier > 100) {
    throw new RangeError("Super Trend requires length 1–1000 and multiplier 0.01–100");
  }
  const output: SuperTrendPoint[] = [];
  let previousClose: number | undefined;
  let lastTime = -Infinity;
  let count = 0, seedMean = 0;
  let atr: number | undefined;
  let upper = 0, lower = 0;
  let direction: "up" | "down" = "down";
  let ready = false, breakPending = false;
  const reset = () => {
    previousClose = undefined;
    count = 0; seedMean = 0; atr = undefined;
    upper = 0; lower = 0; direction = "down";
    ready = false; breakPending = true;
  };
  for (const candle of candles) {
    const { timestamp, high, low, close, open } = candle;
    if (![timestamp, high, low, close, open].every(Number.isFinite)
      || timestamp <= lastTime || high < low
      || close < low || close > high || open < low || open > high) {
      // Preserve the monotonic high-watermark, even through malformed prices.
      if (Number.isFinite(timestamp)) lastTime = Math.max(lastTime, timestamp);
      reset(); continue;
    }
    lastTime = timestamp;
    const range = previousClose === undefined ? high - low
      : Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
    if (!Number.isFinite(range)) { reset(); continue; }
    if (atr === undefined) {
      count++;
      seedMean += (range - seedMean) / count;
      if (count === length) atr = seedMean;
    } else atr += (range - atr) / length;
    if (atr === undefined) { previousClose = close; continue; }
    const mid = high / 2 + low / 2;
    const candidateUpper = mid + multiplier * atr;
    const candidateLower = mid - multiplier * atr;
    if (![candidateUpper, candidateLower].every(Number.isFinite)) { reset(); continue; }
    const oldDirection = direction;
    if (!ready) {
      upper = candidateUpper; lower = candidateLower;
    } else {
      if (candidateUpper < upper || previousClose! > upper) upper = candidateUpper;
      if (candidateLower > lower || previousClose! < lower) lower = candidateLower;
      if (direction === "down" && close > upper) direction = "up";
      else if (direction === "up" && close < lower) direction = "down";
    }
    const value = direction === "up" ? lower : upper;
    const difference = close - value;
    if (!Number.isFinite(difference)) { reset(); continue; }
    output.push({ time: timestamp / 1000, value, difference, atr, direction,
      reversed: ready && oldDirection !== direction,
      ...(breakPending ? { breakBefore: true } : {}) });
    previousClose = close; ready = true; breakPending = false;
  }
  return output;
}
