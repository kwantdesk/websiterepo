import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, LIVE_CHART_INDICATOR_IDS, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { detectFairValueGaps, normalizeFairValueGapSettings } from "../src/lib/fairValueGap.ts";

const theme = { primary: "#fff000", secondary: "#00aaff", positive: "#00ff55", negative: "#ff2255", muted: "#666666" };
const candle = (timestamp, open, high, low, close) => ({ timestamp, open, high, low, close, volume: 1 });
const from = (rows, start = Date.parse("2026-09-08T14:00:00Z")) => rows.map((row, index) => candle(start + index * 60_000, ...row));

test("official defaults and safe bounds are retained", () => {
  assert.deepEqual(normalizeFairValueGapSettings({}), {
    minNumTicks: 10, maxNumTicks: 0, lineWidth: 1, backgroundOpacity: 40,
    resetStartDay: true, removeOnShadowTriggered: false, maxBarsExtension: 0,
    breakoutPercent: 35, useThemeColors: true, upColor: "#22C55E", downColor: "#EF4444",
  });
  const bounded = normalizeFairValueGapSettings({ minNumTicks: -4, maxNumTicks: Infinity, lineWidth: 99, backgroundOpacity: -1, maxBarsExtension: -1, breakoutPercent: 120 });
  assert.deepEqual([bounded.minNumTicks, bounded.maxNumTicks, bounded.lineWidth, bounded.backgroundOpacity, bounded.maxBarsExtension, bounded.breakoutPercent], [0, 0, 8, 0, 0, 100]);
});

test("three-candle bullish and bearish gaps use the instrument tick size", () => {
  const bullish = from([[99, 100, 98, 99], [100, 104, 99, 103], [106, 108, 105, 107]]);
  assert.deepEqual(detectFairValueGaps(bullish, { minNumTicks: 20 }, 0.25).zones.map(({ direction, low, high }) => ({ direction, low, high })), [
    { direction: "up", low: 100, high: 105 },
  ]);
  const bearish = from([[111, 112, 110, 111], [109, 111, 104, 105], [103, 104, 102, 103]]);
  assert.deepEqual(detectFairValueGaps(bearish, { minNumTicks: 20 }, 0.25).zones.map(({ direction, low, high }) => ({ direction, low, high })), [
    { direction: "down", low: 104, high: 110 },
  ]);
});

test("minimum and zero-as-unlimited maximum filters follow the public contract", () => {
  const rows = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107]]);
  assert.equal(detectFairValueGaps(rows, { minNumTicks: 21 }, 0.25).zones.length, 0);
  assert.equal(detectFairValueGaps(rows, { minNumTicks: 1, maxNumTicks: 19 }, 0.25).zones.length, 0);
  assert.equal(detectFairValueGaps(rows, { minNumTicks: 1, maxNumTicks: 0 }, 0.25).zones.length, 1);
});

test("wick versus close mitigation and breakout percentage terminate at the correct bar", () => {
  const rows = from([
    [99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107],
    [106, 107, 103, 106], [103, 104, 99, 100],
  ]);
  const body = detectFairValueGaps(rows, { minNumTicks: 1, breakoutPercent: 35, removeOnShadowTriggered: false }, 0.25).zones[0];
  const wick = detectFairValueGaps(rows, { minNumTicks: 1, breakoutPercent: 35, removeOnShadowTriggered: true }, 0.25).zones[0];
  assert.equal(body.endTime, rows[4].timestamp / 1000);
  assert.equal(wick.endTime, rows[3].timestamp / 1000);
});

test("maximum extension and trading-day reset stop zones without inventing future time", () => {
  const rows = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107], [107, 109, 106, 108], [108, 110, 107, 109]]);
  const limited = detectFairValueGaps(rows, { minNumTicks: 1, maxBarsExtension: 1 }, 0.25).zones[0];
  assert.equal(limited.endTime, rows[3].timestamp / 1000);
  assert.equal(limited.extendToRight, false);

  const aroundReset = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107], [107, 109, 106, 108]], Date.parse("2026-09-08T21:57:00Z"));
  const reset = detectFairValueGaps(aroundReset, { minNumTicks: 1, resetStartDay: true }, 0.25).zones[0];
  assert.equal(reset.endTime, aroundReset[2].timestamp / 1000);
  assert.equal(reset.extendToRight, false);
});

test("invalid and out-of-order candles are hard boundaries", () => {
  const rows = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107], [107, 109, 106, 108]]);
  rows[1] = { ...rows[1], high: Number.NaN };
  assert.equal(detectFairValueGaps(rows, { minNumTicks: 1 }, 0.25).zones.length, 0);
  const reversed = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107]]);
  reversed[1] = { ...reversed[1], timestamp: reversed[0].timestamp };
  assert.equal(detectFairValueGaps(reversed, { minNumTicks: 1 }, 0.25).zones.length, 0);
});

test("theme and custom colours survive normalization and reach both plots", () => {
  const candles = from([[99, 100, 98, 99], [101, 104, 100, 103], [106, 108, 105, 107]]);
  const instance = { instanceId: "fvg", indicatorId: "fvg-identifier", enabled: true, settings: defaultIndicatorSettings("fvg-identifier") };
  assert.deepEqual(calculateIndicatorSeries(instance, candles, theme, { tickSize: 0.25 }).map(series => series.color), [theme.positive, theme.negative]);
  const restored = normalizePaneIndicatorState({ pane: [{ ...instance, settings: { ...instance.settings, useThemeColors: false, upColor: "#123456", downColor: "#abcdef" } }] }).pane[0];
  assert.deepEqual(calculateIndicatorSeries(restored, candles, theme, { tickSize: 0.25 }).map(series => series.color), ["#123456", "#abcdef"]);
});

test("release gates, renderer and every official control are reachable", () => {
  assert.ok(LIVE_CHART_INDICATOR_IDS.has("fvg-identifier"));
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "fvg-identifier"));
  const controls = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8")
    + fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8");
  for (const label of ["Min num ticks", "Max num ticks", "Line width", "Back opacity", "Reset Start Day", "Remove Line On Shadow Triggered", "Max bars extension", "% breakout"])
    assert.match(controls, new RegExp(label, "i"));
  assert.match(fs.readFileSync(new URL("../src/lib/gapZonePrimitive.ts", import.meta.url), "utf8"), /strokeRect/);
});

test("twenty thousand bars remain bounded", () => {
  const candles = Array.from({ length: 20_000 }, (_, index) => {
    const base = index * 0.25;
    return candle(index * 60_000 + 1, base, base + 1, base - 1, base + 0.25);
  });
  const started = performance.now();
  detectFairValueGaps(candles, { minNumTicks: 1, resetStartDay: false }, 0.25);
  assert.ok(performance.now() - started < 300);
});
