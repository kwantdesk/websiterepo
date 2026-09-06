import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { calculateShiftCandle, normalizeShiftCandleSettings } from "../src/lib/shiftCandle.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

const candle = (index, open, high, low, close) => ({ timestamp: (index + 1) * 60_000, open, high, low, close, volume: 100 });
const row = (tickIndex, bidVolume, askVolume, isBidImbalance = false, isAskImbalance = false) => ({
  tickIndex, price: tickIndex, bidVolume, askVolume, totalVolume: bidVolume + askVolume,
  isBidImbalance, isAskImbalance,
});
const flow = (index, delta, deltaPercent, pocTick, rows = []) => ({
  id: `b${index}`, timestamp: (index + 1) * 60_000, startTime: (index + 1) * 60_000,
  delta, deltaPercent, pocTick, rows, hasPriceLevelFlow: true,
});

const candles = [
  candle(0, 101, 103, 100, 102),
  candle(1, 102, 102, 99, 100),
  candle(2, 100, 101, 98, 99),
  candle(3, 99, 103, 99, 103),
  candle(4, 103, 104, 102, 103),
];
const bars = [
  flow(0, 0, 0, 101), flow(1, -50, -10, 100), flow(2, -200, -60, 98),
  flow(3, 250, 70, 102, [row(102, 10, 80, false, true)]), flow(4, 5, 2, 103),
];

test("Shift Candle confirms a no-lookahead structure/delta/POC/imbalance reversal", () => {
  const settings = { highestLowestLookback: 2, minimumTickBreakout: 1, minimumDeltaValueDifference: 100,
    minimumDeltaPercentDifference: 20, maximumTickPocDistance: 1, minimumImbalancePercent: 300,
    minimumImbalanceVolumeDifference: 20 };
  assert.equal(calculateShiftCandle(candles.slice(0, 3), bars.slice(0, 3), settings, 1).signals.length, 0);
  const result = calculateShiftCandle(candles, bars, settings, 1);
  assert.equal(result.status, "ready");
  assert.equal(result.signals.length, 1);
  assert.deepEqual([result.signals[0].direction, result.signals[0].candidateIndex, result.signals[0].confirmationIndex], ["buy", 2, 3]);
  assert.equal(result.buyZones.length, 1);
});

test("Shift Candle fails closed without exact price-level executions", () => {
  const result = calculateShiftCandle(candles, bars.map((bar) => ({ ...bar, hasPriceLevelFlow: false, pocTick: null })), { highestLowestLookback: 2 }, 1);
  assert.equal(result.status, "waiting-for-executions");
  assert.equal(result.signals.length, 0);
});

test("settings are bounded, persisted and the catalogue release gate is real", () => {
  const normalized = normalizeShiftCandleSettings({ maxBarsAfterReversal: 0, highestLowestLookback: 1, minimumImbalancePercent: 1, zoneOpacity: 999, plotPrice: "bad" });
  assert.deepEqual([normalized.maxBarsAfterReversal, normalized.highestLowestLookback, normalized.minimumImbalancePercent, normalized.zoneOpacity, normalized.plotPrice], [1, 2, 100, 100, "high-low"]);
  const defaults = defaultIndicatorSettings("shift-candle");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "s", indicatorId: "shift-candle", enabled: true, settings: { ...defaults, maximumTickPocDistance: 7, imbalanceEnabled: false } }] }).pane[0];
  assert.deepEqual([restored.settings.maximumTickPocDistance, restored.settings.imbalanceEnabled], [7, false]);
  assert.ok(!auditIndicatorLibrary().pending.some((entry) => entry.id === "shift-candle"));
});

test("published controls and exact footprint runtime are wired", () => {
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const config = fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  for (const label of ["Maximum bars after reversal", "Minimum tick breakout", "Minimum delta % difference", "Maximum tick POC distance", "Highest / lowest reversal lookback", "Require footprint imbalance", "Fresh zones", "Plot price"]) assert.match(`${control}\n${config}`, new RegExp(label, "i"));
  assert.match(chart, /shiftCandleBars/);
  assert.match(chart, /buildFootprintBarsCached\(shiftCandleBuildCacheRef/);
});
