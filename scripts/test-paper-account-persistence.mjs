import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PAPER_TRADING_ACCOUNTS_STORAGE_KEY,
  createPaperTradingAccount,
  loadPaperTradingAccounts,
  savePaperTradingAccounts,
} from "../src/lib/paperAccounts.ts";

/**
 * A paper account is the trader's own record. It survives a refresh, keeps
 * the name it was given, and goes away only when it is deleted.
 *
 * It did not. Both surfaces that hold accounts — the charts workspace and the
 * accounts page — read the store in one effect and write it back in another.
 * An effect's setState does not change the value the effects after it see in
 * the SAME pass, so the writer ran on every mount holding the state as it was
 * BEFORE the read landed: an empty list, saved straight over the accounts on
 * disk. Whether they came back depended on the read in that same pass having
 * already succeeded, which is why they survived some refreshes and not others.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// A localStorage good enough for the store, plus the event it broadcasts.
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  },
  dispatchEvent: () => true,
};
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

check("an account survives being written and read back", () => {
  const account = createPaperTradingAccount({
    name: "Jacob's NQ sim", balance: 50_000, leverage: "1:1", instrument: "NQ",
  });
  savePaperTradingAccounts([account]);
  const loaded = loadPaperTradingAccounts();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, "Jacob's NQ sim", "the name it was given is kept");
  assert.equal(loaded[0].id, account.id);
});

check("it stays until it is deleted, not until the page reloads", () => {
  const kept = loadPaperTradingAccounts();
  assert.equal(kept.length, 1, "a second read must return the same account");
  savePaperTradingAccounts([]);
  assert.deepEqual(loadPaperTradingAccounts(), [], "deleting is what empties it");
});

check("a corrupt store reads as empty instead of throwing", () => {
  store.set(PAPER_TRADING_ACCOUNTS_STORAGE_KEY, "{not json");
  assert.deepEqual(loadPaperTradingAccounts(), []);
});

check("neither surface writes back before it has read", () => {
  // The actual defect, and the only thing standing between a mount and an
  // empty list overwriting real accounts.
  for (const [label, path] of [
    ["the charts workspace", "../src/components/KwantifyWorkspace.tsx"],
    ["the accounts page", "../src/app/accounts/page.tsx"],
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const save = source.indexOf("savePaperTradingAccounts(");
    assert.ok(save > 0, `${label} does not save accounts at all`);
    const guarded = source.slice(Math.max(0, save - 700), save);
    assert.match(
      guarded,
      /if \(!paperAccountsHydratedRef\.current\) return;/,
      `${label} saves accounts before it has loaded them`,
    );
  }
});

check("a failed read is never treated as an empty account list", () => {
  // The workspace's loader catches and falls back to an empty list. That
  // fallback must NOT count as having read the store, or a single bad parse
  // turns into permanent loss.
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  const start = workspace.indexOf("setPaperTradingAccounts(loadPaperTradingAccounts());");
  const block = workspace.slice(start, start + 700);
  const marked = block.indexOf("paperAccountsHydratedRef.current = true;");
  const failed = block.indexOf("setPaperTradingAccounts([]);");
  assert.ok(marked > 0 && failed > marked, "the catch branch must not mark the store as read");
});

console.log(`\npaper account persistence: ${passed}/${passed} checks passed`);
