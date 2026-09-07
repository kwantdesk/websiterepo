import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  journalAccountWasDeleted,
  purgeDeletedJournalAccounts,
} from "../src/lib/journalStore.ts";

const deletion = { id: "paper-demo", name: "Demo Account", deletedAt: "2026-09-07T00:00:00.000Z" };
const state = {
  version: 1,
  accounts: [
    { id: "paper-demo", name: "Demo Account", source: "paper", createdAt: "", updatedAt: "" },
    { id: "keep", name: "Keep Me", source: "manual", createdAt: "", updatedAt: "" },
  ],
  trades: [
    { id: "gone-trade", account: "Demo Account" },
    { id: "keep-trade", account: "Keep Me" },
  ],
  evidence: [
    { id: "gone-evidence", account: "Demo Account" },
    { id: "keep-evidence", account: "Keep Me" },
  ],
  imports: [
    { id: "gone-import", account: "Demo Account" },
    { id: "keep-import", account: "Keep Me" },
  ],
};

test("a Journal account deletion purges every locally retained record for only that account", () => {
  const purged = purgeDeletedJournalAccounts(state, [deletion]);
  assert.deepEqual(purged.accounts.map((row) => row.id), ["keep"]);
  assert.deepEqual(purged.trades.map((row) => row.id), ["keep-trade"]);
  assert.deepEqual(purged.evidence.map((row) => row.id), ["keep-evidence"]);
  assert.deepEqual(purged.imports.map((row) => row.id), ["keep-import"]);
});

test("deletion identity is case and whitespace insensitive", () => {
  assert.equal(journalAccountWasDeleted([deletion], { name: "  demo   account " }), true);
  assert.equal(journalAccountWasDeleted([deletion], { id: "paper-demo", name: "Renamed" }), true);
  assert.equal(journalAccountWasDeleted([deletion], { id: "keep", name: "Keep Me" }), false);
});

test("the API treats an already-absent or local-only Journal as successfully deleted", () => {
  const route = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!accountRow && action === "delete-account"\)/);
  assert.match(route, /alreadyAbsent: true/);
});

test("cloud deletion also removes linked trade posts before the account cascade", () => {
  const route = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  assert.match(route, /deleteLinkedTradePostsForAccount\(supabase, actor\.userId, id\)/);
  assert.match(route, /linkedPostsDeleted: linkedPostDelete\.count/);
});

test("the Journal and paper writer both honor persistent deletion tombstones", () => {
  const journal = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
  assert.match(journal, /markJournalAccountDeleted\(resolvedAccountKey, target\)/);
  assert.match(journal, /await saveJournalState\(resolvedAccountKey, nextState\)/);
  assert.match(workspace, /loadJournalAccountDeletions\(key\)/);
  assert.match(workspace, /purgeDeletedJournalAccounts\(storedState, deletions\)/);
});
