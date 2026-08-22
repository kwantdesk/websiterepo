import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { zonedParts } from "../src/lib/tpo/engine.ts";

/**
 * zonedParts is cached per timezone and minute because it underpins the
 * period-boundary machinery and runs per trade — profiling put it at 88.6% of
 * a whole buildTpoProfiles call. The cache is only sound because every
 * timezone offset is a whole number of MINUTES, so within one minute
 * everything except the seconds is constant, and DST changes land on a minute
 * boundary and so cannot be straddled.
 *
 * These cases check the cached answer against Intl itself.
 */
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The uncached reference: exactly what the engine did before the cache. */
function reference(timestampMs, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    }).formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour) % 24, minute: Number(parts.minute),
    second: Number(parts.second), weekday: WEEKDAYS[parts.weekday],
  };
}

const check = (timestampMs, timeZone, why) => {
  const actual = zonedParts(timestampMs, timeZone);
  const expected = reference(timestampMs, timeZone);
  assert.deepEqual(
    { ...actual }, expected,
    `${why}: ${new Date(timestampMs).toISOString()} in ${timeZone}`,
  );
};

const ZONES = ["America/Chicago", "America/New_York", "UTC", "Europe/London", "Asia/Tokyo", "Australia/Sydney"];

// --- every second of several minutes, so the seconds patching is exercised ---
{
  const base = Date.parse("2026-08-21T13:30:00.000Z");
  for (const zone of ZONES) {
    for (let offset = 0; offset < 180; offset += 1) {
      check(base + offset * 1_000, zone, "second within a minute");
    }
    // Sub-second offsets must not shift anything either.
    for (const ms of [1, 250, 499, 500, 999]) check(base + ms, zone, "sub-second");
  }
}

// --- DST transitions, where a naive cache would smear an hour ---
{
  // US spring forward 2026-03-08 07:00Z, fall back 2026-11-01 06:00Z.
  // EU last Sunday of March/October. Southern hemisphere moves the other way.
  const moments = [
    "2026-03-08T06:58:30.000Z", "2026-03-08T06:59:59.999Z", "2026-03-08T07:00:00.000Z",
    "2026-03-08T07:00:00.001Z", "2026-03-08T07:01:30.000Z",
    "2026-11-01T05:59:59.999Z", "2026-11-01T06:00:00.000Z", "2026-11-01T06:30:00.000Z",
    "2026-03-29T00:59:59.999Z", "2026-03-29T01:00:00.000Z",
    "2026-10-04T15:59:59.999Z", "2026-10-04T16:00:00.000Z",
  ];
  for (const zone of ZONES) {
    for (const iso of moments) check(Date.parse(iso), zone, "DST boundary");
  }
}

// --- a long sweep, and repeated reads of the same instant ---
{
  const start = Date.parse("2026-08-17T22:00:00.000Z");
  for (const zone of ["America/Chicago", "Asia/Tokyo"]) {
    for (let minute = 0; minute < 60 * 24 * 5; minute += 37) {
      check(start + minute * 60_000 + (minute % 60) * 1_000, zone, "week sweep");
    }
    // A cached answer must never drift on re-read.
    const stamp = start + 12_345_678;
    const first = zonedParts(stamp, zone);
    for (let i = 0; i < 500; i += 1) {
      assert.deepEqual({ ...zonedParts(stamp, zone) }, { ...first }, "cached answer drifted");
    }
  }
}

// --- two zones must never share an entry ---
{
  const stamp = Date.parse("2026-08-21T18:00:00.000Z");
  const chicago = zonedParts(stamp, "America/Chicago");
  const tokyo = zonedParts(stamp, "Asia/Tokyo");
  assert.notEqual(chicago.hour, tokyo.hour, "the cache key must include the timezone");
  check(stamp, "America/Chicago", "after a second zone was read");
}

// --- the cache is bounded ---
{
  const engine = readFileSync(new URL("../src/lib/tpo/engine.ts", import.meta.url), "utf8");
  assert.match(engine, /ZONED_PARTS_CACHE_LIMIT/, "the cache must be bounded");
  assert.match(engine, /zonedPartsByMinute\.delete\(oldest\)/, "and must evict");
  assert.match(engine, /`\$\{timeZone\}:\$\{minute\}`/, "keyed by timezone and minute");
}

console.log("TPO zoned-parts cache tests passed.");
