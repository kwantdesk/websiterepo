import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = ts.createSourceFile('workspace.tsx', fs.readFileSync('src/components/KwantifyWorkspace.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'restoreAccountRevision') handler = node.initializer.getText(file);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(handler);
function harness(scope = 'charts') {
  const calls = {};
  const prefix = scope === 'charts' ? '' : `kwantdesk:${scope}-charting:`;
  const runtime = {
    panes: [{ id: 'es', symbol: 'ES' }, { id: 'nq', symbol: 'NQ' }],
    activePaneId: 'es', tree: ['es', 'nq'], floatingWindows: [], linkedPaneIds: [],
  };
  const context = {
    preferenceUserId: 'owner', activePaneIdRef: { current: 'nq' },
    chartWorkspaceScopeRef: { current: scope }, workspaceScopeHydratingRef: { current: false },
    workspaceScopeStorageKey: (_scope, key) => prefix + key,
    workspaceStoragePrefix: () => prefix,
    loadChartWorkspaceRuntime: () => { calls.loads = (calls.loads ?? 0) + 1; return runtime; },
    collectWorkspacePaneIds: tree => tree,
    window: { localStorage: { getItem: () => null }, requestAnimationFrame: fn => fn() },
    chartingDrawingsStorageKey: 'drawings', DRAWING_CLEAR_BARRIERS_KEY: 'barriers',
    GLOBAL_FAVOURITE_INTERVALS_KEY: 'intervals', GLOBAL_FAVOURITE_INSTRUMENTS_KEY: 'instruments',
    CHART_INDICATORS_STORAGE_KEY: 'indicators', CHART_WORKSPACE_SETTINGS_STORAGE_KEY: 'settings',
    PANE_LEVEL_VISIBILITY_STORAGE_KEY: 'levels', WORKSPACE_PRESETS_STORAGE_KEY: 'presets',
    ACTIVE_WORKSPACE_PRESET_STORAGE_KEY: 'preset', CHART_SETTINGS_STORAGE_KEY: 'olisa-chart-settings', CHART_TEMPLATES_STORAGE_KEY: 'templates',
  };
  for (const name of ['WorkspaceLayout', 'WorkspaceLocked', 'WorkspaceSplitRatio', 'WorkspaceQuadSplit', 'WorkspacePanes', 'WorkspaceTree', 'WorkspaceFloatingWindows', 'WorkspacePresets', 'ActiveWorkspacePresetId', 'ActivePaneId', 'PaneIndicators', 'PaneLevelVisibility', 'LinkedViewportPaneIds', 'ChartSettings', 'DraftChartSettings', 'ChartSettingsSnapshot', 'Templates', 'SelectedInstrument', 'SelectedTimeframe', 'SelectedPeriod', 'SelectedWatchlistKey', 'ConnectedBroker']) {
    context[`set${name}`] = value => { calls[name] = value; };
  }
  const run = vm.runInNewContext(ts.transpileModule(`const fn = ${handler}; fn;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { calls, runtime, context, run: (keys, source = 'remote') => run({ detail: { userId: 'owner', source, keys } }), prefix };
}
for (const scope of ['charts', 'gamma', 'algo']) {
  test(`${scope}: peer focus does not switch the mounted phone to ES or reload its workspace`, () => {
    const h = harness(scope);
    h.run([h.prefix + 'olisa-chart-workspace-active-pane']);
    assert.equal(h.calls.loads, undefined);
    assert.equal(h.calls.ActivePaneId, undefined);
    assert.equal(h.calls.SelectedInstrument, undefined);
  });
  test(`${scope}: real workspace updates preserve current visible chart and apply shared content`, () => {
    const h = harness(scope);
    h.run([h.prefix + 'olisa-chart-workspace-panes']);
    assert.equal(h.calls.loads, 1);
    assert.equal(h.calls.ActivePaneId, 'nq');
    assert.equal(h.calls.SelectedInstrument, 'NQ');
    assert.equal(h.calls.WorkspaceTree, h.runtime.tree);
    // A deliberately removed/hidden chart must fall back to the new workspace.
    h.runtime.tree = ['es'];
    h.run([h.prefix + 'olisa-chart-workspace-tree']);
    assert.equal(h.calls.ActivePaneId, 'es');
  });
}
test('initial account hydration still restores saved focus rather than keeping the startup default', () => {
  const h = harness();
  h.run(['olisa-chart-workspace-active-pane'], 'hydrate');
  assert.equal(h.calls.ActivePaneId, 'es');
});
