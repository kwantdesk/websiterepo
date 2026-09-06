import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
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
