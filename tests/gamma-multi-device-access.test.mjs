import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const middlewarePath = new URL("../middleware.ts", import.meta.url);
const gammaRoutePath = new URL("../src/app/api/options-flow/route.ts", import.meta.url);
const marketRoutePath = new URL("../src/app/api/options-flow/market-data/route.ts", import.meta.url);

test("Gamma APIs use the central authenticated middleware without a stale second cookie check", async () => {
  const [middleware, gammaRoute, marketRoute] = await Promise.all([
    readFile(middlewarePath, "utf8"),
    readFile(gammaRoutePath, "utf8"),
    readFile(marketRoutePath, "utf8"),
  ]);

  assert.match(middleware, /const apiRequest = pathname\.startsWith\("\/api\/"\)/);
  assert.match(middleware, /const \{ data \} = await supabase\.auth\.getUser\(\)/);
  assert.match(middleware, /if \(!data\.user \|\| !allowed\(data\.user\.email\)\)/);

  for (const source of [gammaRoute, marketRoute]) {
    assert.doesNotMatch(source, /createServerClient/);
    assert.doesNotMatch(source, /async function isAuthenticated/);
    assert.match(source, /getConfiguredQuantDataApiKey\(\)/);
  }
});
