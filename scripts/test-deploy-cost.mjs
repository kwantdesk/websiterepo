import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { conditionalJson, payloadETag, requestMatchesETag } from "../src/lib/conditionalJson.ts";

/**
 * The two biggest lines on the August infrastructure invoice.
 *
 *   Build CPU Minutes   16d 1h 16m   $80.91
 *   Fast Origin Transfer   612 GB    $48.68   (494 GB via cache cost $0.00)
 *
 * Builds ran for pushes that cannot change a byte of what is served. And the
 * heavy market-data routes were marked `private, no-store`, so every poll from
 * every pane pulled the whole surface out of origin again — the gamma heatmap
 * is 3.46 MB every thirty seconds per pane, for data that changes once a
 * minute.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const asRequest = (headers = {}) => new Request("https://kwantdesk.com/api/gamma-heatmap", { headers });

check("an unchanged surface comes back as a bodiless 304", () => {
  // THE SAVING. Same identity in, no payload out.
  const identity = "NQ:GAMMA:hybrid:24:5:2026-08-26T14:30:00Z";
  const first = conditionalJson(asRequest(), { big: "payload" }, { identity, maxAgeMs: 30_000 });
  assert.equal(first.status, 200);
  const etag = first.headers.get("etag");
  assert.ok(etag, "a 200 must carry the tag the client will send back");

  const second = conditionalJson(asRequest({ "if-none-match": etag }), { big: "payload" }, { identity, maxAgeMs: 30_000 });
  assert.equal(second.status, 304);
  assert.equal(second.body, null, "a 304 must carry no body at all");
  assert.equal(second.headers.get("etag"), etag);
});

check("a surface that HAS changed is sent in full", () => {
  // The correctness half: a new asOf must never revalidate into a 304.
  const stale = payloadETag("NQ:GAMMA:2026-08-26T14:30:00Z");
  const fresh = conditionalJson(
    asRequest({ "if-none-match": stale }),
    { big: "newer" },
    { identity: "NQ:GAMMA:2026-08-26T14:31:00Z", maxAgeMs: 30_000 },
  );
  assert.equal(fresh.status, 200, "changed data must be delivered");
  assert.notEqual(fresh.headers.get("etag"), stale);
});

check("the response stays private, so the auth boundary does not move", () => {
  // These routes sit behind a session check. Sharing them at a CDN would let a
  // request that never passed that check read the body — the saving has to
  // come from not RESENDING bytes, not from widening who may read them.
  const response = conditionalJson(asRequest(), { a: 1 }, { identity: "x", maxAgeMs: 30_000 });
  const cacheControl = response.headers.get("cache-control");
  assert.match(cacheControl, /(^|,\s*)private(,|$)/, "must be private");
  assert.doesNotMatch(cacheControl, /public/, "must never be publicly cacheable");
  assert.doesNotMatch(cacheControl, /s-maxage/, "must not be held by a shared cache");
  assert.match(cacheControl, /must-revalidate/, "a stale copy must not be served after the window");
});

check("the browser may reuse its copy for the data's own refresh window", () => {
  // This is what stops four panes on one URL making four requests.
  assert.match(
    conditionalJson(asRequest(), { a: 1 }, { identity: "x", maxAgeMs: 30_000 }).headers.get("cache-control"),
    /max-age=30(,|$)/,
  );
  // Never longer than the data's own cadence, so no pane shows a surface older
  // than the one the server would hand it.
  assert.match(
    conditionalJson(asRequest(), { a: 1 }, { identity: "x", maxAgeMs: 5_000 }).headers.get("cache-control"),
    /max-age=5(,|$)/,
  );
  assert.match(
    conditionalJson(asRequest(), { a: 1 }, { identity: "x" }).headers.get("cache-control"),
    /max-age=0(,|$)/,
    "no window given means always revalidate",
  );
});

check("it reads If-None-Match the way a cache actually writes it", () => {
  const etag = payloadETag("some-identity");
  assert.ok(requestMatchesETag(asRequest({ "if-none-match": etag }), etag));
  // A cache may add the weak prefix to a tag it stored.
  assert.ok(requestMatchesETag(asRequest({ "if-none-match": etag.replace(/^W\//, "") }), etag));
  // And may send several.
  assert.ok(requestMatchesETag(asRequest({ "if-none-match": `"other", ${etag}` }), etag));
  assert.ok(requestMatchesETag(asRequest({ "if-none-match": "*" }), etag));
  assert.ok(!requestMatchesETag(asRequest({ "if-none-match": '"nope"' }), etag));
  assert.ok(!requestMatchesETag(asRequest(), etag), "no header is not a match");
});

check("the tag is derived, not hashed from the body", () => {
  // Hashing several megabytes on every request would cost more CPU than the
  // transfer it saves, so the tag comes from the cache key plus asOf.
  const route = readFileSync(new URL("../src/app/api/gamma-heatmap/route.ts", import.meta.url), "utf8");
  // The SURFACE must be revalidatable. An error still must not be cached at
  // all — a transient provider failure that stuck around for thirty seconds
  // would be worse than the transfer it saved.
  const noStoreLines = route.split("\n").filter((line) => line.includes("no-store"));
  assert.equal(noStoreLines.length, 1, "only one response may still refuse caching");
  assert.match(noStoreLines[0], /error: problem\.message/, "and it must be the error path");
  assert.match(route, /identity: `\$\{key\}:\$\{(cached\.)?payload\.asOf\}`/,
    "identity must be the cache key plus the surface's own freshness stamp");
  // Both the fresh build AND the in-memory hit must revalidate, or half the
  // polls still ship the whole surface.
  assert.equal((route.match(/conditionalJson\(/g) ?? []).length, 2, "both return paths must use it");
  const helper = readFileSync(new URL("../src/lib/conditionalJson.ts", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /update\(JSON\.stringify/, "the tag must not be hashed from the body");
});

/** Run the Vercel ignore step against a synthetic commit range. */
function shouldBuild(files) {
  const dir = mkdtempSync(join(tmpdir(), "kd-build-"));
  const run = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  try {
    run("init", "-q");
    run("config", "user.email", "t@t");
    run("config", "user.name", "t");
    writeFileSync(join(dir, "seed"), "seed");
    run("add", "-A"); run("commit", "-qm", "seed");
    const previous = run("rev-parse", "HEAD").trim();
    for (const file of files) {
      const full = join(dir, file);
      execFileSync("node", ["-e", `require("fs").mkdirSync(require("path").dirname(${JSON.stringify(full)}),{recursive:true})`]);
      writeFileSync(full, "x");
    }
    run("add", "-A"); run("commit", "-qm", "change");
    const head = run("rev-parse", "HEAD").trim();
    const script = join(process.cwd(), "scripts", "vercel-should-build.sh");
    try {
      execFileSync("sh", [script], {
        cwd: dir,
        env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previous, VERCEL_GIT_COMMIT_SHA: head },
        encoding: "utf8",
      });
      return false; // exit 0 = skip
    } catch {
      return true;  // exit 1 = build
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

check("a commit that only touches unshipped paths skips the build", () => {
  // None of these reach the deployed app.
  assert.equal(shouldBuild(["scripts/test-something.mjs"]), false);
  assert.equal(shouldBuild(["docs/notes.md", "CLAUDE.md"]), false);
  assert.equal(shouldBuild(["tests/thing.test.mjs", "scripts/a.mjs", "README.md"]), false);
});

check("anything that ships still builds", () => {
  assert.equal(shouldBuild(["src/components/Chart.tsx"]), true);
  assert.equal(shouldBuild(["package.json"]), true);
  assert.equal(shouldBuild(["vercel.json"]), true);
  assert.equal(shouldBuild(["public/heatmap-app/index.html"]), true);
  // A mixed commit builds — the source half of it matters.
  assert.equal(shouldBuild(["scripts/test-a.mjs", "src/lib/thing.ts"]), true);
});

check("when it cannot tell, it builds", () => {
  // A wrongly skipped deploy is worse than a wasted one.
  const script = join(process.cwd(), "scripts", "vercel-should-build.sh");
  let built = false;
  try {
    execFileSync("sh", [script], { env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: "", VERCEL_GIT_COMMIT_SHA: "abc" }, encoding: "utf8" });
  } catch { built = true; }
  assert.ok(built, "no previous commit must build");
});

console.log(`\ndeploy cost: ${passed}/${passed} checks passed`);
