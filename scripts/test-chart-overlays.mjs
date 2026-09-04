import assert from "node:assert/strict";
import {
  aggregateCandlesByMilliseconds,
  normalizeChartOverlaySettings,
  pairedOverlaySymbol,
} from "../src/lib/chartOverlays.ts";

assert.equal(pairedOverlaySymbol("NQ.v.0"), "ES");
assert.equal(pairedOverlaySymbol("MESU6"), "MNQ");

const settings = normalizeChartOverlaySettings({
  symbol: "es",
  timeframe: "30m",
  borderWidth: 99,
  opacity: -4,
}, {
  chartSymbol: "NQ.v.0",
  chartTimeframe: "5m",
  inheritTimeframe: false,
  theme: { upColor: "#00ff00", downColor: "#ff0000", accentColor: "#00aaff" },
});
assert.equal(settings.symbol, "ES");
assert.equal(settings.timeframe, "30m");
assert.equal(settings.borderWidth, 4);
assert.equal(settings.opacity, 5);

const inherited = normalizeChartOverlaySettings({ symbol: "AUTO", timeframe: "1D" }, {
  chartSymbol: "ES.v.0",
  chartTimeframe: "500v",
  inheritTimeframe: true,
  theme: { upColor: "#0f0", downColor: "#f00", accentColor: "#0ff" },
});
assert.equal(inherited.symbol, "NQ");
assert.equal(inherited.timeframe, "500v");

const aggregated = aggregateCandlesByMilliseconds([
  { timestamp: 0, open: 10, high: 12, low: 9, close: 11, volume: 5, delta: 2 },
  { timestamp: 30_000, open: 11, high: 13, low: 10, close: 12, volume: 7, delta: -1 },
  { timestamp: 60_000, open: 12, high: 14, low: 11, close: 13, volume: 9, delta: 4 },
], 60_000);
assert.equal(aggregated.length, 2);
assert.deepEqual(aggregated[0], {
  timestamp: 0,
  open: 10,
  high: 13,
  low: 9,
  close: 12,
  volume: 12,
  delta: 1,
  trades: 0,
  bidVolume: 0,
  askVolume: 0,
});

console.log("Chart overlay pairing, settings bounds and aggregation passed.");

