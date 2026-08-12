import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspace = await readFile(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/chart-gamma-levels/route.ts", import.meta.url), "utf8");

test("Kwant Levels survive reloads and transient network failures", () => {
  assert.match(workspace, /\[window\.sessionStorage, window\.localStorage\]/);
  assert.match(workspace, /attempt < 3/);
  assert.match(workspace, /500 \* \(2 \*\* attempt\)/);
  assert.match(workspace, /previous\?\.payload/);
});

test("Kwant Levels use a shared stale-while-revalidate market snapshot", () => {
  assert.match(route, /Vercel-CDN-Cache-Control/);
  assert.match(route, /s-maxage=15, stale-while-revalidate=120/);
  assert.match(route, /s-maxage=300, stale-while-revalidate=21600/);
});
