import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".cvd-div-test-"));
const bundle = join(outDir, "cvd.mjs");
execSync(
  `npx esbuild src/lib/cvdDivergence.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { sessionCvdBars, detectCvdDivergences } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const MIN = 60_000;
const T0 = Date.parse("2026-08-20T14:30:00Z");
/** delta drives CVD; low/high drive price swings. */
const bar = (i, low, high, delta) => ({
  timestamp: T0 + i * MIN,
  open: low, high, low, close: high,
  askVolume: delta > 0 ? delta : 0,
  bidVolume: delta < 0 ? -delta : 0,
  volume: Math.abs(delta), trades: 10,
});

// 1. CVD bars carry a real candle shape, session-anchored.
{
  const bars = sessionCvdBars([bar(0, 100, 101, 50), bar(1, 100, 101, -20)]);
  assert.equal(bars.length, 2);
  assert.equal(bars[0].open, 0);
  assert.equal(bars[0].close, 50);
  assert.equal(bars[0].high, 50);
  assert.equal(bars[0].low, 0);
  assert.equal(bars[1].open, 50);
  assert.equal(bars[1].close, 30);
  assert.equal(bars[1].low, 30, "a falling bar's low is its close");
}

/** Price makes a HIGHER low while CVD makes a LOWER low. */
function divergingLows() {
  const candles = [];
  const push = (low, delta) => candles.push(bar(candles.length, low, low + 2, delta));
  push(100, 10); push(102, 10); push(98, 10); push(102, 10); push(104, 10);  // swing low at 98
  push(103, -60); push(101, -60);                                             // CVD driven down
  push(105, 10); push(103, 10); push(99.5, 10); push(104, 10); push(106, 10); // higher low at 99.5
  push(107, 10); push(108, 10);
  return candles;
}

// 2. A completed divergence is reported.
{
  const candles = divergingLows();
  const bars = sessionCvdBars(candles);
  const found = detectCvdDivergences(candles, bars, { pivotStrength: 2 });
  const lows = found.filter((s) => s.direction === "low");
  assert.ok(lows.length >= 1, "a higher price low against a lower CVD low must be reported");
  const seg = lows[0];
  assert.ok(seg.toPrice > seg.fromPrice, "price made the higher low");
  assert.ok(seg.toCvd < seg.fromCvd, "CVD made the lower low");
  // The flow leads: CVD falling while price rises is bearish, read the same
  // way on either extreme.
  assert.equal(seg.kind, "bearish", "rising price against falling flow reads bearish");
}

// 3. THE REPORTED BUG: a divergence must not be retracted once formed. Adding
//    later bars where CVD recovers must leave the earlier signal in place.
{
  const candles = divergingLows();
  const before = detectCvdDivergences(candles, sessionCvdBars(candles), { pivotStrength: 2 });
  const extended = [...candles];
  for (let i = 0; i < 10; i += 1) {
    extended.push(bar(extended.length, 110 + i, 112 + i, 400));
  }
  const after = detectCvdDivergences(extended, sessionCvdBars(extended), { pivotStrength: 2 });
  for (const seg of before) {
    assert.ok(
      after.some((s) => s.fromTime === seg.fromTime && s.toTime === seg.toTime && s.direction === seg.direction),
      "a formed divergence must survive later CVD recovery",
    );
  }
}

// 4. Agreement is not divergence.
{
  const candles = [];
  const push = (low, delta) => candles.push(bar(candles.length, low, low + 2, delta));
  for (const [low, d] of [[100,10],[102,10],[98,-30],[102,10],[104,10],[103,10],[101,10],[105,10],[103,10],[96,-40],[104,10],[106,10],[107,10]]) push(low, d);
  const found = detectCvdDivergences(candles, sessionCvdBars(candles), { pivotStrength: 2 });
  for (const seg of found.filter((s) => s.direction === "low")) {
    assert.notEqual(seg.toPrice > seg.fromPrice, seg.toCvd > seg.fromCvd, "only disagreement may be reported");
  }
}

// 5. Segments are time-ordered and each spans forward.
{
  const candles = divergingLows();
  const found = detectCvdDivergences(candles, sessionCvdBars(candles), { pivotStrength: 2 });
  for (const seg of found) assert.ok(seg.toTime > seg.fromTime);
  for (let i = 1; i < found.length; i += 1) assert.ok(found[i].fromTime >= found[i - 1].fromTime);
}

// 6. The study draws CVD as CANDLES and marks divergences dotted — not a line.
const engine = readFileSync("src/lib/chartIndicatorEngine.ts", "utf8");
const block = engine.slice(engine.indexOf('if (key === "cvd-divergence")'), engine.indexOf('if (\n    key === "cumulative-volume-delta"'));
assert.ok(block.includes('kind: "candlestick"'), "the CVD itself must render as candles");
assert.ok(block.includes('lineStyle: "dotted"'), "divergences must be dotted");
assert.ok(!block.includes('detectCvdDivergence('), "the single-signal detector must be gone");
assert.ok(block.includes("detectCvdDivergences("), "all divergences must be drawn");

rmSync(outDir, { recursive: true, force: true });
console.log("CVD divergence segments: 6/6 checks passed");
