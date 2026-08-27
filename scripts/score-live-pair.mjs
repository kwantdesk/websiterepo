#!/usr/bin/env node
/**
 * Score a live side-by-side of GEX MAP against Trinity.
 *
 * Every earlier score replayed the engine over a captured tape and compared it
 * to a lattice from 2026-08-21 - four minutes of one session, all inside the
 * first half hour. This scores what the two products actually DREW at the same
 * minute, months of price action later and at a different time of day, with no
 * replay and no engine in the middle.
 *
 * It is the first genuine out-of-sample check the model has had.
 *
 *   node scripts/score-live-pair.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAIR = fileURLToPath(new URL("./trinity-live-lattice-2026-08-28.json", import.meta.url));
if (!existsSync(PAIR)) {
  console.log(`skipped: ${PAIR} is not in this working tree.`);
  process.exit(0);
}

const pair = JSON.parse(readFileSync(PAIR, "utf8"));
const theirs = new Map(Object.entries(pair.SPXW.values).map(([k, v]) => [Number(k), v]));
const ours = new Map(Object.entries(pair.OURS_SPX.values).map(([k, v]) => [Number(k), v]));
const spot = pair.SPXW.spot;

const shared = [...theirs.keys()].filter((strike) => ours.has(strike)).sort((a, b) => a - b);
const agree = (strike) => Math.sign(theirs.get(strike)) === Math.sign(ours.get(strike));
const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));

const pct = (value) => `${(value * 100).toFixed(0)}%`;
const money = (value) => `${value < 0 ? "-" : ""}$${Math.abs(value) >= 1000
  ? `${(Math.abs(value) / 1000).toFixed(1)}M`
  : `${Math.abs(value).toFixed(0)}K`}`;

console.log(`SPX ${pair.capturedAt}   spot ${spot}   ${shared.length} shared strikes\n`);

const top = bySize.slice(0, 12);
console.log("The twelve nodes that carry the map:");
console.log("  strike        theirs          ours     ");
console.log(`  ${"-".repeat(46)}`);
for (const strike of top) {
  console.log(
    `  ${String(strike).padEnd(8)}${money(theirs.get(strike)).padStart(12)}`
    + `${money(ours.get(strike)).padStart(14)}     ${agree(strike) ? "" : "SIGN DIFFERS"}`,
  );
}

const total = shared.reduce((sum, k) => sum + Math.abs(theirs.get(k)), 0);
const weighted = shared.reduce((sum, k) => sum + (agree(k) ? Math.abs(theirs.get(k)) : 0), 0) / total;
const grossOurs = shared.reduce((sum, k) => sum + Math.abs(ours.get(k)), 0);

function pearson(keys, f, g) {
  const n = keys.length;
  const mf = keys.reduce((s, k) => s + f(k), 0) / n;
  const mg = keys.reduce((s, k) => s + g(k), 0) / n;
  let cov = 0;
  let vf = 0;
  let vg = 0;
  for (const k of keys) {
    const a = f(k) - mf;
    const b = g(k) - mg;
    cov += a * b;
    vf += a * a;
    vg += b * b;
  }
  return cov / Math.sqrt(vf * vg);
}

const starOf = (map) => [...map.entries()]
  .reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

console.log(`\n  all strikes        ${pct(shared.filter(agree).length / shared.length)}`);
console.log(`  top 12             ${pct(top.filter(agree).length / top.length)}`);
console.log(`  magnitude-weighted ${pct(weighted)}`);
console.log(`  correlation        ${pearson(shared, (k) => theirs.get(k), (k) => ours.get(k)).toFixed(3)}`);
console.log(`  gross ratio        ${(grossOurs / total).toFixed(2)}x`);
console.log(`  star   ours ${starOf(ours)[0]}   theirs ${starOf(theirs)[0]}   ${
  starOf(ours)[0] === starOf(theirs)[0] ? "MATCH" : `${Math.abs(starOf(ours)[0] - starOf(theirs)[0])} points apart`}`);

// Where does the disagreement sit?
const wrong = shared.filter((k) => !agree(k));
const scale = Math.max(...shared.map((k) => Math.abs(theirs.get(k))));
const meanShare = (keys) => (keys.length
  ? keys.reduce((s, k) => s + Math.abs(theirs.get(k)), 0) / keys.length / scale
  : 0);
console.log(`\n  ${wrong.length} of ${shared.length} strikes disagree`);
console.log(`  mean size of a node we get right  ${pct(meanShare(shared.filter(agree)))} of the King`);
console.log(`  mean size of a node we get wrong  ${pct(meanShare(wrong))} of the King`);
console.log(`  they disagree at: ${wrong.join(", ")}`);

// Their map is far more concentrated than ours. By how much?
const band = (map, points) => {
  const inside = shared.filter((k) => Math.abs(k - spot) <= points)
    .reduce((s, k) => s + Math.abs(map.get(k)), 0);
  const whole = shared.reduce((s, k) => s + Math.abs(map.get(k)), 0);
  return inside / whole;
};
console.log(`\n  share of the map within 25 points of spot   theirs ${pct(band(theirs, 25))}   ours ${pct(band(ours, 25))}`);
console.log(`  share within 50 points                     theirs ${pct(band(theirs, 50))}   ours ${pct(band(ours, 50))}`);

/*
 * The disagreements are not scattered. Below spot they are positive and we are
 * negative; above spot the reverse. That is a systematic inversion in the
 * WINGS, where flow is thin and the structural component dominates - and a
 * sign convention getting flipped is exactly what that looks like.
 */
console.log("\nBy side of spot, where flow is thin:");
for (const [label, keys] of [
  ["below spot", shared.filter((k) => k < spot)],
  ["above spot", shared.filter((k) => k > spot)],
]) {
  const theirPos = keys.filter((k) => theirs.get(k) > 0).length;
  const ourPos = keys.filter((k) => ours.get(k) > 0).length;
  console.log(
    `  ${label.padEnd(11)} ${String(keys.length).padStart(2)} strikes`
    + `   theirs ${pct(theirPos / keys.length)} positive`
    + `   ours ${pct(ourPos / keys.length)} positive`
    + `   agree ${pct(keys.filter(agree).length / keys.length)}`,
  );
}

// Split by how much of the map a node carries. If the inversion lives in the
// small nodes, it is the structural side that is inverted, not the flow.
const ourStarMagnitude = Math.max(...shared.map((k) => Math.abs(ours.get(k))));
console.log("\nBy how big the node is in OUR map:");
for (const [label, keys] of [
  ["big (>10% of our star)", shared.filter((k) => Math.abs(ours.get(k)) > ourStarMagnitude * 0.1)],
  ["small (<10%)", shared.filter((k) => Math.abs(ours.get(k)) <= ourStarMagnitude * 0.1)],
]) {
  if (!keys.length) continue;
  const flipped = keys.filter((k) => Math.sign(theirs.get(k)) === -Math.sign(ours.get(k))).length;
  console.log(
    `  ${label.padEnd(24)} ${String(keys.length).padStart(2)} strikes`
    + `   agree ${pct(keys.filter(agree).length / keys.length)}`
    + `   would agree if FLIPPED ${pct(flipped / keys.length)}`,
  );
}
