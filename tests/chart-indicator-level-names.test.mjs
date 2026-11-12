import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { isTrackedStorageKey } from "../src/lib/accountPreferenceKeys.ts";
import { workspaceScopeStorageKey } from "../src/lib/chartWorkspaceScope.ts";

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const retained = [
  { indicatorId: "bounce-levels", instanceId: "bounce", enabled: true },
  { indicatorId: "gamma-environment", instanceId: "regime", enabled: true },
  { indicatorId: "vwap", instanceId: "volume", enabled: false },
];
const indicators = {
  main: [
    { indicatorId: "gamma-levels", instanceId: "legacy-gamma", enabled: true },
    { indicatorId: "kwant-levels", instanceId: "legacy-alias", enabled: true },
    ...retained,
  ],
};

test("restored account indicators drop the retired level study and keep live studies", () => {
  assert.equal(CHART_INDICATOR_BY_ID.has("gamma-levels"), false);
  assert.equal(CHART_INDICATOR_BY_ID.has("kwant-levels"), false);
  assert.deepEqual(normalizePaneIndicatorState(indicators).main.map(row => row.instanceId), retained.map(row => row.instanceId));
});

test("workspace import drops legacy overlays and indicator instances without modifying the input", () => {
  const start = workspace.indexOf("function normalizeWorkspacePresets(");
  const end = workspace.indexOf("\nfunction ", start + 1);
  const compile = ts.transpile(workspace.slice(start, end), { target: ts.ScriptTarget.ES2022 });
  const normalize = runInNewContext(compile + "\nnormalizeWorkspacePresets", {
    normalizePaneIndicatorState,
    isWorkspacePreset: () => true,
    defaultWorkspacePanes: () => [{ id: "fallback" }],
    normalizeWorkspacePane: (pane) => pane,
    normalizeWorkspaceLayoutNode: (layout) => layout,
    normalizeChartSettings: (settings) => settings,
    normalizePaneCandleSettings: (settings) => settings,
    normalizeWorkspaceFloatingWindows: (windows) => windows,
  });
  const old = {
    id: "saved", name: "Account workspace", panes: [{id:"main"}],
    layout: {type:"pane", paneId:"main"}, indicators,
    levelVisibility: {main:{gamma:true, kwant:true, structure:true, valueArea:true}},
  };
  const [restored] = normalize([old]);
  assert.equal(Object.hasOwn(restored,"levelVisibility"),false);
  assert.equal(old.levelVisibility.main.kwant,true);
  assert.equal(restored.panes[0].id,"main");
  assert.deepEqual(restored.indicators.main.map(row => row.instanceId),retained.map(row => row.instanceId));
});

test("retired overlay preferences are excluded from account sync for all chart scopes", () => {
  for (const scope of ["charts","gamma","algo"]) {
    for (const suffix of ["pane-level-visibility","gamma-levels-enabled","historical-structure-enabled","value-area-levels-enabled"]) {
      assert.equal(isTrackedStorageKey(workspaceScopeStorageKey(scope,"kwantdesk:chart-"+suffix+":v1")), false);
    }
    assert.equal(isTrackedStorageKey(workspaceScopeStorageKey(scope,"kwantdesk-chart-indicators")),true);
  }
});
