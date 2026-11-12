import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";
import { defaultIndicatorSettings, normalizePaneIndicatorState } from "../src/lib/chartIndicatorConfig.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { settingsWithPalette } from "../src/lib/indicatorPaletteRegistry.ts";
import { adrDailyHistoryDays, loadAdrDailyHistory } from "../src/lib/adrDailyHistory.ts";
import { CHART_INTERVAL_GROUPS } from "../src/lib/chartIntervals.ts";
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

test("cash after-hours stays in the same New York trading date", () => {
  const candles = [
    bar("2026-09-01T20:00:00Z", 90, 91, 89, 90),
    bar("2026-09-01T23:00:00Z", 100, 101, 99, 100),
    bar("2026-09-02T13:30:00Z", 100, 102, 98, 101),
  ];
  const cash = { instrument: "SPY", timeframe: "1m" };
  const buckets = buildAverageRangeBuckets(candles, "daily", cash);
  assert.equal(buckets[0].last.timestamp, candles[1].timestamp);
  const instance = { instanceId: "adr", indicatorId: "average-daily-range-target", enabled: true };
  const projection = calculateIndicatorSeries(instance, candles, theme, cash);
  assert.equal(projection.find(item => item.key.endsWith("secondary-up")).data[0].value, 112);
  const replay = calculateIndicatorSeries(instance, candles, theme, { ...cash, replayTimestampMs: candles[1].timestamp });
  assert.deepEqual(replay, []);
});

test("a truncated intraday window cannot supply a completed Globex range", () => {
  const bars = [
    bar("2026-09-01T18:00:00Z", 90, 100, 80, 95),
    bar("2026-09-01T22:00:00Z", 95, 115, 85, 100),
    bar("2026-09-02T22:00:00Z", 100, 105, 95, 101),
  ];
  const context = { instrument: "NQZ6", timeframe: "1m" };
  assert.deepEqual(calculateAverageDailyRangeTarget(bars, { length: 2 }, theme, context), []);
  const series = calculateAverageDailyRangeTarget(bars, { length: 1 }, theme, context);
  assert.equal(series.find(item => item.key.endsWith("secondary-up")).data[0].value, 130);
});

test("UTC-midnight daily cash candles keep the published date at month boundaries", () => {
  const candles = [
    bar("2026-09-30T00:00:00Z", 90, 100, 80, 95),
    bar("2026-10-01T00:00:00Z", 100, 105, 95, 101),
  ];
  const series = calculateAverageDailyRangeTarget(candles, { lengthType: "monthly" }, theme, { instrument: "VIX", timeframe: "1D" });
  assert.equal(series.find(item => item.key.endsWith("secondary-up")).data[0].value, 120);
});

test("a weekly host chart uses recorded daily ranges and does not train on the current or future day", () => {
  const first = bar("2026-09-01T22:00:00Z", 90, 100, 80, 95);
  const second = bar("2026-09-02T22:00:00Z", 95, 115, 85, 100);
  const current = bar("2026-09-03T22:00:00Z", 100, 210, 10, 105);
  const future = bar("2026-09-06T22:00:00Z", 200, 400, 100, 205);
  const instance = { instanceId: "adr", indicatorId: "average-daily-range-target", enabled: true, settings: { length: 2 } };
  const host = [bar("2026-08-30T22:00:00Z", 91, 200, 50, 103)];
  const asOf = current.timestamp + 60_000;
  const context = { instrument: "NQ", timeframe: "1W", adrDailyCandles: [first, second, current, future], adrAsOfMs: asOf };
  const projected = calculateIndicatorSeries(instance, host, theme, { ...context, replayTimestampMs: asOf });
  const target = projected.find(item => item.key.endsWith("secondary-up"));
  assert.deepEqual(target.data, [{ time: host[0].timestamp / 1000, value: 125 }]);
  const futureOpen = { ...current, sourceStartTimestamp: asOf + 1 };
  assert.deepEqual(calculateIndicatorSeries(instance, host, theme,
    { ...context, adrDailyCandles: [first, second, futureOpen, future], replayTimestampMs: asOf }), []);
});

