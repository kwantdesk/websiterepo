import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { foldAuctionGapEventRows, foldAuctionGapTimeRows } from "../src/auction-gap-row-fold.mjs";
import { buildEventBars } from "../src/event-bar-builder.mjs";

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
  assert.deepEqual(result.bars[0].slices.map((slice) => [slice.minute, slice.volume]), [[0, 6]]);
  assert.deepEqual(input, before, "fold mutated caller-owned chart or tape data");
});

test("ordered minute slices preserve boundary geometry without exposing raw prints", () => {
  const result = foldAuctionGapTimeRows({
    tickSize: 0.25,
    bars: [{ timestamp: 0, endTime: 120_000, open: 100, high: 101, low: 100, close: 101, volume: 10 }],
    trades: [
      { timestamp: 59_999, price: 100, size: 4, side: -1 },
      { timestamp: 60_000, price: 100.5, size: 3, side: 1 },
      { timestamp: 60_001, price: 101, size: 3, side: 1 },
    ],
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.bars[0].slices.map((slice) => [
    slice.minute, slice.startTime, slice.endTime, slice.openTick,
    slice.highTick, slice.lowTick, slice.closeTick, slice.volume,
  ]), [
    [0, 59_999, 59_999, 400, 400, 400, 400, 4],
    [60_000, 60_000, 60_001, 402, 404, 402, 404, 6],
  ]);
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

const eventTrades = [
  { timestamp: 1_000, price: 100, size: 3, side: 1 },
  { timestamp: 2_000, price: 101.5, size: 4, side: -1 },
  { timestamp: 3_000, price: 99.5, size: 5, side: 0 },
  { timestamp: 4_000, price: 102, size: 6, side: -1 },
];

for (const interval of ["10v", "2t", "10dv", "4r", "4R", "4/8PF"]) {
  test(`${interval} compact rows share the authoritative event-candle ownership`, () => {
    const result = foldAuctionGapEventRows({ trades: eventTrades, interval, symbol: "NQU6", limit: 100 });
    assert.equal(result.status, "ready");
    const expected = buildEventBars(eventTrades.map((trade) => ({
      ...trade, trades: 1, delta: trade.side > 0 ? trade.size : trade.side < 0 ? -trade.size : 0,
    })), interval, "NQU6", 100);
    assert.deepEqual(result.candles, expected);
    assert.equal(result.bars.length, result.candles.length);
    for (let index = 0; index < result.bars.length; index += 1) {
      const volume = result.bars[index].rows.reduce(
        (sum, row) => sum + row.bidVolume + row.askVolume + row.unknownVolume, 0,
      );
      assert.equal(volume, result.candles[index].volume);
      assert.equal(result.bars[index].slices.reduce((sum, slice) => sum + slice.volume, 0),
        result.candles[index].volume);
    }
    assert.equal(result.bars.flatMap((bar) => bar.rows).reduce((sum, row) => sum + row.unknownVolume, 0), 5);
  });
}

test("event fold bounds output only after stable absolute ownership is established", () => {
  const result = foldAuctionGapEventRows({ trades: eventTrades, interval: "2t", symbol: "NQU6", limit: 1 });
  assert.equal(result.status, "ready");
  assert.equal(result.candles.length, 1);
  assert.equal(result.bars[0].chartIndex, 0);
  assert.equal(result.bars[0].rows.reduce(
    (sum, row) => sum + row.bidVolume + row.askVolume + row.unknownVolume, 0,
  ), result.candles[0].volume);
});

test("event fold rejects off-tick, reversed and invalid-side source prints", () => {
  assert.equal(foldAuctionGapEventRows({ trades: [{ ...eventTrades[0], price: 100.1 }], interval: "4r", symbol: "NQU6" }).reason,
    "off-tick-execution");
  assert.equal(foldAuctionGapEventRows({ trades: [...eventTrades].reverse(), interval: "4r", symbol: "NQU6" }).reason,
    "invalid-execution");
  assert.equal(foldAuctionGapEventRows({ trades: [{ ...eventTrades[0], side: 3 }], interval: "4r", symbol: "NQU6" }).reason,
    "invalid-execution");
});

test("history route opts into compact Auction Gap rows without changing ordinary requests", () => {
  const source = readFileSync(new URL("../src/server.mjs", import.meta.url), "utf8");
  assert.match(source, /const wantsAuctionGap = url\.searchParams\.get\("auctionGap"\) === "1"/);
  assert.match(source, /auctionGap: await tradeTape\.loadAuctionGapTimeRows\(/);
  assert.match(source, /auctionGap: wantsAuctionGap/);
  assert.match(source, /wantsAuctionGap && !subMinute/);
});
