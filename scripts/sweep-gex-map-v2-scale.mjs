#!/usr/bin/env node
/**
 * Direction from flow, SIZE from open interest.
 *
 * Decomposing the reference with a correct gamma splits the problem cleanly in
 * two, and the two halves come from different places:
 *
 *   gamma x open interest   signed r -0.03, ABSOLUTE r 0.47
 *   our classified flow     signed r  0.62, absolute r 0.69
 *
 * Open interest knows how big a node is and nothing about which way it points.
 * That is exactly what open interest IS - contracts outstanding, with no record
 * of who is long them. Our flow knows which way, because that is what reading
 * the aggressor gives you, but it only ever sees the sliver of the book that
 * traded in the window we keep, which is why the map came out at a NINTH of the
 * reference's gross.
 *
 * So stop asking either one to do the other's job. This scores models that take
 * the sign from flow and the scale from open interest.
 *
 *   node scripts/sweep-gex-map-v2-scale.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  accumulateDecayedTape,
  emptyDealerInventory,
  revalueDealerGex,
  contractKey,
  contractDollarGamma,
  blackScholesGamma,
  yearsToExpiry,
  DEALER_FLOW_HALF_LIFE_MS,
  DEALER_BOOK_CARRY_SESSIONS,
  priorTradingDates,
} from "../src/lib/gexMapV2.ts";

const ZERO_DTE = "2026-08-21";
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";
const TAPE = fileURLToPath(new URL(`../tmp/opra-open-ascending-SPX-${ZERO_DTE}.json`, import.meta.url));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));
const carriedFile = (s) => fileURLToPath(new URL(`../tmp/opra-ascending-SPX-${s}.json`, import.meta.url));
const CARRIED = priorTradingDates(ZERO_DTE, DEALER_BOOK_CARRY_SESSIONS).filter((s) => existsSync(carriedFile(s)));

if (!existsSync(TAPE) || !existsSync(LATTICE)) {
  console.log("skipped: the reference lattice or the expiry-day tape is not in this working tree.");
  process.exit(0);
}

const capture = JSON.parse(readFileSync(TAPE, "utf8"));
const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));
const openInterest = capture.openInterest?.data ?? {};
const structuralMap = capture.exposure?.data?.[capture.symbol]?.exposureMap?.[ZERO_DTE] ?? {};

const oiAt = (strike, right) => {
  const cell = openInterest[strike.toFixed(1)] ?? openInterest[String(strike)];
  if (!cell) return 0;
  return (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
};
const oiFor = (key) => {
  const [, strikeText, right] = key.split("|");
  return oiAt(Number(strikeText), right);
};
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

const prints = [
  ...CARRIED.flatMap((s) => JSON.parse(readFileSync(carriedFile(s), "utf8")).prints),
  ...capture.prints,
].filter((p) => p.expirationDate?.slice(0, 10) === ZERO_DTE)
  .filter((p) => Number.isFinite(p.tradeTime))
  .sort((a, b) => a.tradeTime - b.tradeTime);

function pearson(keys, f, g) {
  const n = keys.length;
  if (n < 3) return Number.NaN;
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
  return vf && vg ? cov / Math.sqrt(vf * vg) : Number.NaN;
}
const starOf = (map) => [...map.entries()]
  .reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

const frames = Object.keys(lattices).sort();
const built = [];

for (const frameIso of frames) {
  const target = lattices[frameIso].SPXW;
  const cutoff = Date.parse(frameIso);
  const upTo = prints.filter((p) => p.tradeTime <= cutoff);

  const contracts = new Map();
  let spot = target.spot ?? 0;
  for (const p of upTo) {
    const right = p.contractType === "CALL" ? "call" : p.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(p.impliedVolatility) || !Number.isFinite(p.dte)) continue;
    contracts.set(contractKey(ZERO_DTE, p.strikePrice, right), {
      impliedVolatility: p.impliedVolatility,
      expiryMs: p.tradeTime + p.dte * 24 * 60 * 60 * 1_000,
    });
    if (Number.isFinite(p.stockPrice)) spot = p.stockPrice;
  }

  const state = accumulateDecayedTape(
    emptyDealerInventory(ZERO_DTE, upTo[0].tradeTime),
    classifyConsolidatedTape(upTo.map(asTrade)),
    oiFor,
    cutoff,
    DEALER_FLOW_HALF_LIFE_MS,
  );
  const strikes = [...new Set(Object.keys(target.values).map(Number))].sort((a, b) => a - b);
  const frame = revalueDealerGex({
    state, strikes, expirations: [ZERO_DTE], contracts, spot, asOfMs: cutoff, representation: REPRESENTATION,
  });

  const flow = new Map(frame.nodes.map((n) => [n.strike, n.net]));

  /*
   * The scale open interest implies: every contract outstanding at this strike,
   * valued at the gamma it carries right now. Unsigned on purpose - open
   * interest records how many contracts exist, never who is long them.
   */
  const oiScale = new Map();
  const struct = new Map();
  for (const strike of strikes) {
    const surface = contracts.get(contractKey(ZERO_DTE, strike, "call"))
      ?? contracts.get(contractKey(ZERO_DTE, strike, "put"));
    if (surface) {
      const gamma = blackScholesGamma(spot, strike, surface.impliedVolatility, yearsToExpiry(surface.expiryMs, cutoff));
      const perContract = contractDollarGamma(gamma, spot, REPRESENTATION);
      oiScale.set(strike, perContract * (oiAt(strike, "call") + oiAt(strike, "put")));
    }
    const row = structuralMap[strike.toFixed(1)] ?? structuralMap[String(strike)];
    if (row) {
      const call = Number(row.callExposure ?? 0);
      const put = Number(row.putExposure ?? 0);
      if (Number.isFinite(call) && Number.isFinite(put)) struct.set(strike, call + put);
    }
  }
  const theirs = new Map(strikes
    .map((k) => [k, target.values[String(k)] ?? target.values[k]])
    .filter(([, v]) => Number.isFinite(v)));
  built.push({ frameIso, spot, theirs, flow, oiScale, struct });
}

