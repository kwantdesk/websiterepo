import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { normalizeSuperTrendSettings, superTrendNumericSettings } from "../src/lib/superTrendSettings.ts";
import { SuperTrendAlertTracker } from "../src/lib/superTrendAlerts.ts";
import { indicatorHistogramWidth } from "../src/lib/indicatorHistogramWidth.ts";

const theme = { primary: "#00ff00", secondary: "#ffffff", positive: "#33ff88", negative: "#ff6688", muted: "#888888" };
const bars = Array.from({ length: 100 }, (_, i) => {
  const close = Math.sin(i / 3) * 30 + 100;
  return { timestamp: 1700000000000 + i * 1000, close, open: close, high: close + 1, low: close - 1 };
});
const instance = (id, settings = {}) => ({ instanceId: "test-st", indicatorId: id, enabled: true, settings });

test("actual engine pairs trend and difference without flattening custom colours", () => {
  const raw = { useThemeColors: false, plotColor: "#123456", secondaryColor: "#abcdef" };
  const [trend] = calculateIndicatorSeries(instance("super-trend", raw), bars, theme);
  const [diff] = calculateIndicatorSeries(instance("super-trend-difference", raw), bars, theme);
  assert.equal(trend.placement, "overlay"); assert.equal(trend.kind, "line");
  assert.equal(diff.placement, "pane"); assert.equal(diff.kind, "histogram");
  assert.equal(diff.includeZeroInScale, true);
  assert.deepEqual(new Set(trend.data.map(p => p.color)), new Set(["#123456", "#abcdef"]));
  diff.data.forEach((p, i) => {
    assert.equal(p.time, trend.data[i].time);
    assert.equal(p.value, bars[i + 9].close - trend.data[i].value);
    assert.equal(p.color, p.value < 0 ? "#abcdef" : "#123456");
  });
  const [themed] = calculateIndicatorSeries(instance("super-trend", { ...raw, useThemeColors: true }), bars, theme);
  assert.deepEqual(new Set(themed.data.map(p => p.color)), new Set([theme.positive, theme.negative]));
  assert.deepEqual(calculateIndicatorSeries({ ...instance("super-trend"), enabled: false }, bars, theme), []);
});

test("numeric bounds, scalar roundtrip, styles and per-instance scale", () => {
  for (const difference of [false, true]) {
    for (const field of superTrendNumericSettings(difference)) {
      assert.equal(normalizeSuperTrendSettings({ [field.key]: -100 }, difference)[field.key], field.min);
      assert.equal(normalizeSuperTrendSettings({ [field.key]: Infinity }, difference)[field.key], field.defaultValue);
      assert.equal(normalizeSuperTrendSettings({ [field.key]: 100000 }, difference)[field.key], field.max);
    }
    const stored = normalizeSuperTrendSettings({ shortName: " My trend ", lineStyle: "dotted", lineWidth: 3 }, difference);
    assert.deepEqual(normalizeSuperTrendSettings(JSON.parse(JSON.stringify(stored)), difference), stored);
  }
  const [plot] = calculateIndicatorSeries(instance("super-trend", { displayStyle: "points", lineStyle: "dashed",
    includeOnAutoCenter: false, useSecondaryAxis: true, valueLabel: true }), bars, theme);
  assert.equal(plot.lineVisible, false); assert.equal(plot.pointMarkersVisible, true);
  assert.equal(plot.lastValueVisible, false); assert.equal(plot.superTrendLabels.valueLabel, true);
  assert.equal(plot.excludeFromAutoScale, true);
  assert.equal(plot.priceScaleId, "super-trend-test-st");
  assert.equal(plot.lineStyle, "dashed");
});

const frame = (direction, sourceTimestamp, extra = {}) => ({ scopeKey: "NQ:1m:10:3:history1", live: true,
  now: sourceTimestamp, sourceTimestamp, point: { time: 100, value: 20, atr: 1, difference: 2, direction, reversed: true }, ...extra });

test("alert tracker suppresses historical baseline, rerender and repeated same-bar direction", () => {
  const tracker = new SuperTrendAlertTracker();
  assert.equal(tracker.update(frame("down", 100000)), null);
  assert.equal(tracker.update(frame("up", 100000)), null);
  assert.equal(tracker.update(frame("up", 100001)).direction, "up");
  assert.equal(tracker.update(frame("down", 100002)), null);
  assert.equal(tracker.update(frame("up", 100003)), null);
  assert.equal(tracker.update(frame("down", 100004, { point: { ...frame("down", 0).point, time: 101 } })).direction, "down");
});

test("alert scopes and stale/closed/replay/disconnected frames rebaseline silently", () => {
  for (const extra of [{ live: false }, { now: 130000 }, { sourceTimestamp: NaN }, { point: undefined },
    { scopeKey: "NQ:1m:20:3:history2" }]) {
    const tracker = new SuperTrendAlertTracker();
    tracker.update(frame("down", 100000));
    assert.equal(tracker.update(frame("up", 100001, extra)), null);
    assert.equal(tracker.update(frame("up", 100002)), null);
    assert.equal(tracker.update(frame("down", 100003)).direction, "down");
  }
});

test("difference histogram width is adjustable and legacy candle widths stay unchanged", () => {
  for (const width of [1, 2, 3, 4]) {
    const [plot] = calculateIndicatorSeries(instance("super-trend-difference", { lineWidth: width }), bars, theme);
    assert.equal(indicatorHistogramWidth(20, plot.histogramBarWidth), width);
    assert.equal(indicatorHistogramWidth(0.75, plot.histogramBarWidth), 0.75);
  }
  for (const width of [0.75, 3, 15, 80]) assert.equal(indicatorHistogramWidth(width), width);
});
