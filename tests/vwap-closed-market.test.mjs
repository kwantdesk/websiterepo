import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { mergeLiveIndicatorTail } from "../src/lib/chartLiveEvents.ts";
import { chartSourceTimestamp } from "../src/lib/chartCountdown.ts";
import { calculatePeriodVwap, calculateRollingVwap } from "../src/lib/vwap.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";
import { buildLightweightSeriesDataSnapshot, planLightweightSeriesDataSync } from "../src/lib/lightweightSeriesDataSync.ts";

const friday = Date.parse("2026-09-04T20:58:00Z");
const sunday = Date.parse("2026-09-06T05:00:00Z");
const candle = (timestamp, price, volume) => ({ timestamp, open: price, high: price, low: price, close: price, volume, trades: volume > 0 ? 1 : 0 });
const traded = [candle(friday, 100, 10), candle(friday + 60_000, 110, 10)];
const emptyWeekend = Array.from({ length: 100 }, (_, i) => candle(sunday + i * 60_000, 107, 0));

test("period VWAP ends at the last weighted candle without quote-only weekend resets", () => {
  const expected = calculatePeriodVwap(traded);
  assert.equal(expected.at(-1).value, 105);
  assert.equal(expected.at(-1).deviation, 5);
  assert.deepEqual(calculatePeriodVwap([...traded, ...emptyWeekend]), expected);
  assert.deepEqual(calculatePeriodVwap(emptyWeekend), []);
});

test("rolling envelopes do not collapse when empty candles evict the weighted window", () => {
  for (const periodMode of ["days", "minutes", "bars"]) {
    const options = { periodMode, periodValue: periodMode === "days" ? 1 : 60 };
    const expected = calculateRollingVwap(traded, options);
    assert.deepEqual(calculateRollingVwap([...traded, ...emptyWeekend], options), expected);
    assert.deepEqual(calculateRollingVwap(emptyWeekend, options), []);
  }
});

test("real reopening executions resume VWAP with the correct session break", () => {
  const reopened = candle(Date.parse("2026-09-06T22:01:00Z"), 120, 20);
  const points = calculatePeriodVwap([...traded, ...emptyWeekend, reopened]);
  assert.equal(points.length, 3);
  assert.equal(points.at(-1).value, 120);
  assert.equal(points.at(-1).breakBefore, true);
  const rolling = calculateRollingVwap([...traded, ...emptyWeekend, reopened], { periodMode: "days", periodValue: 1 });
  assert.equal(rolling.at(-1).value, 120);
});

test("empty bars still count toward the rolling bar window when actual trades resume", () => {
  const bars = [...traded, candle(friday + 120_000, 115, 0), candle(friday + 180_000, 120, 10)];
  const points = calculateRollingVwap(bars, { periodMode: "bars", periodValue: 2 });
  assert.equal(points.length, 3);
  assert.equal(points.at(-1).value, 120);
});

test("VWAP family renders identical final lines/bands through repeated empty-tail hydration", () => {
  const theme = { primary: "#00FF00", secondary: "#FFFFFF", muted: "#777777", up: "#00FF00", down: "#FF0000" };
  for (const id of ["vwap", "vwap-envelopes", "rolling-vwap"]) {
    const instance = { instanceId: id, indicatorId: id, enabled: true, settings: { ...defaultIndicatorSettings(id), band1Enabled: true } };
    const original = calculateIndicatorSeries(instance, traded, theme);
    for (const tail of [emptyWeekend, [], emptyWeekend.slice(0, 1), emptyWeekend]) {
      const next = calculateIndicatorSeries(instance, [...traded, ...tail], theme);
      assert.deepEqual(next, original, id);
      for (let i = 0; i < next.length; i++) {
        const before = buildLightweightSeriesDataSnapshot(original[i].data);
        const after = buildLightweightSeriesDataSnapshot(next[i].data, before);
        assert.equal(planLightweightSeriesDataSync(before, after), "none", `${id} must not replace an unchanged plotted line`);
      }
    }
  }
});

