import assert from "node:assert/strict";
import {
  REPLAY_EVENT_FLOW_WINDOW_MS,
  replayEventFlowWindow,
  sliceReplayExecutionWindow,
} from "../src/lib/replayExecutionWindow.ts";

/**
 * A replay's order-flow tape has to cover the session being replayed.
 *
 * The backtest loads candles for [session - 5 days, session + 1 day] so the
 * volume profiles behind the cursor have history. The event history then took
 * its six-hour flow window from the END of that span, which sits most of a day
 * AFTER playback begins — so footprint, CVD and big trades were empty through
 * the entire replayed session and only appeared near the very end.
 */
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const play = Date.UTC(2026, 7, 12, 13, 30);      // 09:30 New York, the open
const requestedStart = play - 5 * DAY;            // five sessions of candles
const executionEnd = play + DAY;                  // a day past the session

// --- live charts keep the trailing window they always had ---
{
  const live = replayEventFlowWindow({
    requestedStart,
    executionEnd,
    trailingLookbackMs: 6 * HOUR,
  });
  assert.equal(live.end, executionEnd, "a live chart still ends at the request");
  assert.equal(live.start, executionEnd - 6 * HOUR, "and still looks six hours back");
  // An explicitly absent anchor must behave identically — the replay path is
  // opt-in, never something a live request falls into.
  for (const anchorMs of [undefined, null, 0, Number.NaN]) {
    assert.deepEqual(
      replayEventFlowWindow({ requestedStart, executionEnd, anchorMs, trailingLookbackMs: 6 * HOUR }),
      live,
      `anchor ${String(anchorMs)} must not switch to the replay window`,
    );
  }
}

// --- a replay covers forward from the moment play is pressed ---
{
  const replay = replayEventFlowWindow({
    requestedStart,
    executionEnd,
    anchorMs: play,
    trailingLookbackMs: 6 * HOUR,
  });
  assert.equal(replay.start, play, "the tape begins where playback begins");
  assert.ok(replay.start <= play && replay.end > play, "the cursor sits inside the window");
  // This is the whole point: the old behaviour did NOT contain the open.
  const old = replayEventFlowWindow({ requestedStart, executionEnd, trailingLookbackMs: 6 * HOUR });
  assert.ok(old.start > play, "the trailing window really did start after the open");
}

// --- a full RTH session fits ---
{
  const replay = replayEventFlowWindow({
    requestedStart, executionEnd, anchorMs: play, trailingLookbackMs: 6 * HOUR,
  });
  const rthClose = Date.UTC(2026, 7, 12, 20, 0); // 16:00 New York
  assert.ok(replay.end >= rthClose, "the window must reach the RTH close");
  assert.equal(replay.end - replay.start, REPLAY_EVENT_FLOW_WINDOW_MS);
  // And stays inside the 30,000 one-second buckets the history keeps.
  assert.ok((replay.end - replay.start) / 1_000 <= 30_000, "must fit the flow bucket cap");
}

// --- the window never runs past the archive edge the caller resolved ---
{
  const nearEdge = play + 2 * HOUR;
  const clipped = replayEventFlowWindow({
    requestedStart, executionEnd: nearEdge, anchorMs: play, trailingLookbackMs: 6 * HOUR,
  });
  assert.equal(clipped.end, nearEdge, "never ask beyond the resolved end");
  assert.equal(clipped.start, play);
}

// --- an anchor before the fetched window is pulled forward, not honoured ---
{
  const early = replayEventFlowWindow({
    requestedStart, executionEnd, anchorMs: requestedStart - DAY, trailingLookbackMs: 6 * HOUR,
  });
  assert.equal(early.start, requestedStart, "cannot request data the fetch never covered");
}

// --- degenerate windows return null rather than an inverted range ---
{
  assert.equal(
    replayEventFlowWindow({
      requestedStart: play, executionEnd: play, anchorMs: play, trailingLookbackMs: 6 * HOUR,
    }),
    null,
  );
  assert.equal(
    replayEventFlowWindow({
      requestedStart: Number.NaN, executionEnd, trailingLookbackMs: 6 * HOUR,
    }),
    null,
  );
}

// --- the browser-side slice still clips to the clock ---
{
  const tape = Array.from({ length: 9 }, (_, index) => ({ timestamp: play + index * HOUR }));
  const visible = sliceReplayExecutionWindow(tape, play + 3 * HOUR, DAY);
  assert.equal(visible.length, 4, "prints after the clock stay hidden");
  assert.equal(visible.at(-1).timestamp, play + 3 * HOUR);
}

console.log("Replay event flow window tests passed.");
