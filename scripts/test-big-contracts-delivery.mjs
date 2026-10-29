import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { admitLiveDeepContractEvents } from "../src/lib/deepContracts.ts";
import {
  advanceBigTradeLiveAccumulator,
  anchorBigTradePrintsToCandles,
  buildEventBarChartTimeMap,
  calculateBigTradePrintsWithContext,
  createBigTradeLiveAccumulator,
  mergeBigTradeLiveMarkers,
  retainBigTradePrints,
} from "../src/lib/bigTrades.ts";

const root = new URL("../", import.meta.url);
const workspace = readFileSync(new URL("src/components/KwantifyWorkspace.tsx", root), "utf8");
const chart = readFileSync(new URL("src/components/Chart.tsx", root), "utf8");
const settings = { filterMode: "manual", manualFilter: 50, splitSessions: false,
  enableClustering: true, clusterWindowMs: 100, clusterPriceTicks: 0,
  maxMarkersPerBar: 50, tickSize: 0.25 };
const start = Date.UTC(2026, 9, 29, 14, 0);
const trade = (id, volume, timestamp, price = 29000) => ({
  eventId: id, recordIndex: id, timestamp, close: price,
  volume, trades: 1, aggressor: "BUY", askVolume: volume, bidVolume: 0,
});
const candle = timestamp => ({ timestamp, open: 29000, high: 29010, low: 28990,
  close: 29000, volume: 100, trades: 30 });
const run = (source, scope) => vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, scope);

