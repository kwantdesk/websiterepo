import assert from "node:assert/strict";
import test from "node:test";

import { CHART_INDICATOR_BY_ID } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateKwantStats } from "../src/lib/kwantStats.ts";

const candle = { timestamp: 1_000, open: 100, high: 102, low: 99, close: 101, volume: 40, trades: 4, askVolume: 25, bidVolume: 15, delta: 10, deltaHigh: 15, deltaLow: -5 };
const makeTrade = (timestamp, price, aggressor, volume, delta) => ({
  timestamp, close: price, open: price, high: price, low: price, volume, trades: 1,
  askVolume: aggressor === "BUY" ? volume : 0, bidVolume: aggressor === "SELL" ? volume : 0,
  delta, aggressor, recordIndex: timestamp,
});

test("ordered executions drive COT, trade delta and price-level ratios", () => {
  const instance = { instanceId: "s", indicatorId: "kwant-stats", enabled: true, settings: { ...defaultIndicatorSettings("kwant-stats"), showCotHigh: true, showCotLow: true, showDeltaTrades: true, showHighRatio: true, showLowRatio: true } };
  const table = calculateKwantStats([candle], [
    makeTrade(1_000, 99, "SELL", 8, -8),
    makeTrade(1_100, 101.75, "BUY", 12, 12),
    makeTrade(1_200, 102, "BUY", 5, 5),
    makeTrade(1_300, 101, "SELL", 15, -15),
  ], instance, 0.25, { positive: "#00ff00", negative: "#ff0000", neutral: "#888888", text: "#ffffff", header: "#111111" });
  const values = table.bars[0].values;
  assert.equal(values.cotHigh, -6);
  assert.equal(values.cotLow, -10);
  assert.equal(values.deltaTrades, 0);
  assert.equal(values.maxDeltaVolume, 15);
  assert.equal(values.minDeltaVolume, -5);
});

test("Order filters use trade count while Aggregate Volume filters use volume", () => {
  const base = { ...defaultIndicatorSettings("kwant-stats"), filterMin: 10 };
  const colors = { positive: "#0f0", negative: "#f00", neutral: "#888", text: "#fff", header: "#111" };
  const orders = calculateKwantStats([candle], [], { instanceId: "o", indicatorId: "kwant-stats", enabled: true, settings: { ...base, inputData: "Order" } }, 0.25, colors);
  const aggregate = calculateKwantStats([candle], [], { instanceId: "a", indicatorId: "kwant-stats", enabled: true, settings: { ...base, inputData: "Aggregate Volume" } }, 0.25, colors);
  assert.equal(orders.bars[0].values.totalVolume, null);
  assert.equal(aggregate.bars[0].values.totalVolume, 40);
});

test("On Candle Stats is retired from the catalogue and saved charts", () => {
  assert.equal(CHART_INDICATOR_BY_ID.has("on-candle-stats"), false);
  const state = normalizePaneIndicatorState({ pane: [
    { instanceId: "retired", indicatorId: "on-candle-stats", enabled: true },
    { instanceId: "keep", indicatorId: "kwant-stats", enabled: true },
  ] });
  assert.deepEqual(state.pane.map(({ instanceId }) => instanceId), ["keep"]);
});

test("Kwant Stats uses per-bar ask minus bid even with cached or session-relative delta", () => {
  const instance = { instanceId: "stats", indicatorId: "kwant-stats", enabled: true };
  const colors = { positive: "#0f0", negative: "#f00", neutral: "#888", text: "#fff", header: "#111" };
  const bars = calculateKwantStats([
    { ...candle, delta: -20, deltaClose: 0 },
    { ...candle, timestamp: 61_000, askVolume: 12, bidVolume: 28,
      deltaOpen: 250, deltaClose: 234, deltaHigh: 253, deltaLow: 230 },
    { ...candle, timestamp: 121_000, askVolume: undefined, bidVolume: undefined, deltaClose: 10 },
  ], [], instance, 0.25, colors).bars.map(bar => bar.values);

  assert.deepEqual(bars.map(bar => bar.totalVolume), [40, 40, 40]);
  assert.deepEqual(bars.map(bar => bar.deltaVolume), [10, -16, null]);
  assert.deepEqual(bars.map(bar => bar.deltaPercent), [25, -40, null]);
  assert.deepEqual(bars.map(bar => bar.sessionCvd), [10, -6, null]);
  assert.deepEqual(bars.map(bar => [bar.maxDeltaVolume, bar.minDeltaVolume]), [[15, -5], [3, -20], [null, null]]);
});
