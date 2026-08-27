#!/usr/bin/env node
/**
 * Two signals, both about 0.6 against the reference. How much do they overlap?
 *
 * Decomposing the reference found our flow book at r=0.597 and the provider's
 * own structural exposure at r=0.566, while gamma x open interest - the
 * textbook dealer proxy - came in at r=-0.04 and can be discarded outright.
 *
 * Two predictors of similar strength are worth combining only to the extent
 * they disagree. If flow and structural are the same signal wearing two hats,
 * blending them adds nothing; if they are close to independent, the blend
 * should beat both by a wide margin. That is measurable rather than arguable,
 * so this measures it before anything is shipped.
 *
 * Both are scaled to unit gross before blending. They arrive in different units
 * - one is contracts x dollar gamma, the other the provider's own exposure
 * figure - and an unscaled sum is just whichever number happens to be bigger.
 *
 *   node scripts/sweep-gex-map-v2-blend.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  accumulateDecayedTape,
  emptyDealerInventory,
  revalueDealerGex,
  contractKey,
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
const structural = capture.exposure?.data?.[capture.symbol]?.exposureMap?.[ZERO_DTE] ?? {};

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

const starOf = (map) => [...map.entries()]
  .reduce((best, row) => (best === null || Math.abs(row[1]) > Math.abs(best[1]) ? row : best), null);

/** Unit gross, so a blend weight means what it says. */
function normalised(map, keys) {
  const gross = keys.reduce((s, k) => s + Math.abs(map.get(k) ?? 0), 0);
  const scale = gross > 0 ? 1 / gross : 0;
  return new Map(keys.map((k) => [k, (map.get(k) ?? 0) * scale]));
}

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
  const struct = new Map();
  for (const strike of strikes) {
    const row = structural[strike.toFixed(1)] ?? structural[String(strike)];
    if (!row) continue;
    const call = Number(row.callExposure ?? 0);
    const put = Number(row.putExposure ?? 0);
    if (Number.isFinite(call) && Number.isFinite(put)) struct.set(strike, call + put);
  }
  const theirs = new Map(strikes
    .map((k) => [k, target.values[String(k)] ?? target.values[k]])
    .filter(([, v]) => Number.isFinite(v)));

  /*
   * The union of the two, not the intersection.
   *
   * Structural covers every listed strike; flow covers only the ones that have
   * traded. Scoring on the overlap alone would hide the blend's biggest
   * advantage - that it has an opinion where flow has none.
   */
  const keys = [...theirs.keys()].filter((k) => flow.has(k) || struct.has(k));
  built.push({ frameIso, spot, keys, theirs, flow, struct });
}

console.log(`SPX ${ZERO_DTE}, ${built.length} reference frames.\n`);
console.log("How much do the two signals overlap?");
for (const { frameIso, keys, flow, struct } of built) {
  const both = keys.filter((k) => flow.has(k) && struct.has(k));
  console.log(
    `  ${frameIso.slice(11, 16)}  flow vs structural r = ${pearson(both, (k) => flow.get(k), (k) => struct.get(k)).toFixed(3)}`
    + `   (flow has ${flow.size} strikes, structural ${struct.size}, union ${keys.length})`,
  );
}

console.log("\nBlend: alpha x flow + (1 - alpha) x structural, both at unit gross.");
console.log("alpha |    r     all   top10  weighted  strikes  stars");
console.log("-".repeat(56));

const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;
const results = [];

