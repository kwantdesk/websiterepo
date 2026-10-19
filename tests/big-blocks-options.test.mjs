import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BigOptionsTape, normalizeBigOptionsSettings } from "../src/lib/bigBlocksOptions.ts";
import { bigOptionsBarLayout, BigBlocksOptionsPrimitive } from "../src/lib/bigBlocksOptionsPrimitive.ts";
import { createBigOptionsFeed } from "../src/lib/bigBlocksOptionsFeed.ts";
import { CHART_INDICATOR_CATALOG } from "../src/lib/chartIndicatorCatalog.ts";
import { defaultIndicatorSettings, normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";
import { indicatorCompatibility } from "../src/lib/indicatorInstrumentCompatibility.ts";
import { auditIndicatorLibrary } from "../scripts/audit-indicator-library.mjs";

const clock = Date.parse("2026-10-19T15:00Z");
const row = (id, changes = {}) => ({ id, parentId: null, ticker: "QQQ", contractType: "CALL", size: 100,
  premium: 20000, stockPrice: 500, strikePrice: 510, tradeTime: clock, multiLeg: false, ...changes });
const settings = normalizeBigOptionsSettings();
const levels = (rows, options = {}, at = clock) => {
  const tape = new BigOptionsTape(); tape.update("2026-10-19", rows);
  return tape.levels("QQQ", normalizeBigOptionsSettings(options), at);
};

test("qualifying calls and puts combine at price without netting or double counting", () => {
  const tape = new BigOptionsTape();
  const call = row("a"), put = row("b", { contractType: "PUT", size: 300 });
  tape.update("2026-10-19", [call, put, call, row("child", { parentId: "a" })]);
  tape.update("2026-10-19", [call, put]);
  assert.equal(tape.size(), 2);
  assert.deepEqual(tape.levels("QQQ", settings, clock), [{ price: 500, call: 100, put: 300, callContracts: 100, putContracts: 300, trades: 2 }]);
});
test("revised parent size/price replaces the old contribution instead of accumulating it", () => {
  const tape = new BigOptionsTape(); tape.update("2026-10-19", [row("a")]);
  tape.update("2026-10-19", [row("a", { stockPrice: 501, size: 400 })]);
  assert.deepEqual(tape.levels("QQQ", settings, clock).map(level => [level.price, level.call]), [[501, 400]]);
  tape.update("2026-10-19", [row("a", { size: 1 })]);
  assert.deepEqual(tape.levels("QQQ", settings, clock), []);
});
test("thresholds apply per order, never a crowd of small prints triggering a big block", () => {
  assert.deepEqual(levels(Array.from({ length: 20 }, (_, i) => row(String(i), { size: 10 }))), []);
  assert.deepEqual(levels([row("a")], { minPremium: 30000 }), []);
  assert.equal(levels([row("a")], { minContracts: 50, minPremium: 10000 }).length, 1);
});
test("unknown sides, missing prices, future prints, other symbols and multi-legs fail closed", () => {
  const invalid = [row("a", { contractType: "UNKNOWN" }), row("b", { stockPrice: null }),
    row("c", { tradeTime: clock + 1 }), row("d", { ticker: "SPY" }), row("e", { multiLeg: true }),
    row("f", { size: NaN }), row("g", { premium: Infinity })];
  assert.deepEqual(levels(invalid), []);
  assert.equal(levels([invalid[4]], { includeMultiLeg: true }).length, 1);
});
test("strike, premium, grouping, side switches and rolling windows actually change the output", () => {
  const rows = [row("a", { stockPrice: 500.1 }), row("b", { contractType: "PUT", stockPrice: 500.2 })];
  assert.equal(levels(rows, { binSize: 1 }).length, 1);
  assert.deepEqual(levels(rows, { useStrikePrice: true, sizeByPremium: true, showCalls: false })
    .map(level => [level.price, level.call, level.put]), [[510, 0, 20000]]);
  assert.deepEqual(levels(rows, { windowMinutes: 1 }, clock + 61000), []);
  assert.equal(levels(rows, { windowMinutes: 0 }, clock + 61000).length, 2);
});
test("session changes clear old positions and storage remains bounded", () => {
  const tape = new BigOptionsTape(); tape.update("2026-10-19", Array.from({ length: 5010 }, (_, i) => row(String(i), { tradeTime: clock - i })));
  assert.equal(tape.size(), 5000); assert.equal(tape.truncated, true);
  tape.update("2026-10-20", [row("fresh")]);
  assert.equal(tape.size(), 1); assert.equal(tape.truncated, false);
});
test("right-edge lengths are proportional, anchored to price and rescale with the viewport", () => {
  const frame = { settings, levels: levels([row("a"), row("b", { contractType: "PUT", size: 200 })]) };
  const [first] = bigOptionsBarLayout(frame, 1000, 500, price => price - 250);
  assert.equal(first.right, 996); assert.equal(first.y, 250);
  assert.equal(first.callWidth, 75); assert.equal(first.putWidth, 150);
  const [moved] = bigOptionsBarLayout(frame, 800, 500, price => price - 300);
  assert.equal(moved.right, 796); assert.equal(moved.y, 200);
  assert.deepEqual(bigOptionsBarLayout(frame, 800, 500, () => null), []);
});
test("zoomed-out close levels keep distinct coordinates without overlapping large bars/labels", () => {
  const frame = { settings, levels: [{ price: 500, call: 10, put: 0 }, { price: 501, call: 20, put: 0 }] };
  const bars = bigOptionsBarLayout(frame, 300, 600, price => price);
  assert.equal(bars.length, 2); assert.ok(bars.every(bar => bar.height === 1));
});
test("primitive lifecycle requests repaint and drops data on detach", () => {
  const primitive = new BigBlocksOptionsPrimitive(); let updates = 0;
  primitive.attached({ requestUpdate() { updates++; } });
  primitive.update({ levels: [], settings });
  assert.equal(updates, 2); assert.equal(primitive.paneViews().length, 1);
  primitive.detached(); assert.equal(primitive.paneViews().length, 0);
});
test("catalog, compatibility, saved settings and renderer are released together", () => {
  const definition = CHART_INDICATOR_CATALOG.find(item => item.id === "big-blocks-options");
  assert.equal(definition.name, "Big Blocks (Options)");
  assert.equal(indicatorCompatibility(definition, "QQQ", "Market Index").canAdd, true);
  assert.equal(indicatorCompatibility(definition, "SPX", "Market Index").canAdd, true);
  assert.equal(indicatorCompatibility(definition, "NQ", "Databento").canAdd, false);
  const saved = normalizeStoredIndicator({ instanceId: "test", indicatorId: definition.id, enabled: true,
    settings: { ...defaultIndicatorSettings(definition.id), widthPx: 99, showPuts: false } });
  assert.equal(saved.settings.widthPx, 99); assert.equal(saved.settings.showPuts, false);
  assert.ok(!auditIndicatorLibrary().pending.some(item => item.id === definition.id));
});
test("malformed saved settings are clamped and cannot make unbounded canvas work", () => {
  const normalized = normalizeBigOptionsSettings({ binSize: 0, maxLevels: 999999, widthPx: Infinity, opacity: -1, callColor: "bad" });
  assert.equal(normalized.binSize, 0.01); assert.equal(normalized.maxLevels, 200);
  assert.equal(normalized.widthPx, 150); assert.equal(normalized.opacity, 10);
});

const payload = { schemaVersion: 1, consolidatedAvailable: true, sessionDate: "2026-10-19", asOf: new Date(clock).toISOString(), rows: [], marketOpen: true, refreshAfterMs: 3000 };
test("multiple panes share one request, and last unsubscribe aborts/disposes the feed", async () => {
  let calls = 0, signal;
  const feed = createBigOptionsFeed(async (_url, options) => { calls++; signal = options.signal; return Response.json(payload); });
  const received = [];
  const off1 = feed.subscribe("QQQ", value => received.push(value));
  const off2 = feed.subscribe("QQQ", value => received.push(value));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1); assert.equal(received.length, 2);
  off1(); assert.equal(signal.aborted, false); off2(); assert.equal(signal.aborted, true);
});
test("invalid snapshots surface unavailable without inventing executions", async () => {
  const feed = createBigOptionsFeed(async () => Response.json({ ...payload, consolidatedAvailable: false }));
  const errors = [];
  const off = feed.subscribe("QQQ", (value, error) => errors.push({ value, error }));
  await new Promise(resolve => setImmediate(resolve)); off();
  assert.equal(errors[0].value, null); assert.match(errors[0].error, /Invalid/);
});
test("refresh failure retains the last snapshot and backs off instead of clearing bars", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const feed = createBigOptionsFeed(async () => {
    calls++; if (calls > 1) throw new Error("offline");
    return Response.json(payload);
  });
  const received = [];
  const off = feed.subscribe("QQQ", (value, error) => received.push({ value, error }));
  await new Promise(resolve => setImmediate(resolve));
  context.mock.timers.tick(3000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2); assert.equal(received.at(-1).value.sessionDate, payload.sessionDate);
  assert.match(received.at(-1).error, /offline/);
  context.mock.timers.tick(3000);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 2);
  off();
});
test("hidden tabs do not issue provider-facing snapshot requests", async () => {
  const previous = globalThis.document;
  globalThis.document = { hidden: true };
  let calls = 0;
  const feed = createBigOptionsFeed(async () => { calls++; return Response.json(payload); });
  const off = feed.subscribe("QQQ", () => {});
  try { await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0); }
  finally { off(); if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
test("chart is wired to the dedicated hook, not the futures Big Blocks engine", () => {
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(chart, /useBigBlocksOptions\(\{ seriesRef: candleSeriesRef/);
  const hook = readFileSync(new URL("../src/components/useBigBlocksOptions.ts", import.meta.url), "utf8");
  assert.match(hook, /Unavailable in replay/); assert.match(hook, /series\.detachPrimitive/);
  assert.match(hook, /const ledger = useRef\(/);
  assert.match(hook, /if \(ledger\.current\.symbol !== symbol\)/);
});
