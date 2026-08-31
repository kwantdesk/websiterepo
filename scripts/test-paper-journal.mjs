import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  appendPaperTradesToJournal, ensurePaperJournalAccounts,
  paperJournalAccountName, isPaperJournalTrade,
} = await import("../src/lib/paperJournal.ts");
const { EMPTY_JOURNAL_STATE } = await import("../src/lib/journal.ts");

/**
 * Demo trading writes its own journal.
 *
 * The ledger DELETES a position the moment it closes and keeps only the fills,
 * and the trader may clear those fills off the chart whenever they like. A
 * journal derived from the ledger on demand would therefore lose the trade
 * twice over - so a close is copied in as it happens and never revised.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const account = (over = {}) => ({ id: "acc1", name: "Demo One", balance: 50000, ...over });
const fill = (over = {}) => ({
  id: "f1", orderId: "o1", positionId: "p1", accountId: "acc1", symbol: "NQ",
  side: "buy", quantity: 2, price: 20000, timestamp: 1_000, role: "entry",
  realizedPnl: 0, label: "", ...over,
});
const ledgerOf = (fills) => ({
  version: 1,
  accounts: {
    acc1: {
      accountId: "acc1", startingBalance: 0, cashBalance: 0, realizedPnl: 0,
      positions: [], orders: [], fills, updatedAt: 0,
    },
  },
});
const blank = () => ({ ...EMPTY_JOURNAL_STATE, accounts: [], trades: [], evidence: [], imports: [] });

check("a demo account gets a journal before it has traded", () => {
  const state = ensurePaperJournalAccounts(blank(), [account()]);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.accounts[0].name, "Demo One");
  assert.equal(state.accounts[0].source, "paper");
  // And creating it twice does not create it twice.
  assert.equal(ensurePaperJournalAccounts(state, [account()]).accounts.length, 1);
});

check("a closed trade files itself under that account", () => {
  const fills = [
    fill(),
    fill({ id: "f2", side: "sell", role: "take_profit", price: 20100, timestamp: 61_000, realizedPnl: 4000 }),
  ];
  const state = appendPaperTradesToJournal(blank(), [account()], ledgerOf(fills));
  assert.equal(state.trades.length, 1, "the exit was not journalled");
  const [trade] = state.trades;
  assert.equal(trade.account, "Demo One");
  assert.equal(trade.symbol, "NQ");
  // Closed by a SELL, so it was a long.
  assert.equal(trade.side, "LONG");
  assert.equal(trade.entryPrice, 20000, "the entry was not carried across");
  assert.equal(trade.exitPrice, 20100);
  assert.equal(trade.netPnl, 4000);
  assert.equal(trade.durationMs, 60_000);
  assert.equal(trade.setup, "Target");
  assert.ok(isPaperJournalTrade(trade));
});

check("an entry on its own is not a trade", () => {
  // Nothing has been realised yet; journalling it would invent a result.
  const state = appendPaperTradesToJournal(blank(), [account()], ledgerOf([fill()]));
  assert.equal(state.trades.length, 0);
});

check("the stop and a manual close are named for what happened", () => {
  const named = (role) => appendPaperTradesToJournal(blank(), [account()], ledgerOf([
    fill(),
    fill({ id: `x-${role}`, side: "sell", role, price: 19900, timestamp: 2_000, realizedPnl: -4000 }),
  ])).trades[0].setup;
  assert.equal(named("stop_loss"), "Stop");
  assert.equal(named("manual_close"), "Manual close");
});

check("the same close is never journalled twice", () => {
  /*
   * The sync runs on every ledger commit, and a commit happens on every quote
   * that changes anything. Re-running it must be a no-op.
   */
  const fills = [
    fill(),
    fill({ id: "f2", side: "sell", role: "stop_loss", price: 19900, timestamp: 2_000, realizedPnl: -4000 }),
  ];
  const once = appendPaperTradesToJournal(blank(), [account()], ledgerOf(fills));
  const twice = appendPaperTradesToJournal(once, [account()], ledgerOf(fills));
  assert.equal(twice.trades.length, 1);
  assert.equal(twice, once, "an unchanged sync should return the same object");
});

check("clearing the fills leaves the journal untouched", () => {
  // The whole reason the trade is copied at close: this is a supported action.
  const fills = [
    fill(),
    fill({ id: "f2", side: "sell", role: "take_profit", price: 20100, timestamp: 2_000, realizedPnl: 4000 }),
  ];
  const recorded = appendPaperTradesToJournal(blank(), [account()], ledgerOf(fills));
  const afterClear = appendPaperTradesToJournal(recorded, [account()], ledgerOf([]));
  assert.equal(afterClear.trades.length, 1, "the journal lost a trade when fills were cleared");
  assert.equal(afterClear.trades[0].exitPrice, 20100);
});

check("history for a deleted demo account is left where it is", () => {
  /*
   * Trades already journalled stay. New fills belonging to an account that no
   * longer exists have no name to file under, so they are not filed somewhere
   * arbitrary.
   */
  const fills = [
    fill(),
    fill({ id: "f2", side: "sell", role: "take_profit", price: 20100, timestamp: 2_000, realizedPnl: 4000 }),
  ];
  const recorded = appendPaperTradesToJournal(blank(), [account()], ledgerOf(fills));
  const orphaned = appendPaperTradesToJournal(recorded, [], ledgerOf(fills));
  assert.equal(orphaned.trades.length, 1, "the journal was rewritten when the account went away");
  assert.equal(orphaned.trades[0].account, "Demo One");
});