for (let step = 0; step <= 10; step += 1) {
  const alpha = step / 10;
  const perFrame = built.map(({ keys, theirs, flow, struct }) => {
    const nFlow = normalised(flow, keys);
    const nStruct = normalised(struct, keys);
    const blended = new Map(keys.map((k) => [
      k,
      alpha * (nFlow.get(k) ?? 0) + (1 - alpha) * (nStruct.get(k) ?? 0),
    ]));
    const shared = keys.filter((k) => theirs.has(k) && blended.get(k) !== 0);
    if (shared.length < 8) return null;
    const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(blended.get(k));
    const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));
    const topTen = bySize.slice(0, Math.min(10, shared.length));
    const total = shared.reduce((s, k) => s + Math.abs(theirs.get(k)), 0);
    return {
      r: pearson(shared, (k) => theirs.get(k), (k) => blended.get(k)),
      all: shared.filter(agree).length / shared.length,
      topTen: topTen.filter(agree).length / topTen.length,
      weighted: shared.reduce((s, k) => s + (agree(k) ? Math.abs(theirs.get(k)) : 0), 0) / total,
      covered: shared.length / theirs.size,
      starMatch: starOf(blended)?.[0] === starOf(theirs)?.[0],
    };
  }).filter(Boolean);
  if (perFrame.length < built.length) continue;
  const row = {
    alpha,
    r: mean(perFrame.map((s) => s.r)),
    all: mean(perFrame.map((s) => s.all)),
    topTen: mean(perFrame.map((s) => s.topTen)),
    weighted: mean(perFrame.map((s) => s.weighted)),
    covered: mean(perFrame.map((s) => s.covered)),
    stars: perFrame.filter((s) => s.starMatch).length,
    worstWeighted: Math.min(...perFrame.map((s) => s.weighted)),
  };
  results.push(row);
  const label = alpha === 1 ? " (flow only)" : alpha === 0 ? " (structural only)" : "";
  console.log(
    ` ${alpha.toFixed(1)}  | ${row.r.toFixed(3)}`
    + ` ${(row.all * 100).toFixed(0).padStart(5)}%`
    + ` ${(row.topTen * 100).toFixed(0).padStart(5)}%`
    + ` ${(row.weighted * 100).toFixed(0).padStart(8)}%`
    + ` ${(row.covered * 100).toFixed(0).padStart(7)}%`
    + `   ${row.stars}/${built.length}${label}`,
  );
}

/*
 * Fallback rather than blend.
 *
 * A blend dilutes a real measurement with a vendor estimate at every strike,
 * including the ones where the flow book knows exactly what it holds. The
 * structural surface earns its place only where flow has nothing to say - it
 * covers all 92 strikes where flow reaches 72 - so this uses flow wherever
 * flow exists and structural strictly to fill the holes.
 */
console.log("\nFallback: flow where it exists, structural only where it does not.");
console.log("scale |    r     all   top10  weighted  strikes  stars");
console.log("-".repeat(56));

for (const fill of [0.25, 0.5, 1]) {
  const perFrame = built.map(({ keys, theirs, flow, struct }) => {
    const nFlow = normalised(flow, keys);
    const nStruct = normalised(struct, keys);
    const merged = new Map(keys.map((k) => [
      k,
      flow.has(k) ? nFlow.get(k) ?? 0 : (nStruct.get(k) ?? 0) * fill,
    ]));
    const shared = keys.filter((k) => theirs.has(k) && merged.get(k) !== 0);
    if (shared.length < 8) return null;
    const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(merged.get(k));
    const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));
    const topTen = bySize.slice(0, Math.min(10, shared.length));
    const total = shared.reduce((s, k) => s + Math.abs(theirs.get(k)), 0);
    return {
      r: pearson(shared, (k) => theirs.get(k), (k) => merged.get(k)),
      all: shared.filter(agree).length / shared.length,
      topTen: topTen.filter(agree).length / topTen.length,
      weighted: shared.reduce((s, k) => s + (agree(k) ? Math.abs(theirs.get(k)) : 0), 0) / total,
      covered: shared.length / theirs.size,
      starMatch: starOf(merged)?.[0] === starOf(theirs)?.[0],
    };
  }).filter(Boolean);
  if (perFrame.length < built.length) continue;
  console.log(
    ` ${fill.toFixed(2)}  | ${mean(perFrame.map((s) => s.r)).toFixed(3)}`
    + ` ${(mean(perFrame.map((s) => s.all)) * 100).toFixed(0).padStart(5)}%`
    + ` ${(mean(perFrame.map((s) => s.topTen)) * 100).toFixed(0).padStart(5)}%`
    + ` ${(mean(perFrame.map((s) => s.weighted)) * 100).toFixed(0).padStart(8)}%`
    + ` ${(mean(perFrame.map((s) => s.covered)) * 100).toFixed(0).padStart(7)}%`
    + `   ${perFrame.filter((s) => s.starMatch).length}/${built.length}`,
  );
}

