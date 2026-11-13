import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { candleVolumeColors, resolveCandleSeriesColors } from "../src/lib/candleStyle.ts";
import { LiveDeltaPaneModel } from "../src/lib/liveDeltaPanes.ts";
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
const run = (candles, settings = {}, palette = theme) => calculateIndicatorSeries({
  instanceId: "volume-1",
  indicatorId: "volume",
  enabled: true,
  settings,
}, candles, palette)[0].data;

// Height is total volume. Direction comes from the candle body.
let points = run([{ ...base, volume: 1_000, askVolume: 300, bidVolume: 700 }]);
assert.equal(points[0].value, 1_000);
assert.equal(points[0].color, theme.positive);

// Buy-side delta can be positive in a bearish candle.
points = run([{ ...base, open: 101, close: 100, volume: 500, askVolume: 400, bidVolume: 100 }]);
assert.equal(points[0].color, theme.negative);

// OHLC alone is enough to select the correct color.
points = run([{ ...base, volume: 500 }]);
assert.equal(points[0].color, theme.positive);

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

const candleTheme = {
  up: "#C386F5", down: "#E49452", borderUp: "#DCF575", borderDown: "#F79797",
  wickUp: "#99EE55", wickDown: "#EE9955",
};
const resolved = resolveCandleSeriesColors({}, candleTheme);
assert.deepEqual(candleVolumeColors(resolved, "#151515"), { up: candleTheme.up, down: candleTheme.down });
assert.deepEqual(candleVolumeColors({ ...resolved, upColor: "rgba(0,0,0,0)", downColor: "#151515" }, "#151515"),
  { up: candleTheme.borderUp, down: candleTheme.borderDown });
const palette = { ...theme, volumeCandleColors: { up: "#D54485", down: "#4337CA", heikinAshi: false } };
const legacySettings = { plotColor: "#123456", gradientPreset: "cyan-magenta", useThemeColors: false };
const bearish = { ...base, close: 99, volume: 500 };
assert.equal(run([bearish], legacySettings, palette)[0].color, "#4337CA");
assert.equal(run([{ ...bearish, close: base.open }], {}, palette)[0].color, "#D54485", "flat candles use the chart's up color");
assert.equal(run([bearish], { minimumTotalVolume: 501 }, palette).length, 0);
assert.equal(run([bearish], {}, { ...palette, volumeCandleColors: { ...palette.volumeCandleColors, heikinAshi: true } })[0].color,
  "#D54485", "Heikin Ashi volume follows the displayed candle");

const model = new LiveDeltaPaneModel();
model.hydrate([{ ...base, volume: 500 }]);
const group = { key: "volume-1", indicatorId: "volume", settings: legacySettings, series: [] };
const inputs = { candles: [], theme: palette, instrument: "NQ", tickSize: 0.25 };
assert.equal(model.calculate(group, inputs)[0].data[0].color, "#D54485");
model.observe({ ...bearish, volume: 520 });
assert.deepEqual(model.calculate(group, inputs)[0].data[0], { time: base.timestamp / 1000, value: 520, color: "#4337CA" });

console.log("volume indicator total-volume and live continuity checks passed");
