import assert from "node:assert/strict";
import { groupByNewYorkDate, newYorkDateKey } from "../src/lib/newYorkTradingDay.ts";

/**
 * Grouping candles by trading date called Intl.DateTimeFormat.format once per
 * candle, inside an effect that re-ran on every live candle commit. The cache
 * is only safe because New York is a whole number of hours from UTC, so these
 * checks pin that the cached answer is IDENTICAL to formatting each timestamp
 * - including across a daylight-saving change, which is where an hour-bucket
 * assumption would break if the offset were ever fractional.
 */

const reference = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("it agrees with formatting every timestamp, minute by minute for a week", () => {
  // A full week at one-minute resolution: 10,080 timestamps, the size of the
  // candle array the effect was formatting.
  const start = Date.UTC(2026, 7, 17, 0, 0, 0);
  for (let minute = 0; minute < 10_080; minute += 1) {
    const at = start + minute * 60_000;
    assert.equal(newYorkDateKey(at), reference.format(at), `minute ${minute}`);
  }
});

check("it agrees across the spring daylight-saving change", () => {
  // 2026-03-08: New York goes from UTC-5 to UTC-4 at 07:00 UTC.
  const start = Date.UTC(2026, 2, 7, 0, 0, 0);
  for (let minute = 0; minute < 3 * 1_440; minute += 1) {
    const at = start + minute * 60_000;
    assert.equal(newYorkDateKey(at), reference.format(at), `spring minute ${minute}`);
  }
});

check("it agrees across the autumn daylight-saving change", () => {
  // 2026-11-01: New York returns to UTC-5 at 06:00 UTC.
  const start = Date.UTC(2026, 9, 31, 0, 0, 0);
  for (let minute = 0; minute < 3 * 1_440; minute += 1) {
    const at = start + minute * 60_000;
    assert.equal(newYorkDateKey(at), reference.format(at), `autumn minute ${minute}`);
  }
});

check("a UTC evening is already the next day in London but still today in New York", () => {
  // The boundary that makes a naive UTC date wrong: 23:00 UTC is 19:00 or
  // 18:00 in New York, still the same trading date.
  assert.equal(newYorkDateKey(Date.UTC(2026, 7, 20, 23, 30)), "2026-08-20");
  // And just after midnight UTC it is still the PREVIOUS New York date.
  assert.equal(newYorkDateKey(Date.UTC(2026, 7, 21, 0, 30)), "2026-08-20");
});

check("grouping keeps input order inside each date", () => {
  const candles = [
    { timestamp: Date.UTC(2026, 7, 20, 14, 0), volume: 1 },
    { timestamp: Date.UTC(2026, 7, 20, 15, 0), volume: 2 },
    { timestamp: Date.UTC(2026, 7, 21, 14, 0), volume: 3 },
  ];
  const grouped = groupByNewYorkDate(candles, (candle) => candle.timestamp);
  assert.deepEqual([...grouped.keys()], ["2026-08-20", "2026-08-21"]);
  assert.deepEqual(grouped.get("2026-08-20").map((c) => c.volume), [1, 2]);
  assert.deepEqual(grouped.get("2026-08-21").map((c) => c.volume), [3]);
});

check("it is much cheaper than formatting each candle", () => {
  // The point of the change. A week of one-minute candles is 10,080 lookups
  // but only ~168 distinct hours.
  const start = Date.UTC(2026, 7, 17, 0, 0, 0);
  const stamps = Array.from({ length: 10_080 }, (_, i) => start + i * 60_000);

  const timeOf = (fn) => {
    let best = Infinity;
    for (let run = 0; run < 3; run += 1) {
      const began = process.hrtime.bigint();
      fn();
      best = Math.min(best, Number(process.hrtime.bigint() - began) / 1e6);
    }
    return best;
  };

  const cachedMs = timeOf(() => { for (const at of stamps) newYorkDateKey(at); });
  const rawMs = timeOf(() => { for (const at of stamps) reference.format(at); });
  assert.ok(
    cachedMs * 3 < rawMs,
    `cached ${cachedMs.toFixed(1)}ms vs per-candle ${rawMs.toFixed(1)}ms - not worth the cache`,
  );
  console.log(`      (${rawMs.toFixed(1)}ms per-candle -> ${cachedMs.toFixed(1)}ms cached, ` +
    `${(rawMs / cachedMs).toFixed(0)}x)`);
});

check("nonsense timestamps do not poison the cache", () => {
  assert.equal(newYorkDateKey(Number.NaN), "");
  assert.equal(newYorkDateKey(Infinity), "");
  assert.equal(newYorkDateKey(Date.UTC(2026, 7, 20, 14, 0)), "2026-08-20");
});

console.log(`\nnew york trading day: ${passed}/${passed} checks passed`);
