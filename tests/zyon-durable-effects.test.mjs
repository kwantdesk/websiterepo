import assert from "node:assert/strict";
import test from "node:test";

import {
  zyonDurableEffectIds,
  zyonDurableGameplanDraftId,
  zyonDurableSourceKey,
} from "../src/lib/zyon.ts";

test("transport retries reuse every durable conversation and journal identity", () => {
  const sourceId = "zyon-user-0123456789abcdef";
  const first = zyonDurableEffectIds(sourceId);
  const retry = zyonDurableEffectIds(sourceId);

  assert.deepEqual(retry, first);
  assert.deepEqual(first, {
    sourceMessageId: sourceId,
    userConversationId: `zyon-conversation-${sourceId}`,
    assistantConversationId: `zyon-conversation-assistant-${sourceId}`,
    journalEntryId: `zyon-journal-${sourceId}`,
  });

  const writes = new Map();
  for (const attempt of [first, retry]) {
    for (const id of [
      attempt.userConversationId,
      attempt.assistantConversationId,
      attempt.journalEntryId,
    ]) writes.set(id, { id });
  }
  assert.equal(writes.size, 3);
});

test("gameplan retry and restart use one draft and one derived journal identity", () => {
  const sourceId = "zyon-user-gameplan-source";
  const first = zyonDurableGameplanDraftId(sourceId, "2026-08-29", "NQ");
  const retry = zyonDurableGameplanDraftId(sourceId, "2026-08-29", "NQ");
  const restart = zyonDurableGameplanDraftId(sourceId, "2026-08-29", "NQ");

  assert.equal(retry, first);
  assert.equal(restart, first);
  assert.equal(first, `zyon-gameplan-draft:2026-08-29:NQ:${sourceId}`);
  assert.equal(new Set([first, retry, restart]).size, 1);
  assert.equal(new Set([`zyon-journal-${first}`, `zyon-journal-${retry}`]).size, 1);
});

test("durable source keys are bounded and safe for exact response lookup", () => {
  const key = zyonDurableSourceKey(`  user id/with unsafe chars ${"x".repeat(120)}  `);
  assert.match(key, /^[A-Za-z0-9_-]{1,80}$/);
  assert.equal(zyonDurableEffectIds(null), null);
  assert.notEqual(
    zyonDurableEffectIds("zyon-user-one")?.assistantConversationId,
    zyonDurableEffectIds("zyon-user-two")?.assistantConversationId,
  );
});
