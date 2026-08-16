import assert from "node:assert/strict";
import { DEFAULT_PULLING_STACKING_SETTINGS, PullingStackingEngine } from "../src/lib/pullingStacking.ts";

const T0 = 1_000_000;
const tracked = (side, price, size, orders = 1) => ({ side, price, size, orders, largestOrder: size, emaSize: size, peakSize: size, observations: 1, stableObservations: 1, persistenceMs: 0, addedSize: 0, removedSize: 0 });
const snapshot = ({ timestamp, bid = 100, ask = 100, levels, trades = [], orderEvents = [], individualOrders = false, bookValid = true, symbol = "NQU6", ageMs = 0 }) => ({
  asOf: new Date(timestamp).toISOString(), contractSymbol: symbol, tickSize: 0.25, fullDepth: true, bookValid, individualOrders, ageMs,
  levels: levels ?? [tracked("BID", 20000, bid), tracked("ASK", 20000.25, ask)], bestBid: 20000, bestAsk: 20000.25, lastPrice: 20000.25, trades, orderEvents,
});
const lifecycle = (overrides = {}) => ({ sequence: 1, timestamp: T0 + 100, orderId: "A", action: "ADD", side: "BID", price: 20000, previousPrice: null, size: 10, previousSize: 0, ...overrides });
const settings = { ...DEFAULT_PULLING_STACKING_SETTINGS, aggregationMs: 1_000, postSnapshotWarmupMs: 0, baselineWarmupMs: 0, minimumBaselineSamples: 1, minimumContracts: 1, relativeThreshold: 1, scoreThreshold: 0, markerMinimumScore: 0 };

// Snapshots establish a baseline and never synthesize activity.
{
  const engine = new PullingStackingEngine();
  const frame = engine.apply(snapshot({ timestamp: T0, bid: 250, ask: 300 }), settings);
  assert.equal(frame.totals.churn, 0); assert.equal(frame.buckets.length, 0); assert.equal(frame.rows.find((row) => row.price === 20000)?.bidSize, 250);
}

// Price-level side classification and documented metrics.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0 }), settings);
  const frame = engine.apply(snapshot({ timestamp: T0 + 100, bid: 140, ask: 90 }), settings);
  assert.equal(frame.totals.bidStack, 40); assert.equal(frame.totals.askPull, 10);
  assert.equal(frame.totals.netBidDisplayedChange, 40); assert.equal(frame.totals.netAskDisplayedChange, -10);
  assert.equal(frame.totals.bullishPressure, 50); assert.equal(frame.totals.bearishPressure, 0); assert.equal(frame.totals.pressure, 50);
  assert.equal(frame.totals.churn, 50); assert.equal(frame.totals.pullRatio, 0.2);
}

// Same-price MBO increases/decreases and bid/ask cancellations.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0, individualOrders: true }), settings);
  let frame = engine.apply(snapshot({ timestamp: T0 + 100, bid: 140, individualOrders: true, orderEvents: [lifecycle({ action: "MODIFY", size: 140, previousSize: 100 })] }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.totals.bidStack, 40);
  frame = engine.apply(snapshot({ timestamp: T0 + 200, bid: 80, ask: 70, individualOrders: true, orderEvents: [
    lifecycle({ sequence: 2, timestamp: T0 + 200, action: "MODIFY", size: 80, previousSize: 140 }),
    lifecycle({ sequence: 3, timestamp: T0 + 200, orderId: "B", action: "MODIFY", side: "ASK", price: 20000.25, previousPrice: 20000.25, size: 70, previousSize: 100 }),
  ] }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.totals.bidPull, 60); assert.equal(frame.totals.askPull, 30);
}

// Aggressive executions remain separate; residual depth reduction alone is a pull.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0 }), settings);
  let frame = engine.apply(snapshot({ timestamp: T0 + 100, bid: 50, trades: [{ id: 1, timestamp: T0 + 100, price: 20000, size: 30, side: "SELL" }] }), settings);
  assert.equal(frame.totals.bidExecution, 30); assert.equal(frame.totals.bidPull, 20);
  frame = engine.apply(snapshot({ timestamp: T0 + 200, bid: 0, trades: [{ id: 2, timestamp: T0 + 200, price: 20000, size: 50, side: "SELL" }] }), settings);
  assert.equal(frame.totals.bidExecution, 80); assert.equal(frame.totals.bidPull, 20);
}

// Partial execution plus MBO reduction reconciles to the non-executed remainder.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0, individualOrders: true }), settings);
  const frame = engine.apply(snapshot({ timestamp: T0 + 100, bid: 50, individualOrders: true, trades: [{ id: 3, timestamp: T0 + 100, price: 20000, size: 30, side: "SELL" }], orderEvents: [lifecycle({ action: "MODIFY", size: 50, previousSize: 100 })] }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.totals.bidExecution, 30); assert.equal(frame.totals.bidPull, 20);
}

