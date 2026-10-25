import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGexVueReplayState } from "../src/lib/gexVueReplay.ts";
import { REPLAY_SPEEDS, replaySpeedLabel, replayTimestampAfterElapsed, startReplayTicker, REPLAY_CLOCK_PUBLISH_MS } from "../src/lib/replayPlayback.ts";
import { replayFormingCandle } from "../src/lib/replayFormingCandle.ts";

function tickerFixture(onElapsed, onHidden = () => {}) {
  let now = 0, visible = true, id = 0;
  const frames = new Map();
  const stop = startReplayTicker(onElapsed, onHidden, {
    now: () => now, visible: () => visible,
    requestFrame: fn => { frames.set(++id, fn); return id; },
    cancelFrame: key => frames.delete(key),
  });
  return { stop, hide: () => { visible = false; }, frame(time) {
    now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time));
  }, pending: () => frames.size };
}

test("default speed is explicitly available 1x real time; slower and faster modes remain offered", () => {
  const state = createGexVueReplayState(Date.parse("2026-10-25T01:00Z"));
  assert.equal(state.speed, 1);
  assert.ok(REPLAY_SPEEDS.includes(state.speed));
  assert.equal(replaySpeedLabel(1), "1× · Real time");
  assert.ok(REPLAY_SPEEDS.includes(0.25) && REPLAY_SPEEDS.includes(0.5) && REPLAY_SPEEDS.includes(10));
});

test("one minute of irregular visible callbacks advances exactly one minute, not one candle per callback", () => {
  let timestamp = 1000000;
  const ticker = tickerFixture(elapsed => { timestamp = replayTimestampAfterElapsed(timestamp, elapsed, 1, 10000000); });
  for (const now of [16, 40, 95, 117, 212, 390, 512, 1200, 5000, 10700, 30000, 59900, 60000]) ticker.frame(now);
  assert.equal(timestamp, 1060000);
  ticker.stop();
  assert.equal(ticker.pending(), 0);
});

test("jitter and delays are measured, never discarded by a 500ms clamp", () => {
  assert.equal(replayTimestampAfterElapsed(1000, 1730, 1, 100000), 2730);
  assert.equal(replayTimestampAfterElapsed(1000, 1000, 0.5, 100000), 1500);
  assert.equal(replayTimestampAfterElapsed(1000, 1000, 2, 100000), 3000);
  assert.equal(replayTimestampAfterElapsed(1000, 1000, 0.25, 100000), 1250);
});

test("clock is cadence-bounded, clamps to archive/session end and rejects invalid/backwards advances", () => {
  const elapsed = []; const ticker = tickerFixture(value => elapsed.push(value));
  for (let now = 0; now <= 1000; now += 10) ticker.frame(now);
  assert.equal(elapsed.length, 1000 / REPLAY_CLOCK_PUBLISH_MS);
  assert.equal(elapsed.reduce((sum, value) => sum + value, 0), 1000);
  ticker.stop();
  assert.equal(replayTimestampAfterElapsed(1000, 2000, 120, 5000), 5000);
  for (const [delta, speed] of [[-1, 1], [100, 0], [NaN, 1], [100, Infinity]]) {
    assert.equal(replayTimestampAfterElapsed(1000, delta, speed, 5000), 1000);
  }
});

test("hidden tabs stop before applying throttled catch-up; stopped/unmounted tickers cannot advance", () => {
  let total = 0, paused = 0;
  const ticker = tickerFixture(elapsed => { total += elapsed; }, () => { paused++; });
  ticker.frame(100); ticker.hide(); ticker.frame(60000); ticker.frame(120000);
  assert.equal(total, 100); assert.equal(paused, 1); assert.equal(ticker.pending(), 0);
  ticker.stop(); ticker.frame(180000); assert.equal(total, 100);
});

test("real-time forming candles reveal only arrived recorded prices, never final OHLC or interpolation", () => {
  const prints = [{ timestamp: 1100, close: 100, volume: 2 }, { timestamp: 1200, close: 102, volume: 1 }, { timestamp: 1800, close: 98, volume: 1 }];
  assert.equal(replayFormingCandle(1000, 1099, prints), null);
  assert.equal(replayFormingCandle(1000, 1150, prints).close, 100);
  assert.equal(replayFormingCandle(1000, 1250, prints).close, 102);
  assert.equal(replayFormingCandle(1000, 1700, prints).low, 100);
  assert.equal(replayFormingCandle(1000, 1800, prints).low, 98);
});

test("Charts and Backtesting use shared wall-time scheduler; plain CME replay requests executions", () => {
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const backtest = readFileSync(new URL("../src/components/backtesting/BacktestingWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const stop = startReplayTicker\(\(elapsedMs\)/);
  assert.match(workspace, /REPLAY_SPEEDS.map/);
  assert.match(workspace, /replayHistoryRange && pane.broker === "Databento"/);
  assert.match(workspace, /2_000,\s*replayOrderFlowRequired,/);
  assert.match(workspace, /const replayTape = replayOrderFlowRequired/);
  for (const source of [workspace, backtest]) {
    assert.match(source, /document.addEventListener\("visibilitychange", pauseHiddenReplay\)/);
    assert.match(source, /document.removeEventListener\("visibilitychange", pauseHiddenReplay\)/);
    assert.match(source, /replayTimestampAfterElapsed\(/);
  }
  assert.doesNotMatch(backtest, /Math.min\(500, Math.max\(0, updateTime - previousUpdate\)\)/);
});
