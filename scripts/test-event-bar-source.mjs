import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bars = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");

/*
 * The event branch, sliced from the guard to the bar builder AFTER it -
 * applyMarketTradesToEventBars is also imported at the top of the file, so an
 * unanchored indexOf finds the import and yields an empty slice that every
 * assertion then passes or fails for the wrong reason.
 */
const eventBranch = (() => {
  const from = bars.indexOf("if (isEventBasedChartInterval(timeframe)) {");
  if (from < 0) throw new Error("the event-bar branch is gone");
  const to = bars.indexOf("applyMarketTradesToEventBars", from);
  if (to < 0) throw new Error("the event-bar builder is gone");
  return bars.slice(from, to);
})();
const server = readFileSync(
  new URL("../services/rithmic_gateway/src/server.mjs", import.meta.url), "utf8",
);
const tape = readFileSync(
  new URL("../services/rithmic_gateway/src/trade-tape-archive.mjs", import.meta.url), "utf8",
);

/**
 * Range, volume, renko and tick bars are built from the desk's own prints.
 *
 * They close on price travelled or contracts traded, so the path taken WITHIN
 * a minute is exactly the information they need and exactly what an OHLC bar
 * discards - a minute-bar history cannot produce them at any resolution. The
 * website asked the vendor for a raw trades feed to build them; that account
 * now answers 402, so these chart types had no history at all.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("event bars ask the collector, not the vendor", () => {
  assert.match(eventBranch, /\/v1\/market-data\/trade-tape\?/, "event bars do not read the recorded tape");
  assert.ok(
    !/schema: "trades"/.test(eventBranch),
    "the event-bar path still asks the vendor for a raw trades feed",
  );
});

check("the recorded aggressor is used, never re-derived", () => {
  /*
   * The tape stores the side the feed actually reported as 1 / -1 / 0. Zero
   * means the feed did not say, and a delta bar must show no delta rather than
   * a guessed one.
   */
  assert.match(eventBranch, /const side = Number\(record\.side \?\? 0\);/);
  assert.match(eventBranch, /delta: side > 0 \? size : side < 0 \? -size : 0,/);
  assert.ok(
    !/databentoTradeAggressor/.test(eventBranch),
    "the vendor's aggressor inference is still in the event-bar path",
  );
});

check("an unavailable tape is reported, never silently empty", () => {
  // An empty range chart reads as a quiet market rather than a failed request,
  // which is how the vendor outage went unnoticed for so long.
  assert.match(bars, /throw new Error\(`The recorded trade tape is unavailable \(\$\{response\.status\}\)/);
});

check("the gateway serves the tape", () => {
  assert.match(server, /url\.pathname === "\/v1\/market-data\/trade-tape"/);
  assert.match(server, /tradeTape\.attach\(client\);/, "the tape is not fed by the live stream");
  assert.match(server, /await tradeTape\.close\(\)/, "shutdown does not flush the tape");
});

check("all four contracts are taped", () => {
  /*
   * MNQU6 does not start with "NQ" and MESU6 does not start with "ES", so a
   * mini-only root list records nothing for the micros - and an untaped
   * instrument looks exactly like one nobody traded.
   */
  const roots = tape.slice(tape.indexOf("export const DEFAULT_TAPE_ROOTS"));
  for (const root of ["MNQ", "MES", "NQ", "ES"]) {
    assert.ok(new RegExp(`"${root}"`).test(roots.slice(0, 120)), `${root} has no tape`);
  }
});

check("the tape is readable while the session is still running", () => {
  // Deflate holds its output until it has enough to emit, so without this the
  // file is write-only until the session closes: measured live, 2,744 prints
  // written and 0 readable.
  assert.match(tape, /stream\.flush\(zlibConstants\.Z_SYNC_FLUSH\)/);
});

console.log(`\nevent bar source: ${passed}/${passed} checks passed`);
