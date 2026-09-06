import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateSuperTrendValues } from "../src/lib/superTrend.ts";

const bars = values => values.map((close, i) => ({ timestamp: 1700000000000 + i * 7,
  open: close, close, high: close + 1, low: close - 1 }));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("full warmup, Wilder ATR and hand-computed reversal bands", () => {
  const input = bars([10, 10, 10, 14, 15, 7]);
  const out = calculateSuperTrendValues(input, { length: 3, multiplier: 1 });
  assert.equal(calculateSuperTrendValues(input.slice(0, 2), { length: 3, multiplier: 1 }).length, 0);
  assert.equal(out.length, 4);
  near(out[0].atr, 2); near(out[0].value, 12);
  assert.equal(out[0].direction, "down"); assert.equal(out[0].reversed, false);
  near(out[1].atr, 3); near(out[1].value, 11);
  assert.equal(out[1].direction, "up"); assert.equal(out[1].reversed, true);
  near(out[2].atr, 8 / 3); near(out[2].value, 37 / 3);
  near(out[3].atr, 43 / 9); near(out[3].value, 106 / 9);
  assert.equal(out[3].direction, "down"); assert.equal(out[3].reversed, true);
  out.forEach((p, i) => near(p.difference, input[i + 2].close - p.value));
});

test("strict touches do not reverse; zero and negative prices remain valid", () => {
  const out = calculateSuperTrendValues(bars([0, 2, 3, -4]), { length: 1, multiplier: 1 });
  assert.equal(out[1].direction, "down"); assert.equal(out[1].reversed, false);
  assert.equal(out[2].direction, "up"); assert.equal(out[3].direction, "down");
  assert.ok(out.every(p => Number.isFinite(p.difference)));
  const flat = bars([0, 0, 0]).map(b => ({ ...b, high: 0, low: 0 }));
  assert.ok(calculateSuperTrendValues(flat, { length: 1, multiplier: 3 }).every(p => p.value === 0 && !p.reversed));
});

test("future bars and live bar replacement do not mutate earlier results", () => {
  const input = bars(Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 5) * 20));
  const out = calculateSuperTrendValues(input);
  assert.deepEqual(calculateSuperTrendValues(input.slice(0, 200)), out.slice(0, 191));
  const revised = input.map(b => ({ ...b }));
  revised.at(-1).close += 0.5;
  const changed = calculateSuperTrendValues(revised);
  assert.deepEqual(changed.slice(0, -1), out.slice(0, -1));
  assert.notEqual(changed.at(-1).difference, out.at(-1).difference);
  assert.equal(out.at(-1).time, input.at(-1).timestamp / 1000);
});

test("invalid bars and duplicate times reset warmup without false reversal", () => {
  for (const fault of [{ high: NaN }, { close: 999 }, { open: -999 }, { timestamp: 1700000000000 }]) {
    const input = bars(Array.from({ length: 25 }, () => 10));
    Object.assign(input[11], fault);
    const out = calculateSuperTrendValues(input, { length: 3, multiplier: 1 });
    const resumed = out.find(p => p.breakBefore);
    assert.equal(resumed.time, input[14].timestamp / 1000);
    assert.equal(resumed.reversed, false);
    assert.ok(out.every((p, i) => !i || p.time > out[i - 1].time));
  }
});

test("parameter bounds and long warmup, without volume dependency", () => {
  const input = bars(Array.from({ length: 1000 }, () => 5));
  assert.equal(calculateSuperTrendValues(input, { length: 1000, multiplier: 100 }).length, 1);
  for (const parameters of [{ length: 0, multiplier: 3 }, { length: 1.5, multiplier: 3 },
    { length: 1001, multiplier: 3 }, { length: 10, multiplier: NaN }, { length: 10, multiplier: 0 }]) {
    assert.throws(() => calculateSuperTrendValues(input, parameters), RangeError);
  }
});

test("independent array reference matches full band recurrence across parameters", () => {
  const input = bars(Array.from({ length: 700 }, (_, i) => Math.sin(i * 0.71) * 40 + Math.cos(i / 19) * 75));
  for (const length of [1, 2, 10, 137]) for (const multiplier of [0.01, 1, 3, 100]) {
    const ranges = input.map((b, i) => Math.max(b.high - b.low,
      i ? Math.abs(b.high - input[i - 1].close) : 0,
      i ? Math.abs(b.low - input[i - 1].close) : 0));
    const expected = [];
    for (let i = length - 1; i < input.length; i++) {
      const prev = expected.at(-1), b = input[i];
      const atr = prev ? (prev.atr * (length - 1) + ranges[i]) / length
        : ranges.slice(0, length).reduce((a, v) => a + v, 0) / length;
      const basicHigh = (b.high + b.low) / 2 + multiplier * atr;
      const basicLow = (b.high + b.low) / 2 - multiplier * atr;
      const upper = !prev || basicHigh < prev.upper || input[i - 1].close > prev.upper ? basicHigh : prev.upper;
      const lower = !prev || basicLow > prev.lower || input[i - 1].close < prev.lower ? basicLow : prev.lower;
      const up = prev ? prev.up ? b.close >= lower : b.close > upper : false;
      expected.push({ atr, upper, lower, up, value: up ? lower : upper });
    }
    const actual = calculateSuperTrendValues(input, { length, multiplier });
    assert.equal(actual.length, expected.length);
    actual.forEach((p, i) => {
      near(p.atr, expected[i].atr); near(p.value, expected[i].value);
      assert.equal(p.direction, expected[i].up ? "up" : "down");
      assert.equal(p.reversed, i > 0 && expected[i].up !== expected[i - 1].up);
    });
  }
});
