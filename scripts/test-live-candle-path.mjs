import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  compactChronologicalLiveTicks,
  enqueueLiveCandleSnapshot,
} from "../src/lib/chartLiveEvents.ts";

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

const workspaceSource = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
assert.match(workspaceSource, /for \(const point of liveTickPath\.path\)/);
assert.match(workspaceSource, /for \(const point of timeBasedPath\.path\)/);
const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(chartSource, /pendingCandles = enqueueLiveCandleSnapshot/);
assert.match(chartSource, /const candle = pendingCandles\.shift\(\)/);

console.log("Live candle visual path: 8/8 checks passed");
