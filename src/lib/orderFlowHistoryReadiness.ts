import type { Candle } from "@/lib/backtester";

const hasFlow = (candle: Candle) => Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0;

/** Same readiness rule without allocating/filtering the full history per tick. */
export function hasUsableOrderFlowHistory(candles: Candle[]) {
  let first = 0;
  while (first < candles.length && !hasFlow(candles[first])) first++;
  if (first === candles.length) return false;
  let last = candles.length - 1;
  while (last > first && !hasFlow(candles[last])) last--;
  if (!((candles[last]?.timestamp ?? 0) > (candles[first]?.timestamp ?? 0))) return false;
  const required = Math.min(60, Math.max(2, Math.floor(candles.length * .05)));
  let verified = 2;
  for (let index = first + 1; verified < required && index < last; index++) {
    if (hasFlow(candles[index])) verified++;
  }
  return verified >= required;
}
