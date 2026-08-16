import assert from "node:assert/strict";
import {
  economicCalendarCoverage,
  hasUpcomingEconomicEvents,
} from "../src/lib/economicCalendar.ts";

const event = (id, date) => ({
  id,
  date,
  currency: "USD",
  country: "United States",
  impact: "High",
  name: id,
  category: id,
  forecast: "",
  previous: "",
  actual: "",
  revised: "",
  reference: "",
  source: "test",
  sourceUrl: "",
  unit: "",
  status: "scheduled",
});

const expiredWeek = [
  event("old", "2026-08-14T14:00:00.000Z"),
  event("older", "2026-08-10T14:00:00.000Z"),
];
const upcomingWeek = [
  ...expiredWeek,
  event("monday", "2026-08-17T12:30:00.000Z"),
  event("friday", "2026-08-21T14:00:00.000Z"),
];

assert.deepEqual(
  economicCalendarCoverage(expiredWeek, "2026-08-16"),
  { from: "2026-08-10", to: "2026-08-14" },
  "coverage must describe the events actually returned, not the server's current week",
);
assert.equal(
  hasUpcomingEconomicEvents(expiredWeek, Date.parse("2026-08-16T00:00:00.000Z")),
  false,
  "an expired provider week must be detected",
);
assert.equal(
  hasUpcomingEconomicEvents(upcomingWeek, Date.parse("2026-08-16T00:00:00.000Z")),
  true,
  "Sunday must recognize Monday's published events as upcoming",
);
assert.deepEqual(
  economicCalendarCoverage(upcomingWeek, "2026-08-16"),
  { from: "2026-08-10", to: "2026-08-21" },
  "forward coverage must reach the latest published event",
);

console.log("Economic calendar forward-window regression checks passed.");
