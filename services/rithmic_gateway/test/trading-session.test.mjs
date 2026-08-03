import assert from "node:assert/strict";
import test from "node:test";

import {
  chicagoTradingDate,
  cmeSessionBounds,
  resolveVolumeProfileRange,
} from "../src/trading-session.mjs";

test("labels the CME trading day from the 17:00 Chicago session open", () => {
  assert.equal(chicagoTradingDate(Date.parse("2026-08-03T21:59:59Z")), "2026-08-02");
  assert.equal(chicagoTradingDate(Date.parse("2026-08-03T22:00:00Z")), "2026-08-03");
});

test("builds DST-aware summer and winter CME session boundaries", () => {
  assert.deepEqual(cmeSessionBounds("2026-08-03"), {
    tradingDate: "2026-08-03",
    startMs: Date.parse("2026-08-03T22:00:00Z"),
    endMs: Date.parse("2026-08-04T22:00:00Z"),
  });
  assert.deepEqual(cmeSessionBounds("2026-01-12"), {
    tradingDate: "2026-01-12",
    startMs: Date.parse("2026-01-12T23:00:00Z"),
    endMs: Date.parse("2026-01-13T23:00:00Z"),
  });
});

test("uses tradingDate instead of an unbounded epoch profile", () => {
  const params = new URLSearchParams({
    period: "daily",
    tradingDate: "2026-08-03",
  });
  assert.deepEqual(
    resolveVolumeProfileRange(params, Date.parse("2026-08-04T12:30:00Z")),
    {
      tradingDate: "2026-08-03",
      startMs: Date.parse("2026-08-03T22:00:00Z"),
      endMs: Date.parse("2026-08-04T12:30:00Z"),
    },
  );
});

test("keeps explicit ranges for weekly and custom profiles", () => {
  const params = new URLSearchParams({
    period: "weekly",
    startMs: String(Date.parse("2026-07-27T22:00:00Z")),
    endMs: String(Date.parse("2026-08-01T22:00:00Z")),
  });
  assert.deepEqual(
    resolveVolumeProfileRange(params, Date.parse("2026-08-04T12:30:00Z")),
    {
      tradingDate: null,
      startMs: Date.parse("2026-07-27T22:00:00Z"),
      endMs: Date.parse("2026-08-01T22:00:00Z"),
    },
  );
});
