import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { normalizePivotPointSettings } from "../src/lib/pivotPoints.ts";
import { PivotPointLabels } from "../src/lib/pivotPointLabels.ts";

const theme = { primary: "#d4af37", secondary: "#94a3b8", positive: "#22c55e", negative: "#ef4444", muted: "#64748b" };
const candle = (iso, open, high, low, close) => ({ timestamp: Date.parse(iso), open, high, low, close, volume: 1 });
const instance = (settings = {}) => ({
  instanceId: "pivot-test",
  indicatorId: "pivot-points",
  enabled: true,
  settings: { ...defaultIndicatorSettings("pivot-points"), ...settings },
});

test("stock daily pivots project the prior completed exchange day onto the current day", () => {
  const candles = [
    candle("2026-07-06T15:00:00Z", 100, 110, 90, 98),
    candle("2026-07-06T20:00:00Z", 98, 108, 92, 100),
    candle("2026-07-07T15:00:00Z", 105, 120, 100, 108),
    candle("2026-07-07T20:00:00Z", 108, 118, 102, 110),
    candle("2026-07-08T15:00:00Z", 112, 116, 106, 114),
    candle("2026-07-08T20:00:00Z", 114, 119, 109, 116),
  ];
  const result = calculateIndicatorSeries(instance(), candles, theme);
  assert.deepEqual(result.map((series) => series.label), ["P", "R1", "R2", "S1", "S2"]);
  assert.deepEqual(result.map((series) => series.data[0].value), [110, 120, 130, 100, 90]);
  assert.ok(result.every((series) => series.data[0].time === candles[4].timestamp / 1_000));
  assert.ok(result.every((series) => series.data.at(-1).time === candles[5].timestamp / 1_000));
  assert.ok(result.every((series) => series.lastValueVisible === false));
});

test("period count, custom hourly reference and segment breaks are real settings", () => {
  const candles = [
    candle("2026-07-06T10:00:00Z", 10, 12, 8, 9),
    candle("2026-07-06T10:30:00Z", 9, 11, 9, 10),
    candle("2026-07-06T11:00:00Z", 10, 13, 9, 12),
    candle("2026-07-06T11:30:00Z", 12, 14, 11, 13),
    candle("2026-07-06T12:00:00Z", 13, 15, 12, 14),
    candle("2026-07-06T12:30:00Z", 14, 16, 13, 15),
  ];
  const result = calculateIndicatorSeries(instance({
    customReferenceEnabled: true,
    referenceTimeframe: "hour",
    referenceValue: 1,
    periodsToShow: 2,
  }), candles, theme);
  assert.equal(result[0].data.length, 4);
  assert.equal(result[0].data[2].breakBefore, true);
  assert.equal(result[0].data[0].value, 10);
  assert.equal(result[0].data[2].value, 12);
});

test("custom exchange session excludes bars outside its exact window", () => {
  const candles = [
    candle("2026-07-06T13:00:00Z", 100, 500, 1, 300), // 08:00 Chicago: excluded
    candle("2026-07-06T14:00:00Z", 100, 110, 90, 100),
    candle("2026-07-06T20:00:00Z", 100, 105, 95, 102),
    candle("2026-07-07T14:00:00Z", 102, 112, 98, 106),
    candle("2026-07-07T20:00:00Z", 106, 114, 100, 108),
  ];
  const result = calculateIndicatorSeries(instance({
    customSessionEnabled: true,
    customSessionStart: "08:30:00",
    customSessionEnd: "15:15:00",
  }), candles, theme);
  assert.equal(result[0].data[0].value, (110 + 90 + 102) / 3);
});

test("settings clamp invalid input and preserve the documented DLL enums", () => {
  assert.deepEqual(normalizePivotPointSettings({
    fontSize: 100,
    lineWidth: 8,
    lineStyle: "invalid",
    labelAlign: "invalid",
    periodsToShow: 0,
    customReferenceEnabled: true,
    referenceTimeframe: "week",
    referenceValue: -1,
    customSessionEnabled: true,
    customSessionStart: "25:99",
    customSessionEnd: "15:15",
  }), {
    fontSize: 40,
    lineWidth: 4,
    lineStyle: "dashed",
    labelAlign: "left",
    periodsToShow: 1,
    customReferenceEnabled: true,
    referenceTimeframe: "week",
    referenceValue: 1,
    customSessionEnabled: true,
    customSessionStart: "00:00:00",
    customSessionEnd: "15:15:00",
    useThemeColors: true,
  });
});

test("theme colours, explicit overrides and persisted settings reach all five plots", () => {
  const candles = [
    candle("2026-07-06T15:00:00Z", 100, 110, 90, 100),
    candle("2026-07-07T15:00:00Z", 100, 112, 95, 105),
  ];
  const themed = calculateIndicatorSeries(instance(), candles, theme);
  assert.deepEqual(themed.map((series) => series.color), [theme.primary, theme.negative, theme.negative, theme.positive, theme.positive]);
  const customInstance = instance({ useThemeColors: false, pivotPointColor: "#111111", r1Color: "#222222", r2Color: "#333333", s1Color: "#444444", s2Color: "#555555" });
  const restored = normalizePaneIndicatorState(JSON.parse(JSON.stringify({ pane: [customInstance] }))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored, candles, theme).map((series) => series.color), ["#111111", "#222222", "#333333", "#444444", "#555555"]);
});

test("label primitive honours left and right segment anchors", () => {
  const labels = new PivotPointLabels();
  const painted = [];
  labels.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time) => Number(time) }) },
    series: { priceToCoordinate: (price) => price },
    requestUpdate: () => {},
  });
  labels.update([
    { time: 10, value: 20 }, { time: 30, value: 20 },
    { time: 40, value: 25, breakBefore: true }, { time: 60, value: 25 },
  ], { label: "P", align: "left", fontSize: 12 }, "#abcdef");
  const context = {
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    fillText: (text, x, y) => painted.push({ text, x, y }),
    set fillStyle(_) {}, set font(_) {}, set textBaseline(_) {}, set textAlign(_) {},
  };
  labels.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 100, height: 100 } }) });
  assert.deepEqual(painted.map((row) => row.x), [14, 44]);
  painted.length = 0;
  labels.update([{ time: 10, value: 20 }, { time: 30, value: 20 }], { label: "P", align: "right", fontSize: 12 }, "#abcdef");
  labels.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 100, height: 100 } }) });
  assert.deepEqual(painted.map((row) => row.x), [26]);
});

test("release gates and actual settings controls are reachable", () => {
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "pivot-points"));
  const control = readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8");
  for (const evidence of ["Pivot point line style", "Pivot point label alignment", "Enable custom reference timeframe", "Custom time session"]) {
    assert.match(control, new RegExp(evidence, "i"));
  }
});
