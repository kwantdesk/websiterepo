import test from "node:test";
import assert from "node:assert/strict";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { mergeLiveIndicatorCandle } from "../src/lib/chartLiveEvents.ts";
import { retainFormingCandleExtrema } from "../src/lib/liveCandleAuthority.ts";
import { applyInstitutionalTradesToCandles } from "../src/lib/institutionalMarketData.ts";

const timestamp = Date.UTC(2026, 10, 6, 14);
const theme = { primary: "#fff", secondary: "#ccc", positive: "#0f0", negative: "#f00", muted: "#888" };
const instance = { instanceId: "cvd", indicatorId: "cumulative-volume-delta", enabled: true, settings: {} };
const historical = { timestamp, open: 100, high: 101, low: 99, close: 100, volume: 70,
  askVolume: 30, bidVolume: 40, delta: -10, deltaOpen: -4000, deltaHigh: -3980, deltaLow: -4025, deltaClose: -4010 };
const live = { ...historical, volume: 75, askVolume: 35, delta: -5,
  deltaOpen: 0, deltaHigh: 20, deltaLow: -25, deltaClose: -5 };
const points = (candles) => calculateIndicatorSeries(instance, candles, theme, { instrument: "NQ", tickSize: 0.25 })[0].data;

test("reconciling cumulative history with live data retains real delta wicks on their own scale", () => {
  for (const merged of [mergeLiveIndicatorCandle([historical], live)[0], retainFormingCandleExtrema(historical, live)]) {
    const [point] = points([merged]);
    assert.deepEqual([point.open, point.high, point.low, point.close], [0, 20, -25, -5]);
  }
});

test("a new classified execution extends a cumulative-history seed without adding its session offset", () => {
  const print = { timestamp: timestamp + 10, open: 100, high: 100, low: 100, close: 100, volume: 50,
    trades: 1, askVolume: 50, bidVolume: 0, aggressor: "BUY", delta: 50 };
  const [bar] = applyInstitutionalTradesToCandles([historical], [print], "1m", "NQ");
  assert.deepEqual([bar.deltaOpen, bar.deltaHigh, bar.deltaLow, bar.deltaClose], [0, 40, -25, 40]);
});

test("already-corrupted cached extrema cannot flatten the rest of the CVD scale", () => {
  const corrupt = { ...live, deltaLow: -4025, deltaHigh: 5000 };
  const next = { ...live, timestamp: timestamp + 60_000 };
  const missing = { ...next, timestamp: timestamp + 120_000, askVolume: undefined, bidVolume: undefined };
  const resumed = { ...next, timestamp: timestamp + 180_000 };
  const actual = points([corrupt, next, missing, resumed]);
  assert.deepEqual(actual.map(({open, high, low, close, breakBefore}) => [open, high, low, close, breakBefore]),
    [[0, 0, -5, -5, true], [-5, 15, -30, -10, false], [0, 20, -25, -5, true]]);
});
