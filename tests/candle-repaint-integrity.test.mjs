import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ObservedCandleHistory, clockCandleHistoryNeedsRedraw, clockCandleTimelineChanged } from "../src/lib/observedCandleHistory.ts";

const bar = (timestamp, overrides = {}) => ({ timestamp, open: 100, high: 103, low: 98, close: 101, volume: 10, ...overrides });
const scope = "pane:NQ:1m:live";

test("the initial history-seeded bar cannot have its open rewritten after rollover", () => {
  const buffer = new ObservedCandleHistory();
  buffer.merge(scope, [bar(60000, { open: 99 })]);
  buffer.observe(scope, bar(60000, { close: 102 }), 119900);
  buffer.observe(scope, bar(120000, { open: 103 }), 120100);
  const changed = buffer.merge(scope, [bar(60000, { open: 94, close: 95 }), bar(120000)]);
  assert.equal(changed[0].open, 99);
  assert.equal(changed[0].close, 102);
});

test("a receipt-time watermark from a newer bucket cannot rewrite an already closed candle", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000, { close: 105 }), 119900);
  buffer.observe(scope, bar(120000), 120100);
  assert.equal(buffer.observe(scope, bar(60000, { open: 90, close: 91 }), 121000).close, 105);
  // An actual later exchange print inside the old bucket is still accepted.
  assert.equal(buffer.observe(scope, bar(60000, { close: 106 }), 119950).close, 106);
});

test("an unseeded partial first candle still accepts its first genuine historical open after rollover", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000, { open: 105 }), 119900);
  buffer.observe(scope, bar(120000), 120100);
  assert.equal(buffer.merge(scope, [bar(60000, { open: 99 }), bar(120000)])[0].open, 99);
});

test("history extrema accepted for an observed bar survive a subsequent stale history response", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000), 61000);
  const expanded = buffer.merge(scope, [bar(60000, { high: 115, low: 91 })]);
  assert.equal(expanded[0].high, 115);
  const stale = buffer.merge(scope, [bar(60000)]);
  assert.equal(stale[0].high, 115);
  assert.equal(stale[0].low, 91);
  buffer.observe(scope, bar(120000), 121000);
  assert.equal(buffer.merge(scope, [bar(60000), bar(120000)])[0].high, 115);
});

test("a history-seeded forming wick survives the first live tick and then a stale refresh", () => {
  const buffer = new ObservedCandleHistory();
  const initial = [bar(60000, { high: 118, low: 89 })];
  buffer.merge(scope, initial);
  const firstLive = buffer.observe(scope, bar(60000, { close: 102 }), 61500);
  assert.equal(firstLive.high, 118, "the first live paint must not shrink the seeded wick either");
  assert.equal(firstLive.low, 89);
  // Paint the initial history plus the real tick, then receive an older response.
  buffer.merge(scope, initial);
  const stale = buffer.merge(scope, [bar(60000)]);
  assert.equal(stale[0].high, 118);
  assert.equal(stale[0].low, 89);
  assert.equal(stale[0].close, 102);
});

test("reconciling cached render input at paint time includes newer directly observed bars", () => {
  const buffer = new ObservedCandleHistory();
  buffer.observe(scope, bar(60000), 61000);
  const memoized = buffer.merge(scope, [bar(60000)]);
  buffer.observe(scope, bar(60000, { high: 117, low: 92 }), 62000);
  buffer.observe(scope, bar(120000, { open: 104, high: 109, close: 108 }), 121000);
  const repaint = buffer.merge(scope, memoized);
  assert.equal(repaint[0].high, 117);
  assert.equal(repaint[0].low, 92);
  assert.equal(repaint[1].timestamp, 120000);
});

