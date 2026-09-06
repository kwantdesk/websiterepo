import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { inverseCyberCycleValues, normalizeInverseCyberCycleSettings } from "../src/lib/inverseCyberCycle.ts";

const theme = { primary: "#11FF44", secondary: "#22AAFF", positive: "#44FF66", negative: "#FF4477", muted: "#778899" };
const candles = (count, price = (index) => 100 + Math.sin(index / 7) * 4 + Math.cos(index / 19) * 2) =>
  Array.from({ length: count }, (_, index) => {
    const close = price(index);
    return { timestamp: 1_700_000_000_000 + index * 60_000, open: close - 0.2, high: close + 0.8, low: close - 0.7, close, volume: 100 + index };
  });

test("observable defaults and DLL-backed bounds are retained", () => {
  const defaults = defaultIndicatorSettings("inverse-cyber-cycle");
  assert.deepEqual(
    [defaults.smoothingAlpha, defaults.cycleALength, defaults.cycleBLength, defaults.middleLevel, defaults.lowLevel, defaults.highLevel],
    [0.01, 21, 84, 0, -0.6, 0.6],
  );
  const normalized = normalizeInverseCyberCycleSettings({ smoothingAlpha: 0, cycleALength: 1, cycleBLength: 9999, lowLevel: 0.9, middleLevel: 0.8, highLevel: -1 });
  assert.deepEqual(
    [normalized.smoothingAlpha, normalized.cycleALength, normalized.cycleBLength, normalized.lowLevel, normalized.middleLevel, normalized.highLevel],
    [0.001, 5, 2000, -0.6, 0, 0.6],
  );
});

test("both cycle windows warm up exactly and remain inverse-Fisher bounded", () => {
  const values = inverseCyberCycleValues(candles(220));
  assert.equal(values.cycleA.slice(0, 20).every(value => value == null), true);
  assert.equal(values.cycleB.slice(0, 83).every(value => value == null), true);
  assert.equal(values.cycleA[20] != null, true);
  assert.equal(values.cycleB[83] != null, true);
  const finite = [...values.cycleA, ...values.cycleB].filter(value => value != null);
  assert.ok(finite.length > 200);
  assert.ok(finite.every(value => Math.abs(value) <= Math.tanh(1) + 1e-12));
  assert.notDeepEqual(values.cycleA.slice(-40), values.cycleB.slice(-40));
});

test("constant prices produce stable zero cycles without gaps or NaN", () => {
  const values = inverseCyberCycleValues(candles(120, () => 100));
  assert.ok(values.cycleA.slice(20).every(value => value === 0));
  assert.ok(values.cycleB.slice(83).every(value => value === 0));
});

test("pane output contains two cycles and three full-width levels", () => {
  const instance = { instanceId: "icc-test", indicatorId: "inverse-cyber-cycle", enabled: true, settings: defaultIndicatorSettings("inverse-cyber-cycle") };
  const series = calculateIndicatorSeries(instance, candles(150), theme);
  assert.equal(series.length, 5);
  assert.deepEqual(series.slice(0, 2).map(item => item.color), [theme.primary, theme.negative]);
  assert.deepEqual(series.slice(2).map(item => item.data[0].value), [0, -0.6, 0.6]);
  assert.ok(series.slice(2).every(item => item.horizontalPriceLine && item.data.length === 1));
});

test("custom subgraph colours and secondary scale survive persistence", () => {
  const saved = normalizePaneIndicatorState({ pane: [{ instanceId: "icc-custom", indicatorId: "inverse-cyber-cycle", enabled: true, settings: {
    ...defaultIndicatorSettings("inverse-cyber-cycle"), useThemeColors: false, useSecondaryAxis: true,
    cycleAColor: "#112233", cycleBColor: "#445566", middleLevelColor: "#778899", lowLevelColor: "#AA2233", highLevelColor: "#22AA33",
  } }] }).pane[0];
  const series = calculateIndicatorSeries(saved, candles(150), theme);
  assert.deepEqual(series.map(item => item.color), ["#112233", "#445566", "#778899", "#AA2233", "#22AA33"]);
  assert.equal(series[1].independentScale, true);
});

test("release registration, pane renderer and controls are all reachable", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "inverse-cyber-cycle"));
  const source = ["src/components/Chart.tsx", "src/components/ChartIndicatorsControl.tsx", "src/components/ChartIndicatorPanes.tsx", "src/lib/chartIndicatorConfig.ts"]
    .map(file => readFileSync(file, "utf8")).join("\n");
  for (const evidence of ["Inverse Cyber Cycle", "Smoothing Alpha", "Subgraphs", "definition.horizontalPriceLine"]) assert.match(source, new RegExp(evidence, "i"));
});

test("calculation remains linear on deep chart histories", () => {
  const history = candles(20_000);
  const started = performance.now();
  const values = inverseCyberCycleValues(history);
  assert.equal(values.cycleA.length, history.length);
  assert.equal(values.cycleB.length, history.length);
  assert.ok(performance.now() - started < 1_000);
});
