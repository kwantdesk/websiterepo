import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const text = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const source = ts.createSourceFile("workspace.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = source.statements.filter(node =>
  (ts.isFunctionDeclaration(node) && ["createGexQuadMapPreset", "includeGexStandardPreset", "createWorkspaceLayoutTree"].includes(node.name?.text))
  || (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(source) === "GEX_MAP_AUTO_MAP_PANELS")));
const js = ts.transpileModule(declarations.map(n => n.getText(source)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const api = vm.runInNewContext(js + ";({createGexQuadMapPreset,includeGexStandardPreset,createWorkspaceLayoutTree})", {
  makeWatchlistKey: (s, b) => `${b}:${s}`, normalizeChartSettings: s => ({ ...s }),
  defaultIndicatorSettings: (id, s) => ({ indicator: id, color: s.color }),
  DEFAULT_GEX_MAP_REPRESENTATION: "PER_ONE_DOLLAR_MOVE",
  createGexStandardPreset: () => ({ id: "gex-standard", name: "GEX STANDARD" }),
});

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
  assert.deepEqual(preset.panes.slice(0, 4).map(p => p.symbol), ["SPXW", "NDX", "QQQ", "SPY"]);
  assert.ok(preset.panes.slice(0, 4).every(p => p.broker === "Market Index" && p.timeframe === "5m" && p.period === "5D"));
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
