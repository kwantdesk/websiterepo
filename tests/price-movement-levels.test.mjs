import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { calculatePriceMovementLevels, normalizePriceMovementLevelSettings } from "../src/lib/priceMovementLevels.ts";

const theme = { primary: "#ffee00", secondary: "#aa44ff", positive: "#22cc66", negative: "#ee3344", muted: "#777777" };
const bar = (iso, open, high, low, close) => ({ timestamp: Date.parse(iso), open, high, low, close, volume: 1 });

test("DeepCharts-observed defaults and safe bounds normalize", () => {
  assert.deepEqual(normalizePriceMovementLevelSettings({}), {
    daysToLoad: 3, levelBasedOn: "open", stepMode: "percentual", stepValue: 0.5,
    fontSize: 11, minimumLevels: 5,
    supportLineStyle: "dashed", supportLineWidth: 2,
    resistanceLineStyle: "dashed", resistanceLineWidth: 2,
    zeroLineStyle: "dotted", zeroLineWidth: 2,
    customTimeEnabled: false, customStartTime: "00:00:00", customEndTime: "00:00:00", useThemeColors: true,
  });
  const bounded = normalizePriceMovementLevelSettings({ daysToLoad: 0, stepValue: 0, fontSize: 100, minimumLevels: 999 });
  assert.deepEqual([bounded.daysToLoad, bounded.stepValue, bounded.fontSize, bounded.minimumLevels], [1, 0.001, 50, 20]);
});

test("percentage levels are session-local and use the selected open", () => {
  const candles = [
    bar("2026-09-08T14:00:00Z", 100, 100.2, 99.8, 100.1),
    bar("2026-09-08T14:01:00Z", 100.1, 100.7, 99.9, 100.5),
    bar("2026-09-09T14:00:00Z", 200, 201, 199, 200.5),
  ];
  const series = calculatePriceMovementLevels(candles, { minimumLevels: 1, stepValue: 0.5 }, theme, 0.25);
  const resistance = series.find(item => item.key.endsWith("resistance-1"));
  const support = series.find(item => item.key.endsWith("support-1"));
  assert.deepEqual(resistance.data.map(point => point.value), [100.5, 100.5, 201]);
  assert.deepEqual(support.data.map(point => point.value), [99.5, 99.5, 199]);
  assert.equal(resistance.data[2].breakBefore, true);
});

test("tick mode multiplies true instrument ticks and refuses an unknown tick size", () => {
  const candles = [bar("2026-09-08T14:00:00Z", 100, 100.25, 99.75, 100)];
  assert.equal(calculatePriceMovementLevels(candles, { stepMode: "tick", stepValue: 4, minimumLevels: 1 }, theme, 0).length, 0);
  const series = calculatePriceMovementLevels(candles, { stepMode: "tick", stepValue: 4, minimumLevels: 1 }, theme, 0.25);
  assert.equal(series.find(item => item.key.endsWith("resistance-1")).data[0].value, 101);
});

test("close mode uses only the prior completed session close", () => {
  const candles = [
    bar("2026-09-08T14:00:00Z", 100, 101, 99, 100.25),
    bar("2026-09-08T20:00:00Z", 100.25, 102, 100, 101.5),
    bar("2026-09-09T14:00:00Z", 105, 106, 104, 105.5),
  ];
  const series = calculatePriceMovementLevels(candles, { levelBasedOn: "close", minimumLevels: 1 }, theme, 0.25);
  assert.equal(series[0].data[0].time, candles[2].timestamp / 1000);
  assert.equal(series[0].data[0].value, 101.5);
});

test("cross-midnight custom sessions exclude outside candles and retain the anchor day", () => {
  const candles = [
    bar("2026-09-08T21:00:00Z", 90, 91, 89, 90),
    bar("2026-09-08T23:00:00Z", 100, 101, 99, 100),
    bar("2026-09-09T03:00:00Z", 101, 102, 100, 101),
    bar("2026-09-09T12:00:00Z", 110, 111, 109, 110),
  ];
  const series = calculatePriceMovementLevels(candles, {
    customTimeEnabled: true, customStartTime: "17:00:00", customEndTime: "04:00:00", minimumLevels: 1,
  }, theme, 0.25);
  assert.equal(series[0].data.length, 2);
  assert.equal(series[0].data[0].time, candles[1].timestamp / 1000);
  assert.equal(series[0].data[1].time, candles[2].timestamp / 1000);
});

test("history count, colors, labels and persistence are wired", () => {
  const candles = [bar("2026-09-07T14:00:00Z", 100, 100.4, 99.6, 100), bar("2026-09-08T14:00:00Z", 110, 110.4, 109.6, 110)];
  const base = { instanceId: "pml", indicatorId: "price-movement-levels", enabled: true, settings: defaultIndicatorSettings("price-movement-levels") };
  assert.equal(calculateIndicatorSeries(base, candles, theme, { tickSize: 0.25 }).length, 11);
  const restored = normalizePaneIndicatorState({ pane: [{ ...base, settings: { ...base.settings, daysToLoad: 1, minimumLevels: 1,
    useThemeColors: false, supportLineColor: "#123456", resistanceLineColor: "#654321", zeroLineColor: "#abcdef", textColor: "#fedcba" } }] }).pane[0];
  const plotted = calculateIndicatorSeries(restored, candles, theme, { tickSize: 0.25 });
  assert.deepEqual(plotted.map(item => item.color), ["#abcdef", "#654321", "#123456"]);
  assert.ok(plotted.every(item => item.pivotLabels.color === "#fedcba"));
  assert.ok(plotted.every(item => item.data[0].time === candles[1].timestamp / 1000));
});

test("the complete public setting surface is reachable and Pending is removed", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "price-movement-levels"));
  const source = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8")
    + fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  for (const label of ["Days to load", "Level based on", "Step mode", "Step value", "Font size", "Minimum levels", "Support line width", "Resistance line width", "Zero line width", "Ini Time", "End Time"])
    assert.match(source, new RegExp(label, "i"));
});
