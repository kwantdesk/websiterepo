import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  indicatorCandleSnapshotChanged,
  isLiveIndicatorBoundaryAppend,
  mergeLiveIndicatorCandle,
} from "../src/lib/chartLiveEvents.ts";

// Execute the real Chart effect and its dependency list with deterministic
// timers. This catches the output -> effect -> timer -> output feedback loop,
// rather than testing a duplicate implementation of the scheduler.
const source = ts.createSourceFile("Chart.tsx", readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let samplingCall;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect"
    && node.arguments[0]?.getText(source).includes("const historyShapeChanged")) samplingCall = node;
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(samplingCall);
const effectCode = ts.transpileModule(`globalThis.sampleEffect = ${samplingCall.arguments[0].getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const dependencyCode = samplingCall.arguments[1].getText(source);

function harness({ replay = false, regressOutputDependency = false } = {}) {
  const candle = { timestamp: 100_000, open: 100, high: 102, low: 99, close: 101, volume: 10 };
  const candles = [candle];
  const tape = [{ timestamp: 100_001 }];
  const ref = (current) => ({ current });
  const timers = new Map();
  let timerId = 0;
  let commits = 0;
  const state = {
    candles, marketTrades: tape, marketTradesVersion: 1,
    sampledIndicatorCandles: candles,
    sampledIndicatorCandlesRef: ref(candles),
    sampledIndicatorMarketTradesRef: ref(tape),
    pendingIndicatorCandlesRef: ref(candles),
    pendingIndicatorMarketTradesRef: ref(tape),
    pendingIndicatorMarketTradesVersionRef: ref(1),
    sampledOrderFlowHistoryReadyRef: ref(true),
    latestCandleRef: ref({ ...candle, close: 102, volume: 20 }),
    indicatorSampleTimerRef: ref(null),
    orderFlowHistoryReady: true, orderFlowIndicatorEnabled: true,
    indicatorSamplingEnabled: true, footprintSamplingEnabled: replay,
    nonFootprintIndicatorSamplingEnabled: true, nonFootprintOrderFlowIndicatorEnabled: true,
    volumeIndicatorEnabled: false, keyboardActive: true,
    chartFrameWorkKey: "test", replayTimestampMs: replay ? 100_001 : null,
    ORDER_FLOW_DATA_REFRESH_INTERVAL_MS: 750,
    indicatorCandleSnapshotChanged,
    isLiveIndicatorBoundaryAppend,
    mergeLiveIndicatorCandle,
    queueChartFrameWork: (_key, callback) => callback(),
    startTransition: (callback) => callback(),
    setSampledIndicatorCandles: (value) => {
      const next = typeof value === "function" ? value(state.sampledIndicatorCandles) : value;
      if (next !== state.sampledIndicatorCandles) commits++;
      state.sampledIndicatorCandles = next;
      // The preceding committed-snapshot effect runs before the sampling effect.
      state.sampledIndicatorCandlesRef.current = next;
    },
    setSampledIndicatorMarketTrades: () => {},
    setSampledIndicatorMarketTradesVersion: () => {},
    window: {
      setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
      clearTimeout: (id) => timers.delete(id),
    },
  };
  vm.createContext(state);
  vm.runInContext(effectCode, state);
  let previousDependencies;
  const render = () => {
    const dependencies = vm.runInContext(dependencyCode, state);
    if (regressOutputDependency) dependencies.push(state.sampledIndicatorCandles);
    if (!previousDependencies || dependencies.some((value, index) => !Object.is(value, previousDependencies[index]))) {
      previousDependencies = dependencies;
      state.sampleEffect();
    }
  };
  const drain = () => {
    render();
    for (let count = 0; timers.size && count < 20; count++) {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      callback();
      render();
    }
    assert.equal(timers.size, 0, "unchanged market data must not re-arm the sampling timer");
  };
  return { state, drain, commits: () => commits };
}

test("restoring the old sampled-output dependency reproduces the idle feedback loop", () => {
  const { drain } = harness({ regressOutputDependency: true });
  assert.throws(drain, /unchanged market data must not re-arm/);
});

test("a live tail ahead of props settles once instead of rebuilding forever when trades stop", () => {
  const { state, drain, commits } = harness();
  drain();
  assert.equal(commits(), 1);
  assert.equal(state.sampledIndicatorCandles.at(-1).volume, 20);
  for (let i = 0; i < 100; i++) drain();
  assert.equal(commits(), 1);
  state.latestCandleRef.current = { ...state.latestCandleRef.current, volume: 30 };
  state.marketTradesVersion++;
  drain();
  assert.equal(state.sampledIndicatorCandles.at(-1).volume, 30);
  assert.equal(commits(), 2, "real new execution revisions must still schedule a sample");
});

test("new history snapshots still replace older samples, including same-length corrections", () => {
  const { state, drain } = harness();
  drain();
  state.latestCandleRef.current = null;
  state.candles = [{ ...state.candles[0], high: 105 }];
  drain();
  assert.equal(state.sampledIndicatorCandles[0].high, 105);
  state.candles = [{ ...state.candles[0], timestamp: 40_000 }, ...state.candles];
  drain();
  assert.equal(state.sampledIndicatorCandles.length, 2);
});

test("replay changes commit immediately and can move backwards without a timer loop", () => {
  const { state, drain } = harness({ replay: true });
  state.candles = [{ ...state.candles[0], timestamp: 160_000, volume: 50 }];
  state.replayTimestampMs = 160_001;
  drain();
  assert.equal(state.sampledIndicatorCandles[0].timestamp, 160_000);
  state.candles = [{ ...state.candles[0], timestamp: 100_000, volume: 5 }];
  state.replayTimestampMs = 100_001;
  drain();
  assert.equal(state.sampledIndicatorCandles[0].volume, 5);
});
