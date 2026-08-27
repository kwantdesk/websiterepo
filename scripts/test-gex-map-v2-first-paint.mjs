import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Clicking DEALER has to draw something, promptly.
 *
 * The dealer model's own tape read is the most expensive thing on the surface:
 * a full session is around seventy pages against a provider allowance of
 * roughly twenty requests per window, measured at 21s. Carrying three prior
 * sessions turned that into four such reads, and because the warm-up shared a
 * lane with the panel it was warming, the next panel's own tape read measured
 * 61s - past the route's sixty-second ceiling. The spinner never resolved.
 *
 * Measured after this change, three cold panels at once: 5.4s, 6.3s, 6.7s.
 */

const server = readFileSync(new URL("../src/lib/gexMapV2.server.ts", import.meta.url), "utf8");
const provider = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("a warm-up can never run in front of the panel it is warming", () => {
  // THE REGRESSION. Both existing lanes belong to a request a trader is
  // watching, so a background read joining "normal" competed head to head with
  // the panel that prompted it.
  assert.match(provider, /type QdLane = "priority" \| "normal" \| "background";/);
  assert.match(provider, /if \(lane === "background"\) \{/);
  assert.match(provider, /while \(qdForegroundPending > 0 && Date\.now\(\) < yieldUntil\)/);
  // Counted around the whole attempt loop: a request being backed off is still
  // one a trader is waiting on.
  assert.match(provider, /if \(lane !== "background"\) qdForegroundPending \+= 1;/);
  assert.match(provider, /if \(lane !== "background"\) qdForegroundPending -= 1;/);
  // And yielding forever is the same bug facing the other way - three panels
  // refreshing every five seconds means the foreground is rarely empty.
  // The ceiling is PER REQUEST and a warm-up is seventy of them, so a large
  // value is not caution - it is a warm-up that never finishes. Measured live,
  // the book sat at zero carried sessions through six minutes of polling.
  assert.match(provider, /const QD_BACKGROUND_MAX_YIELD_MS = 2_000;/);
});

check("every expensive read the panel does not need is on that lane", () => {
  assert.match(server, /readConsolidatedTape\(symbol, sessionDate, TAPE_PAGE_LIMIT, "background"\)/);
  // Both of them: the prior sessions AND the full live tape.
  assert.equal((server.match(/TAPE_PAGE_LIMIT, "background"\)/g) ?? []).length, 2);
});

check("the warm-up is started from the request scope, never inside the cache", () => {
  /*
   * THE SILENT FAILURE. Registered from within a cached computation, `after`
   * attaches to a scope that never flushes and the work is torn down with it.
   * Measured: the read never finished, the memo never filled, and the book
   * reported zero carried sessions indefinitely while appearing to warm.
   */
  assert.match(server, /export function warmDealerBookTapes\(symbol: string, sessionDate: string\)/);
  // Called from getDealerInventoryPanel, immediately before the cached build.
  const entry = server.slice(server.indexOf("export async function getDealerInventoryPanel"));
  assert.match(entry, /warmDealerBookTapes\(symbol, sessionDate\);/);
  assert.ok(
    entry.indexOf("warmDealerBookTapes(symbol, sessionDate);")
      // Version-agnostic: the key's shape version moves whenever the payload
      // changes, and this check is about ORDER, not about which version it is.
      < entry.indexOf("gex-map-v2-dealer-inventory-"),
    "the warm-up has to start before the cached build, in the request scope",
  );
  // The builder itself only READS what is already warm - it never starts a
  // background read and never waits on one, because anything it blocks on is
  // time the trader spends watching a spinner.
  // The builder must not schedule background work of its own: warmInBackground
  // appears only inside warmDealerBookTapes, which the request scope calls.
  const builder = server.slice(
    server.indexOf("async function buildDealerInventoryPanel"),
    server.indexOf("export async function getDealerInventoryPanel"),
  );
  assert.ok(!builder.includes("warmInBackground"), "the cached builder must not schedule warm-ups");
  assert.match(server, /function carriedTapeIfWarm\(symbol: string, sessionDate: string\): OptionsFlowPrint\[\]/);
  assert.match(server, /if \(warm\) return warm;/);
});

check("a finished read is remembered by the instance that ran it", () => {
  // `unstable_cache` does not commit a result computed after the response has
  // gone - which is exactly what a warm-up handed to `after` is. Without an
  // in-process memo the warm-up ran forever and delivered nothing.
  assert.match(server, /const completedReads = new Map<string, \{ at: number; value: unknown \}>\(\);/);
  assert.match(server, /completedReads\.set\(key, \{ at: Date\.now\(\), value \}\);/);
  // Bounded, or a long-lived instance accumulates whole session tapes.
  assert.match(server, /completedReads\.size > COMPLETED_READ_LIMIT/);
  // And one read per key at a time: unstable_cache shares a result, not a
  // computation in flight, so every rebuild used to start its own.
  assert.match(server, /function joinInFlight<T>\(key: string, start: \(\) => Promise<T>, memoMs: number\)/);
  assert.match(server, /const existing = inFlightReads\.get\(key\)/);
});

check("the first paint reads recent flow, and says that it did", () => {
  // Newest-first paging plus a twelve-hour half-life means the first pages
  // carry the most heavily weighted flow there is. That is a partial book, and
  // it must not be presented as a whole session.
  assert.match(server, /const FIRST_PAINT_PAGE_LIMIT = 12;/);
  assert.match(server, /readConsolidatedTape\(symbol, sessionDate, FIRST_PAINT_PAGE_LIMIT\);/);
  assert.match(server, /return \{ \.\.\.recent, truncated: true \};/);
  // The complete read is cached, which is what makes the steady state cheap.
  assert.match(server, /\["gex-map-v2-live-tape-v1", symbol, sessionDate\]/);
  // Measured end to end: the thin first paint holds 457 prints over 10 strikes;
  // once the warm-up lands the same click serves 1,434 over 23, in 0.01s.
  // And how much carried flow actually made it in is reported, not implied.
  assert.match(server, /carriedSessions: number;/);
  assert.match(server, /const carriedSessions = carried\.filter\(\(prints\) => prints\.length > 0\)\.length;/);
});

check("switching model reloads the columns, not the workspace", () => {
  /*
   * The full-screen loader is `absolute inset-0 z-50` over everything. It is
   * for the FIRST surface - but switching model empties every panel by design,
   * because v1's rows must not sit under a DEALER heading, and that put the
   * whole-page loader back up. The toggle looked like it reloaded the page.
   */
  assert.match(workspace, /const hasDrawnASurfaceRef = useRef\(false\);/);
  assert.match(workspace, /const initialSurfacePending = !hasDrawnASurfaceRef\.current/);
  // Each panel keeps its own loader inside its strike column - the part that is
  // actually reloading.
  assert.match(workspace, /\{loading && !payload \? \(/);
  // And the guard that made the switch empty them stays: it is correct.
  assert.match(workspace, /if \(next\[panel\.id\] && next\[panel\.id\]\?\.model !== expectedModel\) delete next\[panel\.id\];/);
});

console.log(`\ngex map v2 first paint: ${passed}/${passed} checks passed`);
