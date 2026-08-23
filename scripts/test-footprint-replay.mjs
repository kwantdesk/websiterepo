import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFootprintBars } from "../src/lib/footprint.ts";
import { sliceReplayExecutionWindow } from "../src/lib/replayExecutionWindow.ts";

const sessionStart = Date.parse("2026-05-26T13:30:00.000Z");
const candles = [
  { timestamp: sessionStart, open: 30_000, high: 30_001, low: 29_999.75, close: 30_000.75, volume: 20 },
  { timestamp: sessionStart + 60_000, open: 30_000.75, high: 30_001.5, low: 30_000.5, close: 30_001.25, volume: 30 },
];
const executions = [
  {
    eventId: "old-buy",
    recordIndex: 0,
    timestamp: sessionStart + 5_000,
    open: 30_000,
    high: 30_000,
    low: 30_000,
    close: 30_000,
    trades: 1,
    volume: 12,
    bidVolume: 0,
    askVolume: 12,
    delta: 12,
    aggressor: "BUY",
  },
  {
    eventId: "old-sell",
    recordIndex: 1,
    timestamp: sessionStart + 25_000,
    open: 30_000.25,
    high: 30_000.25,
    low: 30_000.25,
    close: 30_000.25,
    trades: 1,
    volume: 7,
    bidVolume: 7,
    askVolume: 0,
    delta: -7,
    aggressor: "SELL",
  },
  {
    eventId: "forming-buy",
    recordIndex: 2,
    timestamp: sessionStart + 70_000,
    open: 30_001,
    high: 30_001,
    low: 30_001,
    close: 30_001,
    trades: 2,
    volume: 20,
    bidVolume: 0,
    askVolume: 20,
    delta: 20,
    aggressor: "BUY",
  },
];

// A session almost three months old must retain exact classified executions.
{
  const visible = sliceReplayExecutionWindow(executions, sessionStart + 75_000, 7 * 24 * 60 * 60_000);
  assert.equal(visible.length, 3);
  const bars = buildFootprintBars(candles, visible, {
    tickSize: 0.25,
    groupTicks: 1,
    minimumTradeVolume: 0,
    maximumTradeVolume: 0,
    imbalanceMode: "diagonal",
    minimumImbalancePercent: 300,
    minimumDelta: 0,
    includeZero: true,
    instrument: "NQ",
    valueAreaPercent: 0.7,
  });
  assert.equal(bars.length, 2);
  assert.equal(bars[0].askVolume, 12);
  assert.equal(bars[0].bidVolume, 7);
  assert.equal(bars[0].delta, 5);
  assert.equal(bars[0].rows.length, 2, "the historical per-price footprint must be reconstructed");
  assert.equal(bars[1].askVolume, 20);
  assert.equal(bars[1].delta, 20, "the forming replay footprint must advance with the replay clock");
}

// Coarser profile grouping must still use the same exact tape rather than an
// OHLCV-derived approximation.
{
  const profileBars = buildFootprintBars(candles, executions, {
    tickSize: 0.25,
    groupTicks: 4,
    minimumTradeVolume: 0,
    maximumTradeVolume: 0,
    imbalanceMode: "horizontal",
    minimumImbalancePercent: 200,
    minimumDelta: 0,
    includeZero: true,
    instrument: "NQ",
    valueAreaPercent: 0.7,
  });
  assert.equal(profileBars[0].totalVolume, 19);
  assert.equal(profileBars[0].rows.length, 1, "volume and delta profiles must honor their own granularity");
  assert.equal(profileBars[0].rows[0].delta, 5);
}

// The browser integration must hydrate only one exact execution tape and
// refresh footprint-only replay panes instead of applying the live shortcut.
{
  const workspace = readFileSync(new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url), "utf8");
  const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
  assert.match(workspace, /sliceReplayExecutionWindow\(replayTrades, replayDataClock, REPLAY_LOOKBACK_MS\)/);
  assert.match(workspace, /loadReplayCandles\(timeframe, startAt, timeframe === "1m"\)/,
    "non-1m replay must not download the same large execution tape twice");
  assert.match(chart, /replayFootprintAdvanced/);
  assert.match(chart, /replayFootprintAdvanced\) \{/,
    "replay footprint changes must bypass the footprint-only live sampling shortcut");
  assert.match(chart, /showPerBarVolumeProfile/);
  assert.match(chart, /showPerBarDeltaProfile/);
}

console.log("Three-month footprint replay tests passed.");
