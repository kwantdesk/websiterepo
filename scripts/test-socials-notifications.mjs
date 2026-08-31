import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  SocialsNotificationsError,
  SocialsNotificationsService,
} from "../src/lib/socialsNotifications.server.ts";

const actor = "8f3b0a7d-2f69-4dc4-9ad8-bc6a76fb4441";
const source = "11111111-1111-4111-8111-111111111111";
const notificationId = "33333333-3333-4333-8333-333333333333";

function supabase(resultFor) {
  return {
    from(table) {
      const state = { table, select: "", head: false, update: null, filters: [], range: null };
      const chain = {
        select(value, options = {}) { state.select = value; state.head = options.head === true; return chain; },
        update(value) { state.update = value; return chain; },
        eq(key, value) { state.filters.push(["eq", key, value]); return chain; },
        is(key, value) { state.filters.push(["is", key, value]); return chain; },
        in(key, value) { state.filters.push(["in", key, value]); return chain; },
        order() { return chain; },
        limit() { return chain; },
        range(from, to) { state.range = [from, to]; return chain; },
        then(resolve, reject) { return Promise.resolve(resultFor(state)).then(resolve, reject); },
      };
      return chain;
    },
  };
}

const calls = [];
const service = new SocialsNotificationsService(supabase((state) => {
  calls.push(state);
  if (state.table === "social_notifications" && state.head) {
    return { data: null, count: 1, error: null };
  }
  if (state.table === "social_notifications" && !state.update) {
    return {
      data: [{
        id: notificationId,
        source_user_id: source,
        source_object_id: "profile:alex",
        kind: "new_follower",
        payload: { objectType: "profile" },
        read_at: null,
        created_at: "2026-08-30T00:00:00Z",
      }],
      error: null,
    };
  }
  if (state.table === "social_objects") {
    return {
      data: [{
        user_id: source,
        author_label: "Fallback Trader",
        payload: {
          displayName: "Alex Trader",
          handle: "alex_trader",
          avatarUrl: "https://cdn.example/avatar.png",
        },
      }],
      error: null,
    };
  }
  if (state.table === "social_notifications" && state.update) {
    return { data: [{ id: notificationId }], error: null };
  }
  throw new Error(`Unexpected test query: ${state.table}`);
}));

const page = await service.page(actor.toUpperCase(), "0", "30");
assert.equal(page.version, 1);
assert.equal(page.configured, true);
assert.equal(page.unreadCount, 1);
assert.equal(page.items.length, 1);
assert.equal(page.items[0].sourceDisplayName, "Alex Trader");
assert.equal(page.items[0].sourceHandle, "alex_trader");
assert.deepEqual(calls.find((call) => call.range)?.range, [0, 29]);

const marked = await service.mark(actor, { action: "read", ids: [notificationId] });
assert.equal(marked.version, 1);
assert.equal(marked.action, "read");
assert.equal(marked.updated, 1);
assert.ok(calls.some((call) => call.update?.read_at));

for (const query of [[-1, 30], [0, 0], [0, 101]]) {
  await assert.rejects(
    service.page(actor, query[0], query[1]),
    (error) => error instanceof SocialsNotificationsError
      && error.code === "socials_invalid_notification_query",
  );
}
await assert.rejects(
  service.mark(actor, { action: "read", ids: ["invalid"] }),
  (error) => error instanceof SocialsNotificationsError
    && error.code === "socials_invalid_notification_request",
);

const migration = new SocialsNotificationsService(supabase(() => ({
  data: null,
  count: null,
  error: { code: "42P01", message: "missing table" },
})));
const unavailable = await migration.page(actor, 0, 30);
assert.equal(unavailable.configured, false);
assert.equal(unavailable.code, "FOLLOW_MIGRATION_REQUIRED");
assert.deepEqual(unavailable.items, []);

const route = await readFile(
  new URL("../src/app/api/socials-desktop/notifications/route.ts", import.meta.url),
  "utf8",
);
assert.match(route, /requireExactQuery\(request, \["offset", "limit"\]\)/);
assert.match(route, /requireExactQuery\(request, \[\]\)/);
assert.match(route, /MAXIMUM_REQUEST_BYTES = 16 \* 1024/);
assert.match(route, /createSocialsNotificationsServiceFromEnv\(\)\.mark/);

process.stdout.write("SOCIALS notification authority contract passed.\n");
