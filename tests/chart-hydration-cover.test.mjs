import assert from "node:assert/strict";
import test from "node:test";

import {
  chartContinuityInspectionTime,
  chartHydrationKey,
  chartNeedsLoadingCover,
} from "../src/lib/chartHydration.ts";

const esOneMinute = chartHydrationKey({
  broker: "Databento",
  symbol: "ES",
  timeframe: "1m",
  period: "5D",
});

test("an unsettled chart request always keeps the loading cover visible", () => {
  assert.equal(chartNeedsLoadingCover({
    requestKey: esOneMinute,
    settledRequestKey: null,
    loading: false,
    error: null,
    candleCount: 3,
  }), true);
});

test("switching instrument or interval hides the previous chart synchronously", () => {
  const nqFortyRange = chartHydrationKey({
    broker: "Databento",
    symbol: "NQ",
    timeframe: "40R",
    period: "5D",
  });
  assert.notEqual(nqFortyRange, esOneMinute);
  assert.equal(chartNeedsLoadingCover({
    requestKey: nqFortyRange,
    settledRequestKey: esOneMinute,
    loading: false,
    error: null,
    candleCount: 2_000,
  }), true);
});

test("verified candles release the cover only for their exact request", () => {
  assert.equal(chartNeedsLoadingCover({
    requestKey: esOneMinute,
    settledRequestKey: esOneMinute,
    loading: false,
    error: null,
    candleCount: 2_000,
  }), false);
});

test("a settled live chart stays visible while continuity repairs in place", () => {
  assert.equal(chartNeedsLoadingCover({
    requestKey: esOneMinute,
    settledRequestKey: esOneMinute,
    loading: false,
    error: null,
    candleCount: 2_000,
  }), false);
});

test("the watchdog observes behind a just-opened candle boundary", () => {
  const boundary = Date.parse("2026-09-03T07:48:08.000Z");
  assert.equal(
    chartContinuityInspectionTime(boundary, 60_000),
    Date.parse("2026-09-03T07:47:53.000Z"),
  );
  assert.equal(chartContinuityInspectionTime(boundary, 15_000), boundary - 3_750);
  assert.equal(chartContinuityInspectionTime(boundary, 1_000), boundary - 1_000);
});

test("a settled failure reveals the honest error instead of dots or an endless loader", () => {
  assert.equal(chartNeedsLoadingCover({
    requestKey: esOneMinute,
    settledRequestKey: esOneMinute,
    loading: false,
    error: "CME history is unavailable right now.",
    candleCount: 0,
  }), false);
});
