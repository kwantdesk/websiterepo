import assert from "node:assert/strict";
import {
  DEFAULT_PULLING_STACKING_SETTINGS,
  PullingStackingEngine,
} from "../src/lib/pullingStacking.ts";

const tracked = (side, price, size, orders = 1) => ({
  side, price, size, orders, emaSize: size, peakSize: size,
  observations: 1, stableObservations: 1, persistenceMs: 0,
  addedSize: 0, removedSize: 0,
});

const snapshot = ({
  timestamp,
  bid = 100,
  ask = 100,
  trades = [],
  orderEvents = [],
  individualOrders = false,
  bookValid = true,
}) => ({
  asOf: new Date(timestamp).toISOString(),
  contractSymbol: "NQU6",
  tickSize: 0.25,
  fullDepth: true,
  bookValid,
  individualOrders,
  ageMs: 0,
  levels: [tracked("BID", 20000, bid), tracked("ASK", 20000.25, ask)],
  bestBid: 20000,
  bestAsk: 20000.25,
  lastPrice: 20000.25,
  trades,
  orderEvents,
});

const settings = {
  ...DEFAULT_PULLING_STACKING_SETTINGS,
  aggregationMs: 1_000,
  minimumContracts: 1,
  scoreThreshold: 0,
  warmupBuckets: 0,
};
const T0 = 1_000_000;

{
  const engine = new PullingStackingEngine();
  engine.apply(snapshot({ timestamp: T0, bid: 100, ask: 100 }), settings);
  const live = engine.apply(snapshot({ timestamp: T0 + 100, bid: 140, ask: 100 }), settings);
  const row = live.rows.find((candidate) => candidate.price === 20000);
  assert.equal(row?.bidStack, 40, "bid depth additions classify as bid stacking");
  assert.equal(row?.pressure, 40, "bid stacking creates positive pressure");
  const committed = engine.apply(snapshot({ timestamp: T0 + 1_100, bid: 140, ask: 100 }), settings);
  assert.equal(committed.buckets.at(-1)?.rows.find((candidate) => candidate.price === 20000)?.bidStack, 40);
}

{
  const engine = new PullingStackingEngine();
  engine.apply(snapshot({ timestamp: T0, bid: 100 }), settings);
  const frame = engine.apply(snapshot({
    timestamp: T0 + 100,
    bid: 50,
    trades: [{ id: 1, timestamp: 100, price: 20000, size: 30, side: "SELL" }],
  }), settings);
  const row = frame.rows.find((candidate) => candidate.price === 20000);
  assert.equal(row?.bidPull, 20, "aggressive executions are removed before a depth reduction is called a pull");
}

{
  const eventBase = {
    sequence: 1, timestamp: 100, orderId: "A", action: "MODIFY",
    side: "BID", price: 20000.25, previousPrice: 20000,
    size: 50, previousSize: 50,
  };
  const separate = new PullingStackingEngine();
  separate.apply(snapshot({ timestamp: T0, bid: 100, individualOrders: true }), settings);
  const separateFrame = separate.apply(snapshot({
    timestamp: T0 + 100, bid: 50, individualOrders: true, orderEvents: [{ ...eventBase, timestamp: T0 + 100 }],
  }), { ...settings, classificationMode: "individual-order", moveHandling: "separate-move" });
  assert.equal(separateFrame.totals.churn, 0, "separate order moves do not masquerade as independent pull/stack activity");

  const folded = new PullingStackingEngine();
  folded.apply(snapshot({ timestamp: T0, bid: 100, individualOrders: true }), settings);
  const foldedFrame = folded.apply(snapshot({
    timestamp: T0 + 100, bid: 50, individualOrders: true, orderEvents: [{ ...eventBase, timestamp: T0 + 100 }],
  }), { ...settings, classificationMode: "individual-order", moveHandling: "pull-and-stack" });
  assert.equal(foldedFrame.totals.bidPull, 50);
  assert.equal(foldedFrame.totals.bidStack, 50);
}

{
  const engine = new PullingStackingEngine();
  engine.apply(snapshot({ timestamp: T0, bid: 100 }), settings);
  const changed = snapshot({ timestamp: T0 + 100, bid: 125 });
  const first = engine.apply(changed, settings);
  const duplicate = engine.apply(changed, settings);
  assert.equal(first.totals.bidStack, 25);
  assert.equal(duplicate.totals.bidStack, 25, "repeated snapshots are idempotent");
  assert.equal(duplicate.rows.find((row) => row.price === 20000)?.bidSize, 125, "indicator live depth remains identical to the shared DOM snapshot");
}

{
  const engine = new PullingStackingEngine();
  engine.apply(snapshot({ timestamp: T0, individualOrders: true }), settings);
  const frame = engine.apply(snapshot({
    timestamp: T0 + 100,
    individualOrders: true,
    orderEvents: [
      { sequence: 1, timestamp: T0 + 90, orderId: "A", action: "ADD", side: "BID", price: 20000, previousPrice: null, size: 10, previousSize: 0 },
      { sequence: 3, timestamp: T0 + 100, orderId: "B", action: "ADD", side: "ASK", price: 20000.25, previousPrice: null, size: 10, previousSize: 0 },
    ],
  }), { ...settings, classificationMode: "individual-order" });
  assert.equal(frame.sequenceGap, true, "sequence gaps surface a resynchronising state instead of silently corrupting metrics");
}

console.log("Pulling & Stacking deterministic classification tests passed.");
