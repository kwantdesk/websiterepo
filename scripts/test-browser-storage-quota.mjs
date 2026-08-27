import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  disposableStorageBytes,
  writeProtectedItem,
} from "../src/lib/browserStorageQuota.ts";

/**
 * A full browser quota must never cost the trader something they made.
 *
 * localStorage holds two very different things: workspaces, templates,
 * drawings and settings, which are WORK; and last-good provider payloads,
 * exposure frames and crash snapshots, which are CACHE and far larger. Saving
 * a workspace used to fail outright with "browser storage is full" while
 * megabytes of re-downloadable gamma frames sat beside it untouched.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** A localStorage with a real byte ceiling, so eviction is actually exercised. */
function fakeStore(limitBytes) {
  const map = new Map();
  const size = () => [...map].reduce((total, [k, v]) => total + (k.length + v.length) * 2, 0);
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    removeItem: (k) => map.delete(k),
    setItem(k, v) {
      const previous = map.get(k);
      map.delete(k);
      if (size() + (k.length + v.length) * 2 > limitBytes) {
        if (previous !== undefined) map.set(k, previous);
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      }
      map.set(k, v);
    },
    _map: map,
  };
}

const CACHE = "kwantdesk:gamma-levels:last-good:v1:";
const FRAMES = "kwantdesk:gex-box:last-native:v1:";

check("an ordinary save touches nothing", () => {
  const store = fakeStore(100_000);
  store.setItem(`${CACHE}NQ`, "x".repeat(1_000));
  const result = writeProtectedItem("kwantdesk:gex-box:workspaces:v1", "small", store);
  assert.equal(result.ok, true);
  assert.equal(result.evicted, 0, "nothing may be dropped when the write already fits");
  assert.equal(store.getItem(`${CACHE}NQ`), "x".repeat(1_000), "the cache is untouched");
});

check("a full quota gives up cache, not the workspace", () => {
  // THE REPORTED FAILURE: the save refuses while re-fetchable frames fill the
  // quota.
  const store = fakeStore(20_000);
  store.setItem(`${CACHE}NQ`, "g".repeat(4_000));
  store.setItem(`${FRAMES}SPX`, "f".repeat(4_000));
  const workspace = "w".repeat(3_000);
  const result = writeProtectedItem("kwantdesk:gex-box:workspaces:v1", workspace, store);
  assert.equal(result.ok, true, "the workspace must be saved");
  assert.ok(result.evicted > 0, "it must have made room");
  assert.ok(result.reclaimedBytes > 0);
  assert.equal(store.getItem("kwantdesk:gex-box:workspaces:v1"), workspace);
});

check("only as much cache as it takes", () => {
  // Sized so the write cannot fit, but clearing the LARGER cache alone makes
  // it fit — otherwise this would prove nothing about how much is given up.
  const store = fakeStore(20_000);
  store.setItem(`${CACHE}A`, "a".repeat(4_500));   // biggest, evicted first
  store.setItem(`${FRAMES}B`, "b".repeat(500));
  const result = writeProtectedItem("kwantdesk:gex-box:workspaces:v1", "w".repeat(5_000), store);
  assert.equal(result.ok, true);
  assert.equal(result.evicted, 1, "one entry was enough");
  assert.equal(store.getItem(`${FRAMES}B`), "b".repeat(500), "the smaller cache survives");
});

check("work is never evicted to make room for other work", () => {
  const store = fakeStore(6_000);
  const drawings = "d".repeat(2_000);
  store.setItem("kwantdesk:position-drawings:v1:pane-1", drawings);
  const result = writeProtectedItem("kwantdesk:gex-box:workspaces:v1", "w".repeat(2_800), store);
  assert.equal(store.getItem("kwantdesk:position-drawings:v1:pane-1"), drawings,
    "drawings are work and must survive regardless of whether the save fits");
  if (!result.ok) assert.equal(result.evicted, 0, "there was no cache to give");
});

check("a save that still cannot fit reports honestly", () => {
  const store = fakeStore(1_000);
  const result = writeProtectedItem("kwantdesk:gex-box:workspaces:v1", "w".repeat(5_000), store);
  assert.equal(result.ok, false, "an impossible write must not claim success");
});

check("the write never evicts the key it is writing", () => {
  const store = fakeStore(8_000);
  store.setItem(`${CACHE}NQ`, "g".repeat(3_000));
  // A disposable-prefixed key being written deliberately.
  const result = writeProtectedItem(`${CACHE}NQ`, "g".repeat(3_500), store);
  assert.equal(result.ok, true);
  assert.equal(store.getItem(`${CACHE}NQ`), "g".repeat(3_500));
});

check("caches are measurable, so the cost is knowable", () => {
  const store = fakeStore(100_000);
  store.setItem(`${CACHE}NQ`, "g".repeat(1_000));
  store.setItem("kwantdesk:gex-box:workspaces:v1", "w".repeat(1_000));
  const bytes = disposableStorageBytes(store);
  assert.ok(bytes >= 2_000 && bytes < 4_000, `expected only the cache counted, got ${bytes}`);
});

check("every save path makes room before it refuses", () => {
  for (const [label, path] of [
    ["GEX BOX workspaces", "../src/lib/gexBoxWorkspaces.ts"],
    ["indicator templates", "../src/lib/indicatorTemplates.ts"],
    ["account preferences", "../src/lib/userPreferences.ts"],
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /writeProtectedItem\(/, `${label} still writes without making room`);
  }
});

check("every re-fetchable cache is actually evictable", () => {
  // THE BUG THIS CAUGHT. The mechanism only works if a cache is LISTED. A
  // re-fetchable payload missing from the list is worse than not having the
  // mechanism: it fills the quota, cannot be evicted to make room, and the save
  // it blocks fails silently. The GEX Map ladders - the largest thing this app
  // writes - were missing, which is how Save As came to fail with megabytes of
  // refetchable strike data sitting next to it.
  const quota = readFileSync(new URL("../src/lib/browserStorageQuota.ts", import.meta.url), "utf8");
  const listed = [...quota.matchAll(/"(kwantdesk:[^"]+)"/g)].map((match) => match[1]);

  // Every prefix the app writes whose name says it can be fetched again.
  const sources = ["../src/lib/workspaceDataCache.ts", "../src/lib/userPreferences.ts"]
    .map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  const refetchable = [...sources.matchAll(/"(kwantdesk:[a-z0-9:.-]*(?:last-good|last-native)[a-z0-9:.-]*)"/g)]
    .map((match) => match[1]);

  const missing = refetchable.filter((prefix) => !listed.some((entry) => prefix.startsWith(entry)));
  assert.deepEqual(missing, [], `re-fetchable but not evictable: ${missing.join(", ")}`);
  // The biggest one specifically, because it is the one that broke a save.
  assert.ok(
    listed.includes("kwantdesk:gex-map-last-good:v1:"),
    "the GEX Map ladders must be evictable",
  );
});

check("the experimental model does not spend the quota", () => {
  // Two ladders per panel instead of one, for a mirror that exists so a
  // provider restart cannot blank the map - a guarantee v2 does not need and
  // should not pay for in space that belongs to saved work.
  const cache = readFileSync(new URL("../src/lib/workspaceDataCache.ts", import.meta.url), "utf8");
  const writer = cache.slice(cache.indexOf("function writeLastGoodGexMap"));
  assert.match(writer.slice(0, 600), /if \(key\.endsWith\(":dealer"\)\) return;/);
});

console.log(`\nbrowser storage quota: ${passed}/${passed} checks passed`);
