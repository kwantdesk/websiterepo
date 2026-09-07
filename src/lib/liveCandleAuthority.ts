import type { Candle } from "@/lib/backtester";

/**
 * A bar is fully observed only after the bucket in which the live subscription
 * began. The first bucket may already be in progress, so its archived open
 * remains authoritative. Every later bucket began under our live watch and
 * must keep the first live price as its immutable open.
 */
export function isFullyObservedLiveBucket(
  bucketStart: number,
  firstObservedTimestamp: number | null,
  bucketForTimestamp: (timestamp: number) => number,
) {
  if (firstObservedTimestamp === null || !Number.isFinite(firstObservedTimestamp)) return false;
  return bucketStart > bucketForTimestamp(firstObservedTimestamp);
}

/**
 * Joins a delayed historical snapshot to a candle already being built live.
 * Extrema are additive, the newest live close wins, and a fully observed bar's
 * live open can never be rewritten by a late/partial history response.
 */
export function mergeHistoricalAndLiveCandle(
  historical: Candle,
  live: Candle,
  timestamp: number,
  preserveLiveOpen: boolean,
): Candle {
  return {
    ...historical,
    ...live,
    timestamp,
    open: preserveLiveOpen ? live.open : historical.open,
    high: Math.max(historical.high, live.high),
    low: Math.min(historical.low, live.low),
    close: live.close,
    volume: Math.max(
      Number(historical.volume ?? 0),
      Number(live.volume ?? 0),
    ),
  };
}
