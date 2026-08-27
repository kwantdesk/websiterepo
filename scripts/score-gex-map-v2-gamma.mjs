#!/usr/bin/env node
/**
 * Score the SHIPPED v2 engine against the reference lattice.
 *
 * This deliberately imports the production functions rather than
 * re-implementing them. Every earlier sweep scored a private copy of the model,
 * so a result never proved what the panel would actually draw.
 *
 * The engine is replayed to each lattice minute: only prints at or before that
 * minute exist, the book is aged to it, and every contract is valued at the
 * gamma its own most recent print carried at that minute. That is the same
 * arithmetic getDealerInventoryPanel runs, with the clock moved back.
 *
 *   node scripts/score-gex-map-v2-gamma.mjs
 *
 * Inputs (both already in the tree):
 *   tmp/opra-open-ascending-SPX-2026-08-21.json   full-session tape with greeks
 *   scripts/trinity-extra-lattices-2026-08-21.json  reference nodes per minute
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  accumulateDecayedTape,
  emptyDealerInventory,
  revalueDealerGex,
  contractKey,
  blendDealerNodes,
  DEALER_FLOW_SHARE,
  priorTradingDates,
  DEALER_FLOW_HALF_LIFE_MS,
  DEALER_BOOK_CARRY_SESSIONS,
} from "../src/lib/gexMapV2.ts";

const TAPE = fileURLToPath(new URL("../tmp/opra-open-ascending-SPX-2026-08-21.json", import.meta.url));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));
const carriedFile = (session) => fileURLToPath(
  new URL(`../tmp/opra-ascending-SPX-${session}.json`, import.meta.url),
);
const CARRIED = priorTradingDates("2026-08-21", DEALER_BOOK_CARRY_SESSIONS);

for (const path of [TAPE, LATTICE, ...CARRIED.map(carriedFile)]) {
  if (!existsSync(path)) {
    console.log(`skipped: ${path} is not in this working tree.`);
    process.exit(0);
  }
}

const capture = JSON.parse(readFileSync(TAPE, "utf8"));
const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));

const ZERO_DTE = "2026-08-21";
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";

const openInterest = capture.openInterest?.data ?? {};
const structuralExposure = capture.exposure?.data?.[capture.symbol]?.exposureMap?.[ZERO_DTE] ?? {};
const oiFor = (key) => {
  const [, strikeText, right] = key.split("|");
  const cell = openInterest[Number(strikeText).toFixed(1)] ?? openInterest[strikeText];
  if (!cell) return 0;
  return (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
};

/** The provider's field names, mapped to the classifier's inputs. */
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

/** Share of total gross magnitude sitting within `band` points of spot. */
function concentration(entries, spot, band) {
  let inside = 0;
  let total = 0;
  for (const [strike, value] of entries) {
    total += Math.abs(value);
    if (Math.abs(strike - spot) <= band) inside += Math.abs(value);
  }
  return total > 0 ? inside / total : Number.NaN;
}

const starOf = (entries) => entries.reduce(
  (best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best),
  null,
);

// The shipped configuration: today's tape plus DEALER_BOOK_CARRY_SESSIONS of
// prior flow in the SAME contracts, folded into one time order.
const prints = [
  ...CARRIED.flatMap((session) => JSON.parse(readFileSync(carriedFile(session), "utf8")).prints),
  ...capture.prints,
]
  .filter((print) => print.expirationDate?.slice(0, 10) === ZERO_DTE)
  .filter((print) => Number.isFinite(print.tradeTime))
  .sort((left, right) => left.tradeTime - right.tradeTime);

console.log(
  `SPX ${ZERO_DTE} - ${prints.length} prints in the 0DTE contracts across `
  + `${CARRIED.length + 1} sessions, every one carrying its own gamma.`,
);
console.log(`half-life ${DEALER_FLOW_HALF_LIFE_MS / 3_600_000}h, carrying ${CARRIED.join(", ")}`);


const frames = Object.keys(lattices).sort();
const summary = [];

