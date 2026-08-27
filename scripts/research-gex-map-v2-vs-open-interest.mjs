#!/usr/bin/env node
/**
 * Check the book against the one HARD label in this problem.
 *
 * Everything so far has been scored against the reference lattice - four
 * minutes of one session, which is not enough to keep fitting parameters to.
 * Open interest is different: it is not an estimate and not a vendor's opinion.
 * If a contract's open interest rose by N overnight, then exactly N contracts
 * opened. Nothing has to be inferred.
 *
 * That gives two questions the reference cannot answer:
 *
 *   1. Is the book the right SIZE? Dealer inventory at a contract cannot
 *      plausibly exceed the open interest in it. The engine has an OI bound for
 *      this, and the bound was measured never to bind at any setting from 0.5x
 *      to 10x - which means either the positions are far too small, or the
 *      bound is decoration.
 *
 *   2. Does the classified flow track real position formation? A session where
 *      customers were net buyers at a strike and open interest ROSE is a
 *      session where positions opened. If our signed flow has no relationship
 *      to open-interest change, the aggressor rule is not reading position
 *      formation at all.
 *
 * Every capture already carries its session's open interest, so this costs no
 * provider requests.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  classifyConsolidatedTape,
  tradeInventoryDelta,
  DEALER_INVENTORY_OI_BOUND,
} from "../src/lib/gexMapV2.ts";

const ZERO_DTE = "2026-08-21";
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

const available = SESSIONS.filter((s) => existsSync(file(s)));
if (available.length < 3) {
  console.log("skipped: fewer than three captured sessions in this working tree.");
  process.exit(0);
}

const captures = new Map(available.map((s) => [s, JSON.parse(readFileSync(file(s), "utf8"))]));

/*
 * Open interest for THIS EXPIRATION, not every expiration at the strike.
 *
 * The capture files carry an unfiltered open-interest read - the research route
 * asks for it by ticker alone - so `capture.openInterest` sums every expiry
 * listed at that strike. Measured against it, a session's flow looked like 2%
 * of the open-interest change and uncorrelated with it, which is what comparing
 * one expiry's trades against twenty expiries' positions is bound to look like.
 * The number was wrong, not the model.
 */
const OI_SERIES = fileURLToPath(new URL(`../tmp/oi-series-SPX-${ZERO_DTE}.json`, import.meta.url));
if (!existsSync(OI_SERIES)) {
  console.log(`skipped: ${OI_SERIES} is not in this working tree.`);
  console.log("Capture it with the research route:");
  console.log("  /api/research/opra-tape?symbol=SPX&sessionDate=<day>&aggregate=oi"
    + "&expiration=<expiry>&days=<comma separated sessions>");
  process.exit(0);
}
const oiSeries = JSON.parse(readFileSync(OI_SERIES, "utf8")).series ?? {};

