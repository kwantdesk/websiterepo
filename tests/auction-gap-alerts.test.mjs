import assert from "node:assert/strict";
import test from "node:test";

import {
  collectAuctionGapAlerts,
  createAuctionGapAlertState,
} from "../src/lib/auctionGapAlerts.ts";

const zone = (id, sourceIndex) => ({
  id, sourceIndex, side: "buy", lowTick: 100, highTick: 101,
  endIndex: sourceIndex, state: "fresh", triggeredAtBarId: null,
  triggeredAtIndex: null, stoppedBy: null,
});
const collect = (state, zones, patch = {}) => collectAuctionGapAlerts(state, {
  scope: "NQU6:1m:settings-a",
  zones,
  sourceTimestampForIndex: (index) => 1_000 + index * 60_000,
  live: true,
  continuous: true,
  enabled: true,
  ...patch,
});

test("historical hydration is silent and a new live-edge zone alerts once", () => {
  const state = createAuctionGapAlertState();
  assert.deepEqual(collect(state, [zone("old", 1)]), []);
  assert.deepEqual(collect(state, [zone("old", 1), zone("live", 2)]).map((event) => event.id), ["live"]);
  assert.deepEqual(collect(state, [zone("old", 1), zone("live", 2)]), []);
});

test("closed market, replay and broken continuity baseline new zones silently", () => {
  for (const patch of [{ live: false }, { continuous: false }]) {
    const state = createAuctionGapAlertState();
    collect(state, [zone("old", 1)]);
    assert.deepEqual(collect(state, [zone("old", 1), zone("silent", 2)], patch), []);
    assert.deepEqual(collect(state, [zone("old", 1), zone("silent", 2)]), []);
  }
});

test("settings scope changes and historical corrections never create alerts", () => {
  const state = createAuctionGapAlertState();
  collect(state, [zone("old", 5)]);
  assert.deepEqual(collect(state, [zone("correction", 2), zone("old", 5)]), []);
  assert.deepEqual(collect(state, [zone("scope-zone", 6)], { scope: "NQU6:1m:settings-b" }), []);
});

test("disabled alert channels still advance deduplication state", () => {
  const state = createAuctionGapAlertState();
  collect(state, [zone("old", 1)]);
  assert.deepEqual(collect(state, [zone("old", 1), zone("muted", 2)], { enabled: false }), []);
  assert.deepEqual(collect(state, [zone("old", 1), zone("muted", 2)]), []);
});
