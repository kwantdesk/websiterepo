import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { fillNoTradeCandleGaps, repairInstitutionalCandleSeries } from "../src/lib/institutionalMarketData.ts";

/**
 * A bar exists because a trade happened in its bucket.
 *
 * That is fine for ES, which trades every minute of the session, and wrong for
 * everything that does not. Measured against the live gateway on 2026-08-27,
 * gold held a 1m bar for 80% of its minutes where ES held 100% - 218 gaps of
 * two to seven minutes across a day and a half, which is the "missing candles
 * everywhere" the owner reported on MGC and GC.
 *
 * The damage is not only cosmetic. A 1m series whose bars are four minutes
 * apart misstates the time axis, so every study read off it - VWAP windows,
 * session anchors, indicator periods, initial balance - measures the wrong
 * span.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const bar = (minute, close, over = {}) => ({
  timestamp: minute * 60_000,
  open: close, high: close, low: close, close,
  volume: 10, trades: 2, bidVolume: 4, askVolume: 6, delta: 2,
  ...over,
});

check("a quiet bucket is drawn flat, and says it never traded", () => {
  const filled = fillNoTradeCandleGaps([bar(0, 100), bar(3, 101)], 60_000);
  assert.deepEqual(filled.map((row) => row.timestamp / 60_000), [0, 1, 2, 3]);
  // Flat at the PREVIOUS close: nothing traded, so nothing moved. Interpolating
  // toward the next bar would draw a price move that never happened.
  assert.deepEqual(filled.slice(1, 3).map((row) => [row.open, row.high, row.low, row.close]),
    [[100, 100, 100, 100], [100, 100, 100, 100]]);
  // And carries no flow at all, which is the field that tells a filled bar from
  // a real one - a volume profile or delta study must not see phantom size.
  for (const row of filled.slice(1, 3)) {
    assert.equal(row.volume, 0);
    assert.equal(row.trades, 0);
    assert.equal(row.bidVolume, 0);
    assert.equal(row.askVolume, 0);
    assert.equal(row.delta, 0);
  }
  // The real bars are untouched.
  assert.deepEqual(filled[0], bar(0, 100));
  assert.deepEqual(filled[3], bar(3, 101));
});

check("a session break stays a hole", () => {
  // THE LINE THIS MUST NOT CROSS. The CME daily halt is an hour in which the
  // market was CLOSED. Drawing sixty flat bars across it is not "price did not
  // move", it is a claim that the instrument was open and quiet.
  const filled = fillNoTradeCandleGaps([bar(0, 100), bar(61, 105)], 60_000);
  assert.equal(filled.length, 2, "an hour-long gap is never filled");
  // The boundary holds at thirty minutes either side of it: a 30-minute span
  // draws the 29 buckets between its two real bars.
  assert.equal(fillNoTradeCandleGaps([bar(0, 100), bar(30, 100)], 60_000).length, 31);
  assert.equal(fillNoTradeCandleGaps([bar(0, 100), bar(31, 100)], 60_000).length, 2);
});

check("nothing is drawn outside the real series", () => {
  // A hole between two bars is a quiet market. Before the first bar or after
  // the last there is no such fact - only the end of what we have.
  const rows = [bar(10, 100), bar(12, 101)];
  const filled = fillNoTradeCandleGaps(rows, 60_000);
  assert.equal(filled[0].timestamp, rows[0].timestamp);
  assert.equal(filled.at(-1).timestamp, rows.at(-1).timestamp);
  // Degenerate input passes straight through rather than looping.
  assert.deepEqual(fillNoTradeCandleGaps([bar(1, 1)], 60_000), [bar(1, 1)]);
  assert.deepEqual(fillNoTradeCandleGaps([], 60_000), []);
  assert.deepEqual(fillNoTradeCandleGaps(rows, 0), rows);
  assert.deepEqual(fillNoTradeCandleGaps(rows, Number.NaN), rows);
});

check("the integrity repair never invents a candle or rewrites a wick", () => {
  // Missing buckets are operational evidence. They remain visible so an
  // outage cannot be concealed by plausible-looking zero-volume candles.
  const rows = [bar(0, 100), bar(9, 101)];
  assert.deepEqual(repairInstitutionalCandleSeries(rows, "1m", "GC"), rows);
  assert.deepEqual(repairInstitutionalCandleSeries(rows, "10r", "GC"), rows);
  const wick = bar(10, 100, { high: 125, low: 80 });
  assert.deepEqual(repairInstitutionalCandleSeries([wick], "40r", "NQ"), [wick]);
});

const LIVE = fileURLToPath(new URL("../tmp/gold-1m-live-2026-08-27.json", import.meta.url));
if (existsSync(LIVE)) {
  check("the live gold series comes out continuous, halts excepted", () => {
    const raw = JSON.parse(readFileSync(LIVE, "utf8")).candles;
    const field = "time" in raw[0] ? "time" : "timestamp";
    const rows = raw.map((row) => ({
      ...row,
      timestamp: row[field] < 1e11 ? row[field] * 1000 : row[field],
    }));
    const steps = (series) => {
      const seen = new Set();
      for (let index = 1; index < series.length; index += 1) {
        seen.add((series[index].timestamp - series[index - 1].timestamp) / 60_000);
      }
      return [...seen].sort((left, right) => left - right);
    };
    assert.ok(steps(rows).length > 5, "the captured series is the gappy one");
    const filled = fillNoTradeCandleGaps(rows, 60_000);
    // Every step is now one minute, except the two session halts.
    assert.deepEqual(steps(filled), [1, 61]);
    assert.equal(filled.filter((row) => row.volume === 0).length, filled.length - rows.length);
  });
} else {
  console.log("  --  live gold capture not in this working tree; synthetic checks only");
}

console.log(`\ncandle gap fill: ${passed}/${passed} checks passed`);
