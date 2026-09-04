import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  calculateIndicatorSeries,
  calculateDeltaPercentHighlights,
} from "../src/lib/chartIndicatorEngine.ts";
import {
  alignIndicatorSeriesToEventBars,
  buildEventIndicatorTimeMap,
} from "../src/lib/eventIndicatorAlignment.ts";
import { sessionCvdBars } from "../src/lib/cvdDivergence.ts";

const start = 1_788_515_724_000;
// Deliberately close 120 event bars inside one wall-clock second. This is the
// exact collision that made 500V pane studies vanish while price still drew.
const candles = Array.from({ length: 120 }, (_, index) => {
  const askVolume = index % 2 ? 300 : 200;
  const bidVolume = 500 - askVolume;
  const open = 29_000 + index * 0.25;
  const close = open + (index % 2 ? 0.25 : -0.25);
  return {
    timestamp: start + index,
    open,
    high: Math.max(open, close) + 0.25,
    low: Math.min(open, close) - 0.25,
    close,
    volume: 500,
    trades: 20,
    askVolume,
    bidVolume,
    delta: askVolume - bidVolume,
    deltaOpen: 0,
    deltaHigh: Math.max(0, askVolume - bidVolume),
    deltaLow: Math.min(0, askVolume - bidVolume),
    deltaClose: askVolume - bidVolume,
  };
});
const chartTimes = new Map(candles.map((candle, index) => [candle.timestamp, 10_000 + index]));
const alignment = buildEventIndicatorTimeMap(candles, chartTimes);
assert.ok(alignment);
assert.equal(alignment.exact.size, candles.length);
assert.equal(alignment.uniqueSecond.size, 0, "a crowded event second must never pick an arbitrary bar");

const theme = {
  primary: "#fff",
  secondary: "#aaa",
  positive: "#0f0",
  negative: "#f00",
  muted: "#777",
};
const instance = (indicatorId, settings = {}) => ({
  instanceId: `${indicatorId}-test`,
  indicatorId,
  enabled: true,
  settings,
});

for (const indicatorId of [
  "volume",
  "delta-bar",
  "cumulative-volume-delta",
  "delta-cumulative-candlestick",
  "delta-cumulative-histogram",
  "moving-average",
  "average-true-range-atr",
  "vwap",
]) {
  const raw = calculateIndicatorSeries(instance(indicatorId), candles, theme, {
    instrument: "NQ",
    tickSize: 0.25,
  });
  assert.ok(raw.length, `${indicatorId} must produce a series on exact 500V candles`);
  const aligned = alignIndicatorSeriesToEventBars(raw, alignment);
  assert.equal(
    aligned.reduce((sum, series) => sum + series.data.length, 0),
    raw.reduce((sum, series) => sum + series.data.length, 0),
    `${indicatorId} must not lose points during event-axis alignment`,
  );
  for (const series of aligned.filter((candidate) => candidate.data.length)) {
    assert.equal(
      new Set(series.data.map((point) => Number(point.time))).size,
      series.data.length,
      `${indicatorId}/${series.key} must retain a unique chart slot per event bar`,
    );
    assert.ok(
      series.data.every((point) => Number(point.time) >= 10_000),
      `${indicatorId}/${series.key} must be remapped onto price-bar chart time`,
    );
  }
}

const cvdBars = sessionCvdBars(candles);
assert.equal(cvdBars.length, candles.length);
assert.equal(new Set(cvdBars.map((bar) => bar.time)).size, candles.length);

const highlights = calculateDeltaPercentHighlights(
  instance("delta-highlight", { minValue: 0 }),
  candles,
);
assert.equal(highlights.length, candles.length);
assert.equal(new Set(highlights.map((point) => point.time)).size, candles.length);

const chartSource = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
assert.match(
  chartSource,
  /\[candles, chartReadyRevision, timeframe\]/,
  "event indicator alignment must recompute after the price-series time map is installed",
);
assert.doesNotMatch(
  chartSource,
  /eventChartSeriesTimeBySecond/,
  "event indicators must never regress to a second-keyed map",
);

console.log("event indicator alignment: all high-frequency 500V checks passed");
