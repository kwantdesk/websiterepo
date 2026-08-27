#!/usr/bin/env node
/**
 * What decides the SIGN of a node?
 *
 * With the contract's own gamma in place, magnitude is no longer the open
 * question - the carry sweep showed prior-session flow lands on the right
 * strikes and supplies the missing size, while making the signs worse. So the
 * remaining disagreement is about direction, and direction comes from exactly
 * one place: which prints are counted as customer buying, and how heavily.
 *
 * An earlier sweep of aggressor rules scored 50-54% and was taken as evidence
 * that the rules do not matter. That measurement was made when the call and the
 * put side of a strike were valued at gammas that disagreed by up to 4,339x, so
 * the NET at every strike where the two sides oppose was decided by the
 * mis-weighting rather than by the rule. The rules deserve one honest re-run.
 *
 * Every variant reuses the shipped classifier and only overrides what it is
 * testing, so a winner here is a change to production, not to a private copy.
 *
 *   node scripts/sweep-gex-map-v2-sign.mjs
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
const captures = new Map(SESSIONS.map((s) => [s, JSON.parse(readFileSync(file(s), "utf8"))]));
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

const allPrints = SESSIONS.flatMap((session) => captures.get(session).prints
  .filter((print) => print.expirationDate?.slice(0, 10) === ZERO_DTE)
  .filter((print) => Number.isFinite(print.tradeTime))
  .map((print) => ({ ...print, session })))
  .sort((left, right) => left.tradeTime - right.tradeTime);

/**
 * Variants. Each takes (classifiedTrade, rawPrint) and returns the trade to
 * use, or null to drop it. `null` from the shipped classifier is never revived.
 */
const flat = (trade) => ({
  ...trade,
  dealerCounterpartyProbability: 1,
  economicTradeWeight: 1,
  complexLegWeight: 1,
  quoteConfidence: 1,
});

const VARIANTS = [
  { name: "shipped", apply: (trade) => trade },
  { name: "flat weights", apply: flat },
  {
    name: "aggressive only",
    apply: (trade, print) => (print.tradeSideCode === "ABOVE_ASK" || print.tradeSideCode === "BELOW_BID"
      ? flat(trade)
      : null),
  },
  {
    name: "at-quote only",
    apply: (trade, print) => (print.tradeSideCode === "ASK" || print.tradeSideCode === "BID"
      ? flat(trade)
      : null),
  },
  {
    name: "sweeps + blocks",
    apply: (trade, print) => (print.tradeConsolidationType === "SWEEP" || print.tradeConsolidationType === "BLOCK"
      ? flat(trade)
      : null),
  },
  {
    name: "single-leg only",
    // A leg of a spread has a partner that offsets much of the gamma it looks
    // like it adds. This drops them outright rather than down-weighting them.
    apply: (trade, print) => (String(print.tradeType ?? "").startsWith("MULTI") ? null : flat(trade)),
  },
  {
    name: "put sign flipped",
    // Falsification test, not a candidate: if the provider's put convention had
    // been carried into the state, flipping it back would score BETTER.
    apply: (trade) => (trade.right === "put" ? { ...flat(trade), dealerSign: -trade.dealerSign } : flat(trade)),
  },
  {
    name: "opening prints only",
    apply: (trade, print) => (print.isOpeningPosition ? flat(trade) : null),
  },
  {
    name: "drop MULTI+M2S",
    // M2S is a multi-leg order crossed to single-leg reports; the shipped set
    // catches M2S_AUTO but not M2S_FLR, which is 280 prints and 136k contracts
    // in this expiry alone.
    apply: (trade, print) => {
      const type = String(print.tradeType ?? "").toUpperCase();
      return type.startsWith("MULTI") || type.startsWith("M2S") ? null : flat(trade);
    },
  },
  {
    name: "+ drop CANCEL",
    // A cancel is the removal of a print, not a position. Counting it as one
    // adds inventory that never existed.
    apply: (trade, print) => {
      const type = String(print.tradeType ?? "").toUpperCase();
      if (type.startsWith("MULTI") || type.startsWith("M2S") || type.startsWith("CANCEL")) return null;
      return flat(trade);
    },
  },
  {
    name: "+ keep weights",
    apply: (trade, print) => {
      const type = String(print.tradeType ?? "").toUpperCase();
      if (type.startsWith("MULTI") || type.startsWith("M2S") || type.startsWith("CANCEL")) return null;
      return trade;
    },
  },
  {
    name: "size >= 25",
    // Retail one-lots do not move a dealer book; institutional size does.
    apply: (trade, print) => (print.size >= 25 ? flat(trade) : null),
  },
];

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

const star = (entries) => entries.reduce(
  (best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best),
  null,
);

