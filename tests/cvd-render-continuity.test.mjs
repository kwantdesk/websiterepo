import test from "node:test";
import assert from "node:assert/strict";
import { indicatorCandleSnapshotChanged } from "../src/lib/chartLiveEvents.ts";
import { cvdSeriesRegressed } from "../src/lib/cvdRenderContinuity.ts";
import { createPaneCoordinateCache, resolvePaneCoordinate } from "../src/lib/paneCoordinateContinuity.ts";

const candle = (timestamp, delta) => ({
  timestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
  volume: 100,
  askVolume: 50 + delta,
  bidVolume: 50,
  delta,
});

const series = (times, breaks = []) => [{
  key: "cvd-instance",
  label: "CVD",
  kind: "candlestick",
  placement: "pane",
  color: "green",
  data: times.map((time, index) => ({
    time,
    open: index,
    high: index + 2,
    low: index - 1,
    close: index + 1,
    breakBefore: breaks.includes(index),
  })),
}];

test("same-shape order-flow corrections are detected atomically", () => {
  const previous = [candle(1_000, 10), candle(2_000, 12)];
  const corrected = [previous[0], candle(2_000, -18)];
  assert.equal(indicatorCandleSnapshotChanged(previous, corrected), true);
  assert.equal(indicatorCandleSnapshotChanged(previous, [...previous]), false);
});

test("CVD retains a proven frame across transient empty, shorter and newly fragmented snapshots", () => {
  const proven = series(Array.from({ length: 100 }, (_, index) => index + 1), [0]);
  assert.equal(cvdSeriesRegressed(proven, []), true);
  assert.equal(cvdSeriesRegressed(proven, series(Array.from({ length: 80 }, (_, index) => index + 1), [0])), true);
  assert.equal(cvdSeriesRegressed(proven, series(Array.from({ length: 100 }, (_, index) => index + 1), [0, 50])), true);
  assert.equal(cvdSeriesRegressed(proven, series(Array.from({ length: 101 }, (_, index) => index + 1), [0])), false);
});

test("pane coordinates survive a same-scope chart rebuild but never cross chart scopes", () => {
  const cache = createPaneCoordinateCache("NQ:1m");
  assert.equal(resolvePaneCoordinate(cache, "NQ:1m", 100, () => 42), 42);
  assert.equal(resolvePaneCoordinate(cache, "NQ:1m", 100, () => null), 42);
  assert.equal(resolvePaneCoordinate(cache, "ES:1m", 100, () => null), null);
});
