import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { latestZyonJournalReset, zyonOutcomesToJournalTrades } from "../src/lib/journal.ts";

const cutoff = "2026-10-22T10:00:00Z";
function records(id, time, userId = "owner") {
  return [
    { id, userId, objectType: "precord", parentId: null, payload: { source: "ZYON", instrument: "NQ", direction: "LONG" }, createdAt: time, updatedAt: time },
    { id: `receipt-${id}`, userId, objectType: "receipt", parentId: id, payload: { actualEntry: 100, actualExit: 101, quantity: 1, netPnl: 20 }, createdAt: time, updatedAt: "2026-10-23T00:00:00Z" },
  ];
}

test("reset excludes old outcomes, including the boundary, while new outcomes continue", () => {
  const source = [...records("old", "2026-10-22T09:00:00Z"), ...records("boundary", cutoff), ...records("new", "2026-10-22T10:00:01Z")];
  const original = structuredClone(source);
  assert.equal(zyonOutcomesToJournalTrades(source, "owner").length, 3);
  assert.deepEqual(zyonOutcomesToJournalTrades(source, "owner", cutoff).map(trade => trade.id), ["zyon:new"]);
  assert.deepEqual(source, original, "reset must not modify Gameplans or receipts");
});

test("editing an old receipt after reset never resurrects it; another user's outcomes never enter", () => {
  const source = [...records("old", "2026-10-22T09:00:00Z"), ...records("other", "2026-10-22T11:00:00Z", "someone-else")];
  assert.deepEqual(zyonOutcomesToJournalTrades(source, "owner", cutoff), []);
});

test("reset timestamp merges are monotonic across cache, cloud and late hydration", () => {
  assert.equal(latestZyonJournalReset(null, "invalid", cutoff, "2026-10-22T09:00:00Z"), cutoff);
  assert.equal(latestZyonJournalReset(undefined, "invalid"), null);
});

test("reset requires explicit confirmation and writes only an authenticated private marker", () => {
  const api = readFileSync(new URL("../src/app/api/journal/route.ts", import.meta.url), "utf8");
  const reset = api.slice(api.indexOf('if (action === "reset-zyon-journal")'), api.indexOf('if (action === "reorder-accounts")'));
  assert.match(reset, /body\.confirmation !== "RESET ZYON JOURNAL"/);
  assert.match(reset, /user_id: actor\.userId/);
  assert.match(reset, /scope: "private"/);
  assert.match(reset, /onConflict: "user_id,id"/);
  assert.doesNotMatch(reset, /\.delete\(|\.remove\(/);
  const ui = readFileSync(new URL("../src/components/journal/JournalWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /requestId !== zyonOutcomeRequest\.current/);
  assert.match(ui, /zyonResetApplied\.current\?\.accountKey === resolvedAccountKey/);
  assert.match(ui, /role="dialog" aria-modal="true" aria-labelledby="zyon-journal-reset-title"/);
});
