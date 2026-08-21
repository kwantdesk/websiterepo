import { cmeSessionDateKey } from "../src/lib/chartHistoryWindow.ts";

/**
 * Cost of resolving the CME session date per execution.
 *
 * applyInstitutionalTradesToVolumeProfile calls this once per record PER
 * PROFILE, and the weekly key calls it again on top. With a daily and a weekly
 * profile open, every print on the tape is resolved several times over.
 */
const SEED = 25_000;                       // one reconnect seed
const BATCH = 500;                         // one live batch at 250ms
const start = Date.UTC(2026, 7, 20, 13, 30);
const stamps = Array.from({ length: SEED }, (_, i) => start + i * 250);

const time = (label, n, fn) => {
  fn(Math.min(n, 2_000));                   // warm
  const t0 = performance.now();
  fn(n);
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(40)} ${ms.toFixed(1).padStart(8)} ms`);
  return ms;
};

const runDaily = (n) => { for (let i = 0; i < n; i += 1) cmeSessionDateKey(stamps[i]); };

console.log(`resolving the session date for ${SEED.toLocaleString()} prints\n`);
const seedMs = time("seed, one profile", SEED, runDaily);
console.log(`\nwith 5 daily + 2 weekly profiles open, a seed resolves it`);
console.log(`~9x over (weekly resolves it twice): ~${(seedMs * 9).toFixed(0)} ms of blocked main thread`);
const batchMs = time("\nlive batch (500 prints), one profile", BATCH, runDaily);
console.log(`per second at 4 batches/s across 9 resolutions: ~${(batchMs * 9 * 4).toFixed(0)} ms/s`);
