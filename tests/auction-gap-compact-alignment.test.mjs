import assert from "node:assert/strict";
import test from "node:test";
import { alignAuctionGapCompactRows } from "../src/lib/auctionGapCompactRows.ts";

const candle = (timestamp, volume = 3) => ({ timestamp, open: 100, high: 101, low: 99, close: 100, volume });
const bar = (chartIndex, timestamp, volume = 3) => ({
  chartIndex,
  timestamp,
  endTime: timestamp + 60_000,
  rows: [{ tickIndex: 400, bidVolume: volume, askVolume: 0, unknownVolume: 0 }],
  slices: [{ minute: timestamp, startTime: timestamp, endTime: timestamp + 1,
    openTick: 400, highTick: 400, lowTick: 400, closeTick: 400, volume,
    rows: [{ tickIndex: 400, bidVolume: volume, askVolume: 0, unknownVolume: 0 }] }],
});
const history = {
  status: "ready",
  coverage: "complete",
  contractSymbol: "NQZ6",
  bars: [bar(0, 60_000), bar(1, 120_000), bar(2, 180_000)],
};

test("aligns a left-trimmed provider window to its chart logical offset", () => {
  const result = alignAuctionGapCompactRows(history, [candle(120_000), candle(180_000), candle(240_000)], "nqz6");
  assert.equal(result.status, "ready");
  assert.equal(result.logicalOffset, 0);
  assert.deepEqual(result.history.bars.map((item) => [item.chartIndex, item.timestamp]), [[0, 120_000], [1, 180_000]]);
});

test("allows only a trailing developing candle to differ from validated history", () => {
  const result = alignAuctionGapCompactRows(history, [candle(60_000), candle(120_000), candle(180_000, 4)], "NQZ6");
  assert.equal(result.status, "ready");
  assert.deepEqual(result.candles.map((item) => item.timestamp), [60_000, 120_000]);
});

test("rejects a changed candle inside a later matching overlap", () => {
  const result = alignAuctionGapCompactRows(history, [candle(60_000), candle(120_000, 4), candle(180_000)], "NQZ6");
  assert.deepEqual(result, { status: "unavailable", reason: "non-trailing-chart-change" });
});

test("rejects contract and ambiguous-time mismatches", () => {
  assert.equal(alignAuctionGapCompactRows(history, [candle(60_000)], "ESZ6").status, "unavailable");
  assert.deepEqual(
    alignAuctionGapCompactRows(history, [candle(60_000), candle(60_000)], "NQZ6"),
    { status: "unavailable", reason: "ambiguous-chart-time" },
  );
});
