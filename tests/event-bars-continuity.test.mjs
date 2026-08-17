import test from "node:test";
import assert from "node:assert/strict";

import { applyMarketTradesToEventBars } from "../src/lib/eventBars.ts";

test("500-volume overflow continues from the completed bar close", () => {
  const bars = applyMarketTradesToEventBars([], [
    { timestamp: 1_000, price: 20_000, size: 300, trades: 1, delta: 300 },
    { timestamp: 2_000, price: 20_000.25, size: 300, trades: 1, delta: 300 },
  ], "500v", "NQ");

  assert.equal(bars.length, 2);
  assert.equal(bars[0].volume, 500);
  assert.equal(bars[1].volume, 100);
  assert.equal(bars[1].open, bars[0].close);
  assert.equal(bars[1].close, 20_000.25);
  assert.ok(bars[1].timestamp > bars[0].timestamp);
});

test("40-range bridge bars remain continuous and ordered", () => {
  const bars = applyMarketTradesToEventBars([], [
    { timestamp: 1_000, price: 20_000, size: 1, trades: 1, delta: 1 },
    { timestamp: 2_000, price: 20_011, size: 1, trades: 1, delta: 1 },
  ], "40r", "NQ");

  assert.equal(bars.length, 2);
  assert.equal(bars[0].open, 20_000);
  assert.equal(bars[0].close, 20_010);
  assert.equal(bars[1].open, bars[0].close);
  assert.equal(bars[1].close, 20_011);
  assert.ok(bars[1].timestamp > bars[0].timestamp);
});

test("overlapping reconnect history is not replayed into a 500-volume bar", () => {
  const initial = applyMarketTradesToEventBars([], [
    { timestamp: 1_000, price: 20_000, size: 300, trades: 1, delta: 300 },
    { timestamp: 2_000, price: 20_000.25, size: 100, trades: 1, delta: 100 },
  ], "500v", "NQ");

  const resumed = applyMarketTradesToEventBars(initial, [
    { timestamp: 1_000, price: 20_000, size: 300, trades: 1, delta: 300 },
    { timestamp: 3_000, price: 20_000.5, size: 100, trades: 1, delta: 100 },
  ], "500v", "NQ");

  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].volume, 500);
  assert.equal(resumed[0].open, 20_000);
  assert.equal(resumed[0].close, 20_000.5);
  assert.equal(resumed[0].sourceEndTimestamp, 3_000);
});

test("every event interval produces ordered, valid OHLC bars from one execution tape", () => {
  const records = Array.from({ length: 80 }, (_, index) => ({
    timestamp: 1_000 + index * 10,
    price: 20_000 + Math.sin(index / 4) * 8 + index * 0.25,
    size: 25 + index % 7,
    trades: 1 + index % 3,
    delta: index % 2 === 0 ? 20 + index % 5 : -(15 + index % 5),
  }));
  const intervals = ["4/2VB", "40r", "500v", "50t", "4R", "1/27PF", "50dv"];

  intervals.forEach((interval) => {
    const bars = applyMarketTradesToEventBars([], records, interval, "NQ");
    assert.ok(bars.length > 0, `${interval} returned no bars`);
    bars.forEach((bar, index) => {
      [bar.timestamp, bar.open, bar.high, bar.low, bar.close].forEach((value) => {
        assert.ok(Number.isFinite(value), `${interval} contains a non-finite candle value`);
      });
      assert.ok(bar.high >= Math.max(bar.open, bar.close), `${interval} high is below its body`);
      assert.ok(bar.low <= Math.min(bar.open, bar.close), `${interval} low is above its body`);
      if (index > 0) {
        assert.ok(bar.timestamp > bars[index - 1].timestamp, `${interval} timestamps are not ordered`);
      }
    });
  });
});
