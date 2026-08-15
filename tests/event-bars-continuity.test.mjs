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
