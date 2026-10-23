import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { applyJournalAccountResets } from "../src/lib/journal.ts";
import { saveJournalState, loadJournalState } from "../src/lib/journalStore.ts";

const cutoff = "2026-10-23T10:00:00Z";
const state = () => ({ version: 1,
  accounts: [{ id: "demo", name: "Demo", source: "paper", resetAt: cutoff }, { id: "other", name: "Other" }],
  trades: [
    { id: "old", account: "Demo", closedAt: "2026-10-23T09:00:00Z" },
    { id: "boundary", account: "Demo", closedAt: cutoff },
    { id: "new", account: "Demo", openedAt: "2026-10-23T09:00:00Z", closedAt: "2026-10-23T10:00:01Z" },
    { id: "other", account: "Other", closedAt: "2026-10-22T09:00:00Z" },
  ],
  imports: [{ account: "Demo", importedAt: cutoff }, { account: "Other", importedAt: cutoff }],
  evidence: [{ account: "Demo", importedAt: cutoff }, { account: "Other", importedAt: cutoff }],
});

test("reset affects only the selected journal; newly closed trades continue and originals remain intact", () => {
  const input = state();
  const original = structuredClone(input);
  const visible = applyJournalAccountResets(input);
  assert.deepEqual(visible.trades.map(trade => trade.id), ["new", "other"]);
  assert.deepEqual(visible.imports.map(item => item.account), ["Other"]);
  assert.deepEqual(visible.evidence.map(item => item.account), ["Other"]);
  assert.deepEqual(visible.accounts, input.accounts);
  assert.deepEqual(input, original);
});

test("unreset journals do not lose any records", () => {
  const input = state();
  delete input.accounts[0].resetAt;
  assert.equal(applyJournalAccountResets(input), input);
});

test("stale saves cannot overwrite a confirmed reset or resurrect old demo trades", async () => {
  await saveJournalState("reset-test", state());
  const stale = state();
  delete stale.accounts[0].resetAt;
  await saveJournalState("reset-test", stale);
  const loaded = await loadJournalState("reset-test");
  assert.equal(loaded.accounts[0].resetAt, cutoff);
  assert.deepEqual(loaded.trades.map(trade => trade.id), ["new", "other"]);
  await saveJournalState("another-owner", stale);
  assert.equal((await loadJournalState("another-owner")).trades.length, 4);
});

test("API reset is authenticated, targets an owned account, requires typed confirmation, and never deletes trading records", () => {
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  const reset = api.slice(api.indexOf('if (action === "reset-account")'), api.indexOf('if (action === "archive-account")'));
  assert.match(reset, /body.confirmation !== `RESET \$\{storedAccount.name\}`/);
  assert.match(reset, /user_id: actor.userId/);
  assert.match(reset, /scope: "private"/);
  assert.match(reset, /stateReadError/);
  assert.doesNotMatch(reset, /\.delete\(|\.remove\(/);
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /accountFilter !== "all" && !zyonJournalSelected/);
  assert.match(ui, /aria-labelledby="account-journal-reset-title"/);
});
