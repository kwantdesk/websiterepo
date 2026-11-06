import test from "node:test";
import assert from "node:assert/strict";
import { chartHistoryWindowStart } from "../src/lib/chartHistoryWindow.ts";
import { CHART_INTERVAL_OPTIONS, orderedFavouriteChartIntervals, supportsChartInterval } from "../src/lib/chartIntervals.ts";

test("the history boundary keeps the recorded bar that already overlaps it", () => {
  const from = Date.parse("2026-10-28T16:34:22.123Z");
  assert.equal(chartHistoryWindowStart(from, "1M"), Date.parse("2026-09-30T22:00:00Z"));
  assert.equal(chartHistoryWindowStart(from, "1W"), Date.parse("2026-10-25T22:00:00Z"));
  assert.equal(chartHistoryWindowStart(from, "45s"), Date.parse("2026-10-28T16:33:45Z"));
  assert.equal(chartHistoryWindowStart(from, "4R"), from);
});

test("the interval catalogue and favourites respect recorded instrument capabilities", () => {
  const presets = CHART_INTERVAL_OPTIONS.map(option => option.id);
  assert.equal(presets.filter(id => supportsChartInterval(id, "Databento", "NQ.v.0")).length, 50);
  assert.equal(presets.filter(id => supportsChartInterval(id, "Market Index", "SPX")).length, 14);
  assert.deepEqual(orderedFavouriteChartIntervals(["4R", "1D", "5s", "1m"], "Market Index", "SPX"), ["1m", "1D"]);
  assert.deepEqual(orderedFavouriteChartIntervals(presets, "Market Index", "VXN"), []);
  for (const id of ["0m", "0/4VB", "4/0PF", "90s", "99999999999999999m"]) {
    assert.equal(supportsChartInterval(id, "Databento", "ES.v.0"), false, id);
  }
});
