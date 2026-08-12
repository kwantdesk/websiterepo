import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const historySource = await readFile(new URL("../src/lib/chartHistoryCache.ts", import.meta.url), "utf8");
const hygieneSource = await readFile(new URL("../src/lib/clientStorageHygiene.ts", import.meta.url), "utf8");

test("browser market history has a global byte and record budget", () => {
  assert.match(historySource, /MAX_PERSISTENT_CACHE_BYTES\s*=\s*48\s*\*\s*1024\s*\*\s*1024/);
  assert.match(historySource, /MAX_PERSISTENT_CACHE_RECORDS\s*=\s*36/);
  assert.match(historySource, /store\.delete\(key\)/);
});

test("storage hygiene only removes disposable market caches", () => {
  assert.match(hygieneSource, /pruneChartHistoryCache\(true\)/);
  assert.match(hygieneSource, /kwantify-indicator-data-v1/);
  assert.doesNotMatch(hygieneSource, /indexedDB\.deleteDatabase\(["']kwantdesk-(journal|socials)/);
});
