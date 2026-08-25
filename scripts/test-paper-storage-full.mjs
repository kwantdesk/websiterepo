import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Pressing Buy must not crash the page when browser storage is full.
 *
 * `localStorage.setItem` THROWS a QuotaExceededError once the origin is full,
 * and this desk fills that quota with cached provider payloads. The paper
 * ledger and the sim accounts were both saved with a bare `setItem` from a
 * React effect - so the sequence was: press Buy, the order fills, the state
 * commit re-renders, the effect runs, the write throws, the exception reaches
 * the workspace failure boundary, and the page pauses and reloads. The order
 * appeared to "just glitch and not fill".
 *
 * It also explains sim accounts vanishing on refresh: the write meant to keep
 * them threw, and nothing recorded that it had.
 *
 * The fix has three parts, all pinned here: cache is evicted to make room, a
 * write that still will not fit is REPORTED rather than thrown, and the fill
 * survives in memory either way.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** A store that refuses writes past a byte budget, the way a browser does. */
function boundedStorage(limitBytes) {
  const data = new Map();
  const used = () => [...data.entries()].reduce((total, [key, value]) => total + (key.length + value.length) * 2, 0);
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
    setItem: (key, value) => {
      const without = used() - (data.has(key) ? (key.length + data.get(key).length) * 2 : 0);
      if (without + (key.length + value.length) * 2 > limitBytes) {
        const error = new Error("QuotaExceededError");
        error.name = "QuotaExceededError";
        throw error;
      }
      data.set(key, value);
    },
    /** Test-only view. */
    _keys: () => [...data.keys()],
  };
}

const { writeProtectedItem } = await import("../src/lib/browserStorageQuota.ts");

check("a full quota evicts cache instead of throwing", () => {
  // THE REPORTED FAILURE, at the storage layer.
  const store = boundedStorage(20_000);
  store.setItem("kwantdesk:gamma-levels:last-good:v1:NQ", "x".repeat(4_000));
  store.setItem("kwantdesk:gex-box:last-native:v1:SPX", "y".repeat(3_000));
  assert.throws(() => store.setItem("kwantify-paper-trading-ledger-v1", "z".repeat(4_000)),
    /QuotaExceededError/, "the bounded store must behave like a full browser");

  const result = writeProtectedItem("kwantify-paper-trading-ledger-v1", "z".repeat(4_000), store);
  assert.equal(result.ok, true, "the ledger must be written after making room");
  assert.ok(result.evicted > 0, "it must have dropped re-downloadable cache");
  assert.equal(store.getItem("kwantify-paper-trading-ledger-v1"), "z".repeat(4_000));
});

check("it never evicts the trader's own work to save other work", () => {
  const store = boundedStorage(12_000);
  store.setItem("kwantdesk:workspace:v1:main", "w".repeat(3_000));   // work, not cache
  store.setItem("kwantdesk:gamma-levels:last-good:v1:ES", "c".repeat(2_000));
  writeProtectedItem("kwantify-paper-trading-ledger-v1", "z".repeat(3_000), store);
  assert.ok(store.getItem("kwantdesk:workspace:v1:main"), "a saved workspace is not cache");
});

check("a write that still cannot fit reports rather than throws", () => {
  // Nothing disposable to drop and no room: the caller must survive this.
  const store = boundedStorage(1_000);
  let result;
  assert.doesNotThrow(() => {
    result = writeProtectedItem("kwantify-paper-trading-ledger-v1", "z".repeat(5_000), store);
  }, "an impossible write must not throw into a React effect");
  assert.equal(result.ok, false);
});

check("the paper ledger and accounts both go through the guard", () => {
  for (const file of ["../src/lib/paperTrading.ts", "../src/lib/paperAccounts.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /writeProtectedItem\(/, `${file} must use the quota-aware write`);
    assert.doesNotMatch(
      source,
      /window\.localStorage\.setItem/,
      `${file} must not write straight to localStorage - that is the throw that crashed the page`,
    );
  }
});

check("a failed save still tells the trader, and still fires the change event", () => {
  const ledger = readFileSync(new URL("../src/lib/paperTrading.ts", import.meta.url), "utf8");
  const save = ledger.slice(ledger.indexOf("export function savePaperTradingLedger"));
  const body = save.slice(0, save.indexOf("\n}") + 2);
  // The event must fire whether or not the write succeeded: the fill is real
  // in memory, and listeners must not be left showing stale state.
  const dispatchIndex = body.indexOf("dispatchEvent");
  const returnIndex = body.lastIndexOf("return result");
  assert.ok(dispatchIndex > 0 && dispatchIndex < returnIndex, "the change event must fire before returning");
  assert.match(body, /StorageWriteResult/, "the caller must be able to see that it failed");

  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /const saved = savePaperTradingLedger\(paperLedger\);/);
  assert.match(workspace, /Browser storage is full/, "the trader must be told the fill will not survive a refresh");
});

console.log(`\npaper storage full: ${passed}/${passed} checks passed`);
