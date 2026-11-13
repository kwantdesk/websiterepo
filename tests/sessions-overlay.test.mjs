import assert from "node:assert/strict";
import test from "node:test";
import { normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { buildMarketSessionWindows, resolveMarketSessions } from "../src/lib/marketSessions.ts";

const restore = (settings) => normalizePaneIndicatorState({ pane: [{
    instanceId: "legacy-sessions",
    indicatorId: "sessions",
    enabled: true,
    settings,
  }] }).pane[0].settings;

test("Sessions restores legacy stock clocks with separate Globex and Asia", () => {
  const settings = restore({ tokyoStart: "09:00", londonEnd: "17:00", sessionsSettingsVersion: 1 });
  const sessions = resolveMarketSessions(settings);
  assert.deepEqual(sessions.map(({ label, timezone, start, end }) => ({ label, timezone, start, end })), [
    { label: "Globex", timezone: "America/New_York", start: "18:00", end: "17:00" },
    { label: "Asia", timezone: "Asia/Tokyo", start: "09:00", end: "18:00" },
    { label: "London", timezone: "America/New_York", start: "03:00", end: "09:30" },
    { label: "New York", timezone: "America/New_York", start: "09:30", end: "16:00" },
  ]);
  assert.equal(settings.allowSessionOverlap, false);
});

test("Globex owns the first box and Asia starts at Tokyo open in both US clock seasons", () => {
  const settings = restore({ tokyoStart: "16:00", tokyoEnd: "03:00", tokyoTimezone: "America/New_York", sessionsSettingsVersion: 2 });
  for (const [open, tokyo] of [["2026-07-12T22:00Z", "2026-07-13T00:00Z"], ["2026-11-08T23:00Z", "2026-11-09T00:00Z"]]) {
    const interval = 30 * 60_000;
    const candles = Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.parse(open) + i * interval, open: 100 + i, high: 101 + i, low: 99 + i, close: 100 + i, volume: 1,
    }));
    const windows = buildMarketSessionWindows(candles, settings, interval);
    assert.deepEqual(windows.map(window => window.label), ["Globex", "Asia", "London"]);
    assert.equal(windows[0].startTimestamp, Date.parse(open));
    assert.equal(windows[0].endTimestamp, Date.parse(tokyo));
    assert.equal(windows[1].startTimestamp, Date.parse(tokyo));
    assert.equal(windows[0].high, windows[1].open);
  }
});

test("custom clocks and disabled sessions survive restoration", () => {
  const settings = restore({ sessionsSettingsVersion: 2, showGlobex: false, showTokyo: false, tokyoTimezone: "America/New_York", tokyoStart: "19:45", tokyoEnd: "02:30" });
  assert.equal(settings.tokyoStart, "19:45");
  assert.equal(settings.tokyoEnd, "02:30");
  assert.equal(settings.tokyoTimezone, "America/New_York");
  assert.deepEqual(resolveMarketSessions(settings).map(session => session.key), ["london", "newYork"]);
  assert.deepEqual(restore(settings), settings);
});
