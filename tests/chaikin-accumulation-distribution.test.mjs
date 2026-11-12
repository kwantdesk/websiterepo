import test from "node:test";
import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";

const indicator = { indicatorId: "chaikin-accumulation-distribution", instanceId: "chaikin", enabled: true, settings: {} };
const theme = { primary: "#ff00ff", secondary: "#00ffff", positive: "#00ff00", negative: "#ff0000", muted: "#999999" };
const base = { timestamp: 1_700_000_040_000, open: 102, high: 104, low: 100, close: 104 };

test("Chaikin uses reported volume once and uses classified volume when the total is missing", () => {
  const candles = [
    { ...base, volume: 8, askVolume: 2, bidVolume: 3 },
    { ...base, timestamp: base.timestamp + 60_000, close: 100, askVolume: 2, bidVolume: 3 },
    { ...base, timestamp: base.timestamp + 120_000, close: 103, volume: 10 },
  ];
  const [series] = calculateIndicatorSeries(indicator, candles, theme);
  assert.deepEqual(series.data.map(point => point.value), [8, 3, 8]);
});

test("flat and malformed candle geometry cannot poison the cumulative line", () => {
  const candles = [
    { ...base, volume: 5 },
    { ...base, timestamp: base.timestamp + 60_000, high: 100, close: 100, volume: 20 },
    { ...base, timestamp: base.timestamp + 120_000, close: 105, volume: 20 },
    { ...base, timestamp: base.timestamp + 180_000, high: NaN, volume: 20 },
    { ...base, timestamp: base.timestamp + 240_000, close: 100, volume: 2 },
  ];
  const [series] = calculateIndicatorSeries(indicator, candles, theme);
  assert.deepEqual(series.data.map(point => point.value), [5, 5, 5, 5, 3]);
  assert.deepEqual(calculateIndicatorSeries(indicator, [base], theme), []);
});

test("Chaikin averages use full warmup, update independently, and use their own style", () => {
  const candles = [2, 4, 2, 8].map((volume, index) => ({ ...base, timestamp: base.timestamp + index * 60_000, volume }));
  const results = {
    simple: [16/3, 10],
    exponential: [16/3, 32/3],
    triangular: [5.5, 9.5],
    weighted: [38/6, 70/6],
  };
  for (const [averageType, expected] of Object.entries(results)) {
    const settings = { showAverage: true, averageType, averageLength: 3, lineWidth: 4, averageLineWidth: 2, useThemeColors: false, plotColor: "#123456", averageColor: "#fedcba" };
    const [main, average] = calculateIndicatorSeries({ ...indicator, settings }, candles, theme);
    assert.deepEqual(main.data.map(point => point.value), [2, 6, 8, 16]);
    assert.equal(main.lineWidth, 4);
    assert.equal(main.color, "#123456");
    assert.equal(average.lineWidth, 2);
    assert.equal(average.color, "#fedcba");
    assert.equal(average.data.length, 2);
    average.data.forEach((point, index) => assert.ok(Math.abs(point.value - expected[index]) < 1e-9, averageType));
  }
  assert.equal(calculateIndicatorSeries(indicator, candles, theme).length, 1);
});
