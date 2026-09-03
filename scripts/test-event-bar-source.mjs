import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bars = readFileSync(new URL("../src/lib/databento.ts", import.meta.url), "utf8");

/* The public helper must delegate to the one authoritative event builder. */
const eventBranch = (() => {
  const from = bars.indexOf("if (isEventBasedChartInterval(timeframe)) {");
  if (from < 0) throw new Error("the event-bar branch is gone");
  const to = bars.indexOf("\n  }", from);
  if (to < 0) throw new Error("the event-bar branch is malformed");
  return bars.slice(from, to);
})();
/*
 * The module that actually serves range and volume charts.
 *
 * /api/databento/market calls getDatabentoEventBars here - NOT the event
 * branch in databento.ts. The first version of this test asserted only on
 * databento.ts, passed, and every range chart stayed empty: the assertions
 * were true about a module the request never reaches. Any claim about where
 * event bars get their prints has to be made about this file.
 */
const eventHistory = readFileSync(
  new URL("../src/lib/databentoEventHistory.server.ts", import.meta.url), "utf8",
);
const tapeReader = readFileSync(
  new URL("../src/lib/recordedTradeTape.server.ts", import.meta.url), "utf8",
);
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
  assert.match(eventBranch, /fetchRecordedTrades\(/,
    "event bars do not use the complete paged recorded tape");
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
  assert.match(eventHistory, /delta: trade\.side > 0 \? trade\.size : trade\.side < 0 \? -trade\.size : 0,/);
  assert.ok(
    !/databentoTradeAggressor\(trade\.side/.test(eventHistory),
    "the vendor's aggressor inference is still in the event-bar path",
  );
});

check("an unavailable tape is reported, never silently empty", () => {
  // An empty range chart reads as a quiet market rather than a failed request,
  // which is how the vendor outage went unnoticed for so long.
  assert.match(tapeReader, /throw new Error\(`The recorded trade tape is unavailable \(\$\{response\.status\}\)/);
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

check("the module the chart route actually calls reads the tape", () => {
  assert.match(eventHistory, /fetchRecordedTrades\(/, "event bars do not read the recorded tape");
  /*
   * The vendor answered 422 "requires a subscription" for the whole window, so
   * every range, volume, renko and tick chart returned no history at all.
   */
  assert.ok(
    !/GLBX\.MDP3/.test(eventHistory),
    "the event-history module still asks the vendor for CME data",
  );
  assert.ok(
    !/vendorMarketDataFetch\(/.test(eventHistory),
    "an event-history path still calls the vendor",
  );
});

check("order flow comes from the same prints as the geometry", () => {
  /*
   * Two sources would disagree bar by bar. One large execution can legitimately
   * be split across several volume bars at the same source timestamp, so a
   * second-pass aggregate over a different tape produces flow that does not
   * match the bars it is drawn on.
   */
  const flow = eventHistory.slice(eventHistory.indexOf("async function streamEventFlow"));
  assert.match(flow, /fetchRecordedTrades\(/);
  assert.match(flow, /const askVolume = trade\.side > 0 \? trade\.size : 0;/);
  assert.match(flow, /const bidVolume = trade\.side < 0 \? trade\.size : 0;/);
  // A print with no reported side carries no delta and cannot bucket.
  assert.match(flow, /if \(delta === 0 \|\| !args\.candles\.length\) continue;/);
});

check("there is one reader, not a copy per consumer", () => {
  /*
   * Two copies of this parsing would drift, and prints decoded slightly
   * differently in two places produce bars that disagree without either
   * looking wrong. The aggressor field had exactly that failure on the
   * collector side.
   */
  assert.match(tapeReader, /export async function fetchRecordedTrades/);
  assert.match(tapeReader, /throw new Error\(`The recorded trade tape is unavailable/);
});

check("a micro chart is built from the micro's own prints", () => {
  /*
   * The gateway aliases a micro root to its parent when resolving a symbol.
   * That is right for a quote - a micro tracks its parent tick for tick, and
   * the micros were not even subscribed until recently - but for a tape it
   * silently hands back NQ's prints when MNQ was asked for, and the caller
   * cannot tell, because NQ prints look exactly like the MNQ prints it
   * expected. Measured before the fix: an MNQ range chart and an NQ range
   * chart returned byte-identical bars, down to the bar count.
   */
  const route = server.slice(server.indexOf('url.pathname === "/v1/market-data/trade-tape"'));
  assert.match(
    route.slice(0, 1200),
    /requestedInstrument\(url, \{\}, \{ exactRoot: true \}\)/,
    "the trade tape still resolves a micro through its parent root",
  );
  assert.match(server, /function requestedInstrument\(url, body = \{\}, options = \{\}\)/);
  assert.match(server, /const exactRoot = options\.exactRoot === true;/);
});

console.log(`\nevent bar source: ${passed}/${passed} checks passed`);
