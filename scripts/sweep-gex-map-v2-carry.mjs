#!/usr/bin/env node
/**
 * How far back does the dealer book start?
 *
 * Scoring the shipped engine from a zero book at the opening bell produced
 * nodes 4-7x SMALLER than the reference and covering barely a third of its
 * strikes, with the engine itself reporting "warming" on every frame. Both are
 * the signature of a book that started too late rather than one calculated
 * wrongly: 25 minutes of flow cannot build a position at a strike nothing has
 * traded at yet.
 *
 * The 0DTE contracts are not new on their expiry day. SPX lists them daily, so
 * the 2026-08-21 expiry took 2,072 prints across the four prior sessions
 * against 1,523 on the day itself. A book that opens flat is discarding more
 * flow than it keeps.
 *
 * This sweeps two things together, because they trade off directly:
 *   - how many prior sessions of the SAME contracts are folded in;
 *   - the half-life, which decides how much of that survives to the open.
 *
 * A three-hour half-life leaves an overnight print worth 1/256 of a fresh one,
 * so carrying more sessions is meaningless unless the half-life is long enough
 * for them to still count. Neither can be judged alone.
 *
 *   node scripts/sweep-gex-map-v2-carry.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  accumulateDecayedTape,
  emptyDealerInventory,
  revalueDealerGex,
  contractKey,
} from "../src/lib/gexMapV2.ts";

const SESSIONS = ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];
const ZERO_DTE = "2026-08-21";
const HOUR = 3_600_000;
const HALF_LIVES = [3, 6, 12, 24, 48, 96, 240];
const CARRY_DAYS = [0, 1, 2, 3, 4];
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";

const file = (session) => fileURLToPath(new URL(
  session === ZERO_DTE
    ? `../tmp/opra-open-ascending-SPX-${session}.json`
    : `../tmp/opra-ascending-SPX-${session}.json`,
  import.meta.url,
));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));

for (const path of [...SESSIONS.map(file), LATTICE]) {
  if (!existsSync(path)) {
    console.log(`skipped: ${path} is not in this working tree.`);
    process.exit(0);
  }
}

const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));
const captures = new Map(SESSIONS.map((session) => [session, JSON.parse(readFileSync(file(session), "utf8"))]));

// Open interest from the 0DTE session's own chain - the bound applies to the
// contracts as they stand on the day being drawn.
const openInterest = captures.get(ZERO_DTE).openInterest?.data ?? {};
const oiFor = (key) => {
  const [, strikeText, right] = key.split("|");
  const cell = openInterest[Number(strikeText).toFixed(1)] ?? openInterest[strikeText];
  if (!cell) return 0;
  return (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
};

const asTrade = (print) => ({
  strikePrice: print.strikePrice,
  contractType: print.contractType,
  expirationDate: print.expirationDate,
  size: print.size,
  tradeSideCode: print.tradeSideCode,
  tradeConsolidationType: print.tradeConsolidationType,
  tradeType: print.tradeType,
  openInterest: print.openInterest,
  isOpeningPosition: print.isOpeningPosition,
  tradeTime: print.tradeTime,
});

/** Every print in the 0DTE contracts, whichever session it happened in. */
const printsBySession = new Map(SESSIONS.map((session) => [
  session,
  captures.get(session).prints
    .filter((print) => print.expirationDate?.slice(0, 10) === ZERO_DTE)
    .filter((print) => Number.isFinite(print.tradeTime))
    .sort((left, right) => left.tradeTime - right.tradeTime),
]));

function pearson(rows, f, g) {
  const n = rows.length;
  if (n < 3) return Number.NaN;
  const mf = rows.reduce((s, k) => s + f(k), 0) / n;
  const mg = rows.reduce((s, k) => s + g(k), 0) / n;
  let cov = 0;
  let vf = 0;
  let vg = 0;
  for (const k of rows) {
    const a = f(k) - mf;
    const b = g(k) - mg;
    cov += a * b;
    vf += a * a;
    vg += b * b;
  }
  return vf && vg ? cov / Math.sqrt(vf * vg) : Number.NaN;
}

