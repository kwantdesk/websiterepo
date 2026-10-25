import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { replayChartHistoryRange, replayIndicatorCandles, completedReplayFootprintCandles, replayFootprintRecords } from "../src/lib/replayChartHistory.ts";
import { cmeSessionDateKey, cmeSessionWindowForDate, trimToRecentChartSessions } from "../src/lib/chartHistoryWindow.ts";
import { calculateIndicatorSeries } from "../src/lib/chartIndicatorEngine.ts";
import { defaultIndicatorSettings } from "../src/lib/chartIndicatorConfig.ts";
import { replayCausalCandles } from "../src/lib/replayIndicatorSafety.ts";
import { decodeCompactFootprintHistory } from "../src/lib/compactFootprintHistory.ts";
import { createExactFootprintFold } from "../services/rithmic_gateway/src/exact-footprint-fold.mjs";
import { buildFootprintBars } from "../src/lib/footprint.ts";
import ts from "typescript";
import vm from "node:vm";

const dates = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
const candles = dates.flatMap((date, day) => Array.from({ length: 1380 }, (_, minute) => ({
  timestamp: cmeSessionWindowForDate(date).startMs + minute * 60000,
  open: 20000 + day * 20 + minute / 100, high: 20002 + day * 20 + minute / 100,
  low: 19998 + day * 20 + minute / 100, close: 20001 + day * 20 + minute / 100,
  volume: 100, bidVolume: 40, askVolume: 60, delta: 20, trades: 10,
})));
const clock = candles.at(-1).timestamp + 60000;
const theme = { primary: "#fff", secondary: "#aaa", positive: "#0f0", negative: "#f00", muted: "#888" };

test("5D is anchored to the selected session with weekend/holiday headroom, not today", () => {
  const session = cmeSessionWindowForDate("2026-10-23");
  const range = replayChartHistoryRange(session, "5D", Date.parse("2026-10-25T00:00Z"));
  assert.equal(range.toMs, session.endMs);
  assert.equal(range.fromMs, session.startMs - 9 * 86400000);
  assert.equal(range.toMs - range.fromMs, 10 * 86400000);
  assert.equal(candles.filter(c => c.timestamp >= range.fromMs && c.timestamp < range.toMs).length, 6900);
  assert.equal(new Set(trimToRecentChartSessions(candles).map(c => cmeSessionDateKey(c.timestamp))).size, 5);
  assert.notEqual(range.key, replayChartHistoryRange(session, "1D").key);
});

test("current-session preload never asks beyond the actual current clock", () => {
  const session = cmeSessionWindowForDate("2026-10-23");
  const now = session.startMs + 3600000;
  assert.equal(replayChartHistoryRange(session, "5D", now).toMs, now);
  assert.equal(replayChartHistoryRange(session, "1D", now).fromMs, session.startMs);
  assert.equal(replayChartHistoryRange(session, "5D", now + 15700).key, replayChartHistoryRange(session, "5D", now + 31000).key);
});

test("all replay calculation lanes retain the entire revealed range; live limits remain bounded", () => {
  for (const limit of [1500, 2880, 4000, 6000, 20000]) {
    assert.equal(replayIndicatorCandles(candles, limit, clock), candles);
    assert.equal(replayIndicatorCandles(candles, limit, null).length, Math.min(limit, candles.length));
  }
  const prefix = replayCausalCandles(candles, candles[3000].timestamp);
  assert.equal(replayIndicatorCandles(prefix, 1500, candles[3000].timestamp).length, 3001);
});

for (const id of ["moving-average", "relative-strength-index-rsi", "average-true-range-atr", "vwap", "cumulative-volume-delta"]) {
  test(`${id}: values populate earlier sessions, not just the last 1500 candles`, () => {
    const source = replayIndicatorCandles(candles, 1500, clock);
    const instance = { instanceId: id, indicatorId: id, enabled: true, settings: defaultIndicatorSettings(id) };
    const at = performance.now();
    const series = calculateIndicatorSeries(instance, source, theme, { instrument: "NQ", tickSize: 0.25, replayTimestampMs: clock });
    assert.ok(series.some(item => item.data.some(point => point.time < candles[1380].timestamp / 1000)), "first session must contain calculated history");
    assert.ok(series.every(item => item.data.every(point => point.time <= clock / 1000)));
    assert.ok(performance.now() - at < 3000, "five-session calculation must not take seconds");
  });
}

test("Footprint summaries are revealed at bar CLOSE, never at their bar-open timestamp", () => {
  const start = candles[0].timestamp;
  const bars = candles.slice(0, 2);
  assert.equal(completedReplayFootprintCandles(bars, 60000, start + 59999).length, 0);
  assert.equal(completedReplayFootprintCandles(bars, 60000, start + 60000).length, 1);
  assert.equal(completedReplayFootprintCandles(bars, null, clock).length, 0, "event geometry must not pretend to have a clock close");
  const summary = { timestamp: start, flowOnly: true, footprintSummary: {} };
  assert.deepEqual(replayFootprintRecords([summary], 60000, start + 59999), []);
  assert.deepEqual(replayFootprintRecords([summary], 60000, start + 60000), [summary]);
  assert.deepEqual(replayFootprintRecords([summary], 60000, start + 5000), [], "rewind drops later proven summaries synchronously");
});

