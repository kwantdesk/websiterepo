import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cmeSessionDateKey } from "../src/lib/chartHistoryWindow.ts";

/**
 * Caching the trading date per minute is only sound because the CME session
 * boundary lands on an exact minute. These cases pin that, and pin the
 * weekend rules, so the cache can never be blamed for a wrong session.
 */
const chicago = (iso) => Date.parse(iso);

// --- the 17:00 Chicago boundary, to the millisecond ---
{
  // 2026-08-20 is a Thursday. CDT = UTC-5, so 17:00 Chicago is 22:00Z.
  assert.equal(cmeSessionDateKey(chicago("2026-08-20T21:59:59.999Z")), "2026-08-20");
  assert.equal(cmeSessionDateKey(chicago("2026-08-20T22:00:00.000Z")), "2026-08-21",
    "17:00 Chicago opens the next trading date");
  // Every timestamp inside one minute must agree — the cache's whole premise.
  const base = chicago("2026-08-20T22:00:00.000Z");
  for (const offset of [0, 1, 250, 30_000, 59_999]) {
    assert.equal(cmeSessionDateKey(base + offset), "2026-08-21");
  }
  for (const offset of [0, 1, 250, 30_000, 59_999]) {
    assert.equal(cmeSessionDateKey(base - 60_000 + offset), "2026-08-20");
  }
}

// --- weekends have no trading date ---
{
  // Friday close (16:00 Chicago Friday) through Sunday reopen stays Friday.
  assert.equal(cmeSessionDateKey(chicago("2026-08-21T20:00:00.000Z")), "2026-08-21", "Friday session");
  assert.equal(cmeSessionDateKey(chicago("2026-08-22T12:00:00.000Z")), "2026-08-21",
    "Saturday keeps the last completed Friday session");
  assert.equal(cmeSessionDateKey(chicago("2026-08-23T12:00:00.000Z")), "2026-08-21",
    "Sunday before the reopen keeps Friday");
  assert.equal(cmeSessionDateKey(chicago("2026-08-23T22:00:00.000Z")), "2026-08-24",
    "Sunday 17:00 Chicago opens Monday");
}

// --- the cache must survive a DST shift, where the UTC offset moves ---
{
  // US DST ends 2026-11-01. Before: CDT (UTC-5), after: CST (UTC-6), so the
  // 17:00 boundary moves from 22:00Z to 23:00Z. A cache keyed on wall-clock
  // assumptions rather than the resolved answer would break here.
  // 2026-10-28 is a Wednesday, so the weekend rule stays out of the way.
  assert.equal(cmeSessionDateKey(chicago("2026-10-28T21:59:59.999Z")), "2026-10-28", "CDT, before 17:00");
  assert.equal(cmeSessionDateKey(chicago("2026-10-28T22:00:00.000Z")), "2026-10-29", "CDT boundary is 22:00Z");
  assert.equal(cmeSessionDateKey(chicago("2026-11-03T22:59:59.999Z")), "2026-11-03", "CST, before 17:00");
  assert.equal(cmeSessionDateKey(chicago("2026-11-03T23:00:00.000Z")), "2026-11-04", "CST boundary");
}

// --- repeated resolution is stable, and bad input stays null ---
{
  const stamp = chicago("2026-08-20T15:00:00.000Z");
  const first = cmeSessionDateKey(stamp);
  for (let i = 0; i < 5_000; i += 1) {
    assert.equal(cmeSessionDateKey(stamp), first, "a cached answer never drifts");
  }
  assert.equal(cmeSessionDateKey(Number.NaN), null);
  assert.equal(cmeSessionDateKey(Number.POSITIVE_INFINITY), null);
}

// --- the cache is bounded ---
{
  const source = readFileSync(new URL("../src/lib/chartHistoryWindow.ts", import.meta.url), "utf8");
  assert.match(source, /SESSION_DATE_KEY_CACHE_LIMIT/, "the cache must be bounded");
  assert.match(source, /sessionDateKeyByMinute\.delete\(oldest\)/, "and must evict");
  // A resolved null is a real answer; treating it as absent would recompute
  // the expensive path forever.
  assert.match(source, /if \(cached !== undefined\) return cached;/);
}

console.log("CME session-date cache tests passed.");
