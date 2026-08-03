import assert from "node:assert/strict";
import test from "node:test";

import { RithmicBookStore } from "../src/book-store.mjs";

test("normalizes trades and aggregated depth without fabricating levels", () => {
  const store = new RithmicBookStore({ maxTrades: 10 });
  store.applyOrderBook({
    exchange: "CME",
    symbol: "MNQU6",
    updateType: 7,
    bidPrice: [28100, 28099.75],
    bidSize: [12, 8],
    bidOrders: [3, 2],
    askPrice: [28100.25, 28100.5],
    askSize: [9, 15],
    askOrders: [2, 4],
    ssboe: 1_700_000_000,
    usecs: 500_000,
  });
  store.applyTrade({
    exchange: "CME",
    symbol: "MNQU6",
    tradePrice: 28100.25,
    tradeSize: 4,
    aggressor: 1,
    ssboe: 1_700_000_000,
    usecs: 600_000,
  });
  const snapshot = store.snapshot("CME", "MNQU6", 10);
  assert.equal(snapshot.depthMode, "L2");
  assert.equal(snapshot.bookValid, true);
  assert.deepEqual(snapshot.bids[0], { price: 28100, size: 12, orders: 3 });
  assert.deepEqual(snapshot.asks[0], { price: 28100.25, size: 9, orders: 2 });
  assert.equal(snapshot.trades[0].aggressor, "BUY");
  assert.equal(snapshot.lastPrice, 28100.25);
});

test("rebuilds L3 price levels from per-order updates", () => {
  const store = new RithmicBookStore();
  store.applyDepthUpdate({
    exchange: "CME",
    symbol: "ESU6",
    sequenceNumber: "100",
    updateType: [1, 1],
    transactionType: [1, 1],
    depthPrice: [6400, 6400],
    depthSize: [3, 7],
    depthOrderPriority: ["1", "2"],
    exchangeOrderId: ["A", "B"],
  });
  let snapshot = store.snapshot("CME", "ESU6", 10);
  assert.equal(snapshot.depthMode, "L3");
  assert.deepEqual(snapshot.bids[0], { price: 6400, size: 10, orders: 2 });
  store.applyDepthUpdate({
    exchange: "CME",
    symbol: "ESU6",
    sequenceNumber: "101",
    updateType: [3],
    transactionType: [1],
    depthPrice: [6400],
    depthSize: [0],
    exchangeOrderId: ["A"],
  });
  snapshot = store.snapshot("CME", "ESU6", 10);
  assert.deepEqual(snapshot.bids[0], { price: 6400, size: 7, orders: 1 });
  assert.equal(snapshot.orderCount, 1);
});

test("does not downgrade an active L3 book when aggregated L2 updates arrive", () => {
  const store = new RithmicBookStore();
  store.applyDepthUpdate({
    exchange: "CME",
    symbol: "MNQU6",
    sequenceNumber: "100",
    updateType: [1],
    transactionType: [1],
    depthPrice: [29000],
    depthSize: [5],
    exchangeOrderId: ["L3-A"],
  });
  store.applyOrderBook({
    exchange: "CME",
    symbol: "MNQU6",
    updateType: 7,
    bidPrice: [28999.75],
    bidSize: [99],
    bidOrders: [10],
  });
  const snapshot = store.snapshot("CME", "MNQU6", 10);
  assert.equal(snapshot.depthMode, "L3");
  assert.equal(snapshot.fullDepth, true);
  assert.deepEqual(snapshot.bids[0], { price: 29000, size: 5, orders: 1 });
});

test("accepts forward sequence jumps because Rithmic sequences can be exchange-wide", () => {
  const store = new RithmicBookStore();
  store.applyDepthUpdate({
    exchange: "CME",
    symbol: "NQU6",
    sequenceNumber: "20",
    updateType: [1],
    transactionType: [1],
    depthPrice: [28100],
    depthSize: [2],
    exchangeOrderId: ["A"],
  });
  const event = store.applyDepthUpdate({
    exchange: "CME",
    symbol: "NQU6",
    sequenceNumber: "22",
    updateType: [2],
    transactionType: [1],
    depthPrice: [28100],
    depthSize: [3],
    exchangeOrderId: ["A"],
  });
  const snapshot = store.snapshot("CME", "NQU6", 10);
  assert.equal(event.sequenceRegression, false);
  assert.equal(snapshot.bookValid, true);
});

