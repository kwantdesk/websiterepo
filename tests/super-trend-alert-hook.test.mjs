import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { SuperTrendLiveCalculator } from "../src/lib/superTrend.ts";
import { SuperTrendAlertTracker } from "../src/lib/superTrendAlerts.ts";
import { normalizeSuperTrendSettings } from "../src/lib/superTrendSettings.ts";

test("actual hook dispatches and displays a live reversal; stale/wrong-chart/unmounted events do not", () => {
  const source = fs.readFileSync(new URL("../src/components/useSuperTrendAlerts.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const effects = [], notices = [], cleanups = [];
  const fakeReact = { useRef: value => ({ current: value }), useEffect: fn => effects.push(fn),
    useState: value => [value, next => notices.push(next)] };
  const loaded = { exports: {} };
  const mockRequire = name => {
    if (name === "react") return fakeReact;
    if (name.endsWith("chartLiveEvents")) return { LIVE_CHART_CANDLE_EVENT: "kwantdesk:live-chart-candle" };
    if (name.endsWith("superTrend")) return { SuperTrendLiveCalculator };
    if (name.endsWith("superTrendAlerts")) return { SuperTrendAlertTracker };
    if (name.endsWith("superTrendSettings")) return { normalizeSuperTrendSettings };
    throw new Error(name);
  };
  new Function("require", "module", "exports", compiled)(mockRequire, loaded, loaded.exports);
  const originalWindow = globalThis.window;
  const target = new EventTarget(), alerts = [];
  globalThis.window = target;
  target.addEventListener("kwantdesk:chart-indicator-alert", e => alerts.push(e.detail));
  const now = Date.now();
  const history = Array.from({ length: 4 }, (_, i) => ({ timestamp: now - 4000 + i * 1000,
    open: 10, close: 10, high: 11, low: 9 }));
  try {
    loaded.exports.useSuperTrendAlerts({ indicators: [{ instanceId: "test", indicatorId: "super-trend", enabled: true,
      settings: { length: 3, multiplier: 1, messagePopupEnabled: true, alertSoundEnabled: false } }],
      history, liveKey: "nq-pane", instrument: "NQ", timeframe: "1m", live: true });
    effects.forEach(fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); });
    const candle = { ...history.at(-1), close: 14, high: 15 };
    const emit = detail => target.dispatchEvent(new CustomEvent("kwantdesk:live-chart-candle", { detail }));
    emit({ key: "other", candle, sourceTimestampMs: now });
    assert.equal(alerts.length, 0);
    emit({ key: "nq-pane", candle, sourceTimestampMs: now });
    assert.equal(alerts.length, 1); assert.equal(alerts[0].popup, true); assert.equal(alerts[0].sound, null);
    assert.equal(notices.at(-1), "Super Trend: Uptrend");
    emit({ key: "nq-pane", candle, sourceTimestampMs: now + 1 });
    assert.equal(alerts.length, 1);
    emit({ key: "nq-pane", candle: history.at(-1), sourceTimestampMs: now - 60000 });
    assert.equal(alerts.length, 1);
    cleanups.splice(0).forEach(fn => fn());
    emit({ key: "nq-pane", candle, sourceTimestampMs: now + 2 });
    assert.equal(alerts.length, 1);
  } finally {
    cleanups.forEach(fn => fn()); globalThis.window = originalWindow;
  }
});

test("all actual workspace candle publishers include provider time, never dispatch-clock fallback", () => {
  const source = fs.readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const values = [];
  const visit = node => {
    if (ts.isNewExpression(node) && node.expression.getText(file) === "CustomEvent"
      && node.arguments?.[0]?.getText(file) === "LIVE_CHART_CANDLE_EVENT") {
      const text = node.arguments[1].getText(file);
      assert.match(text, /sourceTimestampMs:/); assert.doesNotMatch(text, /Date\.now/);
      values.push(text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file); assert.equal(values.length, 4);
  assert.equal(values.filter(v => v.includes("newestSourceTimestamp")).length, 2);
  assert.ok(values.some(v => v.includes("record.timestamp")));
  assert.ok(values.some(v => v.includes("chartSourceTimestamp(snapshot.timestamp)")));
});