test("a one-day VWAP window renders every loaded day with actual volume", () => {
  const day = 86_400_000;
  const minute = 60_000;
  const start = Date.UTC(2026, 9, 1, 14);
  const history = Array.from({ length: 30 }, (_, i) => [
    candle(start + i * day, 100 + i, 2),
    candle(start + i * day + minute, 104 + i, 2),
    candle(start + i * day + 2 * minute, 900, 0),
  ]).flat();
  const theme = { primary: "#fff", secondary: "#aaa", muted: "#888", positive: "#0f0", negative: "#f00" };
  const indicator = { instanceId: "env", indicatorId: "vwap-envelopes", enabled: true,
    settings: { ...defaultIndicatorSettings("vwap-envelopes"), periodMode: "days", periodValue: 1 } };
  const weightedTimes = history.filter(bar => bar.volume > 0).map(bar => bar.timestamp / 1_000);
  const result = calculateIndicatorSeries(indicator, history, theme).filter(series => series.data.length);
  assert.equal(result.length, 7);
  for (const plot of result) assert.deepEqual(plot.data.map(point => point.time), weightedTimes);
  assert.equal(result[0].data[1].value, 102);
  assert.equal(result.find(plot => plot.key === "vwap-envelopes-upper-1").data[1].value, 104);

  const replayTimestampMs = start + 2 * day + minute;
  const [replay] = calculateIndicatorSeries(indicator, history, theme, { replayTimestampMs });
  assert.deepEqual(replay.data, result[0].data.filter(point => point.time * 1_000 <= replayTimestampMs));

  const [manual] = calculateIndicatorSeries({
    ...indicator, settings: { ...indicator.settings, indicatorHistoryMode: "manual", historyDaysLimit: 1 },
  }, history, theme);
  assert.deepEqual(manual.data, result[0].data.filter(point => point.time * 1_000 >= history.at(-1).timestamp - day));
});

test("chart overlay uses loaded price history even when its sampled input contains only the current session", () => {
  const chart = ts.createSourceFile("Chart.tsx",
    readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let build;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(chart) === "vwapEnvelopeSeries") {
      build = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  };
  visit(chart);
  assert.ok(build);
  const candles = [...traded, candle(friday + 3 * 86_400_000, 125, 12)];
  const indicator = { instanceId: "env-1", indicatorId: "vwap-envelopes", enabled: true,
    settings: defaultIndicatorSettings("vwap-envelopes") };
  const context = {
    indicators: [indicator, { ...indicator, instanceId: "env-2" }],
    observedSourceCandles: candles,
    sampledIndicatorCandles: candles.slice(-1),
    replayTimestampMs: null,
    pendingLiveVolumeCandleRef: { current: [] },
    settings: {}, instrument: "NQ", timeframe: "1m",
    mergeLiveIndicatorTail,
    calculateIndicatorSeries,
    visibleIndicatorTheme: () => ({ primary: "#fff", secondary: "#aaa", muted: "#888", positive: "#0f0", negative: "#f00" }),
  };
  const source = ts.transpileModule(`const build = ${build.getText(chart)}; build();`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const overlays = vm.runInNewContext(source, context);
  assert.equal(new Set(overlays.map(plot => plot.key)).size, overlays.length);
  assert.deepEqual(Array.from(overlays.filter(plot => plot.data.length), plot => plot.data[0].time),
    Array(14).fill(candles[0].timestamp / 1_000));
});

test("actual workspace timestamp parser never relabels stale or invalid quotes as now", () => {
  const source = ts.createSourceFile("workspace.tsx", readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "marketTimestamp");
  assert.ok(declaration);
  const code = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ chartSourceTimestamp, Date: { now: () => sunday } });
  vm.runInContext(code, context);
  for (const value of [friday, String(friday), new Date(friday).toISOString(), friday * 1_000, friday * 1_000_000]) {
    assert.equal(context.marketTimestamp(value), friday);
  }
  for (const value of [undefined, null, "invalid", sunday + 120_000]) {
    assert.ok(Number.isNaN(context.marketTimestamp(value)));
  }
  assert.equal(context.marketTimestamp(sunday), sunday, "genuine current quotes remain accepted");
  const mergeDeclaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "mergeLiveMidIntoCandles");
  assert.ok(mergeDeclaration);
  context.isPositiveFinite = (value) => Number.isFinite(value) && value > 0;
  vm.runInContext(ts.transpileModule(mergeDeclaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  assert.equal(context.mergeLiveMidIntoCandles(traded, 107, "NQ", "1m", friday + 60_000), traded,
    "a repeated Friday quote cannot overwrite the final Friday candle on Sunday");
  assert.equal(context.mergeLiveMidIntoCandles(traded, 107, "NQ", "1m", Number.NaN), traded);
  context.getTimeframeBucketStart = (timestamp) => Math.floor(timestamp / 60_000) * 60_000;
  assert.equal(context.mergeLiveMidIntoCandles([], 107, "NQ", "1m", sunday)[0].timestamp, sunday,
    "fresh quotes remain available to the live candle path");
  assert.equal(context.mergeLiveMidIntoCandles([], 107, "NQ", "1m", friday, { isTrade: true, size: 10 })[0].volume, 10,
    "the stale quote gate must not discard timestamped executions");
});
