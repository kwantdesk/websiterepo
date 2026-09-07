import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldRetainLastGoodOwnedVolumeProfile,
  shouldRetainLastGoodVolumeProfile,
} from "../src/lib/volumeProfileContinuity.ts";

const profile = (period, overrides = {}) => ({
  schemaVersion: "kwantify-volume-profile-v1",
  provider: "Rithmic",
  source: "execution-tape",
  root: "NQ",
  contractSymbol: "NQZ6",
  period,
  tradingDate: "2026-09-07",
  startMs: 1_000,
  endMs: 2_000,
  tickSize: 0.25,
  groupTicks: 1,
  valueAreaPercent: 70,
  minTradeVolume: 0,
  maxTradeVolume: 0,
  totalVolume: 10,
  bidVolume: 4,
  askVolume: 6,
  delta: 2,
  poc: 100,
  vah: 101,
  val: 99,
  levels: [{ price: 100, volume: 10, bidVolume: 4, askVolume: 6, delta: 2, trades: 2 }],
  ...overrides,
});

const scope = (overrides = {}) => ({
  root: "NQ",
  contractSymbol: "NQZ6",
  dailyEnabled: true,
  weeklyEnabled: true,
  compositeEnabled: true,
  dailyTradingDates: new Set(["2026-09-07"]),
  dailySessionIds: new Set([""]),
  ...overrides,
});

test("a rolling composite remains painted while its next candle-boundary request resolves", () => {
  const previousFrame = profile("custom", { startMs: 1_000, endMs: 2_000 });
  assert.equal(
    shouldRetainLastGoodVolumeProfile(previousFrame, scope(), "2026-09-07"),
    true,
  );
});

test("continuity never leaks a profile across symbol, contract, or removed-study scope", () => {
  const previousFrame = profile("custom");
  assert.equal(shouldRetainLastGoodVolumeProfile(previousFrame, scope({ root: "ES" }), "2026-09-07"), false);
  assert.equal(shouldRetainLastGoodVolumeProfile(previousFrame, scope({ contractSymbol: "NQH7" }), "2026-09-07"), false);
  assert.equal(shouldRetainLastGoodVolumeProfile(previousFrame, scope({ compositeEnabled: false }), "2026-09-07"), false);
});

test("daily session removal is immediate but recalculation settings do not blank the frame", () => {
  const asia = profile("daily", { sessionId: "asia" });
  assert.equal(
    shouldRetainLastGoodVolumeProfile(asia, scope({ dailySessionIds: new Set(["asia"]) }), "2026-09-07"),
    true,
  );
  assert.equal(
    shouldRetainLastGoodVolumeProfile(asia, scope({ dailySessionIds: new Set(["london"]) }), "2026-09-07"),
    false,
  );
});

test("owned session and visible-range variants survive a request-key change until replacement", () => {
  const previousFrame = profile("custom", { ownerInstanceId: "session-profile-1" });
  assert.equal(shouldRetainLastGoodOwnedVolumeProfile(previousFrame, {
    root: "NQ",
    contractSymbol: "NQZ6",
    ownerInstanceIds: new Set(["session-profile-1"]),
  }), true);
  assert.equal(shouldRetainLastGoodOwnedVolumeProfile(previousFrame, {
    root: "NQ",
    contractSymbol: "NQZ6",
    ownerInstanceIds: new Set(["another-study"]),
  }), false);
});
