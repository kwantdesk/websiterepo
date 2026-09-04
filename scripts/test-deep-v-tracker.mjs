import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildDeepVTrackerFrame, normalizeDeepVTrackerSettings } from "../src/lib/deepVTracker.ts";

const base = Date.parse("2026-09-05T00:00:00Z");
const row = (tickIndex, bidVolume, askVolume) => ({ tickIndex, bidVolume, askVolume, totalVolume: bidVolume + askVolume });
const bar = (id, index, openTick, highTick, lowTick, closeTick, bidVolume, askVolume, rows, isClosed = true) => ({
  id,
  startTime: base + index * 60_000,
  endTime: base + (index + 1) * 60_000,
  timestamp: base + index * 60_000,
  openTick, highTick, lowTick, closeTick,
  open: openTick * .25, high: highTick * .25, low: lowTick * .25, close: closeTick * .25,
  bidVolume, askVolume, classifiedVolume: bidVolume + askVolume, totalVolume: bidVolume + askVolume,
  delta: askVolume - bidVolume,
  rows,
  hasPriceLevelFlow: true,
  isClosed,
});

const bars = [
  bar("base", 0, 100, 102, 98, 101, 50, 50, [row(101, 25, 25), row(100, 25, 25)]),
  bar("accelerate", 1, 101, 108, 100, 107, 50, 350, [row(107, 20, 280), row(106, 30, 70)]),
  bar("absorb", 2, 107, 110, 102, 103, 40, 260, [row(110, 10, 220), row(104, 30, 40)]),
  bar("follow", 3, 103, 105, 99, 101, 60, 40, [row(101, 40, 20), row(100, 20, 20)], false),
];

const frame = buildDeepVTrackerFrame(bars, "NQ", .25);
assert.equal(frame.status, "LIVE");
assert.ok(frame.patterns.some((item) => item.kind === "acceleration" && item.timestamp === bars[1].startTime));
assert.ok(frame.levels.some((item) => item.kind === "pressure" && item.side === "ask"));
assert.ok(frame.levels.some((item) => item.kind === "absorption" && item.side === "ask"));
assert.equal(buildDeepVTrackerFrame([{ ...bars[0], hasPriceLevelFlow: false, rows: [] }], "NQ", .25).status, "WAITING_FOR_VOLUME_AT_PRICE");

const quiet = buildDeepVTrackerFrame(bars, "NQ", .25, { accelerationEnabled: false, absorptionPressureEnabled: false });
assert.equal(quiet.patterns.length, 0);
assert.equal(quiet.levels.length, 0);

const normalized = normalizeDeepVTrackerSettings({ accelerationMode: "invalid", levelMode: "invalid", controlLineWidth: 99, extremeLineWidth: -2, textSize: 1, projectionBars: 0, patternOpacity: 999 });
assert.equal(normalized.accelerationMode, "strong");
assert.equal(normalized.levelMode, "medium");
assert.equal(normalized.controlLineWidth, 8);
assert.equal(normalized.extremeLineWidth, 0);
assert.equal(normalized.textSize, 6);
assert.equal(normalized.projectionBars, 1);
assert.equal(normalized.patternOpacity, 100);

const longBars = Array.from({ length: 20_000 }, (_, index) => bar(
  `perf-${index}`, index, 100 + index % 4, 103 + index % 4, 98 + index % 4, 101 + index % 4,
  50, 55, [row(100 + index % 4, 50, 55)], index < 19_999,
));
const started = performance.now();
buildDeepVTrackerFrame(longBars, "ES", .25);
assert.ok(performance.now() - started < 2_000, "20,000 bars should remain comfortably linear");

console.log("KWANT V-Tracker tests passed.");
