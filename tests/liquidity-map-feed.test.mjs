import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DepthMarketFeed,
  isPlausiblePresentationTick,
  normalizeLiquidityMapSymbol,
  normalizeLiveSnapshot,
  symbolMatchesSnapshot,
  updateLivePresentationEdge,
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

test("presentation holds move only the live edge and never create synthetic history", () => {
  const frame = normalizeLiveSnapshot(rawSnapshot({
    timestamp: 1_786_420_440_000,
    lastTick: 31_149,
    trades: [{ id: 1, timestamp: 1_786_420_440_000, tick: 31_149, size: 4, side: "buy" }],
  }));
  const history = [frame];
  const originalTrades = frame.trades;
  const originalBids = frame.bids;

  assert.equal(updateLivePresentationEdge(history, {
    timestamp: 1_786_420_440_014,
    lastTick: 31_151,
  }), true);
  assert.equal(history.length, 1);
  assert.equal(history[0].lastTick, 31_151);
  assert.equal(history[0].timestamp, 1_786_420_440_014);
  assert.equal(history[0].trades, originalTrades);
  assert.equal(history[0].bids, originalBids);
});

test("normalizes e-mini, micro, continuous, and dated contracts onto the two map books", () => {
  assert.equal(normalizeLiquidityMapSymbol("NQ.v.0"), "NQ");
  assert.equal(normalizeLiquidityMapSymbol("MNQU6"), "NQ");
  assert.equal(normalizeLiquidityMapSymbol("ESU6"), "ES");
  assert.equal(normalizeLiquidityMapSymbol("MES.v.0"), "ES");
  assert.equal(normalizeLiquidityMapSymbol("CLV6"), "");
});

test("late events from the previous book cannot overwrite the newly selected book", () => {
  const sources = [];
  const statuses = [];
  const snapshots = [];
  const cvdWindows = [];
  const feed = new DepthMarketFeed({
    symbol: "NQ",
    eventSourceFactory: () => {
      const listeners = new Map();
      const source = {
        listeners,
        close() {},
        addEventListener(name, listener) { listeners.set(name, listener); },
      };
      sources.push(source);
      return source;
    },
    onStatus: (status) => statuses.push(status),
    onSnapshot: (snapshot) => snapshots.push(snapshot),
    onCvdHistory: (points) => cvdWindows.push(points),
  });
  feed.start();
  feed.setSymbol("ES");

  sources[0].listeners.get("history")({
    data: JSON.stringify({
      status: { connected: true, contractSymbol: "NQU6" },
      snapshots: [rawSnapshot({ root: "NQ", contractSymbol: "NQU6" })],
    }),
  });
  sources[0].listeners.get("cvd-history")({
    data: JSON.stringify({ points: [{ timestamp: 1_786_100_000_000, value: 99 }] }),
  });
  sources[1].listeners.get("history")({
    data: JSON.stringify({
      status: { connected: true, contractSymbol: "ESU6" },
      snapshots: [rawSnapshot({
        root: "ES",
        contractSymbol: "ESU6",
        bids: [[31_150, 20, 5]],
        asks: [[31_151, 18, 4]],
        bestBid: 31_150,
        bestAsk: 31_151,
        midTick: 31_150.5,
        lastTick: 31_151,
      })],
    }),
  });

  assert.deepEqual(snapshots.map((snapshot) => snapshot.symbol), ["ES"]);
  assert.equal(cvdWindows.length, 0, "the NQ CVD callback is ignored after switching to ES");
  assert.equal(statuses.at(-1).contractSymbol, "ESU6");
  feed.stop();
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

test("does not synthesize duplicate full-map frames between genuine books", async () => {
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

  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].snapshot.trades.length, 1);
});

test("a lightweight execution tick reaches the marker callback without repainting the map", async () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const snapshots = [];
  const ticks = [];
  const feed = new DepthMarketFeed({
    symbol: "MNQ",
    eventSourceFactory: () => source,
    onSnapshot: (snapshot, details) => snapshots.push({ snapshot, details }),
    onPresentationTick: (tick, timestamp) => ticks.push({ tick, timestamp }),
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

  assert.equal(snapshots.length, 1);
  assert.equal(ticks.at(-1).tick, 119_205);
});

test("a malformed lightweight tick cannot throw the live camera away from the book", async () => {
  assert.equal(isPlausiblePresentationTick(119_205, { lastTick: 119_201 }), true);
  assert.equal(isPlausiblePresentationTick(29_801.25, { lastTick: 119_201 }), false);

  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  const snapshots = [];
  const ticks = [];
  const feed = new DepthMarketFeed({
    symbol: "NQ",
    eventSourceFactory: () => source,
    onSnapshot: (snapshot, details) => snapshots.push({ snapshot, details }),
    onPresentationTick: (tick) => ticks.push(tick),
  });
  feed.start();
  listeners.get("depth")({
    data: JSON.stringify({
      status: { connected: true, fullDepth: true, provider: "Rithmic" },
      snapshot: rawSnapshot({ lastTick: 119_201 }),
    }),
  });
  listeners.get("tick")({ data: JSON.stringify({ tick: 29_801.25 }) });
  await new Promise((resolve) => setTimeout(resolve, 25));
  feed.stop();

  assert.equal(snapshots.at(-1).snapshot.lastTick, 119_201);
  assert.equal(ticks.length, 0);
});

test("a single consumer paint failure cannot freeze subsequent genuine frames", async () => {
  const listeners = new Map();
  const source = {
    close() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  let calls = 0;
  const originalError = console.error;
  console.error = () => {};
  const feed = new DepthMarketFeed({
    symbol: "NQ",
    eventSourceFactory: () => source,
    onSnapshot: () => {
      calls += 1;
      if (calls === 1) throw new Error("synthetic paint failure");
    },
  });

  try {
    feed.start();
    listeners.get("depth")({
      data: JSON.stringify({
        status: { connected: true, fullDepth: true, provider: "Rithmic" },
        snapshot: rawSnapshot(),
      }),
    });
    listeners.get("depth")({
      data: JSON.stringify({
        status: { connected: true, fullDepth: true, provider: "Rithmic" },
        snapshot: rawSnapshot({ id: 2, timestamp: 1_786_100_000_100 }),
      }),
    });
  } finally {
    feed.stop();
    console.error = originalError;
  }

  assert.equal(calls, 2, "the next genuine map frame survives an isolated callback failure");
});

test("the live stream distinguishes socket heartbeats from genuine market frames", () => {
  const source = readFileSync(new URL("../public/heatmap-app/src/live-market.js", import.meta.url), "utf8");
  const gateway = readFileSync(new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url), "utf8");

  assert.match(source, /STREAM_SILENCE_RECONNECT_MS = 13_000/);
  assert.match(source, /MARKET_FRAME_PROBE_MS = 8_000/);
  assert.match(source, /STREAM_LEASE_MS = 240_000/);
  assert.match(source, /stream\.addEventListener\('heartbeat'/);
  assert.match(source, /#markMarketFrame\(\)/);
  assert.match(source, /\['L3', 'MBO_AGGREGATED', 'LIVE'\]\.includes\(liveDepthMode\)/);
  assert.match(source, /#probeLatestSnapshot\(\)/);
  assert.match(source, /snapshot\.trades = \[\]/);
  assert.match(source, /scheduled stream rotation/);
  assert.match(source, /#restartSilentStream\(\)/);
  assert.match(gateway, /event: heartbeat/);
});
