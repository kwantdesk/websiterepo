import assert from "node:assert/strict";
import test from "node:test";
import { mergeAccountPreferenceChanges } from "../src/lib/accountPreferenceMerge.ts";
import { workspaceScopeStorageKey } from "../src/lib/chartWorkspaceScope.ts";
import { CHART_INDICATORS_STORAGE_KEY, retainInitialIndicatorEdits } from "../src/lib/workspaceIndicatorPreferences.ts";

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

test("hide survives a peer settings edit and still allows explicitly showing the indicator", () => {
  const key = CHART_INDICATORS_STORAGE_KEY;
  const base = snapshot(key, [atr, vwap]);
  const hidden = { ...atr, enabled: false };
  const peerEdit = { ...atr, settings: { length: 20 } };
  for (const [local, remote] of [[hidden, peerEdit], [peerEdit, hidden]]) {
    const { values } = mergeAccountPreferenceChanges(base, snapshot(key, [local, vwap]), snapshot(key, [remote, vwap]));
    assert.deepEqual(JSON.parse(values[key])[pane], [{ ...peerEdit, enabled: false }, vwap]);
  }
  const previouslyHidden = snapshot(key, [hidden, vwap]);
  assert.deepEqual(JSON.parse(mergeAccountPreferenceChanges(
    previouslyHidden, base, previouslyHidden,
  ).values[key])[pane], [atr, vwap]);
});

test("quota refusal keeps hidden indicators available to remount and account sync", async () => {
  const key = CHART_INDICATORS_STORAGE_KEY;
  const ownerKey = "kwantdesk:active-preferences-owner:v1";
  const owner = "indicator-quota-owner";
  const stale = snapshot(key, [atr, vwap]);
  const hidden = snapshot(key, [{ ...atr, enabled: false }, { ...vwap, enabled: false }]);
  const map = new Map([[ownerKey, owner], [key, stale.values[key]]]);
  const storage = {
    get length() { return map.size; },
    key: index => [...map.keys()][index] ?? null,
    getItem: item => map.get(item) ?? null,
    removeItem: item => map.delete(item),
    setItem() { throw new DOMException("full", "QuotaExceededError"); },
  };
  const { writeWorkspaceIndicatorPreference, readWorkspacePreferenceValue, clearConfirmedWorkspacePreferences } =
    await import("../src/lib/workspacePreferenceFallback.ts");
  const { captureBrowserPreferences, receiveAccountPreferences } = await import("../src/lib/userPreferences.ts");
  const previous = globalThis.window;
  const events = [];
  globalThis.window = { localStorage: storage, dispatchEvent(event) { events.push(event.type); } };
  try {
    assert.equal(writeWorkspaceIndicatorPreference(key, hidden.values[key]).ok, false);
    assert.equal(storage.getItem(key), stale.values[key]);
    assert.equal(readWorkspacePreferenceValue(key), hidden.values[key]);
    assert.ok(events.includes("kwantdesk:preferences-changed"));
    const local = captureBrowserPreferences();
    assert.equal(local.values[key], hidden.values[key]);
    receiveAccountPreferences(owner, mergeAccountPreferenceChanges(stale, local, stale), stale);
    assert.equal(readWorkspacePreferenceValue(key), hidden.values[key]);
    map.set(ownerKey, "another-owner");
    assert.equal(readWorkspacePreferenceValue(key), stale.values[key]);
  } finally {
    globalThis.window = previous;
    clearConfirmedWorkspacePreferences(owner);
  }
});

test("first successful account read retains a hide clicked before the request started", () => {
  const key = CHART_INDICATORS_STORAGE_KEY;
  const base = snapshot(key, [atr]);
  const sent = snapshot(key, [{ ...atr, enabled: false }]);
  const received = snapshot(key, [atr, vwap]);
  const applied = retainInitialIndicatorEdits(base, sent, received);
  assert.deepEqual(JSON.parse(applied.values[key])[pane], [{ ...atr, enabled: false }, vwap]);
  assert.equal(retainInitialIndicatorEdits(base, base, received).values[key], received.values[key]);
});

test("retired studies are omitted from restored panes", async () => {
  const { normalizePaneIndicatorState } = await import("../src/lib/chartIndicatorConfig.ts");
  const retired = ["poc-auction-suite", "session-imbalance", "shift-candle", "session-marker"].map(indicatorId => ({
    instanceId: indicatorId, indicatorId, enabled: true,
  }));
  const retained = [vwap, { instanceId: "session-highs", indicatorId: "session-highs-lows", enabled: true }];
  const restored = normalizePaneIndicatorState({ [pane]: [...retired, ...retained] });
  assert.deepEqual(restored[pane].map(instance => instance.indicatorId), retained.map(instance => instance.indicatorId));
});
