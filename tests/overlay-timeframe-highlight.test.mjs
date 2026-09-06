import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { buildOverlayTimeframeHighlightBuckets, normalizeOverlayTimeframeHighlightSettings } from "../src/lib/overlayTimeframeHighlight.ts";

const theme = { primary: "#ffee00", secondary: "#7788ff", positive: "#00ee66", negative: "#ff2255", muted: "#222222" };
const bar = (minute, open, high, low, close, volume = 10, trades = 2, askVolume = 6, bidVolume = 4) => ({ timestamp: minute * 60_000, open, high, low, close, volume, trades, askVolume, bidVolume });

test("parameter types produce bounded minute, hour and day intervals", () => {
  assert.equal(normalizeOverlayTimeframeHighlightSettings({ parameterType: "minutes", parameter1: 15 }).intervalMs, 900_000);
  assert.equal(normalizeOverlayTimeframeHighlightSettings({ parameterType: "hours", parameter1: 4 }).intervalMs, 14_400_000);
  assert.equal(normalizeOverlayTimeframeHighlightSettings({ parameterType: "days", parameter1: 2 }).intervalMs, 172_800_000);
  const bounded = normalizeOverlayTimeframeHighlightSettings({ parameterType: "hours", parameter1: 999, bodyOpacity: -5, shadowOpacity: 999, borderWidth: 8 });
  assert.deepEqual([bounded.parameter1, bounded.bodyOpacity, bounded.shadowOpacity, bounded.borderWidth], [168, 0, 100, 4]);
});

test("higher-timeframe buckets preserve OHLC and sum real summaries", () => {
  const buckets = buildOverlayTimeframeHighlightBuckets([
    bar(0, 100, 102, 99, 101), bar(1, 101, 104, 100, 103, 20, 3, 14, 6),
    bar(5, 103, 105, 101, 102, 30, 4, 10, 20),
  ], 5 * 60_000);
  assert.equal(buckets.length, 2);
  assert.deepEqual({ open: buckets[0].open, high: buckets[0].high, low: buckets[0].low, close: buckets[0].close }, { open: 100, high: 104, low: 99, close: 103 });
  assert.deepEqual([buckets[0].volume, buckets[0].trades, buckets[0].askVolume, buckets[0].bidVolume], [30, 5, 20, 10]);
});

test("invalid or duplicate source bars do not bridge highlight geometry", () => {
  const buckets = buildOverlayTimeframeHighlightBuckets([
    bar(0, 100, 102, 99, 101), bar(1, 101, 103, 100, 102), bar(1, 102, 104, 101, 103), bar(2, 103, 105, 102, 104),
  ], 5 * 60_000);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].lastTime, 60_000);
  assert.equal(buckets[1].firstTime, 120_000);
});

test("engine exposes the full primitive model with theme ownership", () => {
  const instance = { instanceId: "h", indicatorId: "overlay-timeframe-highlight", enabled: true, settings: { parameterType: "minutes", parameter1: 5, targetEnabled: true, summaryEnabled: true } };
  const result = calculateIndicatorSeries(instance, [bar(0, 100, 102, 99, 101), bar(5, 101, 104, 100, 103)], theme);
  assert.equal(result.length, 1);
  assert.equal(result[0].lineVisible, false);
  assert.equal(result[0].excludeFromAutoScale, true);
  assert.equal(result[0].overlayTimeframeHighlight.buckets.length, 2);
  assert.deepEqual(result[0].overlayTimeframeHighlight.colors, { up: theme.positive, down: theme.negative, high: theme.positive, low: theme.negative, text: theme.primary, summary: theme.primary, ask: theme.positive, bid: theme.negative });
});

test("settings, persistence, renderer and catalogue gates are connected", () => {
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "overlay-timeframe-highlight"));
  const defaults = defaultIndicatorSettings("overlay-timeframe-highlight");
  assert.equal(defaults.parameter1, 15);
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "h", indicatorId: "overlay-timeframe-highlight", enabled: true, settings: { ...defaults, parameterType: "hours", parameter1: 4, summaryEnabled: true, targetLineStyle: "dotted" } }] }).pane[0];
  assert.deepEqual([restored.settings.parameterType, restored.settings.parameter1, restored.settings.summaryEnabled, restored.settings.targetLineStyle], ["hours", 4, true, "dotted"]);
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  const chart = fs.readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  for (const label of ["Parameter type", "Colour based on delta", "Show range background", "Range targets", "Volume summary", "Trade summary"]) assert.match(control, new RegExp(label, "i"));
  assert.match(chart, /OverlayTimeframeHighlightPrimitive/);
});
