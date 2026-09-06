import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import {
  buildSessionMarkerLevels,
  buildSessionMarkerWindows,
  normalizeSessionMarkerSettings,
} from "../src/lib/sessionMarker.ts";

const hourlyCandles = () => {
  const candles = [];
  const start = Date.parse("2026-09-08T18:00:00Z");
  for (let index = 0; index < 28; index += 1) {
    const open = 100 + index;
    candles.push({
      timestamp: start + index * 3_600_000,
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: index + 1,
    });
  }
  candles.push({ timestamp: Date.parse("2026-09-09T13:30:00Z"), open: 140, high: 144, low: 138, close: 143, volume: 50 });
  return candles.sort((left, right) => left.timestamp - right.timestamp);
};

test("Session Marker normalizes the recovered reference defaults and bounds", () => {
  const settings = normalizeSessionMarkerSettings({ lineWidth: 99, textSize: 2, usaImbalanceMinutes: 999 });
  assert.equal(settings.asianStartTime, "15:00");
  assert.equal(settings.europeStartTime, "03:00");
  assert.equal(settings.usaStartTime, "09:30");
  assert.equal(settings.lineWidth, 4);
  assert.equal(settings.textSize, 6);
  assert.equal(settings.usaImbalanceMinutes, 240);
});

test("Session Marker builds DST-aware Asian, Europe and USA windows from real OHLCV bars", () => {
  const windows = buildSessionMarkerWindows(hourlyCandles(), {}, 3_600_000);
  const latest = new Map(windows.map((window) => [window.markerKey, window]));
  assert.deepEqual([...latest.keys()].sort(), ["asian", "europe", "usa"]);
  for (const window of latest.values()) {
    assert.ok(window.high > window.low);
    assert.ok(window.imbalanceHigh >= window.imbalanceLow);
    assert.ok(window.vwap >= window.low && window.vwap <= window.high);
  }
});

test("level switches control imbalance, midpoint and VWAP without inventing observations", () => {
  const windows = buildSessionMarkerWindows(hourlyCandles(), {
    asianEnabled: false,
    europeEnabled: false,
    usaVwapEnabled: true,
    showMidPrice: false,
    showImbalanceRange: false,
  }, 3_600_000);
  const levels = buildSessionMarkerLevels(windows, {
    usaVwapEnabled: true,
    showMidPrice: false,
    showImbalanceRange: false,
  }, 3_600_000);
  assert.ok(levels.some((level) => level.role === "vwap"));
  assert.ok(!levels.some((level) => level.role === "mid"));
  assert.ok(!levels.some((level) => level.role === "imbalanceHigh" || level.role === "imbalanceLow"));
});

test("settings persist and the catalogue no longer reports Session Marker as Pending", () => {
  const instance = {
    instanceId: "session-marker-1",
    indicatorId: "session-marker",
    enabled: true,
    settings: { ...defaultIndicatorSettings("session-marker"), usaStartTime: "10:15", usaVwapEnabled: true },
  };
  const restored = normalizePaneIndicatorState({ pane: [instance] }).pane[0];
  assert.equal(restored.settings.usaStartTime, "10:15");
  assert.equal(restored.settings.usaVwapEnabled, true);
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "session-marker"));

  const settingsSource = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  for (const label of ["Time reference", "Line style", "Asian", "Europe", "USA", "Start session", "End session"])
    assert.match(settingsSource, new RegExp(label, "i"));
});
