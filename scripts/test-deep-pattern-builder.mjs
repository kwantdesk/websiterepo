import assert from "node:assert/strict";
import { buildDeepPatternSignals, normalizeDeepPatternBuilderSettings } from "../src/lib/deepPatternBuilder.ts";

const base = Date.parse("2026-09-04T13:30:00Z");
const candles = [
  { timestamp: base, open: 100, high: 102, low: 99, close: 101, volume: 10 },
  { timestamp: base + 60_000, open: 101, high: 104, low: 100, close: 103, volume: 20 },
  { timestamp: base + 120_000, open: 103, high: 104, low: 98, close: 99, volume: 30 },
];
const defaults = normalizeDeepPatternBuilderSettings({}, { accent: "#0f0", background: "#000" });
assert.equal(defaults.conditions.length, 4);
assert.equal(defaults.conditions[0].enabled, true);
assert.equal(defaults.markerColor, "#0f0");
assert.deepEqual(buildDeepPatternSignals(candles, [], defaults, 0.25, base + 5 * 60_000).map((signal) => signal.timestamp), [base, base + 60_000]);

const previousClose = normalizeDeepPatternBuilderSettings({ condition1ASource: "close", condition1AOffset: 0, condition1Comparator: ">", condition1CSource: "close", condition1COffset: 1, calculateOnClose: false });
assert.deepEqual(buildDeepPatternSignals(candles, [], previousClose, 0.25, base + 5 * 60_000).map((signal) => signal.timestamp), [base + 60_000]);

const advanced = normalizeDeepPatternBuilderSettings({ condition2Enabled: true, condition2ASource: "range-ticks", condition2Comparator: ">=", condition2CSource: "constant", condition2CValue: 8, combineMode: "advanced", advancedExpression: "C1 OR (C2 AND NOT C3)", calculateOnClose: false });
assert.equal(buildDeepPatternSignals(candles, [], advanced, 0.25, base + 5 * 60_000).length, 3);

const orderFlow = normalizeDeepPatternBuilderSettings({ condition1ASource: "ask-volume", condition1Comparator: ">", condition1CSource: "bid-volume", calculateOnClose: false });
assert.equal(buildDeepPatternSignals(candles, [], orderFlow, 0.25, base + 5 * 60_000).length, 0, "missing classified executions fail closed");
const footprint = [{ startTime: base, askVolume: 8, bidVolume: 2, askTrades: 2, bidTrades: 1, volume: 10, trades: 3, delta: 6, pocPrice: null, rows: [] }];
assert.equal(buildDeepPatternSignals(candles, footprint, orderFlow, 0.25, base + 5 * 60_000).length, 1);
const longHistory = Array.from({ length: 20_000 }, (_, index) => ({ timestamp: base + index * 60_000, open: 100 + index % 2, high: 102, low: 99, close: 101, volume: 10 }));
const started = performance.now();
buildDeepPatternSignals(longHistory, [], defaults, 0.25, base + 20_001 * 60_000);
assert.ok(performance.now() - started < 1_500, "20,000-bar rule evaluation is unexpectedly slow");
console.log("KWANT Pattern Builder rules, offsets, grouping and fail-closed order-flow inputs passed.");
