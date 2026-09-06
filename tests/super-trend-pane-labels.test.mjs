import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateSuperTrendSeries } from "../src/lib/superTrendSeries.ts";

const source = fs.readFileSync(new URL("../src/components/SuperTrendPaneLabels.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(name => {
  assert.equal(name, "react/jsx-runtime"); return runtime;
}, loaded, loaded.exports);
const Labels = loaded.exports.default;
const series = { color: "#00ff00", superTrendLabels: { name: "STD", nameLabel: true,
  valueLabel: true, nameBackground: true, valueBackground: false, chartColorForMarker: false } };
const points = [{ x: 50, y: 70, value: -4.25, color: "#ff0000" },
  { x: 110, y: 50, value: 99, color: "#00ff00" }];
const render = (s = series, p = points) => renderToStaticMarkup(Labels({
  series: s, points: p, bounds: { left: 0, right: 100, top: 0, bottom: 100 },
}));

test("actual Difference pane labels select visible data and independently paint backgrounds", () => {
  const html = render();
  assert.match(html, />STD</); assert.match(html, />-4.25</);
  assert.doesNotMatch(html, />99</);
  assert.equal((html.match(/<rect /g) ?? []).length, 1);
  assert.match(html, /fill="#ff0000"/);
  const background = render({ ...series, superTrendLabels: {
    ...series.superTrendLabels, chartColorForMarker: true, valueBackground: true,
  } });
  assert.equal((background.match(/<rect /g) ?? []).length, 2);
  assert.match(background, /fill="var\(--chart-background, var\(--background\)\)"/);
});

test("disabled, missing or offscreen Difference labels paint nothing", () => {
  assert.equal(render({ ...series, superTrendLabels: undefined }), "");
  assert.equal(render({ ...series, superTrendLabels: { ...series.superTrendLabels,
    nameLabel: false, valueLabel: false } }), "");
  assert.equal(render(series, [{ x: 101, y: 10, value: 2 }]), "");
  assert.equal(render(series, [{ x: 10, y: 10, value: NaN }]), "");
});

test("pane labels reserve right-side control clearance without dropping the latest point", () => {
  const html = renderToStaticMarkup(Labels({ series, points: [{ x: 100, y: 70, value: 1 }],
    bounds: { left: 0, right: 100, top: 0, bottom: 100 }, rightInset: 28 }));
  assert.match(html, />STD</); assert.match(html, />1</);
  // STD name chip: 3*6+10 wide, right edge must stop at 100-28.
  assert.match(html, /<rect x="44"[^>]*width="28"/);
});

test("Difference exposes reference label and auto-centre controls through actual calculation", () => {
  const candles = Array.from({ length: 12 }, (_, i) => ({ timestamp: 1700000000000 + i * 1000,
    open: 10, high: 11, low: 9, close: 10 }));
  const theme = { positive: "#00ff00", negative: "#ff0000" };
  const [plot] = calculateSuperTrendSeries(candles, { shortName: "Delta trend", nameLabel: true,
    valueLabel: true, nameBackground: true, valueBackground: true, includeOnAutoCenter: false }, theme, "a", true);
  assert.equal(plot.excludeFromAutoScale, true);
  assert.deepEqual(plot.superTrendLabels, { name: "Delta trend", nameLabel: true, valueLabel: true,
    nameBackground: true, valueBackground: true, chartColorForMarker: false });
});
