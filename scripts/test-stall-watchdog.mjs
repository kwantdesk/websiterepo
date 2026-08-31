import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../src/lib/rendererHealth.ts", import.meta.url), "utf8",
);

/**
 * A backgrounded tab is not a frozen tab.
 *
 * The stall watchdog lives in a worker so it survives the freeze it watches
 * for. Workers are not throttled; the page is. Chrome cuts a background tab's
 * timers to roughly one a minute, so the beats stopped, the worker read that
 * as the main thread being wedged, and every minute spent on another tab was
 * filed as a sixty-second freeze - and POSTed to our own telemetry as one.
 *
 * Measured on the owner's browser: twenty stall records, every one of them
 * 59,995-60,003ms with longestTaskMs 0 and a calm heap. The ring holds twenty.
 * So the log of real stalls was completely displaced by the tabs he was not
 * looking at, which is why a genuine hang could not be found in it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const worker = (() => {
  const start = source.indexOf("const STALL_WORKER_SOURCE = `");
  assert.ok(start > 0, "the stall worker is gone");
  return source.slice(start, source.indexOf("`;", start));
})();

check("the page announces visibility the moment it changes", () => {
  /*
   * It cannot be left to the beat: by the time the throttled beat next runs,
   * the gap already looks like a freeze. The announcement goes out before
   * throttling can begin.
   */
  assert.match(source, /document\.addEventListener\("visibilitychange", announceVisibility\)/);
  assert.match(
    source,
    /worker\.postMessage\(\{ type: "visibility", hidden: document\.visibilityState === "hidden" \}\)/,
    "the visibility announcement does not carry the state",
  );
});

check("the worker acts on that announcement", () => {
  assert.match(worker, /if \(message\.type === "visibility"\)/, "the worker ignores visibility");
  assert.match(worker, /paused = message\.hidden === true;/);
});

check("no gap accrues while hidden", () => {
  // The baseline slides forward instead, so returning to the tab cannot
  // resolve into a stall the length of the time spent away.
  assert.match(
    worker,
    /if \(paused\) \{ lastBeat = Date\.now\(\); return; \}/,
    "a hidden page still accumulates a gap against its last beat",
  );
});

check("a late beat that says it was hidden resyncs instead of reporting", () => {
  // Belt and braces for a missed announcement - a page killed mid-hide, or a
  // browser that fires visibilitychange late.
  assert.match(source, /hidden: document\.visibilityState === "hidden",/, "the beat does not carry visibility");
  assert.match(worker, /if \(message\.hidden === true\) \{[\s\S]{0,160}?return;/, "a hidden beat can still close a stall");
});

check("a real stall is still reported", () => {
  /*
   * The point of the watchdog survives: a visible page whose beats stop is
   * still a stall, still reported from the worker's own thread while the page
   * is wedged, and still resolved to a true duration on recovery.
   */
  assert.match(worker, /self\.postMessage\(\{ type: "recovered", stalledMs: message\.at - stallFrom, state \}\)/);
  assert.match(worker, /if \(!reported && gap > 5000 && endpoint\)/, "the in-stall report is gone");
  assert.match(source, /const STALL_RECORD_FLOOR_MS = 1_500;/, "the jank floor moved");
});

check("the polluted ring is not read as history", () => {
  // Every v1 record was a backgrounded tab. Starting a new key is what stops
  // twenty false positives being mistaken for evidence.
  assert.match(source, /const STALL_KEY = "kwantdesk:renderer-health:stalls:v2";/);
});

console.log(`\nstall watchdog: ${passed}/${passed} checks passed`);
