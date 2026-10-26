import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  compactChronologicalLiveTicks,
  enqueueLiveCandleSnapshot,
} from "../src/lib/chartLiveEvents.ts";
import { retainFormingCandleExtrema } from "../src/lib/liveCandleAuthority.ts";

const minute = Date.parse("2026-09-07T02:30:00Z");
const ticks = [100, 110, 105, 90, 95, 100].map((mid, index) => ({
  timestamp: minute + index,
  mid,
}));
const compacted = compactChronologicalLiveTicks(
  ticks,
  (timestamp) => Math.floor(timestamp / 60_000) * 60_000,
);
assert.deepEqual(
  compacted.map((tick) => tick.mid),
  [100, 110, 90, 100],
  "a fast wick must retain its real first/high/low/last arrival order",
);
assert.ok(
  compacted.every((tick, index) => index === 0 || tick.timestamp > compacted[index - 1].timestamp),
  "compaction must never reorder market observations",
);

let queue = [];
for (const [index, close] of [100, 110, 90, 95, 100].entries()) {
  queue = enqueueLiveCandleSnapshot(queue, {
    timestamp: minute,
    open: 100,
    high: Math.max(100, close),
    low: Math.min(100, close),
    close,
    volume: index + 1,
  });
}
assert.equal(queue.length, 4, "the visible path must remain bounded during a burst");
assert.equal(queue[0].close, 100, "the first pending real observation must be retained");
assert.deepEqual(queue.slice(1).map((candle) => candle.close), [90, 95, 100]);

// A clock candle must not play stale intra-frame prices over later frames.
let clockQueue = [];
for (const close of [100, 110, 90, 95, 104]) {
  clockQueue = enqueueLiveCandleSnapshot(clockQueue, {
    timestamp: minute, open: 100,
    high: Math.max(100, close), low: Math.min(100, close), close,
  }, 4, true);
}
assert.equal(clockQueue.length, 1);
assert.deepEqual([clockQueue[0].open, clockQueue[0].high, clockQueue[0].low, clockQueue[0].close], [100, 110, 90, 104]);
clockQueue = enqueueLiveCandleSnapshot(clockQueue, {
  timestamp: minute + 60000, open: 105, high: 106, low: 105, close: 106,
}, 4, true);
assert.equal(clockQueue.length, 2, "a real rollover must retain the finalized prior candle");
assert.equal(clockQueue[0].close, 104);
assert.equal(clockQueue[1].close, 106);

const observedWick = {
  timestamp: minute,
  open: 100,
  high: 112,
  low: 99,
  close: 110,
  volume: 20,
  askVolume: 12,
  bidVolume: 8,
};
const staleSnapshot = {
  timestamp: minute,
  open: 100,
  high: 105,
  low: 101,
  close: 103,
  volume: 12,
  askVolume: 7,
  bidVolume: 5,
};
const retainedWick = retainFormingCandleExtrema(observedWick, staleSnapshot);
assert.equal(retainedWick.high, 112, "a later snapshot must not erase an observed upper wick");
assert.equal(retainedWick.low, 99, "a later snapshot must not erase an observed lower wick");
assert.equal(retainedWick.close, 103, "the newest real close must still move inside the retained wick");
assert.equal(retainedWick.volume, 20, "a stale cumulative counter must not move backwards");
assert.deepEqual(
  retainFormingCandleExtrema(observedWick, { ...staleSnapshot, timestamp: minute + 60_000 }),
  retainFormingCandleExtrema(null, { ...staleSnapshot, timestamp: minute + 60_000 }),
  "a new source bar must start with its own independent extrema",
);

const workspaceSource = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspaceSource, /for \(const point of liveTickPath\.path\)/);
assert.match(workspaceSource, /for \(const point of timeBasedPath\.path\)/);
const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(chartSource, /authoritativeCandle = retainFormingCandleExtrema/);
assert.match(chartSource, /pendingCandles = enqueueLiveCandleSnapshot\(\s*pendingCandles, authoritativeCandle, 4, timeframeToMs\(timeframe\) !== null/);
assert.match(chartSource, /const candle = pendingCandles\.shift\(\)/);

console.log("Live candle visual path checks passed, including latest-frame coalescing and rollover retention");
