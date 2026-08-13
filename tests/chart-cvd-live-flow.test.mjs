import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeLiveIndicatorCandle,
  readDatabentoLiveTail,
  recordDatabentoLiveTick,
} from "../src/lib/chartLiveEvents.ts";

test("the forming Volume candle grows live and cannot regress within its bucket", () => {
  const timestamp = Math.floor(Date.now() / 60_000) * 60_000;
  const candle = (volume) => ({
    timestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    volume,
  });

  const growing = mergeLiveIndicatorCandle([candle(20)], candle(35));
  assert.equal(growing.at(-1).volume, 35);

  const staleSample = mergeLiveIndicatorCandle(growing, candle(28));
  assert.equal(staleSample.at(-1).volume, 35);

  const next = mergeLiveIndicatorCandle(staleSample, {
    ...candle(4),
    timestamp: timestamp + 60_000,
  });
  assert.equal(next.length, 2);
  assert.equal(next.at(-1).volume, 4);
});

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
