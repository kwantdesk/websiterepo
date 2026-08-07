import assert from "node:assert/strict";
import test from "node:test";

import { cmeSessionDateKey, cmeSessionStartMs } from "../src/lib/chartHistoryWindow.ts";

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
