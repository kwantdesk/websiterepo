import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const replay = readFileSync(
  new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url),
  "utf8",
);
const sessionRoute = readFileSync(
  new URL("../src/app/api/backtesting/session/route.ts", import.meta.url),
  "utf8",
);

test("historical replay exposes the shared chart indicator library", () => {
  assert.match(replay, /import ChartIndicatorsControl/);
  assert.match(replay, /<ChartIndicatorsControl[\s\S]*?indicators=\{replayIndicators\}/);
  assert.match(replay, /<Chart[\s\S]*?indicators=\{replayIndicators\}/);
  assert.match(replay, /REPLAY_INDICATORS_STORAGE_KEY/);
});

test("historical replay starts with a no-lookahead New York 30m initial balance", () => {
  assert.match(replay, /indicatorId: "ib-levels"/);
  assert.match(replay, /durationMinutes: 30/);
  assert.match(replay, /showGlobex: false/);
  assert.match(replay, /showTokyo: false/);
  assert.match(replay, /showLondon: false/);
  assert.match(replay, /showNewYork: true/);
  assert.match(replay, /newYorkStart: "09:30"/);
  assert.match(replay, /newYorkEnd: "16:00"/);
  assert.match(replay, /candles=\{visibleCandles\}/);
  assert.match(replay, /historicalCandlesAtClock\(replayStudyCandles, oneSecondBars, "1m", replayDataClock\)/);
  assert.match(replay, /initialBalanceCandles=\{visibleReplayStudyCandles\}/);
});

test("historical levels remain available inside the indicator dropdown", () => {
  assert.match(replay, /label: "Gamma levels"/);
  assert.match(replay, /label: "Kwant levels"/);
  assert.match(replay, /label: "Value area"/);
  assert.match(replay, /levelControls=\{replayLevelControls\}/);
});

test("historical replay includes the requested three-month backtesting studies", () => {
  for (const indicatorId of [
    "kwant-profile",
    "cumulative-volume-delta",
    "big-trades",
    "deep-m-effort-nq",
    "weekly-volume-profile",
    "tpo-chart",
    "volume",
    "vwap",
  ]) {
    assert.match(replay, new RegExp(`"${indicatorId}"`));
  }
  assert.match(replay, /ReplayDatePicker min="2010-06-06"/);
  assert.match(replay, /REPLAY_LOOKBACK_MS = 7 \* 24 \* 60 \* 60_000/);
});

test("order-flow studies receive replay-clock-clipped historical executions", () => {
  assert.match(replay, /orderFlow=1&executions=1/);
  assert.match(replay, /marketTrades=\{visibleReplayTrades\}/);
  assert.match(replay, /replayTimestampMs=\{replayDataClock\}/);
  assert.match(replay, /orderFlowHistoryReady=\{orderFlowHistoryReady\}/);
  assert.match(replay, /trade\.timestamp <= replayDataClock/);
  assert.match(replay, /sourceEndTimestamp \?\? candle\.timestamp/);
});

test("historical session route uses executions for time and event bars without an OHLC order-flow fallback", () => {
  assert.match(sessionRoute, /getDatabentoOrderFlowHistory/);
  assert.match(sessionRoute, /getDatabentoEventHistory/);
  assert.match(sessionRoute, /isEventBasedChartInterval\(timeframe\)/);
  assert.match(sessionRoute, /orderFlowRequested \? "historical-executions" : "bars"/);
  assert.match(sessionRoute, /!orderFlowRequested[\s\S]*timeframe === "1m"/);
  assert.match(sessionRoute, /Exchange executions classified by aggressor side/);
});
