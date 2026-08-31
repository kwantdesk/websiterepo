import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * Cash-index charts paint from cache like every other chart.
 *
 * SPX, SPY, NDX and QQQ took a minute or more to appear on GEX VUE. The
 * endpoint was not the problem - the same window fetched in 2.8s once the page
 * had settled. Two things were:
 *
 * The pane's whole paint-from-cache path was gated on `pane.broker ===
 * "Databento"`, so an index pane always started from nothing and sat on the
 * spinner until a live request returned. And nothing ever wrote a cache entry
 * for one, so there was nothing to paint from even if it had been allowed to
 * look.
 *
 * That request meanwhile queues behind every GEX surface on the page in the
 * gateway's spaced vendor queue - SPX's own history was measured at 92.5
 * seconds there against five to nine for the others.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const indexBranch = (() => {
  const start = workspace.indexOf('if (broker === "Market Index") {');
  assert.ok(start > 0, "the Market Index fetch branch is gone");
  return workspace.slice(start, workspace.indexOf("\n  try {", start));
})();

check("an index pane reads the candle cache", () => {
  assert.match(
    workspace,
    /pane\.broker === "Databento" \|\| pane\.broker === "Market Index"\s*\n\s*\? readCompatibleChartHistoryCache\(pane\.symbol, pane\.timeframe\)/,
    "the restore path is gated on Databento again",
  );
});

check("a successful index fetch fills that cache", () => {
  // Otherwise the read above finds nothing for ever and the fix is inert.
  assert.match(
    indexBranch,
    /if \(candles\.length && !historicalRange\) \{\s*\n\s*void writeChartHistoryCache\(symbol, timeframe, candles\);/,
    "the index branch no longer persists what it downloads",
  );
});

check("a historical range is never written under the live key", () => {
  /*
   * A range request is a different window. Writing it where the live chart
   * looks makes the next normal open start on an old final candle - this has
   * happened before on the CME path.
   */
  assert.ok(
    indexBranch.includes("!historicalRange"),
    "the range guard is gone from the index write",
  );
});

check("panes asking for the same window share one request", () => {
  // Four index panes were four trips into the queue that is the bottleneck,
  // and two panes on one symbol were two identical ones.
  assert.match(
    indexBranch,
    /const requestKey = `index::\$\{symbol\}::\$\{timeframe\}::\$\{historicalRange\?\.key \?\? `\$\{windowFrom\}-\$\{windowTo\}`\}`;/,
    "the index request key is gone or no longer covers the window",
  );
  /*
   * And the window has to be quantised, or the key is unique per call: `to` is
   * Date.now(), so two panes mounting together shared nothing and every URL
   * was new - which also meant the route's ETag could never match.
   */
  assert.match(indexBranch, /const windowTo = Math\.floor\(to \/ windowQuantumMs\) \* windowQuantumMs;/);
  assert.match(indexBranch, /from=\$\{windowFrom\}&to=\$\{windowTo\}/, "the request still sends a raw Date.now()");
  assert.match(indexBranch, /const pending = workspaceCandleRequests\.get\(requestKey\);\s*\n\s*if \(pending\) return pending;/);
  assert.match(indexBranch, /workspaceCandleRequests\.set\(requestKey, request\);/);
  assert.match(
    indexBranch,
    /if \(workspaceCandleRequests\.get\(requestKey\) === request\) \{\s*\n\s*workspaceCandleRequests\.delete\(requestKey\);/,
    "the shared index request is never released",
  );
});

check("one pane leaving cannot kill another pane's request", () => {
  /*
   * The caller's signal must not reach the shared fetch. A pane that unmounts
   * mid-flight would otherwise abort a request a sibling is still waiting on,
   * and throw away work that had already waited its turn in the queue.
   */
  assert.ok(
    !indexBranch.includes("signal?.addEventListener"),
    "the caller's abort signal is wired into the shared index fetch again",
  );
  assert.ok(
    !/signal: timeoutController\.signal[\s\S]*signal\?\.aborted/.test(indexBranch),
    "the shared index request still bails on a caller's abort",
  );
});

check("the bounded attempt and its one retry survive", () => {
  // Without a timeout, losing the race meant waiting for ever - which is what
  // "never loads" was.
  assert.match(indexBranch, /await attempt\(20_000\)/);
  assert.match(indexBranch, /await attempt\(30_000\)/);
});

check("the CME path is untouched", () => {
  // It already had all of this; this change must not have moved it.
  assert.match(
    workspace,
    /const rangeScope = historicalRange\?\.key \?\? `\$\{historyDays\}d`;/,
    "the Databento request key changed",
  );
});

console.log(`\nindex history cache: ${passed}/${passed} checks passed`);
