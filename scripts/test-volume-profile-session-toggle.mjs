import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Turning a session off has to take it off the chart.
 *
 * The owner unticked Asia and nothing happened. Two separate faults, either of
 * which alone was enough to make the click inert:
 *
 * 1. The effect that requests profiles listed filterMode, filterTime and the
 *    custom window in its dependency array but NOT the per-session flags.
 *    Clicking Asia wrote a stored flag and React never re-ran anything - no
 *    refetch, no redraw.
 *
 * 2. replaceExactProfile only ever adds or replaces a profile keyed by
 *    (period, sessionId, trading date). Nothing removed one. So even once the
 *    effect did re-run, the surviving sessions were replaced and the Asia
 *    profile - never revisited - stayed on the chart indefinitely.
 *
 * The sessions themselves are Asia, London and New York, and the list
 * lives in one place so a button cannot exist without a window behind it.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../src/lib/volumeProfileSessions.ts", import.meta.url), "utf8");
const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const SESSION_KEYS = [
  "sessionAsiaEnabled",
  "sessionLondonEnabled",
  "sessionNewYorkEnabled",
];

check("the three volume-profile sessions match DeepChart", () => {
  const block = sessions.slice(
    sessions.indexOf("const DESK_SESSION_SEGMENTS"),
    sessions.indexOf("export const DESK_SESSIONS"),
  );
  for (const [id, key] of [
    ["asia", "sessionAsiaEnabled"],
    ["london", "sessionLondonEnabled"],
    ["newyork", "sessionNewYorkEnabled"],
  ]) {
    assert.ok(block.includes(`id: "${id}"`), `${id} window is missing`);
    assert.ok(block.includes(`settingsKey: "${key}"`), `${id} has no settings flag`);
  }
  assert.match(block, /id: "asia".*start: 17 \* 60, end: 26 \* 60/);
});

check("the toggles are in the effect's dependency array", () => {
  // THE FIRST BUG. Without these the click is inert.
  const deps = workspace.slice(
    workspace.indexOf("dailyProfileSettings.useEndSessionAsStartDay,"),
    workspace.indexOf("weeklyProfileSettings.minTradeVolume,"),
  );
  assert.ok(deps.length > 0 && deps.length < 2_000, `dependency slice looks wrong: ${deps.length}`);
  for (const key of SESSION_KEYS) {
    assert.ok(deps.includes(`dailyProfileSettings.${key},`), `${key} must re-run the profile effect`);
  }
});

check("a deselected session's profile is removed from state", () => {
  // THE SECOND BUG. Adding and replacing is not enough - something has to drop
  // the window that is no longer requested.
  const start = workspace.indexOf("const refreshExactProfiles = async () => {");
  // The weekly branch appears earlier in the file too, so search from the
  // function's own start rather than from the top.
  const refresh = workspace.slice(start, workspace.indexOf("      if (weeklyProfileInstance) {", start));
  assert.ok(refresh.length > 0, "refreshExactProfiles is missing");
  assert.match(refresh, /const drawnSessionIds = new Set<string>\(/);
  assert.match(refresh, /candidate\.period !== "daily" \|\| drawnSessionIds\.has\(candidate\.sessionId \?\? ""\)/,
    "daily profiles outside the requested sessions must be dropped");
  // An unsplit study draws exactly one profile with no session identity, so the
  // allowed set must still admit it or the whole study would vanish.
  assert.match(refresh, /: \[""\],/, "the unsplit profile must survive the prune");
  // Returning the same array when nothing was pruned avoids a pointless render
  // on every refresh tick.
  assert.match(refresh, /kept\.length === current\.length \? current : kept/);
});

check("every DeepChart session reaches the window resolver", () => {
  for (const key of SESSION_KEYS) {
    assert.ok(config.includes(`${key}: true`), `${key} needs a default`);
    assert.ok(
      config.includes(`${key}: normalizedInstance.settings?.${key} ?? true`),
      `${key} must survive normalisation`,
    );
  }
});

check("the buttons render from the shared list, not a second copy", () => {
  // A local array here is how the UI and the windows drift apart - a button
  // with no window behind it, or a drawn session with no way to switch it off.
  assert.match(control, /\{DESK_SESSIONS\.map\(\(\{ label, settingsKey: key \}\) => \{/);
  assert.match(control, /import \{ DESK_SESSIONS, DESK_SESSION_SETTING_KEYS \}/);
  assert.doesNotMatch(control, /\["Asia", "sessionAsiaEnabled"\]/, "the hard-coded button list must be gone");
  // The final selected session cannot silently turn into an unrelated
  // whole-day profile.
  assert.match(control, /enabledCount === 1\) return current/);
});

console.log(`\nvolume profile session toggle: ${passed}/${passed} checks passed`);
