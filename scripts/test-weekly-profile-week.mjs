import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { cmeWeekRange, currentCmeWeekStart } = await import("../src/lib/cmeProfileWindows.ts");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const chicago = (iso) => new Date(iso).getTime();
const asChicago = (ms) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", weekday: "short", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(ms));

const MONDAY_MORNING = Date.UTC(2026, 7, 31, 13, 45);
const TRADING_DATES = [
  "2026-08-24", "2026-08-25", "2026-08-26",
  "2026-08-27", "2026-08-28", "2026-08-31",
];
const WEEK_MS = 7 * 24 * 60 * 60_000;

check("stock weekly profile is the latest five trading sessions", () => {
  const range = cmeWeekRange(MONDAY_MORNING, "rolling-five", TRADING_DATES);
  assert.match(asChicago(range.startMs), /^Mon/);
  assert.match(asChicago(range.startMs), /2026-08-24/);
  assert.match(asChicago(range.startMs), /17:00/);
  assert.equal(range.endMs, null, "the developing fifth session must stay open-ended");
  assert.deepEqual(cmeWeekRange(MONDAY_MORNING, undefined, TRADING_DATES), range);
});

check("actual trading dates skip a weekday holiday", () => {
  const dates = ["2026-08-21", "2026-08-24", "2026-08-25", "2026-08-27", "2026-08-28"];
  const saturday = chicago("2026-08-29T18:00:00Z");
  const range = cmeWeekRange(saturday, "rolling-five", dates);
  assert.match(asChicago(range.startMs), /2026-08-20/, asChicago(range.startMs));
  assert.match(asChicago(range.endMs), /2026-08-28/, asChicago(range.endMs));
  assert.match(asChicago(range.endMs), /16:00/, asChicago(range.endMs));
});

check("current and previous calendar-week overrides remain available", () => {
  const current = cmeWeekRange(MONDAY_MORNING, "current");
  const previous = cmeWeekRange(MONDAY_MORNING, "previous");
  assert.equal(current.startMs, currentCmeWeekStart(MONDAY_MORNING));
  assert.equal(current.endMs, null);
  assert.equal(previous.endMs, current.startMs);
  assert.equal(previous.endMs - previous.startMs, WEEK_MS);
});

check("both live profile paths send the calculated five-session bounds", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /cmeWeekRange\([\s\S]*?"rolling-five"[\s\S]*?tradingDates,/);
  assert.match(workspace, /cmeWeekRange\([\s\S]*?"rolling-five"[\s\S]*?paneTradingDates,/);
  assert.match(workspace, /period: "weekly",\s*\r?\n\s*startMs: weeklyWindow\.startMs,/);
  assert.match(workspace, /period: "weekly",\s*\r?\n\s*startMs: weekStartMs,/);
  assert.match(workspace, /endMs: weekEndMs \?\? undefined,/);
});

check("weekly UI defaults to automatic five-day calculation", () => {
  const control = readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const config = readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  assert.match(control, /"Calculation window", "weekSelection", "rolling-five"/);
  assert.match(control, /\["rolling-five", "Last 5 trading days · automatic"\]/);
  assert.match(config, /weekSelection: "rolling-five",\s*\r?\n\s*weeklyWindowSettingsVersion: 2/);
  assert.match(config, /storedSelection === "previous" \? "previous" : "rolling-five"/);
});

console.log(`\nweekly profile week: ${passed}/${passed} checks passed`);
