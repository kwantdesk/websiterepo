import assert from "node:assert/strict";

import {
  DEFAULT_SESSION_FILTER,
  RTH_END_MINUTES,
  RTH_START_MINUTES,
  exchangeMinuteOfDay,
  isWithinSessionSegments,
  resolveSessionSegments,
  sessionTradingDate,
} from "../src/lib/volumeProfileSessions.ts";

/**
 * Filter/Split Time parity with DeepChart's DP: DeltaVol tab.
 *
 * Fixtures are pinned to a mid-August date so Chicago is on CDT (UTC-5).
 * 08:30 Chicago is therefore 13:30Z and 15:15 Chicago is 20:15Z.
 */

const chicago = (isoUtc) => Date.parse(isoUtc);
const DAY_START = chicago("2026-08-18T00:00:00Z");
const DAY_END = chicago("2026-08-21T00:00:00Z");

// --- exchange-local minute conversion ---
{
  assert.equal(exchangeMinuteOfDay(chicago("2026-08-19T13:30:00Z")), RTH_START_MINUTES, "13:30Z is the 08:30 cash open");
  assert.equal(exchangeMinuteOfDay(chicago("2026-08-19T20:15:00Z")), RTH_END_MINUTES, "20:15Z is the 15:15 close");
  assert.equal(exchangeMinuteOfDay(chicago("2026-08-19T05:00:00Z")), 0, "05:00Z is exchange midnight");
}

// --- mode "none" takes everything, with no windows allocated ---
{
  const segments = resolveSessionSegments(DAY_START, DAY_END, DEFAULT_SESSION_FILTER);
  assert.deepEqual(segments, [], "no filtering allocates no windows");
  assert.equal(isWithinSessionSegments(DAY_START, segments), true, "an empty window set accepts every execution");
}

// --- RTH filtering keeps the cash session only ---
{
  const segments = resolveSessionSegments(DAY_START, DAY_END, {
    ...DEFAULT_SESSION_FILTER, mode: "filter", window: "rth",
  });
  assert.ok(segments.length >= 3, "one RTH window per trading day in range");
  assert.ok(segments.every((s) => s.id === "rth"));

  const inside = chicago("2026-08-19T14:00:00Z");   // 09:00 Chicago
  const before = chicago("2026-08-19T12:00:00Z");   // 07:00 Chicago
  const after = chicago("2026-08-19T21:00:00Z");    // 16:00 Chicago
  assert.equal(isWithinSessionSegments(inside, segments), true, "09:00 Chicago is inside RTH");
  assert.equal(isWithinSessionSegments(before, segments), false, "07:00 Chicago is pre-market");
  assert.equal(isWithinSessionSegments(after, segments), false, "16:00 Chicago is post-close");

  // Boundaries: open is inclusive, close is exclusive.
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T13:30:00Z"), segments), true, "the open bar is included");
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T20:15:00Z"), segments), false, "the close is exclusive");
}

// --- overnight window is the complement a desk actually trades ---
{
  const segments = resolveSessionSegments(DAY_START, DAY_END, {
    ...DEFAULT_SESSION_FILTER, mode: "filter", window: "eth",
  });
  assert.ok(segments.every((s) => s.id === "eth"));
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T23:00:00Z"), segments), true, "18:00 Chicago is overnight");
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T08:00:00Z"), segments), true, "03:00 Chicago is overnight");
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T15:00:00Z"), segments), false, "10:00 Chicago is not overnight");
}

// --- triple split produces Asia / London / New York, non-overlapping ---
{
  const segments = resolveSessionSegments(DAY_START, DAY_END, {
    ...DEFAULT_SESSION_FILTER, mode: "triple",
  });
  const ids = new Set(segments.map((s) => s.id));
  assert.deepEqual([...ids].sort(), ["asia", "london", "newyork"], "all three sessions are produced");

  for (const segment of segments) {
    assert.ok(segment.endMs > segment.startMs, `${segment.id} window has positive length`);
  }
  // Sorted and non-overlapping.
  for (let index = 1; index < segments.length; index += 1) {
    assert.ok(
      segments[index].startMs >= segments[index - 1].endMs,
      `${segments[index].id} must not overlap ${segments[index - 1].id}`,
    );
  }

  // A New York print lands in the New York window, not Asia's.
  const nyPrint = chicago("2026-08-19T15:00:00Z"); // 10:00 Chicago
  const owning = segments.filter((s) => nyPrint >= s.startMs && nyPrint < s.endMs);
  assert.equal(owning.length, 1, "an execution belongs to exactly one session");
  assert.equal(owning[0].id, "newyork");

  const asiaPrint = chicago("2026-08-19T23:30:00Z"); // 18:30 Chicago
  const asiaOwner = segments.filter((s) => asiaPrint >= s.startMs && asiaPrint < s.endMs);
  assert.equal(asiaOwner[0]?.id, "asia", "an 18:30 print is Asia");
}

// --- custom windows, including one that runs past midnight ---
{
  const daytime = resolveSessionSegments(DAY_START, DAY_END, {
    ...DEFAULT_SESSION_FILTER, mode: "filter", window: "custom",
    customStartMinutes: 9 * 60, customEndMinutes: 11 * 60,
  });
  assert.ok(daytime.every((s) => s.id === "custom"));
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T15:00:00Z"), daytime), true, "10:00 Chicago is inside 09:00-11:00");
  assert.equal(isWithinSessionSegments(chicago("2026-08-19T17:00:00Z"), daytime), false, "12:00 Chicago is outside");

  // 22:00 -> 02:00 wraps midnight and must not collapse to an empty window.
  const overnight = resolveSessionSegments(DAY_START, DAY_END, {
    ...DEFAULT_SESSION_FILTER, mode: "filter", window: "custom",
    customStartMinutes: 22 * 60, customEndMinutes: 2 * 60,
  });
  assert.ok(overnight.length > 0, "a wrapping window still produces segments");
  assert.ok(overnight.every((s) => s.endMs > s.startMs), "a wrapping window has positive length");
  assert.equal(isWithinSessionSegments(chicago("2026-08-20T04:00:00Z"), overnight), true, "23:00 Chicago is inside 22:00-02:00");
  assert.equal(isWithinSessionSegments(chicago("2026-08-20T06:00:00Z"), overnight), true, "01:00 Chicago is inside");
  assert.equal(isWithinSessionSegments(chicago("2026-08-20T09:00:00Z"), overnight), false, "04:00 Chicago is outside");
}

// --- trading-date attribution is what puts Asia on the right day ---
{
  const segments = resolveSessionSegments(
    chicago("2026-08-19T00:00:00Z"),
    chicago("2026-08-21T00:00:00Z"),
    { ...DEFAULT_SESSION_FILTER, mode: "triple" },
  );
  const asia = segments.find((s) => s.id === "asia");
  assert.ok(asia, "an Asia window exists");

  const startDay = sessionTradingDate(asia, false);
  const endDay = sessionTradingDate(asia, true);
  assert.match(startDay, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(
    startDay,
    endDay,
    "an Asia window that opens at 17:00 and runs past midnight reports a different date under each convention",
  );
}

// --- degenerate ranges are honest ---
{
  for (const [start, end] of [[DAY_END, DAY_START], [Number.NaN, DAY_END], [DAY_START, DAY_START]]) {
    assert.deepEqual(
      resolveSessionSegments(start, end, { ...DEFAULT_SESSION_FILTER, mode: "filter" }),
      [],
      "an impossible range produces no windows",
    );
  }
}

console.log("Volume profile session filtering (RTH, overnight, triple, custom) tests passed.");
