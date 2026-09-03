import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { fillNoTradeCandleGaps, repairInstitutionalCandleSeries } =
  await import("../src/lib/institutionalMarketData.ts");
const { futuresTickSize } = await import("../src/lib/eventBars.ts");

/**
 * The minutes an instrument did not trade in.
 *
 * A bar exists because a trade landed in its bucket, so gold - which does not
 * print every minute - carried holes all the way to the renderer: a 1m series
 * whose bars sit four minutes apart misstates the time axis, and every study
 * read off it measures the wrong span.
 *
 * The fill for this was written, bounded and measured, and then reached
 * nothing: its only callers were two cache helpers that nothing outside their
 * own file ever called. These checks cover the fill itself AND the seam, so it
 * cannot go quiet again without failing here.
 */

const MINUTE = 60_000;
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const bar = (minute, close) => ({
  timestamp: minute * MINUTE,
  open: close, high: close, low: close, close,
  volume: 10, trades: 2, bidVolume: 5, askVolume: 5, delta: 0,
});

check("a suffixed gold contract carries gold's tick, not the default", () => {
  /*
   * The copy this replaced read the whole symbol as its root, so "GC.c.0"
   * uppercased to "GC.C.0", missed the "GC" list and fell through to 0.01 - a
   * tenth of gold's real tick. Every symbol the platform actually requests
   * carries a suffix, so the table only ever answered for symbols nobody asked
   * about.
   */
  assert.equal(futuresTickSize("GC.c.0"), 0.1);
  assert.equal(futuresTickSize("MGC.c.0"), 0.1);
  assert.equal(futuresTickSize("GCZ5"), 0.1);
  assert.equal(futuresTickSize("NQ.c.0"), 0.25);
  // And instruments the old table did not know at all.
  assert.equal(futuresTickSize("HG.c.0"), 0.0005);
  assert.equal(futuresTickSize("ZN.c.0"), 1 / 64);
});

check("a quiet minute is drawn flat, and says so", () => {
  const filled = fillNoTradeCandleGaps([bar(0, 100), bar(3, 101)], MINUTE);
  assert.equal(filled.length, 4, "the two missing minutes were not drawn");
  const [, first, second] = filled;
  for (const quiet of [first, second]) {
    // Flat at the previous close: the price did not move because nothing
    // changed hands. Zero volume is the field that distinguishes it from a
    // real bar - without that it would be an invented print.
    assert.equal(quiet.open, 100);
    assert.equal(quiet.close, 100);
    assert.equal(quiet.high, 100);
    assert.equal(quiet.low, 100);
    assert.equal(quiet.volume, 0);
    assert.equal(quiet.trades, 0);
    assert.equal(quiet.delta, 0);
  }
  assert.deepEqual(filled.map((c) => c.timestamp / MINUTE), [0, 1, 2, 3]);
});

check("the CME halt stays a hole", () => {
  /*
   * Sixty-one minutes is the daily maintenance break. The market was CLOSED,
   * and an hour of flat bars across it is a different claim entirely from "no
   * one traded this minute".
   */
  const across = fillNoTradeCandleGaps([bar(0, 100), bar(61, 101)], MINUTE);
  assert.equal(across.length, 2, "the daily halt was filled in");
  // A weekend is the same argument, several hundred times over.
  assert.equal(fillNoTradeCandleGaps([bar(0, 100), bar(4000, 101)], MINUTE).length, 2);
});

check("nothing is drawn outside the real bars", () => {
  // A series ending is not a statement that the instrument went quiet.
  const filled = fillNoTradeCandleGaps([bar(10, 100), bar(12, 101)], MINUTE);
  assert.equal(filled[0].timestamp, 10 * MINUTE, "a bar was invented before the first");
  assert.equal(filled.at(-1).timestamp, 12 * MINUTE, "a bar was invented after the last");
});

check("an untouched series comes back untouched", () => {
  const contiguous = [bar(0, 100), bar(1, 101), bar(2, 102)];
  assert.deepEqual(fillNoTradeCandleGaps(contiguous, MINUTE), contiguous, "a gapless series gained bars");
  assert.equal(fillNoTradeCandleGaps([bar(0, 100)], MINUTE).length, 1);
});

check("bars that are not on a clock are never filled", () => {
  /*
   * A range or volume bar closes on trade activity, not on time, so there is no
   * bucket that can be missing - only a time-bucketed series can have a hole.
   */
  const uneven = [bar(0, 100), bar(7, 101), bar(30, 102)];
  for (const timeframe of ["1000v", "500t", "10r", "2000dv"]) {
    const out = repairInstitutionalCandleSeries(uneven, timeframe, "GC.c.0");
    assert.equal(out.length, uneven.length, `${timeframe} gained invented bars`);
  }
  assert.deepEqual(
    repairInstitutionalCandleSeries(uneven, "1m", "GC.c.0"),
    uneven,
    "the integrity seam concealed a missing time bucket",
  );
});

check("the fill is reached from the seam every candle passes through", () => {
  /*
   * The whole defect was correct code with no caller. Asserting the wiring is
   * the point of this check - the maths above passed the entire time gold was
   * drawing holes.
   */
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  assert.match(
    workspace,
    /function sanitizeCandles\(candles: Candle\[\], symbol: string, timeframe\?: string\)/,
    "sanitizeCandles no longer accepts a timeframe",
  );
  assert.match(
    workspace,
    /return timeframe \? repairInstitutionalCandleSeries\(cleanCandles, timeframe, symbol\) : cleanCandles;/,
    "sanitizeCandles no longer validates through the integrity seam",
  );
  // And the history paths must actually hand it one.
  const calls = workspace.match(/sanitizeCandles\(/g) ?? [];
  const withTimeframe = workspace.match(/(pane\.timeframe|selectedTimeframe|, symbol, timeframe|^ *timeframe,$)/gm) ?? [];
  assert.ok(calls.length >= 20, `expected the workspace's many candle paths, saw ${calls.length}`);
  assert.ok(withTimeframe.length > 0, "no caller passes a timeframe");
});

console.log(`\ncandle gaps: ${passed}/${passed} checks passed`);
