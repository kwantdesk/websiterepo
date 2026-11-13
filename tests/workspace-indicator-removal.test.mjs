import assert from "node:assert/strict";
import test from "node:test";
import { mergeAccountPreferenceChanges } from "../src/lib/accountPreferenceMerge.ts";
import { workspaceScopeStorageKey } from "../src/lib/chartWorkspaceScope.ts";
import { CHART_INDICATORS_STORAGE_KEY } from "../src/lib/workspaceIndicatorPreferences.ts";

const atr = { instanceId: "atr-1", indicatorId: "average-true-range-atr", enabled: true, settings: { length: 14 } };
const vwap = { instanceId: "vwap-1", indicatorId: "vwap", enabled: true };
const added = { instanceId: "atr-2", indicatorId: atr.indicatorId, enabled: true };
const pane = "chart-a";
const presetKey = "kwantdesk-chart-workspace-presets";
const preset = JSON.stringify([{ id: "saved", name: "Saved", indicators: { [pane]: [atr] } }]);
const snapshot = (key, indicators) => ({
  version: 1, complete: true, updatedAt: "2026-11-12T00:00:00Z",
  values: { [key]: JSON.stringify({ [pane]: indicators }), [presetKey]: preset },
});

for (const scope of ["charts", "gamma", "algo"]) {
  test(`${scope}: removing ATR wins against a peer edit and preserves its new indicator`, () => {
    const key = workspaceScopeStorageKey(scope, CHART_INDICATORS_STORAGE_KEY);
    const base = snapshot(key, [atr, vwap]);
    const removed = snapshot(key, [vwap]);
    const peer = snapshot(key, [{ ...atr, settings: { length: 20 } }, vwap, added]);
    for (const [local, remote] of [[removed, peer], [peer, removed]]) {
      const { values } = mergeAccountPreferenceChanges(base, local, remote);
      assert.deepEqual(JSON.parse(values[key])[pane], [vwap, added]);
      assert.equal(values[presetKey], preset);
    }
  });
}

test("an empty active list survives sync and explicitly reapplying the saved indicator restores it", () => {
  const key = CHART_INDICATORS_STORAGE_KEY;
  const saved = snapshot(key, [atr]);
  const removed = snapshot(key, []);
  assert.equal(mergeAccountPreferenceChanges(saved, removed, saved).values[key], removed.values[key]);
  assert.equal(mergeAccountPreferenceChanges(removed, saved, removed).values[key], saved.values[key]);
});

test("first indicator adds from two devices survive when there is no saved indicator key", () => {
  const key = CHART_INDICATORS_STORAGE_KEY;
  const base = { ...snapshot(key, []), values: { [presetKey]: preset } };
  const bollinger = { instanceId: "bb-1", indicatorId: "bollinger-bands", enabled: true };
  const local = snapshot(key, [bollinger]);
  const remote = snapshot(key, [vwap]);
  const { values } = mergeAccountPreferenceChanges(base, local, remote);
  assert.deepEqual(JSON.parse(values[key])[pane], [bollinger, vwap]);
});
