import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  anchorBigTradePrintsToCandles,
  calculateBigTradePrints,
} from "../src/lib/bigTrades.ts";

const workspaceSource = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

function trade(timestamp, volume, price = 20_000) {
  return {
    eventId: `trade-${timestamp}`,
    recordIndex: timestamp,
    timestamp,
    open: price,
    high: price,
    low: price,
    close: price,
    trades: 1,
    volume,
    bidVolume: 0,
    askVolume: volume,
    delta: volume,
    aggressor: "BUY",
  };
}

test("Big Trades defaults to a rolling 24-hour execution history", () => {
  const now = Date.UTC(2026, 7, 15, 12);
  const prints = calculateBigTradePrints(
    [],
    [trade(now - 25 * 60 * 60_000, 500), trade(now - 2 * 60 * 60_000, 100)],
    { filterMode: "manual", manualFilter: 1, enableClustering: false },
    now,
  );

  assert.deepEqual(prints.map((print) => print.volume), [100]);
});

test("manual minimum trade size immediately filters executions contract by contract", () => {
  const now = Date.UTC(2026, 7, 15, 12);
  const tape = [
    trade(now - 4_000, 12),
    trade(now - 3_000, 49),
    trade(now - 2_000, 50),
    trade(now - 1_000, 120),
  ];

  const atFifty = calculateBigTradePrints(
    [],
    tape,
    { filterMode: "manual", manualFilter: 50, enableClustering: false },
    now,
  );
  const atHundred = calculateBigTradePrints(
    [],
    tape,
    { filterMode: "manual", manualFilter: 100, enableClustering: false },
    now,
  );

  assert.deepEqual(atFifty.map((print) => print.volume), [50, 120]);
  assert.deepEqual(atHundred.map((print) => print.volume), [120]);
});

test("the same tape anchors to irregular 200-volume bar boundaries", () => {
  const candles = [
    { timestamp: 1_000, open: 1, high: 1, low: 1, close: 1 },
    { timestamp: 2_750, open: 1, high: 1, low: 1, close: 1 },
    { timestamp: 9_400, open: 1, high: 1, low: 1, close: 1 },
  ];
  const prints = [
    { id: "a", timestamp: 2_000, price: 1, volume: 10, executions: 1, side: "ASK", radius: 1, opacity: 1 },
    { id: "b", timestamp: 7_000, price: 1, volume: 20, executions: 1, side: "BID", radius: 1, opacity: 1 },
    { id: "c", timestamp: 9_500, price: 1, volume: 30, executions: 1, side: "ASK", radius: 1, opacity: 1 },
  ];

  assert.deepEqual(
    anchorBigTradePrintsToCandles(prints, candles).map((print) => print.chartTimestamp),
    [1_000, 2_750, 9_400],
  );
});

test("event charts request the canonical execution archive and share tape by contract", () => {
  assert.match(
    workspaceSource,
    /const archiveInterval = isEventBasedChartInterval\(timeframe\) \? "1m" : timeframe;/,
  );
  assert.match(
    workspaceSource,
    /return `\$\{symbol\}::\$\{currentCmeContract\(symbol\) \?\? "ROOT"\}::flow`;/,
  );
});
