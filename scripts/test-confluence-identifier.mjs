import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  buildConfluenceIdentifierFrame,
  normalizeConfluenceIdentifierSettings,
} from "../src/lib/confluenceIdentifier.ts";

const candles = Array.from({ length: 600 }, (_, index) => {
  const wave = Math.sin(index / 22) * 18;
  const close = 1000 + wave + index * 0.02;
  return { timestamp: 1_700_000_000_000 + index * 60_000, high: close + 1, low: close - 1, close };
});
const profile = (endMs, prices) => ({
  instrument: "NQ", contractSymbol: "NQZ6", period: "daily", startMs: endMs - 86_400_000, endMs,
  valueAreaPercent: 68, minTradeVolume: 0, maxTradeVolume: 0, groupTicks: 1, automaticGrouping: false,
  volume: prices.reduce((sum, row) => sum + row.volume, 0), bidVolume: 0, askVolume: 0, delta: 0, trades: 10,
  poc: 1000, vah: 1001, val: 999, vwap: 1000, standardDeviation: 1, levels: prices,
  provider: "rithmic", asOf: new Date(endMs).toISOString(),
});
const rows = [
  { price: 998, volume: 20, bidVolume: 15, askVolume: 5, delta: -10, trades: 2 },
  { price: 999, volume: 60, bidVolume: 20, askVolume: 40, delta: 20, trades: 3 },
  { price: 1000, volume: 100, bidVolume: 40, askVolume: 60, delta: 20, trades: 4 },
  { price: 1001, volume: 55, bidVolume: 30, askVolume: 25, delta: -5, trades: 2 },
  { price: 1002, volume: 10, bidVolume: 9, askVolume: 1, delta: -8, trades: 1 },
];

const normalized = normalizeConfluenceIdentifierSettings({ tickSensitivity: 900, minimumConfluences: 0, firstGroupTicks: 0, trendReversalPercent: 0 });
assert.equal(normalized.tickSensitivity, 500);
assert.equal(normalized.minimumConfluences, 1);
assert.equal(normalized.firstGroupTicks, 1);
assert.equal(normalized.trendReversalPercent, 0.01);

const exact = profile(candles.at(-1).timestamp, rows);
const frame = buildConfluenceIdentifierFrame({
  candles,
  profileInputs: [
    { slot: "first", status: "LIVE", profiles: [exact] },
    { slot: "second", status: "LIVE", profiles: [exact] },
    { slot: "third", status: "LIVE", profiles: [exact] },
  ],
  tickSize: 1,
  settings: { minimumConfluences: 3, tickSensitivity: 1, enableZigZagSwing: false, enableRetracements: false },
});
assert.equal(frame.status, "LIVE");
assert.ok(frame.zones.some((zone) => zone.sources.some((source) => source.includes("POC"))));
assert.ok(frame.zones.every((zone) => zone.confluences >= 3));

const partial = buildConfluenceIdentifierFrame({
  candles,
  profileInputs: [{ slot: "first", status: "WAITING_FOR_ORDER_HISTORY", profiles: [] }],
  tickSize: 1,
  settings: { inputData: "order", secondEnabled: false, thirdEnabled: false, enableZigZagSwing: true, minimumConfluences: 1 },
});
assert.equal(partial.status, "PARTIAL");
assert.ok(partial.sourceLevels.length > 0);

const sparse = buildConfluenceIdentifierFrame({ candles, profileInputs: [], tickSize: 1, settings: { firstEnabled: false, secondEnabled: false, thirdEnabled: false, enableZigZagSwing: false, enableRetracements: false } });
assert.equal(sparse.zones.length, 0);

const long = Array.from({ length: 50_000 }, (_, index) => ({ timestamp: index * 1000, high: 1000 + Math.sin(index / 100) * 20 + 1, low: 1000 + Math.sin(index / 100) * 20 - 1, close: 1000 + Math.sin(index / 100) * 20 }));
const started = performance.now();
buildConfluenceIdentifierFrame({ candles: long, profileInputs: [], tickSize: 0.25, settings: { firstEnabled: false, secondEnabled: false, thirdEnabled: false, minimumConfluences: 1 } });
assert.ok(performance.now() - started < 2_000, "50,000-bar confluence pass should stay bounded");

console.log("Confluence Identifier tests passed");
