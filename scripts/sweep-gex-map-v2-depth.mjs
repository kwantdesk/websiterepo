#!/usr/bin/env node
/**
 * How deep does the book have to go, and how hard should it be bounded?
 *
 * Located first, then swept. The nodes the model gets WRONG average 4% of the
 * Star while the ones it gets right average 9%, so the error sits in the small
 * strikes - and the frames it gets worst are the two nearest the open, where
 * the book has barely any flow in it. Both point the same way: the book starts
 * too thin, not too wrong.
 *
 * Three knobs interact and cannot be judged apart:
 *
 *   carry      how many prior sessions of the SAME contracts are folded in;
 *   half-life  how much of that survives to the frame being drawn;
 *   OI bound   how much inventory one contract may hold, as a share of its open
 *              interest - deeper carry pushes more contracts against it.
 *
 * Scored on what a trader actually reads: whether the BIG nodes point the same
 * way, not whether every eleven-dollar node does.
 *
 *   node scripts/sweep-gex-map-v2-depth.mjs [--quick]
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  accumulateDecayedTape,
  emptyDealerInventory,
  revalueDealerGex,
  contractKey,
  DEALER_INVENTORY_OI_BOUND,
} from "../src/lib/gexMapV2.ts";

const ZERO_DTE = "2026-08-21";
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";
const HOUR = 3_600_000;

/** Every session with a captured tape, oldest first. */
const SESSIONS = [
  "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14",
  "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21",
];
const file = (session) => fileURLToPath(new URL(
  session === ZERO_DTE
    ? `../tmp/opra-open-ascending-SPX-${session}.json`
    : `../tmp/opra-ascending-SPX-${session}.json`,
  import.meta.url,
));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));

const available = SESSIONS.filter((session) => existsSync(file(session)));
if (!existsSync(LATTICE) || !available.includes(ZERO_DTE)) {
  console.log("skipped: the reference lattice or the expiry-day tape is not in this working tree.");
  process.exit(0);
}

const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));
const captures = new Map(available.map((s) => [s, JSON.parse(readFileSync(file(s), "utf8"))]));
const openInterest = captures.get(ZERO_DTE).openInterest?.data ?? {};

const asTrade = (p) => ({
  strikePrice: p.strikePrice,
  contractType: p.contractType,
  expirationDate: p.expirationDate,
  size: p.size,
  tradeSideCode: p.tradeSideCode,
  tradeConsolidationType: p.tradeConsolidationType,
  tradeType: p.tradeType,
  openInterest: p.openInterest,
  isOpeningPosition: p.isOpeningPosition,
  tradeTime: p.tradeTime,
});

const allPrints = available.flatMap((session) => captures.get(session).prints
  .filter((p) => p.expirationDate?.slice(0, 10) === ZERO_DTE)
  .filter((p) => Number.isFinite(p.tradeTime))
  .map((p) => ({ ...p, session })))
  .sort((a, b) => a.tradeTime - b.tradeTime);

const starOf = (map) => [...map.entries()]
  .reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

/**
 * The bound is `openInterest * DEALER_INVENTORY_OI_BOUND`, so scaling the open
 * interest the engine is shown scales the bound - the shipped constant is swept
 * without reaching inside it.
 */
function oiReader(multiplier) {
  return (key) => {
    const [, strikeText, right] = key.split("|");
    const cell = openInterest[Number(strikeText).toFixed(1)] ?? openInterest[strikeText];
    if (!cell) return 0;
    const value = (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
    return value * multiplier;
  };
}

/** Classification is independent of half-life and bound, so do it once. */
const classifiedCache = new Map();
function classifiedFor(frameIso, carryDays) {
  const key = `${frameIso}|${carryDays}`;
  const hit = classifiedCache.get(key);
  if (hit) return hit;
  const cutoff = Date.parse(frameIso);
  const earliest = available[Math.max(0, available.length - 1 - carryDays)];
  const prints = allPrints.filter((p) => p.tradeTime <= cutoff && p.session >= earliest);
  const value = {
    prints,
    classified: classifyConsolidatedTape(prints.map(asTrade)),
  };
  classifiedCache.set(key, value);
  return value;
}

function scoreFrame(frameIso, carryDays, halfLifeMs, oiMultiplier) {
  const target = lattices[frameIso]?.SPXW;
  if (!target) return null;
  const cutoff = Date.parse(frameIso);
  const { prints, classified } = classifiedFor(frameIso, carryDays);
  if (classified.length < 8) return null;

  const contracts = new Map();
  let spot = target.spot ?? 0;
  for (const p of prints) {
    const right = p.contractType === "CALL" ? "call" : p.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(p.impliedVolatility) || !Number.isFinite(p.dte)) continue;
    contracts.set(contractKey(ZERO_DTE, p.strikePrice, right), {
      impliedVolatility: p.impliedVolatility,
      expiryMs: p.tradeTime + p.dte * 24 * 60 * 60 * 1_000,
    });
    if (p.session === ZERO_DTE && Number.isFinite(p.stockPrice)) spot = p.stockPrice;
  }

  const state = accumulateDecayedTape(
    emptyDealerInventory(ZERO_DTE, classified[0].tradeTimeMs),
    classified,
    oiReader(oiMultiplier),
    cutoff,
    halfLifeMs,
  );

  const strikes = [...new Set(Object.keys(target.values).map(Number))].sort((a, b) => a - b);
  const frame = revalueDealerGex({
    state, strikes, expirations: [ZERO_DTE], contracts, spot, asOfMs: cutoff, representation: REPRESENTATION,
  });
  const ours = new Map(frame.nodes.map((n) => [n.strike, n.net]));
  const theirs = new Map(strikes
    .map((k) => [k, target.values[String(k)] ?? target.values[k]])
    .filter(([, v]) => Number.isFinite(v)));
  const shared = [...theirs.keys()].filter((k) => ours.has(k));
  if (shared.length < 8) return null;

  const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(ours.get(k));
  const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));
  const topTen = bySize.slice(0, Math.min(10, shared.length));
  const total = shared.reduce((s, k) => s + Math.abs(theirs.get(k)), 0);

  return {
    all: shared.filter(agree).length / shared.length,
    topTen: topTen.filter(agree).length / topTen.length,
    weighted: shared.reduce((s, k) => s + (agree(k) ? Math.abs(theirs.get(k)) : 0), 0) / total,
    covered: shared.length / strikes.length,
    starMatch: starOf(ours)?.[0] === starOf(theirs)?.[0],
  };
}