const best = [...results].sort((a, b) => b.weighted - a.weighted)[0];
if (best) {
  console.log(
    `\nbest weighted: alpha ${best.alpha.toFixed(1)} -> r ${best.r.toFixed(3)},`
    + ` all ${(best.all * 100).toFixed(0)}%,`
    + ` top10 ${(best.topTen * 100).toFixed(0)}%,`
    + ` weighted ${(best.weighted * 100).toFixed(0)}% (worst frame ${(best.worstWeighted * 100).toFixed(0)}%),`
    + ` ${best.stars}/${built.length} stars`,
  );
}
console.log("\nFour frames of one session, and alpha is a fitted parameter. Prefer a");
console.log("plateau to a peak, and treat a peak at the edge as no blend at all.");

/*
 * Leave-one-out: does the fitted alpha survive a frame it never saw?
 *
 * Alpha is one free parameter fitted on four frames, which is exactly how a
 * curve gets fitted to noise. Holding each frame out in turn, choosing alpha on
 * the other three and scoring only the held-out one, is the strongest honesty
 * check the available data supports. If the held-out score collapses to
 * flow-only, the blend is a fit rather than a finding.
 */
console.log("\nLeave-one-out on alpha:");
console.log("held out   alpha chosen on the rest   held-out r   flow-only r   top10  (flow-only)");
console.log("-".repeat(84));

const scoreOne = (entry, alpha) => {
  const { keys, theirs, flow, struct } = entry;
  const nFlow = normalised(flow, keys);
  const nStruct = normalised(struct, keys);
  const merged = new Map(keys.map((k) => [
    k,
    alpha * (nFlow.get(k) ?? 0) + (1 - alpha) * (nStruct.get(k) ?? 0),
  ]));
  const shared = keys.filter((k) => theirs.has(k) && merged.get(k) !== 0);
  if (shared.length < 8) return null;
  const agree = (k) => Math.sign(theirs.get(k)) === Math.sign(merged.get(k));
  const bySize = [...shared].sort((a, b) => Math.abs(theirs.get(b)) - Math.abs(theirs.get(a)));
  const topTen = bySize.slice(0, Math.min(10, shared.length));
  return {
    r: pearson(shared, (k) => theirs.get(k), (k) => merged.get(k)),
    topTen: topTen.filter(agree).length / topTen.length,
  };
};

const heldR = [];
const baseR = [];
const heldTop = [];
const baseTop = [];
for (const entry of built) {
  const rest = built.filter((other) => other !== entry);
  let bestAlpha = 1;
  let bestScore = -Infinity;
  for (let step = 0; step <= 10; step += 1) {
    const alpha = step / 10;
    const scores = rest.map((other) => scoreOne(other, alpha)).filter(Boolean);
    if (scores.length < rest.length) continue;
    const score = mean(scores.map((row) => row.r));
    if (score > bestScore) { bestScore = score; bestAlpha = alpha; }
  }
  const held = scoreOne(entry, bestAlpha);
  const flowOnly = scoreOne(entry, 1);
  if (!held || !flowOnly) continue;
  heldR.push(held.r);
  baseR.push(flowOnly.r);
  heldTop.push(held.topTen);
  baseTop.push(flowOnly.topTen);
  console.log(
    `  ${entry.frameIso.slice(11, 16)}                 ${bestAlpha.toFixed(1)}`
    + `        ${held.r.toFixed(3).padStart(6)}`
    + `       ${flowOnly.r.toFixed(3).padStart(6)}`
    + `    ${(held.topTen * 100).toFixed(0).padStart(3)}%   (${(flowOnly.topTen * 100).toFixed(0)}%)`,
  );
}
if (heldR.length) {
  console.log(
    `
  mean held-out r ${mean(heldR).toFixed(3)} vs flow-only ${mean(baseR).toFixed(3)}`
    + `   |  top10 ${(mean(heldTop) * 100).toFixed(0)}% vs ${(mean(baseTop) * 100).toFixed(0)}%`,
  );
  console.log(
    mean(heldR) > mean(baseR)
      ? "  The blend survives frames it was not fitted on."
      : "  The blend does NOT survive - it is a fit, not a finding.",
  );
}
