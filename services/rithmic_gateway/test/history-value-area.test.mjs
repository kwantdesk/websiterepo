import assert from "node:assert/strict";
import test from "node:test";

import { accumulateHistoryVolumeProfileBar } from "../src/history-value-area.mjs";

test("History Plant volume-profile rows preserve every aggressor bucket", () => {
  const rows = new Map();
  const totals = { volume: 0, priceVolume: 0, trades: 0, firstTradeAt: null, lastTradeAt: null };
  const accepted = accumulateHistoryVolumeProfileBar({
    marker: 1_800_000_060,
    profilePrice: [100, 100.25],
    profileBidVolume: [2, 3],
    profileAskVolume: [5, 7],
    profileNoAggressorVolume: [1, 0],
    profileBidAggressorTrades: [1, 2],
    profileAskAggressorTrades: [3, 4],
    profileNoAggressorTrades: [1, 0],
  }, {
    startMs: 1_800_000_000_000,
    endMs: 1_800_000_120_000,
    tickSize: 0.25,
  }, rows, totals);

  assert.equal(accepted, true);
  assert.deepEqual([...rows.entries()], [[400, 8], [401, 10]]);
  assert.equal(totals.volume, 18);
  assert.equal(totals.priceVolume, 1_802.5);
  assert.equal(totals.trades, 11);
  assert.equal(totals.firstTradeAt, 1_800_000_060_000);
  assert.equal(totals.lastTradeAt, 1_800_000_060_000);
});
