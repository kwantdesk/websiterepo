import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPLAY_PERIOD_LADDER,
  earliestReplaySessionDate,
  periodReaches,
  replayPeriodForSession,
} from "../src/lib/replayHistoryRange.ts";

/**
 * Replay reveals the candles a pane has already loaded. Pick a session outside
 * that window and there is nothing to reveal, however far the slider is
 * dragged — so choosing a date has to widen the range to reach it.
 */
const now = Date.parse("2026-08-22T12:00:00.000Z");
const daysAgo = (days) => new Date(now - days * 24 * 60 * 60_000).toISOString().slice(0, 10);

// --- the shortest range that reaches the session ---
{
  // Yesterday needs nothing more than the default window.
  assert.equal(replayPeriodForSession(daysAgo(1), now), "5D");
  assert.equal(replayPeriodForSession(daysAgo(6), now), "5D");
  // Past the default window it steps up one rung at a time rather than
  // jumping to four years.
  assert.equal(replayPeriodForSession(daysAgo(20), now), "1M");
  assert.equal(replayPeriodForSession(daysAgo(60), now), "3M");
  assert.equal(replayPeriodForSession(daysAgo(150), now), "6M");
  assert.equal(replayPeriodForSession(daysAgo(300), now), "1Y");
  assert.equal(replayPeriodForSession(daysAgo(900), now), "All");
  // Beyond the deepest range it still asks for the deepest rather than null,
  // so the pane fetches what it can instead of silently doing nothing.
  assert.equal(replayPeriodForSession(daysAgo(5_000), now), "All");
  assert.equal(replayPeriodForSession("not-a-date", now), null);
}

// --- headroom: the replayed session is never the first row loaded ---
{
  // A session exactly at the edge of a range must step up, so the profiles and
  // levels behind it have bars to build on.
  const edge = REPLAY_PERIOD_LADDER[0].days;
  assert.equal(replayPeriodForSession(daysAgo(edge), now), "1M",
    "a session at the very edge of the window must widen past it");
  assert.equal(replayPeriodForSession(daysAgo(edge - 4), now), "5D");
}

// --- a pane already loaded deeper is left alone ---
{
  assert.equal(periodReaches("1Y", "1M"), true);
  assert.equal(periodReaches("All", "5D"), true);
  assert.equal(periodReaches("5D", "5D"), true);
  assert.equal(periodReaches("1M", "1Y"), false, "a shallower range must be widened");
  // An unknown range makes no claim about its depth. Widening costs a fetch;
  // leaving it short costs the trader an empty replay.
  assert.equal(periodReaches("1W", "1M"), false);
  assert.equal(periodReaches("", "5D"), false);
}

// --- the picker's floor matches the deepest range ---
{
  const earliest = earliestReplaySessionDate(now);
  assert.equal(earliest, daysAgo(4 * 365));
  assert.equal(replayPeriodForSession(earliest, now), "All",
    "the oldest offered session must be reachable by the deepest range");
}

// --- the workspace actually applies it, and the picker is the desk's own ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /applyReplayHistoryRange\(sessionDate\)/,
    "choosing a replay date must widen the loaded history");
  assert.match(workspace, /periodReaches\(pane\.period, required\)/,
    "panes already deep enough must be left alone");
  // The native control is a system popover with system fonts on a dark
  // cockpit; the replay bar uses the desk's own picker.
  assert.ok(
    !workspace.includes('type="date"\n                    value={gexVueReplay.sessionDate}'),
    "the replay date must not use the browser's native picker",
  );
  assert.match(workspace, /<KwantDatePicker/);
  // On the Charts workspace the bar must not call itself GEX.
  assert.match(workspace, /chartWorkspaceScope === "gamma" \? "GEX Replay" : "Chart Replay"/);
}

console.log("Replay history range tests passed.");
