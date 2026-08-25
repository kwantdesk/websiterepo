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
  const late = print("late", T0 + 4 * BAR + MIN, 20_005);

  // 20,050 is above every bar's high, so no bar in the snapshot is the one it
  // traded in. The walk used to pin it to the snapshot's last bar anyway and
  // the marker kept its own price, which is the print seen hanging in space.
  // It is withheld until the series carries a bar it fits.
  const walked = anchorBigTradePrintsToCandles(
    [print("away", T0 + 4 * BAR + MIN, 20_050)], stale,
  );                                                               // no interval
  assert.deepEqual(walked, [], "a print that fits no bar in the snapshot must not be drawn");

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
  const bar = (timestamp) => ({ timestamp, open: 20_000, high: 20_010, low: 19_990, close: 20_005, volume: 1 });
  const eventBars = [bar(T0), bar(T0 + 7_000), bar(T0 + 9_500)];
  const anchored = anchorBigTradePrintsToCandles([print("e", T0 + 8_000, 20_006)], eventBars, null);
  assert.equal(anchored[0].chartTimestamp, T0 + 7_000);
}

// 7. A volume/range/tick chart has no clock to fall back on, so its prints
//    ride the stale walk. The price is what catches it: a print that did not
//    trade in the bar it landed on is withheld, and draws as soon as the
//    series carries the bar it belongs to.
{
  const bar = (timestamp, low, high) => ({ timestamp, open: low, high, low, close: high, volume: 200 });
  const stale = [bar(T0, 19_990, 20_010), bar(T0 + 7_000, 19_995, 20_015)];
  const traded = print("v", T0 + 30_000, 20_120);

  assert.deepEqual(
    anchorBigTradePrintsToCandles([traded], stale, null), [],
    "a 200-volume print that fits no loaded bar must not be drawn at a price the chart never visited",
  );

  const caughtUp = [...stale, bar(T0 + 20_000, 20_100, 20_130)];
  const anchored = anchorBigTradePrintsToCandles([traded], caughtUp, null);
  assert.equal(anchored.length, 1, "it must draw once its own bar is loaded");
  assert.equal(anchored[0].chartTimestamp, T0 + 20_000);
  assert.equal(anchored[0].price, 20_120, "and keep its real price");
}

// 8. Withholding must not swallow ordinary prints. A clustered print carries a
//    volume-weighted average price, which can sit a hair off the bar's own
//    high or low, and those still belong.
{
  const bars = [{ timestamp: T0, open: 20_000, high: 20_010, low: 19_990, close: 20_005, volume: 200 }];
  for (const price of [19_990, 20_010, 20_000, 20_010.01, 19_989.99]) {
    assert.equal(
      anchorBigTradePrintsToCandles([print(`p${price}`, T0 + 1_000, price)], bars, null).length,
      1,
      `${price} sits in the bar and must still draw`,
    );
  }
  // Whole handles away is a different bar, not rounding.
  assert.equal(
    anchorBigTradePrintsToCandles([print("far", T0 + 1_000, 20_050)], bars, null).length, 0,
  );
}

// 9. On a clock chart the bucket is arithmetic, so the newest bar is exempt
//    from the price check: it is still filling and its high and low arrive
//    from the same tape as the print. Withholding there would blink markers
//    on and off at the live edge. A CLOSED bar gets no such benefit.
{
  const series = candles(3);
  const forming = print("forming", T0 + 2 * BAR + MIN, 20_400);
  assert.equal(
    anchorBigTradePrintsToCandles([forming], series, BAR).length, 1,
    "a print on the forming bar draws before the candle stretches to meet it",
  );
  const closed = print("closed", T0 + MIN, 20_400);
  assert.equal(
    anchorBigTradePrintsToCandles([closed], series, BAR).length, 0,
    "a closed bar's high and low are final, so a print outside one is wrong",
  );
}

rmSync(outDir, { recursive: true, force: true });
console.log("big trades anchoring: 9/9 checks passed");
