import assert from "node:assert/strict";
import test from "node:test";
import { admitLiveBigTradePrints, calculateBigTradePrintsWithContext } from "../src/lib/bigTrades.ts";
import { normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

test("Big Contracts honors a five-contract RTH threshold on a sparse tape in both paint paths", () => {
  const rth = Date.parse("2026-11-05T16:00:00Z");
  const execution = (timestamp, volume) => ({
    eventId: String(timestamp), timestamp, open: 20_000, high: 20_000, low: 20_000, close: 20_000,
    trades: 1, volume, askVolume: volume, bidVolume: 0, aggressor: "BUY",
  });
  const overnight = execution(rth - 12 * 60 * 60_000, 5);
  const live = [4, 5, 6].map((size, index) => execution(rth + index * 1_000, size));
  const settings = { sessionFilterEnabled: true, filterMode: "manual", manualFilter: 30,
    rthFilterMode: "manual", rthManualFilter: 5, enableClustering: false, daysToLoad: 1 };
  const seed = calculateBigTradePrintsWithContext([], [overnight], settings, rth);
  const full = calculateBigTradePrintsWithContext([], [overnight, ...live], settings, rth + 2_000);
  assert.deepEqual(seed.prints, []);
  assert.deepEqual(full.prints.map(({ volume }) => volume), [5, 6]);
  assert.deepEqual(admitLiveBigTradePrints(seed.context, live, rth - 1).map(({ volume }) => volume), [5, 6]);
});

test("saved indicator templates migrate removed or duplicate inputs to supported equivalents", () => {
  const cases = [
    ["speed-of-tape", "database", "order", "volume"],
    ["market-statistics", "dataType", "order", "volume"],
    ["deep-profile-values", "inputData", "order", "volume"],
    ["confluence-identifier", "inputData", "order", "volume"],
    ["bar-poc-indicator", "inputData", "aggregate-trades", "volume"],
    ["bar-poc-indicator", "inputData", "order", "order"],
    ["deep-delta", "inputData", "order", "trades"],
    ["deep-delta", "inputData", "aggregate-trades", "volume"],
  ];
  for (const [indicatorId, key, input, expected] of cases) {
    const instance = { indicatorId, instanceId: indicatorId, enabled: true, settings: { [key]: input } };
    const normalized = normalizeStoredIndicator(instance);
    assert.equal(normalized.settings[key], expected, indicatorId);
    assert.deepEqual(normalizeStoredIndicator(normalized), normalized, indicatorId);
  }
});
test("Big Contracts maximum filters live and rebuilt prints independently of the marker size cap", () => {
  const now = Date.parse("2026-11-05T16:00:00Z");
  const tape = [4, 5, 8, 9].map((volume, index) => ({
    eventId: String(index), timestamp: now + index * 1_000,
    open: 20_000, high: 20_000, low: 20_000, close: 20_000,
    volume, trades: 1, askVolume: volume, bidVolume: 0, aggressor: "BUY",
  }));
  const settings = { sessionFilterEnabled: false, filterMode: "manual", manualFilter: 5,
    maximumFilter: 8, cappingMode: "size", cappingMaxVolume: 6, enableClustering: false };
  const bounded = calculateBigTradePrintsWithContext([], tape, settings, now + 3_000);
  assert.deepEqual(bounded.prints.map(({ volume }) => volume), [5, 8]);
  assert.deepEqual(admitLiveBigTradePrints(bounded.context, tape, now - 1).map(({ volume }) => volume), [5, 8]);
  assert.deepEqual(calculateBigTradePrintsWithContext([], tape, { ...settings, maximumFilter: 0 }, now + 3_000).prints.map(({ volume }) => volume), [5, 8, 9]);
});
