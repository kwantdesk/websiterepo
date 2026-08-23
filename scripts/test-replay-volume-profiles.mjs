import assert from "node:assert/strict";
import {
  replayProfileJobs,
  replayProfileTradingDates,
  replayWeeklyProfileWindow,
  replayProfileWithinClock,
} from "../src/lib/replayVolumeProfiles.ts";


/**
 * A replay profile must never contain a print the trader has not reached.
 *
 * The gateway resolves a trading date to the COMPLETE archived session, so
 * asking it for "today" mid-replay hands back the close. Every job therefore
 * carries its own clock bound.
 */

// 14:00 UTC is 09:00 America/Chicago — safely inside the trading date.
const at = (day, hourUtc = 14) => Date.UTC(2026, 7, day, hourUtc, 0, 0);
const candlesFor = (days) => days.flatMap((day) =>
  [14, 15, 16, 17, 18, 19, 20].map((hour) => ({ timestamp: at(day, hour) })));

// Mon 10 Aug -> Wed 12 Aug 2026, cursor at 09:00 CT on the 12th.
const WEEK = [4, 5, 6, 7, 10, 11, 12];
const cursor = at(12, 14);

// --- the window is five sessions, not five calendar days ---
{
  const dates = replayProfileTradingDates(candlesFor(WEEK), cursor);
  assert.equal(dates.length, 5, "a volume-profile trader reads back five sessions");
  assert.deepEqual(dates, [...dates].sort(), "oldest first");
  assert.equal(dates.at(-1), "2026-08-12", "the cursor's own session is included");
  // The weekend is skipped by the candles themselves, so the five sessions
  // reach back to the 6th rather than stopping at the 8th.
  assert.equal(dates[0], "2026-08-06");
  // A shorter cap is honoured.
  assert.equal(replayProfileTradingDates(candlesFor(WEEK), cursor, 2).length, 2);
}

// --- the developing session is clipped, completed ones are not ---
{
  const jobs = replayProfileJobs(candlesFor(WEEK), cursor);
  const developing = jobs.filter((job) => !job.completed);
  assert.equal(developing.length, 1, "exactly one session is developing");
  assert.equal(developing[0].tradingDate, "2026-08-12");
  assert.equal(developing[0].endMs, cursor, "it must stop at the replay cursor");
  for (const job of jobs.filter((job) => job.completed)) {
    assert.equal(job.endMs, undefined, `${job.tradingDate} is wholly in the past`);
  }
}

// --- THE invariant: nothing may reach past the cursor ---
{
  // A candle array still holding the rest of the session (or the next one)
  // must not produce a job for it.
  const withFuture = [...candlesFor(WEEK), ...candlesFor([13, 14])];
  const jobs = replayProfileJobs(withFuture, cursor);
  for (const job of jobs) {
    assert.ok(job.tradingDate <= "2026-08-12", `${job.tradingDate} is after the cursor`);
    if (job.endMs !== undefined) {
      assert.ok(job.endMs <= cursor, "a clipped job may not end after the cursor");
    }
  }
  assert.ok(!jobs.some((job) => job.tradingDate === "2026-08-13"));
  // And they must be DROPPED BEFORE the five-session window is taken, or the
  // trader silently loses the oldest sessions to bars they cannot even see.
  assert.equal(jobs.length, 5, "post-cursor bars must not shrink the window");
  assert.deepEqual(
    jobs.map((job) => job.tradingDate),
    replayProfileJobs(candlesFor(WEEK), cursor).map((job) => job.tradingDate),
    "a polluted candle array yields the same sessions as a clean one",
  );
  // And late bars from the cursor's own session do not extend its job.
  const developing = jobs.find((job) => !job.completed);
  assert.equal(developing.endMs, cursor);
}

// --- the session at the open, before its first bar is committed ---
{
  // Cursor on the 12th but candles stop on the 11th: the developing session
  // must still exist, or the trader watches an empty profile at the open.
  const jobs = replayProfileJobs(candlesFor([6, 7, 10, 11]), cursor);
  const developing = jobs.find((job) => !job.completed);
  assert.ok(developing, "the cursor's session exists before its first bar");
  assert.equal(developing.tradingDate, "2026-08-12");
  assert.equal(developing.endMs, cursor);
}

// --- the weekly span ends at the cursor too ---
{
  const window = replayWeeklyProfileWindow(candlesFor(WEEK), cursor);
  assert.ok(window, "a weekly window is produced");
  assert.equal(window.endMs, cursor, "the weekly profile stops at the cursor");
  assert.ok(window.startMs < cursor);
  assert.ok(window.startMs >= at(6, 14) - 1, "it starts inside the five covered sessions");
  // Future candles cannot drag the start forward or the end past the cursor.
  const polluted = replayWeeklyProfileWindow([...candlesFor(WEEK), ...candlesFor([13])], cursor);
  assert.equal(polluted.endMs, cursor);
}

// --- a cached profile from a later cursor is rejected ---
{
  const close = at(12, 20);
  assert.equal(
    replayProfileWithinClock({ startMs: at(12, 13), endMs: close, coverageEndMs: close }, cursor),
    false,
    "a profile covering the afternoon must not paint at the open",
  );
  assert.equal(
    replayProfileWithinClock({ startMs: at(11, 13), endMs: at(11, 21), coverageEndMs: at(11, 21) }, cursor),
    true,
    "yesterday's completed session is safe",
  );
  assert.equal(replayProfileWithinClock(null, cursor), false);
  assert.equal(replayProfileWithinClock({ startMs: 1 }, cursor), false, "unknown coverage is not trusted");
}

// --- degenerate input never throws ---
{
  assert.deepEqual(replayProfileTradingDates([], cursor), []);
  assert.deepEqual(replayProfileJobs([], Number.NaN), []);
  assert.equal(replayWeeklyProfileWindow([], cursor), null);
}

console.log("Replay volume profile window tests passed.");