const oiOf = (session, strike, right) => {
  const cell = oiSeries[session]?.[strike.toFixed(1)] ?? oiSeries[session]?.[String(strike)];
  if (!cell) return null;
  const value = right === "call" ? cell.call : cell.put;
  return Number.isFinite(value) ? value : null;
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

function pearson(rows, f, g) {
  if (rows.length < 3) return Number.NaN;
  const mf = rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const mg = rows.reduce((s, r) => s + g(r), 0) / rows.length;
  let cov = 0;
  let vf = 0;
  let vg = 0;
  for (const r of rows) {
    const a = f(r) - mf;
    const b = g(r) - mg;
    cov += a * b;
    vf += a * a;
    vg += b * b;
  }
  return vf && vg ? cov / Math.sqrt(vf * vg) : Number.NaN;
}

console.log(`SPX ${ZERO_DTE} contracts, ${available.length} captured sessions.\n`);
console.log("Per session: our classified net flow vs the open-interest change it should have caused.");
console.log("session      contracts  |net flow|   |OI change|  ratio  |  signed r  abs r");
console.log("-".repeat(82));

const allRows = [];

for (let index = 1; index < available.length; index += 1) {
  const session = available[index];
  const previous = available[index - 1];
  const prints = captures.get(session).prints
    .filter((p) => p.expirationDate?.slice(0, 10) === ZERO_DTE)
    .filter((p) => Number.isFinite(p.tradeTime));
  if (!prints.length) continue;

  // Net signed customer flow per contract, by the shipped classifier. The
  // dealer sign is inverted back to the CUSTOMER's direction, because open
  // interest records what the customer opened.
  const netFlow = new Map();
  for (const trade of classifyConsolidatedTape(prints.map(asTrade))) {
    const key = `${trade.strike}|${trade.right}`;
    netFlow.set(key, (netFlow.get(key) ?? 0) - tradeInventoryDelta(trade));
  }

  const rows = [];
  for (const [key, flow] of netFlow) {
    const [strikeText, right] = key.split("|");
    const strike = Number(strikeText);
    const before = oiOf(previous, strike, right);
    const after = oiOf(session, strike, right);
    if (before === null || after === null) continue;
    rows.push({ strike, right, flow, change: after - before, oi: after });
  }
  if (rows.length < 8) continue;

  const grossFlow = rows.reduce((s, r) => s + Math.abs(r.flow), 0);
  const grossChange = rows.reduce((s, r) => s + Math.abs(r.change), 0);
  allRows.push(...rows);
  console.log(
    `${session}  ${String(rows.length).padStart(8)}`
    + `  ${Math.round(grossFlow).toLocaleString().padStart(10)}`
    + `  ${Math.round(grossChange).toLocaleString().padStart(12)}`
    + `  ${(grossFlow / (grossChange || 1)).toFixed(2).padStart(5)}x  |`
    + `  ${pearson(rows, (r) => r.flow, (r) => r.change).toFixed(3).padStart(7)}`
    + `  ${pearson(rows, (r) => Math.abs(r.flow), (r) => Math.abs(r.change)).toFixed(3).padStart(6)}`,
  );
}

if (allRows.length >= 8) {
  console.log(
    `\npooled (${allRows.length} contract-sessions):`
    + `  signed r ${pearson(allRows, (r) => r.flow, (r) => r.change).toFixed(3)}`
    + `,  absolute r ${pearson(allRows, (r) => Math.abs(r.flow), (r) => Math.abs(r.change)).toFixed(3)}`,
  );
  const sameSign = allRows.filter((r) => r.change !== 0 && Math.sign(r.flow) === Math.sign(r.change)).length;
  const nonZero = allRows.filter((r) => r.change !== 0).length;
  console.log(`  net customer buying and rising open interest agree on ${(sameSign / nonZero * 100).toFixed(0)}% of contracts`);
}

// --- is the OI bound doing anything? ----------------------------------------
console.log(`\nDoes the OI bound (${DEALER_INVENTORY_OI_BOUND}) ever bind?`);
const held = allRows
  .filter((r) => r.oi > 0)
  .map((r) => Math.abs(r.flow) / r.oi)
  .sort((a, b) => a - b);
if (held.length) {
  const at = (q) => held[Math.min(held.length - 1, Math.floor(q * held.length))];
  console.log(
    `  a session's flow as a share of the contract's open interest:`
    + `  median ${(at(0.5) * 100).toFixed(1)}%`
    + `,  90th ${(at(0.9) * 100).toFixed(1)}%`
    + `,  99th ${(at(0.99) * 100).toFixed(1)}%`
    + `,  max ${(held[held.length - 1] * 100).toFixed(1)}%`,
  );
  const over = held.filter((v) => v > DEALER_INVENTORY_OI_BOUND).length;
  console.log(`  ${over} of ${held.length} contract-sessions (${(over / held.length * 100).toFixed(1)}%) exceed the bound`);
}
