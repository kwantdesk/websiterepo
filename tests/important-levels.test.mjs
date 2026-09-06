import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { calculateImportantLevels } from "../src/lib/importantLevels.ts";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";

const base = Date.parse("2026-09-01T14:00:00Z");
const candles = [
  { timestamp: base, open: 100, high: 103, low: 99, close: 102, volume: 30 },
  { timestamp: base + 60_000, open: 102, high: 105, low: 101, close: 104, volume: 70 },
];
const footprints = [
  { timestamp: base, rows: [{ tickIndex: 100, price: 100, totalVolume: 10 }, { tickIndex: 101, price: 101, totalVolume: 20 }] },
  { timestamp: base + 60_000, rows: [{ tickIndex: 100, price: 100, totalVolume: 10 }, { tickIndex: 101, price: 101, totalVolume: 60 }] },
];
const theme = { primary: "#fff", secondary: "#fa0", positive: "#0f0", negative: "#f00", muted: "#0af" };

test("daily Important Levels calculate OHLC, midpoint, POC, value area and VWAP", () => {
  const series = calculateImportantLevels(candles, footprints, { days: 1, weeks: 0, months: 0, filterTime: "none" }, theme);
  const values = new Map(series.map((entry) => [entry.label, entry.data[0].value]));
  assert.deepEqual([values.get("D Open"), values.get("D High"), values.get("D Low"), values.get("D Close"), values.get("D Average")], [100, 105, 99, 104, 102]);
  assert.equal(values.get("D POC"), 101);
  assert.equal(values.get("D VAH"), 101);
  assert.equal(values.get("D VAL"), 101);
  assert.ok(Math.abs(values.get("D VWAP") - 102.7333333333) < 1e-6);
});

test("POC/value area fail closed when volume-at-price rows are absent", () => {
  const labels = calculateImportantLevels(candles, [], { days: 1, weeks: 0, months: 0, filterTime: "none" }, theme).map((entry) => entry.label);
  assert.ok(!labels.includes("D POC") && !labels.includes("D VAH") && !labels.includes("D VAL"));
  assert.ok(labels.includes("D High") && labels.includes("D VWAP"));
});

test("settings persist and catalogue/runtime/settings gates are present", () => {
  const defaults = defaultIndicatorSettings("important-levels");
  const restored = normalizePaneIndicatorState({ pane: [{ instanceId: "i", indicatorId: "important-levels", enabled: true, settings: { ...defaults, days: 999, filterTime: "custom", customStartTime: "09:00" } }] }).pane[0];
  assert.deepEqual([restored.settings.days, restored.settings.filterTime, restored.settings.customStartTime], [100, "custom", "09:00"]);
  assert.ok(!auditIndicatorLibrary().pending.some((entry) => entry.id === "important-levels"));
  const control = fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8");
  for (const label of ["Filter time", "Plot type", "Text align", "Skip last period", "Ini session", "End session"]) assert.match(control, new RegExp(label, "i"));
});
