import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { ichimokuValues, normalizeIchimokuSettings } from "../src/lib/ichimoku.ts";

const theme = { primary: "#1188FF", secondary: "#AA55FF", positive: "#22CC66", negative: "#EE3355", muted: "#778899" };
const candles = (count) => Array.from({ length: count }, (_, index) => {
  const close = 100 + index * 0.2 + Math.sin(index / 4) * 3;
  return { timestamp: 1_700_000_000_000 + index * 60_000, open: close - 0.4, high: close + 1, low: close - 1.2, close, volume: 100 + index };
});

test("screenshot defaults and DLL public bounds are retained", () => {
  const defaults = defaultIndicatorSettings("ichimoku-indicator");
  assert.deepEqual([defaults.conversionLinePeriod, defaults.baseLinePeriod, defaults.laggingSpanPeriod], [9, 26, 52]);
  const normalized = normalizeIchimokuSettings({ conversionLinePeriod: 0, baseLinePeriod: 9999, laggingSpanPeriod: 2.2 });
  assert.deepEqual([normalized.conversionLinePeriod, normalized.baseLinePeriod, normalized.laggingSpanPeriod], [1, 1000, 2]);
});

test("standard five plots use correct warmup and displacement", () => {
  const source = candles(120);
  const values = ichimokuValues(source);
  assert.equal(values.tenkan.slice(0, 8).every(value => value == null), true);
  assert.equal(values.tenkan[8] != null, true);
  assert.equal(values.kijun.slice(0, 25).every(value => value == null), true);
  assert.equal(values.spanB.length, 69);
  assert.equal(values.spanB[0].time, source[77].timestamp);
  assert.equal(values.chikou[0].time, source[0].timestamp);
  assert.equal(values.chikou[0].value, source[26].close);
  assert.ok(values.spanA.at(-1).time > source.at(-1).timestamp);
});

test("engine returns four named components, both cloud boundaries and a real fill contract", () => {
  const instance = { instanceId: "ichi-test", indicatorId: "ichimoku-indicator", enabled: true, settings: defaultIndicatorSettings("ichimoku-indicator") };
  const series = calculateIndicatorSeries(instance, candles(120), theme);
  assert.equal(series.length, 5);
  assert.deepEqual(series.map(item => item.color), [theme.primary, theme.negative, theme.secondary, theme.positive, theme.negative]);
  assert.ok(series[3].ichimokuCloud?.points.length > 50);
  assert.equal(series[3].ichimokuCloud?.opacity, 0.14);
  assert.ok(series[3].data.at(-1).time > candles(120).at(-1).timestamp / 1_000);
});

test("custom styling and secondary scale survive stored-state normalization", () => {
  const stored = normalizePaneIndicatorState({ pane: [{ instanceId: "ichi-custom", indicatorId: "ichimoku-indicator", enabled: true, settings: {
    ...defaultIndicatorSettings("ichimoku-indicator"), useThemeColors: false, useSecondaryAxis: true,
    tenkanColor: "#112233", kijunColor: "#223344", chikouColor: "#334455", senkouColor: "#445566", senkouSecondaryColor: "#556677",
    bullishCloudColor: "#667788", bearishCloudColor: "#778899", tenkanLineStyle: "dashed", showCloud: false,
  } }] }).pane[0];
  const series = calculateIndicatorSeries(stored, candles(120), theme);
  assert.deepEqual(series.map(item => item.color), ["#112233", "#223344", "#334455", "#445566", "#556677"]);
  assert.ok(series.every(item => item.priceScaleId === "ichimoku-ichi-custom"));
  assert.equal(series[0].lineStyle, "dashed");
  assert.equal(series[3].ichimokuCloud?.opacity, 0);
});

test("library, renderer, cloud primitive and controls are release-reachable", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "ichimoku-indicator"));
  const source = ["src/components/Chart.tsx", "src/components/ChartIndicatorsControl.tsx", "src/lib/chartIndicatorConfig.ts", "src/lib/ichimokuCloudPrimitive.ts"]
    .map(file => readFileSync(file, "utf8")).join("\n");
  for (const evidence of ["IchimokuCloudPrimitive", "Conversion line period", "Senkou Span", "ichimoku-indicator"]) assert.match(source, new RegExp(evidence, "i"));
});

test("20,000-bar calculation remains linear and bounded", () => {
  const source = candles(20_000);
  const started = performance.now();
  const values = ichimokuValues(source);
  assert.equal(values.tenkan.length, source.length);
  assert.ok(values.spanA.length > 19_000);
  assert.ok(performance.now() - started < 1_000);
});