function scoreFrame(frameIso, carryDays, halfLifeMs) {
  const target = lattices[frameIso]?.SPXW;
  if (!target) return null;
  const cutoff = Date.parse(frameIso);

  const sessions = SESSIONS.slice(SESSIONS.length - 1 - carryDays);
  const prints = sessions
    .flatMap((session) => printsBySession.get(session))
    .filter((print) => print.tradeTime <= cutoff)
    .sort((left, right) => left.tradeTime - right.tradeTime);
  if (prints.length < 8) return null;

  const contracts = new Map();
  let spot = target.spot ?? 0;
  for (const print of prints) {
    const right = print.contractType === "CALL" ? "call" : print.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(print.impliedVolatility) || !Number.isFinite(print.dte)) continue;
    contracts.set(contractKey(ZERO_DTE, print.strikePrice, right), {
      impliedVolatility: print.impliedVolatility,
      expiryMs: print.tradeTime + print.dte * 24 * 60 * 60 * 1_000,
    });
  }
  // Spot at the frame comes from the DAY's own tape; a prior session's last
  // print would value the book at a stale underlying.
  for (const print of printsBySession.get(ZERO_DTE)) {
    if (print.tradeTime <= cutoff && Number.isFinite(print.stockPrice)) spot = print.stockPrice;
  }

  const classified = classifyConsolidatedTape(prints.map(asTrade));
  const state = accumulateDecayedTape(
    emptyDealerInventory(ZERO_DTE, prints[0].tradeTime),
    classified,
    oiFor,
    cutoff,
    halfLifeMs,
  );

  const strikes = [...new Set(Object.keys(target.values).map(Number))].sort((a, b) => a - b);
  const frame = revalueDealerGex({
    state, strikes, expirations: [ZERO_DTE], contracts, spot, asOfMs: cutoff, representation: REPRESENTATION,
  });

  const theirValue = (strike) => target.values[String(strike)] ?? target.values[strike];
  const ours = new Map(frame.nodes.map((node) => [node.strike, node.net]));
  const keys = [...ours.keys()].filter((strike) => Number.isFinite(theirValue(strike)));
  if (keys.length < 8) return null;

  const grossOurs = keys.reduce((s, k) => s + Math.abs(ours.get(k)), 0);
  const grossTheirs = strikes.reduce((s, k) => s + Math.abs(theirValue(k) ?? 0), 0);
  const star = (entries) => entries.reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

  return {
    sign: keys.filter((k) => Math.sign(theirValue(k)) === Math.sign(ours.get(k))).length / keys.length,
    r: pearson(keys, (k) => theirValue(k), (k) => ours.get(k)),
    gross: grossOurs / grossTheirs,
    covered: keys.length / strikes.length,
    starMatch: star([...ours.entries()])?.[0] === star(strikes.map((k) => [k, theirValue(k)]).filter(([, v]) => Number.isFinite(v)))?.[0],
  };
}

const frames = Object.keys(lattices).sort();
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : Number.NaN);

console.log("SPX 2026-08-21, scored against the reference lattice on 4 frames.\n");
console.log("carry  half-life   sign    r      gross   strikes   stars");
console.log("-".repeat(60));

const ranked = [];
for (const carryDays of CARRY_DAYS) {
  for (const hours of HALF_LIVES) {
    const scored = frames.map((frame) => scoreFrame(frame, carryDays, hours * HOUR)).filter(Boolean);
    if (scored.length < frames.length) continue;
    const row = {
      carryDays,
      hours,
      sign: mean(scored.map((s) => s.sign)),
      r: mean(scored.map((s) => s.r)),
      gross: mean(scored.map((s) => s.gross)),
      covered: mean(scored.map((s) => s.covered)),
      stars: scored.filter((s) => s.starMatch).length,
      worstSign: Math.min(...scored.map((s) => s.sign)),
    };
    ranked.push(row);
    console.log(
      `${String(carryDays).padStart(3)}d ${String(hours + "h").padStart(8)}`
      + `   ${(row.sign * 100).toFixed(0).padStart(3)}%`
      + `  ${row.r.toFixed(3).padStart(6)}`
      + `  ${row.gross.toFixed(2).padStart(6)}x`
      + `  ${(row.covered * 100).toFixed(0).padStart(6)}%`
      + `   ${row.stars}/${scored.length}`,
    );
  }
  console.log();
}

ranked.sort((a, b) => b.r - a.r);
console.log("Best by mean correlation:");
for (const row of ranked.slice(0, 5)) {
  console.log(
    `  carry ${row.carryDays}d, half-life ${row.hours}h -> r ${row.r.toFixed(3)}, `
    + `sign ${(row.sign * 100).toFixed(0)}% (worst frame ${(row.worstSign * 100).toFixed(0)}%), `
    + `gross ${row.gross.toFixed(2)}x, ${row.stars} star matches`,
  );
}
console.log("\nv1 at matched scope: sign 55%, r 0.141. A setting that wins on the mean");
console.log("but inverts on one frame is noise that happened to line up.");