function fixture(overrides = {}) {
  const config = { ...settings, ...overrides };
  const seed = [trade("seed", 1, start)];
  const { context } = calculateBigTradePrintsWithContext([candle(start)], seed, config, start);
  assert.ok(context);
  const paints = [];
  const events = [];
  const scope = {
    indicators: [{ indicatorId: "big-trades", enabled: true }],
    bigTradesIndicator: { settings: config },
    bigTradeLiveContextRef: { current: context },
    bigTradeLiveAccumulatorRef: { current: createBigTradeLiveAccumulator(context, seed, start) },
    bigTradeLatestLiveTapeRef: { current: null }, observedCandleScope: "pane:NQ:1m:live",
    bigTradeCommittedRef: { current: { markers: [], watermark: start } },
    bigTradesPrimitiveRef: { current: { update: markers => paints.push(structuredClone(markers)) } },
    bigTradePrimitiveOptionsRef: { current: {} },
    liveReplayActiveRef: { current: false }, liveCandleEventKey: "pane",
    sampledIndicatorCandlesRef: { current: [candle(start)] },
    eventChartTimeBySourceTimeRef: { current: new Map() },
    priceFormat: { minMove: 0.25 }, timeframe: "1m", candleIntervalMs: 60000,
    advanceBigTradeLiveAccumulator, anchorBigTradePrintsToCandles,
    createBigTradeLiveAccumulator, calculateBigTradePrintsWithContext,
    buildEventBarChartTimeMap, mergeBigTradeLiveMarkers,
    isEventBasedChartInterval: interval => interval === "range",
    LIVE_CHART_EXECUTION_EVENT: "executions", LIVE_CHART_CANDLE_EVENT: "candle",
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    window: { dispatchEvent(event) {
      events.push(event);
      if (event.type === "executions") scope.receive(event);
    } },
    document: { visibilityState: "visible" },
    needsOrderFlowHistory: true,
    pane: { id: "pane", symbol: "NQ", timeframe: "1m" },
    latestMarketTradesRef: { current: seed }, latestCandlesRef: { current: [candle(start)] },
    liveTailStartTimestampRef: { current: null }, executionContinuityRef: { current: { status: "continuous" } },
    lastCandleStateSyncRef: { current: 0 },
    mergeSharedWorkspaceExecutionTape: (_symbol, _interval, previous, records) => [...previous, ...records],
    scheduleMarketTradeStateSync() {}, queueProfileUpdate() {},
    applyInstitutionalTradesToCandles: (_previous, records) => [candle(start), candle(Math.floor(records.at(-1).timestamp / 60000) * 60000)],
    applyMarketTradesToEventBars: () => scope.eventCandles,
    hasUsableOrderFlowHistory: () => true, setOrderFlowHistoryReady() {},
    reconcileCandleFlowFromTape: candles => candles,
    executionCandlePaintBatch: (_previous, candles) => [candles.at(-1)],
    syncCandles() {}, startTransition: callback => callback(), setCandles() {},
    retainedBigTradePrintsRef: { current: [] }, bigTradeFullScanIdentityRef: { current: "" },
    bigTradeReplayClockRef: { current: null }, bigTradeTapeWatermarkRef: { current: start },
    indicatorCandles: [candle(start)], indicatorMarketTrades: seed, bigContractHistory: [],
    instrument: "NQ", replayTimestampMs: null,
    replayRetentionMustReset: () => false, mergeBigContractHistory: (history, tape) => [...history, ...tape],
    recentExecutionTail: tape => tape, retainBigTradePrints,
  };
  const flagsStart = workspace.indexOf("  const footprintLiveActive =");
  const flagsEnd = workspace.indexOf("  const nonFootprintOrderFlowActive =", flagsStart);
  run(workspace.slice(flagsStart, flagsEnd) +
    "\nObject.assign(globalThis, {footprintLiveActive, instantTapeLiveActive, auctionGapLiveActive, bigContractsLiveActive});", scope);
  assert.equal(scope.bigContractsLiveActive, true);
  assert.equal(scope.footprintLiveActive, false);
  const liveStart = chart.indexOf("Draw a qualifying print the moment");
  const handlerStart = chart.indexOf("    const receive = (event: Event) => {", liveStart);
  const handlerEnd = chart.indexOf("    window.addEventListener", handlerStart);
  assert.ok(liveStart > 0 && handlerStart > liveStart && handlerEnd > handlerStart);
  run(chart.slice(handlerStart, handlerEnd) + "\nglobalThis.receive = receive;", scope);
  const passStart = chart.indexOf("  const bigTradePrints = useMemo(");
  const passEnd = chart.indexOf("  const anchoredBigTradePrints", passStart);
  const pass = chart.slice(passStart, passEnd).match(/\(\) => \{([\s\S]*?)\r?\n    \},\r?\n    \/\/ eslint-disable-next-line/);
  assert.ok(pass, "extract the actual sampled calculation, including its catch-up");
  run(`globalThis.fullPass = () => {${pass[1]}\n};`, scope);
  const anchors = chart.slice(passEnd).match(/useMemo\(\(\) => \{([\s\S]*?)\r?\n  \}, \[bigTradePrints/);
  assert.ok(anchors);
  run(`globalThis.anchorPass = () => {${anchors[1]}\n};`, scope);
  const flushStart = workspace.indexOf("    const flushExecutionRecords = () => {");
  const flushEnd = workspace.indexOf("    const executionPaintScheduler =", flushStart);
  run("let pendingExecutionRecords = []; let lastFlowReconcileAt = 0;\n" + workspace.slice(flushStart, flushEnd) +
    "\nglobalThis.deliver = records => { pendingExecutionRecords = records; flushExecutionRecords(); };", scope);
  return { scope, paints, events, deliver: scope.deliver };
}

// The optional Deep Contracts renderer must use execution bar times too,
// rather than attaching an earlier print to the latest candle in the batch.
{
  const f = fixture({ deepMinimumTradeSize: 30 });
  f.scope.admitLiveDeepContractEvents = admitLiveDeepContractEvents;
  f.scope.deepContractsPrimitiveRef = f.scope.bigTradesPrimitiveRef;
  f.scope.deepContractPrimitiveOptionsRef = { current: {} };
  f.scope.deepContractCommittedRef = { current: { zones: [], watermark: start } };
  const handlerStart = chart.indexOf("    const receive = (event: Event) => {",
    chart.indexOf("settings?.showDeepContracts !== true) return;"));
  const handlerEnd = chart.indexOf("    window.addEventListener", handlerStart);
  run("{\n" + chart.slice(handlerStart, handlerEnd) + "\nglobalThis.receive = receive;\n}", f.scope);
  f.deliver([trade("old-bar", 60, start + 1000), trade("new-bar", 60, start + 60001)]);
  assert.equal(f.paints.at(-1).length, 2);
  assert.equal(f.paints.at(-1).find(zone => zone.id === "deep-old-bar").startTime, start / 1000);
  assert.equal(f.paints.at(-1).find(zone => zone.id === "deep-new-bar").startTime, (start + 60000) / 1000);
}

// The actual full-pass callback is allowed to start behind the live tape. It
// must catch up before returning a replacement marker set, with no flicker.
{
  const f = fixture({ enableClustering: false });
  const first = trade("before-snapshot", 60, start + 1000);
  const second = trade("after-snapshot", 70, start + 1500);
  f.deliver([first]);
  f.deliver([second]);
  f.scope.indicatorMarketTrades = [trade("seed", 1, start), first];
  const replacement = f.scope.fullPass();
  assert.deepEqual(Array.from(replacement, print => print.id), [first.eventId, second.eventId]);
  assert.equal(f.scope.bigTradeLiveAccumulatorRef.current.cursor, second.timestamp);
}

// A truly empty session must display its FIRST qualifying execution without
// waiting for a sampled React context to exist.
{
  const f = fixture({ enableClustering: false });
  f.scope.bigTradeLiveContextRef.current = null;
  f.scope.bigTradeLiveAccumulatorRef.current = null;
  f.scope.bigTradeCommittedRef.current.watermark = 0;
  f.scope.latestMarketTradesRef.current = [];
  f.deliver([trade("first-ever", 80, start + 1000)]);
  assert.equal(f.paints.length, 1);
  assert.equal(f.paints[0][0].id, "first-ever");
}

// Actual workspace publisher -> actual Chart listener -> primitive, with only
// Big Contracts enabled. There is deliberately no React or periodic full pass.
{
  const f = fixture({ enableClustering: false });
  f.deliver([trade("large", 75, start + 1000)]);
  assert.equal(f.paints.length, 1, "must paint during the first received batch");
  assert.equal(f.paints[0][0].id, "large");
  assert.ok(f.events.findIndex(e => e.type === "candle") < f.events.findIndex(e => e.type === "executions"));
  const event = f.events.find(e => e.type === "executions");
  assert.equal(event.detail.candles, f.scope.latestCandlesRef.current, "share the current canonical boundaries");
  f.deliver([trade("second", 60, start + 1500)]);
  assert.equal(f.paints.at(-1).length, 2, "another batch must retain the first marker without a full pass");
  f.scope.liveReplayActiveRef.current = true;
  f.deliver([trade("future", 500, start + 2000)]);
  assert.equal(f.paints.length, 2, "live trades must not leak into replay");
}

// Distinct executions sharing the seed/watermark millisecond are not duplicates.
{
  const f = fixture({ enableClustering: false });
  f.deliver([trade("same-ms-1", 50, start), trade("same-ms-2", 55, start)]);
  assert.equal(f.paints.at(-1).length, 2);
  f.deliver([trade("same-ms-2", 55, start)]);
  assert.equal(f.paints.length, 1, "repeated delivery must not count the execution twice");
}

// The 50-contract threshold can be crossed by a cluster spanning SSE batches.
// It appears on the crossing batch, grows in place, and matches a full scan.
{
  const f = fixture();
  const records = [trade("a", 20, start + 1000), trade("b", 20, start + 1020), trade("c", 20, start + 1040)];
  f.deliver([records[0]]);
  f.deliver([records[1]]);
  assert.equal(f.paints.length, 0);
  f.deliver([records[2]]);
  assert.equal(f.paints.length, 1);
  assert.equal(f.paints[0][0].volume, 60);
  assert.equal(f.paints[0][0].id, "a");
  records.push(trade("d", 10, start + 1060));
  f.deliver([records.at(-1)]);
  assert.equal(f.paints.at(-1).length, 1);
  assert.equal(f.paints.at(-1)[0].volume, 70);
  const full = calculateBigTradePrintsWithContext([candle(start)], f.scope.latestMarketTradesRef.current, settings, start + 1060);
  assert.equal(full.prints[0].id, f.paints.at(-1)[0].id);
  assert.equal(full.prints[0].volume, 70);
  assert.equal(full.prints[0].timestamp, f.paints.at(-1)[0].timestamp);
}

// Bar rollover uses this batch's boundaries even while indicator React props
// still hold the old candle. Event charts can close six bars between samples.
{
  const f = fixture({ enableClustering: false });
  f.deliver([trade("rollover", 80, start + 60010)]);
  assert.equal(f.paints.at(-1)[0].time, (start + 60000) / 1000);
  const g = fixture({ enableClustering: false });
  g.scope.timeframe = g.scope.pane.timeframe = "range";
  g.scope.eventCandles = Array.from({ length: 7 }, (_, i) => candle(start + i * 100));
  g.scope.eventChartTimeBySourceTimeRef.current.set(start + 600, start / 1000 + 1);
  g.deliver([trade("range-six", 80, start + 610)]);
  assert.equal(g.paints.length, 1);
  assert.equal(g.paints[0][0].time, buildEventBarChartTimeMap(g.scope.eventCandles).get(start + 600));
  g.scope.bigTradePrints = g.scope.fullPass();
  const replacement = g.scope.anchorPass();
  assert.equal(replacement[0].chartTimestamp, start + 600,
    "a caught-up sampled pass must not re-anchor the print six bars backward");
}

// A capped cluster can become ineligible while forming. Remove that one marker
// immediately, rather than preserving an incorrect print until the next scan.
{
  const f = fixture({ cappingMode: "reject", cappingMaxVolume: 80 });
  f.deliver([trade("cap", 60, start + 1000)]);
  assert.equal(f.paints.at(-1).length, 1);
  f.deliver([trade("cap-cross", 30, start + 1020)]);
  assert.equal(f.paints.at(-1).length, 0);
}

// Rebase in the middle of a still-subthreshold cluster: catch-up must neither
// lose its earlier fills nor count them a second time.
{
  const f = fixture();
  const a = trade("seeded-cluster", 20, start + 1000);
  f.deliver([a]);
  f.deliver([trade("cluster-b", 20, start + 1020)]);
  f.scope.indicatorMarketTrades = [trade("seed", 1, start), a];
  assert.equal(f.scope.fullPass().length, 0);
  f.deliver([trade("cluster-c", 20, start + 1040)]);
  assert.equal(f.paints.length, 1);
  assert.equal(f.paints[0][0].volume, 60);
}

// Compare every batch against an independently recalculated historical prefix,
// including shared timestamps, price/direction boundaries and cap rejection.
for (const cap of [0, 80]) {
  const config = { ...settings, cappingMode: cap ? "reject" : "off", cappingMaxVolume: cap };
  const tape = [trade("seed", 1, start)];
  const { context } = calculateBigTradePrintsWithContext([candle(start)], tape, config, start);
  const state = createBigTradeLiveAccumulator(context, tape, start);
  const visible = new Map();
  let timestamp = start + 1000;
  for (let batch = 0; batch < 60; batch += 1) {
    for (let index = 0; index < 7; index += 1) {
      const n = batch * 7 + index;
      timestamp += n % 9 === 0 ? 150 : n % 3 === 0 ? 0 : 20;
      const record = trade(`random-${n}`, 10 + (n * 17 % 65), timestamp, 29000 + Math.floor(n / 11) % 2 * 0.25);
      if (Math.floor(n / 13) % 2) record.aggressor = "SELL";
      tape.push(record);
    }
    const delta = advanceBigTradeLiveAccumulator(state, context, tape, config);
    for (const id of delta.removedIds) visible.delete(id);
    for (const print of delta.prints) visible.set(print.id, print);
    const historical = calculateBigTradePrintsWithContext([candle(start)], tape, config, timestamp).prints;
    const comparable = prints => [...prints].map(({ id, timestamp, price, volume, executions, side }) =>
      ({ id, timestamp, price, volume, executions, side })).sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(comparable(visible.values()), comparable(historical), `live/history parity at batch ${batch}, cap ${cap}`);
  }
}

// A long retained tape must not be scanned at display-frame cadence.
{
  const history = Array.from({ length: 25000 }, (_, index) => trade(`old-${index}`, 1, start + index));
  const { context } = calculateBigTradePrintsWithContext([], history, { ...settings, enableClustering: false }, start + 25000);
  const state = createBigTradeLiveAccumulator(context, history, history.at(-1).timestamp);
  let reads = 0;
  const tape = new Proxy([...history, trade("new", 80, start + 26000)], {
    get(target, property) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads += 1;
      return Reflect.get(target, property);
    },
  });
  assert.equal(advanceBigTradeLiveAccumulator(state, context, tape, settings).prints.length, 1);
  assert.ok(reads < 12, `only the new suffix should be visited, saw ${reads} reads`);
}

console.log("PASS: Big Contracts actual publisher/listener delivery, same-ms executions, cross-batch clustering, stable IDs, rollover, event bars, replay isolation and cap rejection");
