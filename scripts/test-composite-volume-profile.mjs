import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCompositeVolumeProfileRange } from "../src/lib/compositeVolumeProfile.ts";

const minute = 60_000;
const candles = Array.from({ length: 10 }, (_, index) => ({ timestamp: (index + 1) * minute }));

assert.deepEqual(
  resolveCompositeVolumeProfileRange({ candles, intervalMs: minute, mode: "loaded-range", lengthValue: 500 }),
  { startMs: minute, endMs: 11 * minute },
  "loaded range must cover every loaded bar exactly once",
);
assert.deepEqual(
  resolveCompositeVolumeProfileRange({ candles, intervalMs: minute, mode: "rolling-bars", lengthValue: 3 }),
  { startMs: 8 * minute, endMs: 11 * minute },
  "rolling bars must anchor at the requested bar count",
);
assert.deepEqual(
  resolveCompositeVolumeProfileRange({ candles, intervalMs: minute, mode: "rolling-days", lengthValue: 2 }),
  { startMs: 11 * minute - 2 * 24 * 60 * minute, endMs: 11 * minute },
  "rolling days must request the full calendar window, including history before the loaded pane",
);
assert.deepEqual(
  resolveCompositeVolumeProfileRange({ candles, intervalMs: minute, mode: "rolling-weeks", lengthValue: 2 }),
  { startMs: 11 * minute - 14 * 24 * 60 * minute, endMs: 11 * minute },
  "the reference week length unit must map to seven calendar days",
);
assert.deepEqual(
  resolveCompositeVolumeProfileRange({
    candles,
    intervalMs: minute,
    mode: "custom",
    lengthValue: 1,
    customStartMs: "2026-09-01T09:30",
    customEndMs: "2026-09-01T16:00",
    customEndFollowsLatest: false,
  }),
  {
    startMs: Date.parse("2026-09-01T09:30"),
    endMs: Date.parse("2026-09-01T16:00"),
  },
  "custom boundaries must retain the user's exact local datetime selection",
);
assert.equal(
  resolveCompositeVolumeProfileRange({
    candles,
    intervalMs: minute,
    mode: "custom",
    lengthValue: 1,
    customStartMs: "",
  }),
  null,
  "an incomplete custom range must never issue a fabricated request",
);


const { compositeArchiveWindow } = await import("../src/lib/compositeVolumeProfile.ts");
const base = Date.parse("2026-11-12T15:00:00Z");
const eventBars = [
  { timestamp: base + 1_000, sourceStartTimestamp: base + 1_000, sourceEndTimestamp: base + 29_100 },
  { timestamp: base + 29_200, sourceStartTimestamp: base + 29_200, sourceEndTimestamp: base + 91_500 },
  { timestamp: base + 94_500, sourceStartTimestamp: base + 94_500, sourceEndTimestamp: base + 134_800 },
];
const eventRange = resolveCompositeVolumeProfileRange({
  candles: eventBars, intervalMs: null, mode: "rolling-bars", lengthValue: 2,
});
assert.deepEqual(eventRange, { startMs: base + 29_200, endMs: base + 134_801 });
assert.deepEqual(compositeArchiveWindow(eventRange, base + 130_000), {
  startMs: base + minute, endMs: base + 2 * minute,
});
assert.equal(compositeArchiveWindow(eventRange, base + 59_999), null);
assert.deepEqual(resolveCompositeVolumeProfileRange({
  candles: eventBars, intervalMs: null, mode: "rolling-bars", lengthValue: 1,
  replayEndMs: base + 90_000,
}), { startMs: base + 29_200, endMs: base + 90_000 });
assert.equal(resolveCompositeVolumeProfileRange({
  candles, intervalMs: minute, mode: "custom", lengthValue: 1, customStartMs: minute,
  customEndFollowsLatest: false,
}), null);

const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

assert.match(config, /VOLUME_PROFILE_INDICATOR_IDS[\s\S]*"composite-volume-profile"/);
assert.match(config, /indicatorId === "composite-volume-profile" \? "right" : "left"/);
assert.match(control, /RENDERED_CHART_INDICATOR_IDS[\s\S]*"composite-volume-profile"/);
assert.match(control, /Complete loaded range[\s\S]*Rolling bars[\s\S]*Rolling minutes[\s\S]*Rolling calendar days[\s\S]*Rolling weeks[\s\S]*Rolling calendar months[\s\S]*Custom start and end/);
assert.match(workspace, /period: "custom"[\s\S]*startMs: compositeProfileRange\.startMs[\s\S]*endMs: compositeProfileRange\.endMs/);
assert.match(workspace, /applyInstitutionalTradesToVolumeProfile\(profile, batch\)/);
assert.match(chart, /const instance = resolveVolumeProfileOwner\(profile, indicators\)/);

console.log("Composite Volume Profile range, activation, exact-request and live-update wiring verified.");