function scoreFrame(frameIso, variant, carryDays, halfLifeMs) {
  const target = lattices[frameIso]?.SPXW;
  if (!target) return null;
  const cutoff = Date.parse(frameIso);
  const earliest = SESSIONS[SESSIONS.length - 1 - carryDays];
  const prints = allPrints.filter((print) => print.tradeTime <= cutoff && print.session >= earliest);
  if (prints.length < 8) return null;

  const gammaByContract = new Map();
  let spot = target.spot ?? 0;
  for (const print of prints) {
    const right = print.contractType === "CALL" ? "call" : print.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(print.greeks?.gamma)) continue;
    gammaByContract.set(contractKey(ZERO_DTE, print.strikePrice, right), Math.abs(print.greeks.gamma));
    if (print.session === ZERO_DTE && Number.isFinite(print.stockPrice)) spot = print.stockPrice;
  }

  // classifyConsolidatedTape de-duplicates parent/child records, so the variant
  // is applied to its OUTPUT rather than to the raw tape - dropping a record
  // before de-duplication would change which duplicate survives.
  const classified = [];
  const raw = prints;
  const perRaw = raw.map((print) => classifyConsolidatedTape([asTrade(print)])[0] ?? null);
  for (let index = 0; index < raw.length; index += 1) {
    const base = perRaw[index];
    if (!base) continue;
    const next = variant.apply(base, raw[index]);
    if (next) classified.push(next);
  }
  if (classified.length < 8) return null;

  const state = accumulateDecayedTape(
    emptyDealerInventory(ZERO_DTE, classified[0].tradeTimeMs),
    classified,
    oiFor,
    cutoff,
    halfLifeMs,
  );

  const strikes = [...new Set(Object.keys(target.values).map(Number))].sort((a, b) => a - b);
  const frame = revalueDealerGex({
    state, strikes, expirations: [ZERO_DTE], gammaByContract, spot, representation: REPRESENTATION,
  });

  const theirValue = (strike) => target.values[String(strike)] ?? target.values[strike];
  const ours = new Map(frame.nodes.map((node) => [node.strike, node.net]));
  const keys = [...ours.keys()].filter((strike) => Number.isFinite(theirValue(strike)));
  if (keys.length < 8) return null;

  return {
    sign: keys.filter((k) => Math.sign(theirValue(k)) === Math.sign(ours.get(k))).length / keys.length,
    r: pearson(keys, (k) => theirValue(k), (k) => ours.get(k)),
    gross: keys.reduce((s, k) => s + Math.abs(ours.get(k)), 0)
      / strikes.reduce((s, k) => s + Math.abs(theirValue(k) ?? 0), 0),
    covered: keys.length / strikes.length,
    starMatch: star([...ours.entries()])?.[0]
      === star(strikes.map((k) => [k, theirValue(k)]).filter(([, v]) => Number.isFinite(v)))?.[0],
    trades: classified.length,
  };
}

const frames = Object.keys(lattices).sort();
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : Number.NaN);

const GRID = process.argv.includes("--grid")
  ? [1, 2, 3].flatMap((carry) => [6, 12, 24].map((hours) => [carry, hours]))
  : [[0, 24], [0, 6], [2, 6]];
const ONLY = process.argv.includes("--grid")
  ? ["shipped", "single-leg only", "drop MULTI+M2S", "+ drop CANCEL", "+ keep weights"]
  : null;

for (const [carryDays, hours] of GRID) {
  console.log(`\ncarry ${carryDays}d, half-life ${hours}h`);
  console.log("  variant             trades   sign     r     gross   strikes  stars");
  console.log("  " + "-".repeat(66));
  const ranked = [];
  for (const variant of VARIANTS) {
    if (ONLY && !ONLY.includes(variant.name)) continue;
    const scored = frames.map((frame) => scoreFrame(frame, variant, carryDays, hours * HOUR)).filter(Boolean);
    if (scored.length < frames.length) {
      console.log(`  ${variant.name.padEnd(20)} too few trades to score`);
      continue;
    }
    const row = {
      name: variant.name,
      sign: mean(scored.map((s) => s.sign)),
      r: mean(scored.map((s) => s.r)),
      gross: mean(scored.map((s) => s.gross)),
      covered: mean(scored.map((s) => s.covered)),
      stars: scored.filter((s) => s.starMatch).length,
      trades: Math.round(mean(scored.map((s) => s.trades))),
      worstSign: Math.min(...scored.map((s) => s.sign)),
    };
    ranked.push(row);
    console.log(
      `  ${row.name.padEnd(20)}${String(row.trades).padStart(5)}`
      + `   ${(row.sign * 100).toFixed(0).padStart(3)}%`
      + `  ${row.r.toFixed(3).padStart(6)}`
      + `  ${row.gross.toFixed(2).padStart(6)}x`
      + `  ${(row.covered * 100).toFixed(0).padStart(6)}%`
      + `   ${row.stars}/${scored.length}`,
    );
  }
  ranked.sort((a, b) => b.sign - a.sign);
  const best = ranked[0];
  if (best) {
    console.log(
      `  best sign: ${best.name} at ${(best.sign * 100).toFixed(0)}% `
      + `(worst frame ${(best.worstSign * 100).toFixed(0)}%), r ${best.r.toFixed(3)}`,
    );
  }
}

console.log("\nv1 at matched scope: sign 55%, r 0.141.");
