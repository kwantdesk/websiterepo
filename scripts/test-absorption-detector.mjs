import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AbsorptionDetectorEngine,
  DEFAULT_ABSORPTION_SETTINGS,
  calculateAbsorptionScore,
  mad,
  median,
  priceToTick,
  tickToPrice,
} from "../src/lib/absorptionDetector.ts";

const level = (side, price, size = 200, orders = 4) => ({
  side, price, size, orders, emaSize: size, peakSize: size,
  observations: 1, stableObservations: 1, persistenceMs: 500,
  addedSize: 0, removedSize: 0,
});

const T0 = 1_000_000;
const snapshot = ({
  timestamp,
  lastPrice = 20_000,
  trades = [],
  orderEvents = [],
  bookValid = true,
  individualOrders = true,
}) => ({
  asOf: new Date(timestamp).toISOString(),
  contractSymbol: "NQU6",
  tickSize: 0.25,
  fullDepth: true,
  bookValid,
  individualOrders,
  ageMs: 0,
  levels: [
    level("BID", 20_000, 250), level("BID", 19_999.75, 180),
    level("ASK", 20_000.25, 240), level("ASK", 20_000.5, 170),
  ],
  bestBid: 20_000,
  bestAsk: 20_000.25,
  lastPrice,
  trades,
  orderEvents,
});

const deterministicSettings = {
  ...DEFAULT_ABSORPTION_SETTINGS,
  dynamicBaselineEnabled: false,
  postSnapshotWarmupMs: 0,
  minimumContracts: 100,
  minimumTradeCount: 3,
  minimumDirectionalShare: 0.7,
  maximumPenetrationTicks: 2,
  minimumAggressionPerTick: 40,
  minimumDevelopingScore: 0,
  minimumConfirmedScore: 0,
  confirmationMode: "immediate",
  minimumDurationMs: 50,
  breakMode: "first-trade",
  breakToleranceTicks: 0,
  staleTradeAfterMs: 120_000,
};

assert.equal(priceToTick(20_000.25, 0.25), 80_001, "prices convert to exact integer ticks");
assert.equal(tickToPrice(80_001, 0.25), 20_000.25, "integer ticks convert back to price");
assert.equal(median([9, 1, 5]), 5);
assert.equal(mad([1, 2, 3, 100]), 1);

{
  const metrics = {
    aggressiveQuantity: 200, opposingQuantity: 0, directionalShare: 1,
    penetrationTicks: 1, aggressionPerTick: 100, contractsPerSecond: 500,
    tradesPerSecond: 10, tradeCount: 5, largestTrade: 80, durationMs: 400,
    startingDepth: 100, endingDepth: 80, replenishmentQuantity: 50,
    replenishmentRatio: 0.25, refreshCount: 2, depthRetention: 0.8,
    executedToVisible: 2, responseTicks: 2, repeatCount: 1,
  };
  const tradeOnly = calculateAbsorptionScore({
    metrics, settings: deterministicSettings, dynamicQuantityThreshold: 100,
    dynamicPerTickThreshold: 40, level3Available: false,
  });
  const level3 = calculateAbsorptionScore({
    metrics, settings: deterministicSettings, dynamicQuantityThreshold: 100,
    dynamicPerTickThreshold: 40, level3Available: true,
  });
  assert.ok(tradeOnly.score > 0 && tradeOnly.score <= 100, "trade-only scoring is renormalized rather than failing");
  assert.ok(level3.score > 0 && level3.score <= 100, "Level 3 scoring remains bounded");
}

