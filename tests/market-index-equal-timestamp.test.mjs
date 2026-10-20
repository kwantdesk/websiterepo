import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shouldAcceptMarketIndexFrame } from "../src/lib/marketIndexLiveClient.ts";

test("SPX accepts genuine price changes inside one provider minute", () => {
  const previous = { timestamp: 1_787_582_460_000, lastPrice: 7_655.57 };

  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp,
    lastPrice: 7_656.31,
  }), true);
  assert.equal(shouldAcceptMarketIndexFrame(previous, { ...previous }), false);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp - 60_000,
    lastPrice: 7_650,
  }), false);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {
    timestamp: previous.timestamp + 60_000,
    lastPrice: 7_657,
  }), true);
});

test("the workspace ticker uses timestamp and price identity", async () => {
  const workspace = await readFile(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspace, /shouldAcceptMarketIndexFrame\(previousFrame/);
  assert.doesNotMatch(workspace, /timestamp <= previousTimestamp/);
});

test("unchanged price and timestamp still deliver corrected genuine source OHLC", () => {
  const time = Date.UTC(2026, 9, 20, 14);
  const previous = {timestamp: time, lastPrice: 101, candle: {time, open: 100, high: 102, low: 99, close: 101}};
  assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, candle: {...previous.candle, high: 103}}), true);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, candle: {...previous.candle, low: 98}}), true);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, candle: {...previous.candle, open: 99.5}}), true);
  assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, candle: {...previous.candle}}), false);
  assert.equal(shouldAcceptMarketIndexFrame({timestamp: time, lastPrice: 101}, previous), true);
});

test("missing, older and malformed OHLC cannot create same-price frame churn", () => {
  const time = Date.UTC(2026, 9, 20, 14);
  const previous = {timestamp: time, lastPrice: 101, candle: {time, open: 100, high: 102, low: 99, close: 101}};
  for (const candle of [undefined, {...previous.candle, high: 98}, {...previous.candle, low: 103}, {...previous.candle, time: time - 60_000}, {...previous.candle, open: NaN}]) {
    assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, candle}), false);
  }
  assert.equal(shouldAcceptMarketIndexFrame(previous, {...previous, timestamp: time - 1, candle: {...previous.candle, high: 110}}), false);
});
