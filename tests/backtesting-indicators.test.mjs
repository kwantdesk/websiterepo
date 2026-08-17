import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const replay = readFileSync(
  new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url),
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
