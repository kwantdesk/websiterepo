import test from "node:test";
import assert from "node:assert/strict";

import {
  readDatabentoLiveTail,
  recordDatabentoLiveTick,
} from "../src/lib/chartLiveEvents.ts";

test("live execution flow preserves the full delta candle path for CVD", () => {
  const instrument = `CVD_TEST_${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1_000) * 1_000 + 100;

  recordDatabentoLiveTick({
    instrument,
    mid: 100,
    timestamp,
    isTrade: true,
    size: 12,
    trades: 1,
    delta: 12,
  });
  recordDatabentoLiveTick({
    instrument,
    mid: 99.75,
    timestamp: timestamp + 1,
    isTrade: true,
    size: 20,
    trades: 1,
    delta: -20,
  });

  const candle = readDatabentoLiveTail(instrument).at(-1);
  assert.ok(candle);
  assert.equal(candle.askVolume, 12);
  assert.equal(candle.bidVolume, 20);
  assert.equal(candle.deltaOpen, 0);
  assert.equal(candle.deltaHigh, 12);
  assert.equal(candle.deltaLow, -8);
  assert.equal(candle.deltaClose, -8);
});
