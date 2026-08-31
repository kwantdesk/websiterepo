import assert from "node:assert/strict";

import {
  buildSocialViewerAccess,
  canViewerReadSocialRow,
  selectVisibleSocialRows,
} from "../src/lib/socialsVisibility.ts";

const actor = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const friend = "12f89b8f-4298-4cd0-b19e-72648570be01";
const stranger = "54a4c8b2-3195-4ed7-8052-e13fe692c477";
const timestamp = "2026-08-30T00:00:00Z";
const row = (user_id, id, scope, desk_id = null, object_type = "post", payload = {}) => ({
  user_id, id, author_label: "Trader", object_type, scope, desk_id, parent_id: null,
  payload, created_at: timestamp, updated_at: timestamp,
});
const relationships = [
  row(actor, "follow:friend", "private", null, "follow", { targetUserId: friend }),
  row(friend, "follow:actor", "private", null, "follow", { targetUserId: actor }),
  row(actor, "follow:stranger", "private", null, "follow", { targetUserId: stranger }),
];
const access = buildSocialViewerAccess(actor, relationships, ["desk-alpha"]);
assert.deepEqual([...access.friendIds], [friend]);

const candidates = [
  row(actor, "own-private", "private"),
  row(stranger, "other-private", "private"),
  row(friend, "friend-visible", "friends"),
  row(stranger, "one-way-not-friend", "friends"),
  row(stranger, "desk-visible", "desk", "desk-alpha"),
  row(stranger, "other-desk", "desk", "desk-beta"),
  row(stranger, "community-visible", "community"),
];
assert.deepEqual(
  selectVisibleSocialRows(candidates, access).map((item) => item.id),
  ["own-private", "friend-visible", "desk-visible", "community-visible"],
);
assert.equal(canViewerReadSocialRow(row(actor, "own-desk", "desk", "desk-beta"), access), true);

process.stdout.write("SOCIALS viewer privacy policy passed.\n");
