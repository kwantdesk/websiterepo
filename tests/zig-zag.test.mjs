import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { calculateZigZagPivots, normalizeZigZagSettings } from "../src/lib/zigZag.ts";
import { ZigZagRetracementPrimitive } from "../src/lib/zigZagRetracementPrimitive.ts";

const theme = { primary: "#f8fafc", secondary: "#f59e0b", positive: "#22c55e", negative: "#ef4444", muted: "#64748b" };
const candles = (values) => values.map((value, index) => ({
  timestamp: 1_700_000_000_000 + index * 60_000,
  open: value, close: value, high: value + 0.25, low: value - 0.25, volume: 10,
}));

test("settings reproduce the observable DeepCharts Zig Zag defaults and clamp unsafe values", () => {
  const defaults = defaultIndicatorSettings("zig-zag");
  assert.equal(defaults.zigZagMode, "highest-lowest");
  assert.equal(defaults.absoluteReversalPercent, 0.5);
  assert.equal(defaults.tickReversalOrLookback, 10);
  assert.equal(defaults.lineWidth, 2);
  assert.deepEqual([defaults.showRetracement38, defaults.showRetracement50, defaults.showRetracement62, defaults.showRetracement75], [true, true, true, false]);
  const normalized = normalizeZigZagSettings({ zigZagMode: "invalid", absoluteReversalPercent: -2, tickReversalOrLookback: 0, lineWidth: 9, retracementFontSize: 99 });
  assert.deepEqual([normalized.zigZagMode, normalized.absoluteReversalPercent, normalized.tickReversalOrLookback, normalized.lineWidth, normalized.retracementFontSize], ["highest-lowest", 0.01, 1, 4, 40]);
});

test("absolute reversal confirms alternating percentage swings and keeps the live extreme provisional", () => {
  const pivots = calculateZigZagPivots(candles([100, 103, 102, 98, 99, 105, 104]), {
    zigZagMode: "absolute-reversal", absoluteReversalPercent: 2,
  }, 0.25);
  assert.ok(pivots.length >= 4);
  assert.deepEqual(pivots.slice(0, 4).map(pivot => [pivot.index, pivot.kind]), [[0, "low"], [1, "high"], [3, "low"], [5, "high"]]);
  assert.ok(pivots.every((pivot, index) => index === 0 || pivot.kind !== pivots[index - 1].kind));
  assert.equal(pivots.at(-1).provisional, true);
});

test("tick reversal uses the actual instrument tick size and refuses to invent one", () => {
  const sample = candles([100, 101, 100, 99, 101]);
  assert.equal(calculateZigZagPivots(sample, { zigZagMode: "tick-reversal", tickReversalOrLookback: 4 }).length, 0);
  assert.ok(calculateZigZagPivots(sample, { zigZagMode: "tick-reversal", tickReversalOrLookback: 4 }, 0.25).length >= 2);
});

test("renderer produces fixed directional series and retracement values from the newest swing", () => {
  const instance = { instanceId: "zig-test", indicatorId: "zig-zag", enabled: true, settings: {
    ...defaultIndicatorSettings("zig-zag"), zigZagMode: "absolute-reversal", absoluteReversalPercent: 1,
  } };
  const series = calculateIndicatorSeries(instance, candles([100, 103, 99, 105, 101]), theme, { tickSize: 0.25 });
  assert.equal(series.length, 3);
  assert.deepEqual(series.slice(0, 2).map(item => item.color), [theme.positive, theme.negative]);
  assert.equal(series[2].lineVisible, false);
  assert.deepEqual(series[2].zigZagRetracements.levels.map(level => level.ratio), [0.382, 0.5, 0.618]);
  assert.ok(series[2].zigZagRetracements.levels.every(level => Number.isFinite(level.value)));
});

test("custom colours persist and replace all three plotted colour roles", () => {
  const saved = normalizePaneIndicatorState({ pane: [{ instanceId: "zig-custom", indicatorId: "zig-zag", enabled: true, settings: {
    ...defaultIndicatorSettings("zig-zag"), zigZagMode: "absolute-reversal", absoluteReversalPercent: 1,
    useThemeColors: false, upColor: "#112233", downColor: "#445566", retracementLineColor: "#778899",
  } }] }).pane[0];
  assert.deepEqual(calculateIndicatorSeries(saved, candles([100, 103, 99, 105, 101]), theme, { tickSize: 0.25 }).map(item => item.color), ["#112233", "#445566", "#778899"]);
});

test("retracement primitive draws bounded lines and extends to the visible right edge when selected", () => {
  const lines = [];
  const primitive = new ZigZagRetracementPrimitive();
  primitive.attached({ chart: { timeScale: () => ({ timeToCoordinate: value => Number(value) }) }, series: { priceToCoordinate: value => value }, requestUpdate() {} });
  primitive.update({ startTime: 10, endTime: 40, levels: [{ ratio: 0.5, label: "50", value: 25 }], extendRight: true,
    fontSize: 11, lineWidth: 1, lineColor: "#fff", textColor: "#fff", backgroundColor: "#000" });
  const context = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, moveTo(x, y) { lines.push([x, y]); }, lineTo(x, y) { lines.push([x, y]); }, stroke() {}, setLineDash() {}, measureText: () => ({ width: 12 }), fillRect() {}, fillText() {}, set strokeStyle(_) {}, set lineWidth(_) {}, set font(_) {}, set textBaseline(_) {}, set fillStyle(_) {} };
  primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: draw => draw({ context, mediaSize: { width: 100, height: 80 } }) });
  assert.deepEqual(lines, [[10, 25], [100, 25]]);
});

test("release registration and controls are reachable only after real implementation", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "zig-zag"));
  const source = readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8") + readFileSync("src/lib/chartIndicatorConfig.ts", "utf8") + readFileSync("src/lib/zigZag.ts", "utf8");
  for (const evidence of ["Highest lowest", "Absolute reversal", "Tick reversal", "Retracement font size"]) assert.match(source, new RegExp(evidence, "i"));
});

test("highest-lowest calculation stays linear across deep chart history", () => {
  const history = candles(Array.from({ length: 20_000 }, (_, index) => 100 + Math.sin(index / 25) * 8 + index / 10_000));
  const started = performance.now();
  const pivots = calculateZigZagPivots(history, { zigZagMode: "highest-lowest", tickReversalOrLookback: 10 }, 0.25);
  assert.ok(pivots.length > 10);
  assert.ok(performance.now() - started < 1_000);
});
