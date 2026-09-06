import assert from "node:assert/strict";
import test from "node:test";

import { calculateRegressionChannel, normalizeRegressionChannelSettings } from "../src/lib/regressionChannel.ts";

const theme = { primary: "#60a5fa", secondary: "#f59e0b", positive: "#22c55e", negative: "#ef4444", muted: "#71717a" };
const candles = Array.from({ length: 120 }, (_, index) => ({
  timestamp: (index + 1) * 60000,
  open: 100 + index * 0.25,
  high: 101 + index * 0.25 + (index % 5) * 0.1,
  low: 99 + index * 0.25 - (index % 3) * 0.1,
  close: 100 + index * 0.25 + Math.sin(index / 3),
  volume: 1000 + index,
}));

test("bars mode draws one bounded active channel with documented defaults", () => {
  const series = calculateRegressionChannel(candles, {}, theme, "one", 0.25);
  assert.equal(series.length, 3);
  assert.deepEqual(series.map((item) => item.data.length), [100, 100, 100]);
  assert.deepEqual(series.map((item) => item.lineWidth), [2, 2, 2]);
  assert.ok(series[1].data[50].value > series[0].data[50].value);
  assert.ok(series[2].data[50].value < series[0].data[50].value);
});

test("zero deviation collapses both bands onto the fitted centre", () => {
  const [mid, up, down] = calculateRegressionChannel(candles, { standardDeviationValue: 0 }, theme, "zero", 0.25);
  assert.equal(up.data.at(-1).value, mid.data.at(-1).value);
  assert.equal(down.data.at(-1).value, mid.data.at(-1).value);
});

test("falling channels use the negative theme colour", () => {
  const falling = candles.map((candle, index) => ({ ...candle, close: 200 - index }));
  const series = calculateRegressionChannel(falling, { bars: 20 }, theme, "falling", 0.25);
  assert.equal(series[0].data[0].color, theme.negative);
});

test("tick reversal mode anchors at a confirmed reversal", () => {
  const prices = [100, 101, 102, 103, 102, 101, 100, 99, 100, 101];
  const input = prices.map((close, index) => ({ timestamp: index * 1000, open: close, high: close + 0.25, low: close - 0.25, close, volume: 1 }));
  const series = calculateRegressionChannel(input, { mode: "zig-zag", zigZagMode: "tick-reversal", zigZagAbsoluteReversal: 1, zigZagReversalValue: 4 }, theme, "zig", 0.25);
  assert.equal(series[0].data[0].time, 7);
  assert.equal(series[0].data.length, 3);
});

test("highest-lowest mode keeps the developing leg", () => {
  const series = calculateRegressionChannel(candles, { mode: "zig-zag", zigZagMode: "highest-lowest", zigZagReversalValue: 22 }, theme, "hl", 0.25);
  assert.ok(series[0].data.length >= 2);
  assert.ok(series[0].data.length <= 22);
});

test("stored settings are finite and bounded", () => {
  const settings = normalizeRegressionChannelSettings({ bars: -5, standardDeviationValue: 99, midLineWidth: 8, mode: "wat" });
  assert.equal(settings.bars, 2);
  assert.equal(settings.standardDeviationValue, 10);
  assert.equal(settings.midLineWidth, 4);
  assert.equal(settings.mode, "bars");
});

test("an invalid history gap restarts rather than bridging the channel", () => {
  const broken = [...candles.slice(0, 110), { ...candles[110], close: Number.NaN }, ...candles.slice(111)];
  const series = calculateRegressionChannel(broken, { bars: 100 }, theme, "gap", 0.25);
  assert.equal(series[0].data.length, 9);
  assert.equal(series[0].data[0].time, candles[111].timestamp / 1000);
});

test("deep-history calculation stays bounded", () => {
  const large = Array.from({ length: 20_000 }, (_, index) => ({
    timestamp: (index + 1) * 1000, open: index, high: index + 1, low: index - 1,
    close: index + Math.sin(index / 10), volume: 1,
  }));
  const started = performance.now();
  const series = calculateRegressionChannel(large, { bars: 10_000 }, theme, "large", 0.25);
  assert.equal(series[0].data.length, 10_000);
  assert.ok(performance.now() - started < 250);
});
