import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  SocialsFollowError,
  SocialsFollowService,
} from "../src/lib/socialsFollow.server.ts";

const actor = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const target = "11111111-1111-4111-8111-111111111111";
const key = "22222222-2222-4222-8222-222222222222";

function receipt(action, enabled = null) {
  const viewerFollows = action !== "unfollow";
  return {
    version: 1,
    idempotencyKey: key,
    action,
    targetUserId: target,
    appliedAt: "2026-08-30T00:00:01Z",
    idempotent: false,
    summary: {
      version: 1,
      profileUserId: target,
      followerCount: viewerFollows ? 8 : 7,
      followingCount: 11,
      viewerFollows,
      followsViewer: true,
      notificationsEnabled: action === "notifications" ? enabled : false,
      canViewFollowers: true,
      canViewFollowing: true,
      loadedAt: "2026-08-30T00:00:01Z",
    },
  };
}

const calls = [];
const service = new SocialsFollowService({
  async rpc(name, args) {
    calls.push({ name, args });
    return { data: receipt(args.p_action, args.p_notifications_enabled), error: null };
  },
});

const followed = await service.mutate(actor.toUpperCase(), {
  idempotencyKey: key.toUpperCase(),
  action: " FOLLOW ",
  targetUserId: target.toUpperCase(),
});
assert.equal(followed.summary.viewerFollows, true);
assert.equal(calls.length, 1);
assert.equal(calls[0].name, "desktop_socials_apply_follow_mutation");
assert.deepEqual(
  {
    ...calls[0].args,
    p_request_hash: undefined,
  },
  {
    p_actor_id: actor,
    p_idempotency_key: key,
    p_action: "follow",
    p_target_user_id: target,
    p_notifications_enabled: null,
    p_request_hash: undefined,
  },
);
assert.equal(
  calls[0].args.p_request_hash,
  createHash("sha256")
    .update(JSON.stringify({ actor, action: "follow", targetUserId: target, enabled: null }), "utf8")
    .digest("hex"),
);

const notifications = await service.mutate(actor, {
  idempotencyKey: key,
  action: "notifications",
  targetUserId: target,
  enabled: true,
});
assert.equal(notifications.summary.notificationsEnabled, true);

for (const input of [
  { idempotencyKey: key, action: "follow", targetUserId: actor },
  { idempotencyKey: key, action: "friend", targetUserId: target },
  { idempotencyKey: key, action: "follow", targetUserId: target, enabled: true },
  { idempotencyKey: key, action: "notifications", targetUserId: target },
]) {
  await assert.rejects(
    service.mutate(actor, input),
    (error) => error instanceof SocialsFollowError && error.status === 400,
  );
}
assert.equal(calls.length, 2);

const contradictory = new SocialsFollowService({
  async rpc() {
    const value = receipt("follow");
    value.summary.viewerFollows = false;
    return { data: value, error: null };
  },
});
await assert.rejects(
  contradictory.mutate(actor, { idempotencyKey: key, action: "follow", targetUserId: target }),
  (error) => error instanceof SocialsFollowError && error.code === "socials_follow_receipt_invalid",
);

const conflicting = new SocialsFollowService({
  async rpc() {
    return { data: null, error: { message: "socials_idempotency_conflict" } };
  },
});
await assert.rejects(
  conflicting.mutate(actor, { idempotencyKey: key, action: "unfollow", targetUserId: target }),
  (error) => error instanceof SocialsFollowError
    && error.code === "socials_idempotency_conflict"
    && error.status === 409,
);

function query(result) {
  const chain = {
    select() { return chain; },
    eq() { return chain; },
    order() { return chain; },
    limit() { return chain; },
    maybeSingle() { return chain; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return chain;
}

const summaryResults = [
  { data: null, count: 7, error: null },
  { data: null, count: 11, error: null },
  { data: { notify_posts: true }, count: null, error: null },
  { data: { following_id: actor }, count: null, error: null },
  { data: { payload: { visibility: { followers: "private", following: "community" } } }, count: null, error: null },
];
const summaryService = new SocialsFollowService({
  from() { return query(summaryResults.shift()); },
});
const summary = await summaryService.summary(actor, target);
assert.deepEqual(
  {
    followerCount: summary.followerCount,
    followingCount: summary.followingCount,
    viewerFollows: summary.viewerFollows,
    followsViewer: summary.followsViewer,
    notificationsEnabled: summary.notificationsEnabled,
    canViewFollowers: summary.canViewFollowers,
    canViewFollowing: summary.canViewFollowing,
  },
  {
    followerCount: 7,
    followingCount: 11,
    viewerFollows: true,
    followsViewer: true,
    notificationsEnabled: true,
    canViewFollowers: false,
    canViewFollowing: true,
  },
);

const followingService = new SocialsFollowService({
  from() {
    return query({
      data: [
        { following_id: target },
        { following_id: "33333333-3333-4333-8333-333333333333" },
      ],
      error: null,
    });
  },
});
const following = await followingService.following(actor);
assert.deepEqual(following.userIds, [target, "33333333-3333-4333-8333-333333333333"]);
assert.equal(following.truncated, false);

const route = await readFile(
  new URL("../src/app/api/socials-desktop/follow/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /requireExactQuery\(request, \["targetUserId"\]\)/);
assert.match(route, /requireExactQuery\(request, \[\]\)/);
assert.match(route, /mediaType !== "application\/json"/);
assert.match(route, /requireExactMutationShape/);
assert.match(route, /MAXIMUM_REQUEST_BYTES = 16 \* 1024/);
const followingRoute = await readFile(
  new URL("../src/app/api/socials-desktop/following/route.ts", import.meta.url),
  "utf8",
);
assert.match(followingRoute, /createSocialsFollowServiceFromEnv\(\)\.following\(actor\.userId\)/);
assert.match(followingRoute, /searchParams\.keys\(\)/);

process.stdout.write("SOCIALS follow mutation contract passed.\n");
