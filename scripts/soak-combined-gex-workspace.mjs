import assert from "node:assert/strict";

import { admitRecords } from "../src/lib/executionTape.ts";
import { compactLiveGexMapPanel } from "../src/lib/gexMap.ts";

if (typeof global.gc !== "function") {
  throw new Error("Run this soak with --expose-gc so retained heap can be measured.");
}

const MINUTE = 60_000;
const symbols = ["SPXW", "NDX", "SPY", "QQQ"];
const tape = { records: [], recordKeys: new Set() };
let tradeSequence = 0;

function trades(count) {
  return Array.from({ length: count }, () => {
    tradeSequence += 1;
    const price = 24_000 + tradeSequence % 400 * 0.25;
    return {
      eventId: `nq-${tradeSequence}`,
      recordIndex: tradeSequence,
      timestamp: Date.now() + tradeSequence,
      open: price,
      high: price,
      low: price,
      close: price,
      trades: 1,
      volume: 1 + tradeSequence % 20,
      bidVolume: tradeSequence % 2 ? 0 : 1,
      askVolume: tradeSequence % 2 ? 1 : 0,
      delta: tradeSequence % 2 ? 1 : -1,
      aggressor: tradeSequence % 2 ? "BUY" : "SELL",
      sideSemanticsVersion: 2,
    };
  });
}

function fullPanel(symbol, cycle) {
  const start = Date.UTC(2026, 7, 25, 13, 30);
  const frames = Array.from({ length: 390 }, (_, minute) => ({
    timestamp: start + minute * MINUTE,
    updates: Array.from({ length: 120 }, (_, index) => {
      const strike = 5_000 + index * 5;
      const call = minute * 10_000 + index * 100 + cycle;
      const put = -(minute * 4_000 + index * 40);
      return { strike, call, put, net: call + put };
    }),
  }));
  const latestStrikes = frames.at(-1).updates;
  return {
    symbol,
    greekMode: "GAMMA",
    sessionDate: "2026-08-25",
    expiration: "2026-08-25",
    scope: "FRONT_EXPIRY",
    representation: "PER_ONE_PERCENT_MOVE",
    source: "KwantData Interval Map",
    sourceTimeZone: "America/New_York",
    asOf: new Date(frames.at(-1).timestamp).toISOString(),
    status: "LIVE",
    refreshAfterMs: 5_000,
    stockPrice: 5_500 + cycle / 100,
    sessionChangePercent: 0.004,
    latestStrikes,
    frames,
    candles: frames.map((frame, index) => ({
      timestamp: frame.timestamp,
      open: 5_400 + index,
      high: 5_402 + index,
      low: 5_398 + index,
      close: 5_401 + index,
      volume: 1_000,
    })),
    netExposure: latestStrikes.reduce((sum, row) => sum + row.net, 0),
    grossExposure: latestStrikes.reduce((sum, row) => sum + Math.abs(row.call) + Math.abs(row.put), 0),
    rateLimitRemaining: 100,
  };
}

// Begin at steady-state NQ tape capacity so tape growth cannot disguise a
// retained GEX surface leak during the refresh loop.
for (let offset = 0; offset < 26_000; offset += 500) admitRecords(tape, trades(500));

let activePanels = [];
let optionSnapshots = [];
const samples = [];
const cycles = 60;

for (let cycle = 0; cycle < cycles; cycle += 1) {
  // Model one live refresh arriving for the exact four-options + GEX Map
  // layout while NQ executions continue in the shared worker tape.
  const incomingPanels = symbols.map((symbol) => fullPanel(symbol, cycle));
  activePanels = incomingPanels.map((panel) => compactLiveGexMapPanel(panel));
  optionSnapshots = symbols.map((symbol, index) => ({
    symbol,
    timestamp: Date.now() + cycle,
    price: 5_000 + index * 100 + cycle / 100,
  }));
  admitRecords(tape, trades(500));

  assert.ok(activePanels.every((panel) => panel.frames.length <= 5));
  assert.equal(optionSnapshots.length, 4);
  if ((cycle + 1) % 10 === 0) {
    global.gc();
    samples.push(process.memoryUsage().heapUsed);
  }
}

global.gc();
const finalHeap = process.memoryUsage().heapUsed;
const steady = samples.slice(-4);
const spread = Math.max(...steady) - Math.min(...steady);
const megabytes = (bytes) => (bytes / 1024 / 1024).toFixed(1);

assert.ok(spread < 12 * 1024 * 1024,
  `combined workspace retained heap did not level off (${megabytes(spread)} MB spread)`);
assert.ok(tape.records.length <= 29_096, "NQ tape exceeded its bounded high-water mark");

console.log(`Combined four-options + NQ + GEX Map soak passed (${cycles} refreshes).`);
console.log(`Retained heap samples: ${samples.map((sample) => `${megabytes(sample)} MB`).join(" -> ")}`);
console.log(`Final retained heap: ${megabytes(finalHeap)} MB; steady spread: ${megabytes(spread)} MB.`);