check("a scale-out records each exit as its own settled result", () => {
  const fills = [
    fill({ quantity: 4 }),
    fill({ id: "f2", side: "sell", role: "take_profit", quantity: 2, price: 20100, timestamp: 2_000, realizedPnl: 4000 }),
    fill({ id: "f3", side: "sell", role: "take_profit", quantity: 2, price: 20200, timestamp: 3_000, realizedPnl: 8000 }),
  ];
  const state = appendPaperTradesToJournal(blank(), [account()], ledgerOf(fills));
  assert.equal(state.trades.length, 2);
  assert.deepEqual(state.trades.map((trade) => trade.netPnl), [4000, 8000]);
  assert.deepEqual(state.trades.map((trade) => trade.quantity), [2, 2]);
});

check("simulated fills never invent a commission or an R multiple", () => {
  const state = appendPaperTradesToJournal(blank(), [account()], ledgerOf([
    fill(),
    fill({ id: "f2", side: "sell", role: "stop_loss", price: 19900, timestamp: 2_000, realizedPnl: -4000 }),
  ]));
  const [trade] = state.trades;
  assert.equal(trade.fees, 0);
  assert.equal(trade.grossPnl, trade.netPnl);
  // The fill does not record the stop that was set, so risk is unknown, not zero.
  assert.equal(trade.initialRisk, null);
  assert.equal(trade.rMultiple, null);
});

check("the account name is what links a trade to its journal", () => {
  assert.equal(paperJournalAccountName({ name: "  Funded Sim  " }), "Funded Sim");
  assert.equal(paperJournalAccountName({ name: "" }), "Demo account");
});

check("the workspace records closes and tells an open journal", () => {
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  assert.match(
    workspace,
    /schedulePaperJournalSync\(\);\s*\n\s*\}, \[schedulePaperJournalSync, syncPaperLedgerUi\]\);/,
    "closing a trade does not write the journal",
  );
  assert.match(workspace, /appendPaperTradesToJournal\(state, records, paperLedgerRef\.current\)/);
  assert.match(workspace, /window\.dispatchEvent\(new CustomEvent\(PAPER_JOURNAL_UPDATED_EVENT\)\)/);

  const journal = readFileSync(
    new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8",
  );
  // Without this the open journal's debounced save writes a copy that predates
  // the trade and loses it.
  assert.match(journal, /window\.addEventListener\(PAPER_JOURNAL_UPDATED_EVENT, mergeStoredTrades\)/);
  assert.match(journal, /window\.removeEventListener\(PAPER_JOURNAL_UPDATED_EVENT, mergeStoredTrades\)/);
});

check("every path that fills a trade tells the journal", () => {
  /*
   * The journal was hooked to commitPaperLedger alone, and the quote-driven
   * paths do not use it - they assign the ledger directly so they can throttle
   * the React sync instead of forcing one per quote. That is EVERY trade that
   * closes on a live stop or target. The daily figure still moved, because it
   * reads the ledger, so the loss was silent.
   *
   * This walks the assignment sites rather than naming them, so a new one
   * cannot be added without being noticed here.
   */
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  const sites = [];
  for (let at = workspace.indexOf("paperLedgerRef.current ="); at !== -1;
       at = workspace.indexOf("paperLedgerRef.current =", at + 1)) sites.push(at);

  assert.ok(sites.length >= 4, `expected the known commit sites, found ${sites.length}`);
  for (const at of sites) {
    const around = workspace.slice(Math.max(0, at - 300), at + 900);
    assert.ok(
      around.includes("schedulePaperJournalSync"),
      `a ledger commit near offset ${at} does not tell the journal`,
    );
  }
});

check("the journal is written under the key the journal reads", () => {
  /*
   * The key resolves after sign-in, while demo accounts are restored from local
   * storage immediately. Without the key in the dependency list the first sync
   * wrote to "local" and the journal page - looking under the user's id by the
   * time anyone opened it - found nothing there. That is exactly the "no
   * journal was created" report.
   */
  const workspace = readFileSync(
    new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
  );
  assert.match(
    workspace,
    /const paperJournalKey = preferenceUserId \|\| currentUsername \|\| "local";/,
    "the journal key is not resolved in one place",
  );
  assert.match(
    workspace,
    /\}, \[paperJournalKey, paperTradingAccounts, schedulePaperJournalSync\]\);/,
    "the sync does not re-run when the key settles",
  );
});

check("paper accounts follow the trader to another machine", () => {
  const prefs = readFileSync(new URL("../src/lib/userPreferences.ts", import.meta.url), "utf8");
  assert.match(prefs, /"kwantify-paper-trading-accounts",/, "accounts are not synced to the user");
  assert.match(prefs, /"kwantify-paper-trading-ledger-v1",/, "the ledger is not synced to the user");
});

console.log(`\npaper journal: ${passed}/${passed} checks passed`);
