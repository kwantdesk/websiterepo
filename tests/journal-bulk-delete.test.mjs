import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { deleteJournalSelection } from "../src/lib/journalBulkDelete.ts";

const targets = [{ id: "a", name: "Demo A" }, { id: "b", name: "Demo B" }, { id: "c", name: "Demo C" }];

test("only selected journals are removed, sequentially, once each", async () => {
  const removed = [];
  const committed = [];
  let active = 0;
  const result = await deleteJournalSelection([targets[0], targets[2], targets[0]], async target => {
    assert.equal(active++, 0);
    removed.push(target.id);
    await Promise.resolve();
    active--;
  }, target => committed.push(target.id));
  assert.deepEqual(removed, ["a", "c"]);
  assert.deepEqual(committed, removed);
  assert.equal(result.deleted.length, 2);
  assert.equal(result.failed.length, 0);
});

test("partial failure preserves failed journals and does not undo successful deletes", async () => {
  const committed = [];
  const result = await deleteJournalSelection(targets, async target => {
    if (target.id === "b") throw new Error("Server unavailable");
  }, target => committed.push(target.id));
  assert.deepEqual(committed, ["a", "c"]);
  assert.deepEqual(result.failed, [{ target: targets[1], error: "Server unavailable" }]);
});

test("built-in journals are never sent for deletion", async () => {
  const result = await deleteJournalSelection([{ id: "all", name: "all" }, { id: "zyon", name: "  zyon   journal " }, { id: "", name: "" }],
    async () => assert.fail("must not delete built-in journal"), () => assert.fail("must not commit"));
  assert.deepEqual(result, { deleted: [], failed: [] });
});

test("account switch stops new requests, while confirmed in-flight deletion still gets its original-owner tombstone", async () => {
  let current = true;
  const removed = [];
  const committed = [];
  await deleteJournalSelection(targets, async target => { removed.push(target.id); current = false; }, target => committed.push(target.id), () => current);
  assert.deepEqual(removed, ["a"]);
  assert.deepEqual(committed, ["a"]);
});

test("empty selection is a no-op", async () => {
  assert.deepEqual(await deleteJournalSelection([], async () => assert.fail(), () => assert.fail()), { deleted: [], failed: [] });
});

test("UI offers searchable checkbox selection and exact typed confirmation before deletion", () => {
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /Search journals to remove/);
  assert.match(ui, /Select all shown/);
  assert.match(ui, /Clear selection/);
  assert.match(ui, /journalBulkPhrase !== `DELETE \$\{selectedJournals.length\} JOURNALS`/);
  assert.match(ui, /setState\(current => purgeDeletedJournalAccounts\(current, \[tombstone\]\)\)/);
  assert.match(ui, /their trades, imports, evidence, analysis and linked Socials trade posts/);
  assert.match(ui, /Trading accounts, balances, fills, open positions and unselected journals are not removed/);
});
