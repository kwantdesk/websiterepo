import { enrichCandlesWithInstitutionalTrades } from "../src/lib/institutionalMarketData.ts";

/**
 * Cost of rebuilding candle flow from the retained tape.
 *
 * reconcileCandleFlowFromTape runs on every bar close — once a minute on a 1m
 * chart — and at least every 45s otherwise, filtering the whole tape and then
 * rebuilding every candle from it. Like the profile fold, none of this happens
 * while the market is closed.
 */
const BAR_MS = 60_000;
const start = Date.parse("2026-08-21T13:30:00.000Z");
const candles = Array.from({ length: 600 }, (_, i) => ({
  timestamp: start + i * BAR_MS,
  open: 29000 + (i % 40) * 0.25, high: 29010 + (i % 40) * 0.25,
  low: 28990 + (i % 40) * 0.25, close: 29000 + ((i * 7) % 40) * 0.25,
  volume: 500 + (i % 100),
}));
const tape = Array.from({ length: 25_000 }, (_, i) => ({
  timestamp: start + Math.floor(i * (600 * BAR_MS) / 25_000),
  close: 29000 + ((i * 13) % 160) * 0.25,
  volume: 1 + (i % 9), bidVolume: i % 4, askVolume: i % 5,
  delta: (i % 5) - (i % 4), trades: 1,
  recordIndex: i, eventId: `e${i}`, flowOnly: i % 11 === 0,
}));

const time = (label, fn) => {
  for (let i = 0; i < 3; i += 1) fn();
  const N = 20;
  const t0 = performance.now();
  for (let i = 0; i < N; i += 1) fn();
  const per = (performance.now() - t0) / N;
  console.log(`${label.padEnd(44)} ${per.toFixed(1).padStart(7)} ms`);
  return per;
};

console.log(`600 candles, ${tape.length.toLocaleString()}-record tape\n`);
const filterMs = time("tape.filter(!flowOnly) alone", () => tape.filter((r) => !r.flowOnly));
const exact = tape.filter((r) => !r.flowOnly);
const enrichMs = time("enrichCandlesWithInstitutionalTrades", () => enrichCandlesWithInstitutionalTrades(candles, exact, candles.length));
console.log(`\none reconcile ~= ${(filterMs + enrichMs).toFixed(0)} ms, and it runs on every bar close`);
console.log(`on a 1m chart that is a ~${(filterMs + enrichMs).toFixed(0)} ms stall once a minute, per pane`);
