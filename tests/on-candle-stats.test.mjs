import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateKwantStats } from "../src/lib/kwantStats.ts";

const candle = { timestamp: 1_000, open: 100, high: 102, low: 99, close: 101, volume: 40, trades: 4, askVolume: 25, bidVolume: 15, delta: 10, deltaHigh: 15, deltaLow: -5 };
const makeTrade = (timestamp, price, aggressor, volume, delta) => ({
  timestamp, close: price, open: price, high: price, low: price, volume, trades: 1,
  askVolume: aggressor === "BUY" ? volume : 0, bidVolume: aggressor === "SELL" ? volume : 0,
  delta, aggressor, recordIndex: timestamp,
});

test("ordered executions drive COT, trade delta and price-level ratios", () => {
  const instance = { instanceId: "s", indicatorId: "on-candle-stats", enabled: true, settings: { ...defaultIndicatorSettings("on-candle-stats"), showCotHigh: true, showCotLow: true, showDeltaTrades: true, showHighRatio: true, showLowRatio: true } };
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
  const base = { ...defaultIndicatorSettings("on-candle-stats"), filterMin: 10 };
  const colors = { positive: "#0f0", negative: "#f00", neutral: "#888", text: "#fff", header: "#111" };
  const orders = calculateKwantStats([candle], [], { instanceId: "o", indicatorId: "on-candle-stats", enabled: true, settings: { ...base, inputData: "Order" } }, 0.25, colors);
  const aggregate = calculateKwantStats([candle], [], { instanceId: "a", indicatorId: "on-candle-stats", enabled: true, settings: { ...base, inputData: "Aggregate Volume" } }, 0.25, colors);
  assert.equal(orders.bars[0].values.totalVolume, null);
  assert.equal(aggregate.bars[0].values.totalVolume, 40);
});

test("settings persist and the catalogue/renderer gates are genuinely live", () => {
  const defaults = defaultIndicatorSettings("on-candle-stats");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "s", indicatorId: "on-candle-stats", enabled: true, settings: { ...defaults, inputData: "Order", pricePlot: "delta-sign", fontSize: 15, showCotBar: true } }] }).pane[0];
  assert.deepEqual([restored.settings.inputData, restored.settings.pricePlot, restored.settings.fontSize, restored.settings.showCotBar], ["Order", "delta-sign", 15, true]);
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "on-candle-stats"));
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  assert.match(chart, /OnCandleStatsPrimitive/);
  for (const label of ["Input data", "Price plot", "Font size", "Smaller font size", "Maximum opacity ratio", "Price offset"]) assert.match(control + fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8"), new RegExp(label, "i"));
});
