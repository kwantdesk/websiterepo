import { test } from "node:test";
import assert from "node:assert/strict";
import { planVolumeProfileVariantJobs } from "../src/lib/volumeProfileVariants.ts";
import { VOLUME_PROFILE_INDICATOR_IDS, defaultIndicatorSettings, normalizePaneIndicatorState, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";

const candles = Array.from({ length: 60 }, (_, index) => ({
  timestamp: Date.parse("2026-09-04T14:30:00Z") + index * 60_000,
  open: 20000, high: 20001, low: 19999, close: 20000, volume: 10,
}));
const base = { candles, intervalMs: 60_000, clockMs: Date.parse("2026-09-04T20:00:00Z"), symbol: "NQ", contractSymbol: "NQU6" };
const instance = (indicatorId, settings = {}) => ({ instanceId: indicatorId, indicatorId, enabled: true, settings: { ...defaultIndicatorSettings(indicatorId), ...settings } });

test("every fresh volume-profile variant starts at width two without replacing saved widths", () => {
  for (const id of VOLUME_PROFILE_INDICATOR_IDS) {
    const defaults = defaultIndicatorSettings(id);
    assert.equal(defaults.profileWidth, 2, `${id} current width`);
    assert.equal(defaults.previousProfileWidth, 2, `${id} previous width`);
    const saved = normalizeStoredIndicator({
      instanceId: id,
      indicatorId: id,
      enabled: true,
      settings: { ...defaults, profileWidth: 7, previousProfileWidth: 5 },
    });
    assert.equal(saved.settings.profileWidth, 7, `${id} saved current width`);
    assert.equal(saved.settings.previousProfileWidth, 5, `${id} saved previous width`);
  }
});

test("monthly, session and visible variants own distinct exact custom jobs", () => {
  const jobs = planVolumeProfileVariantJobs({
    ...base,
    visibleLogicalRange: { from: 5, to: 25 },
    instances: [instance("monthly-volume-profile", { numberOfProfiles: 2 }), instance("session-volume-profile"), instance("visible-range-volume-profile")],
  });
  assert.ok(jobs.some((job) => job.ownerId === "monthly-volume-profile"));
  assert.ok(jobs.some((job) => job.ownerId === "session-volume-profile" && /RTH/.test(job.label)));
  assert.ok(jobs.some((job) => job.ownerId === "visible-range-volume-profile" && job.startMs === candles[5].timestamp));
  assert.equal(new Set(jobs.map((job) => job.key)).size, jobs.length);
  assert.ok(jobs.every((job) => job.request.period === "custom" && job.request.groupTicks === 1));
});

test("ambiguous/unsupported filtered range jobs fail closed", () => {
  const jobs = planVolumeProfileVariantJobs({
    ...base,
    visibleLogicalRange: { from: 0, to: 5 },
    instances: [instance("monthly-volume-profile", { filterMode: "filter" }), instance("visible-range-volume-profile", { filterMode: "filter" })],
  });
  assert.deepEqual(jobs, []);
});

test("all three variants have shared settings, persistence and release gates", () => {
  for (const id of ["monthly-volume-profile", "session-volume-profile", "visible-range-volume-profile"]) {
    const defaults = defaultIndicatorSettings(id);
    assert.ok(Object.keys(defaults).length > 40);
    const restored = normalizePaneIndicatorState({ pane: [{ instanceId: id, indicatorId: id, enabled: true, settings: { ...defaults, valueAreaPercent: 67 } }] }).pane[0];
    assert.equal(restored.settings.valueAreaPercent, 67);
    assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === id));
  }
});
