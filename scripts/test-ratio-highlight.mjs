import assert from "node:assert/strict";
import { buildRatioHighlightFrame, normalizeRatioHighlightSettings } from "../src/lib/ratioHighlight.ts";

const row = (tickIndex, bidVolume, askVolume) => ({ tickIndex, bidVolume, askVolume });
const bar = (id, time, open, close, rows, isClosed = true) => ({
  id, startTime: time, endTime: time + 60_000, open, close,
  highTick: Math.max(...rows.map((item) => item.tickIndex)),
  lowTick: Math.min(...rows.map((item) => item.tickIndex)),
  rows, hasPriceLevelFlow: true, isClosed,
});
const base = Date.parse("2026-09-03T23:00:00Z");
const falling = bar("falling", base, 101, 100, [row(100, 1, 120), row(101, 2, 4)]);
const rising = bar("rising", base + 60_000, 100, 101, [row(100, 2, 4), row(101, 30, 7)], false);

const barsMode = buildRatioHighlightFrame([falling, rising], "NQ", { ratioMode: "bar", minRatio: 10, maxRatio: 20 });
assert.deepEqual(barsMode.markers.map((marker) => marker.side), ["low"], "Bar mode must use Ratio High for bearish bars and Ratio Low for bullish bars");
assert.equal(barsMode.markers[0].ratio, 15);
assert.equal(barsMode.status, "LIVE");

const highOnly = buildRatioHighlightFrame([falling], "NQ", { ratioMode: "high", minRatio: 20, maxRatio: 0 });
assert.equal(highOnly.markers[0].ratio, 30, "zero maximum must mean no upper cap");
const unavailable = buildRatioHighlightFrame([{ ...falling, rows: [], hasPriceLevelFlow: false }], "NQ");
assert.equal(unavailable.status, "WAITING_FOR_VOLUME_AT_PRICE");
assert.deepEqual(unavailable.markers, []);
const normalized = normalizeRatioHighlightSettings({ ratioMode: "bad", minRatio: -1, opacity: 999 });
assert.equal(normalized.ratioMode, "bar");
assert.equal(normalized.minRatio, 0);
assert.equal(normalized.opacity, 100);
console.log("Ratio Highlight tests passed.");
