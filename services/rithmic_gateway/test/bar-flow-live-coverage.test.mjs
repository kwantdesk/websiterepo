import test from "node:test";
import assert from "node:assert/strict";
import { supplementArchivedBarFlow } from "../src/bar-flow-live-coverage.mjs";
const minute = 60_000, start = Date.UTC(2026, 10, 6, 14);
const bar = (offset) => ({ timestamp: start + offset * minute, volume: 10, trades: 4, open: 101, high: 102, low: 100, close: 101 });
const flow = (offset) => ({ ...bar(offset), askVolume: 6, bidVolume: 4, delta: 2, deltaHigh: 3, deltaLow: -1 });
test("stale archive tail receives only matching closed execution flow, with no replay lookahead", () => {
  const candles = [0, 1, 2, 3, 4, 5, 6].map(bar);
  delete candles[2].trades; // Current recorded price bars do not include a trade count.
  const archived = new Map([[bar(0).timestamp, flow(0)], [bar(1).timestamp, { ...flow(1), volume: 3 }]]);
  const result = supplementArchivedBarFlow({
    candles, archived, intervalMs: minute, fromMs: start, toMs: start + 5 * minute + 10, nowMs: start + 6 * minute + 10,
    readLive: (range) => {
      assert.equal(range.fromMs, bar(1).timestamp);
      assert.equal(range.toMs, bar(5).timestamp - 1);
      return [flow(0), flow(1), flow(2), { ...flow(3), trades: 2 }, { ...flow(4), low: 99 }, flow(5), flow(6)];
    },
  });
  assert.deepEqual([...result.values()], [flow(0), flow(1), flow(2)]);
  assert.equal(archived.get(bar(1).timestamp).volume, 3);
});
test("fully covered or out-of-window history skips the live book entirely", () => {
  const candles = [bar(0)], archived = new Map([[start, flow(0)]]);
  for (const options of [{ archived, nowMs: start + minute }, { archived: new Map(), nowMs: start + 30 * 60 * minute }]) {
    assert.equal(supplementArchivedBarFlow({ ...options, candles, intervalMs: minute,
      readLive: () => assert.fail("unexpected book read") }), options.archived);
  }
});
