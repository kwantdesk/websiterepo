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

export type LiveFootprintCandleGeometry = {
  time?: unknown;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

/**
 * Move the active footprint candle with the same imperative live-candle path
 * as the native price series. Price geometry is safe to update independently
 * from the heavier execution aggregation: rows remain authoritative Rithmic
 * prints, while the body/wick never waits for a React tape reconciliation.
 */
export function applyLiveFootprintCandleGeometry<T extends LiveFootprintBarShape>(
  bars: T[],
  candle: LiveFootprintCandleGeometry,
  tickSize: number,
): T[] {
  if (!bars.length) return bars;
  const normalizedTickSize = Math.max(0.000000001, Math.abs(tickSize));
  let match = -1;
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    const bar = bars[index];
    if (
      (candle.time !== undefined && String(bar.time) === String(candle.time))
      || bar.timestamp === candle.timestamp
      || bar.startTime === candle.timestamp
      || (candle.timestamp >= bar.startTime && candle.timestamp < bar.endTime)
    ) {
      match = index;
      break;
    }
  }
  if (match < 0) return bars;

  const current = bars[match];
  if (
    current.open === candle.open
    && current.high === candle.high
    && current.low === candle.low
    && current.close === candle.close
    && current.isClosed === false
  ) return bars;

  const priceTick = (price: number) => Math.round(price / normalizedTickSize);
  const next = [...bars];
  next[match] = {
    ...current,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    openTick: priceTick(candle.open),
    highTick: priceTick(candle.high),
    lowTick: priceTick(candle.low),
    closeTick: priceTick(candle.close),
    isClosed: false,
  };
  return next;
}

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
