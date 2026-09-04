import assert from "node:assert/strict";
import { calculateDeepMIVB, normalizeDeepMIVBSettings } from "../src/lib/deepMIVB.ts";

const settings = normalizeDeepMIVBSettings({ openingRangeMinutes: 29, lookbackSessions: 999 }, { upColor: "#0f0", downColor: "#f00", neutralColor: "#999" });
assert.equal(settings.openingRangeMinutes, 30);
assert.equal(settings.lookbackSessions, 120);
const base = Date.parse("2026-09-03T13:30:00Z"); // 08:30 Chicago daylight time
const candle = (minutes, open, high, low, close) => ({ timestamp: base + minutes * 60_000, open, high, low, close, volume: 1 });
const frames = calculateDeepMIVB([
  candle(0, 100, 102, 99, 101), candle(15, 101, 104, 100, 103),
  candle(30, 103, 105, 102, 105), candle(60, 105, 108, 104, 107),
], settings);
assert.equal(frames.length, 1);
assert.equal(frames[0].high, 104);
assert.equal(frames[0].low, 99);
assert.equal(frames[0].middle, 101.5);
assert.equal(frames[0].state, "positive");
assert.ok(frames[0].averageHigh > frames[0].high);
console.log("KWANT-M IVB normalization and opening-range projections passed.");
