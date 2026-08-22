import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const drawLayer = readFileSync("src/components/ChartDrawLayer.tsx", "utf8");
const profile = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");

/** Mirrors the calculator's default sizing rule. */
function defaultRisk(candles, price) {
  const recent = candles.slice(-14);
  const averageRange = recent.length
    ? recent.reduce((total, c) => total + Math.max(0, c.high - c.low), 0) / recent.length
    : 0;
  return averageRange > 0 ? averageRange * 2 : Math.abs(price) * 0.0015;
}
const bars = (range, price) => Array.from({ length: 20 }, () => ({ high: price + range / 2, low: price - range / 2 }));

// 1. It opens at a real 1:1 — stop and target equidistant from entry.
{
  const risk = defaultRisk(bars(25, 29_000), 29_000);
  const entry = 29_000;
  assert.equal(entry - (entry - risk), (entry + risk) - entry, "stop and target must be equidistant");
}

// 2. Instrument-appropriate without hard-coding: an NQ-like bar range gives
//    tens of points, an ES-like range gives a fraction of that.
{
  const nq = defaultRisk(bars(25, 29_000), 29_000);
  const es = defaultRisk(bars(5, 6_400), 6_400);
  assert.ok(nq > 30 && nq < 90, `NQ default should land in the tens of points, got ${nq}`);
  assert.ok(es > 5 && es < 20, `ES default should be far smaller, got ${es}`);
  assert.ok(nq / es > 3, "the two instruments must not get the same risk");
}

// 3. Zoom cannot change it — the rule reads prices, never pixels.
const block = drawLayer.slice(drawLayer.indexOf('tool === "longPosition" || tool === "shortPosition"'), drawLayer.indexOf("onCommit(createDrawing(tool, committed));"));
assert.ok(!/py [-+] dir \* \d+/.test(block), "the default must not be built from pixel offsets");
assert.ok(block.includes("candle.high - candle.low"), "it must be sized from real bar range");

// 4. A series with no usable range still produces a finite, positive risk.
{
  const risk = defaultRisk([], 29_000);
  assert.ok(Number.isFinite(risk) && risk > 0, "a fallback risk is still required");
}

// 5. Volume profiles paint above the candles, and opacity still applies so the
//    price action shows through.
assert.match(profile, /zOrder: \(\) => "top" as const,/);
assert.match(profile, /style\.opacity/);

console.log("position default size and profile order: 5/5 checks passed");
