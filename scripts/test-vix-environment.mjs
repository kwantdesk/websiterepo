import assert from "node:assert/strict";

import {
  buildVixEnvironmentSnapshot,
  calculateVixHistoryStats,
  classifyVixEnvironment,
  normalizeVixHistoryCandles,
  resolveVixEnvironmentSymbol,
} from "@/lib/vixEnvironment.ts";

assert.equal(classifyVixEnvironment(12), "CALM");
assert.equal(classifyVixEnvironment(17), "NORMAL");
assert.equal(classifyVixEnvironment(22), "ELEVATED");
assert.equal(classifyVixEnvironment(27), "HIGH");
assert.equal(classifyVixEnvironment(35), "EXTREME");

assert.equal(resolveVixEnvironmentSymbol("NQ", "AUTO"), "VXN");
assert.equal(resolveVixEnvironmentSymbol("MNQ", "AUTO"), "VXN");
assert.equal(resolveVixEnvironmentSymbol("ES", "AUTO"), "VIX");
assert.equal(resolveVixEnvironmentSymbol("QQQ", "VIX"), "VIX");

const dayMs = 86_400_000;
const start = Date.UTC(2025, 0, 1);
const rows = normalizeVixHistoryCandles(Array.from({ length: 260 }, (_, index) => ({
  timestamp: start + index * dayMs,
  open: 10 + index / 20,
  high: 11 + index / 20,
  low: 9 + index / 20,
  close: 10 + index / 20,
})));
assert.equal(rows.length, 260);

const clock = start + 250 * dayMs;
const stats = calculateVixHistoryStats(rows, 22.5, clock);
assert.equal(stats.latest?.timestamp, clock);
assert.equal(Math.round(stats.rank52Week ?? -1), 100);
assert.equal(Math.round(stats.percentile52Week ?? -1), 100);

const replay = buildVixEnvironmentSnapshot({
  symbol: "VIX",
  live: null,
  history: rows,
  asOfMs: clock,
  replay: true,
});
assert.ok(replay);
assert.equal(replay.value, 22.5);
assert.equal(replay.checkedAt, new Date(clock).toISOString());
assert.equal(replay.stale, true);
assert.equal(replay.marketOpen, false);

const live = buildVixEnvironmentSnapshot({
  symbol: "VIX",
  live: {
    symbol: "VIX",
    lastPrice: 24,
    openPrice: 20,
    change: 4,
    changePercent: 20,
    timestamp: clock,
    marketOpen: true,
    delayed: false,
    provider: "Massive (VPS)",
  },
  history: rows,
  asOfMs: clock,
});
assert.ok(live);
assert.equal(live.value, 24);
assert.equal(live.change, 4);
assert.equal(live.changePercent, 20);
assert.equal(live.stale, false);
assert.equal(live.sourceLabel, "VIX · Massive (VPS)");

console.log("VIX environment calculations passed.");
