import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDesktopRevocationSnapshot,
  isDesktopRevocationSyncAuthorized,
  loadDesktopRevocationSyncToken,
} from "../src/lib/desktopAuthRevocations.server.ts";
import { DesktopRevocationSynchronizer } from "../services/rithmic_gateway/src/desktop-revocation-synchronizer.mjs";
import { DesktopTicketRevocationCache } from "../services/rithmic_gateway/src/desktop-ticket-revocations.mjs";
import { createDesktopAuthStore } from "../src/lib/desktopAuthStore.server.ts";

const now = new Date("2026-08-28T10:00:00.000Z");
const ticketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c";
const sessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4d";
const otherTicketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4e";
const pair = generateKeyPairSync("ed25519");
const signingConfig = {
  issuer: "https://www.kwantdesk.com/desktop-ticket",
  audience: "https://feed.kwantdesk.com",
  keyId: "2026-08-test",
  privateKey: pair.privateKey,
};

const storeRequests = [];
const durableStore = createDesktopAuthStore({
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-role-secret",
}, async (url, init) => {
  storeRequests.push({ url: url.toString(), init });
  const rows = url.pathname.endsWith("/desktop_sessions")
    ? [{ id: sessionId.toUpperCase() }]
    : [{ jti: ticketId.toUpperCase() }];
  return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
});
assert.deepEqual(await durableStore.readActiveRevocations({
  sessionRevokedAfter: "2026-08-28T09:54:30.000Z",
  ticketExpiresAfter: "2026-08-28T09:59:30.000Z",
}), { sessionIds: [sessionId], ticketIds: [ticketId] });
assert.equal(storeRequests.length, 2);
assert.ok(storeRequests.some(({ url }) => url.includes("desktop_sessions") && url.includes("revoked_at=gte.")));
assert.ok(storeRequests.some(({ url }) => url.includes("desktop_revoked_ticket_ids") && url.includes("expires_at=gt.")));
assert.ok(storeRequests.every(({ init }) => init.redirect === "error" && init.cache === "no-store"));

const overflowStore = createDesktopAuthStore({
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-role-secret",
}, async (url) => ({
  ok: true,
  status: 200,
  async json() {
    return url.pathname.endsWith("/desktop_sessions")
      ? Array.from({ length: 50_001 }, () => ({ id: sessionId }))
      : [];
  },
}));
await assert.rejects(
  overflowStore.readActiveRevocations({
    sessionRevokedAfter: "2026-08-28T09:54:30.000Z",
    ticketExpiresAfter: "2026-08-28T09:59:30.000Z",
  }),
  (error) => error.operation === "active_revocations_overflow" && error.status === 507,
);

let query;
const snapshot = await createDesktopRevocationSnapshot({
  store: {
    async readActiveRevocations(input) {
      query = input;
      return {
        ticketIds: [otherTicketId.toUpperCase(), ticketId],
        sessionIds: [sessionId.toUpperCase()],
      };
    },
  },
  signingConfig,
  now,
});

assert.equal(query.sessionRevokedAfter, "2026-08-28T09:54:30.000Z");
assert.equal(query.ticketExpiresAfter, "2026-08-28T09:59:30.000Z");
assert.equal(snapshot.generatedAt, now.toISOString());
assert.equal(snapshot.expiresAt, "2026-08-28T10:01:00.000Z");
assert.deepEqual(snapshot.revokedTicketIds, [ticketId, otherTicketId]);
assert.deepEqual(snapshot.revokedSessionIds, [sessionId]);

const syncToken = "S".repeat(43);
assert.equal(loadDesktopRevocationSyncToken({ KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN: syncToken }), syncToken);
assert.equal(isDesktopRevocationSyncAuthorized(`Bearer ${syncToken}`, syncToken), true);
assert.equal(isDesktopRevocationSyncAuthorized(`Bearer ${"X".repeat(43)}`, syncToken), false);

const directory = await mkdtemp(join(tmpdir(), "kwantdesk-desktop-auth-sync-"));
try {
  const filePath = join(directory, "revocations.json");
  let fetchCount = 0;
  const synchronizer = new DesktopRevocationSynchronizer({
    endpoint: "https://www.kwantdesk.com/api/desktop-auth/revocations",
    syncToken,
    filePath,
    publicKeys: { [signingConfig.keyId]: pair.publicKey },
    now: () => now.getTime(),
    fetchImpl: async (url, init) => {
      fetchCount += 1;
      assert.equal(url.toString(), "https://www.kwantdesk.com/api/desktop-auth/revocations");
      assert.equal(init.headers.Authorization, `Bearer ${syncToken}`);
      assert.equal(init.redirect, "error");
      return new Response(JSON.stringify(snapshot), {
        headers: { "Content-Type": "application/json" },
      });
    },
  });
  await Promise.all([synchronizer.synchronize(), synchronizer.synchronize(), synchronizer.synchronize()]);
  assert.equal(fetchCount, 1, "concurrent synchronizations must share one request");
  assert.equal(synchronizer.status().consecutiveFailures, 0);

  const stored = JSON.parse(await readFile(filePath, "utf8"));
  assert.equal(stored.signature, undefined, "the verified local cache does not persist transport signatures");
  assert.deepEqual(stored.revokedTicketIds, snapshot.revokedTicketIds);

  const cache = new DesktopTicketRevocationCache({
    filePath,
    refreshIntervalMs: 250,
    now: () => now.getTime(),
  });
  assert.equal(await cache.isRevoked({ jti: ticketId, sid: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4f" }), true);
  assert.equal(await cache.isRevoked({ jti: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b40", sid: sessionId }), true);
} finally {
  await rm(directory, { recursive: true, force: true });
}

const tampered = structuredClone(snapshot);
tampered.revokedTicketIds = [];
const tamperDirectory = await mkdtemp(join(tmpdir(), "kwantdesk-desktop-auth-tamper-"));
try {
  const synchronizer = new DesktopRevocationSynchronizer({
    endpoint: "https://www.kwantdesk.com/api/desktop-auth/revocations",
    syncToken,
    filePath: join(tamperDirectory, "revocations.json"),
    publicKeys: { [signingConfig.keyId]: pair.publicKey },
    now: () => now.getTime(),
    fetchImpl: async () => new Response(JSON.stringify(tampered), {
      headers: { "Content-Type": "application/json" },
    }),
  });
  await assert.rejects(synchronizer.synchronize(), (error) => error.code === "invalid_signature");
  assert.equal(synchronizer.status().lastErrorCode, "invalid_signature");
} finally {
  await rm(tamperDirectory, { recursive: true, force: true });
}

console.log("desktop auth signed revocation synchronization contract: pass");
