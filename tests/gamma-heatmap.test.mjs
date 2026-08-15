import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [engine, primitive, route, chart, catalog, config, workspace, controls] = await Promise.all([
  read("src/lib/gammaHeatmap.ts"),
  read("src/lib/gammaHeatmapPrimitive.ts"),
  read("src/app/api/gamma-heatmap/route.ts"),
  read("src/components/Chart.tsx"),
  read("src/lib/chartIndicatorCatalog.ts"),
  read("src/lib/chartIndicatorConfig.ts"),
  read("src/components/KwantifyWorkspace.tsx"),
  read("src/components/ChartIndicatorsControl.tsx"),
]);

test("Gamma Heatmap has one stable indicator and workspace identity", () => {
  assert.match(engine, /GAMMA_HEATMAP_ID = "gamma-heatmap"/);
  assert.match(catalog, /indicator\("Gamma Heatmap", "Options Flow"/);
  assert.match(workspace, /"tool-gamma-heatmap"/);
  assert.match(workspace, /indicatorId: "gamma-heatmap"/);
  assert.match(workspace, />Options Flow</);
  assert.match(config, /LIVE_CHART_INDICATOR_IDS[\s\S]*"gamma-heatmap"/);
  assert.match(controls, /RENDERED_CHART_INDICATOR_IDS[\s\S]*"gamma-heatmap"/);
});

test("mapping is deterministic and stored with every historical snapshot", () => {
  assert.match(engine, /method: "direct"/);
  assert.match(engine, /method: "live-basis"/);
  assert.match(engine, /method: "live-ratio"/);
  assert.match(engine, /mapping: \{ \.\.\.mapping \}/);
  assert.match(engine, /confidence:/);
});

test("local strike transition is never misrepresented as a true gamma flip", () => {
  assert.match(engine, /label: "Local GEX Sign Transition"/);
  assert.match(engine, /isTrueGammaFlip: false/);
  assert.doesNotMatch(engine, /label: "Gamma Flip"/);
});

test("renderer uses chart coordinates, stays below candles and avoids DOM cells", () => {
  assert.match(primitive, /timeToCoordinate/);
  assert.match(primitive, /priceToCoordinate/);
  assert.match(primitive, /return "bottom" as const/);
  assert.doesNotMatch(primitive, /createElement|appendChild/);
  assert.match(chart, /candleSeries\.attachPrimitive\(gammaHeatmapPrimitive\)/);
});

test("server route keeps credentials server-side and refuses a fake raw fallback", () => {
  assert.match(route, /isAuthenticated/);
  assert.match(route, /getGexMapPanel/);
  assert.match(route, /getNativeFuturesSpot/);
  assert.match(route, /no substitute surface was shown/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_.*QUANT|NEXT_PUBLIC_.*DATABENTO/);
});

test("settings expose metric, source, history and render controls", () => {
  assert.match(config, /"gamma-heatmap": \[/);
  assert.match(config, /historyHours/);
  assert.match(config, /sourceMode: "hybrid"/);
  assert.match(config, /showHistorical: true/);
  assert.match(config, /carryForwardFade: true/);
});