test("marks a depth book invalid when source sequence moves backwards", () => {
  const store = new RithmicBookStore();
  store.applyDepthUpdate({
    exchange: "CME",
    symbol: "NQU6",
    sequenceNumber: "22",
    updateType: [1],
    transactionType: [1],
    depthPrice: [28100],
    depthSize: [2],
    exchangeOrderId: ["A"],
  });
  const event = store.applyDepthUpdate({
    exchange: "CME",
    symbol: "NQU6",
    sequenceNumber: "21",
    updateType: [2],
    transactionType: [1],
    depthPrice: [28100],
    depthSize: [3],
    exchangeOrderId: ["A"],
  });
  assert.equal(event.sequenceRegression, true);
  assert.equal(event.previousSequence, "22");
  assert.equal(event.receivedSequence, "21");
  assert.equal(store.snapshot("CME", "NQU6", 10).bookValid, false);
});

test("ingests the RTrader Pro full ladder without pretending it contains order ids", () => {
  const store = new RithmicBookStore({ maxTrades: 10 });
  store.applyAggregatedSnapshot({
    exchange: "CME",
    symbol: "NQU6",
    timestampMs: 1_700_000_000_000,
    sequence: 1,
    bids: [
      { price: 28_100, size: 12, orders: 3 },
      { price: 28_099.75, size: 8, orders: 2 },
    ],
    asks: [{ price: 28_100.25, size: 9, orders: 2 }],
    tradeVolumes: [{ price: 28_100, volume: 40 }],
  });
  const snapshot = store.snapshot("CME", "NQU6", 10);
  assert.equal(snapshot.depthMode, "MBO_AGGREGATED");
  assert.equal(snapshot.fullDepth, true);
  assert.equal(snapshot.individualOrders, false);
  assert.equal(snapshot.orderCount, 0);
  assert.equal(snapshot.trades.length, 0, "initial cumulative volume must only seed state");
  assert.equal(snapshot.lastPrice, 28_100.125);
});

test("turns positive RTrader cumulative-volume changes into new trade deltas", () => {
  const store = new RithmicBookStore({ maxTrades: 10 });
  const base = {
    exchange: "CME",
    symbol: "NQU6",
    bids: [{ price: 28_100, size: 12, orders: 3 }],
    asks: [{ price: 28_100.25, size: 9, orders: 2 }],
  };
  store.applyAggregatedSnapshot({
    ...base,
    timestampMs: 1_700_000_000_000,
    sequence: 1,
    tradeVolumes: [
      { price: 28_100, volume: 40 },
      { price: 28_100.25, volume: 22 },
    ],
  });
  const event = store.applyAggregatedSnapshot({
    ...base,
    timestampMs: 1_700_000_000_250,
    sequence: 2,
    tradeVolumes: [
      { price: 28_100, volume: 43 },
      { price: 28_100.25, volume: 27 },
    ],
  });
  assert.equal(event.inferredTrades.length, 2);
  assert.deepEqual(
    event.inferredTrades.map((trade) => [trade.price, trade.size, trade.aggressor]),
    [
      [28_100, 3, "SELL"],
      [28_100.25, 5, "BUY"],
    ],
  );
  assert.equal(store.snapshot("CME", "NQU6", 10).lastPrice, 28_100.25);
});

test("keeps lightweight snapshots bounded while exposing the complete retained indicator tape", () => {
  const store = new RithmicBookStore({ maxTrades: 5_000 });
  for (let index = 0; index < 3_000; index += 1) {
    store.applyTrade({
      exchange: "CME",
      symbol: "NQU6",
      sourceTradeId: `trade-${index}`,
      tradePrice: 28_000 + index * 0.25,
      tradeSize: 1 + index % 20,
      aggressor: index % 2 ? 1 : 2,
      ssboe: 1_700_000_000 + index,
      usecs: 0,
    });
  }

  assert.equal(store.snapshot("CME", "NQU6", 1).trades.length, 2_500);
  assert.equal(store.trades("CME", "NQU6").length, 3_000);
  assert.equal(
    store.trades("CME", "NQU6", {
      fromMs: 1_700_002_500_000,
      toMs: 1_700_002_999_000,
    }).length,
    500,
  );
});
