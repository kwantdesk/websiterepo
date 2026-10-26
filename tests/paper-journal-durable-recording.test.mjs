import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createPaperTradingAccount } from "../src/lib/paperAccounts.ts";
import { emptyPaperTradingLedger, placePaperOrder, closePaperPosition, clearPaperAccountFills, clearPaperTradeHistory, resetPaperAccountLedger, normalizePaperTradingLedger } from "../src/lib/paperTrading.ts";
import { appendPaperTradesToJournal } from "../src/lib/paperJournal.ts";
import { syncPaperJournalCloud } from "../src/lib/paperJournalCloud.ts";

const blank = () => ({ version: 1, accounts: [], trades: [], evidence: [], imports: [] });
function closedTrade(name = "20 october") {
  const record = createPaperTradingAccount({ name, balance: 50000, leverage: "1:30", instrument: "NQ" });
  const entered = placePaperOrder(emptyPaperTradingLedger(), [record], {
    accountId: record.id, symbol: "NQ", side: "buy", type: "market", quantity: 1, price: null, stopLoss: null, takeProfits: [],
  }, { bid: 24000, ask: 24000, last: 24000, timestamp: 1793000000000 });
  assert.equal(entered.error, undefined);
  const result = closePaperPosition(entered.ledger, record.id, entered.ledger.accounts[record.id].positions[0].id,
    { bid: 24010, ask: 24010, last: 24010, timestamp: 1793000060000 });
  assert.equal(result.error, undefined);
  return { record, ledger: result.ledger };
}

for (const [label, clear] of [["clear fills", clearPaperAccountFills], ["clear chart history", clearPaperTradeHistory], ["reset demo balance", resetPaperAccountLedger]]) {
  test(`a close survives ${label} before the first journal save, plus reload`, () => {
    const { record, ledger } = closedTrade();
    const balance = ledger.accounts[record.id].cashBalance;
    const cleared = clear(ledger, record.id);
    assert.equal(cleared.accounts[record.id].fills.length, 0);
    const reloaded = normalizePaperTradingLedger(JSON.parse(JSON.stringify(cleared)));
    const state = appendPaperTradesToJournal(blank(), [record], reloaded);
    assert.equal(state.accounts[0].name, "20 october");
    assert.equal(state.trades.length, 1);
    assert.equal(state.trades[0].entryPrice, 24000);
    assert.equal(state.trades[0].exitPrice, 24010);
    assert.equal(state.trades[0].durationMs, 60000);
    assert.equal(state.trades[0].netPnl, 200);
    assert.equal(appendPaperTradesToJournal(state, [record], reloaded), state);
    assert.equal(ledger.accounts[record.id].cashBalance, balance);
  });
}

test("legacy available fills migrate into durable evidence before clearing", () => {
  const { record, ledger } = closedTrade();
  delete ledger.accounts[record.id].journalFills;
  const cleared = clearPaperAccountFills(ledger, record.id);
  assert.equal(appendPaperTradesToJournal(blank(), [record], cleared).trades.length, 1);
});

test("every demo account exists in the journal before its first close", () => {
  const records = ["20 october", "Second 50k", "Third demo"].map(name => createPaperTradingAccount({ name, balance: 50000, leverage: "1:30", instrument: "NQ" }));
  const state = appendPaperTradesToJournal(blank(), records, emptyPaperTradingLedger());
  assert.deepEqual(state.accounts.map(account => account.name), records.map(account => account.name));
  assert.equal(state.trades.length, 0);
});

test("cloud recording sends new rows once and retries failed batches without opening Journal", async () => {
  const { record, ledger } = closedTrade();
  const state = appendPaperTradesToJournal(blank(), [record], ledger);
  const original = globalThis.fetch;
  const requests = [];
  let success = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/journal");
    requests.push(JSON.parse(options.body));
    return { ok: success, json: async () => ({ cloud: success }) };
  };
  try {
    assert.equal(await syncPaperJournalCloud("recording-regression-owner", state), false);
    success = true;
    assert.equal(await syncPaperJournalCloud("recording-regression-owner", state), true);
    assert.equal(await syncPaperJournalCloud("recording-regression-owner", state), true);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].action, "append-paper");
    assert.equal(requests[1].trades.length, 1);
    assert.equal(await syncPaperJournalCloud("local", state), false);
    assert.equal(requests.length, 2);
  } finally { globalThis.fetch = original; }
});

test("append-only cloud sync cannot overwrite journal reviews and is wired to trading", () => {
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(api, /from\("journal_trades"\)\.upsert\(rows, \{ onConflict: "user_id,id", \.\.\.\(appendPaper \? \{ ignoreDuplicates: true \}/);
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /void syncPaperJournalCloud\(key, next\)/);
  assert.match(workspace, /window.addEventListener\("online", retry\)/);
});
