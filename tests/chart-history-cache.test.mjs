import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeAuthoritativeChartHistory,
  mergeChartHistory,
  readChartHistoryCache,
  writeChartHistoryCache,
  peekCompatibleChartHistoryCache,
} from "../src/lib/chartHistoryCache.ts";

test("an older wick correction is persisted when the newest candle is unchanged", async () => {
  const timestamp = Math.floor((Date.now() - 600_000) / 60_000) * 60_000;
  const symbol = "WICK-CACHE-REGRESSION";
  const original = Array.from({ length: 6 }, (_, i) => ({ timestamp: timestamp + i * 60000, open: 100, high: 102, low: 99, close: 101, volume: 10 }));
  await writeChartHistoryCache(symbol, "1m", original);
  const corrected = original.map((c, i) => i === 1 ? { ...c, high: 109, low: 94 } : c);
  await writeChartHistoryCache(symbol, "1m", corrected);
  const restored = await readChartHistoryCache(symbol, "1m");
  assert.equal(restored.candles[1].high, 109);
  assert.equal(restored.candles[1].low, 94);
  // Real provider corrections can remove an erroneous spike too. Do not fix
  // persistence by applying a permanently expanding OHLC envelope.
  await writeChartHistoryCache(symbol, "1m", original);
  assert.equal((await readChartHistoryCache(symbol, "1m")).candles[1].high, 102);
});

test("higher-timeframe warm caches are rebuilt after their source history changes", async () => {
  const timestamp = Math.floor((Date.now() - 600_000) / 180_000) * 180_000;
  const symbol = "WICK-DERIVED-CACHE-REGRESSION";
  const original = Array.from({ length: 6 }, (_, i) => ({ timestamp: timestamp + i * 60000, open: 100, high: 102, low: 99, close: 101, volume: 10 }));
  await writeChartHistoryCache(symbol, "1m", original);
  assert.equal(peekCompatibleChartHistoryCache(symbol, "3m").candles[0].high, 102);
  await writeChartHistoryCache(symbol, "1m", original.map((c, i) => i === 1 ? { ...c, high: 110 } : c));
  assert.equal(peekCompatibleChartHistoryCache(symbol, "3m").candles[0].high, 110);
});

test("internal flow corrections survive a cache write with unchanged OHLC endpoints", async () => {
  const timestamp = Math.floor((Date.now() - 600_000) / 60000) * 60000;
  const symbol = "FLOW-CACHE-REGRESSION";
  const original = Array.from({ length: 3 }, (_, i) => ({ timestamp: timestamp + i * 60000, open: 100, high: 102, low: 99, close: 101, volume: 10, askVolume: 6, bidVolume: 4 }));
  await writeChartHistoryCache(symbol, "1m", original);
  await writeChartHistoryCache(symbol, "1m", original.map((c, i) => i === 0 ? { ...c, askVolume: 9, bidVolume: 1 } : c));
  assert.equal((await readChartHistoryCache(symbol, "1m")).candles[0].askVolume, 9);
});

test("a base candle refresh preserves cached order-flow enrichment", () => {
  const timestamp = Date.now() - 60_000;
  const enriched = {
    timestamp,
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 250,
    trades: 40,
    askVolume: 160,
    bidVolume: 90,
    askTrades: 25,
    bidTrades: 15,
    delta: 70,
    deltaOpen: 0,
    deltaHigh: 80,
    deltaLow: -10,
    deltaClose: 70,
  };
  const refreshedBase = {
    timestamp,
    open: 100,
    high: 103,
    low: 99,
    close: 102,
    volume: 270,
  };

  const [merged] = mergeChartHistory([enriched], [refreshedBase]);

  assert.equal(merged.close, 102);
  assert.equal(merged.volume, 270);
  assert.equal(merged.askVolume, 160);
  assert.equal(merged.bidVolume, 90);
  assert.equal(merged.deltaClose, 70);
});

test("new order-flow enrichment supersedes older flow values", () => {
  const timestamp = Date.now() - 60_000;
  const [merged] = mergeChartHistory([
    {
      timestamp,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      askVolume: 20,
      bidVolume: 10,
      delta: 10,
      deltaClose: 10,
    },
  ], [
    {
      timestamp,
      open: 100,
      high: 102,
      low: 99,
      close: 101,
      askVolume: 80,
      bidVolume: 25,
      delta: 55,
      deltaClose: 55,
    },
  ]);

  assert.equal(merged.askVolume, 80);
  assert.equal(merged.bidVolume, 25);
  assert.equal(merged.deltaClose, 55);
});

test("an authoritative event rebuild replaces shifted cached bars", () => {
  const now = Date.now();
  const cached = [
    { timestamp: now - 4_000, open: 100, high: 101, low: 100, close: 101, volume: 500 },
    { timestamp: now - 3_000, open: 101, high: 102, low: 101, close: 102, volume: 500 },
  ];
  const rebuilt = [
    { timestamp: now - 3_999, open: 100, high: 101, low: 100, close: 101, volume: 500 },
    { timestamp: now - 2_999, open: 101, high: 102, low: 101, close: 102, volume: 500 },
  ];

  const merged = mergeAuthoritativeChartHistory(cached, rebuilt, "500v");

  assert.deepEqual(merged.map((candle) => candle.timestamp), rebuilt.map((candle) => candle.timestamp));
  assert.equal(merged.length, 2);
});
