import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chartSourceTimestamp, chartActivityRemainingMs, candleCountdownRemainingMs } from "../src/lib/chartCountdown.ts";

const friday = Date.parse("2026-09-04T20:59:00Z");
const sunday = Date.parse("2026-09-06T05:00:00Z");

test("weekend countdown never restarts from the computer clock even with a wrong active flag", () => {
  for (const interval of [15_000, 60_000, 300_000, 3_600_000, 86_400_000]) {
    for (let second = 0; second < 120; second++) {
      assert.equal(candleCountdownRemainingMs(friday, interval, sunday + second * 1_000, true), null);
    }
  }
});

test("daily and weekly countdowns require positive live activity, not an unknown/closed/replay flag", () => {
  for (const active of [false, undefined]) {
    for (const interval of [60_000, 86_400_000, 7 * 86_400_000]) {
      assert.equal(candleCountdownRemainingMs(friday, interval, friday + 1_000, active), null);
    }
  }
});

test("live candle counts down to its actual deadline, stops, and resumes with the next bar", () => {
  assert.equal(candleCountdownRemainingMs(friday, 60_000, friday + 10_000, true), 50_000);
  assert.equal(candleCountdownRemainingMs(friday, 60_000, friday + 60_000, true), null);
  assert.equal(candleCountdownRemainingMs(friday + 60_000, 60_000, friday + 61_000, true), 59_000);
  assert.equal(candleCountdownRemainingMs(friday, 0, friday, true), null);
  assert.equal(candleCountdownRemainingMs(friday + 60_000, 60_000, friday, true), null);
});

test("provider timestamps retain their true age across seconds, milliseconds, microseconds and nanoseconds", () => {
  for (const value of [friday / 1_000, friday, friday * 1_000, friday * 1_000_000, String(friday), "2026-09-04T20:59:00Z"]) {
    assert.equal(chartSourceTimestamp(value), friday);
    assert.equal(chartActivityRemainingMs(chartSourceTimestamp(value), sunday), 0);
  }
  for (const invalid of [undefined, null, "bad", 0, Infinity, NaN]) {
    assert.equal(chartActivityRemainingMs(chartSourceTimestamp(invalid), sunday), 0);
  }
});

test("repeated stale snapshots cannot extend activity; fresh observations can resume it", () => {
  assert.equal(chartActivityRemainingMs(friday, friday), 15_000);
  assert.equal(chartActivityRemainingMs(friday, friday + 10_000), 5_000);
  assert.equal(chartActivityRemainingMs(friday, friday + 15_000), 0);
  assert.equal(chartActivityRemainingMs(friday, sunday), 0);
  assert.equal(chartActivityRemainingMs(sunday, sunday), 15_000);
  assert.equal(chartActivityRemainingMs(sunday + 60_000, sunday), 0);
});

test("all workspace activity paths preserve source time instead of the candle clock fallback", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /markMarketActive\(\)/);
  assert.match(workspace, /sourceTimestamp: chartSourceTimestamp\(price.timestamp\)/);
  assert.equal((workspace.match(/markMarketActive\(chartSourceTimestamp\(snapshot.timestamp\)\)/g) ?? []).length, 2);
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(chart, /now % candleIntervalMs/);
  assert.match(chart, /if \(marketIsActive !== true\) \{\s*setLabel\("-"\);\s*return;/);
});
