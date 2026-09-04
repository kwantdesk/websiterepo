import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { mergeLiveIndicatorCandle } from "../src/lib/chartLiveEvents.ts";

const theme = {
  primary: "#11aaff",
  secondary: "#99ccff",
  positive: "#00ff55",
  negative: "#ff3355",
  muted: "#999999",
};
const base = {
  timestamp: 1_700_000_000_000,
  open: 100,
  high: 102,
  low: 99,
  close: 101,
};
const run = (candles, settings = {}) => calculateIndicatorSeries({
  instanceId: "volume-1",
  indicatorId: "volume",
  enabled: true,
  settings: { backgroundMode: "dominant", deltaInputData: "volume", ...settings },
}, candles, theme)[0].data;

// Total volume is the height. Side volume controls direction only.
let points = run([{ ...base, volume: 1_000, askVolume: 300, bidVolume: 700 }]);
assert.equal(points[0].value, 1_000);
assert.equal(points[0].color, theme.negative);

// Delta, not candle body direction, owns DeepCharts Dominant colouring.
points = run([{ ...base, open: 101, close: 100, volume: 500, askVolume: 400, bidVolume: 100 }]);
assert.equal(points[0].color, theme.positive);

// Missing side history is visibly neutral and never fabricated from OHLC.
points = run([{ ...base, volume: 500 }]);
assert.equal(points[0].color, theme.muted);

// A valid side sum repairs an absent total without changing a real total.
points = run([{ ...base, volume: 0, askVolume: 60, bidVolume: 40 }]);
assert.equal(points[0].value, 100);

// A late, older React sample cannot shrink cumulative live flow fields.
const merged = mergeLiveIndicatorCandle(
  [{ ...base, volume: 120, trades: 12, askVolume: 80, bidVolume: 40, askTrades: 8, bidTrades: 4 }],
  { ...base, close: 101.5, volume: 100, trades: 10, askVolume: 55, bidVolume: 45, askTrades: 5, bidTrades: 5 },
)[0];
assert.equal(merged.volume, 120);
assert.equal(merged.trades, 12);
assert.equal(merged.askVolume, 80);
assert.equal(merged.bidVolume, 45);
assert.equal(merged.delta, 35);

console.log("volume indicator DeepCharts parity checks passed");
