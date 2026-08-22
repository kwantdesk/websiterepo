import { buildTpoProfiles } from "../src/lib/tpo/engine.ts";
import { defaultTpoSettings } from "../src/lib/tpo/settings.ts";

/**
 * Cost of one buildTpoProfiles call.
 *
 * A stall profile captured on the owner's machine put a single function in this
 * chunk at 1.0-1.3s inside stalls of 2.5-3.4s, with heap far below the ceiling.
 * The build is already throttled to 5s, but throttling only changes how OFTEN a
 * call happens — a one-second call every five seconds is still a one-second
 * freeze every five seconds.
 */
const TICK = 0.25;
const SESSION_MS = 23 * 60 * 60_000;
const start = Date.parse("2026-08-15T22:00:00.000Z");

const bars = [];
const trades = [];
let seq = 0;
// Five sessions of one-minute bars, which is what a weekly TPO covers.
for (let day = 0; day < 5; day += 1) {
  const dayStart = start + day * 24 * 60 * 60_000;
  for (let minute = 0; minute < SESSION_MS / 60_000; minute += 1) {
    const t = dayStart + minute * 60_000;
    const mid = 29_000 + Math.sin(minute / 40 + day) * 60;
    const high = mid + 3;
    const low = mid - 3;
    bars.push({
      instrumentId: "NQ", startTimeMs: t, endTimeMs: t + 60_000,
      open: mid, high, low, close: mid + 0.5,
      volume: 800, bidVolume: 400, askVolume: 400, tradeCount: 120, tickSize: TICK,
    });
    // A realistic print rate: the exact-trades path walks all of these.
    for (let k = 0; k < 18; k += 1) {
      seq += 1;
      trades.push({
        instrumentId: "NQ", timestampMs: t + k * 3_000, sequence: seq,
        price: Number((low + ((seq * 7) % 25) * TICK).toFixed(4)),
        size: 1 + (seq % 5),
        aggressorSide: seq % 2 ? "buy" : "sell",
        tickSize: TICK,
      });
    }
  }
}

const time = (label, fn) => {
  fn(); fn();
  const N = 6;
  const t0 = performance.now();
  for (let i = 0; i < N; i += 1) fn();
  const per = (performance.now() - t0) / N;
  console.log(`${label.padEnd(40)} ${per.toFixed(0).padStart(6)} ms per build`);
  return per;
};

console.log(bars.length + " bars, " + trades.length + " prints (5 sessions)");


// How does it scale? Linear in prints is one story; worse than linear is
// another, and decides whether this is tuning or an algorithm.
const settings = defaultTpoSettings("tpo-chart");
for (const share of [0.25, 0.5, 1]) {
  const slice = trades.slice(0, Math.floor(trades.length * share));
  const barSlice = bars.slice(0, Math.floor(bars.length * share));
  time((share * 100).toFixed(0) + "% (" + slice.length.toLocaleString() + " prints)", () =>
    buildTpoProfiles({ trades: slice, bars: barSlice, settings, nowMs: barSlice.at(-1).endTimeMs }));
}
console.log();
// Which source path costs it: walking every print, or the bar ranges?
for (const visitSource of ["exact-trades", "bar-range"]) {
  time("visitSource=" + visitSource, () =>
    buildTpoProfiles({ trades, bars, settings: { ...settings, visitSource }, nowMs: bars.at(-1).endTimeMs }));
}
