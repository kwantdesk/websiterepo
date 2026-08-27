#!/usr/bin/env node
/**
 * Does the v2 dealer-inventory engine produce a real cross-section?
 *
 * v1 shows QuantData's exposure-by-strike verbatim and scores a cross-strike
 * correlation of at most 0.24 against Skylit Trinity with sign agreement at a
 * coin flip. That is the number to beat, and this measures whether carrying a
 * signed inventory beats it on the same frame.
 *
 * The run is honest about what it is: a five-session tape accumulated into an
 * inventory state, revalued at 10:00 ET on 2026-08-21, compared against
 * Trinity's own lattice for that minute. The engine never sees Trinity's values
 * - they are only the scoring target.
 *
 * A caveat that must not be lost: the state is seeded EMPTY at the start of the
 * tape. Real inventory did not start at zero on 2026-08-17, so the first
 * sessions are the engine warming up rather than a settled book. Whatever this
 * scores is therefore a floor, not the ceiling.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TAPE = fileURLToPath(new URL("../tmp/trinity-inventory-tape-2026-08-17-to-2026-08-21.json", import.meta.url));
const INPUTS = fileURLToPath(new URL("../tmp/trinity-dealer-inventory-inputs-2026-08-21.json", import.meta.url));
const TRINITY = fileURLToPath(new URL("../scripts/trinity-extra-lattices-2026-08-21.json", import.meta.url));

for (const path of [TAPE, INPUTS, TRINITY]) {
  if (!existsSync(path)) {
    console.log(`skipped: ${path} is not in this working tree.`);
    process.exit(0);
  }
}

const { contractKey, tradeInventoryDelta, DEALER_INVENTORY_OI_BOUND } =
  await import("../src/lib/gexMapV2.ts");

// The captured Trinity frame this is scored against. The tape is accumulated
// up to exactly this instant so the comparison is like for like.
const TRINITY_FRAME = "2026-08-21T09:55:00-04:00";
const CUTOFF = Date.parse(TRINITY_FRAME);
const ZERO_DTE = "2026-08-21";
const SYMBOLS = { SPY: "SPY", QQQ: "QQQ", SPXW: "SPX" };

const tape = JSON.parse(readFileSync(TAPE, "utf8"));
const inputs = JSON.parse(readFileSync(INPUTS, "utf8"));
const trinityFile = JSON.parse(readFileSync(TRINITY, "utf8"));
const trinity = trinityFile[TRINITY_FRAME];
if (!trinity) { console.log(`skipped: no ${TRINITY_FRAME} frame in the capture.`); process.exit(0); }

/**
 * Customer side to dealer sign.
 *
 * A customer BUY is lifted from a dealer, leaving the dealer short that option
 * and short gamma. A customer SELL is absorbed by a dealer, leaving them long.
 * MID has no aggressor to read and is dropped rather than guessed.
 */
const DEALER_SIGN = { BUY: -1, SELL: 1, MID: 0 };

function pearson(rows, left, right) {
  const n = rows.length;
  if (!n) return Number.NaN;
  const ml = rows.reduce((s, k) => s + left(k), 0) / n;
  const mr = rows.reduce((s, k) => s + right(k), 0) / n;
  let cov = 0;
  let vl = 0;
  let vr = 0;
  for (const k of rows) {
    const dl = left(k) - ml;
    const dr = right(k) - mr;
    cov += dl * dr;
    vl += dl * dl;
    vr += dr * dr;
  }
  return vl && vr ? cov / Math.sqrt(vl * vr) : Number.NaN;
}

console.log("GEX Map v2 — dealer inventory, revalued at ${TRINITY_FRAME}\n");
console.log("symbol  strikes  sign match       r   vs v1 r   verdict");

