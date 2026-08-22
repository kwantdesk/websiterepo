import { calculateImbalanceZones } from "../src/lib/imbalanceTracker.ts";

/**
 * Per-record exchange-clock cost across the indicator engines.
 *
 * The TPO build spent 88.6% of nine seconds inside Intl.DateTimeFormat because
 * the period machinery resolved exchange-local time per trade. The same shape
 * appears in several other engines, and the imbalance tracker is the worst of
 * them: it builds a NEW DateTimeFormat per call and calls it inside a nested
 * loop over the extension window.
 */
const TICK = 0.25;
const BAR_MS = 60_000;
const start = Date.parse("2026-08-17T13:30:00.000Z");

const candles = [];
const records = [];
let seq = 0;
// Two RTH sessions of one-minute bars — a modest chart, not a stress test.
for (let i = 0; i < 780; i += 1) {
  const t = start + i * BAR_MS;
  const mid = 29_000 + Math.sin(i / 30) * 40;
  candles.push({
    timestamp: t,
    open: mid, high: mid + 4, low: mid - 4, close: mid + (i % 3 === 0 ? 1 : -1),
    volume: 900,
  });
  for (let k = 0; k < 40; k += 1) {
    seq += 1;
    records.push({
      timestamp: t + k * 1_500,
      close: Number((mid - 4 + ((seq * 3) % 32) * TICK).toFixed(4)),
      volume: 1 + (seq % 7),
      // Strongly one-sided so imbalance zones actually form and the
      // extension loop (which resolves a session key per bar) is exercised.
      bidVolume: k % 2 === 0 ? 1 : 60, askVolume: k % 2 === 0 ? 60 : 1,
      delta: (seq % 5) - 2, trades: 1,
      recordIndex: seq, eventId: `e${seq}`,
    });
  }
}

const instance = {
  instanceId: "imb-1",
  indicatorId: "imbalance-tracker",
  enabled: true,
  // resetMode is what reaches the nested session-key loop.
  settings: {
    calculationMode: "diagonal", extendedBars: 30, resetMode: "session",
    minimumPercent: 150, minimumDelta: 5, minimumConsecutive: 1,
  },
};

const time = (label, fn) => {
  fn();
  const N = 5;
  const t0 = performance.now();
  let out;
  for (let i = 0; i < N; i += 1) out = fn();
  const per = (performance.now() - t0) / N;
  console.log(`${label.padEnd(46)} ${per.toFixed(0).padStart(6)} ms   (${Array.isArray(out) ? out.length : 0} zones)`);
  return per;
};

console.log(`${candles.length} candles, ${records.length.toLocaleString()} prints\n`);
time("imbalance tracker, resetMode=session", () =>
  calculateImbalanceZones(candles, records, instance, TICK));
time("imbalance tracker, resetMode=none", () =>
  calculateImbalanceZones(candles, records, { ...instance, settings: { ...instance.settings, resetMode: "none" } }, TICK));
