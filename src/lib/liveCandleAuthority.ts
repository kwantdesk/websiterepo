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

/**
 * Once a forming candle has painted a real extremum, a later snapshot for the
 * same source bar cannot erase it. The newest close is still authoritative;
 * only high/low/open and cumulative counters retain their observed history.
 */
export function retainFormingCandleExtrema(
  previous: Candle | null,
  incoming: Candle,
): Candle {
  if (!previous || previous.timestamp !== incoming.timestamp) return incoming;
  const askVolume = Math.max(Number(previous.askVolume ?? 0), Number(incoming.askVolume ?? 0));
  const bidVolume = Math.max(Number(previous.bidVolume ?? 0), Number(incoming.bidVolume ?? 0));
  const hasClassifiedVolume = previous.askVolume !== undefined
    || previous.bidVolume !== undefined
    || incoming.askVolume !== undefined
    || incoming.bidVolume !== undefined;
  const mergedDelta = hasClassifiedVolume
    ? askVolume - bidVolume
    : Number(incoming.delta ?? previous.delta ?? 0);
  return {
    ...previous,
    ...incoming,
    open: previous.open,
    high: Math.max(previous.high, incoming.high, previous.open, incoming.open, incoming.close),
    low: Math.min(previous.low, incoming.low, previous.open, incoming.open, incoming.close),
    close: incoming.close,
    volume: Math.max(Number(previous.volume ?? 0), Number(incoming.volume ?? 0)),
    trades: Math.max(Number(previous.trades ?? 0), Number(incoming.trades ?? 0)),
    askVolume: hasClassifiedVolume ? askVolume : incoming.askVolume,
    bidVolume: hasClassifiedVolume ? bidVolume : incoming.bidVolume,
    askTrades: Math.max(Number(previous.askTrades ?? 0), Number(incoming.askTrades ?? 0)),
    bidTrades: Math.max(Number(previous.bidTrades ?? 0), Number(incoming.bidTrades ?? 0)),
    delta: mergedDelta,
    deltaOpen: Number(previous.deltaOpen ?? incoming.deltaOpen ?? 0),
    deltaHigh: Math.max(
      Number(previous.deltaHigh ?? previous.delta ?? 0),
      Number(incoming.deltaHigh ?? incoming.delta ?? 0),
      mergedDelta,
    ),
    deltaLow: Math.min(
      Number(previous.deltaLow ?? previous.delta ?? 0),
      Number(incoming.deltaLow ?? incoming.delta ?? 0),
      mergedDelta,
    ),
    deltaClose: mergedDelta,
  };
}
