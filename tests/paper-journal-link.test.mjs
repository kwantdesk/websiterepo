import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ensurePaperJournalAccounts, normalizePaperJournalAccounts } from "../src/lib/paperJournal.ts";

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

test("Journal backfills demo accounts and closed fills on open, preserving explicit deletion guards", () => {
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /paperRecords\.ok \? appendPaperTradesToJournal\(mergedSources/);
  assert.match(ui, /paperRecords\.accounts\.filter\(record => !deletedNames\.has/);
  assert.match(ui, /Linked demo account/);
  assert.match(ui, /merged\.accounts\.filter\(account => account\.source === "paper"\)/);
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(api, /source: row\.id\.startsWith\("paper-"\) \? "paper" : row\.source/);
});
