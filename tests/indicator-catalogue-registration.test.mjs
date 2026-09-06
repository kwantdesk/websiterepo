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
  assert.ok(pending.includes("absolute-levels"));
  assert.ok(pending.includes("volume-delta-sprint"));
});
