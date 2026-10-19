import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { orderPanesForLayout } from "../src/lib/workspaceLayoutPanes.ts";

const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(["addChartToWorkspace", "duplicateWorkspacePane", "duplicateFloatingWorkspacePane",
  "insertWorkspacePane", "collectWorkspacePaneIds", "normalizeWorkspaceLayoutNode",
  "clampWorkspaceUnit", "normalizeWorkspaceFloatingWindows"]);
const declarations = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)) declarations.set(node.name.text, node.getText(parsed));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && names.has(node.name.text)) declarations.set(node.name.text, `const ${node.getText(parsed)};`);
  ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(declarations.size, names.size);
const code = ts.transpileModule([...declarations.values()].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const compile = context => new Function("context", `with(context) { ${code}; return {${[...names].join(",")}}; }`)(context);
function harness(scope = "charts") {
  const panes = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, content: "charts", symbol: "NQ", broker: "Databento", timeframe: "1m", period: "1W", watchlistKey: "NQ", locked: false }));
  const context = { workspaceLocked: false, workspacePanes: panes, activePaneId: "p0", activeWorkspacePane: panes[0],
    workspaceAreaRef: { current: null }, chartWorkspaceScopeRef: { current: scope },
    workspaceTree: { type: "pane", paneId: "p0" },
    workspaceFloatingWindows: [{ paneId: "p0", x: 0.1, y: 0.1, width: 0.5, height: 0.5, locked: false }],
    paneIndicators: { p0: [{ instanceId: "original", indicatorId: "vwap", enabled: true, settings: { length: 20 } }] },
    paneLevelVisibility: { p0: { valueArea: true } }, EMPTY_PANE_LEVEL_VISIBILITY: {}, toasts: [],
    showReportToast(...args) { context.toasts.push(args); },
  };
  for (const [setter, property] of [["setWorkspacePanes", "workspacePanes"], ["setWorkspaceTree", "workspaceTree"],
    ["setWorkspaceFloatingWindows", "workspaceFloatingWindows"], ["setPaneIndicators", "paneIndicators"], ["setPaneLevelVisibility", "paneLevelVisibility"]]) {
    context[setter] = value => { context[property] = typeof value === "function" ? value(context[property]) : value; };
  }
  for (const name of ["setWorkspaceLayout", "setActivePaneId", "setWorkspacePanelPickerPaneId", "setShowWorkspacePresetMenu", "setWorkspacePanelTransition",
    "setSelectedInstrument", "setSelectedTimeframe", "setSelectedPeriod", "setConnectedBroker", "setSelectedWatchlistKey"]) context[name] = () => {};
  return { context, api: compile(context) };
}

test("actual add-panel handler crosses12 and keeps adding without a replacement count cap", () => {
  for (const scope of ["charts", "gamma"]) {
    const { context, api } = harness(scope);
    for (let i = 12; i < 64; i++) api.addChartToWorkspace();
    assert.equal(context.workspacePanes.length, 64);
    assert.equal(context.workspacePanes[12].content, null);
    assert.ok(context.workspacePanes[63].id.startsWith(`${scope}-pane-`));
    assert.ok(!context.toasts.some(([kind]) => kind === "error"));
    assert.equal(api.collectWorkspacePaneIds(context.workspaceTree).length, 53);
  }
});
test("docked duplication above12 preserves independent settings and valid tree identities", () => {
  const { context, api } = harness();
  for (let i = 12; i < 32; i++) api.duplicateWorkspacePane("p0");
  assert.equal(context.workspacePanes.length, 32);
  const copied = context.paneIndicators[context.workspacePanes[31].id][0];
  assert.notEqual(copied.instanceId, "original");
  assert.notEqual(copied.settings, context.paneIndicators.p0[0].settings);
  assert.equal(copied.settings.length, 20);
  assert.equal(new Set(context.workspacePanes.map(pane => pane.id)).size, 32);
  assert.equal(api.collectWorkspacePaneIds(context.workspaceTree).length, 21);
});
test("floating duplication and JSON restore retain more than12 valid windows", () => {
  const { context, api } = harness();
  for (let i = 0; i < 30; i++) api.duplicateFloatingWorkspacePane("p0");
  assert.equal(context.workspaceFloatingWindows.length, 31);
  const ids = new Set(context.workspacePanes.map(pane => pane.id));
  const restored = api.normalizeWorkspaceFloatingWindows(JSON.parse(JSON.stringify(context.workspaceFloatingWindows)), ids);
  assert.equal(restored.length, 31);
  assert.deepEqual(restored.map(item => item.paneId), context.workspaceFloatingWindows.map(item => item.paneId));
});
test("larger layout trees round-trip without dropping docked panes or settings", () => {
  const { context, api } = harness();
  for (let i = 0; i < 40; i++) api.duplicateWorkspacePane("p0");
  const backup = JSON.parse(JSON.stringify({ panes: context.workspacePanes, tree: context.workspaceTree, indicators: context.paneIndicators }));
  const normalized = api.normalizeWorkspaceLayoutNode(backup.tree, new Set(backup.panes.map(pane => pane.id)));
  assert.deepEqual(api.collectWorkspacePaneIds(normalized), api.collectWorkspacePaneIds(context.workspaceTree));
  assert.equal(backup.panes.length, 52);
  const ordered = orderPanesForLayout(api.collectWorkspacePaneIds(normalized), backup.panes, new Set(), null);
  assert.equal(ordered.length, 52);
  assert.equal(Object.keys(backup.indicators).length, 41);
  assert.ok(Object.values(backup.indicators).every(items => items[0].settings.length === 20));
});
test("locks, duplicate-window validation and geometry clamps remain enforced", () => {
  const { context, api } = harness(); context.workspaceLocked = true;
  api.addChartToWorkspace(); api.duplicateWorkspacePane("p0");
  assert.equal(context.workspacePanes.length, 12); assert.equal(context.toasts.length, 2);
  const floating = api.normalizeWorkspaceFloatingWindows([
    { paneId: "p0", x: -1, y: 100, width: 999, height: -2 }, { paneId: "p0" }, { paneId: "ghost" }, null,
  ], new Set(["p0"]));
  assert.equal(floating.length, 1); assert.equal(floating[0].width, 0.96); assert.equal(floating[0].height, 0.18);
});
test("duplicate buttons and persistence no longer contain panel-count guards", () => {
  assert.doesNotMatch(source, /workspacePanes\.length\s*(?:>=|>|===)\s*12/);
  assert.doesNotMatch(source, /This workspace already has (?:the maximum of )?12 panels/);
  assert.doesNotMatch(declarations.get("normalizeWorkspaceFloatingWindows"), /\.slice\(/);
  // Keep unrelated bounded market-data caches. Unlimited panels is not
  // permission to retain unlimited execution history in browser memory.
  assert.match(source, /MAX_WORKSPACE_EXECUTION_TAPES = 8/);
  assert.match(source, /MAX_WORKSPACE_BACKUP_BYTES = 2_000_000/);
});
