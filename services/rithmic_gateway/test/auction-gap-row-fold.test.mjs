import test from "node:test";
import assert from "node:assert/strict";

import { foldAuctionGapTimeRows } from "../src/auction-gap-row-fold.mjs";

const bars = [
  { timestamp: 1_000, endTime: 2_000, open: 100, high: 100.5, low: 100, close: 100.25, volume: 6 },
  { timestamp: 2_000, endTime: 3_000, open: 100.5, high: 100.5, low: 100.25, close: 100.25, volume: 9 },
];
const trades = [
  { timestamp: 1_000, price: 100, size: 1, side: 1 },
  { timestamp: 1_100, price: 100.5, size: 2, side: -1 },
  { timestamp: 1_999, price: 100.25, size: 3, side: 0 },
  { timestamp: 2_000, price: 100.5, size: 4, side: 1 },
  { timestamp: 2_999, price: 100.25, size: 5, side: -1 },
];

test("exact prints fold into sorted one-tick rows with source sides preserved", () => {
  const input = { tickSize: 0.25, bars: structuredClone(bars), trades: structuredClone(trades) };
  const before = structuredClone(input);
  const result = foldAuctionGapTimeRows(input);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.bars[0].rows, [
    { tickIndex: 400, bidVolume: 0, askVolume: 1, unknownVolume: 0 },
    { tickIndex: 401, bidVolume: 0, askVolume: 0, unknownVolume: 3 },
    { tickIndex: 402, bidVolume: 2, askVolume: 0, unknownVolume: 0 },
  ]);
  assert.deepEqual(result.bars[1].rows, [
    { tickIndex: 401, bidVolume: 5, askVolume: 0, unknownVolume: 0 },
    { tickIndex: 402, bidVolume: 0, askVolume: 4, unknownVolume: 0 },
  ]);
  assert.deepEqual(input, before, "fold mutated caller-owned chart or tape data");
});

test("half-open boundaries assign an exact timestamp to the next candle", () => {
  const result = foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades });
  assert.equal(result.status, "ready");
  assert.equal(result.bars[1].rows.find((row) => row.tickIndex === 402).askVolume, 4);
});

test("missing, extra and out-of-window executions all fail instead of returning partial rows", () => {
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: trades.slice(1) }).reason,
    "source-volume-mismatch");
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: [
    { timestamp: 999, price: 100, size: 1, side: 1 }, ...trades,
  ] }).reason, "unassigned-execution");
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: [
    ...trades, { timestamp: 3_000, price: 100, size: 1, side: 1 },
  ] }).reason, "unassigned-execution");
});

test("matching volume with the wrong print path fails OHLC reconciliation", () => {
  const changed = structuredClone(trades);
  changed[1].price = 100.25;
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: changed }).reason,
    "source-ohlc-mismatch");
});

test("off-tick values, invalid sides and reversed tape ordering are rejected", () => {
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: [
    { ...trades[0], price: 100.1 }, ...trades.slice(1),
  ] }).reason, "off-tick-execution");
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: [
    { ...trades[0], side: 2 }, ...trades.slice(1),
  ] }).reason, "invalid-execution");
  assert.equal(foldAuctionGapTimeRows({ tickSize: 0.25, bars, trades: [...trades].reverse() }).reason,
    "invalid-execution");
});

test("zero-volume bridge candles remain empty without manufacturing price rows", () => {
  const bridge = { timestamp: 3_000, endTime: 4_000, open: 100.25, high: 100.25, low: 100.25, close: 100.25, volume: 0 };
  const result = foldAuctionGapTimeRows({ tickSize: 0.25, bars: [...bars, bridge], trades });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.bars[2].rows, []);
});
