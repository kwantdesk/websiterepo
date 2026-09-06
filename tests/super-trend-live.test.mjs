import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSuperTrendValues, SuperTrendLiveCalculator } from "../src/lib/superTrend.ts";

const bars = Array.from({ length: 200 }, (_, i) => {
  const close = 100 + 20 * Math.sin(i / 3);
  return { timestamp: 1700000000000 + i * 1000, open: close, close, high: close + 1, low: close - 1 };
});

test("constant-work live replacement equals full recalculation on every sample", () => {
  for (const length of [1, 10, 80]) {
    const p = { length, multiplier: 3 }, live = new SuperTrendLiveCalculator(p);
    const history = bars.slice(0, 100).map(b => ({ ...b }));
    assert.deepEqual(live.reseed(history), calculateSuperTrendValues(history, p).at(-1));
    for (const original of bars.slice(100)) {
      history.push(original);
      assert.deepEqual(live.update(original), calculateSuperTrendValues(history, p).at(-1));
      for (const shift of [-0.5, 0.5, -0.25, 0]) {
        const revision = { ...original, close: original.close + shift };
        history[history.length - 1] = revision;
        assert.deepEqual(live.update(revision), calculateSuperTrendValues(history, p).at(-1));
      }
    }
  }
});

test("warmup, invalid current OHLC repair and late packets preserve correct state", () => {
  const live = new SuperTrendLiveCalculator();
  assert.equal(live.reseed(bars.slice(0, 5)), null);
  assert.equal(live.update(bars[5]), null);
  live.reseed(bars.slice(0, 100));
  assert.equal(live.update({ ...bars[99], high: NaN }), null);
  assert.deepEqual(live.update(bars[99]), calculateSuperTrendValues(bars.slice(0, 100)).at(-1));
  assert.equal(live.update(bars[50]), null);
  assert.equal(live.update({ ...bars[99], timestamp: NaN }), null);
  assert.deepEqual(live.update(bars[100]), calculateSuperTrendValues(bars.slice(0, 101)).at(-1));
});

test("history correction reseeds full state and constructor owns immutable parameters", () => {
  const parameters = { length: 10, multiplier: 3 }, live = new SuperTrendLiveCalculator(parameters);
  parameters.length = 1;
  const history = bars.map(b => ({ ...b })); history[50].high += 40;
  assert.deepEqual(live.reseed(history), calculateSuperTrendValues(history).at(-1));
  assert.deepEqual(live.update(history.at(-1)), calculateSuperTrendValues(history).at(-1));
  assert.equal(live.reseed([]), null);
  assert.equal(live.update(bars[0]), null);
});
