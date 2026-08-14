export type LiveFootprintBarShape = {
  id: string;
  time: unknown;
  timestamp: number;
  startTime: number;
  endTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  openTick: number;
  highTick: number;
  lowTick: number;
  closeTick: number;
  isClosed: boolean;
  hasPriceLevelFlow: boolean;
};

/**
 * Keep the last execution-backed rows when a live transport refresh briefly
 * contains candles but no executions. Current OHLC geometry still wins, so
 * the active footprint follows price while its price-level rows wait for the
 * next execution batch instead of flashing to an empty chart.
 */
export function retainLiveFootprintRows<T extends LiveFootprintBarShape>(
  current: T[],
  retained: T[],
): T[] {
  if (!current.length) return retained;
  if (!retained.length) return current;

  const retainedByTime = new Map(retained.map((bar) => [String(bar.time), bar]));
  let matchedRetainedBar = false;
  const merged = current.map((bar) => {
    if (bar.hasPriceLevelFlow) return bar;
    const previous = retainedByTime.get(String(bar.time));
    if (!previous?.hasPriceLevelFlow) return bar;
    matchedRetainedBar = true;
    return {
      ...previous,
      id: bar.id,
      time: bar.time,
      timestamp: bar.timestamp,
      startTime: bar.startTime,
      endTime: bar.endTime,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      openTick: bar.openTick,
      highTick: bar.highTick,
      lowTick: bar.lowTick,
      closeTick: bar.closeTick,
      isClosed: bar.isClosed,
    };
  });

  // Do not leak rows from an old viewport into a genuinely different period.
  return matchedRetainedBar || merged.some((bar) => bar.hasPriceLevelFlow)
    ? merged
    : current;
}
