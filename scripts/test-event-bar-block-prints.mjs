import assert from "node:assert/strict";
import { applyMarketTradesToEventBars } from "../src/lib/eventBars.ts";

/**
 * One execution belongs to one bar.
 *
 * The threshold builder used to divide a print across as many bars as it could
 * fill. Nothing trades between those bars, so every one came out with its
 * open, high, low and close equal: a single 5,000-lot block on a 500v chart
 * manufactured nine identical bars and drew a flat horizontal run across the
 * chart. The volume arrived at one price in one moment, so it belongs to one
 * bar, even when that bar overruns its threshold.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const T0 = 1_770_000_000_000;
function tape(entries) {
  return entries.map(([price, size], index) => ({
    timestamp: T0 + index * 1_000,
    price,
    size,
    trades: 1,
    delta: size,
  }));
}
const build = (entries, timeframe = "500v") =>
  applyMarketTradesToEventBars([], tape(entries), timeframe, "NQ", 5_000);
const isFlat = (bar) => bar.open === bar.high && bar.high === bar.low && bar.low === bar.close;
const totalVolume = (bars) => bars.reduce((sum, bar) => sum + Number(bar.volume ?? 0), 0);

const walk = (count, from = 29_400) => {
  const out = [];
  let price = from;
  for (let i = 0; i < count; i += 1) {
    price += i % 2 ? 0.25 : -0.25;
    out.push([price, 120]);
  }
  return out;
};

check("a block print larger than the threshold makes ONE bar", () => {
  const bars = build([...walk(20), [29_405.5, 5_000], ...walk(20)]);
  const block = bars.filter((bar) => Number(bar.volume) > 1_000);
  assert.equal(block.length, 1, `expected one oversized bar, got ${block.length}`);
  assert.ok(
    Number(block[0].volume) >= 5_000,
    `the whole print must land in it, got ${block[0].volume}`,
  );
});

check("no bar is manufactured with a flat open/high/low/close", () => {
  const bars = build([...walk(20), [29_405.5, 5_000], ...walk(20)]);
  const flat = bars.filter(isFlat);
  assert.equal(
    flat.length, 0,
    `a flat bar carries no price information and draws as a horizontal line; got ${flat.length}`,
  );
});

check("volume is conserved exactly", () => {
  const entries = [...walk(20), [29_405.5, 5_000], ...walk(20)];
  const bars = build(entries);
  const expected = entries.reduce((sum, [, size]) => sum + size, 0);
  assert.equal(Math.round(totalVolume(bars)), expected, "no volume may be lost or duplicated");
});

check("ordinary prints still roll the bar at the threshold", () => {
  // 500v with 100-lot prints: a bar closes on the fifth.
  const bars = build(Array.from({ length: 20 }, (_, i) => [29_400 + i * 0.25, 100]));
  assert.ok(bars.length >= 4, `expected the bar to roll, got ${bars.length} bars`);
  for (const bar of bars.slice(0, -1)) {
    assert.ok(
      Number(bar.volume) >= 500,
      `a completed 500v bar must hold at least its threshold, got ${bar.volume}`,
    );
  }
});

check("a completed bar is never re-opened by the next print", () => {
  const bars = build(Array.from({ length: 30 }, (_, i) => [29_400 + i * 0.25, 100]));
  const completed = bars.slice(0, -1);
  for (const bar of completed) {
    assert.ok(Number(bar.volume) >= 500, "completed bars keep their volume");
  }
  // Each bar opens where the last one closed: event bars are one continuous
  // sequence, and a gap between them would be invented.
  for (let i = 1; i < bars.length; i += 1) {
    assert.equal(bars[i].open, bars[i - 1].close, `bar ${i} must open at the previous close`);
  }
});

check("a run of identical-price prints does not fabricate bars", () => {
  // Twenty 100-lot prints all at one price is 2,000 lots: four bars of real
  // volume, not twenty flat ones.
  const bars = build(Array.from({ length: 20 }, () => [29_400, 100]));
  assert.ok(bars.length <= 5, `expected about four bars, got ${bars.length}`);
  assert.equal(Math.round(totalVolume(bars)), 2_000);
});

check("the same rule holds for tick-count bars", () => {
  const bars = build(Array.from({ length: 12 }, (_, i) => [29_400 + i * 0.25, 50]), "10t");
  assert.equal(Math.round(totalVolume(bars)), 600, "volume is conserved on tick bars too");
  assert.equal(bars.filter(isFlat).length, 0, "no flat bars on tick charts either");
});

console.log(`\nevent bar block prints: ${passed}/${passed} checks passed`);
