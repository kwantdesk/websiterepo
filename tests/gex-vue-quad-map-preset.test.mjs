import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { orderPanesForLayout } from "../src/lib/workspaceLayoutPanes.ts";
const text = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const source = ts.createSourceFile("workspace.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = source.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && ["createGexQuadMapPreset", "includeGexStandardPreset", "createWorkspaceLayoutTree", "collectWorkspacePaneIds", "defaultWorkspacePanes"].includes(node.name?.text))
  || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => ["DEFAULT_CHART_LOAD_PERIOD", "DEFAULT_GAMMA_WORKSPACE_PANES", "DEFAULT_ALGO_WORKSPACE_PANES",
    "GEX_VUE_AUTO_CHART_SYMBOLS", "GEX_MAP_AUTO_CHART_TIMEFRAME", "GEX_MAP_AUTO_MAP_PANELS"].includes(d.name.getText(source)))));
const layoutClick = text.slice(text.indexOf("  const applyWorkspaceLayoutTemplate ="), text.indexOf("  const addChartToWorkspace ="));
const js = ts.transpileModule(declarations.map(n => n.getText(source)).join("\n") + "\n" + layoutClick, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const context = {
  DEFAULT_WORKSPACE_PANES: [],
  makeWatchlistKey: (s, b) => `${b}:${s}`, normalizeChartSettings: s => ({ ...s }),
  defaultIndicatorSettings: (id, s) => ({ indicator: id, color: s.color }),
  DEFAULT_GEX_MAP_REPRESENTATION: "PER_ONE_DOLLAR_MOVE",
  createGexStandardPreset: () => ({ id: "gex-standard", name: "GEX STANDARD" }),
};
const api = vm.runInNewContext(js + ";({createGexQuadMapPreset,includeGexStandardPreset,createWorkspaceLayoutTree,applyWorkspaceLayoutTemplate})", context);

test("layout toolbar offers the quad plus full-height right map and restores its geometry", () => {
  const preset = api.createGexQuadMapPreset({});
  const tree = plain(api.createWorkspaceLayoutTree("gexmap-quad", preset.panes));
  const expected = plain(preset.layout);
  function geometry(node) {
    if (node.type === "pane") return node.paneId;
    return { axis: node.axis, ratio: node.ratio, first: geometry(node.first), second: geometry(node.second) };
  }
  assert.deepEqual(geometry(tree), geometry(expected));
  assert.match(text, /layout: "gexmap-quad" as Exclude<WorkspaceLayout, "custom">,\s+title: "Four-chart grid \+ full-height GEX Map on right"/);
  assert.match(text, /layout === "gexmap-columns-4" \|\| layout === "gexmap-quad" \? 4/);
  assert.match(text, /layoutValue === "gexmap-quad"/);
  assert.match(text, /nextLayoutValue === "gexmap-quad"/);
  assert.match(text, /presets: gexStandardPreset \? includeGexStandardPreset\(\[gexStandardPreset\], scopedChartSettings\)/);
});
const plain = value => JSON.parse(JSON.stringify(value));

test("screenshot preset has four correct charts and a full-height four-column map", () => {
  const preset = plain(api.createGexQuadMapPreset({ color: "theme-blue" }));
  assert.equal(preset.name, "GEX QUAD + MAP");
  assert.deepEqual(preset.panes.slice(0, 4).map(p => p.symbol), ["SPX", "NDX", "SPY", "QQQ"]);
  assert.ok(preset.panes.slice(0, 4).every(p => p.broker === "Market Index" && p.timeframe === "5m" && p.period === "1M"));
  const bounds = new Map();
  function visit(node, x = 0, y = 0, width = 100, height = 100) {
    if (node.type === "pane") { bounds.set(node.paneId, { x, y, width, height }); return; }
    const r = node.ratio / 100;
    if (node.axis === "x") { visit(node.first, x, y, width * r, height); visit(node.second, x + width * r, y, width * (1 - r), height); }
    else { visit(node.first, x, y, width, height * r); visit(node.second, x, y + height * r, width, height * (1 - r)); }
  }
  visit(preset.layout);
  assert.equal(bounds.size, 5);
  assert.deepEqual(bounds.get(preset.panes[0].id), { x: 0, y: 0, width: 32.5, height: 50 });
  assert.equal(bounds.get(preset.panes[1].id).x, 32.5);
  assert.equal(bounds.get(preset.panes[2].id).y, 50);
  assert.equal(bounds.get(preset.panes[3].id).y, 50);
  const map = preset.panes[4];
  assert.equal(bounds.get(map.id).x, 65);
  assert.equal(bounds.get(map.id).height, 100);
  assert.deepEqual(map.gexMapState.panels.map(p => p.symbol), ["SPXW", "NDX", "SPY", "QQQ"]);
  assert.equal(map.gexMapState.timeHorizon, "present");
  assert.equal(map.gexMapState.expiryScope, "FRONT_EXPIRY");
  assert.equal(map.gexMapState.exposureModel, "STRUCTURAL_OI");
  assert.equal(map.gexMapState.stepMinutes, 1);
  assert.deepEqual(preset.indicators[map.id], []);
  for (const p of preset.panes.slice(0, 4)) assert.deepEqual(preset.indicators[p.id].map(i => i.indicatorId), ["bounce-levels", "dark-pool-gex"]);
  assert.equal(preset.linkedPaneIds.length, 4);
});

test("built-in is discoverable without overwriting saved presets, duplicating, or sharing mutable map state", () => {
  const saved = { id: "gex-quad-map", name: "MY CUSTOM MAP", panes: ["mine"] };
  const included = api.includeGexStandardPreset([saved], {});
  assert.equal(included.find(p => p.id === saved.id), saved);
  assert.equal(api.includeGexStandardPreset(included, {}), included);
  const fresh = api.includeGexStandardPreset([], {});
  assert.deepEqual(plain(fresh.map(p => p.id).sort()), ["gex-quad-map", "gex-standard"]);
  const first = api.createGexQuadMapPreset({}), second = api.createGexQuadMapPreset({});
  first.panes[4].gexMapState.panels[0].symbol = "SPY";
  assert.equal(second.panes[4].gexMapState.panels[0].symbol, "SPXW");
});

test("embedded map saves and restores the selected horizon instead of borrowing another page's last view", () => {
  const map = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
  assert.match(map, /if \(initialEmbedStateRef.current\?\.timeHorizon\) return initialEmbedStateRef.current.timeHorizon/);
  assert.match(map, /timeHorizon: parsed.timeHorizon/);
  assert.match(map, /exposureModel: parsed.exposureModel/);
  assert.match(map, /exposureModel,\s+timeHorizon,/);
});

test("automatic GEX Vue layouts stock the visible chart slots even after another symbol was selected", () => {
  for (const [layout, expected] of [
    ["single", ["SPX"]], ["split-vertical", ["SPX", "NDX"]], ["split-horizontal", ["SPX", "NDX"]],
    ["columns-3", ["SPX", "NDX", "SPY"]], ["columns", ["SPX", "NDX", "SPY", "QQQ"]],
    ["quad", ["SPX", "NDX", "SPY", "QQQ"]], ["gexmap-columns", ["SPX", "NDX", "SPY"]],
    ["gexmap-columns-4", ["SPX", "NDX", "SPY", "QQQ"]], ["gexmap-quad", ["SPX", "NDX", "SPY", "QQQ"]],
  ]) {
    let panes;
    let picker;
    let tree;
    Object.assign(context, {
      orderPanesForLayout,
      workspaceTree: { type: "pane", paneId: "prior" },
      workspacePanes: [{ id: "prior", content: "charts", symbol: "ES", broker: "Databento", timeframe: "200v" }],
      chartWorkspaceScopeRef: { current: "gamma" },
      supportsChartInterval: timeframe => timeframe === "5m",
      setWorkspacePanes: value => { panes = value; },
      setWorkspaceTree: value => { tree = value; },
      setWorkspaceLayout() {}, setWorkspaceFloatingWindows() {}, setPaneIndicators() {},
      setWorkspacePanelPickerPaneId: value => { picker = value; },
      preloadWorkspaceModule: () => Promise.resolve(),
    });
    api.applyWorkspaceLayoutTemplate(layout);
    const visible = new Set();
    function visit(node) {
      if (node.type === "pane") visible.add(node.paneId);
      else { visit(node.first); visit(node.second); }
    }
    visit(tree);
    const chartPanes = plain(panes).filter(pane => visible.has(pane.id) && pane.content === "charts");
    assert.deepEqual(chartPanes.map(pane => pane.symbol), expected, layout);
    assert.ok(chartPanes.every(pane => pane.broker === "Market Index" && pane.timeframe === "5m"));
    assert.equal(picker, null);
  }
});