const frames = Object.keys(lattices).sort();
const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
const quick = process.argv.includes("--quick");
const CARRY = quick ? [3, 6, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const HALF_LIVES = quick ? [12, 48] : [6, 12, 24, 48, 96];
const BOUNDS = quick ? [1, 4] : [0.5, 1, 2, 4, 10];

console.log(`SPX ${ZERO_DTE}, ${frames.length} reference frames, ${available.length} captured sessions.`);
console.log(`Shipped: carry 3, half-life 12h, OI bound ${DEALER_INVENTORY_OI_BOUND}.\n`);
console.log("carry  half   bound |  all  top10  weighted  strikes  stars");
console.log("-".repeat(60));

const ranked = [];
for (const carryDays of CARRY) {
  for (const hours of HALF_LIVES) {
    for (const bound of BOUNDS) {
      const scored = frames.map((f) => scoreFrame(f, carryDays, hours * HOUR, bound)).filter(Boolean);
      if (scored.length < frames.length) continue;
      const row = {
        carryDays,
        hours,
        bound,
        all: mean(scored.map((s) => s.all)),
        topTen: mean(scored.map((s) => s.topTen)),
        weighted: mean(scored.map((s) => s.weighted)),
        covered: mean(scored.map((s) => s.covered)),
        stars: scored.filter((s) => s.starMatch).length,
        worstWeighted: Math.min(...scored.map((s) => s.weighted)),
      };
      ranked.push(row);
    }
  }
}

// Ranked by what the desk reads: the big nodes, then the Star.
ranked.sort((a, b) => (b.weighted + b.topTen + b.stars / frames.length)
  - (a.weighted + a.topTen + a.stars / frames.length));

for (const row of ranked.slice(0, 20)) {
  console.log(
    `${String(row.carryDays).padStart(4)}d ${String(row.hours + "h").padStart(5)}`
    + ` ${String(row.bound + "x").padStart(6)} |`
    + ` ${(row.all * 100).toFixed(0).padStart(3)}%`
    + ` ${(row.topTen * 100).toFixed(0).padStart(5)}%`
    + ` ${(row.weighted * 100).toFixed(0).padStart(8)}%`
    + ` ${(row.covered * 100).toFixed(0).padStart(7)}%`
    + `   ${row.stars}/${frames.length}`,
  );
}

const shipped = ranked.find((r) => r.carryDays === 3 && r.hours === 12 && r.bound === 1);
if (shipped) {
  console.log(
    `\nshipped today: all ${(shipped.all * 100).toFixed(0)}%,`
    + ` top10 ${(shipped.topTen * 100).toFixed(0)}%,`
    + ` weighted ${(shipped.weighted * 100).toFixed(0)}%,`
    + ` ${shipped.stars}/${frames.length} stars`,
  );
}
const best = ranked[0];
if (best) {
  console.log(
    `best:          carry ${best.carryDays}d, ${best.hours}h, bound ${best.bound}x ->`
    + ` all ${(best.all * 100).toFixed(0)}%,`
    + ` top10 ${(best.topTen * 100).toFixed(0)}%,`
    + ` weighted ${(best.weighted * 100).toFixed(0)}% (worst frame ${(best.worstWeighted * 100).toFixed(0)}%),`
    + ` ${best.stars}/${frames.length} stars`,
  );
}
console.log("\nFour frames of one session. A setting that wins here and nowhere else");
console.log("is a curve fit, so prefer a plateau over a peak.");
