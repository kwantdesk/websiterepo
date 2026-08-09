import assert from "node:assert/strict";
import test from "node:test";
import { buildFootprintBars, formatFootprintValue } from "../src/lib/footprint.ts";

const candles = [
  { timestamp: 1_000, open: 100, high: 101, low: 99.75, close: 100.75, volume: 50 },
  { timestamp: 61_000, open: 100.75, high: 101.5, low: 100.5, close: 101.25, volume: 40 },
];

const trade = (overrides) => ({
  recordIndex: 0,
  timestamp: 2_000,
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  trades: 1,
  volume: 1,
  bidVolume: 0,
  askVolume: 1,
  delta: 1,
  aggressor: "BUY",
  ...overrides,
});

const defaults = {
  tickSize: 0.25,
  groupTicks: 1,
  minimumTradeVolume: 0,
  maximumTradeVolume: 0,
  imbalanceMode: "diagonal",
  minimumImbalancePercent: 300,
  minimumDelta: 1,
  includeZero: false,
};

test("aggregates executed bid and ask volume into candle price rows", () => {
  const bars = buildFootprintBars(candles, [
    trade({ recordIndex: 0, close: 100, volume: 12, askVolume: 10, bidVolume: 2, trades: 3 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100, volume: 8, askVolume: 1, bidVolume: 7, trades: 2 }),
    trade({ recordIndex: 2, timestamp: 62_000, close: 101.25, volume: 9, askVolume: 9, bidVolume: 0 }),
  ], defaults);

  assert.equal(bars.length, 2);
  assert.equal(bars[0].rows.length, 1);
  assert.equal(bars[0].rows[0].price, 100);
  assert.equal(bars[0].rows[0].askVolume, 11);
  assert.equal(bars[0].rows[0].bidVolume, 9);
  assert.equal(bars[0].delta, 2);
  assert.equal(bars[1].rows[0].price, 101.25);
  assert.equal(bars[1].askVolume, 9);
});

test("marks diagonal ask and bid imbalances against the adjacent price", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 2, askVolume: 0, bidVolume: 2, aggressor: "SELL" }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 12, askVolume: 12, bidVolume: 0 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.5, volume: 8, askVolume: 0, bidVolume: 8, aggressor: "SELL" }),
    trade({ recordIndex: 3, timestamp: 5_000, close: 100.75, volume: 2, askVolume: 2, bidVolume: 0 }),
  ], defaults);

  const byPrice = new Map(bars[0].rows.map((row) => [row.price, row]));
  assert.equal(byPrice.get(100.25).askImbalance, true);
  assert.equal(byPrice.get(100.5).bidImbalance, true);
});

test("calculates per-bar volume POC and fixed 70 percent value area", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, close: 100, volume: 20, askVolume: 10, bidVolume: 10 }),
    trade({ recordIndex: 1, timestamp: 3_000, close: 100.25, volume: 50, askVolume: 30, bidVolume: 20 }),
    trade({ recordIndex: 2, timestamp: 4_000, close: 100.5, volume: 20, askVolume: 10, bidVolume: 10 }),
    trade({ recordIndex: 3, timestamp: 5_000, close: 100.75, volume: 10, askVolume: 5, bidVolume: 5 }),
  ], defaults);

  assert.equal(bars[0].pocPrice, 100.25);
  assert.equal(bars[0].val, 100.25);
  assert.equal(bars[0].vah, 100.5);
});

test("honours trade-size filtering without inventing footprint volume", () => {
  const bars = buildFootprintBars(candles.slice(0, 1), [
    trade({ recordIndex: 0, volume: 4, askVolume: 4 }),
    trade({ recordIndex: 1, timestamp: 3_000, volume: 10, askVolume: 10 }),
    trade({ recordIndex: 2, timestamp: 4_000, volume: 30, askVolume: 30 }),
  ], { ...defaults, minimumTradeVolume: 5, maximumTradeVolume: 20 });

  assert.equal(bars[0].volume, 10);
  assert.equal(bars[0].rows.length, 1);
});

test("formats large footprint cells compactly", () => {
  assert.equal(formatFootprintValue(12_450, "automatic"), "12.4K");
  assert.equal(formatFootprintValue(1_250, "normal"), "1,250");
});
