import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInitialBalanceLevels } from "../src/lib/marketSessions.ts";

/**
 * Initial Balance must resolve the same range whatever the chart shows.
 *
 * IB freezes a 15, 30, 45 or 60 minute opening range. Read off the pane's own
 * candles, an hourly chart offers exactly one bar for a fifteen-minute range,
 * so the "15m IB" came out as the whole hour's extreme. The backtest already
 * fed the study a minute series; live charts fed it nothing.
 *
 * The instrument is irrelevant to the maths, which is the point: the same
 * study has to resolve on SPX, NDX, QQQ and SPY as on the futures.
 */

// A New York cash session: 09:30 -> 16:00 America/New_York on a Tuesday.
// 2026-08-11 13:30 UTC == 09:30 EDT.
const OPEN = Date.UTC(2026, 7, 11, 13, 30);
const MIN = 60_000;

/**
 * Price walks up for the first 15 minutes, then spikes far beyond it. A
 * correct 15m IB must ignore the spike entirely.
 */
function minuteCandles(count = 390) {
  return Array.from({ length: count }, (_, i) => {
    const base = 100 + i * 0.1;
    const spike = i >= 15 ? 50 : 0;   // the trap: only after the 15m range
    return {
      timestamp: OPEN + i * MIN,
      open: base, close: base,
      high: base + 0.5 + spike,
      low: base - 0.5 - spike,
      volume: 10,
    };
  });
}

/** The same session aggregated to one-hour bars, as an hourly pane holds it. */
function hourCandles(minutes) {
  const out = [];
  for (let i = 0; i < minutes.length; i += 60) {
    const group = minutes.slice(i, i + 60);
    if (!group.length) continue;
    out.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      close: group.at(-1).close,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      volume: 600,
    });
  }
  return out;
}

const settings = {
  showNewYork: true, showTokyo: false, showLondon: false, showSydney: false,
  newYorkStart: "09:30", newYorkEnd: "16:00",
  lookbackDays: 30,
};
const ibFor = (candles, durationMinutes, intervalMs) =>
  buildInitialBalanceLevels(candles, { ...settings, durationMinutes }, intervalMs);

const minutes = minuteCandles();

// --- every offered duration resolves off the minute series ---
{
  for (const duration of [15, 30, 45, 60]) {
    const levels = ibFor(minutes, duration, MIN);
    const high = levels.find((level) => level.side === "high");
    const low = levels.find((level) => level.side === "low");
    assert.ok(high && low, `${duration}m produced no levels`);
    // The formation window is exactly the first `duration` bars.
    const window = minutes.slice(0, duration);
    assert.equal(high.price, Math.max(...window.map((c) => c.high)), `${duration}m IBH`);
    assert.equal(low.price, Math.min(...window.map((c) => c.low)), `${duration}m IBL`);
    assert.equal(high.durationMinutes, duration);
  }
}

// --- the 15m range must not inherit the spike that follows it ---
{
  const [high] = ibFor(minutes, 15, MIN).filter((level) => level.side === "high");
  assert.ok(high.price < 150, "the post-15m spike leaked into the 15m range");
}

// --- and this is exactly what an hourly pane got wrong ---
{
  const hours = hourCandles(minutes);
  const fromHours = ibFor(hours, 15, 60 * MIN).find((level) => level.side === "high");
  const fromMinutes = ibFor(minutes, 15, MIN).find((level) => level.side === "high");
  assert.ok(fromHours, "the hourly pane still produced a level");
  assert.notEqual(
    fromHours.price, fromMinutes.price,
    "if these agreed the minute series would be pointless - the bug would not exist",
  );
  assert.ok(fromHours.price > fromMinutes.price,
    "the hourly bar hands the whole hour's extreme to a fifteen-minute range");
}

// --- a cash session that never trades overnight still resolves ---
{
  // Options underlyings have no Globex leg at all. The New York window is the
  // only one with candles, and it must still produce its IB.
  const levels = ibFor(minutes, 30, MIN);
  assert.equal(levels.filter((level) => level.side === "high").length, 1,
    "exactly one New York IB high on a cash session");
  assert.ok(levels.every((level) => level.session.key === "newYork"));
}

// --- the live pane actually feeds the study a minute series ---
{
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('instance.indicatorId === "ib-levels"'),
    "the pane has to notice the study is attached");
  assert.ok(workspace.includes("initialBalanceCandles={initialBalanceStudyCandles"),
    "and hand the minute series to the chart");
  // Broker-agnostic: fetchWorkspaceCandles routes Market Index (SPX/NDX/QQQ/
  // SPY) and Databento alike, so the study is not futures-only.
  const ibFetch = workspace.slice(
    workspace.indexOf("initialBalanceNeedsMinuteSeries"),
    workspace.indexOf("initialBalanceCandles={initialBalanceStudyCandles"),
  );
  assert.ok(ibFetch.includes("pane.broker"),
    "the fetch must pass the pane's own broker, not a hardcoded one");
  assert.ok(ibFetch.includes('"1m"'), "and must ask for minutes");
  // A replay must never be handed live minutes - that is today's data on a
  // historical chart.
  assert.ok(workspace.includes("&& !replayActive"),
    "the live minute fetch must be off during replay");
  // A minute or seconds pane already resolves exactly and needs no second fetch.
  assert.ok(workspace.includes('"1m"].includes(pane.timeframe)'),
    "a minute pane must not fetch a second series");
}

console.log("Initial Balance timeframe-independence tests passed.");
