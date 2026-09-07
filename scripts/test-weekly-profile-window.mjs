import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  cmeWeekRange,
  currentCmeWeekStart,
  rollingCmeTradingDayRange,
} from "../src/lib/cmeProfileWindows.ts";

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const chicago = (iso) => new Date(iso).getTime();
const asChicago = (ms) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", weekday: "short", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(ms));

check("weekday fallback supplies five sessions while candles hydrate", () => {
  const now = chicago("2026-08-26T15:00:00Z");
  const range = rollingCmeTradingDayRange(now);
  assert.match(asChicago(range.startMs), /2026-08-19/, asChicago(range.startMs));
  assert.match(asChicago(range.startMs), /17:00/, asChicago(range.startMs));
  assert.equal(range.endMs, null);
});

check("a weekend window ends at Friday close instead of inventing Saturday", () => {
  const now = chicago("2026-08-29T18:00:00Z");
  const range = rollingCmeTradingDayRange(now);
  assert.match(asChicago(range.startMs), /2026-08-23/, asChicago(range.startMs));
  assert.match(asChicago(range.endMs), /2026-08-28/, asChicago(range.endMs));
  assert.match(asChicago(range.endMs), /16:00/, asChicago(range.endMs));
});

check("calendar-week boundary helper remains stable for user overrides", () => {
  const opens = ["24", "25", "26", "27", "28"]
    .map((day) => currentCmeWeekStart(chicago(`2026-08-${day}T15:00:00Z`)));
  assert.equal(new Set(opens).size, 1);
  assert.match(asChicago(opens[0]), /2026-08-23/);
  assert.deepEqual(
    cmeWeekRange(chicago("2026-08-28T15:00:00Z"), "current"),
    { startMs: opens[0], endMs: null },
  );
});

check("workspace calculation is history-aware and cache-stable", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const selection = String\(weeklyProfileSettings\.weekSelection \?\? "rolling-five"\)/);
  assert.match(workspace, /"rolling-five",\s*\r?\n\s*tradingDates,/);
  assert.match(workspace, /period: "weekly",\s*\r?\n\s*startMs: weekStartMs,/);
  assert.match(workspace, /endMs: weekEndMs \?\? undefined,/);
  assert.doesNotMatch(workspace, /endMs: weekEndMs \?\? \(weeklyCandles\.length/);
});

console.log(`\nweekly profile window: ${passed}/${passed} checks passed`);
