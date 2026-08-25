import assert from "node:assert/strict";

import { evaluateLabTradeOutcome } from "../src/lib/labTradeOutcome.ts";

const at = "2026-08-25T13:30:00.000Z";
const baseTrade = {
  status: "ARMED",
  side: "LONG",
  name: "Verified defence",
  zone: [100, 101],
  entryReference: 101,
  issuedAt: at,
  armedAt: at,
  permission: "Reclaim with displacement.",
  entryTrigger: "Higher low and reclaim.",
  stop: 99,
  coreTarget: 105,
  runnerTarget: 108,
  invalidation: "Acceptance below 99.",
  announce: [],
};

const candle = (minutes, low, high, close = high) => ({
  timestamp: Date.parse(at) + minutes * 60_000,
  open: low,
  high,
  low,
  close,
});

const notArmed = evaluateLabTradeOutcome([], { ...baseTrade, status: "WAIT", armedAt: null });
assert.equal(notArmed.status, "NOT_ARMED");
assert.equal(notArmed.entryPrice, 101);

const awaiting = evaluateLabTradeOutcome([candle(1, 102, 103)], baseTrade);
assert.equal(awaiting.status, "AWAITING_ENTRY");
assert.equal(awaiting.entryAt, null);

const live = evaluateLabTradeOutcome([
  candle(1, 100.5, 101.5),
  candle(2, 100, 103),
], baseTrade);
assert.equal(live.status, "LIVE");
assert.equal(live.entryPrice, 101);
assert.equal(live.mfePoints, 2);
assert.equal(live.maePoints, 1);
assert.equal(live.peakR, 1);

const runner = evaluateLabTradeOutcome([
  candle(1, 100.5, 101.5),
  candle(2, 100.5, 105.5),
  candle(3, 104.5, 108.25),
], baseTrade);
assert.equal(runner.status, "RUNNER_HIT");
assert.ok(runner.coreHitAt);
assert.ok(runner.runnerHitAt);
assert.equal(runner.stopHitAt, null);
assert.equal(runner.peakR, 3.63);

const stoppedShort = evaluateLabTradeOutcome([
  candle(1, 101.5, 102.5),
  candle(2, 101, 104.5),
], {
  ...baseTrade,
  side: "SHORT",
  zone: [102, 103],
  entryReference: 102,
  stop: 104,
  coreTarget: 98,
  runnerTarget: 95,
});
assert.equal(stoppedShort.status, "STOPPED");
assert.ok(stoppedShort.stopHitAt);
assert.equal(stoppedShort.coreHitAt, null);
assert.equal(stoppedShort.peakR, 0.5);

const indeterminate = evaluateLabTradeOutcome([
  candle(1, 98.5, 105.5),
], baseTrade);
assert.equal(indeterminate.status, "INDETERMINATE");
assert.ok(indeterminate.coreHitAt);
assert.ok(indeterminate.stopHitAt);
assert.match(indeterminate.summary, /intrabar order is unknown/i);

console.log("THE LAB trade outcome: 22 assertions passed");
