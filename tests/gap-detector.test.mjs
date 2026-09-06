import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { detectGapZones, normalizeGapDetectorSettings } from "../src/lib/gapDetector.ts";
import { GapZonePrimitive } from "../src/lib/gapZonePrimitive.ts";

const theme = { primary: "#d4af37", secondary: "#94a3b8", positive: "#22c55e", negative: "#ef4444", muted: "#64748b" };
const candle = (iso, open, high, low, close) => ({ timestamp: Date.parse(iso), open, high, low, close, volume: 1 });
const instance = (settings = {}) => ({
  instanceId: "gap-test", indicatorId: "gap-detector", enabled: true,
  settings: { ...defaultIndicatorSettings("gap-detector"), ...settings },
});

test("tick gaps use exact instrument tick size and close only on a complete fill", () => {
  const candles = [
    candle("2026-07-06T14:00:00Z", 98, 100, 97, 99),
    candle("2026-07-06T14:01:00Z", 106, 108, 105, 107),
    candle("2026-07-06T14:02:00Z", 106, 107, 103, 104),
    candle("2026-07-06T14:03:00Z", 103, 104, 100, 101),
  ];
  const { zones } = detectGapZones(candles, { gapMode: "always", calculationMode: "tick", tickValue: 20, triggerWholeBar: true }, 0.25);
  assert.deepEqual(zones, [{ direction: "up", startTime: candles[1].timestamp / 1000, endTime: candles[3].timestamp / 1000, low: 100, high: 105 }]);
});

test("touch mode retires a gap on first interaction and detects bearish gaps", () => {
  const candles = [
    candle("2026-07-06T14:00:00Z", 110, 112, 110, 111),
    candle("2026-07-06T14:01:00Z", 104, 105, 102, 103),
    candle("2026-07-06T14:02:00Z", 104, 108, 103, 107),
  ];
  const { zones } = detectGapZones(candles, { gapMode: "always", tickValue: 20, triggerWholeBar: false }, 0.25);
  assert.deepEqual(zones, [{ direction: "down", startTime: candles[1].timestamp / 1000, endTime: candles[2].timestamp / 1000, low: 105, high: 110 }]);
});

test("Day begin checks the exchange calendar and percentage mode enforces its threshold", () => {
  const candles = [
    candle("2026-01-02T05:50:00Z", 99, 100, 98, 100), // Jan 1, 23:50 Chicago
    candle("2026-01-02T06:00:00Z", 103, 104, 102, 103), // Jan 2, 00:00 Chicago
    candle("2026-01-02T06:10:00Z", 106, 108, 105, 107),
  ];
  const detected = detectGapZones(candles, { gapMode: "day-begin", calculationMode: "percent", percentValue: 1 }, 0.25);
  assert.equal(detected.zones.length, 1);
  assert.deepEqual({ low: detected.zones[0].low, high: detected.zones[0].high }, { low: 100, high: 102 });
  assert.equal(detectGapZones(candles, { gapMode: "day-begin", calculationMode: "percent", percentValue: 3 }, 0.25).zones.length, 0);
});

test("settings normalize to the observed DeepCharts contract and safe ranges", () => {
  assert.deepEqual(normalizeGapDetectorSettings({ gapMode: "bad", calculationMode: "bad", percentValue: -1, tickValue: Infinity, triggerWholeBar: false, backgroundOpacity: 120, useThemeColors: false }), {
    gapMode: "day-begin", calculationMode: "tick", percentValue: 0, tickValue: 20,
    triggerWholeBar: false, backgroundOpacity: 100, useThemeColors: false,
  });
});

test("both plot roles follow the theme and survive custom-color persistence", () => {
  const candles = [
    candle("2026-07-06T14:00:00Z", 100, 101, 99, 100),
    candle("2026-07-06T14:01:00Z", 103, 104, 102, 103),
  ];
  assert.deepEqual(calculateIndicatorSeries(instance({ gapMode: "always", tickValue: 1 }), candles, theme, { tickSize: 0.25 }).map((series) => series.color), [theme.positive, theme.negative]);
  const custom = instance({ gapMode: "always", tickValue: 1, useThemeColors: false, upColor: "#112233", downColor: "#445566" });
  const restored = normalizePaneIndicatorState(JSON.parse(JSON.stringify({ pane: [custom] }))).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored, candles, theme, { tickSize: 0.25 }).map((series) => series.color), ["#112233", "#445566"]);
});

test("canvas primitive projects zones in chart time and price space", () => {
  const painted = [];
  const primitive = new GapZonePrimitive();
  primitive.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time) => Number(time) }) },
    series: { priceToCoordinate: (price) => price * 2 }, requestUpdate() {},
  });
  primitive.update({ zones: [{ direction: "up", startTime: 10, endTime: 30, low: 20, high: 25 }], opacity: 0.4 }, "#abcdef");
  const context = {
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    fillRect: (...args) => painted.push(args), set globalAlpha(_) {}, set fillStyle(_) {},
  };
  primitive.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (draw) => draw({ context, mediaSize: { width: 100, height: 100 } }) });
  assert.deepEqual(painted, [[10, 40, 20, 10]]);
});

test("release gates and the exact settings controls are reachable", () => {
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "gap-detector"));
  const source = readFileSync("src/components/ChartIndicatorsControl.tsx", "utf8")
    + readFileSync("src/lib/chartIndicatorConfig.ts", "utf8");
  for (const evidence of ["Gap detection mode", "Day begin", "Percentual", "Background opacity"]) assert.match(source, new RegExp(evidence, "i"));
});
