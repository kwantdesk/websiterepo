import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REPLAY_PERIOD_LADDER,
  earliestGexVueReplaySessionDate,
  earliestReplaySessionDate,
  periodReaches,
  replayPeriodForSession,
} from "../src/lib/replayHistoryRange.ts";

/**
 * The period ladder is retained for ordinary chart-history selection. GEX VUE
 * replay now uses one exact exchange-session request instead of widening every
 * pane to a multi-month chart range before it can reveal the selected day.
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

// --- GEX VUE offers exactly the supported three-month synchronized archive ---
{
  assert.equal(earliestGexVueReplaySessionDate(now), daysAgo(90));
  assert.equal(replayPeriodForSession(earliestGexVueReplaySessionDate(now), now), "6M",
    "headroom at the oldest GEX session must still be loaded rather than clipped");
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

// --- replay hydrates one immutable exchange session, and the picker is native to GEX VUE ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const replayHistoryRange = useMemo<WorkspaceHistoricalRange \| null>/,
    "each replay pane must derive an explicit bounded history range");
  assert.match(workspace, /cmeSessionWindowForDate\(replaySessionDate\)/,
    "futures replay must request the selected CME session rather than months of bars");
  assert.match(workspace, /if \(replayHistoryRange\) \{/,
    "the exact replay loader must run before live history restoration");
  assert.match(workspace, /workspaceOrderFlowKey\(pane\.symbol, pane\.timeframe, replayHistoryRange\.key\)/,
    "historical executions must be isolated by replay session");
  assert.ok(
    !workspace.includes("applyReplayHistoryRange(normalizedSessionDate)"),
    "choosing a replay date must not force every pane to download a multi-month range",
  );
  assert.ok(
    !workspace.includes('gexVueReplay.active ? "5D" : pane.period'),
    "active replay must never force a historical pane back to five days",
  );
  // The native control is a system popover with system fonts on a dark
  // cockpit; the replay bar uses the desk's own picker.
  assert.ok(
    !workspace.includes('type="date"\n                    value={gexVueReplay.sessionDate}'),
    "the replay date must not use the browser's native picker",
  );
  assert.match(workspace, /<KwantDatePicker/);
  assert.match(workspace, /min=\{earliestGexVueReplaySessionDate\(\)\}/,
    "the synchronized options replay picker must be bounded to three months");
  assert.doesNotMatch(workspace, /Chart Replay/,
    "GEX replay must remain local to the independently saved GEX VUE workspace");

  // The control that starts replay is the control that leaves it, so it must
  // say which one it is about to do rather than reading "Replay" throughout.
  const exitLabels = workspace.match(/gexVueReplay\.active \? "Exit" : "Replay"/g) ?? [];
  assert.equal(exitLabels.length, 1,
    "the GEX VUE replay toggle must switch to Exit while active");
  const exitIcons = workspace.match(/gexVueReplay\.active \? <X className/g) ?? [];
  assert.equal(exitIcons.length, 1, "the GEX VUE icon must switch with the label");
}

console.log("Replay history range tests passed.");