{
  const engine = new AbsorptionDetectorEngine();
  const trades = [
    { id: 1, timestamp: T0, price: 20_000, size: 45, side: "SELL" },
    { id: 2, timestamp: T0 + 60, price: 20_000, size: 40, side: "SELL" },
    { id: 3, timestamp: T0 + 120, price: 19_999.75, size: 35, side: "SELL" },
  ];
  const orderEvents = [
    { sequence: 1, timestamp: T0 + 80, orderId: "R1", action: "ADD", side: "BID", price: 20_000, previousPrice: null, size: 30, previousSize: 0 },
    { sequence: 2, timestamp: T0 + 100, orderId: "R2", action: "ADD", side: "BID", price: 20_000, previousPrice: null, size: 30, previousSize: 0 },
  ];
  const frame = engine.apply(snapshot({ timestamp: T0 + 150, trades, orderEvents, lastPrice: 20_000.25 }), deterministicSettings);
  assert.equal(frame.events.length, 1, "three aggressive sells with limited progress confirm bid absorption");
  assert.equal(frame.events[0].side, "BID");
  assert.equal(frame.events[0].penetrationTicks, 1);
  assert.equal(frame.events[0].aggressiveQuantity, 120);
  assert.equal(frame.events[0].replenishmentQuantity, 60, "same-price bid replenishment is measured from order lifecycle events");
  assert.equal(frame.events[0].suspectedHiddenLiquidity, true, "repeated replenishment is labelled only as suspected hidden-liquidity context");
  assert.equal(frame.zones.length, 1);

  const duplicate = engine.apply(snapshot({ timestamp: T0 + 160, trades, orderEvents, lastPrice: 20_000.25 }), deterministicSettings);
  assert.equal(duplicate.events.length, 1, "replayed snapshots are idempotent");
  assert.equal(duplicate.events[0].aggressiveQuantity, 120);

  const broken = engine.apply(snapshot({
    timestamp: T0 + 300,
    lastPrice: 19_999.5,
    trades: [...trades, { id: 4, timestamp: T0 + 300, price: 19_999.5, size: 10, side: "SELL" }],
    orderEvents,
  }), deterministicSettings);
  assert.equal(broken.zones[0].state, "BROKEN", "a bid zone breaks only after price and the configured trade gate move through it");
}

{
  const engine = new AbsorptionDetectorEngine();
  const frame = engine.apply(snapshot({
    timestamp: T0 + 200,
    lastPrice: 20_000,
    trades: [
      { id: 11, timestamp: T0, price: 20_000.25, size: 40, side: "BUY" },
      { id: 12, timestamp: T0 + 60, price: 20_000.25, size: 35, side: "BUY" },
      { id: 13, timestamp: T0 + 120, price: 20_000.5, size: 35, side: "BUY" },
    ],
  }), deterministicSettings);
  assert.equal(frame.events[0]?.side, "ASK", "aggressive buys with limited upward progress confirm ask absorption");
}

{
  const engine = new AbsorptionDetectorEngine();
  const responseSettings = { ...deterministicSettings, confirmationMode: "price-response", minimumResponseTicks: 2 };
  const frame = engine.apply(snapshot({
    timestamp: T0 + 180,
    lastPrice: 20_000.5,
    trades: [
      { id: 31, timestamp: T0, price: 20_000, size: 40, side: "SELL" },
      { id: 32, timestamp: T0 + 60, price: 20_000, size: 35, side: "SELL" },
      { id: 33, timestamp: T0 + 120, price: 19_999.75, size: 35, side: "SELL" },
    ],
  }), responseSettings);
  assert.equal(frame.events.length, 1, "price-response confirmation requires a favourable move after limited penetration");
}

{
  const engine = new AbsorptionDetectorEngine();
  const frame = engine.apply(snapshot({
    timestamp: T0 + 180,
    lastPrice: 19_999.25,
    trades: [
      { id: 41, timestamp: T0, price: 20_000, size: 40, side: "SELL" },
      { id: 42, timestamp: T0 + 60, price: 19_999.75, size: 35, side: "SELL" },
      { id: 43, timestamp: T0 + 120, price: 19_999.25, size: 35, side: "SELL" },
    ],
  }), deterministicSettings);
  assert.equal(frame.events.length, 0, "excess penetration rejects a false bid-absorption candidate");
}