test("recorded daily history coalesces panes and trims partial page edges", async (t) => {
  const requests = [];
  const dayMs = 86_400_000;
  const now = Date.parse("2026-11-12T18:00:00Z");
  const day = Math.floor(now / dayMs);
  t.mock.method(globalThis, "fetch", async (url) => {
    const parsed = new URL(url, "http://localhost");
    const from = Number(parsed.searchParams.get("from"));
    const to = Number(parsed.searchParams.get("to"));
    requests.push({ route: parsed.pathname, timeframe: parsed.searchParams.get("timeframe"), from, to });
    return Response.json({ candles: [
      { timestamp: from - 1, open: 10 },
      { timestamp: from + dayMs, open: 20 },
      { timestamp: to - 1, open: 30 },
    ] });
  });
  const days = adrDailyHistoryDays("monthly", 1);
  const request = loadAdrDailyHistory("MNQ", days, day, now);
  assert.equal(loadAdrDailyHistory("MNQ", days, day, now), request);
  const rows = await request;
  assert.ok(requests.length > 1);
  assert.ok(requests.every(r => r.route === "/api/cme-history" && r.timeframe === "1D" && r.to - r.from <= 28 * dayMs));
  assert.ok(rows.every(row => row.open !== 10));
  assert.deepEqual(await loadAdrDailyHistory("MNQ", days, day, now + 10_000), rows);
  const previousCount = requests.length;
  await loadAdrDailyHistory("SPY", 14, day, now);
  assert.equal(requests.length, previousCount + 1);
  assert.equal(requests.at(-1).route, "/api/market-indices");
});

test("the independent daily reference keeps targets invariant across all host interval types", () => {
  const reference = [
    bar("2026-11-09T23:00:00Z", 100, 112, 90, 101),
    bar("2026-11-10T23:00:00Z", 102, 112, 100, 107),
  ];
  const host = [bar("2026-11-08T23:00:00Z", 100, 190, 70, 105)];
  const context = { instrument: "NQ", adrDailyCandles: reference, adrAsOfMs: Date.parse("2026-11-11T15:00:00Z") };
  for (const { id: timeframe } of CHART_INTERVAL_GROUPS.flatMap(group => group.options)) {
    const plots = calculateAverageDailyRangeTarget(host, { length: 1 }, theme, { ...context, timeframe });
    assert.deepEqual(plots.map(plot => plot.data[0].value), [102, 113, 91, 124, 80, 135, 69], timeframe);
  }
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

test("a malformed candle cannot split one session into multiple completed ranges", () => {
  const damaged = [
    bar("2026-09-01T22:00:00Z", 100, 110, 90, 105),
    bar("2026-09-01T23:00:00Z", 105, 99, 90, 102),
    bar("2026-09-02T00:00:00Z", 102, 125, 95, 110),
  ];
  const firstClean = bar("2026-09-02T22:00:00Z", 120, 130, 110, 123);
  const secondClean = bar("2026-09-03T22:00:00Z", 130, 138, 120, 135);
  assert.deepEqual(calculateAverageDailyRangeTarget(damaged, { length: 1 }, theme), []);
  assert.deepEqual(calculateAverageDailyRangeTarget([...damaged, firstClean], { length: 1 }, theme), []);
  const resumed = calculateAverageDailyRangeTarget([...damaged, firstClean, secondClean], { length: 1 }, theme);
  assert.equal(resumed.find(item => item.key.endsWith("secondary-up")).data[0].value, 150);
});

test("settings, theme ownership, persistence and registration are wired", () => {
  const candles = [bar("2026-09-01T22:00:00Z", 100, 120, 80, 110), bar("2026-09-02T22:00:00Z", 200, 205, 195, 201)];
  const base = { instanceId: "adr", indicatorId: "average-daily-range-target", enabled: true, settings: defaultIndicatorSettings("average-daily-range-target") };
  const themed = calculateIndicatorSeries(base, candles, theme);
  assert.equal(themed.length, 7);
  assert.ok(themed.every(item => item.color === theme.primary && item.pivotLabels.backgroundColor === theme.muted));
  const customSettings = { ...base.settings, fontSize: 18, textAlign: "left", useThemeColors: false, backgroundColor: "#123456", textColor: "#abcdef" };
  const custom = calculateIndicatorSeries({ ...base, settings: customSettings }, candles, theme);
  assert.deepEqual(custom.map(item => item.data), themed.map(item => item.data));
  assert.ok(custom.every(item => item.color === "#abcdef"
    && item.pivotLabels.backgroundColor === "#123456"
    && item.pivotLabels.fontSize === 18 && item.pivotLabels.align === "left"));
  const selected = { ...base, settings: { ...customSettings, gradientPreset: "pink-blue" } };
  const resolved = settingsWithPalette(selected, {
    up: theme.positive, down: theme.negative, neutral: theme.muted, accent: theme.primary, text: theme.primary,
  });
  assert.notEqual(resolved.settings.textColor, selected.settings.textColor);
  assert.notEqual(resolved.settings.backgroundColor, selected.settings.backgroundColor);
  const palette = calculateIndicatorSeries(resolved, candles, theme);
  assert.ok(palette.every(item => item.color === resolved.settings.textColor
    && item.pivotLabels.backgroundColor === resolved.settings.backgroundColor));
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
