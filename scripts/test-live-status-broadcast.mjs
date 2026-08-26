import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A status broadcast must cost something only when the status changes.
 *
 * markStreamAlive() runs on every server signal and called this on every one.
 * Measured on production, on a TWO-pane chart in pre-market:
 *
 *   databento-status   46.9/s
 *   paper-mark-quote   38.6/s
 *   databento-tick     19.3/s
 *
 * Roughly two and a half status broadcasts per tick, each a CustomEvent waking
 * every listener in every open workspace — Gameplan, GexDesk, GexView and the
 * rest — to be told the feed is still live. Status is a small enum. The
 * expensive React updates behind it were already guarded; the guard simply sat
 * AFTER the dispatch.
 *
 * It scales with panes and with tick rate, which is exactly backwards: the
 * busier the market and the more charts open, the more work is spent saying
 * nothing changed.
 */

const events = readFileSync(new URL("../src/lib/chartLiveEvents.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const publisher = events.slice(
  events.indexOf("export function publishDatabentoLiveStatus"),
  events.indexOf("export function readDatabentoLiveStatus"),
);

check("the publisher was found", () => {
  assert.ok(publisher.length > 0 && publisher.length < 2_000);
});

check("an unchanged status is not broadcast", () => {
  assert.match(publisher, /const previous = latestDatabentoLiveStatus\?\.status;/);
  assert.match(publisher, /if \(typeof window === "undefined" \|\| previous === status\) return;/,
    "re-announcing the same value is the whole cost");
});

check("the freshness stamp still advances every time", () => {
  // readDatabentoLiveStatus treats a stale stamp as "no status at all", so a
  // live feed must keep saying it is alive even when the value has not moved.
  // Skipping the whole function on an unchanged status would make the feed read
  // as dead after maxAgeMs.
  const assign = publisher.slice(publisher.indexOf("latestDatabentoLiveStatus = {"), publisher.indexOf("// The BROADCAST"));
  assert.match(assign, /updatedAt: Date\.now\(\),/);
  // And the stamp must be written BEFORE the early return, or it never happens
  // for the common case.
  assert.ok(
    publisher.indexOf("updatedAt: Date.now()") < publisher.indexOf("previous === status"),
    "the stamp has to be written before the early return",
  );
});

check("the reader still expires a stale status", () => {
  const reader = events.slice(events.indexOf("export function readDatabentoLiveStatus"));
  assert.match(reader, /Date\.now\(\) - latestDatabentoLiveStatus\.updatedAt > maxAgeMs/);
  assert.match(reader, /return null;/);
});

console.log(`\nlive status broadcast: ${passed}/${passed} checks passed`);
