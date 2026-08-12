import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("chart startup market reads bypass remote Supabase refresh only after site access", async () => {
  const middleware = await readFile(new URL("middleware.ts", root), "utf8");

  for (const pathname of [
    "/api/cme-history",
    "/api/databento/live",
    "/api/databento/value-area",
    "/api/chart-gamma-levels",
  ]) {
    assert.match(middleware, new RegExp(pathname.replaceAll("/", "\\/")));
  }
  assert.match(
    middleware,
    /siteAccessConfigured && siteAccessGranted && isFastMarketRead\(pathname\)/,
  );
  assert.ok(
    middleware.indexOf("siteAccessConfigured && !siteAccessGranted")
      < middleware.indexOf("siteAccessConfigured && siteAccessGranted && isFastMarketRead(pathname)"),
    "the site-access rejection must run before the live-market fast path",
  );
});

test("chart gamma accepts the signed site-access gate without waiting on Supabase", async () => {
  const route = await readFile(
    new URL("src/app/api/chart-gamma-levels/route.ts", root),
    "utf8",
  );

  assert.match(route, /isValidSiteAccessToken/);
  assert.match(route, /request\.cookies\.get\(SITE_ACCESS_COOKIE\)\?\.value/);
  assert.ok(
    route.indexOf("isValidSiteAccessToken") < route.indexOf("supabase.auth.getUser"),
    "the local signed gate must be checked before remote Supabase auth",
  );
});
