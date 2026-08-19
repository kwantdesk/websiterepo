import assert from "node:assert/strict";
import { detectCvdDivergence, sessionCvdPoints } from "../src/lib/cvdDivergence.ts";

// One-minute bars inside a single CME session (14:00 UTC = 09:00 Chicago).
const SESSION_BASE_MS = Date.parse("2026-08-19T14:00:00.000Z");

function buildCandles(bars) {
  return bars.map((bar, index) => ({
    timestamp: SESSION_BASE_MS + index * 60_000,
    high: bar.high,
    low: bar.high - 1,
    delta: bar.delta,
  }));
}

function bearishBars() {
  const bars = [];
  for (let index = 0; index < 40; index += 1) {
    let high = 100 + index * 0.05;
    if (index === 20) high = 105;          // completed swing high
    if (index >= 21 && index <= 37) high = 101 + (index - 21) * 0.2;
    if (index === 38) high = 106;          // recent higher high
    if (index === 39) high = 105.2;
    const delta = index <= 20 ? 10 : -3;   // CVD peaks with the first swing
    bars.push({ high, delta });
  }
  return bars;
}

// Case 1: higher price high with a lower CVD high = live bearish divergence.
{
  const candles = buildCandles(bearishBars());
  const cvd = sessionCvdPoints(candles);
  assert.equal(cvd.length, 40);
  assert.equal(cvd[20].value, 210);
  const result = detectCvdDivergence(candles, cvd, {});
  assert.ok(result, "expected a bearish divergence");
  assert.equal(result.kind, "bearish");
  assert.equal(result.fromPrice, 105);
  assert.equal(result.toPrice, 106);
  assert.ok(result.toCvd < result.fromCvd, "CVD must be lower at the newer high");
  assert.equal(result.toTime, Math.floor((SESSION_BASE_MS + 38 * 60_000) / 1000));
}

// Case 2: the divergence disappears once CVD catches back up ("they match").
{
  const bars = bearishBars();
  for (let index = 0; index < 4; index += 1) bars.push({ high: 104, delta: 30 });
  const candles = buildCandles(bars);
  const cvd = sessionCvdPoints(candles);
  assert.ok(cvd[cvd.length - 1].value > 210, "CVD should have recovered above the old swing");
  const result = detectCvdDivergence(candles, cvd, {});
  assert.equal(result, null, "recovered CVD must invalidate the divergence");
}

// Case 3: lower price low with a higher CVD low = bullish divergence.
{
  const bars = [];
  for (let index = 0; index < 40; index += 1) {
    let high = 101 - index * 0.05;
    if (index === 20) high = 96;           // swing low at 95 (low = high - 1)
    if (index >= 21 && index <= 37) high = 100 - (index - 21) * 0.2;
    if (index === 38) high = 95;           // lower low at 94
    if (index === 39) high = 95.8;
    const delta = index <= 20 ? -10 : 3;
    bars.push({ high, delta });
  }
  const candles = buildCandles(bars);
  const result = detectCvdDivergence(candles, sessionCvdPoints(candles), {});
  assert.ok(result, "expected a bullish divergence");
  assert.equal(result.kind, "bullish");
  assert.ok(result.toPrice < result.fromPrice);
  assert.ok(result.toCvd > result.fromCvd);
}

// Case 4: price and CVD agreeing produces no signal.
{
  const bars = [];
  for (let index = 0; index < 40; index += 1) {
    let high = 100 + index * 0.05;
    if (index === 20) high = 105;
    if (index >= 21 && index <= 37) high = 101 + (index - 21) * 0.2;
    if (index === 38) high = 106;
    if (index === 39) high = 105.2;
    bars.push({ high, delta: 10 });
  }
  const candles = buildCandles(bars);
  const result = detectCvdDivergence(candles, sessionCvdPoints(candles), {});
  assert.equal(result, null, "matching price and CVD must not flag a divergence");
}

console.log("CVD divergence tests passed.");
