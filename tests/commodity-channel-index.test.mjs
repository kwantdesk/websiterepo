import assert from "node:assert/strict";
import test from "node:test";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { indicatorSettingDisabledReason } from "../src/lib/indicatorSettingAvailability.ts";
import { CciSeriesCache, LiveDeltaPaneModel } from "../src/lib/liveDeltaPanes.ts";

const indicator = { indicatorId: "commodity-channel-index-cci", instanceId: "cci", enabled: true };
const theme = { primary: "#aa1188", secondary: "#11aaaa", positive: "#22ff00", negative: "#ff0033", muted: "#888888" };
const start = 1_700_000_040_000;

const candlesAt = (prices) => prices.map((price, index) => ({
  timestamp: start + index * 60_000, open: price, high: price + 2, low: price - 3, close: price + 1,
}));

function cci(candles, settings = {}, context) {
  return calculateIndicatorSeries({ ...indicator, settings }, candles, theme, context)[0];
}

test("CCI measures deviation from HLC3 after the full warmup and returns zero for a flat window", () => {
  const points = cci(candlesAt([10, 20, 30, 20, 20, 20]), { length: 3 }).data;
  assert.equal(points.length, 4);
  assert.equal(points[0].time, (start + 120_000) / 1000);
  assert.deepEqual(points.map(point => Math.round(point.value)), [100, -50, -50, 0]);
});

test("CCI bounds a persisted out-of-range lookback to the supported limit", () => {
  const candles = candlesAt(Array.from({ length: 520 }, (_, index) => 100 + index / 2));
  assert.deepEqual(cci(candles, { length: 9_999 }), cci(candles, { length: 500 }));
});

test("CCI replay agrees with the live series through the cursor without future bars", () => {
  const candles = candlesAt([10, 20, 30, 40, 10]);
  const replayTimestampMs = candles[3].timestamp;
  assert.deepEqual(
    cci(candles, { length: 3 }, { replayTimestampMs }).data,
    cci(candles.slice(0, 4), { length: 3 }).data,
  );
});

test("CCI source, smoothing, levels, colours, line style and placement survive restore and change the plot", () => {
  const candles = candlesAt([10, 20, 30, 20, 10]);
  candles[2].high = 75;
  const saved = normalizeStoredIndicator({ ...indicator, settings: {
    length: 3, source: "close", showAverage: true, averageLength: 2,
    showLevels: true, levelValue: 125, chartArea: "chart", lineStyle: "dashed",
    lineWidth: 4, averageLineWidth: 3, useThemeColors: false,
    plotColor: "#111111", averageColor: "#222222", levelColor: "#333333",
  } });
  const restored = normalizeStoredIndicator(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored, saved);
  const [main, average, upper, zero, lower] = calculateIndicatorSeries(restored, candles, theme);
  assert.equal(main.data[0].value, 100);
  for (const source of ["hlc3", "hl2", "ohlc4"]) {
    assert.notDeepEqual(cci(candles, { length: 3, source }).data, main.data);
  }
  assert.equal(average.data[0].value, (main.data[0].value + main.data[1].value) / 2);
  assert.equal(average.lineWidth, 3);
  assert.equal(main.lineWidth, 4);
  assert.equal(main.lineStyle, "dashed");
  assert.deepEqual([main.color, average.color, upper.color], ["#111111", "#222222", "#333333"]);
  assert.deepEqual([upper, zero, lower].map(series => series.data[0].value), [125, 0, -125]);
  assert.ok([main, average, upper, zero, lower].every(series => series.priceScaleId === "momentum-cci"));
  assert.match(indicatorSettingDisabledReason(indicator.indicatorId, "averageLength"), /Show Average/);
  assert.match(indicatorSettingDisabledReason(indicator.indicatorId, "levelValue"), /Show Levels/);
  assert.equal(indicatorSettingDisabledReason(indicator.indicatorId, "averageLength", restored.settings), undefined);
  assert.equal(indicatorSettingDisabledReason(indicator.indicatorId, "levelValue", restored.settings), undefined);
});

test("CCI restarts warmup and its SMA across malformed prices and retains valid segments", () => {
  const candles = candlesAt([10, 20, 30, 40, 50, 60, 70, 80, 90]);
  candles[4].close = NaN;
  const [main, average] = calculateIndicatorSeries({ ...indicator, settings: {
    length: 3, showAverage: true, averageLength: 2,
  } }, candles, theme);
  assert.deepEqual(main.data.map(point => (point.time * 1000 - start) / 60_000), [2, 3, 7, 8]);
  assert.equal(main.data[2].breakBefore, true);
  assert.deepEqual(average.data.map(point => (point.time * 1000 - start) / 60_000), [3, 8]);
  assert.equal(average.data[1].breakBefore, true);
});

test("CCI live suffix matches a full recompute after a short batch, an open-only update and an earlier correction", () => {
  const candles = candlesAt(Array.from({ length: 21_000 }, (_, i) => 100 + 0.2 * (i % 22)));
  const settings = { length: 30, source: "ohlc4", showAverage: true, averageLength: 12, showLevels: true };
  const group = { key: indicator.instanceId, indicatorId: indicator.indicatorId, settings, series: [] };
  const inputs = { candles, instrument: "NQ", tickSize: 0.25, theme };
  const model = new LiveDeltaPaneModel();
  const verify = expected => assert.deepEqual(
    model.calculate(group, inputs).map(series => series.data),
    calculateIndicatorSeries({ ...indicator, settings }, expected, theme).map(series => series.data),
  );
  model.hydrate(candles, true);
  verify(candles);
  const previous = candles.at(-1);
  const latest = { ...previous, timestamp: previous.timestamp + 60_000, close: previous.close + 0.5 };
  model.observeSnapshot([...candles.slice(-12), latest], true);
  const forming = { ...latest, open: latest.open + 0.75 };
  model.observe(forming);
  verify([...candles, forming]);
  const corrected = candles.map((bar, index) => index === 14_400 ? { ...bar, close: NaN } : bar);
  model.hydrate(corrected, true);
  verify([...corrected, forming]);
});

test("CCI cache handles replay rewind, playback advance, and deleted candles without stale points", () => {
  const candles = candlesAt(Array.from({ length: 61 }, (_, i) => 120 + 1.2 * (i % 17)));
  const settings = { length: 4, showAverage: true, averageLength: 3, showLevels: true };
  const group = { key: indicator.instanceId, indicatorId: indicator.indicatorId, settings };
  const cache = new CciSeriesCache();
  const deleted = candles.filter((_, index) => index !== 41);
  for (const snapshot of [candles, candles.slice(0, 15), candles.slice(0, 17), candles, deleted, []]) {
    assert.deepEqual(cache.calculate(group, snapshot, theme), calculateIndicatorSeries({ ...indicator, settings }, snapshot, theme));
  }
});