// Price-changing modifies obey every explicit policy.
for (const [moveHandling, expectedPull, expectedStack] of [["separate-move", 0, 0], ["pull-and-stack", 50, 50], ["ignore-correlated-move", 0, 0]]) {
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0, individualOrders: true }), settings);
  const frame = engine.apply(snapshot({ timestamp: T0 + 100, bid: 50, individualOrders: true, orderEvents: [lifecycle({ action: "MODIFY", previousPrice: 20000, price: 20000.25, size: 50, previousSize: 50 })] }), { ...settings, classificationMode: "individual-order", moveHandling });
  assert.equal(frame.totals.bidPull, expectedPull); assert.equal(frame.totals.bidStack, expectedStack);
  assert.equal(frame.totals.bidMovedOut, 50); assert.equal(frame.totals.bidMovedIn, 50);
}

// Repeated snapshot/trade data is idempotent.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0 }), settings);
  const changed = snapshot({ timestamp: T0 + 100, bid: 125, trades: [{ id: 9, timestamp: T0 + 100, price: 20000.25, size: 5, side: "BUY" }] });
  const first = engine.apply(changed, settings); const duplicate = engine.apply(changed, settings);
  assert.equal(first.totals.bidStack, 25); assert.equal(duplicate.totals.bidStack, 25); assert.equal(first.totals.askExecution, 5); assert.equal(duplicate.totals.askExecution, 5);
}

// Invalid books and sequence gaps suppress classification until a fresh baseline.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0, individualOrders: true }), settings);
  let frame = engine.apply(snapshot({ timestamp: T0 + 100, individualOrders: true, orderEvents: [lifecycle({ sequence: 1 }), lifecycle({ sequence: 3, orderId: "B", side: "ASK", price: 20000.25 })] }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.sequenceGap, true); assert.equal(frame.stale, true); assert.equal(frame.totals.churn, 0);
  frame = engine.apply(snapshot({ timestamp: T0 + 200, bid: 500, ask: 500, individualOrders: true }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.sequenceGap, false); assert.equal(frame.totals.churn, 0);
  frame = engine.apply(snapshot({ timestamp: T0 + 300, bookValid: false }), settings); assert.equal(frame.status, "SNAPSHOT"); assert.equal(frame.totals.churn, 0);
  frame = engine.apply(snapshot({ timestamp: T0 + 400, bid: 20, ask: 20 }), settings); assert.equal(frame.totals.churn, 0);
}

// Instrument changes reset retained state.
{
  const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0 }), settings); engine.apply(snapshot({ timestamp: T0 + 100, bid: 150 }), settings);
  const frame = engine.apply(snapshot({ timestamp: T0 + 200, symbol: "ESU6", bid: 10, ask: 10 }), settings);
  assert.equal(frame.contractSymbol, "ESU6"); assert.equal(frame.totals.churn, 0); assert.equal(frame.buckets.length, 0);
}

// Wall, vacuum and pull/repost fixtures are deterministic under replay.
{
  const s = { ...settings, wallMinimumContracts: 20, wallMinimumLevels: 1, wallMinimumScore: 0, wallPersistenceMs: 0, wallBuildWindowMs: 2000, vacuumMinimumLevels: 2, vacuumMinimumContracts: 20, vacuumMinimumDepthRemovalRatio: 0.1, vacuumMinimumScore: 0, vacuumWindowMs: 2000, pullRepostEnabled: true, repostMinimumQuantity: 10, repostMinimumScore: 0, repostWindowMs: 5000 };
  const levels0 = [tracked("BID", 20000, 100), tracked("BID", 19999.75, 100), tracked("ASK", 20000.25, 100)];
  const levelsUp = [tracked("BID", 20000, 150), tracked("BID", 19999.75, 150), tracked("ASK", 20000.25, 100)];
  const levelsDown = [tracked("BID", 20000, 50), tracked("BID", 19999.75, 50), tracked("ASK", 20000.25, 100)];
  const run = () => { const engine = new PullingStackingEngine(); engine.apply(snapshot({ timestamp: T0, levels: levels0 }), s); engine.apply(snapshot({ timestamp: T0 + 100, levels: levelsUp }), s); engine.apply(snapshot({ timestamp: T0 + 1100, levels: levelsUp }), s); engine.apply(snapshot({ timestamp: T0 + 1200, levels: levelsDown }), s); engine.apply(snapshot({ timestamp: T0 + 2100, levels: levelsDown }), s); engine.apply(snapshot({ timestamp: T0 + 2200, levels: levelsUp }), s); return engine.apply(snapshot({ timestamp: T0 + 3100, levels: levelsUp }), s); };
  const a = run(); const b = run(); assert.ok(a.buckets.length >= 3);
  assert.ok(a.events.some((event) => event.kind.endsWith("WALL_BUILD"))); assert.ok(a.events.some((event) => event.kind.includes("LIQUIDITY_VACUUM"))); assert.ok(a.events.some((event) => event.kind === "PULL_REPOST"));
  assert.deepEqual(a.buckets, b.buckets); assert.deepEqual(a.events, b.events);
}

console.log("Pulling & Stacking deterministic classification, recovery, structure and replay tests passed.");
