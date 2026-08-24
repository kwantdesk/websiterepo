import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../src/app/api/market-indices/route.ts", import.meta.url),
  "utf8",
);

test("stale multi-day index history restores and merges the current session", () => {
  assert.match(route, /needsCurrentSessionRepair\(historicalCandles, from, to, now\)/);
  assert.match(route, /currentSessionFrom = Date\.parse\(`\$\{today\}T00:00:00\.000Z`\)/);
  assert.match(route, /if \(!currentCandles\.length\) \{\s*currentCandles = \(await fetchMarketIndexCandles/s);
  assert.match(route, /mergeIndexHistoryCandles\(historicalCandles, currentCandles\)/);
  assert.match(route, /source: `\$\{String\(payload\.source \|\| "VPS index history"\)\} \+ current session`/);
});

test("the repair is limited to a missing New York session", () => {
  assert.match(route, /newYorkCashSessionHasStarted\(now\)/);
  assert.match(route, /newYorkDateKey\(to\) !== today/);
  assert.match(route, /newYorkDateKey\(latest\.timestamp\) !== today/);
});
