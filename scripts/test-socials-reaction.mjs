import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  SocialsReactionError,
  SocialsReactionService,
} from "../src/lib/socialsReaction.server.ts";

const actor = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const target = "11111111-1111-4111-8111-111111111111";
const key = "22222222-2222-4222-8222-222222222222";
const objectId = "post:alpha";
const timestamp = "2026-08-30T00:00:01Z";

function viewerReaction(kind, optionIndex = null) {
  return {
    userId: actor,
    id: `reaction:${objectId}:${kind}`,
    authorLabel: "Kwant Trader",
    objectType: "reaction",
    scope: "community",
    deskId: null,
    parentId: objectId,
    payload: {
      kind,
      targetUserId: target,
      ...(kind === "POLL" ? { optionIndex } : {}),
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    cloudSaved: true,
  };
}

function summary(kind = "LIKE", enabled = true, optionIndex = null) {
  return {
    version: 1,
    targetUserId: target,
    targetObjectId: objectId,
    targetObjectType: "post",
    kind,
    viewerActive: enabled,
    viewerOptionIndex: kind === "POLL" && enabled ? optionIndex : null,
    totalCount: enabled ? 4 : 3,
    optionCounts: kind === "POLL" ? [1, 2, enabled && optionIndex === 2 ? 1 : 0] : [],
    viewerReaction: enabled ? viewerReaction(kind, optionIndex) : null,
    loadedAt: timestamp,
  };
}

function receipt(kind, enabled, optionIndex = null) {
  return {
    version: 1,
    idempotencyKey: key,
    targetUserId: target,
    targetObjectId: objectId,
    kind,
    enabled,
    optionIndex,
    appliedAt: timestamp,
    idempotent: false,
    summary: summary(kind, enabled, optionIndex),
  };
}

const calls = [];
const service = new SocialsReactionService({
  async rpc(name, args) {
    calls.push({ name, args });
    if (name === "desktop_socials_reaction_summary") return { data: summary(args.p_kind), error: null };
    return { data: receipt(args.p_kind, args.p_enabled, args.p_option_index), error: null };
  },
});

const loaded = await service.summary(actor.toUpperCase(), {
  targetUserId: target.toUpperCase(),
  targetObjectId: objectId,
  kind: " like ",
});
assert.equal(loaded.viewerActive, true);
assert.equal(calls[0].name, "desktop_socials_reaction_summary");

const poll = await service.mutate(actor, {
  idempotencyKey: key.toUpperCase(),
  targetUserId: target.toUpperCase(),
  targetObjectId: objectId,
  kind: "POLL",
  enabled: true,
  optionIndex: 2,
});
assert.equal(poll.summary.viewerOptionIndex, 2);
assert.equal(calls[1].name, "desktop_socials_apply_reaction_mutation");
assert.equal(
  calls[1].args.p_request_hash,
  createHash("sha256").update(JSON.stringify({
    actor,
    targetUserId: target,
    targetObjectId: objectId,
    kind: "POLL",
    enabled: true,
    optionIndex: 2,
  }), "utf8").digest("hex"),
);

for (const input of [
  { idempotencyKey: key, targetUserId: target, targetObjectId: "bad id", kind: "LIKE", enabled: true },
  { idempotencyKey: key, targetUserId: target, targetObjectId: objectId, kind: "EVIL", enabled: true },
  { idempotencyKey: key, targetUserId: target, targetObjectId: objectId, kind: "LIKE", enabled: true, optionIndex: 1 },
  { idempotencyKey: key, targetUserId: target, targetObjectId: objectId, kind: "POLL", enabled: true },
]) {
  await assert.rejects(
    service.mutate(actor, input),
    (error) => error instanceof SocialsReactionError && error.status === 400,
  );
}
assert.equal(calls.length, 2);

const contradictory = new SocialsReactionService({
  async rpc() {
    const value = receipt("LIKE", true);
    value.summary.viewerActive = false;
    return { data: value, error: null };
  },
});
await assert.rejects(
  contradictory.mutate(actor, {
    idempotencyKey: key,
    targetUserId: target,
    targetObjectId: objectId,
    kind: "LIKE",
    enabled: true,
  }),
  (error) => error instanceof SocialsReactionError && error.code === "socials_reaction_receipt_invalid",
);

const conflict = new SocialsReactionService({
  async rpc() { return { data: null, error: { message: "socials_idempotency_conflict" } }; },
});
await assert.rejects(
  conflict.mutate(actor, {
    idempotencyKey: key,
    targetUserId: target,
    targetObjectId: objectId,
    kind: "LIKE",
    enabled: false,
  }),
  (error) => error instanceof SocialsReactionError
    && error.code === "socials_idempotency_conflict"
    && error.status === 409,
);

const route = await readFile(
  new URL("../src/app/api/socials-desktop/reaction/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /requireExactQuery\(request, \["targetUserId", "targetObjectId", "kind"\]\)/);
assert.match(route, /mediaType !== "application\/json"/);
assert.match(route, /requireExactMutationShape/);
assert.match(route, /MAXIMUM_REQUEST_BYTES = 16 \* 1024/);

const migration = await readFile(
  new URL("../supabase/migrations/202608300003_create_desktop_social_reaction_mutations.sql", import.meta.url),
  "utf8",
);
assert.match(migration, /security definer/gi);
assert.match(migration, /set search_path = ''/g);
assert.match(migration, /socials_reaction_target_forbidden/);
assert.match(migration, /desktop_socials_mutation_receipts/);
assert.match(migration, /interval '90 days'/);
assert.match(migration, /offset 5000/);
assert.match(migration, /to service_role/);
assert.doesNotMatch(migration, /to authenticated/);

process.stdout.write("SOCIALS reaction mutation contract passed.\n");
