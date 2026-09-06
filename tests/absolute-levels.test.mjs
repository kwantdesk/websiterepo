import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";

const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
const candles = [100, 101, 102].map((close, index) => ({ timestamp: 1700000000000 + index * 60000, open: close, high: close + 1, low: close - 1, close, volume: 1 }));
const instance = (settings = {}) => ({ instanceId: "manual-reference", indicatorId: "absolute-levels", enabled: true, settings: { ...defaultIndicatorSettings("absolute-levels"), firstValue: 100.25, secondValue: 101.5, ...settings } });

test("exact independent manual levels do not infer values or add chart times", () => {
  const result = calculateIndicatorSeries(instance(), candles, theme);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(s => s.data), [[{ time: candles.at(-1).timestamp / 1000, value: 100.25 }], [{ time: candles.at(-1).timestamp / 1000, value: 101.5 }]]);
  assert.ok(result.every(s => s.horizontalPriceLine && s.excludeFromAutoScale));
  const changed = calculateIndicatorSeries(instance({ firstValue: 100.26 }), candles, theme);
  assert.equal(changed[0].data[0].value, 100.26);
  assert.deepEqual(changed[1], result[1]);
});

test("negative and zero prices remain valid; invalid/empty values never become fake levels", () => {
  assert.deepEqual(calculateIndicatorSeries(instance({ firstValue: -37.63, secondValue: 0 }), candles, theme).map(s => s.data[0].value), [-37.63, 0]);
  for (const bad of ["", null, "not-a-number", Infinity, NaN, true]) {
    assert.equal(calculateIndicatorSeries(instance({ firstValue: bad }), candles, theme).length, 1);
  }
  assert.deepEqual(calculateIndicatorSeries(instance(), [], theme), []);
  assert.deepEqual(calculateIndicatorSeries({ ...instance(), enabled: false }, candles, theme), []);
});

test("separate line styles, widths, theme colours and explicit overrides work", () => {
  const study = instance({ firstLineStyle: "dashed", secondLineStyle: "dotted", firstLineWidth: 4, secondLineWidth: 2, firstLineColor: "#123456", secondLineColor: "#654321" });
  const themed = calculateIndicatorSeries(study, candles, theme);
  assert.deepEqual(themed.map(s => s.color), [theme.primary, theme.secondary]);
  assert.deepEqual(themed.map(s => s.lineStyle), ["dashed", "dotted"]);
  assert.deepEqual(themed.map(s => s.lineWidth), [4, 2]);
  const custom = calculateIndicatorSeries({ ...study, settings: { ...study.settings, useThemeColors: false } }, candles, theme);
  assert.deepEqual(custom.map(s => s.color), ["#123456", "#654321"]);
  const restored = normalizePaneIndicatorState(JSON.parse(JSON.stringify({ pane: [study] }))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored, candles, theme), themed);
});

test("real overlay options extend references across the pane without squeezing candles", () => {
  const file = ts.createSourceFile("Chart.tsx", readFileSync("src/components/Chart.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "options" && node.initializer?.getText(file).includes("definition.horizontalPriceLine")) expression = node.initializer.getText(file);
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(expression, "exercise the actual Chart overlay options, not a duplicate");
  const definition = calculateIndicatorSeries(instance({ firstLineWidth: 3, firstLineStyle: "dotted" }), candles, theme)[0];
  const evaluate = d => vm.runInNewContext(`(${expression})`, { kind: "line", definition: d, LineStyle: { Solid: 0, Dashed: 2, Dotted: 1 }, LineType: { Simple: 0, WithSteps: 1 } });
  const options = evaluate(definition);
  assert.equal(options.priceLineVisible, true);
  assert.equal(options.priceLineColor, theme.primary);
  assert.equal(options.priceLineWidth, 3);
  assert.equal(options.priceLineStyle, 1);
  assert.equal(options.autoscaleInfoProvider(), null);
  const normal = evaluate({ color: theme.primary });
  assert.equal(normal.priceLineVisible, false);
  assert.equal(normal.autoscaleInfoProvider, undefined);
});

test("release is reachable and work stays constant with a large candle history", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(r => r.id === "absolute-levels"));
  const large = Array.from({ length: 100000 }, (_, i) => ({ ...candles[0], timestamp: 1700000000000 + i * 60000 }));
  assert.equal(calculateIndicatorSeries(instance(), large, theme).flatMap(s => s.data).length, 2);
});
