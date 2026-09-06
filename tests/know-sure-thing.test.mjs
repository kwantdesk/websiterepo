import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateKstValues, KST_PARAMETERS } from "../src/lib/knowSureThing.ts";

const bars = values => values.map((close, i) => ({ timestamp: 1700000000000 + i * 7, close, open: close, high: close, low: close }));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function reference(values, p) {
  const average = (input, n) => {
    const out = Array(input.length).fill(undefined);
    for (let i = n - 1; i < input.length; i++) {
      const window = input.slice(i - n + 1, i + 1);
      if (window.some(v => v === undefined)) continue;
      if (p.averageType === "weighted") out[i] = window.reduce((sum, v, j) => sum + (j + 1) * v, 0) / (n * (n + 1) / 2);
      else if (p.averageType === "triangular") { const weights = window.map((_, j) => Math.min(j + 1, n - j)); out[i] = window.reduce((sum, v, j) => sum + weights[j] * v, 0) / weights.reduce((sum, w) => sum + w, 0); }
      else if (p.averageType === "simple" || out[i - 1] === undefined) out[i] = window.reduce((sum, v) => sum + v, 0) / n;
      else { const alpha = 2 / (n + 1); out[i] = alpha * input[i] + (1 - alpha) * out[i - 1]; }
    }
    return out;
  };
  const components = p.rocLengths.map((n, j) => average(values.map((v, i) => i < n ? undefined : p.usePercent ? 100 * (v - values[i - n]) / values[i - n] : v - values[i - n]), p.averageLengths[j]));
  const kst = values.map((_, i) => components.some(c => c[i] === undefined) ? undefined : components.reduce((sum, c, j) => sum + (j + 1) * c[i], 0));
  return { kst: kst.filter(v => v !== undefined), signal: average(kst, p.signalPeriod).filter(v => v !== undefined) };
}

test("full conventional warmup and hand-computed raw ramp", () => {
  const input = bars(Array.from({ length: 100 }, (_, i) => 100 + i));
  assert.equal(calculateKstValues(input.slice(0, 44)).kst.length, 0);
  assert.equal(calculateKstValues(input.slice(0, 45)).kst.length, 1);
  assert.equal(calculateKstValues(input.slice(0, 52)).signal.length, 0);
  assert.equal(calculateKstValues(input.slice(0, 53)).signal.length, 1);
  const raw = calculateKstValues(input, { ...KST_PARAMETERS, usePercent: false });
  for (const series of Object.values(raw)) for (const point of series) near(point.value, 220);
});

test("independent window calculation across all smoothers, sources and custom horizons", () => {
  const values = Array.from({ length: 1200 }, (_, i) => 200 + Math.sin(i * 0.3) * 50 + Math.cos(i * 0.11) * 10 + i * 0.01);
  for (const averageType of ["simple", "exponential", "weighted", "triangular"]) {
    for (const usePercent of [true, false]) for (const period of [1, 4, 9, 127]) {
      const parameters = { rocLengths: [1, 5, 17, 91], averageLengths: [period, 3, 14, 23], signalPeriod: period, averageType, usePercent };
      const actual = calculateKstValues(bars(values), parameters), expected = reference(values, parameters);
      for (const key of ["kst", "signal"]) {
        assert.equal(actual[key].length, expected[key].length);
        actual[key].forEach((point, i) => near(point.value, expected[key][i]));
      }
    }
  }
});

test("prefix causality, real subsecond times and forming-bar change", () => {
  const input = bars(Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i) * 5));
  const full = calculateKstValues(input);
  for (const length of [45, 53, 77, 119]) {
    const partial = calculateKstValues(input.slice(0, length));
    for (const key of ["kst", "signal"]) assert.deepEqual(partial[key], full[key].filter(p => p.time <= input[length - 1].timestamp / 1000));
  }
  const changed = calculateKstValues([...input.slice(0, -1), { ...input.at(-1), close: 120 }]);
  for (const key of ["kst", "signal"]) {
    assert.deepEqual(changed[key].slice(0, -1), full[key].slice(0, -1));
    assert.notEqual(changed[key].at(-1).value, full[key].at(-1).value);
  }
});

test("malformed close and duplicate timestamp reset complete windows and break lines", () => {
  for (const invalid of [{ close: NaN }, { timestamp: 1700000000000 }]) {
    const input = bars(Array.from({ length: 200 }, (_, i) => 100 + i));
    input[80] = { ...input[80], ...invalid };
    const output = calculateKstValues(input);
    const rebuilt = calculateKstValues(input.slice(81));
    for (const key of ["kst", "signal"]) {
      const tail = output[key].filter(p => p.time >= input[81].timestamp / 1000);
      assert.equal(tail[0].breakBefore, true);
      assert.deepEqual(tail.map(({ time, value }) => ({ time, value })), rebuilt[key]);
    }
  }
});

test("percent zero denominator is absent, not a false zero; raw zero/negative prices remain valid", () => {
  const p = { rocLengths: [1, 1, 1, 1], averageLengths: [1, 1, 1, 1], signalPeriod: 1, averageType: "simple", usePercent: true };
  const input = bars([1, 2, 0, 3, 6]);
  const result = calculateKstValues(input, p);
  assert.deepEqual(result.kst.map(p => p.value), [1000, -1000, 1000]);
  assert.equal(result.kst.at(-1).breakBefore, true);
  assert.equal(result.signal.at(-1).breakBefore, true);
  assert.deepEqual(calculateKstValues(bars([-3, 0, 2]), { ...p, usePercent: false }).kst.map(p => p.value), [30, 20]);
});

test("explicit bounds and maximum window readiness", () => {
  assert.throws(() => calculateKstValues([], { ...KST_PARAMETERS, signalPeriod: 0 }), RangeError);
  assert.throws(() => calculateKstValues([], { ...KST_PARAMETERS, averageType: "unknown" }), RangeError);
  const p = { ...KST_PARAMETERS, rocLengths: [1000, 1000, 1000, 1000], averageLengths: [1000, 1000, 1000, 1000], signalPeriod: 1000 };
  const result = calculateKstValues(bars(Array(2999).fill(100)), p);
  assert.equal(result.kst.length, 1000);
  assert.equal(result.signal.length, 1);
  assert.equal(result.signal[0].value, 0);
});
