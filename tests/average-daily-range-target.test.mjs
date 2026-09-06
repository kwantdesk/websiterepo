import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import {
  buildAverageRangeBuckets,
  calculateAverageDailyRangeTarget,
  normalizeAverageDailyRangeTargetSettings,
} from "../src/lib/averageDailyRangeTarget.ts";

const theme = { primary: "#ffee00", secondary: "#aa44ff", positive: "#22cc66", negative: "#ee3344", muted: "#222222" };
const bar = (iso, open, high, low, close) => ({ timestamp: Date.parse(iso), open, high, low, close, volume: 1 });

test("reference defaults and safe bounds normalize", () => {
  assert.deepEqual(normalizeAverageDailyRangeTargetSettings({}), {
    lengthType: "daily", length: 1, fontSize: 12, textAlign: "right",
    useThemeColors: true, backgroundColor: "#000000", textColor: "#FFFFFF",
  });
  const bounded = normalizeAverageDailyRangeTargetSettings({ length: 0, fontSize: 99, lengthType: "nonsense", textAlign: "middle" });
  assert.deepEqual([bounded.length, bounded.fontSize, bounded.lengthType, bounded.textAlign], [1, 40, "daily", "right"]);
});

test("CME trading days turn over at 17:00 Chicago time", () => {
  const candles = [
    bar("2026-09-01T21:59:00Z", 90, 91, 89, 90),
    bar("2026-09-01T22:00:00Z", 100, 101, 99, 100),
    bar("2026-09-01T23:00:00Z", 100, 102, 98, 101),
  ];
  const buckets = buildAverageRangeBuckets(candles, "daily");
  assert.equal(buckets.length, 2);
  assert.equal(buckets[1].first.timestamp, candles[1].timestamp);
});

test("targets use only completed ranges and the current period open", () => {
  const candles = [
    bar("2026-09-01T22:00:00Z", 90, 100, 80, 95),
    bar("2026-09-02T22:00:00Z", 95, 115, 85, 100),
    bar("2026-09-03T22:00:00Z", 100, 105, 95, 101),
    bar("2026-09-03T23:00:00Z", 101, 130, 70, 102),
  ];
  const series = calculateAverageDailyRangeTarget(candles, { length: 2 }, theme);
  const values = Object.fromEntries(series.map(item => [item.key, item.data[0].value]));
  assert.equal(values["average-daily-range-target-scaling"], 100);
  assert.equal(values["average-daily-range-target-primary-up"], 112.5);
  assert.equal(values["average-daily-range-target-secondary-down"], 75);
  assert.equal(values["average-daily-range-target-extension-up"], 137.5);
  // A huge live-session wick changes neither the completed-period ADR nor the targets.
  assert.equal(series[1].data[0].value, series[1].data[1].value);
});

test("weekly and monthly modes aggregate complete calendar periods", () => {
  const weekly = [
    bar("2026-08-24T22:00:00Z", 100, 120, 90, 110),
    bar("2026-08-31T22:00:00Z", 200, 210, 190, 205),
  ];
  const weekSeries = calculateAverageDailyRangeTarget(weekly, { lengthType: "weekly", length: 1 }, theme);
  assert.equal(weekSeries.find(item => item.key.endsWith("secondary-up")).data[0].value, 230);
  const monthly = [
    bar("2026-07-01T22:00:00Z", 100, 140, 80, 120),
    bar("2026-08-03T22:00:00Z", 300, 310, 290, 305),
  ];
  const monthSeries = calculateAverageDailyRangeTarget(monthly, { lengthType: "monthly", length: 1 }, theme);
  assert.equal(monthSeries.find(item => item.key.endsWith("primary-down")).data[0].value, 270);
});

test("insufficient completed history produces no fabricated target", () => {
  assert.deepEqual(calculateAverageDailyRangeTarget([bar("2026-09-01T22:00:00Z", 100, 110, 90, 105)], { length: 1 }, theme), []);
});

test("settings, theme ownership, persistence and registration are wired", () => {
  const candles = [bar("2026-09-01T22:00:00Z", 100, 120, 80, 110), bar("2026-09-02T22:00:00Z", 200, 205, 195, 201)];
  const base = { instanceId: "adr", indicatorId: "average-daily-range-target", enabled: true, settings: defaultIndicatorSettings("average-daily-range-target") };
  const themed = calculateIndicatorSeries(base, candles, theme);
  assert.equal(themed.length, 7);
  assert.ok(themed.every(item => item.color === theme.primary && item.pivotLabels.backgroundColor === theme.muted));
  const restored = normalizePaneIndicatorState({ pane: [{ ...base, settings: { ...base.settings, lengthType: "weekly", textAlign: "left", useThemeColors: false, backgroundColor: "#123456", textColor: "#abcdef" } }] }).pane[0];
  assert.equal(restored.settings.lengthType, "weekly");
  assert.equal(restored.settings.textAlign, "left");
  assert.ok(!auditIndicatorLibrary().pending.some(row => row.id === "average-daily-range-target"));
  const source = [
    fs.readFileSync(new URL("../src/components/ChartIndicatorsControl.tsx", import.meta.url), "utf8"),
    fs.readFileSync(new URL("../src/lib/chartIndicatorConfig.ts", import.meta.url), "utf8"),
  ].join("\n");
  for (const label of ["Length type", "Completed periods", "Label font size", "Text alignment"])
    assert.match(source, new RegExp(label, "i"));
});
