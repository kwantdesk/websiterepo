import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
const theme = { primary: "#11ff44", secondary: "#ffaa22", positive: "#44ff66", negative: "#ff7777", muted: "#bbbbbb" };
const bars = pairs => pairs.map(([high, low], i) => ({ timestamp: 1700000000000 + i * 60000, high, low, open: low, close: high, volume: 1 }));
const input = bars([[11,9],[12,10],[13,11],[14,12],[12,8],[11,7],[15,10]]);
const instance = (settings = {}) => ({ instanceId: "sar-a", indicatorId: "parabolic-sar", enabled: true, settings: { ...defaultIndicatorSettings("parabolic-sar"), ...settings } });
const calc = (settings = {}, candles = input) => calculateIndicatorSeries(instance(settings), candles, theme);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
test("explicit seed, accelerating continuation and both reversals match hand calculation", () => {
  const data = calc()[0].data;
  assert.equal(data.length, input.length - 1);
  [9, 9.06, 9.2176, 14, 14, 7].forEach((v, i) => near(data[i].value, v));
  assert.equal(data[0].time, input[1].timestamp / 1000);
  assert.deepEqual(calc({}, input.slice(0, 1)), []);
});
test("short startup is symmetric; equality triggers a reversal and ties seed long", () => {
  const mirrored = input.map(b => ({ ...b, high: -b.low, low: -b.high, open: -b.high, close: -b.low }));
  const a = calc()[0].data, b = calc({}, mirrored)[0].data;
  a.forEach((p, i) => near(b[i].value, -p.value));
  assert.equal(calc({}, bars([[11,9],[11,9]]))[0].data[0].value, 11);
  assert.equal(calc({}, bars([[11,9],[10.5,9.5]]))[0].data[0].value, 9);
});
test("maximum caps acceleration; zero step, bad numbers and setting changes are bounded", () => {
  assert.deepEqual(calc({ accelerationStep: 0.8, accelerationMaximum: 0.02 }), calc({ accelerationStep: 0.02, accelerationMaximum: 0.02 }));
  const zero = calc({ accelerationStep: 0 }, input.slice(0, 4))[0].data;
  assert.ok(zero.every(p => p.value === 9));
  assert.notDeepEqual(calc({ accelerationStep: 0.1 })[0].data, calc()[0].data);
  assert.ok(calc({ accelerationStep: NaN, accelerationMaximum: Infinity })[0].data.every(p => Number.isFinite(p.value)));
});
test("invalid data resets seed, closure gaps do not fabricate bars, event times stay distinct", () => {
  const broken = input.map(b => ({ ...b })); broken[3].high = NaN;
  const result = calc({}, broken)[0].data;
  assert.equal(result.length, 4);
  assert.equal(result[2].breakBefore, true);
  const event = input.map((b, i) => ({ ...b, timestamp: 1700000000000 + i }));
  assert.equal(new Set(calc({}, event)[0].data.map(p => p.time)).size, 6);
  const gap = input.map((b, i) => ({ ...b, timestamp: b.timestamp + (i > 3 ? 86400000 * 3 : 0) }));
  assert.deepEqual(calc({}, gap)[0].data.map(p => p.value), calc()[0].data.map(p => p.value));
});
test("forming bars do not rewrite prior values or introduce future timestamps", () => {
  const changed = input.map(b => ({ ...b })); changed.at(-1).high = 20;
  assert.deepEqual(calc({}, changed)[0].data.slice(0,-1), calc()[0].data.slice(0,-1));
  assert.deepEqual(calc({}, input.slice(0,4))[0].data, calc()[0].data.slice(0,3));
  assert.deepEqual(calculateIndicatorSeries({ ...instance(), enabled: false }, input, theme), []);
});
test("directional colours, theme/custom ownership, styles and persistence work", () => {
  const settings = { secondaryColorEnabled: true, useThemeColors: false, plotColor: "#123456", secondaryColor: "#abcdef", displayStyle: "line-points", lineWidth: 4, lineStyle: "dashed", useSecondaryAxis: true };
  const series = calc(settings)[0];
  assert.equal(series.data[0].color, "#123456"); assert.equal(series.data[3].color, "#abcdef");
  assert.equal(series.pointMarkersVisible, true); assert.equal(series.lineVisible, true);
  assert.equal(series.priceScaleId, "sar-sar-a"); assert.equal(series.lineWidth, 4);
  const restored = normalizePaneIndicatorState(JSON.parse(JSON.stringify({ pane: [instance(settings)] }))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored, input, theme), calc(settings));
  const themed = calc({ ...settings, useThemeColors: true })[0];
  assert.equal(themed.data[0].color, theme.primary); assert.equal(themed.data[3].color, theme.secondary);
});
test("actual Chart options render dots, allow line switching and restore the candle scale", () => {
  const file = ts.createSourceFile("Chart.tsx", readFileSync("src/components/Chart.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(file) === "options" && node.initializer?.getText(file).includes("definition.horizontalPriceLine")) expression = node.initializer.getText(file); ts.forEachChild(node, visit); }; visit(file);
  const evaluate = definition => vm.runInNewContext(`(${expression})`, { kind: "line", definition, LineStyle: { Solid:0, Dashed:2, Dotted:1 }, LineType: { Simple:0, WithSteps:1 } });
  const points = evaluate(calc()[0]); assert.equal(points.lineVisible, false); assert.equal(points.pointMarkersVisible, true); assert.equal(points.priceScaleId, "right");
  const line = evaluate(calc({ displayStyle: "line", useSecondaryAxis: true })[0]); assert.equal(line.lineVisible, true); assert.equal(line.pointMarkersVisible, false); assert.equal(line.priceScaleId, "sar-sar-a");
  const legacy = evaluate({ color: "red" }); assert.equal(legacy.pointMarkersVisible, undefined); assert.equal(legacy.priceScaleId, undefined);
});
