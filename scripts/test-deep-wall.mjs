import assert from "node:assert/strict";
import { buildDeepWallFrame, isDeepWallInstrumentSupported, normalizeDeepWallSettings } from "../src/lib/deepWall.ts";
const base = Date.parse("2026-09-04T14:00:00Z");
const row = (tickIndex, bidVolume, askVolume) => ({ tickIndex, bidVolume, askVolume, totalVolume: bidVolume + askVolume });
const bar = (id, index, highTick, lowTick, closeTick, rows, isClosed = true) => ({ id, startTime: base + index * 60_000, highTick, lowTick, closeTick, rows, hasPriceLevelFlow: true, isClosed });
const bars = [
  bar("lead", 0, 100, 94, 98, [row(100, 20, 20), row(99, 20, 20)]),
  bar("wall", 1, 105, 98, 103, [row(105, 20, 300), row(104, 20, 200)]),
  bar("reject", 2, 104, 96, 100, [row(100, 50, 40)]),
];
const frame = buildDeepWallFrame(bars, "ESU6", .25);
assert.equal(frame.markers.length, 1);
assert.equal(frame.markers[0].side, "sell-wall");
assert.equal(frame.markers[0].confirmedAt, bars[2].startTime);
assert.equal(buildDeepWallFrame(bars, "NQ", .25).status, "UNSUPPORTED_INSTRUMENT");
assert.equal(buildDeepWallFrame([{ ...bars[0], hasPriceLevelFlow: false, rows: [] }], "ES", .25).status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.equal(buildDeepWallFrame(bars, "ES", .25, { minimumClusterVolume: 999 }).markers.length, 0);
assert.equal(buildDeepWallFrame(bars, "ES", .25, { minimumDeltaPercent: 95 }).markers.length, 0);
assert.equal(isDeepWallInstrumentSupported("MESZ26"), true);
const normalized = normalizeDeepWallSettings({ tickGrouping: 0, highestLowestMinimumBars: 1, minimumDeltaPercent: 999, plotPrice: "bad" });
assert.equal(normalized.tickGrouping, 1); assert.equal(normalized.highestLowestMinimumBars, 2); assert.equal(normalized.minimumDeltaPercent, 100); assert.equal(normalized.plotPrice, "price-slope");
console.log("Deep Wall tests passed.");
