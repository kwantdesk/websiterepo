import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A cash-index pane must not be able to wait for ever.
 *
 * Measured on production, on GEX VUE: the SPX pane's own history request ran
 * 92.5 SECONDS and returned nothing, while SPY, NDX and QQQ came back in five
 * to nine. The endpoint is not slow - the same window fetched in 2.8s with
 * 2,391 bars once the page had settled. Cash-index history shares the gateway's
 * spaced vendor queue with every GEX surface on the page, and SPX queued behind
 * the startup burst.
 *
 * The fetch had no timeout, so losing that race meant waiting for ever. The
 * pane's loading state is `candles.length === 0`, so it sat on "restoring 3 m
 * candles" with nothing on its way - which is exactly what "SPX chart does not
 * want to load" looks like from the outside.
 */

const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");

const indexPath = workspace.slice(
  workspace.indexOf('if (broker === "Market Index") {'),
  workspace.indexOf('const storedUrl = `/api/market-data/history'),
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the index history path was found", () => {
  assert.ok(indexPath.length > 0 && indexPath.length < 4_000, `slice looks wrong: ${indexPath.length} chars`);
  assert.match(indexPath, /\/api\/market-indices\?symbol=/);
});

check("every attempt is bounded", () => {
  // THE BUG: an unbounded fetch. Without a deadline the pane has no way back.
  assert.match(indexPath, /const attempt = async \(timeoutMs: number\)/);
  assert.match(indexPath, /window\.setTimeout\(\(\) => timeoutController\.abort\(\), timeoutMs\)/);
  assert.doesNotMatch(indexPath, /signal,\s*\},\s*\);/, "the raw caller signal alone carries no deadline");
});

check("it retries once, with more room", () => {
  // By the second attempt the startup burst has drained, which is why a plain
  // retry is enough rather than needing request prioritisation.
  assert.match(indexPath, /return await attempt\(20_000\);/);
  assert.match(indexPath, /return await attempt\(30_000\);/);
});

check("a caller that moved on is not retried against", () => {
  // Instrument changed, interval changed, pane unmounted: retrying would be a
  // request for a chart nobody is looking at, and would rejoin the very queue
  // that caused the problem.
  assert.match(indexPath, /if \(signal\?\.aborted\) throw error;/);
});

check("the caller's abort still cancels an in-flight attempt", () => {
  // The timeout controller is what the fetch listens to now, so the caller's
  // signal has to be forwarded onto it or an abandoned request would run to its
  // full deadline.
  assert.match(indexPath, /signal\?\.addEventListener\("abort", abortOnCallerSignal, \{ once: true \}\)/);
  assert.match(indexPath, /signal\?\.removeEventListener\("abort", abortOnCallerSignal\)/,
    "and the listener must be removed, or every request leaks one");
});

check("the timer is always cleared", () => {
  assert.match(indexPath, /\} finally \{\s*\n\s*window\.clearTimeout\(timer\);/);
});

check("success still goes through the same sanitiser", () => {
  // The fix is about WAITING, not about what is accepted. Candles must still be
  // cleaned the same way.
  assert.match(indexPath, /return sanitizeCandles\(\(payload\.candles \?\? \[\]\) as Candle\[\], symbol\)/);
  assert.match(indexPath, /if \(!response\.ok\) throw new Error\(payload\.error/);
});

console.log(`\nindex history timeout: ${passed}/${passed} checks passed`);
