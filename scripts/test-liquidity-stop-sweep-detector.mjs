import assert from "node:assert/strict";
import {
  LiquidityStopSweepDetectorEngine,
  calculateDepthConsumption,
  normalizeLiquidityStopSweepSettings,
} from "../src/lib/liquidityStopSweepDetector.ts";

const baseTime = Date.parse("2026-08-16T00:00:00.000Z");
const settings = normalizeLiquidityStopSweepSettings({
  dynamicBaselineEnabled: false,
  maximumInterTradeGapMs: 75,
  maximumSweepDurationMs: 1_000,
  maximumBacktrackTicks: 1,
  maximumInterTradeJumpTicks: 4,
  minimumSweepContracts: 30,
  minimumSweepTradeCount: 3,
  minimumSweptLevels: 3,
  minimumSweepRangeTicks: 2,
  minimumContractsPerSecond: 1,
  minimumContiguousCoverageRatio: 0.75,
  minimumDirectionalProgressRatio: 0.6,
  minimumStopSweepContracts: 30,
  minimumStopSweepLevels: 3,
  minimumStopSweepVelocity: 1,
  minimumStopSweepScore: 0,
  minimumReferenceBreachTicks: 1,
  maximumReferenceDistanceTicks: 20,
});

const level = (side, price, size) => ({ side, price, size, orderCount: 1 });
const trade = (id, at, side, price, size) => ({ id, timestamp: baseTime + at, side, price, size });
const snapshot = ({ at, trades = [], levels = [level("BID", 99.75, 100), level("ASK", 100, 100)], lastPrice = 100, orderEvents = [] }) => ({
  asOf: new Date(baseTime + at).toISOString(),
  contractSymbol: "NQU6",
  tickSize: 0.25,
  fullDepth: true,
  bookValid: true,
  individualOrders: true,
  ageMs: 0,
  levels,
  bestBid: 99.75,
  bestAsk: 100,
  lastPrice,
  trades,
  orderEvents,
});

const highReference = [{
  id: "prior-high",
  type: "prior-session-high",
  label: "Prior Session High",
  priceTick: 401,
  validFromMs: baseTime - 1_000,
  side: "high",
  priority: 100,
  isUserLevel: false,
}];

function buySweep() {
  const engine = new LiquidityStopSweepDetectorEngine();
  engine.apply(snapshot({ at: 0 }), settings, highReference);
  engine.apply(snapshot({ at: 10, trades: [trade(1, 10, "BUY", 100, 10)] }), settings, highReference);
  engine.apply(snapshot({ at: 30, trades: [trade(2, 30, "BUY", 100.25, 12)] }), settings, highReference);
  engine.apply(snapshot({ at: 50, trades: [trade(3, 50, "BUY", 100.5, 15)] }), settings, highReference);
  return engine.apply(snapshot({ at: 140, lastPrice: 100.5 }), settings, highReference);
}

{
  const frame = buySweep();
  assert.equal(frame.events.length, 1);
  const event = frame.events[0];
  assert.equal(event.direction, "buy");
  assert.equal(event.uniqueLevelCount, 3);
  assert.equal(event.rangeTicks, 2);
  assert.equal(event.totalQuantity, 37);
  assert.equal(event.primaryReference?.id, "prior-high");
  assert.equal(event.state, "possible-stop-sweep");
  assert.equal(event.evidenceLevel, "possible-stop-sweep");
}

{
  const engine = new LiquidityStopSweepDetectorEngine();
  const lowReference = [{ ...highReference[0], id: "prior-low", type: "prior-session-low", label: "Prior Session Low", priceTick: 399, side: "low" }];
  engine.apply(snapshot({ at: 10, trades: [trade(10, 10, "SELL", 100, 10)] }), settings, lowReference);
  engine.apply(snapshot({ at: 30, trades: [trade(11, 30, "SELL", 99.75, 12)] }), settings, lowReference);
  engine.apply(snapshot({ at: 50, trades: [trade(12, 50, "SELL", 99.5, 15)] }), settings, lowReference);
  const frame = engine.apply(snapshot({ at: 140, lastPrice: 99.5 }), settings, lowReference);
  assert.equal(frame.events[0]?.direction, "sell");
  assert.equal(frame.events[0]?.primaryReference?.id, "prior-low");
}

{
  const engine = new LiquidityStopSweepDetectorEngine();
  engine.apply(snapshot({ at: 10, trades: [trade(20, 10, "BUY", 100, 20)] }), settings);
  engine.apply(snapshot({ at: 200, trades: [trade(21, 200, "BUY", 100.25, 20)] }), settings);
  const frame = engine.apply(snapshot({ at: 300 }), settings);
  assert.equal(frame.events.length, 0, "trades outside the sequence gap cannot be merged into a sweep");
}

{
  const engine = new LiquidityStopSweepDetectorEngine();
  const noBacktrack = normalizeLiquidityStopSweepSettings({ ...settings, maximumBacktrackTicks: 0 });
  engine.apply(snapshot({ at: 10, trades: [trade(30, 10, "BUY", 100, 15)] }), noBacktrack);
  engine.apply(snapshot({ at: 30, trades: [trade(31, 30, "BUY", 100.25, 15)] }), noBacktrack);
  engine.apply(snapshot({ at: 50, trades: [trade(32, 50, "BUY", 100, 15)] }), noBacktrack);
  const frame = engine.apply(snapshot({ at: 150 }), noBacktrack);
  assert.equal(frame.events.length, 0, "a disallowed backtrack must split the candidate");
}

{
  const first = buySweep();
  const second = buySweep();
  assert.deepEqual(
    first.events.map(({ id, state, score, totalQuantity }) => ({ id, state, score, totalQuantity })),
    second.events.map(({ id, state, score, totalQuantity }) => ({ id, state, score, totalQuantity })),
    "replay output must be deterministic",
  );
}

{
  const engine = new LiquidityStopSweepDetectorEngine();
  const sameTrade = trade(40, 10, "BUY", 100, 50);
  engine.apply(snapshot({ at: 10, trades: [sameTrade] }), settings);
  const frame = engine.apply(snapshot({ at: 100, trades: [sameTrade] }), settings);
  assert.equal(frame.events.length, 0, "duplicate trade IDs must not inflate a candidate");
}

assert.deepEqual(calculateDepthConsumption(100, 75, 150), {
  depthConsumptionRatio: 0.75,
  executionToVisibleRatio: 1.5,
});

console.log("liquidity stop sweep detector tests passed");
