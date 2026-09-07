import test from "node:test";
import assert from "node:assert/strict";

import { mergeMissingEventBarOrderFlow } from "../src/lib/eventOrderFlowMerge.ts";
import { normalizeDatabentoExecutionTuple } from "../src/lib/databentoExecutionTuple.ts";

const candle = (timestamp, askVolume, bidVolume) => ({
  timestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: askVolume + bidVolume,
  askVolume,
  bidVolume,
  delta: askVolume - bidVolume,
  deltaOpen: 0,
  deltaHigh: Math.max(0, askVolume - bidVolume),
  deltaLow: Math.min(0, askVolume - bidVolume),
  deltaClose: askVolume - bidVolume,
});

const trade = (timestamp, askVolume, bidVolume, flowOnly = false) => ({
  eventId: `${timestamp}-${flowOnly}`,
  recordIndex: timestamp,
  timestamp,
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  trades: 1,
  volume: askVolume + bidVolume,
  askVolume,
  bidVolume,
  delta: askVolume - bidVolume,
  aggressor: askVolume > bidVolume ? "BUY" : "SELL",
  sideSemanticsVersion: 2,
  flowOnly,
});

test("verified event-bar flow remains authoritative over a bounded tape", () => {
  const exactBar = candle(1_000, 70, 30);
  const merged = mergeMissingEventBarOrderFlow(
    [exactBar],
    [trade(1_100, 5, 45, true), trade(1_200, 4, 6)],
  );

  assert.equal(merged[0].askVolume, 70);
  assert.equal(merged[0].bidVolume, 30);
  assert.equal(merged[0].deltaClose, 40);
});

test("only exact prints can repair a missing event-bar flow value", () => {
  const missing = candle(1_000, 0, 0);
  const summaryOnly = mergeMissingEventBarOrderFlow([missing], [trade(1_100, 80, 20, true)]);
  assert.strictEqual(summaryOnly[0], missing);

  const repaired = mergeMissingEventBarOrderFlow([missing], [trade(1_100, 8, 2)]);
  assert.equal(repaired[0].askVolume, 8);
  assert.equal(repaired[0].bidVolume, 2);
  assert.equal(repaired[0].deltaClose, 6);
});

test("historical flow tuples retain side totals and their non-exact marker", () => {
  assert.deepEqual(
    normalizeDatabentoExecutionTuple([1_000, 100, 25, 5, 15, 10, 7, "flow"]),
    [1_000, 100, 25, 5, 15, 10, 7, "flow"],
  );
  assert.deepEqual(
    normalizeDatabentoExecutionTuple([1_000, 100, 25, -25]),
    [1_000, 100, 25, -25],
  );
});
