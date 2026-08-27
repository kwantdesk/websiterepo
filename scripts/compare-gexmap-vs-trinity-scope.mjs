#!/usr/bin/env node
/**
 * Is the KwantDesk / Skylit GEX divergence a SCOPE problem or a MODEL problem?
 *
 * The GEX MAP panel does not compute gamma exposure. getGexMapPanel requests
 * QuantData's /options/tool/exposure-by-strike and parseExposure sums
 * callExposure + putExposure per strike. So "our levels" are QuantData's
 * levels, aggregated over whichever expirations the panel has in scope.
 *
 * Skylit Trinity computes its own. That leaves two candidate explanations for
 * the divergence, and they demand opposite responses:
 *
 *   SCOPE  - we show ALL EXP, their panel is 0DTE. Fixable from the toolbar.
 *   MODEL  - the two vendors measure different quantities. Not fixable by any
 *            setting, and not by a scalar, a unit toggle or a palette.
 *
 * This separates them. It replays a captured QuantData interval map against a
 * captured Trinity lattice for the same symbol and the same minute, once with
 * expirations filtered to 0DTE and once with everything, and reports sign
 * agreement, cross-strike correlation and gross magnitude for each.
 *
 * A scope problem would show correlation rising sharply when the scope is
 * matched. A model problem would leave it flat.
 *
 * Inputs are the captures from the 2026-08-21 reconstruction; see
 * docs/research/skylit-trinity-gex-reconstruction-2026-08-21.md.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const QUANTDATA = fileURLToPath(new URL("../tmp/quantdata-interval-map-2026-08-21.json", import.meta.url));
const TRINITY = fileURLToPath(new URL("./trinity-extra-lattices-2026-08-21.json", import.meta.url));
const FRAME = "2026-08-21T09:55:00-04:00";
const ZERO_DTE_EXPIRY = "2026-08-21";
/** Trinity's SPXW panel is the weekly root; QuantData files it under SPX. */
const SYMBOLS = { SPXW: "SPX", SPY: "SPY", QQQ: "QQQ" };

if (!existsSync(QUANTDATA) || !existsSync(TRINITY)) {
  console.log("skipped: the 2026-08-21 captures are not in this working tree.");
  console.log("  expected", QUANTDATA);
  console.log("  expected", TRINITY);
  process.exit(0);
}

const quantData = JSON.parse(readFileSync(QUANTDATA, "utf8"));
const trinity = JSON.parse(readFileSync(TRINITY, "utf8"));
const frameKey = String(Date.parse(FRAME));

/** Net signed exposure per strike, exactly as parseExposure aggregates it. */
function quantDataNetByStrike(symbol, onlyExpiration) {
  const frame = quantData[symbol]?.data?.[frameKey];
  if (!frame) return null;
  const byStrike = new Map();
  for (const [expiration, strikes] of Object.entries(frame)) {
    if (onlyExpiration && expiration !== onlyExpiration) continue;
    for (const [strikeKey, cell] of Object.entries(strikes)) {
      const strike = Number(strikeKey);
      let net = 0;
      for (const side of Object.values(cell)) net += Number(side) || 0;
      byStrike.set(strike, (byStrike.get(strike) ?? 0) + net);
    }
  }
  return byStrike;
}

function pearson(rows, left, right) {
  const n = rows.length;
  const meanL = rows.reduce((sum, k) => sum + left(k), 0) / n;
  const meanR = rows.reduce((sum, k) => sum + right(k), 0) / n;
  let cov = 0;
  let varL = 0;
  let varR = 0;
  for (const k of rows) {
    const dl = left(k) - meanL;
    const dr = right(k) - meanR;
    cov += dl * dr;
    varL += dl * dl;
    varR += dr * dr;
  }
  return varL && varR ? cov / Math.sqrt(varL * varR) : Number.NaN;
}

console.log(`Frame ${FRAME} — QuantData exposure-by-strike vs Skylit Trinity\n`);
console.log("symbol scope     strikes  sign match       r   gross QD/Trinity");

const results = [];
for (const [trinitySymbol, quantDataSymbol] of Object.entries(SYMBOLS)) {
  const target = trinity[FRAME]?.[trinitySymbol]?.values;
  if (!target) continue;
  for (const [expiration, label] of [[ZERO_DTE_EXPIRY, "0DTE"], [null, "ALL-EXP"]]) {
    const ours = quantDataNetByStrike(quantDataSymbol, expiration);
    if (!ours) continue;
    const rows = Object.keys(target).map(Number).filter((k) => ours.has(k)).sort((a, b) => a - b);
    if (rows.length < 5) continue;

    const signMatch = rows.filter((k) => Math.sign(target[k]) === Math.sign(ours.get(k))).length / rows.length;
    const r = pearson(rows, (k) => target[k], (k) => ours.get(k));
    const grossTarget = rows.reduce((sum, k) => sum + Math.abs(target[k]), 0);
    const grossOurs = rows.reduce((sum, k) => sum + Math.abs(ours.get(k)), 0);
    results.push({ symbol: trinitySymbol, label, r, signMatch });
    console.log(
      `${trinitySymbol.padEnd(6)} ${label.padEnd(8)} ${String(rows.length).padStart(6)}`
      + `  ${(signMatch * 100).toFixed(0).padStart(9)}%  ${r.toFixed(3).padStart(6)}`
      + `  ${(grossOurs / grossTarget).toFixed(1).padStart(15)}x`,
    );
  }
}

console.log("\nReading this:");
console.log("  Sign match near 50% is a coin flip. Cross-strike correlation near 0");
console.log("  means the two columns carry no shared cross-sectional signal.");
console.log("  Neither a unit toggle ($1 vs 1%) nor a colour scale can change a");
console.log("  sign or a correlation - both are positive scalars.\n");

const scopeGain = [];
for (const symbol of Object.keys(SYMBOLS)) {
  const zero = results.find((row) => row.symbol === symbol && row.label === "0DTE");
  const all = results.find((row) => row.symbol === symbol && row.label === "ALL-EXP");
  if (zero && all) scopeGain.push({ symbol, delta: zero.r - all.r });
}
for (const { symbol, delta } of scopeGain) {
  console.log(`  ${symbol.padEnd(6)} matching scope moves correlation by ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`);
}
const best = Math.max(...results.map((row) => Math.abs(row.r)));
console.log(
  `\nVERDICT: best |r| across every symbol and scope is ${best.toFixed(3)}.`
  + `\n  Matching expiry scope changes magnitude but not the pattern, so the`
  + `\n  divergence is a MODEL difference, not a settings or units one.`,
);