{
  const engine = new AbsorptionDetectorEngine();
  const firstTrades = [
    { id: 51, timestamp: T0, price: 20_000, size: 40, side: "SELL" },
    { id: 52, timestamp: T0 + 50, price: 20_000, size: 35, side: "SELL" },
    { id: 53, timestamp: T0 + 100, price: 19_999.75, size: 35, side: "SELL" },
  ];
  engine.apply(snapshot({ timestamp: T0 + 110, trades: firstTrades, lastPrice: 20_000.25 }), deterministicSettings);
  const secondTrades = [
    ...firstTrades,
    { id: 54, timestamp: T0 + 300, price: 20_000, size: 40, side: "SELL" },
    { id: 55, timestamp: T0 + 350, price: 20_000, size: 35, side: "SELL" },
    { id: 56, timestamp: T0 + 400, price: 19_999.75, size: 35, side: "SELL" },
  ];
  const merged = engine.apply(snapshot({ timestamp: T0 + 410, trades: secondTrades, lastPrice: 20_000.25 }), deterministicSettings);
  assert.equal(merged.events.length, 2);
  assert.equal(merged.zones.length, 1, "nearby repeated events merge into one multi-price absorption zone");
  assert.ok(merged.zones[0].repeatCount >= 1);

  engine.apply(snapshot({ timestamp: T0 + 500, trades: secondTrades, lastPrice: 20_001 }), deterministicSettings);
  const retest = engine.apply(snapshot({ timestamp: T0 + 600, trades: secondTrades, lastPrice: 20_000 }), deterministicSettings);
  assert.equal(retest.zones[0].state, "RETESTING", "a departed zone transitions into a retest on a valid return");
  assert.equal(retest.zones[0].retestCount, 1);
}

{
  const engine = new AbsorptionDetectorEngine();
  const frame = engine.apply(snapshot({
    timestamp: T0 + 200,
    bookValid: false,
    individualOrders: false,
    trades: [
      { id: 21, timestamp: T0, price: 20_000, size: 40, side: "SELL" },
      { id: 22, timestamp: T0 + 60, price: 20_000, size: 35, side: "SELL" },
      { id: 23, timestamp: T0 + 120, price: 20_000, size: 35, side: "SELL" },
    ],
  }), deterministicSettings);
  assert.equal(frame.feedMode, "TRADE-ONLY");
  assert.equal(frame.events[0]?.suspectedHiddenLiquidity, false, "trade-only mode never invents hidden-liquidity evidence");
  assert.ok(frame.limitations.some((line) => line.includes("Level 3 context is unavailable")));
}

{
  const engine = new AbsorptionDetectorEngine();
  const frame = engine.apply(snapshot({
    timestamp: T0 + 100,
    orderEvents: [
      { sequence: 1, timestamp: T0, orderId: "A", action: "ADD", side: "BID", price: 20_000, previousPrice: null, size: 10, previousSize: 0 },
      { sequence: 3, timestamp: T0 + 100, orderId: "B", action: "ADD", side: "ASK", price: 20_000.25, previousPrice: null, size: 10, previousSize: 0 },
    ],
  }), deterministicSettings);
  assert.equal(frame.sequenceGap, true);
  assert.equal(frame.status, "LEVEL 3 CONTEXT STALE — RESYNCING", "sequence gaps are visible and suppress trusted Level 3 context");
}

const catalogue = fs.readFileSync(new URL("../src/lib/chartIndicatorCatalog.ts", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const stream = fs.readFileSync(new URL("../src/lib/rithmicLiquidityStream.ts", import.meta.url), "utf8");
assert.match(catalogue, /indicator\("Absorption Detector",\s*"Order Flow"/);
assert.match(workspace, /indicatorId:\s*"absorption-detector"/);
assert.match(chart, /subscribeRithmicLiquidity/);
assert.match(chart, /new AbsorptionDetectorPrimitive/);
assert.match(stream, /const streams = new Map<string, SharedPoll>/);
assert.match(stream, /subscribers:\s*new Set\(\)/, "shared stream multiplexes chart consumers through one connection");

console.log("Absorption Detector deterministic engine and integration tests passed.");
