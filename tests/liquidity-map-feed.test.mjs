import assert from "node:assert/strict";
import test from "node:test";

import {
  DepthMarketFeed,
  normalizeLiveSnapshot,
  symbolMatchesSnapshot,
} from "../public/heatmap-app/src/live-market.js";

function rawSnapshot(overrides = {}) {
  return {
    id: 10,
    timestamp: 1_786_100_000_000,
    root: "NQ",
    contractSymbol: "NQU6",
    tickSize: 0.25,
    bids: [[119_200, 12, 3]],
    asks: [[119_201, 8, 2]],
    bestBid: 119_200,
    bestAsk: 119_201,
    midTick: 119_200.5,
    lastTick: 119_201,
    trades: [],
    source: "rithmic-depth-by-order",
    readOnly: true,
    fullDepth: true,
    ...overrides,
  };
}

test("accepts the Rithmic DBO contract without changing the Kwantify frame shape", () => {
  const snapshot = normalizeLiveSnapshot(rawSnapshot());
  assert.ok(snapshot);
  assert.equal(snapshot.source, "rithmic-depth-by-order");
  assert.equal(snapshot.bids.get(119_200), 12);
  assert.equal(snapshot.bidOrders.get(119_200), 3);
  assert.equal(symbolMatchesSnapshot("MNQ", snapshot.symbol), true);
});

test("does not present an aggregated or partial ladder as true DBO", () => {
  assert.equal(normalizeLiveSnapshot(rawSnapshot({ source: "rithmic-order-book" })), null);
  assert.equal(normalizeLiveSnapshot(rawSnapshot({ fullDepth: false })), null);
});

test("keeps a completed but stale book frozen instead of relabelling it live", () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const statuses = [];
  const snapshots = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onStatus: (status) => statuses.push(status),
    onSnapshot: (snapshot) => snapshots.push(snapshot),
  });
  feed.start();
  listeners.get("depth")({
    data: JSON.stringify({
      status: { connected: false, stale: true, fullDepth: true, provider: "Rithmic" },
      snapshot: rawSnapshot(),
    }),
  });

  assert.equal(statuses.at(-1).connected, false);
  assert.equal(statuses.at(-1).stale, true);
  assert.equal(snapshots.length, 1, "the last completed book remains available for inspection");
});

test("replays the real gateway history through the original Kwantify append path", () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const statuses = [];
  const snapshots = [];
  const metadata = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onStatus: (status) => statuses.push(status),
    onSnapshot: (snapshot, details) => {
      snapshots.push(snapshot);
      metadata.push(details);
    },
  });
  feed.start();
  listeners.get("history")({
    data: JSON.stringify({
      status: { connected: true, fullDepth: true, provider: "Rithmic" },
      snapshots: [
        rawSnapshot({ id: 1, timestamp: 1_786_100_000_000 }),
        rawSnapshot({ id: 2, timestamp: 1_786_100_000_100 }),
        rawSnapshot({ id: 3, timestamp: 1_786_100_000_200 }),
      ],
    }),
  });

  assert.deepEqual(snapshots.map((snapshot) => snapshot.id), [1, 2, 3]);
  assert.deepEqual(metadata, [
    { historical: true, final: false },
    { historical: true, final: false },
    { historical: true, final: true },
  ]);
  assert.equal(statuses.at(-1).connected, true);
  assert.equal(statuses.at(-1).historyFrames, 3);
});

test("does not replay the full history window again after an SSE reconnect", () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const snapshots = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onSnapshot: (snapshot) => snapshots.push(snapshot),
  });
  feed.start();
  const history = {
    data: JSON.stringify({
      status: { connected: true, fullDepth: true, provider: "Rithmic" },
      snapshots: [
        rawSnapshot({ id: 1, timestamp: 1_786_100_000_000 }),
        rawSnapshot({ id: 2, timestamp: 1_786_100_000_100 }),
        rawSnapshot({ id: 3, timestamp: 1_786_100_000_200 }),
      ],
    }),
  };

  listeners.get("history")(history);
  listeners.get("history")(history);

  assert.deepEqual(snapshots.map((snapshot) => snapshot.id), [1, 2, 3]);
});

test("paces a sparse book smoothly without duplicating trades", async () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const snapshots = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onSnapshot: (snapshot, details) => snapshots.push({ snapshot, details }),
  });
  feed.start();
  listeners.get("depth")({
    data: JSON.stringify({
      status: { connected: true, fullDepth: true, provider: "Rithmic" },
      snapshot: rawSnapshot({ trades: [{ id: 1, timestamp: 1_786_100_000_000, tick: 119_201, size: 4, side: "buy" }] }),
    }),
  });
  await new Promise((resolve) => setTimeout(resolve, 70));
  feed.stop();

  assert.ok(snapshots.length >= 4, "presentation continues between genuine market frames");
  assert.equal(snapshots[0].snapshot.trades.length, 1);
  for (const held of snapshots.slice(1)) {
    assert.equal(held.details.visualHold, true);
    assert.equal(held.snapshot.trades.length, 0);
    assert.equal(held.snapshot.volume, 0);
    assert.equal(held.snapshot.eventsSince, 0);
  }
});

test("a lightweight execution tick reaches the next presentation frame", async () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const snapshots = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onSnapshot: (snapshot, details) => snapshots.push({ snapshot, details }),
  });
  feed.start();
  listeners.get("depth")({
    data: JSON.stringify({
      status: { connected: true, fullDepth: true, provider: "Rithmic" },
      snapshot: rawSnapshot({ lastTick: 119_201 }),
    }),
  });
  listeners.get("tick")({ data: JSON.stringify({ tick: 119_205 }) });
  await new Promise((resolve) => setTimeout(resolve, 25));
  feed.stop();

  assert.equal(snapshots.at(-1).snapshot.lastTick, 119_205);
  assert.equal(snapshots.at(-1).details.visualHold, true);
});
