import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ObservedCandleHistory, clockCandleHistoryNeedsRedraw } from "../src/lib/observedCandleHistory.ts";

const bar = (timestamp, overrides = {}) => ({ timestamp, open: 100, high: 103, low: 98, close: 101, volume: 10, ...overrides });
const scope = "pane:NQ:1m:live";

test("a full stale-history redraw preserves every recently observed candle, not just the last wick", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000, { high: 110, low: 95 }), 61000);
  buffer.observe(scope, bar(120000, { open: 104, high: 115, low: 99, close: 109 }), 121000);
  buffer.observe(scope, bar(180000, { high: 120, close: 119 }), 181000);
  const merged = buffer.merge(scope, [bar(60000), bar(120000)]);
  assert.equal(merged.length, 3, "late shorter history must not remove an already observed bar");
  assert.deepEqual(merged.map(candle => candle.high), [110, 115, 120]);
  assert.equal(merged[0].low, 95);
  assert.equal(merged[1].open, 104);
  assert.equal(merged[1].close, 109);
  assert.equal(merged[0].open, 100, "first partially observed bucket keeps archive open authority");
});

test("late same-bucket packets may extend extrema but never rewind the latest close", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000, { close: 102 }), 61500);
  const result = buffer.observe(scope, bar(60000, { high: 108, close: 99 }), 61000);
  assert.equal(result.close, 102);
  assert.equal(result.high, 108);
  assert.equal(buffer.observe(scope, bar(60000, { close: 100 }), 61500).close, 100, "equal-ms real prints retain arrival order");
});

test("symbol, interval and replay scopes never inherit another chart's wicks", () => {
  const buffer = new ObservedCandleHistory();
  for (const nextScope of ["pane:ES:1m:live", "pane:NQ:5m:live", "pane:NQ:1m:replay", "pane:NQH7:NQ:1m:live"]) {
    buffer.observe(scope, bar(60000, { high: 999 }), 61000);
    const history = [bar(60000)];
    assert.equal(buffer.merge(nextScope, history), history);
    assert.equal(buffer.merge(scope, history), history, "returning to live starts a fresh observation scope");
  }
});

test("buffer retention is bounded, without changing archived unobserved bars", () => {
  const buffer = new ObservedCandleHistory(2);
  for (let index = 1; index <= 4; index++) buffer.observe(scope, bar(index * 60000, { high: 110 }), index * 60000 + 1);
  assert.deepEqual(buffer.merge(scope, [bar(60000)]).map(candle => candle.timestamp), [60000, 180000, 240000]);
  const identicalHistory = [bar(60000), bar(180000, { high: 110 }), bar(240000, { high: 110 })];
  assert.equal(buffer.merge(scope, identicalHistory), identicalHistory, "identical observations must not allocate/sort the full chart history");
});

test("two-to-five new bars and earlier OHLC corrections require setData, not a last-bar-only update", () => {
  const before = [bar(60000), bar(120000)];
  assert.equal(clockCandleHistoryNeedsRedraw(before, [bar(60000), bar(120000, { close: 102 })]), false);
  assert.equal(clockCandleHistoryNeedsRedraw(before, [...before, bar(180000)]), false);
  for (let count = 2; count <= 5; count++) assert.equal(clockCandleHistoryNeedsRedraw(before, [...before, ...Array.from({ length: count }, (_, i) => bar(180000 + i * 60000))]), true);
  assert.equal(clockCandleHistoryNeedsRedraw(before, [bar(60000, { high: 110 }), bar(120000)]), true);
  assert.equal(clockCandleHistoryNeedsRedraw(before, [bar(60000)]), true);
});

test("actual workspace delayed-tick branch cannot delete the candle after a genuine rollover", () => {
  const sourceText = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("workspace.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "mergeLiveMidIntoCandles");
  const now = 180500;
  const context = vm.createContext({
    Date: { now: () => now },
    isPositiveFinite: value => Number.isFinite(value) && value > 0,
    getTimeframeBucketStart: timestamp => Math.floor(timestamp / 60000) * 60000,
    getTimeframeMs: () => 60000,
    sanitizeCandle: candle => candle,
  });
  vm.runInContext(ts.transpileModule(fn.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const current = [bar(120000), bar(180000, { high: 115, close: 110 })];
  const result = context.mergeLiveMidIntoCandles(current, 102, "NQ", "1m", 179900, { isTrade: true });
  assert.equal(result.length, 2);
  assert.equal(result[1].timestamp, 180000);
  assert.equal(result[1].high, 115);
  assert.equal(result[1].close, 110);
  const future = [bar(120000), bar(240000)];
  const repaired = context.mergeLiveMidIntoCandles(future, 104, "NQ", "1m", 180100, { isTrade: true });
  assert.equal(repaired.at(-1).timestamp, 180000, "genuinely future-mislabelled history still repairs");
});

test("explicit book-only futures packets cannot create OHLC prints, while trading marks still receive them", () => {
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const consume = source.slice(source.indexOf("const consumeLivePrice ="), source.indexOf("pendingLiveTicksRef.current.push({", source.indexOf("const consumeLivePrice =")));
  assert.match(consume, /if \(usingDatabentoPaneFeed && price.isTrade === false\) return;/);
  assert.ok(consume.indexOf("onLiveExecutionQuote(executionQuote)") < consume.indexOf("price.isTrade === false"));
  assert.ok(consume.includes("PAPER_MARK_QUOTE_EVENT"));
});
