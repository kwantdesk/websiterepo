import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { calculateVolumeDeltaSprintPoints, normalizeVolumeDeltaSprintSettings } from "../src/lib/volumeDeltaSprint.ts";

const theme = { primary: "#eeeeee", secondary: "#8888ff", positive: "#00ff55", negative: "#ff2244", muted: "#202020" };
const candle = (timestamp, askVolume, bidVolume, askTrades = askVolume / 10, bidTrades = bidVolume / 10) => ({ timestamp, open: 100, high: 101, low: 99, close: 100, askVolume, bidVolume, askTrades, bidTrades, volume: askVolume + bidVolume });

test("settings normalize to the documented defaults and bounds", () => {
  const defaults = normalizeVolumeDeltaSprintSettings({});
  assert.equal(defaults.length, 10);
  assert.equal(defaults.deltaColorMode, "fading");
  assert.equal(defaults.smoothingType, "simple");
  assert.equal(defaults.smoothingLength, 3);
  assert.equal(defaults.lineWidth, 3);
  const bounded = normalizeVolumeDeltaSprintSettings({ length: 0, smoothingLength: 9999, lineWidth: 8, inputData: "order" });
  assert.deepEqual([bounded.length, bounded.smoothingLength, bounded.lineWidth, bounded.inputData], [1, 1000, 4, "trades"]);
});

test("length is a rolling cumulative ask, bid and delta window", () => {
  const points = calculateVolumeDeltaSprintPoints([
    candle(1000, 10, 4), candle(2000, 7, 8), candle(3000, 20, 5), candle(4000, 1, 9),
  ], { length: 3 });
  assert.deepEqual(points.map(point => [point.ask, point.bid, point.delta]), [[37, 17, 20], [28, 22, 6]]);
});

test("filters apply to the selected side values and zero max is unlimited", () => {
  const points = calculateVolumeDeltaSprintPoints([
    candle(1000, 2, 50), candle(2000, 12, 25), candle(3000, 40, 15),
  ], { length: 2, filterMin: 10, filterMax: 30 });
  assert.deepEqual(points.map(point => [point.ask, point.bid]), [[12, 25], [12, 40]]);
});

test("missing classified flow creates a hard segment and never a false zero bar", () => {
  const points = calculateVolumeDeltaSprintPoints([
    candle(1000, 10, 5), candle(2000, 10, 5),
    { timestamp: 3000, open: 1, high: 2, low: 1, close: 2, volume: 20 },
    candle(4000, 20, 10), candle(5000, 30, 10),
  ], { length: 2 });
  assert.equal(points.length, 2);
  assert.equal(points[0].time, 2);
  assert.equal(points[1].time, 5);
  assert.equal(points[1].breakBefore, true);
});

test("separate Delta, Bid and Ask subgraphs use theme colors and smoothing", () => {
  const instance = { instanceId: "sprint", indicatorId: "volume-delta-sprint", enabled: true, settings: { length: 2, smoothingEnabled: true, smoothingType: "weighted", smoothingLength: 2, showBid: true, showAsk: true } };
  const series = calculateIndicatorSeries(instance, [candle(1000, 10, 5), candle(2000, 20, 10), candle(3000, 40, 15)], theme);
  assert.deepEqual(series.map(item => item.key), ["volume-delta-sprint-delta", "volume-delta-sprint-bid", "volume-delta-sprint-ask"]);
  assert.equal(series[0].data.at(-1).value, (15 + 35 * 2) / 3);
  assert.equal(series[1].data.at(-1).value, -(15 + 25 * 2) / 3);
  assert.equal(series[2].data.at(-1).value, (30 + 60 * 2) / 3);
  assert.equal(series[1].color, theme.negative);
  assert.equal(series[2].color, theme.positive);
});

test("catalogue, controls, defaults and saved settings are wired", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "volume-delta-sprint"));
  const defaults = defaultIndicatorSettings("volume-delta-sprint");
  assert.equal(defaults.length, 10);
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "s", indicatorId: "volume-delta-sprint", enabled: true, settings: { ...defaults, inputData: "trades", showAsk: true, smoothingType: "triangular" } }] }).pane[0];
  assert.equal(restored.settings.inputData, "trades");
  assert.equal(restored.settings.showAsk, true);
  assert.equal(restored.settings.smoothingType, "triangular");
  const source = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  for (const label of ["Input data", "Delta colour mode", "Smoothing average", "Delta subgraph", "Bid subgraph", "Ask subgraph"]) assert.match(source, new RegExp(label, "i"));
});