test("actual chart creation and redraw expressions reconcile the latest buffer rather than stale render arrays", () => {
  const sourceText = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("Chart.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      if (["creationSource", "paintSource", "drawCandles"].includes(name)) declarations.set(name, node);
      if (name === "chartData" && node.initializer.getText(source).includes("creationSource")) declarations.set("creationData", node);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const buffer = new ObservedCandleHistory();
  const candles = [bar(60000)];
  buffer.merge(scope, candles);
  buffer.observe(scope, bar(60000, { high: 119, low: 90 }), 62000);
  buffer.observe(scope, bar(120000), 121000);
  for (const names of [["creationSource", "creationData"], ["paintSource", "drawCandles"]]) {
    const context = vm.createContext({
      candles, seriesCandles: candles, candleStyle: "candles", timeframe: "1m", eventBased: false,
      liveReplayActiveRef: { current: false }, observedCandleScope: scope,
      observedCandleHistoryRef: { current: buffer }, timeframeToMs: () => 60000,
      isHeikinAshiStyle: () => false, buildSafeChartData: rows => rows,
      eventSourceTimeByChartTimeRef: { current: new Map() }, eventChartTimeBySourceTimeRef: { current: new Map() },
    });
    for (const name of names) {
      assert.ok(declarations.has(name), `real ${name} expression must exist`);
      const code = `var ${declarations.get(name).getText(source)};`;
      vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    }
    const rows = context[names[1] === "creationData" ? "chartData" : "drawCandles"];
    assert.equal(rows[0].high, 119);
    assert.equal(rows[0].low, 90);
    assert.equal(rows[1].timestamp, 120000);
  }
});

test("unobserved archived bars remain correctable rather than freezing all historical OHLC", () => {
  const buffer = new ObservedCandleHistory();
  buffer.merge(scope, [bar(60000, { high: 150 }), bar(120000)]);
  buffer.observe(scope, bar(120000), 121000);
  assert.equal(buffer.merge(scope, [bar(60000), bar(120000)])[0].high, 103);
});

test("a verified closed history repair supersedes incorrect live body/wicks and survives stale packets", () => {
  const buffer = new ObservedCandleHistory();
  const wrong = bar(60000, { open: 102, high: 150, low: 80, close: 102 });
  buffer.observe(scope, wrong, 119900);
  buffer.observe(scope, bar(120000), 121000);
  const correct = bar(60000, { open: 99, high: 110, low: 95, close: 104 });
  buffer.acceptClosedHistory(scope, [correct, bar(120000, { high: 999 })], 120000);
  const merged = buffer.merge(scope, [wrong, bar(120000)]);
  assert.deepEqual([merged[0].open, merged[0].high, merged[0].low, merged[0].close], [99, 110, 95, 104]);
  assert.equal(merged[1].high, 103, "forming history must remain stream-owned");
  assert.equal(buffer.observe(scope, wrong, 119950).close, 104);
  buffer.acceptClosedHistory(scope, [bar(60000, { close: 105 })], 120000);
  assert.equal(buffer.merge(scope, [wrong])[0].close, 105, "new verified corrections still apply");
});

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

test("closing print and successor share an incremental rollover without invalidating drawings", () => {
  const before = [bar(60000), bar(120000)];
  const after = [before[0], bar(120000, { high: 110, close: 108 }), bar(180000)];
  assert.equal(clockCandleHistoryNeedsRedraw(before, after), false);
  assert.equal(clockCandleTimelineChanged(before, after), false);
  assert.equal(clockCandleHistoryNeedsRedraw(before, [before[0], bar(150000), bar(180000)]), true);
  assert.equal(clockCandleTimelineChanged(before, [before[0], bar(90000), before[1]]), true);
  assert.equal(clockCandleTimelineChanged(before, [bar(120000), bar(180000)]), false);
  assert.equal(clockCandleTimelineChanged(before, [bar(60000, { high: 111 }), before[1]]), false);
});

test("actual Chart rollover effect finalizes the old candle then appends without setData or loading", () => {
  const sourceText = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("Chart.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect"
        && node.arguments[0]?.getText(source).includes("const previousPaintCandles =")) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(effect);
  const before = [bar(60000), bar(120000)];
  const after = [before[0], bar(120000, { high: 110, close: 108 }), bar(180000)];
  for (const alreadyAppended of [false, true]) {
    const calls = [];
    const ref = current => ({ current });
    const context = vm.createContext({
      candles: after, observedSourceCandles: after, seriesCandles: after,
      instrument: "NQ", timeframe: "1m", liveCandleEventKey: "NQ:1m", candleStyle: "candles",
      latestDirectLiveCandleRef: ref(null), latestCandleRef: ref(null),
      candleSeriesRef: ref({ update: (data, historical) => calls.push({ data, historical }), setData: () => assert.fail("rollover replaced history") }),
      chartRef: ref({}), lastDrawnCandleStyleRef: ref("candles"),
      previousPaintCandlesRef: ref(before), prevDataRef: ref("old"),
      prevCandlesLengthRef: ref(2), prevFirstTimestampRef: ref(60000),
      lastRenderedCandleTimeRef: ref(alreadyAppended ? 180 : 120), lastRenderedSourceTimestampRef: ref(alreadyAppended ? 180000 : 120000),
      timeframeToMs: () => 60000, isHeikinAshiStyle: () => false,
      clockCandleHistoryNeedsRedraw, clockCandleTimelineChanged,
      setChartVisualReady: () => assert.fail("rollover showed loading"),
      drawingTimelineRevisionRef: ref(9),
      observedCandleHistoryRef: ref(new ObservedCandleHistory()), observedCandleScope: "rollover-test",
    });
    vm.runInContext(ts.transpileModule(`(${effect.getText(source)})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    assert.deepEqual(calls.map(call => [call.data.time, call.data.high, call.data.close]), [[120, 110, 108], [180, 103, 101]]);
    assert.equal(calls[0].historical, alreadyAppended);
    assert.equal(context.drawingTimelineRevisionRef.current, 9);
  }
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

test("batched futures quotes cannot create OHLC prints, while trading marks still receive them", () => {
  const source = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const consume = source.slice(source.indexOf("const consumeLivePrice ="), source.indexOf("pendingLiveTicksRef.current.push({", source.indexOf("const consumeLivePrice =")));
  assert.match(consume, /if \(usingDatabentoPaneFeed\) return;/);
  assert.ok(consume.indexOf("onLiveExecutionQuote(executionQuote)") < consume.indexOf("if (usingDatabentoPaneFeed) return"));
  assert.ok(consume.includes("PAPER_MARK_QUOTE_EVENT"));
});
