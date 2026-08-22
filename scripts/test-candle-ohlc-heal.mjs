import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".ohlc-heal-test-"));
const bundle = join(outDir, "imd.mjs");
execSync(
  `npx esbuild src/lib/institutionalMarketData.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { healClosedCandleOhlc } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const MIN = 60_000;
const NOW = 1_770_000_000_000;
const bar = (i, o, h, l, c) => ({
  timestamp: NOW - (30 - i) * MIN, open: o, high: h, low: l, close: c,
  volume: 500, trades: 100, askVolume: 260, bidVolume: 240, delta: 20,
});

/** The exchange's own bars: full wicks, every print included. */
const baked = Array.from({ length: 30 }, (_, i) => bar(i, 20_000 + i, 20_012 + i, 19_988 + i, 20_004 + i));
const liveEdge = NOW - 2 * MIN;

// 1. A bar the live tail built from the few ticks it saw has a truncated
//    wick. That is the reported symptom: no wick where the exchange has one.
{
  const held = baked.map((b, i) => (
    i === 10 ? { ...b, high: b.close, low: b.open } : { ...b }
  ));
  const healed = healClosedCandleOhlc(held, baked, liveEdge);
  assert.ok(healed, "a truncated wick must be repaired");
  assert.equal(healed[10].high, baked[10].high);
  assert.equal(healed[10].low, baked[10].low);
}

// 2. The opposite: a stray tick left an over-long wick.
{
  const held = baked.map((b, i) => (i === 7 ? { ...b, high: b.high + 40 } : { ...b }));
  const healed = healClosedCandleOhlc(held, baked, liveEdge);
  assert.ok(healed, "an over-long wick must be repaired");
  assert.equal(healed[7].high, baked[7].high);
}

// 3. Flow fields belong to the tape and must survive untouched — they are
//    reconciled by the separate flow heal.
{
  const held = baked.map((b, i) => (
    i === 5 ? { ...b, high: b.close, askVolume: 999, bidVolume: 111, delta: 888 } : { ...b }
  ));
  const healed = healClosedCandleOhlc(held, baked, liveEdge);
  assert.equal(healed[5].askVolume, 999);
  assert.equal(healed[5].bidVolume, 111);
  assert.equal(healed[5].delta, 888);
  assert.equal(healed[5].high, baked[5].high);
}

// 4. The forming edge stays with the stream — the vendor's view of a bar that
//    has not closed is incomplete and must not drag it backwards.
{
  const held = baked.map((b) => (
    b.timestamp >= liveEdge ? { ...b, high: b.high + 25 } : { ...b }
  ));
  assert.equal(healClosedCandleOhlc(held, baked, liveEdge), null, "the live edge must be left alone");
}

// 5. An already-correct series must not force a rebuild.
assert.equal(healClosedCandleOhlc(baked.map((b) => ({ ...b })), baked, liveEdge), null);

// 6. A bar the vendor has no view of yet is left exactly as the stream built it.
{
  const extra = { ...bar(30, 20_050, 20_050, 20_050, 20_050), timestamp: NOW + MIN };
  const held = [...baked.map((b) => ({ ...b })), extra];
  assert.equal(healClosedCandleOhlc(held, baked, liveEdge), null);
}

rmSync(outDir, { recursive: true, force: true });
console.log("candle OHLC heal: 6/6 checks passed");
