import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolveSessionSegments, DESK_SESSIONS } =
  await import("../src/lib/volumeProfileSessions.ts");
const { cmeSessionDateKey } = await import("../src/lib/chartHistoryWindow.ts");

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * Selecting sessions filters the day; selecting none does not erase the study.
 *
 * With the split armed but every session unticked - reachable from a saved
 * workspace or from settings edited directly - the set of drawn session ids
 * was empty, so the prune removed every daily profile already on the chart
 * while no request was issued to replace them. The volume profiles simply
 * vanished, which reads as a broken study rather than as a choice.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const tradingDate = "2026-08-31";
const midnight = Date.parse(`${tradingDate}T00:00:00.000Z`);
const segmentsForDay = (mode) => resolveSessionSegments(
  midnight - 12 * 3_600_000,
  midnight + 36 * 3_600_000,
  { mode, window: "rth", customStartMinutes: 510, customEndMinutes: 900, useEndSessionAsStartDay: false },
);
const chicagoTradingDate = (ms) => cmeSessionDateKey(ms) ?? new Date(ms).toISOString().slice(0, 10);
const ownedByDay = (mode) => segmentsForDay(mode)
  .filter((segment) => chicagoTradingDate(segment.startMs) === tradingDate);

check("the three DeepChart sessions are the three the dialog offers", () => {
  assert.deepEqual(
    DESK_SESSIONS.map((session) => session.id),
    ["asia", "london", "newyork"],
  );
  assert.deepEqual(
    DESK_SESSIONS.map((session) => session.settingsKey),
    ["sessionAsiaEnabled", "sessionLondonEnabled", "sessionNewYorkEnabled"],
  );
});

check("one CME trading date owns exactly one of each session", () => {
  /*
   * The split walks a day either side, so the same session appears for the
   * neighbouring dates too. Only the three belonging to the requested trading
   * date may be drawn on it.
   */
  const owned = ownedByDay("triple");
  assert.equal(owned.length, 3, `expected three owned windows, got ${owned.length}`);
  assert.deepEqual(owned.map((segment) => segment.id), ["asia", "london", "newyork"]);
});

check("selecting a subset leaves only that subset", () => {
  // What the trader is asking for: pick Asia, lose London and NY.
  const enabled = new Set(["asia"]);
  const drawn = ownedByDay("triple").filter((segment) => enabled.has(segment.id));
  assert.deepEqual(drawn.map((segment) => segment.id), ["asia"]);
});

check("an unsplit day resolves to no windows at all", () => {
  /*
   * The distinction the prune got wrong. "No windows" means "do not split the
   * day", NOT "draw nothing" - and both states look identical to a filter.
   */
  assert.equal(segmentsForDay("none").length, 0);
});

check("an empty selection falls back to the whole day", () => {
  /*
   * The reported bug. The guard must decide splitting on whether any window
   * actually SURVIVED, not on whether splitting was requested.
   */
  assert.match(
    workspace,
    /const dailySplits = requestedSplits\s*\n\s*&& \[\.\.\.segmentsByDate\.values\(\)\]\.some\(\(segments\) => segments\.length > 0\);/,
    "an empty session selection no longer falls back to the whole day",
  );
  assert.match(
    workspace,
    /if \(requestedSplits && !dailySplits\) \{/,
    "the resolved-empty case does not clear the per-date segments",
  );
});

check("the prune still removes a session that was turned off", () => {
  // The fallback must not have cost the original behaviour: unticking Asia
  // has to take Asia's profile off the chart immediately.
  assert.match(workspace, /const drawnSessionIds = new Set<string>\(/);
  assert.match(workspace, /candidate\.period !== "daily" \|\| drawnSessionIds\.has\(candidate\.sessionId \?\? ""\)/);
});

check("London and New York overlap, and it is measured not assumed", () => {
  /*
   * Recorded rather than corrected, because it is a product decision.
   *
   * London runs to 10:00 Chicago and New York opens at 08:30, so with the day
   * SPLIT the same ninety minutes of executions are counted into two separate
   * profiles. Contiguous windows would each own their volume once. If these
   * boundaries are changed, this check is what should change with them.
   */
  const owned = ownedByDay("triple");
  const london = owned.find((segment) => segment.id === "london");
  const newyork = owned.find((segment) => segment.id === "newyork");
  assert.ok(london && newyork);
  const overlapMs = Math.min(london.endMs, newyork.endMs) - Math.max(london.startMs, newyork.startMs);
  assert.equal(overlapMs, 90 * 60_000, `London/New York overlap changed: ${overlapMs / 60_000} minutes`);
});

console.log(`\nvolume profile session selection: ${passed}/${passed} checks passed`);