test("real compact archive fold reconstructs an old bar after close without borrowing the next bar", () => {
  const start = candles[0].timestamp;
  const bars = [{ timestamp: start, open: 100, high: 101, low: 100, close: 101, volume: 5 }];
  const fold = createExactFootprintFold({ starts: [start], toMs: start + 60000, minimumTradeVolume: 0, maximumTradeVolume: 0 });
  fold.add({ timestamp: start + 1, price: 100, size: 2, side: 1 });
  fold.add({ timestamp: start + 2, price: 101, size: 3, side: -1 });
  const payload = { ...fold.result(), schemaVersion: "kwantdesk-exact-footprint-v1", contractSymbol: "NQZ6", fromMs: start, toMs: start + 60000, minimumTradeVolume: 0, maximumTradeVolume: 0 };
  const records = decodeCompactFootprintHistory(payload, "NQZ6", bars, start, start + 60000, 0, 0);
  const available = replayFootprintRecords(records, 60000, start + 60000);
  const result = buildFootprintBars(bars, available, { instrument: "NQ", tickSize: 1, groupTicks: 1 });
  assert.equal(result[0].hasPriceLevelFlow, true);
  assert.equal(result[0].totalVolume, 5);
  assert.equal(result[0].delta, -1);
});

test("actual Footprint hook rejects retained future/scope data and does not request an unopened bar", () => {
  const source = readFileSync(new URL("../src/components/useExactFootprintHistory.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const bar = { timestamp: 1000000, open: 100, high: 101, low: 100, close: 101, volume: 5 };
  const scope = `NQZ6:60000:1000000:1060000:0:0:1000000:100:101:100:101:5`;
  const record = { timestamp: bar.timestamp, flowOnly: true, footprintSummary: {} };
  let retained = { contract: "NQZ6", scope, records: [record], error: null };
  const module = { exports: {} };
  const sandbox = { module, exports: module.exports, require: path => path === "react"
    ? { useMemo: fn => fn(), useRef: value => ({ current: value }), useState: () => [retained, () => {}], useEffect: () => {} }
    : path.includes("replayChartHistory") ? { completedReplayFootprintCandles, replayFootprintRecords } : {} };
  vm.runInNewContext(code, sandbox);
  const run = clock => module.exports.useExactFootprintHistory("NQZ6", [bar], 60000, true, true, 0, 0, clock);
  assert.equal(run(bar.timestamp + 59999).active, false);
  assert.equal(run(bar.timestamp + 59999).records.length, 0);
  assert.equal(run(bar.timestamp + 60000).records.length, 1);
  assert.equal(run(bar.timestamp + 1).records.length, 0);
  retained = { ...retained, scope: "another viewport or settings generation" };
  assert.equal(run(bar.timestamp + 60000).records.length, 0);
});

test("actual daily-profile request builder clips current sessions and skips unopened segments", () => {
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const profileClockMs = replayProfileClockMs ?? Date.now();");
  const end = source.indexOf("const requestArgs = {", start);
  assert.ok(start > 0 && end > start);
  const build = new Function("replayProfileClockMs", "tradingDate", "job", "cmeSessionWindowForDate", source.slice(start, end) + "return { startMs, endMs };");
  const session = cmeSessionWindowForDate("2026-10-23");
  const clock = session.startMs + 3600000;
  assert.deepEqual(build(clock, "2026-10-23", {}, cmeSessionWindowForDate), { startMs: session.startMs, endMs: clock });
  const past = cmeSessionWindowForDate("2026-10-22");
  assert.deepEqual(build(clock, "2026-10-22", {}, cmeSessionWindowForDate), { startMs: past.startMs, endMs: past.endMs });
  assert.equal(build(clock, "2026-10-23", { startMs: clock + 60000, endMs: clock + 3600000 }, cmeSessionWindowForDate), undefined);
});

test("wiring covers full replay lanes, clock-safe exact history and minute-bounded profiles", () => {
  const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
  const workspace = read("../src/components/KwantifyWorkspace.tsx");
  const chart = read("../src/components/Chart.tsx");
  const hook = read("../src/components/useExactFootprintHistory.ts");
  const route = read("../src/app/api/databento/market/route.ts");
  assert.match(workspace, /replayChartHistoryRange\(window, period\)/);
  assert.match(workspace, /trimChartHistoryForPeriod\(sanitizeCandles\(replayCandles/);
  assert.match(workspace, /replayHistoryRange \? loaded : mergeChartHistory/);
  assert.match(chart, /if \(replayTimestampMs != null\) return sampledIndicatorCandles.length/);
  assert.match(chart, /replayTimestampMs != null \|\| indicatorHistoryLimit <= 1_500/);
  assert.match(chart, /replayIndicatorCandles\(sampledIndicatorCandles, DEEP_HISTORY_INDICATOR_MAX_BARS, replayTimestampMs\)/);
  assert.match(hook, /completedReplayFootprintCandles\(sourceCandles, intervalMs, replayTimestampMs\)/);
  assert.match(hook, /replayTimestampMs == null \|\| state.scope === scope/);
  assert.match(workspace, /Math.floor\(replayTimestampMs \/ 60_000\) \* 60_000/);
  assert.match(workspace, /if \(replayProfileClockMs == null\) replacement = applyInstitutionalTradesToVolumeProfile/);
  assert.match(workspace, /if \(replayProfileClockMs == null\) refreshTimer = window.setTimeout/);
  assert.match(route, /MAX_EXPLICIT_RANGE_MS = MAX_HISTORY_DAYS \*/);
});
