import assert from "node:assert/strict";
import { IcebergRefreshDetectorEngine, normalizeIcebergRefreshSettings } from "../src/lib/icebergRefreshDetector.ts";

const baseTime = Date.parse("2026-08-16T00:00:00.000Z");
const settings = normalizeIcebergRefreshSettings({
  postSnapshotWarmupMs: 0,
  dynamicBaselineEnabled: false,
  attributionWindowMs: 200,
  minimumCycleExecution: 10,
  minimumCycleReplenishment: 10,
  minimumCycleReplenishmentRatio: 0.5,
  activeMinimumExecuted: 20,
  activeMinimumReplenished: 10,
  minimumRefreshCycles: 1,
  minimumReplenishmentRatio: 0.4,
  minimumExecutionToDisplayRatio: 0.1,
  minimumSamePriceDurationMs: 0,
  minimumSuspectedCycles: 2,
  minimumSuspectedExecuted: 40,
  minimumSuspectedReplenishmentRatio: 0.4,
  minimumSuspectedTurnover: 0.1,
  minimumSuspectedScore: 0,
  minimumQuality: 0,
  minimumBreakVolume: 10,
});

const level = (side, price, size) => ({ side, price, size, orderCount: 1 });
const snapshot = ({ at, levels = [level("BID", 100, 100), level("ASK", 100.25, 100)], trades = [], orderEvents = [], lastPrice = 100 }) => ({
  asOf: new Date(baseTime + at).toISOString(),
  contractSymbol: "NQU6", tickSize: 0.25, fullDepth: true, bookValid: true, individualOrders: true,
  ageMs: 0, levels, bestBid: 100, bestAsk: 100.25, lastPrice, microPrice: 100.125, trades, orderEvents,
});
const trade = (id, at, side, price, size) => ({ id, timestamp: baseTime + at, side, price, size });
const add = (sequence, at, side, price, size) => ({ sequence, timestamp: baseTime + at, orderId: `O${sequence}`, action: "ADD", side, price, previousPrice: null, size, previousSize: 0 });
const remove = (sequence, at, side, price, size) => ({ sequence, timestamp: baseTime + at, orderId: `O${sequence}`, action: "REMOVE", side, price, previousPrice: price, size: 0, previousSize: size });
const move = (sequence, at, side, previousPrice, price, size) => ({ sequence, timestamp: baseTime + at, orderId: `O${sequence}`, action: "MODIFY", side, price, previousPrice, size, previousSize: size });

function runBidCycles() {
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  engine.apply(snapshot({ at: 10, levels: [level("BID", 100, 60), level("ASK", 100.25, 100)], trades: [trade("T1", 10, "SELL", 100, 40)] }), settings);
  engine.apply(snapshot({ at: 50, orderEvents: [add(1, 50, "BID", 100, 40)] }), settings);
  engine.apply(snapshot({ at: 80, levels: [level("BID", 100, 60), level("ASK", 100.25, 100)], trades: [trade("T2", 80, "SELL", 100, 40)] }), settings);
  const frame = engine.apply(snapshot({ at: 120, orderEvents: [add(2, 120, "BID", 100, 40)] }), settings);
  const candidate = frame.candidates.find((item) => item.passiveSide === "BID" && item.priceTick === 400);
  assert(candidate, "bid candidate should exist");
  assert.equal(candidate.completedRefreshCycleCount, 2);
  assert.equal(candidate.cumulativeAggressiveExecuted, 80);
  assert.equal(candidate.cumulativeAttributedReplenishment, 80);
  assert.equal(candidate.state, "SUSPECTED");
  assert.equal(candidate.evidenceLevel, "price-level-aggregate");
  assert.equal(frame.nativeSupport, false);
  return frame;
}

