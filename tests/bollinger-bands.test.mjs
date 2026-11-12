import assert from "node:assert/strict";
import test from "node:test";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

const theme = { primary: "#fff", secondary: "#ccc", positive: "#0f0", negative: "#f00", muted: "#555" };
const start = 1794466200000;
const candles = (closes) => closes.map((close, i) => ({
  timestamp: start + i * 60_000, open: close, high: close, low: close, close, volume: 1,
}));
const bands = (bars, settings = {}, context = {}) => calculateIndicatorSeries({
  indicatorId: "bollinger-bands", instanceId: "bb", enabled: true, settings,
}, bars, theme, context);

test("Bollinger Bands use a trailing SMA and population standard deviation", () => {
  const prices = [100, 104, 110, 103, 98, 108];
  const [middle, upper, lower] = bands(candles(prices), { length: 3, multiplier: 2.5 });
  assert.equal(middle.data.length, 4);
  assert.equal(middle.data[0].time, (start + 120_000) / 1000);
  for (let index = 0; index < middle.data.length; index++) {
    const window = prices.slice(index, index + 3);
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
    assert.ok(Math.abs(middle.data[index].value - mean) < 1e-10);
    assert.ok(Math.abs(upper.data[index].value - (mean + 2.5 * Math.sqrt(variance))) < 1e-10);
    assert.ok(Math.abs(lower.data[index].value - (mean - 2.5 * Math.sqrt(variance))) < 1e-10);
  }
});

test("Small price deviations at high prices do not flatten or widen the bands", () => {
  const [middle, upper, lower] = bands(candles([30_000, 30_000.0001, 30_000]), { length: 2 });
  assert.ok(Math.abs(middle.data[0].value - 30_000.00005) < 1e-9);
  assert.ok(Math.abs(upper.data[0].value - 30_000.00015) < 1e-9);
  assert.ok(Math.abs(lower.data[0].value - 29_999.99995) < 1e-9);
});

test("Replay bands match the engine fed only causally available candles", () => {
  const bars = candles([100, 101, 102, 99, 2000]);
  const settings = { length: 2, multiplier: 1 };
  const clock = bars[3].timestamp;
  assert.deepEqual(bands(bars, settings, { replayTimestampMs: clock }), bands(bars.slice(0, 4), settings));
});

import { BollingerLiveCandles } from "../src/lib/bollingerLiveCandles.ts";

test("Direct candles survive stale sampling and yield to a newer source watermark", () => {
  const [first, forming, next] = candles([100, 102, 104]);
  const live = new BollingerLiveCandles();
  assert.equal(live.observe({ ...forming, close: 103, sourceEndTimestamp: forming.timestamp + 20 }, 7), true);
  assert.equal(live.observe({ ...forming, close: 103, sourceEndTimestamp: forming.timestamp + 20 }, 7), false);
  assert.equal(live.observe(first, 6), false);
  assert.deepEqual(live.merge([first, forming])?.candles.map(candle => candle.close), [100, 103]);
  assert.equal(live.merge([first, { ...forming, sourceEndTimestamp: forming.timestamp + 21 }]), null);
  assert.equal(live.observe(next, 8), true);
  assert.equal(live.merge([first, forming])?.chartTimes.get(next.timestamp), 8);
  assert.equal(live.merge([first, forming, next]), null);
});