let anyBeat = false;
for (const [trinitySymbol, tapeSymbol] of Object.entries(SYMBOLS)) {
  const trades = tape[tapeSymbol];
  const chain = inputs[tapeSymbol];
  const target = trinity?.[trinitySymbol]?.values;
  if (!trades || !chain || !target) continue;

  // Accumulate signed dealer contracts, in time order, up to the cutoff.
  const openInterest = (strike, right) => {
    const cell = chain.oi[strike.toFixed(1)] ?? chain.oi[String(strike)];
    if (!cell) return 0;
    return right === "call" ? Number(cell.callOpenInterest) || 0 : Number(cell.putOpenInterest) || 0;
  };
  const contracts = new Map();
  let absorbed = 0;
  for (const raw of [...trades].sort((a, b) => a.timestamp - b.timestamp)) {
    if (raw.timestamp > CUTOFF) continue;
    if (raw.expiration !== ZERO_DTE) continue;
    const dealerSign = DEALER_SIGN[String(raw.side).toUpperCase()] ?? 0;
    if (!dealerSign) continue;
    const right = String(raw.type).toUpperCase() === "CALL" ? "call" : "put";
    const delta = tradeInventoryDelta({
      expiration: raw.expiration,
      strike: raw.strike,
      right,
      contracts: Number(raw.size) || 0,
      dealerSign,
      dealerCounterpartyProbability: 1,
      economicTradeWeight: 1,
      complexLegWeight: 1,
      quoteConfidence: 0.9,
    });
    if (!delta) continue;
    const key = contractKey(raw.expiration, raw.strike, right);
    const bound = openInterest(raw.strike, right) * DEALER_INVENTORY_OI_BOUND;
    const next = (contracts.get(key) ?? 0) + delta;
    contracts.set(key, bound > 0 ? Math.min(bound, Math.max(-bound, next)) : next);
    absorbed += Math.abs(delta);
  }

  // Revalue against per-contract dollar gamma backed out of the provider chain.
  const node = new Map();
  for (const [strikeKey, exposure] of Object.entries(chain.exposure)) {
    const strike = Number(strikeKey);
    const callOi = openInterest(strike, "call");
    const putOi = openInterest(strike, "put");
    const callGamma = callOi > 0 ? Math.abs(Number(exposure.callExposure) || 0) / callOi : 0;
    const putGamma = putOi > 0 ? Math.abs(Number(exposure.putExposure) || 0) / putOi : 0;
    const callQty = contracts.get(contractKey(ZERO_DTE, strike, "call")) ?? 0;
    const putQty = contracts.get(contractKey(ZERO_DTE, strike, "put")) ?? 0;
    if (!callQty && !putQty) continue;
    node.set(strike, callQty * callGamma + putQty * putGamma);
  }

  const rows = Object.keys(target).map(Number).filter((k) => node.has(k)).sort((a, b) => a - b);
  if (rows.length < 5) {
    console.log(`${trinitySymbol.padEnd(7)} ${String(rows.length).padStart(7)}   too few overlapping strikes to score`);
    continue;
  }
  const signMatch = rows.filter((k) => Math.sign(target[k]) === Math.sign(node.get(k))).length / rows.length;
  const r = pearson(rows, (k) => target[k], (k) => node.get(k));
  // v1's measured ceiling on the same comparison, from
  // scripts/compare-gexmap-vs-trinity-scope.mjs at matched 0DTE scope.
  const v1 = { SPY: 0.006, QQQ: 0.244, SPXW: 0.141 }[trinitySymbol];
  const beat = Math.abs(r) > Math.abs(v1);
  if (beat) anyBeat = true;
  console.log(
    `${trinitySymbol.padEnd(7)} ${String(rows.length).padStart(7)}  ${(signMatch * 100).toFixed(0).padStart(9)}%`
    + `  ${r.toFixed(3).padStart(6)}  ${v1.toFixed(3).padStart(7)}   ${beat ? "beats v1" : "no better than v1"}`,
  );
  console.log(`         absorbed ${Math.round(absorbed).toLocaleString("en-US")} signed contracts into ${contracts.size} positions`);
}

console.log(
  "\nThe state is seeded EMPTY at the start of the tape. Real inventory did not"
  + "\nbegin at zero on 2026-08-17, so this is a floor for the model class, not"
  + "\nits ceiling.",
);
if (!anyBeat) {
  console.log(
    "\nNo symbol beat v1 here. That is a result, not a failure of the run: it"
    + "\nsays an unweighted aggressor rule over a cold-started book is not enough,"
    + "\nand that the open/close and dealer-counterparty weights are where the"
    + "\nremaining signal has to come from.",
  );
}
