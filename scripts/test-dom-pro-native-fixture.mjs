import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  applyDomProSnapshot,
  createDomProState,
  domProSettingsFromRecord,
  visibleDomProRows,
} from "../src/lib/domPro.ts";
import { normalizeStoredIndicator } from "../src/lib/chartIndicatorConfig.ts";

const fixture = JSON.parse(await fs.readFile(
  new URL("../native/parity/fixtures/charts/dom-pro-authoritative.json", import.meta.url),
  "utf8",
));

const settings = domProSettingsFromRecord(fixture.settings.input);
const expectedSettings = fixture.settings.expected;
assert.equal(settings.rows, expectedSettings.rows);
assert.equal(settings.rowHeight, expectedSettings.rowHeight);
assert.equal(settings.fontSize, expectedSettings.fontSize);
assert.equal(settings.refreshRateMs, expectedSettings.refreshRateMs);
assert.equal(settings.recentWindowMs, expectedSettings.recentWindowMs);
assert.equal(settings.preset, expectedSettings.preset);
assert.equal(settings.columns.find((column) => column.id === "bid")?.width, expectedSettings.bidWidth);
assert.equal(settings.columns.find((column) => column.id === "bid")?.enabled, expectedSettings.bidEnabled);
assert.equal(settings.columns.find((column) => column.id === "price")?.width, expectedSettings.priceWidth);

const normalized = normalizeStoredIndicator({
  instanceId: "authority-dom-pro",
  indicatorId: "depth-of-market",
  enabled: true,
  settings: {
    ...fixture.settings.input,
    domSettingsVersion: 5,
    width: 99_999,
    showPullStack: "not-a-boolean",
    bidColor: "invalid",
    askColor: "#ef4444",
    apiKey: "must-not-survive",
    snapshot: "must-not-survive",
    orders: "must-not-survive",
  },
});
assert.equal(normalized.settings.width, 1_100);
assert.equal(normalized.settings.fontSize, expectedSettings.fontSize);
assert.equal(normalized.settings.showPullStack, true);
assert.equal(normalized.settings.bidColor, "#22C55E");
assert.equal(normalized.settings.askColor, "#EF4444");
assert.equal(normalized.settings.domSettingsVersion, 5);
assert.equal("apiKey" in normalized.settings, false);
assert.equal("snapshot" in normalized.settings, false);
assert.equal("orders" in normalized.settings, false);
const normalizedColumns = JSON.parse(normalized.settings.domColumns);
assert.equal(normalizedColumns.length, 9);
assert.deepEqual(normalizedColumns.map((column) => column.id), [
  "buy", "sell", "bid", "price", "ask", "trades", "orders", "cob", "pullStack",
]);
assert.equal(normalizedColumns.find((column) => column.id === "bid")?.width, expectedSettings.bidWidth);
assert.equal(normalizedColumns.find((column) => column.id === "bid")?.enabled, expectedSettings.bidEnabled);

const source = fixture.snapshot;
const state = applyDomProSnapshot(createDomProState(source.tickSize), {
  asOf: new Date(source.nowUnixMs).toISOString(),
  contractSymbol: "NQU6",
  tickSize: source.tickSize,
  fullDepth: source.fullDepth,
  bookValid: true,
  individualOrders: source.individualOrders,
  ageMs: 0,
  bestBid: source.bestBid,
  bestAsk: source.bestAsk,
  lastPrice: source.lastPrice,
  levels: source.levels.map((level) => ({
    side: level.side,
    price: level.tick * source.tickSize,
    size: level.size,
    orders: level.orders,
    emaSize: level.size,
    peakSize: level.size,
    observations: 1,
    stableObservations: 1,
    persistenceMs: 0,
    addedSize: level.added,
    removedSize: level.removed,
  })),
  trades: source.executions.map((trade) => ({
    id: trade.id,
    timestamp: trade.timestampUnixMs,
    price: trade.tick * source.tickSize,
    size: trade.size,
    side: trade.aggressor,
  })),
}, source.nowUnixMs);
const rows = visibleDomProRows({
  state,
  rowCount: 20,
  recentWindowMs: 8_000,
  now: source.nowUnixMs,
});
const expected = source.expected;
const levels = [...state.levels.values()];
const bidTotal = levels.reduce((sum, level) => sum + level.bidSize, 0);
const askTotal = levels.reduce((sum, level) => sum + level.askSize, 0);
assert.equal(bidTotal + askTotal, expected.depthTotal);
assert.equal(bidTotal, expected.bidTotal);
assert.equal(askTotal, expected.askTotal);
assert.equal((state.bestAskTick ?? 0) - (state.bestBidTick ?? 0), expected.spreadTicks);
assert.ok(Math.abs((bidTotal / (bidTotal + askTotal) - .5) * 200 - expected.imbalancePercent) < 1e-12);
assert.equal(state.lastTick, expected.lastTick);
assert.equal(rows.find((row) => row.tick === expected.lastTick)?.buyVolume, expected.buyAtLast);
assert.equal(rows.find((row) => row.tick === state.bestBidTick)?.sellVolume, expected.sellAtBid);
assert.equal(state.capabilities.mbo, expected.mbo);
assert.equal(state.capabilities.exactQueue, expected.exactQueue);
assert.equal(state.capabilities.trading, expected.trading);

console.log("DOM Pro browser/native authority fixture passed.");
