import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { conditionalJson, payloadETag, requestMatchesETag } =
  await import("../src/lib/conditionalJson.ts");

/**
 * Not re-sending bytes the browser already holds.
 *
 * One month measured 795 GB of origin transfer at $61.69, because the heavy
 * market-data routes answered `no-store` and dragged their whole body out of
 * origin on every poll - including when the server was replying from a cache
 * entry it had already sent, unchanged, seconds earlier.
 *
 * `private` throughout: these responses sit behind a session check and must
 * never enter a shared cache. The saving comes from not resending what the
 * client has, never from widening who may read it.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };
const read = (p) => readFileSync(new URL(`../src/app/api/${p}`, import.meta.url), "utf8");

const HEAVY = {
  "databento/market/route.ts": "chart history - the largest body we serve",
  "gex-map/route.ts": "the exposure ladder, polled by every open panel",
  "gex-interval-map/route.ts": "the interval surface",
  "market-indices/route.ts": "the ticker, polled every four seconds",
};

check("every heavy route revalidates instead of re-sending", () => {
  for (const [route, why] of Object.entries(HEAVY)) {
    const source = read(route);
    assert.match(source, /conditionalJson\(/, `${route} (${why}) still re-sends its body`);
  }
});

check("no heavy route still answers no-store on a success path", () => {
  /*
   * `no-store` forbids the browser from KEEPING the copy, so a route can carry
   * a perfectly good ETag and still never get a match - which is exactly what
   * the interval map was doing: it computed a revision tag and sent no-store
   * beside it.
   */
  for (const route of Object.keys(HEAVY)) {
    const source = read(route);
    const successNoStore = source.match(/"Cache-Control": "private, no-store[^"]*"/g) ?? [];
    // Error responses may keep no-store; success payloads may not. Any survivor
    // sitting next to a 200 is the bug this guards.
    for (const header of successNoStore) {
      const at = source.indexOf(header);
      const context = source.slice(Math.max(0, at - 400), at);
      assert.ok(
        /status: (4|5)\d\d|status: problem\.status/.test(context),
        `${route} still sends ${header} on a success path`,
      );
    }
  }
});

check("a matching tag returns 304 with no body", () => {
  const etag = payloadETag("surface::123");
  const request = new Request("https://example.test/api/gex-map", {
    headers: { "if-none-match": etag },
  });
  const response = conditionalJson(request, { big: "payload" }, { identity: "surface::123" });
  assert.equal(response.status, 304);
  assert.equal(response.body, null, "a 304 carried a body");
  assert.equal(response.headers.get("ETag"), etag);
});

check("a changed payload is sent in full", () => {
  const request = new Request("https://example.test/api/gex-map", {
    headers: { "if-none-match": payloadETag("surface::123") },
  });
  const response = conditionalJson(request, { big: "payload" }, { identity: "surface::124" });
  assert.equal(response.status, 200, "a moved surface was answered 304");
});

check("nothing is ever offered to a shared cache", () => {
  // These sit behind a session check. `public` here would hand one trader's
  // positioning surface to the next request through a CDN.
  const request = new Request("https://example.test/api/gex-map");
  const response = conditionalJson(request, { a: 1 }, { identity: "x", maxAgeMs: 30_000 });
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  assert.match(cacheControl, /^private,/, `not private: ${cacheControl}`);
  assert.doesNotMatch(cacheControl, /public|s-maxage/);
  assert.match(cacheControl, /max-age=30/);
});

check("a weak tag from a cache still matches", () => {
  // Caches are allowed to add the W/ prefix to a tag they stored.
  const etag = payloadETag("x");
  const bare = etag.replace(/^W\//, "");
  const request = new Request("https://example.test/", { headers: { "if-none-match": bare } });
  assert.equal(requestMatchesETag(request, etag), true);
});

console.log(`\norigin transfer: ${passed}/${passed} checks passed`);
