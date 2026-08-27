#!/usr/bin/env node
/**
 * What is the reference actually made of?
 *
 * Parameter tuning has run out: carry depth, half-life and the OI bound all sit
 * on a plateau around 80% weighted agreement, and the bound never binds at all.
 * A different constant will not get to 90%; a missing TERM might.
 *
 * Our book is pure flow. The reference is roughly five times larger and covers
 * strikes we have never seen a print at, so it is either built from far more
 * flow than we count, or it is not pure flow. This asks which, by correlating
 * the reference against each candidate component separately:
 *
 *   structural   the provider's own exposure per strike (open interest based)
 *   openInterest gamma x OI, the textbook dealer-positioning proxy
 *   flow         our classified, decayed dealer inventory
 *
 * A term the reference is built from will correlate with it. One it is not will
 * not - and knowing which is which is the difference between adding the right
 * term and fitting noise.
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
  DEALER_FLOW_HALF_LIFE_MS,
  DEALER_BOOK_CARRY_SESSIONS,
  priorTradingDates,
} from "../src/lib/gexMapV2.ts";

const ZERO_DTE = "2026-08-21";
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";
const TAPE = fileURLToPath(new URL(`../tmp/opra-open-ascending-SPX-${ZERO_DTE}.json`, import.meta.url));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));
const carriedFile = (s) => fileURLToPath(new URL(`../tmp/opra-ascending-SPX-${s}.json`, import.meta.url));
const CARRIED = priorTradingDates(ZERO_DTE, DEALER_BOOK_CARRY_SESSIONS)
  .filter((s) => existsSync(carriedFile(s)));

if (!existsSync(TAPE) || !existsSync(LATTICE)) {
  console.log("skipped: the reference lattice or the expiry-day tape is not in this working tree.");
  process.exit(0);
}

const capture = JSON.parse(readFileSync(TAPE, "utf8"));
const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));
const openInterest = capture.openInterest?.data ?? {};
/*
 * The provider nests its exposure map under ticker and expiration. Reaching for
 * `.data` alone silently produced an empty map and NaN correlations - a shape
 * mismatch that looked exactly like "no relationship".
 */
const structural = capture.exposure?.data?.[capture.symbol]?.exposureMap?.[ZERO_DTE] ?? {};

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
  if (keys.length < 3) return Number.NaN;
  const mf = keys.reduce((s, k) => s + f(k), 0) / keys.length;
  const mg = keys.reduce((s, k) => s + g(k), 0) / keys.length;
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

const frames = Object.keys(lattices).sort();
console.log(`SPX ${ZERO_DTE}. Correlating the reference against each candidate component.\n`);
console.log("frame   n  |  flow    structural   gamma*OI  |  |flow|  |structural|  |gamma*OI|");
console.log("-".repeat(80));

const totals = { flow: [], structural: [], oi: [], aFlow: [], aStructural: [], aOi: [] };

for (const frameIso of frames) {
  const target = lattices[frameIso].SPXW;
  const cutoff = Date.parse(frameIso);
  const upTo = prints.filter((p) => p.tradeTime <= cutoff);

  const gammaByContract = new Map();
  let spot = target.spot ?? 0;
  for (const p of upTo) {
    const right = p.contractType === "CALL" ? "call" : p.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(p.greeks?.gamma)) continue;
    gammaByContract.set(contractKey(ZERO_DTE, p.strikePrice, right), Math.abs(p.greeks.gamma));
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
    state, strikes, expirations: [ZERO_DTE], gammaByContract, spot, representation: REPRESENTATION,
  });

  const flow = new Map(frame.nodes.map((n) => [n.strike, n.net]));
  const theirs = new Map(strikes
    .map((k) => [k, target.values[String(k)] ?? target.values[k]])
    .filter(([, v]) => Number.isFinite(v)));

  /*
   * gamma x open interest, signed by the textbook convention: customers are
   * assumed long calls and long puts, so the dealer is short both. It is the
   * assumption v2 exists to avoid making - which is exactly why it is worth
   * testing whether the reference is built on it.
   */
  const gammaOi = new Map();
  const structuralValue = new Map();
  for (const strike of strikes) {
    const call = gammaByContract.get(contractKey(ZERO_DTE, strike, "call"));
    const put = gammaByContract.get(contractKey(ZERO_DTE, strike, "put"));
    const gamma = call ?? put;
    if (gamma !== undefined) {
      const perContract = contractDollarGamma(gamma, spot, REPRESENTATION);
      gammaOi.set(strike, perContract * (oiAt(strike, "call") - oiAt(strike, "put")));
    }
    const row = structural[strike.toFixed(1)] ?? structural[String(strike)];
    if (row) {
      const callExposure = Number(row.callExposure ?? row.call ?? 0);
      const putExposure = Number(row.putExposure ?? row.put ?? 0);
      if (Number.isFinite(callExposure) && Number.isFinite(putExposure)) {
        structuralValue.set(strike, callExposure + putExposure);
      }
    }
  }

  const keys = [...theirs.keys()].filter((k) => flow.has(k) && gammaOi.has(k) && structuralValue.has(k));
  if (keys.length < 8) {
    console.log(`  ${frameIso.slice(11, 16)}  too few shared strikes (${keys.length})`);
    continue;
  }
  const t = (k) => theirs.get(k);
  const r = {
    flow: pearson(keys, t, (k) => flow.get(k)),
    structural: pearson(keys, t, (k) => structuralValue.get(k)),
    oi: pearson(keys, t, (k) => gammaOi.get(k)),
    aFlow: pearson(keys, (k) => Math.abs(t(k)), (k) => Math.abs(flow.get(k))),
    aStructural: pearson(keys, (k) => Math.abs(t(k)), (k) => Math.abs(structuralValue.get(k))),
    aOi: pearson(keys, (k) => Math.abs(t(k)), (k) => Math.abs(gammaOi.get(k))),
  };
  for (const name of Object.keys(totals)) totals[name].push(r[name]);
  console.log(
    `${frameIso.slice(11, 16)} ${String(keys.length).padStart(3)}  |`
    + ` ${r.flow.toFixed(3).padStart(6)}`
    + ` ${r.structural.toFixed(3).padStart(11)}`
    + ` ${r.oi.toFixed(3).padStart(10)}  |`
    + ` ${r.aFlow.toFixed(3).padStart(6)}`
    + ` ${r.aStructural.toFixed(3).padStart(12)}`
    + ` ${r.aOi.toFixed(3).padStart(10)}`,
  );
}

const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
console.log(
  `\nmean      |`
  + ` ${mean(totals.flow).toFixed(3).padStart(6)}`
  + ` ${mean(totals.structural).toFixed(3).padStart(11)}`
  + ` ${mean(totals.oi).toFixed(3).padStart(10)}  |`
  + ` ${mean(totals.aFlow).toFixed(3).padStart(6)}`
  + ` ${mean(totals.aStructural).toFixed(3).padStart(12)}`
  + ` ${mean(totals.aOi).toFixed(3).padStart(10)}`,
);
console.log(
  "\nSIGNED correlation says whether a term drives the DIRECTION of a node."
  + "\nABSOLUTE correlation says whether it drives its SIZE. A term that predicts"
  + "\nsize but not direction is a scale the reference uses and we do not.",
);
