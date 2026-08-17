import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

import {
  applyDomProOrderEvent,
  applyDomProSnapshot,
  createDomProState,
  DEFAULT_DOM_PRO_VISIBLE_ROWS,
  DEFAULT_DOM_PRO_SETTINGS,
  domProPreset,
  domProSettingsFromRecord,
  visibleDomProRows,
} from "../src/lib/domPro.ts";

const workspaceSource = await fs.readFile(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);
const panelSource = await fs.readFile(
  new URL("../src/components/DepthOfMarketPanel.tsx", import.meta.url),
  "utf8",
);
const liquidityStreamSource = await fs.readFile(
  new URL("../src/lib/rithmicLiquidityStream.ts", import.meta.url),
  "utf8",
);

test("DOM Pro workspace renders the live ladder without attaching a chart", () => {
  assert.match(workspaceSource, /value !== "tool-depth-of-market"/);
  assert.match(workspaceSource, /case "tool-depth-of-market"/);
  assert.match(workspaceSource, /<DepthOfMarketPanel[\s\S]*?standalone/);
  assert.match(panelSource, /standalone\?: boolean/);
  assert.match(panelSource, /collapsed && !standalone/);
});

test("DOM Pro hydrates from the newest retained book instead of waiting for another live mutation", () => {
  assert.match(liquidityStreamSource, /if \(payload\.final && snapshots\.length\)/);
  assert.match(liquidityStreamSource, /filter\(\(subscriber\) => !subscriber\.replayHistory\)/);
  assert.match(liquidityStreamSource, /subscriber\.onSnapshot\(stream\.latestSnapshot\)/);
  assert.match(liquidityStreamSource, /INITIAL_BOOK_TIMEOUT_MS = 8_000/);
  assert.match(panelSource, /DOM FEED UNAVAILABLE/);
});

test("DOM Pro ships the exact six-column professional default", () => {
  assert.deepEqual(
    DEFAULT_DOM_PRO_SETTINGS.columns.filter((column) => column.enabled).map((column) => column.label),
    ["BUY", "SELL", "BID", "PR", "ASK", "T"],
  );
  assert.equal(DEFAULT_DOM_PRO_SETTINGS.rows, DEFAULT_DOM_PRO_VISIBLE_ROWS);
  assert.equal(DEFAULT_DOM_PRO_VISIBLE_ROWS, 120);
  assert.ok(DEFAULT_DOM_PRO_SETTINGS.columns.slice(0, 6).every((column) => column.width === 100));
});

test("MBO add, modify, move and cancel preserve one order contribution", () => {
  const state = createDomProState(0.25);
  state.snapshotComplete = true;
  applyDomProOrderEvent(state, { sequence: 1, timestamp: 1, orderId: "A", action: "ADD", side: "BID", price: 100, previousPrice: null, size: 10, previousSize: 0 });
  assert.equal(state.levels.get(400)?.bidSize, 10);
  assert.equal(state.levels.get(400)?.bidOrders, 1);
  applyDomProOrderEvent(state, { sequence: 2, timestamp: 2, orderId: "A", action: "MODIFY", side: "BID", price: 100.25, previousPrice: 100, size: 6, previousSize: 10 });
  assert.equal(state.levels.get(400)?.bidSize, 0);
  assert.equal(state.levels.get(401)?.bidSize, 6);
  assert.equal(state.levels.get(401)?.bidOrders, 1);
  applyDomProOrderEvent(state, { sequence: 3, timestamp: 3, orderId: "A", action: "REMOVE", side: "BID", price: 100.25, previousPrice: 100.25, size: 0, previousSize: 6 });
  assert.equal(state.levels.get(401)?.bidSize, 0);
  assert.equal(state.orders.size, 0);
});

test("sequence gaps stop incremental MBO updates until a fresh snapshot", () => {
  const state = createDomProState(0.25);
  state.snapshotComplete = true;
  applyDomProOrderEvent(state, { sequence: 10, timestamp: 1, orderId: "A", action: "ADD", side: "ASK", price: 100.25, previousPrice: null, size: 4, previousSize: 0 });
  applyDomProOrderEvent(state, { sequence: 12, timestamp: 2, orderId: "B", action: "ADD", side: "ASK", price: 100.5, previousPrice: null, size: 5, previousSize: 0 });
  assert.match(state.staleReason ?? "", /Sequence gap/);
  assert.equal(state.snapshotComplete, false);
  assert.equal(state.orders.has("B"), false);
});

test("aggregate snapshots remain authoritative and trades never decrement depth twice", () => {
  const state = applyDomProSnapshot(createDomProState(), {
    asOf: new Date(1_000).toISOString(), contractSymbol: "NQU6", tickSize: 0.25,
    fullDepth: true, bookValid: true, individualOrders: false, ageMs: 0,
    levels: [
      { side: "BID", price: 100, size: 20, orders: 2, emaSize: 20, peakSize: 20, observations: 1, stableObservations: 1, persistenceMs: 0, addedSize: 20, removedSize: 0 },
      { side: "ASK", price: 100.25, size: 15, orders: 3, emaSize: 15, peakSize: 15, observations: 1, stableObservations: 1, persistenceMs: 0, addedSize: 15, removedSize: 0 },
    ],
    lastPrice: 100.25,
    trades: [{ id: 1, timestamp: 1_000, price: 100.25, size: 5, side: "BUY" }],
  }, 1_000);
  assert.equal(state.levels.get(400)?.bidSize, 20);
  assert.equal(state.levels.get(401)?.askSize, 15);
  assert.equal(state.levels.get(401)?.buyVolume, 5);
  assert.equal(state.capabilities.mbo, false);
});

test("visible rows stay tick-indexed and centered on the live trade", () => {
  const state = createDomProState(0.25);
  state.lastTick = 400;
  const rows = visibleDomProRows({ state, rowCount: 20, now: 5_000 });
  assert.equal(rows.length, 20);
  assert.ok(rows.some((row) => row.tick === 400 && row.atLast));
  assert.ok(rows.every((row) => Number.isInteger(row.tick)));
});

test("settings migration validates columns and presets deterministically", () => {
  const settings = domProSettingsFromRecord({
    rows: 999,
    domColumns: JSON.stringify([{ id: "bid", width: 999, enabled: false }]),
  });
  assert.equal(settings.rows, 120);
  assert.equal(settings.columns.find((column) => column.id === "bid")?.width, 260);
  assert.equal(settings.columns.find((column) => column.id === "bid")?.enabled, false);
  assert.deepEqual(
    domProPreset("minimal", settings).columns.filter((column) => column.enabled).map((column) => column.id),
    ["bid", "price", "ask"],
  );
});
