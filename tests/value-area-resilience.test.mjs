import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  new URL("../src/app/api/databento/value-area/route.ts", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url),
  "utf8",
);

test("value area survives a delayed Databento close without hiding every level", () => {
  assert.match(route, /recordedWindowProfile\(symbol, latestDaily\)/);
  assert.match(route, /availableEndMs[\s\S]*continue;/);
  assert.match(route, /fellBackFromLatestDaily/);
  assert.match(route, /now \+ 5 \* 60_000/);
  assert.match(route, /cacheEntry\.expiresAt = Number\.isFinite\(payloadRefreshAt\)/);
});

test("a recorded profile must pass explicit integrity checks", () => {
  assert.match(route, /Number\(profile\.integrityGaps \?\? 0\) === 0/);
  assert.match(route, /Number\(profile\.droppedMessages \?\? 0\) === 0/);
});

test("live value-area refreshes reuse the edge cache while stale rows remain visible", () => {
  assert.match(route, /public, s-maxage=60, stale-while-revalidate=86400/g);
  assert.doesNotMatch(workspace, /\/api\/databento\/value-area[^\n]+[\s\S]{0,100}cache: "no-store"/);
  assert.match(workspace, /payload: previous\?\.payload/);
});
