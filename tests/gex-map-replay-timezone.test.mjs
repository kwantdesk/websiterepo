import assert from "node:assert/strict";
import test from "node:test";
import { gexMapReplayDisplay } from "../src/lib/gexMapReplayTime.ts";
import { framesInReplayWindow } from "../src/lib/gexMapReplayWindow.ts";
const open = Date.parse("2026-10-30T13:30:00Z"), close = Date.parse("2026-10-30T19:59:00Z");
test("Brisbane history follows the website clock, including midnight rollover", () => {
  const display = gexMapReplayDisplay("Australia/Brisbane");
  assert.equal(display.clock(open), "23:30:00 · UTC+10 · Brisbane");
  assert.equal(display.clock(close), "05:59:00 · UTC+10 · Brisbane");
  assert.equal(display.date(open), "Oct 30, 2026");
  assert.equal(display.date(close), "Oct 31, 2026");
});
test("UTC and New York are projections of the exact same frame", () => {
  assert.equal(gexMapReplayDisplay("UTC").clock(open), "13:30:00 · UTC · UTC");
  assert.equal(gexMapReplayDisplay("America/New_York").clock(open), "09:30:00 · UTC−4 · New York");
});
test("history uses the historical DST offset, not today's offset", () => {
  const winter = Date.parse("2026-11-02T14:30:00Z");
  assert.equal(gexMapReplayDisplay("America/New_York").clock(winter), "09:30:00 · UTC−5 · New York");
  assert.equal(gexMapReplayDisplay("Australia/Brisbane").clock(winter), "00:30:00 · UTC+10 · Brisbane");
});
test("window tooltips show the selected zone and the session's correct DST", () => {
  const display = gexMapReplayDisplay("Australia/Brisbane");
  assert.match(display.window("rth", "2026-10-30"), /30 Oct.*23:30.*31 Oct.*06:00.*Brisbane/);
  assert.match(display.window("power", "2026-10-30"), /31 Oct.*05:00.*31 Oct.*06:00/);
  assert.match(display.window("rth", "2026-11-02"), /03 Nov.*00:30.*03 Nov.*07:00/);
});
test("changing display zone never changes the exchange session or filtered instants", () => {
  const frames = [open, close], before = [...frames];
  for (const zone of ["UTC", "Australia/Brisbane", "Pacific/Auckland", "America/New_York"]) {
    const display = gexMapReplayDisplay(zone);
    frames.forEach(t => { display.clock(t); display.date(t); });
    assert.deepEqual(framesInReplayWindow(frames, "rth"), before);
  }
  assert.deepEqual(frames, before);
});
test("unavailable session and invalid timezone have safe display fallbacks", () => {
  assert.equal(gexMapReplayDisplay("invalid").clock(open), "13:30:00 · UTC · UTC");
  assert.equal(gexMapReplayDisplay("UTC").window("rth", ""), "NY OPEN · New York session");
  assert.equal(gexMapReplayDisplay("UTC").window("all", "2026-10-30"), "Every recorded frame");
});
