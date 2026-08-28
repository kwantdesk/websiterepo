import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { resolveSessionSegments } = await import("../src/lib/volumeProfileSessions.ts");

/**
 * Filter/Split Time has to reach whichever backend actually builds the profile.
 *
 * There are two. The execution-profile builder applies the session windows
 * itself, but only answers while Databento is usable - which is not the normal
 * state here, the equities datasets 402. Everything else falls through to the
 * collector, which knows nothing about session filtering, and the route was
 * dropping the parameters on the way past.
 *
 * So the control appeared to work and did nothing. Measured on NQ for
 * 2026-08-27: filtering to RTH returned the whole trading date, 237,999
 * contracts, coverage running to 20:59 UTC - identical to no filter at all.
 * After the repair the same request returns 232,588 and stops at 20:14, one
 * minute inside the 20:15 RTH close.
 *
 * That is what made a KwantDesk profile disagree with DeepChart's by several
 * points at the same 68% and the same 4-tick grouping: not the maths, but two
 * different slices of the day.
 */

const route = readFileSync(
  new URL("../src/app/api/institutional-market-data/[...path]/route.ts", import.meta.url),
  "utf8",
);
const builder = readFileSync(new URL("../src/lib/databentoExecutionProfile.server.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const DAY_START = Date.UTC(2026, 7, 26, 22, 0);
const DAY_END = Date.UTC(2026, 7, 27, 21, 0);
const config = (mode, window = "rth") => ({
  mode,
  window,
  customStartMinutes: 510,
  customEndMinutes: 915,
  useEndSessionAsStartDay: false,
});

check("a daily RTH filter resolves to exactly one window", () => {
  // One window is the case the proxy can express as a narrower request, so it
  // is the case that has to hold.
  const segments = resolveSessionSegments(DAY_START, DAY_END, config("filter"));
  assert.equal(segments.length, 1, "a single trading date should produce one RTH span");
  assert.equal(new Date(segments[0].startMs).toISOString(), "2026-08-27T13:30:00.000Z");
  assert.equal(new Date(segments[0].endMs).toISOString(), "2026-08-27T20:15:00.000Z");
});

check("no filtering resolves to no windows", () => {
  assert.deepEqual(resolveSessionSegments(DAY_START, DAY_END, config("none")), []);
});

check("a week of RTH is several windows, not one", () => {
  /*
   * This is why the proxy refuses to narrow multi-window requests: a weekly RTH
   * profile is five spans with the overnights cut out of the middle, and no
   * single start/end can say that. Narrowing to the outer bounds would quietly
   * put back exactly what the filter was asked to remove.
   */
  const weekStart = Date.UTC(2026, 7, 23, 22, 0);
  const segments = resolveSessionSegments(weekStart, DAY_END, config("filter"));
  assert.ok(segments.length > 1, `expected several RTH spans, got ${segments.length}`);
  const outerSpan = segments[segments.length - 1].endMs - segments[0].startMs;
  const covered = segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  assert.ok(covered < outerSpan * 0.9, "the outer bounds would include the overnights");
});

check("the proxy narrows a single window and forwards the narrowed one", () => {
  assert.match(route, /function sessionWindowForForwarding/, "the fall-through never resolves a window");
  assert.match(route, /segments\.length === 1 \? segments\[0\] : null/, "multi-window requests are not refused");
  assert.match(route, /forwarded\.searchParams\.set\("startMs"/, "the narrowed start is never applied");
  assert.match(route, /forwarded\.searchParams\.set\("endMs"/, "the narrowed end is never applied");
  // And the narrowed URL is what actually goes upstream.
  assert.match(route, /`\$\{path\}\$\{forwarded\.search\}`/, "the original search is still forwarded");
  assert.doesNotMatch(route, /`\$\{path\}\$\{request\.nextUrl\.search\}`/, "the unnarrowed search survived");
});

check("the execution builder keeps its own filtering, keyed by the windows", () => {
  /*
   * The other backend filters directly. Its memo key left the session windows
   * out, so the first unfiltered answer for a window was replayed for every
   * later filtered request - the same symptom by a different route.
   */
  assert.match(builder, /isWithinSessionSegments\(timestampMs, sessionSegments\)/, "the builder stopped filtering");
  assert.match(builder, /const segmentKey = \(args\.sessionSegments \?\? \[\]\)/, "the windows are not in the memo key");
  assert.match(builder, /segmentKey,\s*\n\s*\]\.join\(":"\)/, "the segment key is computed but never used");
});

console.log(`\nvolume profile session filter: ${passed}/${passed} checks passed`);
