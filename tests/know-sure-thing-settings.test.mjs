import { test } from "node:test";
import assert from "node:assert/strict";
import { KST_DEFAULTS, KST_NUMERIC_SETTINGS, normalizeKstSettings, kstParametersFromSettings, kstRequiredBars } from "../src/lib/knowSureThingSettings.ts";
import { calculateKstSeries } from "../src/lib/knowSureThingSeries.ts";
import { calculateKstValues } from "../src/lib/knowSureThing.ts";
const theme = { primary: "#33ff88", secondary: "#ff9922", negative: "#ff4488", positive: "#22ffff", muted: "#999999" };
const bars = Array.from({ length: 200 }, (_, i) => ({ timestamp: 1700000000000 + i * 73, close: 100 + i / 10 + Math.sin(i / 5) * 10 }));
const find = (series, key) => series.find(s => s.key === `know-sure-thing-kst-${key}`);

test("observed defaults, all numeric limits, boolean types and saveable scalar settings", () => {
  assert.equal(KST_DEFAULTS.usePercent, false);
  assert.equal(KST_DEFAULTS.kstLineWidth, 2);
  assert.equal(KST_DEFAULTS.signalLineStyle, "dashed");
  for (const field of KST_NUMERIC_SETTINGS) {
    assert.equal(normalizeKstSettings({ [field.key]: Infinity })[field.key], field.defaultValue);
    assert.equal(normalizeKstSettings({ [field.key]: -Infinity })[field.key], field.defaultValue);
    assert.equal(normalizeKstSettings({ [field.key]: field.max * 100 + 100 })[field.key], field.max);
    assert.equal(normalizeKstSettings({ [field.key]: field.min - 100 })[field.key], field.min);
  }
  const raw = { ...KST_DEFAULTS, averageType: "triangular", usePercent: true, kstShortName: "  Custom momentum  ", kstValueLabel: true, kstNameBackground: true, kstColor: "#1133ff", useThemeColors: false, roc1: 77 };
  const normalized = normalizeKstSettings(raw);
  assert.deepEqual(normalizeKstSettings(JSON.parse(JSON.stringify(normalized))), normalized);
  assert.equal(normalized.kstShortName, "Custom momentum");
  assert.equal(normalizeKstSettings({ averageType: "wilder" }).averageType, "simple");
  assert.equal(normalizeKstSettings({ usePercent: "false" }).usePercent, false);
  assert.equal(normalizeKstSettings({ kstShortName: " " }).kstShortName, "KST");
  assert.equal(normalizeKstSettings({ kstShortName: "x".repeat(200) }).kstShortName.length, 24);
});

test("every horizon, smoothing and raw/percent choice reaches exact calculator output", () => {
  const changed = [...KST_NUMERIC_SETTINGS.filter(s => /^(roc|average|signalPeriod)/.test(s.key)).map(s => ({ [s.key]: 3 })),
    ...["simple", "exponential", "triangular", "weighted"].map(averageType => ({ averageType })), { usePercent: true }];
  for (const settings of changed) {
    const expected = calculateKstValues(bars, kstParametersFromSettings(settings));
    const actual = calculateKstSeries(bars, settings, theme);
    for (const key of ["kst", "signal"]) assert.deepEqual(find(actual, key).data.map(({ time, value, breakBefore }) => ({ time, value, ...(breakBefore ? { breakBefore } : {}) })), expected[key]);
  }
  assert.equal(kstRequiredBars({}), 53);
  assert.equal(kstRequiredBars(Object.fromEntries(KST_NUMERIC_SETTINGS.filter(s => /^(roc|average|signalPeriod)/.test(s.key)).map(s => [s.key, 1000]))), 2999);
});

test("per-plot slope and theme/custom colours remain separate with raw data immutable", () => {
  const before = JSON.stringify(bars);
  const result = calculateKstSeries(bars, {}, theme);
  assert.deepEqual(new Set(find(result, "kst").data.map(p => p.color)), new Set([theme.primary, theme.negative]));
  assert.deepEqual(new Set(find(result, "signal").data.map(p => p.color)), new Set([theme.secondary]));
  const settings = { useThemeColors: false, kstColor: "#111111", kstSecondaryColor: "#222222", signalColor: "#333333", signalSecondaryColor: "#444444", middleColor: "#555555", signalColorMode: "slope" };
  const custom = calculateKstSeries(bars, settings, theme);
  assert.deepEqual(new Set(find(custom, "kst").data.map(p => p.color)), new Set(["#111111", "#222222"]));
  assert.deepEqual(new Set(find(custom, "signal").data.map(p => p.color)), new Set(["#333333", "#444444"]));
  assert.equal(find(custom, "middle").color, "#555555");
  const freshTheme = { ...theme, primary: "#00ccff" };
  assert.equal(find(calculateKstSeries(bars, { ...settings, useThemeColors: true }, freshTheme), "kst").color, freshTheme.primary);
  assert.equal(JSON.stringify(bars), before);
});

test("independent style/labels/visibility and middle line output have no inert adapter controls", () => {
  const settings = { kstShortName: "Momentum", kstDisplayStyle: "points", kstLineStyle: "dotted", kstLineWidth: 4, kstColorMode: "none", kstAutoCenter: false,
    kstNameLabel: true, kstValueLabel: true, kstNameBackground: true, kstValueBackground: true, kstChartMarker: true,
    signalDisplayStyle: "line-points", signalLineWidth: 3, middleLevel: 123, middleLineWidth: 2 };
  const series = calculateKstSeries(bars, settings, theme), kst = find(series, "kst");
  assert.equal(kst.label, "Momentum"); assert.equal(kst.lineVisible, false); assert.equal(kst.pointMarkersVisible, true);
  assert.equal(kst.lineStyle, "dotted"); assert.equal(kst.lineWidth, 4); assert.equal(kst.excludeFromAutoScale, true);
  assert.ok(Object.values(kst.kstPresentation).every(v => v === true));
  assert.equal(new Set(kst.data.map(p => p.color)).size, 1);
  assert.equal(find(series, "signal").lineVisible, true); assert.equal(find(series, "signal").pointMarkersVisible, true);
  assert.equal(find(series, "middle").data[0].value, 123); assert.equal(find(series, "middle").lineWidth, 2);
  assert.equal(calculateKstSeries(bars, { showKst: false, showSignal: false, showMiddle: false }, theme).length, 0);
  assert.equal(calculateKstSeries(bars.slice(0, 44), {}, theme).length, 0);
});
