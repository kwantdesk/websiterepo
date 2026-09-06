import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { resolveMarketSessions } from "../src/lib/marketSessions.ts";
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
  assert.equal(settings.asianStartTime, "16:00");
  assert.equal(settings.europeStartTime, "03:00");
  assert.equal(settings.europeEndTime, "09:30");
  assert.equal(settings.usaStartTime, "09:30");
  assert.equal(settings.allowSessionOverlap, false);
  assert.equal(settings.lineWidth, 4);
  assert.equal(settings.textSize, 6);
  assert.equal(settings.usaImbalanceMinutes, 240);
});

test("stock sessions hand off exactly once and custom overlaps remain opt-in", () => {
  const candles = [];
  const start = Date.parse("2026-09-08T07:00:00Z"); // 03:00 New York
  for (let index = 0; index < 28; index += 1) {
    const price = 100 + index;
    candles.push({ timestamp: start + index * 30 * 60_000, open: price, high: price + 1, low: price - 1, close: price + 0.5, volume: 10 });
  }
  const stock = buildSessionMarkerWindows(candles, {}, 30 * 60_000);
  const europe = stock.find((window) => window.markerKey === "europe");
  const usa = stock.find((window) => window.markerKey === "usa");
  assert.ok(europe && usa);
  assert.equal(europe.endTimestamp, usa.startTimestamp, "the 09:30 candle is owned by USA only");
  assert.ok(europe.close < usa.open, "Europe OHLC must be recalculated without the hand-off candle");

  const overlapping = buildSessionMarkerWindows(candles, {
    europeEndTime: "11:00",
    allowSessionOverlap: true,
    sessionMarkerSettingsVersion: 2,
  }, 30 * 60_000);
  const overlappingEurope = overlapping.find((window) => window.markerKey === "europe");
  const overlappingUsa = overlapping.find((window) => window.markerKey === "usa");
  assert.ok(overlappingEurope.endTimestamp > overlappingUsa.startTimestamp);
});

test("legacy stock clocks migrate but genuine custom clocks survive", () => {
  const migrated = normalizeSessionMarkerSettings({ asianStartTime: "15:00", europeEndTime: "11:00", sessionMarkerSettingsVersion: 1 });
  assert.equal(migrated.asianStartTime, "16:00");
  assert.equal(migrated.europeEndTime, "09:30");
  const custom = normalizeSessionMarkerSettings({ asianStartTime: "17:15", europeEndTime: "10:15", sessionMarkerSettingsVersion: 1 });
  assert.equal(custom.asianStartTime, "17:15");
  assert.equal(custom.europeEndTime, "10:15");
});

test("Sessions overlay uses the same exchange-time hand-off contract", () => {
  const restored = normalizePaneIndicatorState({ pane: [{
    instanceId: "legacy-sessions",
    indicatorId: "sessions",
    enabled: true,
    settings: { tokyoStart: "09:00", londonEnd: "17:00", sessionsSettingsVersion: 1 },
  }] }).pane[0];
  const sessions = resolveMarketSessions(restored.settings).filter((session) => session.key !== "sydney");
  assert.deepEqual(sessions.map(({ label, timezone, start, end }) => ({ label, timezone, start, end })), [
    { label: "Asia", timezone: "America/New_York", start: "16:00", end: "03:00" },
    { label: "London", timezone: "America/New_York", start: "03:00", end: "09:30" },
    { label: "New York", timezone: "America/New_York", start: "09:30", end: "16:00" },
  ]);
  assert.equal(restored.settings.allowSessionOverlap, false);
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
  for (const label of ["Time reference", "Line style", "Asian", "Europe", "USA", "Start session", "End session", "Allow custom overlaps", "Session VWAP"])
    assert.match(settingsSource, new RegExp(label, "i"));
});
