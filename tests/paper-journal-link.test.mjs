import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPaperTradingAccount, parseMoney } from "../src/lib/paperAccounts.ts";
import { emptyPaperTradingLedger, ensurePaperAccountLedger } from "../src/lib/paperTrading.ts";
import { appendPaperTradesToJournal, ensurePaperJournalAccounts, linkJournalPaperAccounts, normalizePaperJournalAccounts } from "../src/lib/paperJournal.ts";

const blank = () => ({ version: 1, accounts: [], trades: [], imports: [], evidence: [], zyonResetAt: "2026-10-22T10:00:00Z" });
const account = (id, source = "paper", name = "20 october") => ({ id, source, name, createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" });

test("local/cloud aliases for 20 October become one linked demo journal without touching history", () => {
  const state = { ...blank(), accounts: [account("paper-20 october"), account("paper-20october", "import")], trades: [{ id: "paper:exit-1", netPnl: 1190 }] };
  const next = normalizePaperJournalAccounts(state);
  assert.equal(next.accounts.length, 1);
  assert.equal(next.accounts[0].id, "paper-20october");
  assert.equal(next.accounts[0].source, "paper");
  assert.equal(next.trades, state.trades);
  assert.equal(next.zyonResetAt, state.zyonResetAt);
  assert.equal(normalizePaperJournalAccounts(next), next);
});

test("new empty demo journals use cloud-safe ids before their first trade", () => {
  const next = ensurePaperJournalAccounts(blank(), [{ id: "demo-1", name: "20 october" }]);
  assert.equal(next.accounts[0].id, "paper-20october");
  assert.equal(next.accounts[0].source, "paper");
  assert.deepEqual(next.trades, []);
  assert.equal(ensurePaperJournalAccounts(next, [{ id: "demo-1", name: "20 october" }]), next);
});

test("unrelated imported accounts and archived demo metadata remain intact", () => {
  const archivedAt = "2026-10-21T10:00:00Z";
  const state = { ...blank(), accounts: [account("import:20october", "import"), { ...account("paper-20 october"), archivedAt }, account("paper-20october", "import")] };
  const next = normalizePaperJournalAccounts(state);
  assert.equal(next.accounts.length, 2);
  assert.equal(next.accounts[0], state.accounts[0]);
  assert.equal(next.accounts[1].archivedAt, archivedAt);
});

test("different names that clean to the same id are never silently merged", () => {
  const legacy = { ...blank(), accounts: [account("paper-Demo A", "paper", "Demo A"), account("paper-DemoA", "paper", "DemoA")] };
  assert.equal(normalizePaperJournalAccounts(legacy), legacy);
  const next = ensurePaperJournalAccounts(blank(), [{ id: "demo-a", name: "Demo A" }, { id: "demo-b", name: "DemoA" }]);
  assert.equal(new Set(next.accounts.map(account => account.id)).size, 2);
});

test("active native journals get one tradeable account with a seeded ledger and stable ID", () => {
  const native = account("import:journal:1", "manual", "Journal One");
  const archived = { ...account("import:archive:2", "manual", "Archived"), archivedAt: native.createdAt };
  const imported = account("import:broker:3", "import", "Broker");
  const linked = linkJournalPaperAccounts([], [native, archived, imported]);
  assert.equal(linked.length, 1);
  const [record] = linked;
  assert.equal(record.name, native.name);
  assert.equal(record.journalId, native.id);
  assert.equal(parseMoney(record.balance), 10_000);
  assert.equal(linkJournalPaperAccounts(linked, [native]), linked);
  assert.equal(linkJournalPaperAccounts([], [native])[0].id, record.id);

  const ledger = ensurePaperAccountLedger(emptyPaperTradingLedger(), record);
  assert.equal(ledger.accounts[record.id].cashBalance, 10_000);
  const renamed = { ...native, name: "Renamed" };
  const [renamedRecord] = linkJournalPaperAccounts(linked, [renamed]);
  assert.equal(renamedRecord.name, renamed.name);
  assert.equal(renamedRecord.id, record.id);
  assert.equal(ensurePaperAccountLedger(ledger, renamedRecord), ledger);
  assert.equal(ensurePaperJournalAccounts(blank(), linked).accounts[0].id, native.id);

  // The closed fill still lands under the original journal ID if this device
  // has the old Trade picker label when the journal has already been renamed.
  const state = { ...blank(), accounts: [renamed] };
  ledger.accounts[record.id].fills.push({
    id: "native-close", orderId: "o1", positionId: "p1", accountId: record.id,
    symbol: "NQ", side: "sell", quantity: 1, price: 20_000, timestamp: 60_000,
    role: "close", realizedPnl: 100, label: "",
  });
  const updated = appendPaperTradesToJournal(state, linked, ledger);
  assert.deepEqual(updated.accounts, [renamed]);
  assert.equal(updated.trades.length, 1);
  assert.equal(updated.trades[0].account, renamed.name);
  assert.equal(appendPaperTradesToJournal(updated, linked, ledger), updated);
});

test("linking an existing same-name demo keeps its account and balance", () => {
  const native = account("import:journal:1", "manual", "Existing");
  const record = createPaperTradingAccount({ name: native.name, balance: 50_000, instrument: "NQ", leverage: "1:30" });
  const [linked] = linkJournalPaperAccounts([record], [native]);
  assert.deepEqual(linked, { ...record, journalId: native.id });
});

test("Journal backfills demo accounts and closed fills on open, preserving explicit deletion guards", () => {
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /paperRecords\.ok \? appendPaperTradesToJournal\(mergedSources/);
  assert.match(ui, /paperRecords\.accounts\.filter\(record => !deletedNames\.has/);
  assert.match(ui, /Linked demo account/);
  assert.match(ui, /merged\.accounts\.filter\(account => account\.source === "paper"\)/);
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(api, /source: row\.id\.startsWith\("paper-"\) \? "paper" : row\.source/);
});
