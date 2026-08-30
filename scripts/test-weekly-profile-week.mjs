import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { cmeWeekRange, currentCmeWeekStart } = await import("../src/lib/cmeProfileWindows.ts");

/**
 * Which week a weekly profile covers.
 *
 * A weekly profile of the CURRENT week is only worth as much as the week has
 * run. On a Monday morning it is a few hours of tape wearing a weekly label,
 * and it keeps reshaping until midweek - which is exactly when last week's
 * finished structure is most useful to lean on.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A Monday morning, 09:45 New York.
const MONDAY_MORNING = Date.UTC(2026, 7, 31, 13, 45);
const WEEK_MS = 7 * 24 * 60 * 60_000;

check("current week is unchanged from what it always was", () => {
  const range = cmeWeekRange(MONDAY_MORNING);
  assert.equal(range.startMs, currentCmeWeekStart(MONDAY_MORNING));
  assert.equal(range.endMs, null, "the live week must stay open-ended");
  // The default must be the old behaviour exactly.
  assert.deepEqual(cmeWeekRange(MONDAY_MORNING, "current"), range);
});

check("previous week is the one that finished, and is closed", () => {
  const current = cmeWeekRange(MONDAY_MORNING);
  const previous = cmeWeekRange(MONDAY_MORNING, "previous");
  assert.ok(previous.startMs < current.startMs, "the previous week does not start earlier");
  assert.equal(previous.endMs, current.startMs, "the finished week is not bounded at this week's open");
  const span = previous.endMs - previous.startMs;
  // Sunday open to Sunday open.
  assert.equal(span, WEEK_MS, `expected a whole week, got ${span / 3_600_000}h`);
});

check("no part of the live week can leak into a finished one", () => {
  /*
   * This is the whole point of the bound. A profile labelled "previous week"
   * that quietly included Monday's tape would be a different measurement than
   * the one it claims to be.
   */
  const previous = cmeWeekRange(MONDAY_MORNING, "previous");
  assert.ok(previous.endMs <= MONDAY_MORNING, "the finished week reaches past now");
  assert.ok(previous.endMs <= currentCmeWeekStart(MONDAY_MORNING));
});

check("it holds on every day of the week", () => {
  // Monday is the painful case, but the answer must not change shape midweek.
  for (let day = 0; day < 7; day += 1) {
    const at = MONDAY_MORNING + day * 24 * 60 * 60_000;
    const current = cmeWeekRange(at);
    const previous = cmeWeekRange(at, "previous");
    assert.equal(previous.endMs, current.startMs, `day ${day} boundary drifted`);
    assert.equal(previous.endMs - previous.startMs, WEEK_MS, `day ${day} was not a whole week`);
  }
});

check("the chart asks for the selected week and filters its bars to it", () => {
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  assert.match(workspace, /cmeWeekRange\(\s*\n?\s*Date\.now\(\),/, "the weekly profile ignores the setting");
  assert.match(
    workspace,
    /weeklyProfileSettings\.weekSelection === "previous" \? "previous" : "current"/,
    "an unrecognised value must fall back to the current week",
  );
  // The bars handed to the profile must respect the closing bound too, or a
  // finished week would be drawn against live candles.
  assert.match(workspace, /candle\.timestamp >= weekStartMs && \(weekEndMs === null \|\| candle\.timestamp < weekEndMs\)/);
  assert.match(workspace, /endMs: weekEndMs \?\?/, "the request does not close the finished week");
});

check("the option is offered on the weekly profile only", () => {
  const control = readFileSync(
    new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8",
  );
  assert.match(control, /settingsDefinition\.id === "weekly-volume-profile" \? \[\[/);
  assert.match(control, /"Week shown", "weekSelection", "current"/);
  assert.match(control, /\["previous", "Previous week · complete"\]/);
});

console.log(`\nweekly profile week: ${passed}/${passed} checks passed`);
