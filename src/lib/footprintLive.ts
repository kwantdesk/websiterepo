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
  if (match < 0) {
    const previous = bars[bars.length - 1];
    // A new source bucket must become visible immediately. Waiting for the
    // slower execution aggregation left the native candle transparent with no
    // Footprint replacement and made the forming candle appear to disappear.
    if (candle.timestamp <= previous.timestamp) return bars;
    const priceTick = (price: number) => Math.round(price / normalizedTickSize);
    const interval = Math.max(1, previous.endTime - previous.startTime);
    const nextPrevious = previous.isClosed && previous.endTime === candle.timestamp
      ? previous
      : { ...previous, endTime: candle.timestamp, isClosed: true };
    const idPrefix = previous.id.includes(":")
      ? previous.id.slice(0, previous.id.lastIndexOf(":"))
      : previous.id;
    const active = {
      ...previous,
      id: `${idPrefix}:${candle.timestamp}`,
      time: candle.time ?? candle.timestamp,
      timestamp: candle.timestamp,
      startTime: candle.timestamp,
      endTime: candle.timestamp + interval,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      openTick: priceTick(candle.open),
      highTick: priceTick(candle.high),
      lowTick: priceTick(candle.low),
      closeTick: priceTick(candle.close),
      bidVolume: 0,
      askVolume: 0,
      unknownVolume: 0,
      betweenVolume: 0,
      classifiedVolume: 0,
      totalVolume: 0,
      volume: 0,
      delta: 0,
      deltaPercent: 0,
      deltaOpen: 0,
      deltaHigh: 0,
      deltaLow: 0,
      deltaClose: 0,
      bidTrades: 0,
      askTrades: 0,
      unknownTrades: 0,
      totalTrades: 0,
      trades: 0,
      levels: new Map(),
      rows: [],
      profileRows: [],
      pocTick: null,
      valueAreaHighTick: null,
      valueAreaLowTick: null,
      maxBidTick: null,
      maxAskTick: null,
      maxVolumeTick: null,
      maxPositiveDeltaTick: null,
      maxNegativeDeltaTick: null,
      maxTradesTick: null,
      pocPrice: null,
      deltaPocPrice: null,
      vah: null,
      val: null,
      vwap: null,
      isClosed: false,
      hasPriceLevelFlow: false,
    };
    return [...bars.slice(0, -1), nextPrevious, active];
  }

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

  const retainedByTimestamp = new Map(retained.map((bar) => [bar.timestamp, bar]));
  const retainedByTime = new Map(retained.map((bar) => [String(bar.time), bar]));
  let matchedRetainedBar = false;
  const merged = current.map((bar) => {
    if (bar.hasPriceLevelFlow) return bar;
    // Source timestamp is the stable candle identity. Chart time may be
    // remapped for range/volume bars and can change when the live window is
    // rebuilt, which previously caused completed rows to be dropped.
    const previous = retainedByTimestamp.get(bar.timestamp)
      ?? retainedByTime.get(String(bar.time));
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

  const firstTimestamp = current[0].timestamp;
  const lastTimestamp = current[current.length - 1].timestamp;
  const currentTimestamps = new Set(current.map((bar) => bar.timestamp));
  const missingClosedBars = retained.filter((bar) => (
    bar.isClosed
    && bar.hasPriceLevelFlow
    && bar.timestamp >= firstTimestamp
    && bar.timestamp <= lastTimestamp
    && !currentTimestamps.has(bar.timestamp)
  ));
  // React can render an older sampled snapshot after the imperative live path
  // has already appended the next forming candle. Keep that one active tail
  // so the slower render cannot delete the candle that is currently printing.
  const retainedActiveTail = retained.filter((bar) => (
    !bar.isClosed
    && bar.timestamp > lastTimestamp
    && !currentTimestamps.has(bar.timestamp)
  )).slice(-1);
  const continuityBars = [...missingClosedBars, ...retainedActiveTail];
  const stable = continuityBars.length
    ? [...merged, ...continuityBars].sort((left, right) => left.timestamp - right.timestamp)
    : merged;

  // Do not leak rows from an old viewport into a genuinely different period.
  return matchedRetainedBar || stable.some((bar) => bar.hasPriceLevelFlow)
    ? stable
    : current;
}
