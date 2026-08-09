import assert from "node:assert/strict";
import test from "node:test";

import {
  completedCmeDailyWindows,
  completedCmeWeeklyWindows,
  nextCmeDailyCompletion,
} from "../src/lib/cmeProfileWindows.ts";

test("Monday Globex uses Friday as the previous completed daily profile", () => {
  const mondayGlobex = Date.parse("2026-08-09T23:00:00.000Z");
  const previousDay = completedCmeDailyWindows(mondayGlobex)[0];

  assert.deepEqual(previousDay, {
    start: Date.parse("2026-08-06T22:00:00.000Z"),
    end: Date.parse("2026-08-07T21:00:00.000Z"),
    label: "2026-08-07",
  });
});

test("Monday New York open still uses Friday as the previous completed daily profile", () => {
  const mondayNewYorkOpen = Date.parse("2026-08-10T13:30:00.000Z");
  const previousDay = completedCmeDailyWindows(mondayNewYorkOpen)[0];

  assert.equal(previousDay.label, "2026-08-07");
  assert.equal(previousDay.end, Date.parse("2026-08-07T21:00:00.000Z"));
});

test("Monday becomes the completed daily profile only after its CME close", () => {
  const beforeClose = Date.parse("2026-08-10T20:59:59.999Z");
  const atClose = Date.parse("2026-08-10T21:00:00.000Z");

  assert.equal(completedCmeDailyWindows(beforeClose)[0].label, "2026-08-07");
  assert.equal(completedCmeDailyWindows(atClose)[0].label, "2026-08-10");
});

test("Monday uses the week ending Friday as the previous weekly profile", () => {
  const mondayNewYorkOpen = Date.parse("2026-08-10T13:30:00.000Z");
  const previousWeek = completedCmeWeeklyWindows(mondayNewYorkOpen)[0];

  assert.deepEqual(previousWeek, {
    start: Date.parse("2026-08-02T22:00:00.000Z"),
    end: Date.parse("2026-08-07T21:00:00.000Z"),
    label: "2026-08-03 / 2026-08-07",
  });
});

test("Friday levels remain current through the weekend and Monday session", () => {
  const fridayAfterClose = Date.parse("2026-08-07T21:00:01.000Z");
  assert.equal(
    nextCmeDailyCompletion(fridayAfterClose),
    Date.parse("2026-08-10T21:00:00.000Z"),
  );
});
