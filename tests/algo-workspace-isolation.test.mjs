import "../scripts/alias-hook.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const { workspaceScopeStorageKey: key, workspaceTemplateStorageKey, workspaceChartInstanceId, viewportSyncGroupForScope, chartDrawingPersistenceInstrument } = await import("../src/lib/chartWorkspaceScope.ts");
const { isTrackedStorageKey, captureBrowserPreferences } = await import("../src/lib/userPreferences.ts");
const { chartCrosshairSyncGroup } = await import("../src/lib/chartCrosshairSync.ts");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
test("Algo never addresses existing Charts or GEX Vue workspace keys", () => {
  for (const base of ["kwantdesk-chart-workspace-presets", "kwantdesk-chart-workspace-active-preset", "olisa-chart-workspace-panes", "olisa-chart-workspace-tree", "kwantdesk-chart-indicators", "kwantdesk:chart-workspace-settings:v1", "kwantdesk:chart-drawtools:v1"]) {
    assert.notEqual(key("algo", base), key("charts", base)); assert.notEqual(key("algo", base), key("gamma", base));
    assert.equal(key("charts", base), base); assert.equal(key("gamma", base), "kwantdesk:gamma-charting:" + base);
    assert.equal(isTrackedStorageKey(key("algo", base)), true);
  }
});
test("Algo templates stay separate while the existing Charts/GEX library remains compatible", () => {
  assert.equal(workspaceTemplateStorageKey("charts", "olisa-chart-templates"), "olisa-chart-templates");
  assert.equal(workspaceTemplateStorageKey("gamma", "olisa-chart-templates"), "olisa-chart-templates");
  assert.equal(workspaceTemplateStorageKey("algo", "olisa-chart-templates"), key("algo", "olisa-chart-templates"));
});
test("account sync captures Algo and Charts as independent keys", () => {
  const values = new Map([[key("charts", "kwantdesk-chart-workspace-presets"), '[{"name":"Charts"}]'], [key("algo", "kwantdesk-chart-workspace-presets"), '[{"name":"Algo"}]']]);
  const previous = globalThis.window;
  globalThis.window = { localStorage: { length: values.size, key: i => [...values.keys()][i], getItem: name => values.get(name) ?? null } };
  try { assert.deepEqual(captureBrowserPreferences().values, Object.fromEntries(values)); }
  finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
});
test("even imported matching pane ids cannot collide in drawing storage", () => {
  assert.equal(workspaceChartInstanceId("charts", "pane-1"), "pane-1");
  assert.equal(workspaceChartInstanceId("gamma", "pane-1"), "pane-1");
  assert.equal(workspaceChartInstanceId("algo", "pane-1"), "algo:pane-1");
  const imported = "charts-pane-1234567890-abcdef1234567890";
  assert.notEqual(chartDrawingPersistenceInstrument("NQ", imported), chartDrawingPersistenceInstrument("NQ", workspaceChartInstanceId("algo", imported)));
  assert.equal(chartDrawingPersistenceInstrument("NQ", imported), `NQ::${imported.slice(-16)}`);
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /!chartInstanceId\.startsWith\("algo:"\) && !cached\.length/);
});
test("Algo linked viewports and cursors have a dedicated group", () => {
  const groups = ["charts", "gamma", "algo"].map(viewportSyncGroupForScope);
  assert.equal(new Set(groups).size, 3);
  assert.equal(chartCrosshairSyncGroup("algo", "NQ", groups[2], true), groups[2]);
  assert.equal(chartCrosshairSyncGroup("algo", "NQ", groups[2], false), "");
});
test("scope detection, hydration and both drawing save paths use Algo ownership", () => {
  assert.match(workspace, /initialChartWorkspaceScope: ChartWorkspaceScope = isAlgoWorkspace \? "algo"/);
  assert.match(workspace, /nextScope: ChartWorkspaceScope \| null = isAlgoWorkspace \? "algo"/);
  assert.match(workspace, /loadChartWorkspaceRuntime\("algo"\)/);
  assert.match(workspace, /key\.startsWith\(workspaceStoragePrefix\(scope\)\)/);
  assert.equal((workspace.match(/setItem\(chartingDrawingsStorageKey,/g) ?? []).length, 2);
  assert.match(workspace, /workspaceChartInstanceId\(chartWorkspaceScope, pane\.id\)/);
  assert.match(workspace, /if \(chartWorkspaceScopeRef\.current !== "algo"\) saveStoredChartSettings/);
});
