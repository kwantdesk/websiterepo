import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeAuthoritativeChartHistory,
  mergeChartHistory,
} from "../src/lib/chartHistoryCache.ts";

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