for (const frameIso of frames) {
  const target = lattices[frameIso]?.SPXW;
  if (!target) continue;
  const cutoff = Date.parse(frameIso);
  const upTo = prints.filter((print) => print.tradeTime <= cutoff);
  if (!upTo.length) continue;

  // Each contract at the gamma its OWN most recent print carried by this
  // minute. Prints are in time order, so the last write wins.
  const contracts = new Map();
  let spot = target.spot ?? 0;
  for (const print of upTo) {
    const right = print.contractType === "CALL" ? "call" : print.contractType === "PUT" ? "put" : null;
    if (!right || !Number.isFinite(print.impliedVolatility) || !Number.isFinite(print.dte)) continue;
    contracts.set(contractKey(ZERO_DTE, print.strikePrice, right), {
      impliedVolatility: print.impliedVolatility,
      expiryMs: print.tradeTime + print.dte * 24 * 60 * 60 * 1_000,
    });
    if (Number.isFinite(print.stockPrice)) spot = print.stockPrice;
  }

  const classified = classifyConsolidatedTape(upTo.map(asTrade));
  const state = accumulateDecayedTape(
    emptyDealerInventory(ZERO_DTE, upTo[0].tradeTime),
    classified,
    oiFor,
    cutoff,
    DEALER_FLOW_HALF_LIFE_MS,
  );

  const strikes = [...new Set(Object.keys(target.values).map(Number))].sort((a, b) => a - b);
  const frame = revalueDealerGex({
    state,
    strikes,
    expirations: [ZERO_DTE],
    contracts,
    spot,
    // Gamma is computed at THIS minute, not at the close.
    asOfMs: cutoff,
    representation: REPRESENTATION,
  });

  /*
   * The shipped composition, not the flow book alone: four fifths measured
   * flow, one fifth the provider's structural surface. Scoring the raw flow
   * here would score something the panel does not draw.
   */
  const structuralRows = Object.entries(structuralExposure)
    .map(([strikeText, row]) => {
      const call = Number(row?.callExposure ?? 0);
      const put = Number(row?.putExposure ?? 0);
      return { strike: Number(strikeText), call, put, net: call + put };
    })
    .filter((row) => Number.isFinite(row.strike) && Number.isFinite(row.net));
  const ours = blendDealerNodes(
    frame.nodes.map((node) => ({
      strike: node.strike, call: node.callNet, put: node.putNet, net: node.net,
    })),
    structuralRows,
    DEALER_FLOW_SHARE,
  ).map((node) => [node.strike, node.net]);
  const theirs = strikes.map((strike) => [strike, target.values[String(strike)] ?? target.values[strike]]);
  const shared = ours.filter(([strike]) => Number.isFinite(
    target.values[String(strike)] ?? target.values[strike],
  ));
  if (shared.length < 8) continue;

  const theirValue = (strike) => target.values[String(strike)] ?? target.values[strike];
  const keys = shared.map(([strike]) => strike);
  const oursAt = new Map(ours);

  const signMatch = keys.filter((k) => Math.sign(theirValue(k)) === Math.sign(oursAt.get(k))).length / keys.length;
  const r = pearson(keys, (k) => theirValue(k), (k) => oursAt.get(k));
  const grossOurs = shared.reduce((s, [, v]) => s + Math.abs(v), 0);
  const grossTheirs = keys.reduce((s, k) => s + Math.abs(theirValue(k)), 0);
  const covered = keys.length / strikes.length;
  const ourStar = starOf(shared);
  const theirStar = starOf(theirs.filter(([, v]) => Number.isFinite(v)));

  summary.push({ frameIso, signMatch, r, keys: keys.length });
  console.log(`${frameIso}   spot ${spot.toFixed(2)}   ${keys.length} shared strikes`);
  console.log(`  sign agreement   ${(signMatch * 100).toFixed(0)}%`);
  console.log(`  correlation r    ${r.toFixed(3)}`);
  console.log(`  gross ratio      ${(grossOurs / grossTheirs).toFixed(2)}x  (ours / theirs)`);
  console.log(`  strike coverage  ${(covered * 100).toFixed(0)}% of the reference ladder`);
  console.log(`  star  ours ${ourStar?.[0]}   theirs ${theirStar?.[0]}   ${ourStar?.[0] === theirStar?.[0] ? "MATCH" : "differ"}`);
  console.log(
    `  ATM concentration (±25pt)  ours ${(concentration(shared, spot, 25) * 100).toFixed(0)}%`
    + `   theirs ${(concentration(theirs.filter(([, v]) => Number.isFinite(v)), spot, 25) * 100).toFixed(0)}%`,
  );
  console.log(`  book: ${classified.length} classified prints, status ${frame.status}\n`);
}

if (summary.length) {
  const mean = (f) => summary.reduce((s, row) => s + f(row), 0) / summary.length;
  console.log(
    `mean over ${summary.length} frames:  sign ${(mean((s) => s.signMatch) * 100).toFixed(0)}%`
    + `   r ${mean((s) => s.r).toFixed(3)}`,
  );
  console.log("\nv1 at matched scope measured sign 55%, r 0.141. A model is only");
  console.log("worth shipping if it beats that on the MEAN and holds its sign on the");
  console.log("worst frame - one frame that lines up is noise.");
}
