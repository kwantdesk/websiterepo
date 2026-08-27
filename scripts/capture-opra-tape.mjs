#!/usr/bin/env node
/**
 * Record a live session's consolidated tape with the FULL field set.
 *
 * The v2 flow weights cannot be improved any further from the existing capture.
 * Its `side` is collapsed to BUY / SELL / MID, while the live feed carries
 * `tradeSideCode` at five levels (ABOVE_ASK / ASK / BID / BELOW_BID /
 * MID_MARKET) plus `tradeConsolidationType`, `tradeType`, per-print
 * `greeks.gamma`, `openInterest` and `premium`.
 *
 * Aggressor strength, sweep-versus-split and multi-leg detection are exactly
 * the distinctions that separate directional customer positioning from hedging
 * and spread flow - the diagnosis for why a plain aggressor rule works on the
 * cash index and reads backwards on the ETFs. Every one of them is thrown away
 * by the old capture, so the sweep has nothing left to find there.
 *
 * This records them, plus the chain snapshot needed to revalue, so the sweep in
 * calibrate-gex-map-v2.mjs can be re-run against real inputs.
 *
 * RUN IT AGAINST A SERVER THAT HAS PROVIDER CREDENTIALS.
 *
 *   node scripts/capture-opra-tape.mjs --base https://www.kwantdesk.com --cookie "<session cookie>"
 *   node scripts/capture-opra-tape.mjs --base http://localhost:3210        (dev bypass)
 *
 * Options:
 *   --symbols SPX,SPY,QQQ     default SPX,SPY,QQQ
 *   --pages   N               tape pages per symbol, 100 rows each (default 60)
 *   --order   ASCENDING        page from the session's FIRST print (default
 *                              DESCENDING, newest-first) - use ASCENDING when
 *                              scoring against a lattice taken near the open
 *   --out     PATH            default tmp/opra-tape-<sessionDate>.json
 *
 * Take a Trinity screenshot or lattice at the same minute. Without a matching
 * target the capture cannot be scored, and an unscored capture is just data.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function arg(name, fallback = null) {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const base = (arg("base") ?? "http://localhost:3210").replace(/\/$/, "");
const cookie = arg("cookie");
const symbols = (arg("symbols") ?? "SPX,SPY,QQQ").split(",").map((s) => s.trim().toUpperCase());
const maxPages = Number(arg("pages") ?? 60);
/*
 * ASCENDING reaches the OPENING prints.
 *
 * A reference lattice taken at 09:55 was built from the first 25 minutes of
 * flow, and the provider pages newest-first by default - which walks away from
 * exactly the prints that lattice was built from.
 */
const order = (arg("order") ?? "DESCENDING").toUpperCase() === "ASCENDING" ? "ASCENDING" : "DESCENDING";

const headers = { "content-type": "application/json", ...(cookie ? { cookie } : {}) };

async function capture(symbol, sessionDate, pages) {
  const url = `${base}/api/research/opra-tape`
    + `?symbol=${symbol}&sessionDate=${sessionDate}&pages=${pages}&order=${order}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${symbol} -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

const sessionDate = arg("sessionDate") ?? new Date().toISOString().slice(0, 10);
const out = arg("out") ?? `tmp/opra-tape-${sessionDate}.json`;

console.log(`Capturing ${symbols.join(", ")} for ${sessionDate} from ${base}`);
if (!cookie && !base.includes("localhost")) {
  console.log("WARNING: no --cookie given against a remote host; expect 401.");
}

const output = { capturedAt: new Date().toISOString(), sessionDate, base, symbols: {} };
const capture$ = output.symbols;

for (const symbol of symbols) {
  const result = await capture(symbol, sessionDate, maxPages);
  capture$[symbol] = result;
  const sides = new Set(
    (result.prints ?? []).map((print) => print?.tradeSideCode).filter(Boolean),
  );
  console.log(
    `  ${symbol.padEnd(4)} ${String(result.prints?.length ?? 0).padStart(6)} prints`
    + `${result.truncated ? " (TRUNCATED - raise --pages)" : ""}`
    + `   tradeSideCode seen: ${[...sides].join("/") || "none"}`,
  );
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(output));
console.log(`\nWrote ${out}`);
console.log("Pair it with a Trinity lattice for the same minute, then re-run:");
console.log("  npm run research:gex-map-v2-calibrate");
