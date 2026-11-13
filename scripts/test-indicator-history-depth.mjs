import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { indicatorHistoryDays, indicatorHistoryStart } from "../src/lib/indicatorHistoryRange.ts";

const minute = 60_000;
const day = 24 * 60 * minute;
const start = Date.UTC(2026, 9, 1);
const candles = Array.from({ length: 30 * 24 * 60 }, (_, i) => {
  const price = 20_000 + Math.sin(i / 11) * 10;
  return { timestamp: start + i * minute, open: price, high: price + 1, low: price - 1,
    close: price, volume: 20, delta: i % 3 - 1, bidVolume: 10, askVolume: 10 + (i % 3 - 1) };
});
const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#888" };
const latest = candles.at(-1).timestamp;
assert.equal(indicatorHistoryDays({ daysToLoad: 5 }), null);
assert.equal(indicatorHistoryStart({}, start, latest), start);
assert.equal(indicatorHistoryStart({ indicatorHistoryMode: "manual", historyDaysLimit: 1 }, start, latest), latest - day);

for (const indicatorId of ["volume", "relative-strength-index-rsi", "delta-bar", "cumulative-volume-delta"]) {
  const run = (settings, replayTimestampMs, timeframe = "1m") => calculateIndicatorSeries(
    { instanceId: indicatorId, indicatorId, enabled: true, settings },
    candles, theme, { instrument: "NQ", timeframe, tickSize: 0.25, replayTimestampMs },
  ).find(series => series.data.length)?.data;
  const auto = run({});
  assert.ok(auto?.length > 40_000, indicatorId);
  const manual = run({ indicatorHistoryMode: "manual", historyDaysLimit: 1 });
  assert.deepEqual(manual, auto.filter(point => point.time * 1_000 >= latest - day));
  assert.ok(run({}, undefined, "200v").length > 40_000, `${indicatorId} on volume bars`);
  const replayClock = start + 2 * day;
  assert.ok(run({}, replayClock).every(point => point.time * 1_000 <= replayClock));
}
console.log("Full month, manual cutoff with retained warmup, and causal replay verified.");
