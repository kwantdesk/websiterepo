const finite = (value) => typeof value === "number" && Number.isFinite(value);

/**
 * Fold exact prints into compact one-tick price rows for canonical time bars.
 * The browser should never need the full execution tape for this study.
 * Every non-empty candle is reconciled against source volume and OHLC; failure
 * is explicit and returns no partial rows.
 */
export function foldAuctionGapTimeRows(input) {
  const fail = (reason) => ({ status: "unavailable", reason, bars: [] });
  const tickSize = Number(input?.tickSize);
  const trades = input?.trades;
  const bars = input?.bars;
  if (!finite(tickSize) || tickSize <= 0 || !Array.isArray(trades) || !Array.isArray(bars) || !bars.length) {
    return fail("invalid-source");
  }
  let priorEnd = -Infinity;
  const folded = [];
  for (let index = 0; index < bars.length; index += 1) {
    const bar = bars[index];
    const values = [bar?.timestamp, bar?.endTime, bar?.open, bar?.high, bar?.low, bar?.close, bar?.volume];
    if (!values.every(finite) || bar.endTime <= bar.timestamp || bar.timestamp < priorEnd
      || bar.volume < 0 || bar.low > Math.min(bar.open, bar.close)
      || bar.high < Math.max(bar.open, bar.close)) return fail("invalid-bars");
    const ticks = [bar.open, bar.high, bar.low, bar.close].map((price) => Math.round(price / tickSize));
    if (ticks.some((tick, offset) => !Number.isSafeInteger(tick)
      || Math.abs(values[2 + offset] / tickSize - tick) > 1e-6)) return fail("off-tick-bar");
    priorEnd = bar.endTime;
    folded.push({
      chartIndex: index,
      timestamp: bar.timestamp,
      endTime: bar.endTime,
      openTick: ticks[0], highTick: ticks[1], lowTick: ticks[2], closeTick: ticks[3],
      volume: bar.volume,
      rows: new Map(),
      sourceOpenTick: null, sourceHighTick: null, sourceLowTick: null, sourceCloseTick: null,
      sourceVolume: 0,
    });
  }
  let barIndex = 0;
  let previousTime = -Infinity;
  for (const trade of trades) {
    const timestamp = trade?.timestamp;
    const price = trade?.price;
    const size = trade?.size;
    const side = Number(trade?.side ?? 0);
    if (![timestamp, price, size].every(finite) || timestamp < previousTime || price <= 0 || size <= 0
      || ![-1, 0, 1].includes(side)) return fail("invalid-execution");
    previousTime = timestamp;
    while (barIndex < folded.length && timestamp >= folded[barIndex].endTime) barIndex += 1;
    if (barIndex >= folded.length || timestamp < folded[barIndex].timestamp) return fail("unassigned-execution");
    const tick = Math.round(price / tickSize);
    if (!Number.isSafeInteger(tick) || Math.abs(price / tickSize - tick) > 1e-6) return fail("off-tick-execution");
    const target = folded[barIndex];
    const row = target.rows.get(tick) ?? { tickIndex: tick, bidVolume: 0, askVolume: 0, unknownVolume: 0 };
    if (side > 0) row.askVolume += size;
    else if (side < 0) row.bidVolume += size;
    else row.unknownVolume += size;
    target.rows.set(tick, row);
    target.sourceVolume += size;
    target.sourceOpenTick ??= tick;
    target.sourceHighTick = target.sourceHighTick === null ? tick : Math.max(target.sourceHighTick, tick);
    target.sourceLowTick = target.sourceLowTick === null ? tick : Math.min(target.sourceLowTick, tick);
    target.sourceCloseTick = tick;
  }
  for (const bar of folded) {
    if (Math.abs(bar.sourceVolume - bar.volume) > 1e-8) return fail("source-volume-mismatch");
    if (bar.volume > 0 && (bar.sourceOpenTick !== bar.openTick || bar.sourceHighTick !== bar.highTick
      || bar.sourceLowTick !== bar.lowTick || bar.sourceCloseTick !== bar.closeTick)) {
      return fail("source-ohlc-mismatch");
    }
  }
  return {
    status: "ready",
    reason: null,
    bars: folded.map((bar) => ({
      chartIndex: bar.chartIndex,
      timestamp: bar.timestamp,
      endTime: bar.endTime,
      openTick: bar.openTick,
      highTick: bar.highTick,
      lowTick: bar.lowTick,
      closeTick: bar.closeTick,
      volume: bar.volume,
      rows: [...bar.rows.values()].sort((left, right) => left.tickIndex - right.tickIndex),
    })),
  };
}
