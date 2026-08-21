import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const outDir = mkdtempSync(join(process.cwd(), ".bt-anchor-test-"));
const bundle = join(outDir, "bt.mjs");
execSync(
  `npx esbuild src/lib/bigTrades.ts --bundle --format=esm --platform=node --alias:@=./src --outfile="${bundle}"`,
  { stdio: "pipe" },
);
const { anchorBigTradePrintsToCandles } = await import(`file://${bundle.replaceAll("\\", "/")}`);

const MIN = 60_000;
const BAR = 5 * MIN;
const T0 = Date.parse("2026-08-19T13:30:00.000Z");

const candles = (count) => Array.from({ length: count }, (_, i) => ({
  timestamp: T0 + i * BAR,
  open: 20_000, high: 20_010, low: 19_990, close: 20_005, volume: 100,
}));
const print = (id, timestamp, price) => ({
  id, timestamp, price, volume: 50, executions: 1, side: "ASK", radius: 8, opacity: 1,
});

// 1. Every print lands in the bar its timestamp falls inside.
{
  const prints = [
    print("a", T0 + 30_000, 20_001),
    print("b", T0 + BAR + 10_000, 20_002),
    print("c", T0 + 3 * BAR + 4 * MIN, 20_003),
  ];
  const anchored = anchorBigTradePrintsToCandles(prints, candles(6), BAR);
  assert.deepEqual(anchored.map((p) => p.chartTimestamp), [T0, T0 + BAR, T0 + 3 * BAR]);
}

// 2. THE REPORTED BUG. The candle array a study holds is a throttled snapshot
//    of what the chart draws. Anchoring by walking that stale array pinned
//    later prints onto its final bar, while the marker kept the print's own
//    price — so it drew away from a candle it never traded in.
{
  const stale = candles(2);                      // snapshot stops at bar 1
  const fresh = candles(6);                      // chart is really at bar 5
  const late = print("late", T0 + 4 * BAR + MIN, 20_050);

  const walked = anchorBigTradePrintsToCandles([late], stale);      // no interval
  assert.equal(walked[0].chartTimestamp, T0 + BAR, "fixture must reproduce the stale pin");

  const bucketed = anchorBigTradePrintsToCandles([late], stale, BAR);
  assert.equal(
    bucketed[0].chartTimestamp,
    T0 + 4 * BAR,
    "a clock bucket must survive a stale snapshot",
  );
  assert.equal(
    bucketed[0].chartTimestamp,
    anchorBigTradePrintsToCandles([late], fresh, BAR)[0].chartTimestamp,
    "the stale and fresh series must agree",
  );
}

// 3. A print exactly on a boundary belongs to the bar it opens.
{
  const anchored = anchorBigTradePrintsToCandles([print("edge", T0 + 2 * BAR, 20_004)], candles(6), BAR);
  assert.equal(anchored[0].chartTimestamp, T0 + 2 * BAR);
}

// 4. Bar phase is honoured — a series that does not start on an epoch multiple
//    must not have its prints shifted half a bar.
{
  const offset = 137_000;
  const shifted = candles(6).map((c) => ({ ...c, timestamp: c.timestamp + offset }));
  const anchored = anchorBigTradePrintsToCandles(
    [print("p", T0 + offset + BAR + 1_000, 20_005)],
    shifted,
    BAR,
  );
  assert.equal(anchored[0].chartTimestamp, T0 + offset + BAR);
}

// 5. Prints older than the loaded history are dropped, not clamped onto bar 0.
{
  assert.equal(anchorBigTradePrintsToCandles([print("old", T0 - BAR, 20_000)], candles(6), BAR).length, 0);
}

// 6. Event bars have no fixed length, so they keep the bar walk.
{
  const eventBars = [
    { timestamp: T0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { timestamp: T0 + 7_000, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    { timestamp: T0 + 9_500, open: 1, high: 1, low: 1, close: 1, volume: 1 },
  ];
  const anchored = anchorBigTradePrintsToCandles([print("e", T0 + 8_000, 20_006)], eventBars, null);
  assert.equal(anchored[0].chartTimestamp, T0 + 7_000);
}

rmSync(outDir, { recursive: true, force: true });
console.log("big trades anchoring: 6/6 checks passed");
