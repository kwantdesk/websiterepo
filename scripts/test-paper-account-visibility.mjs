import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { PREFERENCES_HYDRATED_EVENT } = await import("../src/lib/userPreferences.ts");
const { PAPER_TRADING_ACCOUNTS_EVENT } = await import("../src/lib/paperAccounts.ts");

const prefs = readFileSync(new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);
const accountsPage = readFileSync(
  new URL("../src/app/accounts/page.tsx", import.meta.url), "utf8",
);

/**
 * Demo accounts surviving a sign-in, and being SEEN to survive it.
 *
 * Storing them was only half of it. Hydration writes the account's saved values
 * straight into local storage, and every surface that reads them - the trade
 * menu, the order ticket's account picker, the accounts page - reads once and
 * then listens only for its own change events, which a hydration never fires.
 * The accounts came back correctly and stayed invisible until a manual refresh,
 * which reads exactly like they were never saved at all.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("the accounts and their ledger are saved to the trader, not the browser", () => {
  // Without this they belong to one machine and one cache clear.
  assert.match(prefs, /"kwantify-paper-trading-accounts",/);
  assert.match(prefs, /"kwantify-paper-trading-ledger-v1",/);
});

check("hydration announces that it replaced local state", () => {
  assert.equal(PREFERENCES_HYDRATED_EVENT, "kwantdesk:preferences-hydrated");
  // Dispatched after the writes, inside the function that performs them.
  const start = prefs.indexOf("function applyBrowserPreferences");
  const body = prefs.slice(start, prefs.indexOf("\n}", start));
  assert.ok(
    body.includes("window.dispatchEvent(new CustomEvent(PREFERENCES_HYDRATED_EVENT))"),
    "hydration writes local storage and tells nobody",
  );
  const writeAt = body.indexOf("writeProtectedItem(key, value)");
  const fireAt = body.indexOf("PREFERENCES_HYDRATED_EVENT");
  assert.ok(writeAt > -1 && fireAt > writeAt, "the event fires before the values are written");
});

check("the trade menu and order ticket re-read on sign-in", () => {
  /*
   * Both the account picker in the order ticket and the trade menu read the
   * same `paperTradingAccounts` state, so one re-read serves them.
   */
  assert.match(workspace, /window\.addEventListener\(PREFERENCES_HYDRATED_EVENT, handleHydrated\)/);
  assert.match(workspace, /window\.removeEventListener\(PREFERENCES_HYDRATED_EVENT, handleHydrated\)/);
  assert.match(workspace, /handlePaperAccountsChange\(\);\s*\n\s*commitPaperLedger\(loadPaperTradingLedger\(\)\);/,
    "the ledger does not follow the accounts back");
});

check("the accounts page re-reads on sign-in and on a new account", () => {
  assert.equal(PAPER_TRADING_ACCOUNTS_EVENT, "kwantify-paper-trading-accounts-change");
  assert.match(accountsPage, /window\.addEventListener\(PAPER_TRADING_ACCOUNTS_EVENT, syncAccounts\)/);
  assert.match(accountsPage, /window\.addEventListener\(PREFERENCES_HYDRATED_EVENT, syncAccounts\)/);
  // Both removed again, or navigating away leaks a listener per visit.
  assert.match(accountsPage, /window\.removeEventListener\(PAPER_TRADING_ACCOUNTS_EVENT, syncAccounts\)/);
  assert.match(accountsPage, /window\.removeEventListener\(PREFERENCES_HYDRATED_EVENT, syncAccounts\)/);
});

check("an unchanged account list does not churn state", () => {
  /*
   * Hydration fires on every sign-in and the event is cheap to receive; the
   * re-read must not replace identical state and rerender the page for nothing.
   */
  assert.match(accountsPage, /return JSON\.stringify\(current\.map/, "the accounts page rewrites state unconditionally");
  assert.match(workspace, /JSON\.stringify\(current\) === JSON\.stringify\(nextAccounts\) \? current : nextAccounts/);
});

console.log(`\npaper account visibility: ${passed}/${passed} checks passed`);
