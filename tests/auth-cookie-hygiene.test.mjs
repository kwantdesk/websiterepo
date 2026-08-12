import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("middleware accepts only the active Supabase cookie family and expires obsolete projects", async () => {
  const source = await readFile(new URL("middleware.ts", root), "utf8");
  assert.match(source, /supabaseAuthCookieName/);
  assert.match(source, /belongsToAuthCookie/);
  assert.match(source, /expireObsoleteSupabaseCookies/);
  assert.match(source, /filter\(\(cookie\) => belongsToAuthCookie\(cookie\.name, activeAuthCookie\)\)/);
});

test("cookie recovery bypasses middleware and clears browser-readable auth chunks", async () => {
  const [middleware, recovery] = await Promise.all([
    readFile(new URL("middleware.ts", root), "utf8"),
    readFile(new URL("public/cookie-recovery.html", root), "utf8"),
  ]);
  assert.match(middleware, /cookie-recovery\.html/);
  assert.match(recovery, /name\.startsWith\('sb-'\)/);
  assert.match(recovery, /Max-Age=0/);
  assert.match(recovery, /location\.replace\('\/login\?recovered=1'\)/);
});
