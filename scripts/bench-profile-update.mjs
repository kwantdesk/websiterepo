import { applyInstitutionalTradesToVolumeProfile } from "../src/lib/institutionalMarketData.ts";

/**
 * Cost of folding one live batch of prints into the open volume profiles.
 *
 * This runs once per profile every 250ms while the market is live, and never
 * at all while it is closed — which is the difference the trader reports
 * between a smooth idle chart and a laggy live one.
 */
const TICK = 0.25;
const buildProfile = (period, ticks, startMs) => {
  const levels = [];
  for (let i = 0; i < ticks; i += 1) {
    levels.push({
      price: Number((29000 + i * TICK).toFixed(4)),
      volume: 100 + (i % 50), bidVolume: 50, askVolume: 50 + (i % 50), delta: i % 7, trades: 3,
    });
  }
  return {
    schemaVersion: "kwantify-volume-profile-v1", provider: "Databento", source: "CME executions",
    period, root: "NQ", startMs, endMs: startMs + 82_800_000, asOf: startMs + 82_800_000,
    coverageEndMs: startMs + 82_800_000, tradingDate: "2026-08-21",
    tickSize: TICK, groupTicks: 1, levels,
    poc: 29200, valueAreaHigh: 29260, valueAreaLow: 29140,
    totalVolume: levels.reduce((s, l) => s + l.volume, 0),
    bidVolume: 1e6, askVolume: 1e6, trades: 5e5,
    vwap: 29200, standardDeviation: 40,
    minTradeVolume: 0, maxTradeVolume: 0, developingPoc: [],
  };
};

const DAY = 86_400_000;
const base = Date.UTC(2026, 7, 21, 0, 0);
// The reported workspace: five daily profiles plus two weeklies.
let profiles = [
  ...Array.from({ length: 5 }, (_, d) => buildProfile("daily", 1_600, base - (4 - d) * DAY)),
  ...Array.from({ length: 2 }, (_, w) => buildProfile("weekly", 4_000, base - (1 - w) * 5 * DAY)),
];
const totalLevels = profiles.reduce((s, p) => s + p.levels.length, 0);

let seq = 0;
const batch = (n) => Array.from({ length: n }, () => {
  seq += 1;
  return {
    timestamp: base + 82_800_000 + seq * 10,
    close: 29000 + ((seq * 7) % 1600) * TICK,
    volume: 1 + (seq % 5), bidVolume: 1, askVolume: 0, delta: 1, trades: 1,
    recordIndex: seq, eventId: `e${seq}`,
  };
});

const run = (label, prints) => {
  for (let i = 0; i < 3; i += 1) profiles = profiles.map((p) => applyInstitutionalTradesToVolumeProfile(p, batch(prints)));
  const N = 40;
  const t0 = performance.now();
  for (let i = 0; i < N; i += 1) {
    const b = batch(prints);
    profiles = profiles.map((p) => applyInstitutionalTradesToVolumeProfile(p, b));
  }
  const per = (performance.now() - t0) / N;
  console.log(`${label.padEnd(34)} ${per.toFixed(2).padStart(7)} ms per update  →  ${(per * 4).toFixed(0)} ms/s at 4 updates/s`);
};

console.log(`7 profiles, ${totalLevels.toLocaleString()} levels total (5 daily @1,600 + 2 weekly @4,000)\n`);
run("quiet tape (20 prints)", 20);
run("busy tape (200 prints)", 200);
