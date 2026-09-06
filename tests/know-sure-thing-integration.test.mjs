import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { kstRequiredBars } from "../src/lib/knowSureThingSettings.ts";

const theme = { primary: "#33ff88", secondary: "#ff9922", negative: "#ff4488", positive: "#22ffff", muted: "#999999" };
const bars = Array.from({ length: 200 }, (_, i) => ({ timestamp: 1700000000000 + i * 73, close: 100 + i / 10 + Math.sin(i / 5) * 10 }));
const instance = settings => ({ instanceId: "kst-one", indicatorId: "know-sure-thing-kst", enabled: true, settings: { ...defaultIndicatorSettings("know-sure-thing-kst"), ...settings } });
const bundle = ts.transpileModule(readFileSync("src/components/KstPanePlot.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const renderedModule = { exports: {} };
new Function("require", "module", "exports", bundle)(createRequire(import.meta.url), renderedModule, renderedModule.exports);
const Plot = renderedModule.exports.default;
const bounds = { left: 10, top: 20, right: 110, bottom: 120 };

test("real engine registration, per-plot colours, disabled state and persisted settings", () => {
  const item = instance({ useThemeColors: false, kstColor: "#112233", kstSecondaryColor: "#aabbcc", kstNameLabel: true, kstShortName: "Saved name" });
  const output = calculateIndicatorSeries(item, bars, theme, { instrument: "SPX" });
  assert.deepEqual(new Set(output[0].data.map(p => p.color)), new Set(["#112233", "#aabbcc"]));
  assert.deepEqual(calculateIndicatorSeries({ ...item, enabled: false }, bars, theme), []);
  assert.deepEqual(calculateIndicatorSeries(item, bars, theme, { instrument: "NQ" }), output);
  const stored = normalizePaneIndicatorState({ indicators: JSON.parse(JSON.stringify([item])), favorites: [item.indicatorId] });
  assert.equal(stored.indicators[0].settings.kstShortName, "Saved name");
  assert.deepEqual(calculateIndicatorSeries(stored.indicators[0], bars, theme), output);
  const audit = auditIndicatorLibrary();
  assert.ok(!audit.pending.some(row => row.id === item.indicatorId || row.indicatorId === item.indicatorId));
  assert.deepEqual(audit.orphanEngines, []); assert.deepEqual(audit.orphanRenderers, []);
});

test("actual chart requests deep data, enough for maximum KST readiness", () => {
  const source = ts.createSourceFile("Chart.tsx", readFileSync("src/components/Chart.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let members = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "DEEP_HISTORY_INDICATOR_IDS") members = node.initializer.arguments[0].elements.map(e => e.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(members.includes("know-sure-thing-kst"));
  assert.equal(kstRequiredBars({ roc1: 1000, average1: 1000, signalPeriod: 1000 }), 2999);
});

test("real painter draws both orientations, exact full-width reference and clips external values", () => {
  const middle = calculateIndicatorSeries(instance({}), bars, theme).at(-1);
  const horizontal = renderToStaticMarkup(React.createElement(Plot, { series: middle, points: [], bounds, referenceCoordinate: 60 }));
  assert.match(horizontal, /x1="10" x2="110" y1="60" y2="60"/);
  const vertical = renderToStaticMarkup(React.createElement(Plot, { series: middle, points: [], bounds, referenceCoordinate: 60, vertical: true }));
  assert.match(vertical, /x1="60" x2="60" y1="20" y2="120"/);
  assert.equal(renderToStaticMarkup(React.createElement(Plot, { series: middle, points: [], bounds, referenceCoordinate: 200 })), "");
});

test("real painter obeys points/line, hard gaps, labels and independent backgrounds", () => {
  const series = calculateIndicatorSeries(instance({ kstDisplayStyle: "points", kstNameLabel: true, kstValueLabel: true, kstNameBackground: true }), bars, theme)[0];
  const points = [{ x: 10, y: 30, value: 4, color: "#112233" }, { x: 20, y: 40, value: 5, color: "#112233" }, { x: 30, y: 50, value: 6, breakBefore: true, color: "#112233" }];
  const render = plot => renderToStaticMarkup(React.createElement(Plot, { series: plot, points, bounds }));
  const dots = render(series);
  assert.match(dots, /data-kst-points="true"/); assert.doesNotMatch(dots, /L20/);
  assert.match(dots, /data-kst-label="name"/); assert.match(dots, /data-kst-label="value"/);
  assert.equal((dots.match(/<rect /g) ?? []).length, 1);
  const line = render({ ...series, lineVisible: true, pointMarkersVisible: false });
  assert.match(line, /M10,30L20,40/); assert.match(line, /d="M30,50"/); assert.doesNotMatch(line, /L30,50/);
  assert.doesNotMatch(line, /data-kst-points/); assert.match(line, /overflow="hidden"/);
  const chartMarker = render({ ...series, kstPresentation: { ...series.kstPresentation, chartMarker: true } });
  assert.match(chartMarker, /fill="var\(--chart-background\)"/);
});

test("actual pane autoscale opt-out is KST-only and keeps the middle reference", () => {
  const source = ts.createSourceFile("ChartIndicatorPanes.tsx", readFileSync("src/components/ChartIndicatorPanes.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "seriesDomain");
  assert.ok(declaration);
  const js = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const domain = new Function(`${js}; return seriesDomain;`)();
  const output = calculateIndicatorSeries(instance({ kstAutoCenter: false, signalAutoCenter: false }), bars, theme);
  assert.deepEqual(domain(output), { min: -1, max: 1 });
  assert.ok(domain(output.map(s => ({ ...s, kstPresentation: undefined }))).max > 1);
  assert.ok(domain(calculateIndicatorSeries(instance({}), bars, theme)).max > 1);
});