const firstRun = runBidCycles();
const secondRun = runBidCycles();
assert.deepEqual(
  secondRun.candidates.map(({ id, state, score, completedRefreshCycleCount }) => ({ id, state, score, completedRefreshCycleCount })),
  firstRun.candidates.map(({ id, state, score, completedRefreshCycleCount }) => ({ id, state, score, completedRefreshCycleCount })),
  "replay must be deterministic",
);

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  engine.apply(snapshot({ at: 10, trades: [trade("A1", 10, "BUY", 100.25, 50)] }), settings);
  const frame = engine.apply(snapshot({ at: 40, orderEvents: [add(1, 40, "ASK", 100.25, 50)] }), settings);
  assert.equal(frame.candidates[0]?.passiveSide, "ASK", "buyer aggression must map to passive ask");
  assert.equal(frame.cycles.length, 1);
}

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  const frame = engine.apply(snapshot({ at: 20, levels: [level("BID", 100, 200), level("ASK", 100.25, 100)], orderEvents: [add(1, 20, "BID", 100, 100)] }), settings);
  assert.equal(frame.cycles.length, 0, "ordinary stack without prior execution is not refresh evidence");
  assert.equal(frame.candidates.length, 0);
}

{
  const engine = new IcebergRefreshDetectorEngine();
  const shortWindow = normalizeIcebergRefreshSettings({ ...settings, attributionWindowMs: 50 });
  engine.apply(snapshot({ at: 0 }), shortWindow);
  engine.apply(snapshot({ at: 10, trades: [trade("L1", 10, "SELL", 100, 40)] }), shortWindow);
  const frame = engine.apply(snapshot({ at: 100, orderEvents: [add(1, 100, "BID", 100, 40)] }), shortWindow);
  assert.equal(frame.cycles.length, 0, "late replenishment must not be attributed");
}

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  engine.apply(snapshot({ at: 10, trades: [trade("E1", 10, "SELL", 100, 60)] }), settings);
  const frame = engine.apply(snapshot({ at: 40, orderEvents: [add(1, 40, "BID", 100, 100)] }), settings);
  assert.equal(frame.candidates[0]?.cumulativeAttributedReplenishment, 60, "only the display deficit is refresh by default");
  assert.equal(frame.candidates[0]?.cumulativeOrdinaryStack, 40, "excess is ordinary stacking by default");
}

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  engine.apply(snapshot({ at: 10, trades: [trade("M1", 10, "SELL", 100, 40)] }), settings);
  const frame = engine.apply(snapshot({ at: 40, orderEvents: [move(1, 40, "BID", 99.75, 100, 40)] }), settings);
  assert.equal(frame.cycles.length, 0, "orders moved into a level are excluded by default");
  assert.equal(frame.candidates[0]?.cumulativeAttributedReplenishment, 0);
}

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  const frame = engine.apply(snapshot({ at: 20, levels: [level("BID", 100, 40), level("ASK", 100.25, 100)], trades: [trade("R1", 20, "SELL", 100, 60)], orderEvents: [remove(1, 20, "BID", 100, 60)] }), settings);
  assert.equal(frame.candidates[0]?.cumulativePulled, 0, "executed depth reduction must not also count as a pull");
}

{
  const engine = new IcebergRefreshDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings);
  engine.apply(snapshot({ at: 10, orderEvents: [add(1, 10, "BID", 100, 5)] }), settings);
  const frame = engine.apply(snapshot({ at: 20, orderEvents: [add(3, 20, "BID", 100, 5)] }), settings);
  assert.equal(frame.status, "CALIBRATING", "sequence gaps must trigger snapshot resynchronisation");
  assert(frame.alerts.some((alert) => alert.type === "SEQUENCE_GAP"));
}

{
  const engine = new IcebergRefreshDetectorEngine();
  const warm = normalizeIcebergRefreshSettings({ ...settings, postSnapshotWarmupMs: 1000 });
  engine.apply(snapshot({ at: 0 }), warm);
  const frame = engine.apply(snapshot({ at: 50, trades: [trade("W1", 50, "SELL", 100, 100)], orderEvents: [add(1, 55, "BID", 100, 100)] }), warm);
  assert.equal(frame.status, "CALIBRATING");
  assert.equal(frame.candidates.length, 0, "snapshot warmup cannot confirm inferred candidates");
}

console.log("iceberg refresh detector tests passed");
