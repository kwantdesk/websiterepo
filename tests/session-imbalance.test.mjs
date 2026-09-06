import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import {
  buildSessionImbalanceLevels,
  normalizeSessionImbalanceSettings,
} from "../src/lib/sessionImbalance.ts";

function minuteSession(startIso, minutes = 70, base = 100) {
  const start = Date.parse(startIso);
  return Array.from({ length: minutes }, (_, index) => ({
    timestamp: start + index * 60_000,
    open: base + index * 0.1,
    high: base + index * 0.1 + 2,
    low: base + index * 0.1 - 1,
    close: base + index * 0.1 + 0.5,
    volume: index + 1,
  }));
}

test("Session Imbalance normalizes the documented 60-minute default and bounds", () => {
  const settings = normalizeSessionImbalanceSettings({ numberOfMinutes: 9999, numberOfDays: -2, lineWidth: 9 });
  assert.equal(normalizeSessionImbalanceSettings({}).numberOfMinutes, 60);
  assert.equal(settings.numberOfMinutes, 1440);
  assert.equal(settings.numberOfDays, 0);
  assert.equal(settings.lineWidth, 4);
});

test("Session Imbalance derives high, low, midpoint and exact 50/100 percent extensions", () => {
  const candles = [
    ...minuteSession("2026-09-08T22:00:00Z", 70, 100),
    ...minuteSession("2026-09-09T22:00:00Z", 70, 200),
  ];
  const levels = buildSessionImbalanceLevels(candles, { numberOfDays: 1 }, 60_000);
  assert.equal(levels.length, 7);
  const byRole = Object.fromEntries(levels.map((level) => [level.role, level]));
  const range = byRole.high.price - byRole.low.price;
  assert.equal(byRole.mid.price, byRole.low.price + range / 2);
  assert.equal(byRole.upper50.price, byRole.high.price + range * 0.5);
  assert.equal(byRole.lower50.price, byRole.low.price - range * 0.5);
  assert.equal(byRole.upper100.price, byRole.high.price + range);
  assert.equal(byRole.lower100.price, byRole.low.price - range);
});

test("custom start and plot-once-ended use no future candles", () => {
  const candles = minuteSession("2026-09-08T22:00:00Z", 40, 100);
  assert.equal(buildSessionImbalanceLevels(candles, { numberOfMinutes: 60, plotOnceEnded: true }).length, 0);
  const levels = buildSessionImbalanceLevels(candles, {
    numberOfMinutes: 10,
    useCustomStartTime: true,
    customStartTime: "17:20",
  });
  const high = levels.find((level) => level.role === "high");
  assert.equal(high.startTimestamp, candles[20].timestamp);
  assert.equal(high.price, Math.max(...candles.slice(20, 30).map((candle) => candle.high)));
});

test("settings persist and Session Imbalance is no longer catalogued as Pending", () => {
  const instance = {
    instanceId: "session-imbalance-1",
    indicatorId: "session-imbalance",
    enabled: true,
    settings: { ...defaultIndicatorSettings("session-imbalance"), numberOfMinutes: 45, level100Enabled: false },
  };
  const restored = normalizePaneIndicatorState({ pane: [instance] }).pane[0];
  assert.equal(restored.settings.numberOfMinutes, 45);
  assert.equal(restored.settings.level100Enabled, false);
  assert.ok(!auditIndicatorLibrary().pending.some((row) => row.id === "session-imbalance"));

  const source = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  for (const label of ["Custom start time", "Text alignment", "Until next session"])
    assert.match(source, new RegExp(label, "i"));
});
