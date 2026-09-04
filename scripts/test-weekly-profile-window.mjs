import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { currentCmeWeekStart } from "../src/lib/cmeProfileWindows.ts";

/**
 * A weekly volume profile covers THIS WEEK, from the Sunday Globex open.
 *
 * It used to cover "the last five trading dates the chart happened to have
 * loaded", which is not a week. On a Tuesday it reached back into the previous
 * Thursday and Friday, and when a pane held only today's candles - a short load
 * range, or history still restoring - it collapsed to exactly today and the
 * weekly profile mirrored the daily one.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const chicago = (iso) => new Date(iso).getTime();
/** What a Chicago wall-clock reading of a timestamp looks like. */
const asChicago = (ms) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(ms));

check("mid-week resolves to the Sunday that opened the week", () => {
  // 2026-08-28 is a Friday; its week opened Sunday 2026-08-23 at 17:00 CT.
  const start = currentCmeWeekStart(chicago("2026-08-28T14:00:00Z"));
  const reading = asChicago(start);
  assert.match(reading, /^Sun/, reading);
  assert.match(reading, /2026-08-23/, reading);
  assert.match(reading, /17:00/, reading);
});

check("every weekday in one week gives the SAME open", () => {
  // The whole point: Monday through Friday all belong to one profile.
  const opens = ["24", "25", "26", "27", "28"]
    .map((day) => currentCmeWeekStart(chicago(`2026-08-${day}T15:00:00Z`)));
  assert.equal(new Set(opens).size, 1, `expected one week open, got ${new Set(opens).size}`);
  assert.match(asChicago(opens[0]), /2026-08-23/);
});

check("Sunday before the open still belongs to the week that just ended", () => {
  // THE BOUNDARY. Sunday's 17:00 session belongs to Monday, so at noon on
  // Sunday the new week has not started and the answer is the PREVIOUS Sunday.
  const beforeOpen = currentCmeWeekStart(chicago("2026-08-23T17:00:00Z")); // 12:00 CT Sunday
  assert.match(asChicago(beforeOpen), /2026-08-16/, asChicago(beforeOpen));
  // An hour after the open it is the new week.
  const afterOpen = currentCmeWeekStart(chicago("2026-08-23T23:00:00Z")); // 18:00 CT Sunday
  assert.match(asChicago(afterOpen), /2026-08-23/, asChicago(afterOpen));
});

check("the week open is always in the past, and within eight days", () => {
  // A profile anchored to a future timestamp would render nothing at all.
  for (let hours = 0; hours < 24 * 21; hours += 7) {
    const now = chicago("2026-08-10T00:00:00Z") + hours * 3_600_000;
    const start = currentCmeWeekStart(now);
    assert.ok(start <= now, `week open ${asChicago(start)} is after ${asChicago(now)}`);
    assert.ok(now - start < 8 * 24 * 3_600_000, `week open ${asChicago(start)} is too far back`);
  }
});

check("the workspace asks from the week open, not the first loaded candle", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  // The rolling five-session window IS the bug. It must not come back.
  assert.doesNotMatch(workspace, /new Set\(tradingDates\.slice\(-5\)\)/);
  assert.match(workspace, /const \{ startMs: weekStartMs, endMs: weekEndMs \} = cmeWeekRange\(/);
  assert.match(workspace, /weeklyProfileSettings\.weekSelection === "previous" \? "previous" : "current"/);
  // Anchored to the week, so a pane holding less history than that still gets
  // the whole week rather than silently shrinking to what it happens to have.
  assert.match(workspace, /period: "weekly",\s*\r?\n\s*startMs: weekStartMs,/);
});

console.log(`\nweekly profile window: ${passed}/${passed} checks passed`);
