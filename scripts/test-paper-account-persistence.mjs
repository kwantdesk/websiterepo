import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  PAPER_TRADING_ACCOUNTS_STORAGE_KEY,
  PAPER_TRADING_ACCOUNTS_EVENT,
  createPaperTradingAccount,
  loadPaperTradingAccounts,
  readPaperTradingAccounts,
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
      /if \(!paperAccountsHydrated\) return;/,
      `${label} saves accounts before it has loaded them`,
    );
  }
});

check("a failed read is never treated as an empty account list", () => {
  for (const raw of ["{bad json", "{}", '[{"name":"missing id"}]']) {
    store.set(PAPER_TRADING_ACCOUNTS_STORAGE_KEY, raw);
    assert.equal(readPaperTradingAccounts().ok, false);
    assert.equal(store.get(PAPER_TRADING_ACCOUNTS_STORAGE_KEY), raw);
  }
  store.delete(PAPER_TRADING_ACCOUNTS_STORAGE_KEY);
  assert.deepEqual(readPaperTradingAccounts(), { ok: true, accounts: [] });
});

// Replay the ACTUAL effects, not a hand-written model of their guards. State
// setters queue a next render; they cannot change another effect's closure in
// the same pass. The old mutable-ref guard let [] reach disk in this replay.
for (const file of ["../src/components/KwantifyWorkspace.tsx", "../src/app/accounts/page.tsx"]) {
  check(`${file}: mount and Strict Mode replay never write the pre-hydration list`, () => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const effects = [];
    let changeHandler;
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]) effects.push(node.arguments[0].getText(ast));
      if (ts.isVariableDeclaration(node) && ["handlePaperAccountsChange", "syncAccounts"].includes(node.name.getText(ast))) changeHandler = node.initializer?.getText(ast);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    const reader = effects.find(text => text.includes("readPaperTradingAccounts()") && text.includes("setPaperAccountsHydrated"));
    const writer = effects.find(text => text.includes("savePaperTradingAccounts("));
    assert.ok(reader && writer);
    const compile = (text, context) => vm.runInNewContext(ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const account = createPaperTradingAccount({ name: "Retained simulator", balance: 50000, leverage: "1:30", instrument: "NQ" });
    for (const raw of [JSON.stringify([account]), "{bad json", null]) {
      store.clear(); if (raw !== null) store.set(PAPER_TRADING_ACCOUNTS_STORAGE_KEY, raw);
      let pending = {}, writes = [];
      const noop = () => {};
      const context = {
        window: globalThis.window, paperAccountsHydrated: false, accounts: [], paperTradingAccounts: [],
        readPaperTradingAccounts,
        setAccounts: value => { pending.accounts = value; },
        setPaperTradingAccounts: value => { pending.paperTradingAccounts = value; },
        setPaperAccountsHydrated: value => { pending.paperAccountsHydrated = value; },
        setBrokerFavourites: noop, setConnectedBroker: noop, setBrokerConnections: noop,
        loadPaperTradingLedger: () => ({}), ensurePaperAccountLedger: value => value,
        savePaperTradingLedger: noop, setPaperLedger: noop, setAccountsStorageFull: noop,
        savePaperTradingAccounts: value => { writes.push(value); return savePaperTradingAccounts(value); },
      };
      const load = compile(reader, context), save = compile(writer, context);
      load(); save(); load(); save();
      assert.equal(writes.length, 0, "a starting [] was written during mount replay");
      assert.equal(store.get(PAPER_TRADING_ACCOUNTS_STORAGE_KEY) ?? null, raw);
      compile(writer, { ...context, ...pending })();
      if (raw === "{bad json") assert.equal(writes.length, 0, "failed read destroyed stored evidence");
      else assert.equal(writes.at(-1).length, raw === null ? 0 : 1);
    }
    let visible = [];
    const receive = value => { visible = typeof value === "function" ? value(visible) : value; };
    compile(changeHandler, {
      CustomEvent: globalThis.CustomEvent, PAPER_TRADING_ACCOUNTS_EVENT,
      readPaperTradingAccounts: () => ({ ok: true, accounts: [] }),
      setPaperAccountsHydrated: () => {}, setPaperTradingAccounts: receive, setAccounts: receive,
      setPaperLedger: () => {}, loadPaperTradingLedger: () => ({}),
    })(new CustomEvent(PAPER_TRADING_ACCOUNTS_EVENT, { detail: [account] }));
    assert.equal(visible[0]?.id, account.id, "a refused save's event reread old storage and hid the account");
  });
}

console.log(`\npaper account persistence: ${passed}/${passed} checks passed`);
