import assert from "node:assert/strict";
import { calculateDeepDeltaBars, normalizeDeepDeltaSettings } from "../src/lib/deepDelta.ts";

const candle = (timestamp, askVolume, bidVolume, extra = {}) => ({
  timestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: askVolume + bidVolume,
  askVolume,
  bidVolume,
  ...extra,
});

const normalized = normalizeDeepDeltaSettings({
  barGrouping: 0,
  range1Minimum: 12,
  range1Maximum: 3,
  lineWidth: 99,
  inputData: "not-real",
});
assert.equal(normalized.barGrouping, 1, "grouping is bounded to at least one source bar");
assert.equal(normalized.range1Maximum, 12, "a finite range maximum cannot be below its minimum");
assert.equal(normalized.lineWidth, 6, "line thickness remains inside the supported renderer range");
assert.equal(normalized.inputData, "volume", "invalid inputs fall back to the documented Volume mode");

const tiered = calculateDeepDeltaBars([
  candle(1_000, 6, 3),
  candle(2_000, 9, 3),
  candle(3_000, 20, 2),
  candle(4_000, 40, 1),
], { barGrouping: 1 });
assert.deepEqual(tiered.map((bar) => bar.range), [1, 1, 2, 4], "the four magnitude tiers select bars deterministically");
assert.ok(tiered.every((bar) => bar.side === "ask"), "positive delta is rendered on the Ask side");

const grouped = calculateDeepDeltaBars([
  candle(1_000, 8, 3, { deltaClose: 5, deltaHigh: 7, deltaLow: -2 }),
  candle(2_000, 1, 5, { deltaClose: -4, deltaHigh: 1, deltaLow: -6 }),
  candle(3_000, 3, 1, { deltaClose: 2, deltaHigh: 3, deltaLow: 0 }),
], { barGrouping: 2, markerEnabled: true, markerMinimumDelta: 1 });
assert.equal(grouped.length, 2, "the forming partial group is emitted for immediate live updates");
assert.deepEqual(grouped[0], {
  time: 2,
  open: 0,
  high: 7,
  low: -2,
  close: 1,
  range: 1,
  side: "ask",
  struggle: true,
}, "grouped bars preserve the exchange-sequenced cumulative extremes");
assert.equal(grouped[1].close, 2, "the current incomplete group is not delayed until closure");

const counts = calculateDeepDeltaBars([
  candle(1_000, 100, 1, { askTrades: 2, bidTrades: 7 }),
], { inputData: "trades", barGrouping: 1, deltaMode: "classic" });
assert.equal(counts[0].close, -5, "Trades uses signed execution counts rather than volume");
assert.equal(counts[0].range, 0, "Classic mode uses the positive/negative pair without magnitude tiers");

const aggregate = calculateDeepDeltaBars([
  candle(1_000, 13, 5, { deltaClose: 8, deltaHigh: 10, deltaLow: -1 }),
], { inputData: "aggregate-trades", barGrouping: 1 });
assert.equal(aggregate[0].close, 8, "aggregate trades preserves the signed execution total");

const noOrderFlow = calculateDeepDeltaBars([
  candle(1_000, 0, 0),
], { barGrouping: 1 });
assert.equal(noOrderFlow.length, 0, "missing order flow never produces invented delta bars");

const many = Array.from({ length: 20_000 }, (_, index) => candle(index * 1_000, 10 + (index % 3), 8));
const started = performance.now();
const bounded = calculateDeepDeltaBars(many, { barGrouping: 4 });
assert.equal(bounded.length, 5_000, "large histories group to the expected bounded output size");
assert.ok(performance.now() - started < 5_000, "twenty thousand source bars remain inside the linear calculation budget");

console.log("KWANT Delta tests passed");
