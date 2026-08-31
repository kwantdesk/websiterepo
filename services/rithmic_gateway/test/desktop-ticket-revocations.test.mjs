import assert from "node:assert/strict";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DesktopTicketRevocationCache,
  DesktopTicketRevocationUnavailableError,
  desktopRevocationSnapshotContract,
  loadDesktopTicketRevocationCacheFromEnv,
} from "../src/desktop-ticket-revocations.mjs";

const ticketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c";
const sessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4d";
const otherTicketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4e";
const otherSessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4f";

async function withTemporarySnapshot(run) {
  const directory = await mkdtemp(join(tmpdir(), "kwantdesk-revocations-"));
  try {
    await run(join(directory, "revocations.json"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function snapshot(now, overrides = {}) {
  return {
    schemaVersion: desktopRevocationSnapshotContract.schemaVersion,
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    revokedTicketIds: [ticketId],
    revokedSessionIds: [sessionId],
    ...overrides,
  };
}

test("a fresh bounded snapshot revokes exact ticket and session identifiers", async () => {
  await withTemporarySnapshot(async (filePath) => {
    let currentTime = Date.parse("2026-08-28T10:00:00.000Z");
    await writeFile(filePath, JSON.stringify(snapshot(currentTime)));
    const cache = new DesktopTicketRevocationCache({
      filePath,
      refreshIntervalMs: 250,
      now: () => currentTime,
    });

    assert.equal(await cache.isRevoked({ jti: ticketId, sid: otherSessionId }), true);
    assert.equal(await cache.isRevoked({ jti: otherTicketId, sid: sessionId }), true);
    assert.equal(await cache.isRevoked({ jti: ticketId.toUpperCase(), sid: otherSessionId }), true);
    assert.equal(await cache.isRevoked({ jti: otherTicketId, sid: otherSessionId }), false);

    currentTime += 300;
    await writeFile(filePath, JSON.stringify(snapshot(currentTime, {
      revokedTicketIds: [],
      revokedSessionIds: [],
    })));
    await utimes(filePath, new Date(currentTime + 1_000), new Date(currentTime + 1_000));
    assert.equal(await cache.isRevoked({ jti: ticketId, sid: sessionId }), false);
  });
});

test("missing, malformed, stale, and oversized snapshots fail closed", async () => {
  await withTemporarySnapshot(async (filePath) => {
    const currentTime = Date.parse("2026-08-28T10:00:00.000Z");
    const cache = new DesktopTicketRevocationCache({
      filePath,
      refreshIntervalMs: 250,
      now: () => currentTime,
    });
    await assert.rejects(
      cache.isRevoked({ jti: ticketId, sid: sessionId }),
      DesktopTicketRevocationUnavailableError,
    );

    await writeFile(filePath, "not-json");
    await assert.rejects(
      cache.isRevoked({ jti: ticketId, sid: sessionId }),
      DesktopTicketRevocationUnavailableError,
    );

    await writeFile(filePath, JSON.stringify(snapshot(currentTime - 120_000)));
    await assert.rejects(
      cache.isRevoked({ jti: ticketId, sid: sessionId }),
      DesktopTicketRevocationUnavailableError,
    );

    await writeFile(filePath, Buffer.alloc(desktopRevocationSnapshotContract.maximumSnapshotBytes + 1));
    await assert.rejects(
      cache.isRevoked({ jti: ticketId, sid: sessionId }),
      DesktopTicketRevocationUnavailableError,
    );
  });
});

test("configuration requires an absolute snapshot path and remains optional when unset", () => {
  assert.equal(loadDesktopTicketRevocationCacheFromEnv({}), null);
  assert.throws(
    () => loadDesktopTicketRevocationCacheFromEnv({ KWANTDESK_DESKTOP_REVOCATIONS_FILE: "relative.json" }),
    /absolute path/,
  );
});
