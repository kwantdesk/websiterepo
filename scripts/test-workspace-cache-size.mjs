import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateWorkspaceEntryBytes } from "../src/lib/workspaceDataCache.ts";

/**
 * The cache can only bound what it can measure.
 *
 * Its byte cap was fed by a function that recognised three payload shapes and
 * fell back to a flat 64 KB for everything else. The interval map is one of
 * the "everything else": 1.81 MB on the wire counted as 0.06 MB, a 29x
 * under-count, so the byte cap could never fire for it and only the
 * eight-entry limit did any bounding. Several of those parsed at once is tens
 * of megabytes the cache believed was half a megabyte — on a session whose
 * heap reached 2.6 GB.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** A payload shaped like the interval map: no snapshots, frames or levels. */
function intervalMapLike(frames, strikes) {
  return {
    schemaVersion: "kwantdesk-interval-map-v1",
    provider: "QuantData",
    sessionDate: "2026-08-24",
    intervals: Array.from({ length: frames }, (_, f) => ({
      timestamp: 1_700_000_000_000 + f * 60_000,
      rows: Array.from({ length: strikes }, (_, s) => ({
        strike: 20_000 + s * 25, call: s * 1.5, put: -s * 1.25, net: s * 0.25, volume: s * 10,
      })),
    })),
  };
}

check("a payload it has never seen is not called 64 kilobytes", () => {
  // The exact hole: an unrecognised shape got a flat guess.
  // 24,000 rows of five numbers each: about 120 bytes a row in V8, so a
  // couple of megabytes. The old fallback called this 64 KB — a 40x
  // under-count on a payload the cache was supposed to be bounding.
  const big = intervalMapLike(200, 120);
  const bytes = estimateWorkspaceEntryBytes(big);
  assert.ok(bytes > 2_000_000, `a 200x120 payload measured ${(bytes / 1048576).toFixed(2)}MB`);
  assert.ok(bytes / (64 * 1024) > 30, "it must be many times the flat fallback it used to get");
});

check("the estimate tracks the payload's actual size", () => {
  // Doubling the data must roughly double the estimate, or the cap drifts
  // from reality as payloads grow.
  const small = estimateWorkspaceEntryBytes(intervalMapLike(50, 100));
  const large = estimateWorkspaceEntryBytes(intervalMapLike(100, 100));
  const ratio = large / small;
  assert.ok(ratio > 1.7 && ratio < 2.3, `twice the data should be about twice the size, got ${ratio.toFixed(2)}x`);
});

check("a payload past the walk budget is still sized from what it holds", () => {
  // The budget stops the walk; it must not stop the answer. Extrapolating per
  // array is what makes a payload far past the budget come out near its real
  // size. 600,000 rows is 25x the 24,000-row payload above and must measure
  // about 25x as much, having walked the same 20,000 nodes of each.
  const small = estimateWorkspaceEntryBytes(intervalMapLike(200, 120));
  const huge = estimateWorkspaceEntryBytes(intervalMapLike(2_000, 300));
  const ratio = huge / small;
  assert.ok(ratio > 20 && ratio < 30, `25x the rows should be about 25x the bytes, got ${ratio.toFixed(1)}x`);
  assert.ok(huge > 50_000_000, `600,000 rows measured only ${(huge / 1048576).toFixed(0)}MB`);
});

check("measuring is cheap enough to run on every write", () => {
  const payload = intervalMapLike(400, 200);
  let best = Infinity;
  for (let run = 0; run < 5; run += 1) {
    const started = process.hrtime.bigint();
    estimateWorkspaceEntryBytes(payload);
    best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e6);
  }
  assert.ok(best < 25, `estimating cost ${best.toFixed(1)}ms, too slow for a cache write`);
});

check("it never stringifies the payload", () => {
  // JSON.stringify on these allocates a multi-megabyte throwaway string on
  // every refresh, which is the exact churn this cache exists to avoid.
  const source = readFileSync(new URL("../src/lib/workspaceDataCache.ts", import.meta.url), "utf8");
  const fn = source.slice(source.indexOf("export function estimateWorkspaceEntryBytes"), source.indexOf("function workspaceCacheBytes"));
  assert.doesNotMatch(fn, /JSON\.stringify/, "measuring must not allocate a copy of the payload");
});

check("small values stay small", () => {
  assert.ok(estimateWorkspaceEntryBytes({ ok: true }) <= 4_096);
  assert.ok(estimateWorkspaceEntryBytes(null) <= 4_096);
  assert.ok(estimateWorkspaceEntryBytes("short") <= 4_096);
});

check("the cache still bounds itself by bytes", () => {
  const source = readFileSync(new URL("../src/lib/workspaceDataCache.ts", import.meta.url), "utf8");
  assert.match(source, /WORKSPACE_DATA_CACHE_MAX_BYTES/, "the byte cap must still exist");
  assert.match(source, /entry\.bytes = estimateWorkspaceEntryBytes\(entry\.value\)/,
    "entries must be measured with the real estimator");
});

console.log(`\nworkspace cache size: ${passed}/${passed} checks passed`);
