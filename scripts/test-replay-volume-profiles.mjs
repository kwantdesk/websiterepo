import assert from "node:assert/strict";
import { institutionalVolumeProfileRequest } from "../src/lib/institutionalMarketData.ts";
import { resolveVolumeProfileRange } from "../services/rithmic_gateway/src/trading-session.mjs";
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
    assert.ok(job.startMs < job.endMs && job.endMs <= cursor);
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
  assert.equal(window.startMs, at(5, 22), "it starts at the first session open");
  // Future candles cannot drag the start forward or the end past the cursor.
  const polluted = replayWeeklyProfileWindow([...candlesFor(WEEK), ...candlesFor([13])], cursor);
  assert.equal(polluted.endMs, cursor);
}

// --- the client request and gateway agree on the recorded session ---
{
  const day = "2026-11-05";
  const open = Date.UTC(2026, 10, 4, 23);
  const clock = Date.UTC(2026, 10, 5, 14, 30, 25);
  const job = replayProfileJobs([{ timestamp: open }], clock).at(-1);
  assert.equal(job.startMs, open);
  assert.equal(job.endMs, clock - 25_000, "exclude the archive's unfinished minute");
  for (const startMs of [undefined, job.startMs]) {
    const { query } = institutionalVolumeProfileRequest({
      symbol: "NQ", period: "daily", tradingDate: day, startMs, endMs: job.endMs,
    });
    assert.deepEqual(resolveVolumeProfileRange(query, clock), {
      tradingDate: day, startMs: open, endMs: job.endMs,
    });
  }
  assert.deepEqual(replayProfileJobs([{ timestamp: open }], open + 59_999), []);
  const windows = replayProfileJobs([{ timestamp: open }], clock, 1, {
    filterMode: "triple", sessionAsiaEnabled: true, sessionTokyoEnabled: false,
    sessionLondonEnabled: false, sessionNewYorkEnabled: true,
  });
  assert.deepEqual(windows.map(({ sessionId }) => sessionId), ["asia"],
    "New York has not had a completed minute at 08:30:25 Chicago");
  assert.equal(windows[0].startMs, open);
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
