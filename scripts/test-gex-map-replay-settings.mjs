import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the production cache-restoration effect, not a duplicate state model.
const source = fs.readFileSync(process.argv[2] ?? "src/components/gex-map/GexMapWorkspace.tsx", "utf8");
const ast = ts.createSourceFile("GexMapWorkspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let restore;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect"
    && node.arguments[0]?.getText(ast).includes("const cachedData = Object.fromEntries(nextPanels.map")) restore = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(restore, "production cache-restoration effect exists");
const executable = ts.transpileModule(`globalThis.restore = ${restore.getText(ast)}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const custom = () => [
  { id: "left", symbol: "SPX", greekMode: "GAMMA" },
  { id: "centre", symbol: "QQQ", greekMode: "VANNA" },
  { id: "right", symbol: "NDX", greekMode: "CHARM" },
  { id: "extra-custom", symbol: "SPY", greekMode: "DELTA" },
];
function harness(saved = null, market = null) {
  const state = { panels: custom(), data: null, errors: null, loading: null, defaults: [] };
  const context = {
    initialEmbedStateRef: { current: saved }, panelsMarketRef: { current: market },
    panelsRef: { current: state.panels }, linkedMarket: market, scope: "live", cache: new Map(),
    initialPanelsForMarket: (value) => { state.defaults.push(value); return [{ id: "default", symbol: value ?? "SPX", greekMode: "GAMMA" }]; },
    panelCacheKey: (panel) => `${context.scope}:${panel.id}:${panel.symbol}:${panel.greekMode}`,
    readWorkspaceData: (key) => context.cache.get(key), hasRenderableGexMapSurface: (value) => value?.valid === true,
    setPanels: (update) => { state.panels = update(state.panels); context.panelsRef.current = state.panels; },
    setPanelData: (value) => { state.data = value; }, setPanelErrors: (value) => { state.errors = value; },
    setLoading: (value) => { state.loading = value; },
  };
  vm.runInNewContext(executable, context);
  return { state, context, run: () => context.restore() };
}
test("four configured columns retain identity through live, replay dates and live again", () => {
  const { state, context, run } = harness(); const original = state.panels;
  for (const scope of ["live", "2026-10-30", "2026-10-29", "live"]) {
    context.scope = scope; run(); assert.strictEqual(state.panels, original);
    assert.deepEqual(state.panels, custom());
  }
  assert.deepEqual(state.defaults, []);
});
test("model, expiry and units cache changes cannot reset a custom panel set", () => {
  const { state, context, run } = harness();
  for (const scope of ["dealer", "all-expiries", "percent-move", "dollar-move"]) {
    context.scope = scope; run(); assert.deepEqual(state.panels, custom());
  }
});
test("only a genuine linked-market change applies market defaults, once", () => {
  const { state, context, run } = harness(); run(); context.linkedMarket = "ES"; run();
  assert.deepEqual(state.defaults, ["ES"]); assert.equal(state.panels[0].symbol, "ES");
  context.scope = "replay"; run(); assert.deepEqual(state.defaults, ["ES"]);
});
test("a saved embed owns its columns even if its linked market changes", () => {
  const { state, context, run } = harness({ panels: custom() });
  context.linkedMarket = "NQ"; run(); assert.deepEqual(state.panels, custom()); assert.deepEqual(state.defaults, []);
});
test("replay cache restores all four actual columns and resets their errors/loading", () => {
  const { state, context, run } = harness(); context.scope = "2026-10-29";
  const payload = { valid: true }; context.cache.set(context.panelCacheKey(state.panels[3]), payload);
  run(); assert.equal(state.data["extra-custom"], payload); assert.equal(state.loading["extra-custom"], false);
  assert.equal(state.loading.left, true); assert.equal(state.errors["extra-custom"], null);
  assert.equal(Object.keys(state.data).length, 4); assert.equal(Object.keys(state.errors).length, 4);
});
test("removed columns cannot return when switching data scope", () => {
  const { state, context, run } = harness(); state.panels = custom().slice(1); context.panelsRef.current = state.panels;
  context.scope = "replay"; run(); assert.equal(state.panels.length, 3); assert.equal(state.panels.some((p) => p.id === "left"), false);
});
test("location hydration may establish a market, but subsequent replay preserves edits", () => {
  const { state, context, run } = harness(); run(); context.linkedMarket = "NQ"; run();
  state.panels = custom(); context.panelsRef.current = state.panels; context.scope = "replay"; run();
  assert.deepEqual(state.panels, custom()); assert.deepEqual(state.defaults, ["NQ"]);
});
