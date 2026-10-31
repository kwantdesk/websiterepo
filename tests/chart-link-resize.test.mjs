import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as viewport from "../src/lib/chartViewportSync.ts";

// Exercise the actual production effect, including subscription ownership and
// queued callbacks, without constructing the unrelated full trading workspace.
const source = readFileSync("src/components/Chart.tsx", "utf8");
const ast = ts.createSourceFile("Chart.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect"
    && node.arguments[0]?.getText(ast).includes("const canApplySnapshots = viewportSyncRole")) effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect);
const compiled = ts.transpileModule(`const install = ${effect};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(t, role = "peer") {
  const oldWindow = globalThis.window, frames = new Map(), timers = new Map(), sizeHandlers = new Set();
  let id = 0, applications = 0, range = { from: 10, to: 50 };
  const window = new EventTarget();
  Object.assign(window, {
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: key => frames.delete(key),
    setTimeout: fn => { timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key),
  });
  globalThis.window = window;
  const ref = current => ({ current }), group = `resize:${t.name}`, start = Date.parse("2026-10-30T13:30:00Z");
  const candles = Array.from({ length: 100 }, (_, i) => ({ timestamp: start + i * 60000, close: 760 + i / 100 }));
  const scale = {
    subscribeSizeChange: fn => sizeHandlers.add(fn), unsubscribeSizeChange: fn => sizeHandlers.delete(fn),
    subscribeVisibleTimeRangeChange() {}, unsubscribeVisibleTimeRangeChange() {},
    getVisibleLogicalRange: () => range,
    getVisibleRange: () => ({ from: start / 1000 + range.from * 60, to: start / 1000 + range.to * 60 }),
    timeToIndex: time => (Number(time) * 1000 - start) / 60000,
    setVisibleLogicalRange: next => { range = next; applications++; }, setVisibleRange() { throw Error("Unexpected time fallback"); },
  };
  const price = { getVisibleRange: () => ({ from: 757, to: 763 }), setVisibleRange() {}, setAutoScale() {} };
  const context = {
    chartRef: ref({ timeScale: () => scale, priceScale: () => price }), chartContainerRef: ref(new EventTarget()),
    viewportSyncGroup: group, viewportSyncRole: role, chartInstanceId: "pane", instrument: "SPY", timeframe: "1m",
    viewportSyncCandlesRef: ref(candles), viewportSyncApplyingRef: ref(false), viewportSyncUserInteractionRef: ref(false),
    viewportSyncPublishFrameRef: ref(null), viewportSyncReleaseTimerRef: ref(null), viewportSyncRestoreRef: ref(null),
    viewportSyncReplayScopeRef: ref("live"), eventChartTimeBySourceTimeRef: ref(new Map()), eventSourceTimeByChartTimeRef: ref(new Map()),
    timeframeToMs: () => 60000, ...viewport,
  };
  const snapshot = { groupId: group, sourceChartId: "pane", instrument: "SPY", timeframe: "1m", replayScope: "live",
    sourceDataLength: 100, sourceLastTimestamp: candles.at(-1).timestamp, anchorPrice: candles.at(-1).close,
    visibleTimeRange: scale.getVisibleRange(), visibleLogicalRange: { ...range }, priceRange: { from: 757, to: 763 }, updatedAt: 0,
    timeScaleAnchors: [{ timestamp: candles[10].timestamp, logical: 10 }, { timestamp: candles[50].timestamp, logical: 50 }],
  };
  viewport.publishChartViewport(snapshot);
  const cleanup = new Function(...Object.keys(context), `${compiled}; return install();`)(...Object.values(context));
  t.after(() => { cleanup?.(); viewport.clearChartViewportGroup(group); globalThis.window = oldWindow; });
  return {
    context, snapshot, cleanup, frames, sizeHandlers,
    current: () => range, applications: () => applications,
    resize: () => { range = { from: 30, to: 50 }; sizeHandlers.forEach(fn => fn(400, 300)); },
    flush: () => { for (let i = 0; frames.size && i < 10; i++) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } },
  };
}

test("a resized linked leader restores its own cached time window", t => {
  const f = fixture(t); f.resize(); f.flush();
  assert.deepEqual(f.current(), { from: 10, to: 50 });
  assert.equal(f.applications(), 1);
});
test("bursts of native plot/axis width changes coalesce into one restore", t => {
  const f = fixture(t); f.resize(); f.resize(); f.resize();
  assert.equal(f.frames.size, 1); f.flush(); assert.equal(f.applications(), 1);
});
test("an active gesture leads with its current range rather than being reset", t => {
  const f = fixture(t); f.context.viewportSyncUserInteractionRef.current = true; f.resize(); f.flush();
  assert.deepEqual(viewport.readLatestChartViewport(f.snapshot.groupId).visibleLogicalRange, { from: 30, to: 50 });
  assert.equal(f.applications(), 0);
});
test("unlink/unmount cancels pending native resize work and subscriptions", t => {
  const f = fixture(t); f.resize(); f.cleanup(); f.flush();
  assert.equal(f.sizeHandlers.size, 0); assert.equal(f.frames.size, 0); assert.equal(f.applications(), 0);
});
test("independent panes acquire no plot-size synchronization", t => {
  const f = fixture(t, "independent"); f.resize(); f.flush();
  assert.equal(f.sizeHandlers.size, 0); assert.equal(f.applications(), 0);
});
