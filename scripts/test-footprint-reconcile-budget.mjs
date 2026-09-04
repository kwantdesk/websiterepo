import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildFootprintBarsCached } from "../src/lib/footprint.ts";

/**
 * Footprint's late-print repair must be bounded. The former 30-second expiry
 * rebuilt every visible bar in every order-flow cache together and produced
 * the periodic chart freeze reported with Footprint + profiles enabled.
 */

const T0 = 1_770_000_000_000;
const SETTINGS = {
  tickSize: 0.25,
  groupTicks: 1,
  instrument: "NQ",
  valueAreaPercent: 0.7,
  minimumImbalancePercent: 300,
  minimumDominantVolume: 10,
  minimumDelta: 0,
};
const candle = (index) => ({
  timestamp: T0 + index * 60_000,
  open: 20_000 + index,
  high: 20_002 + index,
  low: 19_998 + index,
  close: 20_001 + index,
  volume: 500,
});
const trade = (index, size = 10) => ({
  timestamp: T0 + index * 60_000 + 1_000,
  close: 20_000 + index,
  price: 20_000 + index,
  volume: size,
  size,
  askVolume: size,
  bidVolume: 0,
  aggressor: "BUY",
  trades: 1,
});
const barVolume = (bar) => bar.rows.reduce((sum, row) => sum + row.totalVolume, 0);

let now = T0;
const originalNow = Date.now;
Date.now = () => now;
try {
  const candles = Array.from({ length: 100 }, (_, index) => candle(index));
  let records = Array.from({ length: 100 }, (_, index) => trade(index));
  const cache = { current: null };
  const initial = buildFootprintBarsCached(cache, candles, records, SETTINGS);
  const initialBuiltAt = cache.current.builtAt;

  // Cross the old 30-second boundary. A late correction in the newest closed
  // slice is applied, but an unrelated old bar retains its exact object.
  now += 31_000;
  records = records.map((record, index) => index === 95 ? trade(index, 25) : record);
  const afterBoundary = buildFootprintBarsCached(cache, candles, records, SETTINGS);
  assert.equal(barVolume(afterBoundary[95]), 25, "the newest closed slice must accept a late correction");
  assert.equal(afterBoundary[20], initial[20], "an unrelated closed bar must not be rebuilt at 30 seconds");
  assert.equal(cache.current.builtAt, initialBuiltAt, "the cache must not expire into a periodic full rebuild");

  // The cursor wraps and repairs old history on subsequent bounded passes.
  now += 1_001;
  records = records.map((record, index) => index === 2 ? trade(index, 40) : record);
  const afterWrappedPass = buildFootprintBarsCached(cache, candles, records, SETTINGS);
  assert.equal(barVolume(afterWrappedPass[2]), 40, "rolling reconciliation must eventually repair old bars");
  assert.equal(afterWrappedPass[20], afterBoundary[20], "each repair pass stays bounded to its slice");

  // A bar roll reuses closed history and only builds the new forming bar.
  const nextCandles = [...candles, candle(100)];
  const nextRecords = [...records, trade(100, 15)];
  const afterRoll = buildFootprintBarsCached(cache, nextCandles, nextRecords, SETTINGS);
  assert.equal(afterRoll[20], afterWrappedPass[20], "a bar roll must reuse unchanged closed bars");
  assert.equal(barVolume(afterRoll.at(-1)), 15, "the new forming bar must build immediately");

  const source = readFileSync(new URL("../src/lib/footprint.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /FOOTPRINT_FULL_REBUILD_MS|30_000/, "the synchronized full-rebuild clock must stay removed");
  assert.match(source, /FOOTPRINT_RECONCILE_BARS = 8/, "repair work must remain explicitly bounded");

  console.log("\nfootprint reconcile budget: 9/9 checks passed");
} finally {
  Date.now = originalNow;
}
