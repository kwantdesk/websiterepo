import assert from "node:assert/strict";
import test from "node:test";

import {
  cmeEventTailCutoffMs,
  cmeChartTailNeedsReconciliation,
  cmeSessionDateKey,
  cmeSessionStartMs,
  cmeSessionWindowForDate,
  cmeTradingCloseMsForDate,
} from "../src/lib/chartHistoryWindow.ts";

function chicagoHour(ms) {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ms)),
  );
}

// Order-flow backfill anchors to this. If it is wrong the profile silently
// loses delta for the earlier part of the session.
test("session start is 17:00 Chicago during CDT", () => {
  const start = cmeSessionStartMs(Date.parse("2026-08-07T14:00:00Z"));
  assert.ok(start !== null);
  assert.equal(chicagoHour(start), 17);
});

test("session start is 17:00 Chicago during CST", () => {
  const start = cmeSessionStartMs(Date.parse("2026-01-15T14:00:00Z"));
  assert.ok(start !== null);
  assert.equal(chicagoHour(start), 17, "must survive the DST offset change");
});

test("Friday event bars stop accepting executions at the maintenance halt", () => {
  assert.equal(
    cmeTradingCloseMsForDate("2026-08-07"),
    Date.parse("2026-08-07T21:00:00.000Z"),
  );
  const candles = [
    { timestamp: Date.parse("2026-08-07T20:57:13.500Z"), open: 1, high: 2, low: 1, close: 2 },
    { timestamp: Date.parse("2026-08-07T20:59:33.500Z"), open: 2, high: 3, low: 2, close: 3 },
  ];
  assert.equal(
    cmeEventTailCutoffMs(candles, Date.parse("2026-08-08T12:00:00.000Z")),
    Date.parse("2026-08-07T21:00:00.000Z"),
  );
});

test("the live event bar remains open until the real CME trading halt", () => {
  const candles = [
    { timestamp: Date.parse("2026-08-07T20:57:13.500Z"), open: 1, high: 2, low: 1, close: 2 },
    { timestamp: Date.parse("2026-08-07T20:59:33.500Z"), open: 2, high: 3, low: 2, close: 3 },
  ];
  assert.equal(
    cmeEventTailCutoffMs(candles, Date.parse("2026-08-07T20:59:50.000Z")),
    Date.parse("2026-08-07T21:00:00.000Z"),
  );
});

test("the start belongs to the same trading session as the timestamp", () => {
  for (const iso of [
    "2026-08-07T14:00:00Z", // NY morning
    "2026-08-07T02:00:00Z", // overnight, after the 17:00 open
    "2026-08-06T23:30:00Z", // minutes after the open
  ]) {
    const at = Date.parse(iso);
    const start = cmeSessionStartMs(at);
    assert.equal(
      cmeSessionDateKey(start),
      cmeSessionDateKey(at),
      `${iso} must anchor to its own session`,
    );
    assert.ok(start <= at, `${iso}: session start cannot be in the future`);
  }
});

test("the closed weekend remains on Friday's completed CME trading date", () => {
  assert.equal(cmeSessionDateKey(Date.parse("2026-08-07T23:00:00Z")), "2026-08-07");
  assert.equal(cmeSessionDateKey(Date.parse("2026-08-08T15:00:00Z")), "2026-08-07");
  assert.equal(cmeSessionDateKey(Date.parse("2026-08-09T15:00:00Z")), "2026-08-07");
});

test("Sunday Globex reopen advances to Monday's CME trading date", () => {
  assert.equal(cmeSessionDateKey(Date.parse("2026-08-09T22:00:00Z")), "2026-08-10");
});

test("Friday execution profiles end at Friday close rather than extending into the weekend", () => {
  assert.deepEqual(cmeSessionWindowForDate("2026-08-07"), {
    startMs: Date.parse("2026-08-06T22:00:00.000Z"),
    endMs: Date.parse("2026-08-07T22:00:00.000Z"),
  });
});

test("Monday execution profiles retain their Sunday-to-Monday window", () => {
  assert.deepEqual(cmeSessionWindowForDate("2026-08-10"), {
    startMs: Date.parse("2026-08-09T22:00:00.000Z"),
    endMs: Date.parse("2026-08-10T22:00:00.000Z"),
  });
});

test("a full session is longer than the old six-hour window", () => {
  // The regression this fixes: at NY midday a rolling 6h window misses most
  // of a session that opened at 17:00 the previous day.
  const at = Date.parse("2026-08-07T16:00:00Z");
  const elapsed = at - cmeSessionStartMs(at);
  assert.ok(
    elapsed > 6 * 60 * 60_000,
    "session elapsed time must exceed the old fixed lookback",
  );
});

test("an invalid timestamp returns null rather than a guess", () => {
  assert.equal(cmeSessionStartMs(Number.NaN), null);
});

test("an active chart rejects a fresh cache with missing recent candles", () => {
  const now = Date.parse("2026-08-11T14:07:30.000Z");
  const candle = (iso) => ({
    timestamp: Date.parse(iso),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
  });
  assert.equal(cmeChartTailNeedsReconciliation([
    candle("2026-08-11T14:00:00.000Z"),
    candle("2026-08-11T14:01:00.000Z"),
    candle("2026-08-11T14:07:00.000Z"),
  ], "1m", now), true, "a current live candle must not hide an internal seam gap");
  assert.equal(cmeChartTailNeedsReconciliation([
    candle("2026-08-11T14:05:00.000Z"),
    candle("2026-08-11T14:06:00.000Z"),
    candle("2026-08-11T14:07:00.000Z"),
  ], "1m", now), false);
});

test("the scheduled weekend closure is not reported as a chart-data hole", () => {
  const candle = {
    timestamp: Date.parse("2026-08-07T20:55:00.000Z"),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
  };
  assert.equal(
    cmeChartTailNeedsReconciliation([candle], "5m", Date.parse("2026-08-08T14:00:00.000Z")),
    false,
  );
});
