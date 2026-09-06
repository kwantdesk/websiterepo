import { test } from "node:test";
import assert from "node:assert/strict";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { CHART_INDICATOR_BY_ID, canonicalChartIndicatorId } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

test("every registered engine and renderer has a reachable catalogue row", () => {
  const audit = auditIndicatorLibrary();
  assert.deepEqual(audit.orphanEngines, []);
  assert.deepEqual(audit.orphanRenderers, []);
  assert.equal(audit.total, CHART_INDICATOR_BY_ID.size, "catalogue IDs must be unique");
});

test("Big Contracts and Liquidity Sweep use their genuine engines and settings", () => {
  for (const [oldId, id, name] of [
    ["big-trades-deep-trades", "big-trades", "Big Contracts"],
    ["liquidity-sweep-stop-sweep-detector", "liquidity-stop-sweep-detector", "Liquidity Sweep / Stop Sweep Detector"],
  ]) {
    assert.equal(CHART_INDICATOR_BY_ID.get(id)?.name, name);
    assert.equal(canonicalChartIndicatorId(oldId), id);
    assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === id));
    const settings = defaultIndicatorSettings(id);
    assert.ok(Object.keys(settings).length > 10, "real settings contract, not a placeholder");
    const original = { instanceId: "saved-study", indicatorId: oldId, enabled: false, settings: { ...settings, customNote: "preserved" } };
    const migrated = normalizePaneIndicatorState({ pane: [original] }).pane;
    assert.equal(migrated.length, 1);
    assert.equal(migrated[0].indicatorId, id);
    assert.equal(migrated[0].instanceId, original.instanceId);
    assert.equal(migrated[0].enabled, false);
    assert.equal(migrated[0].settings.customNote, "preserved");
    assert.equal(original.indicatorId, oldId, "do not mutate user input");
  }
});

test("unimplemented studies are still reported rather than enabled", () => {
  const pending = auditIndicatorLibrary().pending.map(row => row.id);
  assert.deepEqual(pending, []);
});

test("legacy Market Profile TPO resolves to the complete TPO Daily study", () => {
  assert.equal(canonicalChartIndicatorId("market-profile-tpo"), "tpo-chart");
  assert.equal(CHART_INDICATOR_BY_ID.has("market-profile-tpo"), false, "do not show a duplicate pending row");
  assert.equal(CHART_INDICATOR_BY_ID.get("tpo-chart")?.name, "TPO Daily");
  const restored = normalizePaneIndicatorState({ pane: [{
    instanceId: "old-tpo",
    indicatorId: "market-profile-tpo",
    enabled: true,
    settings: { subperiodMinutes: 15 },
  }] }).pane[0];
  assert.equal(restored.indicatorId, "tpo-chart");
  assert.equal(restored.settings.subperiodMinutes, 15);
});

test("legacy Volume Swing resolves to the complete KWANT Profile Swing study", () => {
  assert.equal(canonicalChartIndicatorId("volume-swing"), "deep-profile-swing");
  assert.equal(CHART_INDICATOR_BY_ID.has("volume-swing"), false, "do not show a duplicate pending row");
  assert.equal(CHART_INDICATOR_BY_ID.get("deep-profile-swing")?.name, "KWANT Profile Swing");
  const restored = normalizePaneIndicatorState({ pane: [{
    instanceId: "old-volume-swing",
    indicatorId: "volume-swing",
    enabled: true,
    settings: { reversalTicks: 33, customNote: "preserved" },
  }] }).pane[0];
  assert.equal(restored.indicatorId, "deep-profile-swing");
  assert.equal(restored.settings.reversalTicks, 33);
  assert.equal(restored.settings.customNote, "preserved");
});
