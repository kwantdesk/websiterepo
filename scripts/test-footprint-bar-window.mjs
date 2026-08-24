import assert from "node:assert/strict";
import { buildFootprintBars } from "../src/lib/footprint.ts";

/**
 * Every bar that has trades gets its rows.
 *
 * The forming bar's window used to be guessed from the single previous gap.
 * On a clock chart every gap is the interval, so the guess was right; on a
 * volume, range or tick chart the gaps are whatever the market did. A quick
 * previous bar gave the forming bar a window of a second or two and every
 * later trade was dropped — the bar kept its open, high, low and close from
 * the candle and drew no rows at all, so the footprint climbed with price
 * while empty.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const T0 = 1_770_000_000_000;
const SETTINGS = {
  tickSize: 0.25, groupTicks: 1, instrument: "NQ",
  valueAreaPercent: 0.7, minimumImbalancePercent: 300,
  minimumDominantVolume: 10, minimumDelta: 0,
};

const candle = (timestamp, price) => ({
  timestamp, open: price, high: price + 2, low: price - 2, close: price + 1, volume: 500,
});
const trade = (timestamp, price, size, buy = true) => ({
  timestamp, close: price, price, volume: size, size,
  askVolume: buy ? size : 0, bidVolume: buy ? 0 : size,
  aggressor: buy ? "BUY" : "SELL", trades: 1,
});
const rowsOf = (bar) => (bar.rows ?? []).length;

check("a clock chart still fills every bar", () => {
  const candles = [0, 1, 2].map((i) => candle(T0 + i * 60_000, 20_000 + i));
  const trades = [];
  for (let i = 0; i < 3; i += 1) {
    for (let n = 0; n < 5; n += 1) trades.push(trade(T0 + i * 60_000 + n * 5_000, 20_000 + i + n * 0.25, 10));
  }
  const bars = buildFootprintBars(candles, trades, SETTINGS);
  assert.equal(bars.length, 3);
  for (const [index, bar] of bars.entries()) {
    assert.ok(rowsOf(bar) > 0, `clock bar ${index} came back empty`);
  }
});

check("a fast bar before the forming one no longer empties it", () => {
  // The reported shape: two quick event bars, then a slow forming bar. The old
  // window was the previous gap — two seconds — so everything after that was
  // dropped from the bar that is actually still building.
  const candles = [
    candle(T0, 20_000),
    candle(T0 + 2_000, 20_004),
    candle(T0 + 4_000, 20_008),
  ];
  const trades = [];
  // The forming bar runs for five minutes on a quiet tape.
  for (let n = 0; n < 40; n += 1) trades.push(trade(T0 + 4_000 + n * 7_500, 20_008 + n * 0.25, 12));
  const bars = buildFootprintBars(candles, trades, SETTINGS);
  const forming = bars.at(-1);
  assert.ok(rowsOf(forming) > 1, `the forming bar drew ${rowsOf(forming)} rows`);
  const volume = (forming.rows ?? []).reduce((sum, row) => sum + Number(row.totalVolume ?? row.volume ?? 0), 0);
  assert.equal(volume, 40 * 12, "every trade in the forming bar must be counted");
});

check("trades still land in the bar that owns them", () => {
  const candles = [candle(T0, 20_000), candle(T0 + 60_000, 20_010)];
  const bars = buildFootprintBars(candles, [
    trade(T0 + 1_000, 20_000, 7),
    trade(T0 + 61_000, 20_010, 9),
  ], SETTINGS);
  const total = (bar) => (bar.rows ?? []).reduce((sum, row) => sum + Number(row.totalVolume ?? row.volume ?? 0), 0);
  assert.equal(total(bars[0]), 7, "the first bar keeps only its own trade");
  assert.equal(total(bars[1]), 9, "and the second keeps its own");
});

check("a trade before the first bar is not swept into it", () => {
  const candles = [candle(T0, 20_000)];
  const bars = buildFootprintBars(candles, [trade(T0 - 30_000, 19_990, 5)], SETTINGS);
  const total = (bars[0].rows ?? []).reduce((sum, row) => sum + Number(row.totalVolume ?? row.volume ?? 0), 0);
  assert.equal(total, 0, "a trade older than every bar belongs to none of them");
});

check("a bar with no trades reports that it has no price-level flow", () => {
  // Genuinely empty is allowed — the renderer needs to tell it apart from a
  // bar whose trades were dropped, which is what this flag is for.
  const candles = [candle(T0, 20_000), candle(T0 + 60_000, 20_010)];
  const bars = buildFootprintBars(candles, [trade(T0 + 61_000, 20_010, 9)], SETTINGS);
  assert.equal(bars[0].hasPriceLevelFlow, false, "the untraded bar must say so");
  assert.equal(bars[1].hasPriceLevelFlow, true);
});

check("one bar of candles is filled rather than dropped", () => {
  const bars = buildFootprintBars([candle(T0, 20_000)], [
    trade(T0 + 1_000, 20_000, 4),
    trade(T0 + 90_000, 20_002, 6),
  ], SETTINGS);
  const total = (bars[0].rows ?? []).reduce((sum, row) => sum + Number(row.totalVolume ?? row.volume ?? 0), 0);
  assert.equal(total, 10, "with no later bar, everything after its start is the forming bar's");
});

console.log(`\nfootprint bar window: ${passed}/${passed} checks passed`);
