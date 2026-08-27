#!/usr/bin/env node
/**
 * WHERE is the model wrong, not just how often.
 *
 * Sign agreement counts every strike equally, so a node worth eleven dollars
 * votes as loudly as the Star. That is not the question the desk asks. What
 * matters is whether the nodes a trader would act on - the biggest ones, the
 * ones near spot - point the same way as the reference.
 *
 * This measures the same book several ways so the remaining error can be
 * located rather than merely counted.
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

const ZERO_DTE = "2026-08-21";
const REPRESENTATION = "PER_ONE_DOLLAR_MOVE";
const TAPE = fileURLToPath(new URL(`../tmp/opra-open-ascending-SPX-${ZERO_DTE}.json`, import.meta.url));
const LATTICE = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));
const carriedFile = (s) => fileURLToPath(new URL(`../tmp/opra-ascending-SPX-${s}.json`, import.meta.url));
const CARRIED = priorTradingDates(ZERO_DTE, DEALER_BOOK_CARRY_SESSIONS);

for (const path of [TAPE, LATTICE, ...CARRIED.map(carriedFile)]) {
  if (!existsSync(path)) {
    console.log(`skipped: ${path} is not in this working tree.`);
    process.exit(0);
  }
}

const capture = JSON.parse(readFileSync(TAPE, "utf8"));
const lattices = JSON.parse(readFileSync(LATTICE, "utf8"));
const openInterest = capture.openInterest?.data ?? {};
const structuralExposure = capture.exposure?.data?.[capture.symbol]?.exposureMap?.[ZERO_DTE] ?? {};
const structuralRows = Object.entries(structuralExposure)
  .map(([strikeText, row]) => {
    const call = Number(row?.callExposure ?? 0);
    const put = Number(row?.putExposure ?? 0);
    return { strike: Number(strikeText), call, put, net: call + put };
  })
  .filter((row) => Number.isFinite(row.strike) && Number.isFinite(row.net));
const oiFor = (key) => {
  const [, strikeText, right] = key.split("|");
  const cell = openInterest[Number(strikeText).toFixed(1)] ?? openInterest[strikeText];
  if (!cell) return 0;
  return (right === "call" ? cell.callOpenInterest : cell.putOpenInterest) || 0;
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

function buildFrame(frameIso) {
  const target = lattices[frameIso]?.SPXW;
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
  // The shipped composition, so this measures what the panel draws.
  const ours = new Map(blendDealerNodes(
    frame.nodes.map((n) => ({ strike: n.strike, call: n.callNet, put: n.putNet, net: n.net })),
    structuralRows,
    DEALER_FLOW_SHARE,
  ).map((n) => [n.strike, n.net]));
  const theirs = new Map(strikes
    .map((k) => [k, target.values[String(k)] ?? target.values[k]])
    .filter(([, v]) => Number.isFinite(v)));
  return { spot, ours, theirs };
}

const starOf = (map) => [...map.entries()]
  .reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

const frames = Object.keys(lattices).sort();
const rows = [];

console.log(`SPX ${ZERO_DTE}, ${frames.length} reference frames.\n`);
console.log("Sign agreement, sliced by what the node is worth TO THEM:");
console.log("  frame          shared   all   top20%   top10   weighted    star");
console.log(`  ${"-".repeat(66)}`);

for (const frameIso of frames) {
  const { spot, ours, theirs } = buildFrame(frameIso);
  const shared = [...theirs.keys()].filter((k) => ours.has(k));
  if (shared.length < 8) continue;
  const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(ours.get(k));
  const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));

  const all = shared.filter(agree).length / shared.length;
  const topFifth = bySize.slice(0, Math.max(3, Math.round(shared.length * 0.2)));
  const topTen = bySize.slice(0, Math.min(10, shared.length));
  // Weighted by THEIR magnitude: the Star counts for more than an
  // eleven-dollar node, which is how a trader reads the map.
  const total = shared.reduce((sum, k) => sum + Math.abs(theirs.get(k)), 0);
  const weighted = shared.reduce((sum, k) => sum + (agree(k) ? Math.abs(theirs.get(k)) : 0), 0) / total;

  const ourStar = starOf(ours)?.[0];
  const theirStar = starOf(theirs)?.[0];
  const row = {
    all,
    topFifth: topFifth.filter(agree).length / topFifth.length,
    topTen: topTen.filter(agree).length / topTen.length,
    weighted,
  };
  rows.push(row);
  console.log(
    `  ${frameIso.slice(11, 16)} spot ${spot.toFixed(0)}  ${String(shared.length).padStart(4)}`
    + `  ${(all * 100).toFixed(0).padStart(4)}%`
    + `  ${(row.topFifth * 100).toFixed(0).padStart(5)}%`
    + `  ${(row.topTen * 100).toFixed(0).padStart(5)}%`
    + `  ${(weighted * 100).toFixed(0).padStart(7)}%`
    + `    ${ourStar} vs ${theirStar}${ourStar === theirStar ? " MATCH" : ""}`,
  );
}

const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
console.log(
  `\n  mean                  ${(mean((r) => r.all) * 100).toFixed(0)}%`
  + `  ${(mean((r) => r.topFifth) * 100).toFixed(0)}%`.padStart(8)
  + `  ${(mean((r) => r.topTen) * 100).toFixed(0)}%`.padStart(8)
  + `  ${(mean((r) => r.weighted) * 100).toFixed(0)}%`.padStart(10),
);

console.log("\nHow big are the strikes we get wrong?");
for (const frameIso of frames) {
  const { ours, theirs, spot } = buildFrame(frameIso);
  const shared = [...theirs.keys()].filter((k) => ours.has(k));
  const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(ours.get(k));
  const wrong = shared.filter((k) => !agree(k));
  const right = shared.filter(agree);
  const scale = Math.max(...shared.map((k) => Math.abs(theirs.get(k))));
  const share = (keys) => (keys.length
    ? `${(keys.reduce((s, k) => s + Math.abs(theirs.get(k)), 0) / keys.length / scale * 100).toFixed(1)}%`
    : "-");
  const near = (k) => Math.abs(k - spot) <= 25;
  console.log(
    `  ${frameIso.slice(11, 16)}  wrong ${String(wrong.length).padStart(3)}/${shared.length}`
    + `   mean size of a node we get right ${share(right).padStart(6)} of Star`
    + `,  wrong ${share(wrong).padStart(6)}`
    + `   |  within 25pt ${shared.filter(near).filter(agree).length}/${shared.filter(near).length}`
    + `,  beyond ${shared.filter((k) => !near(k)).filter(agree).length}/${shared.filter((k) => !near(k)).length}`,
  );
}
