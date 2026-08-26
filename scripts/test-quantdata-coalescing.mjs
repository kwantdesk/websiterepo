import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Identical QuantData requests in flight must be joined, not re-issued.
 *
 * Every request takes a slot in a process-wide 80ms queue:
 *
 *   let qdNextStartMs = 0;
 *   const start = Math.max(Date.now(), qdNextStartMs);
 *   qdNextStartMs = start + QD_MIN_SPACING_MS;
 *
 * That counter only moves FORWARD, so a burst pushes it into the future and
 * everything behind it inherits the debt. Measured on production, the same GEX
 * Map request took 16,130ms while the desk was loading and 1,164ms once the
 * burst had drained - the wait was our own queue, not the provider.
 *
 * The promise was registered only when a caller passed a ttl, and ttlMs
 * defaults to 0. So by default four panes asking for the same SPX GAMMA panel
 * at the same moment sent four upstream requests and burned four slots. The
 * provider's own counters showed it: 1,301 cache hits against 26,564 requests.
 */

const source = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const post = source.slice(
  source.indexOf("function quantDataPost("),
  source.indexOf("/**\n * Server-only Dark Pool Map adapters"),
);

check("the function was found", () => {
  assert.ok(post.length > 0 && post.length < 3_000, `slice looks wrong: ${post.length} chars`);
});

check("every request is registered, not only ttl'd ones", () => {
  // THE BUG: `if (ttlMs > 0) endpointCache.set(...)` meant no coalescing at all
  // by default, because ttlMs defaults to 0.
  assert.doesNotMatch(post, /if \(ttlMs > 0\) endpointCache\.set/);
  assert.match(post, /endpointCache\.set\(cacheKey, \{\s*\n\s*expiresAt: ttlMs > 0 \? Date\.now\(\) \+ ttlMs : Number\.POSITIVE_INFINITY,/,
    "an in-flight request must be joinable regardless of ttl");
});

check("a coalesced entry is dropped once it settles", () => {
  // Coalescing is not caching. Without a ttl the entry must not outlive the
  // request, or the next caller gets a stale surface forever.
  assert.match(post, /if \(ttlMs <= 0\) \{/);
  assert.match(post, /void promise\.finally\(\(\) => \{/);
  assert.match(post, /if \(endpointCache\.get\(cacheKey\)\?\.promise === promise\) endpointCache\.delete\(cacheKey\);/,
    "the identity guard stops a slow response evicting a newer registration");
});

check("a ttl still caches as before", () => {
  assert.match(post, /Date\.now\(\) \+ ttlMs/);
  const cacheHit = post.slice(0, post.indexOf("const promise ="));
  assert.match(cacheHit, /if \(cached && cached\.expiresAt > Date\.now\(\)\) return cached\.promise;/);
});

check("a failure is still evicted", () => {
  // A cached rejection would pin the failure for every later caller.
  assert.match(post, /\.catch\(\(error\) => \{\s*\n\s*endpointCache\.delete\(cacheKey\);\s*\n\s*throw error;/);
});

check("the key is the request, so different requests never share", () => {
  assert.match(post, /const cacheKey = `\$\{path\}:\$\{JSON\.stringify\(body\)\}`;/);
});

check("the scheduler it protects is still there", () => {
  // If the spacing ever goes away this test is guarding nothing.
  assert.match(source, /const QD_MIN_SPACING_MS = 80;/);
  assert.match(source, /qdNextStartMs = start \+ QD_MIN_SPACING_MS;/);
});

check("a chart's own candles jump the queue", () => {
  // Measured on GEX VUE: a pane's price history took 20,041ms and 25,674ms -
  // past the client's timeout AND past its retry - while GEX panels on the same
  // page were served ahead of it. The chart cannot draw a candle without that
  // response; a GEX panel decorates a chart that does not exist yet.
  const scheduler = source.slice(source.indexOf("async function qdSchedule"), source.indexOf("async function quantDataNetworkPost"));
  assert.match(scheduler, /async function qdSchedule\(priority = false\)/);
  assert.match(scheduler, /if \(priority\) \{/);
  // A priority request takes the NEXT slot rather than joining the end.
  assert.match(scheduler, /Math\.min\(qdNextStartMs, now \+ QD_MIN_SPACING_MS\)/);
  // The provider still sees the same spacing: the rate limit is unchanged and
  // only the ORDER differs. If this stopped advancing, priority traffic would
  // bypass the limiter entirely and trip the provider's per-second cap.
  assert.match(scheduler, /qdNextStartMs = Math\.max\(qdNextStartMs, start\) \+ QD_MIN_SPACING_MS;/);

  // Both chart-history paths are marked, and nothing else is. Read the real
  // argument list by matching brackets - a window regex runs straight past the
  // closing paren into the next call, and parseCandles(payload, true) sitting
  // on the following line looks exactly like a priority argument.
  const priorityCalls = [];
  for (let at = source.indexOf("quantDataPost("); at !== -1; at = source.indexOf("quantDataPost(", at + 1)) {
    const open = source.indexOf("(", at);
    let depth = 0;
    let end = open;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "(" || char === "[" || char === "{") depth += 1;
      else if (char === ")" || char === "]" || char === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const call = source.slice(open + 1, end);
    // Top-level commas only: the body object and the path are full of others.
    const args = [];
    let start = 0;
    depth = 0;
    for (let i = 0; i < call.length; i += 1) {
      const char = call[i];
      if (char === "(" || char === "[" || char === "{") depth += 1;
      else if (char === ")" || char === "]" || char === "}") depth -= 1;
      else if (char === "," && depth === 0) { args.push(call.slice(start, i)); start = i + 1; }
    }
    args.push(call.slice(start));
    if (args.length >= 4 && args[3].trim().replace(/,$/, "") === "true") {
      priorityCalls.push(args[0].trim());
    }
  }
  assert.equal(priorityCalls.length, 2, `only chart history may be priority, found ${priorityCalls.length}`);
  for (const path of priorityCalls) {
    assert.ok(path.includes("stock-price-over-time"), `priority is for candles only, not ${path}`);
  }
});

console.log(`\nquantdata coalescing: ${passed}/${passed} checks passed`);
