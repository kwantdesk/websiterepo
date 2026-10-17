/** Exact clock-bar reductions, not a sampled tape or inferred aggressor side. */
export function createExactFootprintFold({ starts, toMs, minimumTradeVolume, maximumTradeVolume }) {
  const bars = starts.map(timestamp => ({ timestamp, open: null, high: null, low: null,
    close: null, volume: 0, delta: 0, deltaHigh: 0, deltaLow: 0, levels: new Map() }));
  let previous = -Infinity, index = 0, count = 0, levelCount = 0;
  return {
    add(trade) {
      if (trade.timestamp < starts[0] || trade.timestamp >= toMs) return;
      if (++count > 5_000_000) throw new Error("Footprint window exceeds execution processing capacity.");
      if (trade.timestamp < previous) throw new Error("Footprint source execution order is invalid.");
      previous = trade.timestamp;
      while (index + 1 < starts.length && starts[index + 1] <= trade.timestamp) index++;
      const bar = bars[index];
      bar.open ??= trade.price; bar.close = trade.price;
      bar.high = bar.high === null ? trade.price : Math.max(bar.high, trade.price);
      bar.low = bar.low === null ? trade.price : Math.min(bar.low, trade.price);
      bar.volume += trade.size;
      if (trade.size < minimumTradeVolume || (maximumTradeVolume > 0 && trade.size > maximumTradeVolume)) return;
      let row = bar.levels.get(trade.price);
      if (!row) {
        if (++levelCount > 30_000) throw new Error("Footprint window has too many price levels; zoom in.");
        row = [trade.price, 0, 0, 0, 0, 0, 0];
        bar.levels.set(trade.price, row);
      }
      const side = trade.side > 0 ? 2 : trade.side < 0 ? 1 : 3;
      row[side] += trade.size; row[side + 3]++;
      bar.delta += trade.side > 0 ? trade.size : trade.side < 0 ? -trade.size : 0;
      bar.deltaHigh = Math.max(bar.deltaHigh, bar.delta);
      bar.deltaLow = Math.min(bar.deltaLow, bar.delta);
    },
    result() {
      return { sourceRecordCount: count, bars: bars.map(bar => ({ ...bar,
        levels: [...bar.levels.values()].sort((a, b) => a[0] - b[0]) })) };
    },
  };
}