const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
const pct = (v) => `${(v * 100).toFixed(0)}%`;

function score(label, build) {
  const rows = built.map((entry) => {
    const model = build(entry);
    const keys = [...entry.theirs.keys()].filter((k) => model.has(k) && model.get(k) !== 0);
    if (keys.length < 8) return null;
    const agree = (k) => Math.sign(entry.theirs.get(k)) === Math.sign(model.get(k));
    const bySize = [...keys].sort((a, b) => Math.abs(entry.theirs.get(b)) - Math.abs(entry.theirs.get(a)));
    const top = bySize.slice(0, Math.min(10, keys.length));
    const total = keys.reduce((s, k) => s + Math.abs(entry.theirs.get(k)), 0);
    const grossT = [...entry.theirs.keys()].reduce((s, k) => s + Math.abs(entry.theirs.get(k)), 0);
    return {
      all: keys.filter(agree).length / keys.length,
      top: top.filter(agree).length / top.length,
      weighted: keys.reduce((s, k) => s + (agree(k) ? Math.abs(entry.theirs.get(k)) : 0), 0) / total,
      r: pearson(keys, (k) => entry.theirs.get(k), (k) => model.get(k)),
      gross: keys.reduce((s, k) => s + Math.abs(model.get(k)), 0) / grossT,
      covered: keys.length / entry.theirs.size,
      star: starOf(model)?.[0] === starOf(entry.theirs)?.[0],
    };
  }).filter(Boolean);
  if (rows.length < built.length) { console.log(`  ${label.padEnd(34)} not scorable`); return; }
  console.log(
    `  ${label.padEnd(34)} ${pct(mean(rows.map((r) => r.all))).padStart(4)}`
    + ` ${pct(mean(rows.map((r) => r.top))).padStart(6)}`
    + ` ${pct(mean(rows.map((r) => r.weighted))).padStart(9)}`
    + ` ${mean(rows.map((r) => r.r)).toFixed(3).padStart(7)}`
    + ` ${mean(rows.map((r) => r.gross)).toFixed(2).padStart(7)}x`
    + ` ${pct(mean(rows.map((r) => r.covered))).padStart(8)}`
    + `   ${rows.filter((r) => r.star).length}/${rows.length}`,
  );
}

console.log(`SPX ${ZERO_DTE}, ${built.length} reference frames.\n`);
console.log("  model                               all   top10  weighted       r   gross  strikes  stars");
console.log(`  ${"-".repeat(94)}`);

score("flow only (what v2 computes)", (e) => e.flow);
score("gamma x OI, unsigned scale", (e) => e.oiScale);
score("SIGN from flow, SIZE from OI", (e) => new Map(
  [...e.oiScale.keys()]
    .filter((k) => e.flow.has(k))
    .map((k) => [k, Math.sign(e.flow.get(k)) * e.oiScale.get(k)]),
));
score("SIGN from flow, SIZE from OI (+fill)", (e) => new Map(
  [...e.oiScale.keys()].map((k) => [
    k,
    // Where flow has never traded, fall back to the structural surface's sign
    // rather than dropping the strike: open interest still says a node is there.
    (e.flow.has(k) ? Math.sign(e.flow.get(k)) : Math.sign(e.struct.get(k) ?? 0)) * e.oiScale.get(k),
  ]),
));
score("SIGN from structural, SIZE from OI", (e) => new Map(
  [...e.oiScale.keys()]
    .filter((k) => e.struct.has(k))
    .map((k) => [k, Math.sign(e.struct.get(k)) * e.oiScale.get(k)]),
));

console.log("\n  Gross of 1.00x means the map is the size the reference draws.");
console.log("  Flow alone measured 0.11x live - a ninth of it.");
