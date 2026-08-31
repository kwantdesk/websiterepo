import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DesktopRevocationSynchronizer,
  desktopRevocationSynchronizationContract,
  loadDesktopRevocationSynchronizerFromEnv,
  verifyDesktopRevocationSnapshot,
} from "../src/desktop-revocation-synchronizer.mjs";

const nowMs = Date.parse("2026-08-28T10:00:00.000Z");
const ticketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c";
const sessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4d";
const otherTicketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4e";
const keyId = "2026-08-current";
const pair = generateKeyPairSync("ed25519");

function signedSnapshot(overrides = {}, signingPair = pair, signingKeyId = keyId) {
  const unsigned = {
    schemaVersion: desktopRevocationSynchronizationContract.schemaVersion,
    keyId: signingKeyId,
    generatedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + 60_000).toISOString(),
    revokedTicketIds: [ticketId],
    revokedSessionIds: [sessionId],
    ...overrides,
  };
  const bytes = Buffer.from(JSON.stringify(unsigned), "utf8");
  try {
    return { ...unsigned, signature: sign(null, bytes, signingPair.privateKey).toString("base64url") };
  } finally {
    bytes.fill(0);
  }
}

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "kwantdesk-revocation-sync-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("verifies exact signed snapshots and supports public-key rotation", () => {
  const nextPair = generateKeyPairSync("ed25519");
  const keys = {
    [keyId]: pair.publicKey,
    "2026-09-next": nextPair.publicKey,
  };
  assert.equal(verifyDesktopRevocationSnapshot(signedSnapshot(), keys, nowMs).keyId, keyId);
  assert.equal(
    verifyDesktopRevocationSnapshot(signedSnapshot({}, nextPair, "2026-09-next"), keys, nowMs).keyId,
    "2026-09-next",
  );
});

test("rejects tampering, unknown keys, stale lifetimes, duplicates, and non-canonical ordering", () => {
  const valid = signedSnapshot();
  const tampered = structuredClone(valid);
  tampered.revokedTicketIds = [];
  assert.throws(() => verifyDesktopRevocationSnapshot(tampered, { [keyId]: pair.publicKey }, nowMs), hasCode("invalid_signature"));
  assert.throws(() => verifyDesktopRevocationSnapshot(valid, { other: pair.publicKey }, nowMs), hasCode("unknown_key"));
  assert.throws(
    () => verifyDesktopRevocationSnapshot(
      signedSnapshot({ generatedAt: new Date(nowMs - 120_000).toISOString(), expiresAt: new Date(nowMs - 60_000).toISOString() }),
      { [keyId]: pair.publicKey },
      nowMs,
    ),
    hasCode("invalid_lifetime"),
  );
  assert.throws(
    () => verifyDesktopRevocationSnapshot(
      signedSnapshot({ revokedTicketIds: [ticketId, ticketId] }),
      { [keyId]: pair.publicKey },
      nowMs,
    ),
    hasCode("invalid_identifiers"),
  );
  assert.throws(
    () => verifyDesktopRevocationSnapshot(
      signedSnapshot({ revokedTicketIds: [otherTicketId, ticketId] }),
      { [keyId]: pair.publicKey },
      nowMs,
    ),
    hasCode("invalid_identifiers"),
  );
});

test("publishes repeated valid snapshots atomically and preserves the last good file after failure", async () => {
  await withTemporaryDirectory(async (directory) => {
    const filePath = join(directory, "revocations.json");
    let responseSnapshot = signedSnapshot();
    const synchronizer = new DesktopRevocationSynchronizer({
      endpoint: "https://www.kwantdesk.com/api/desktop-auth/revocations",
      syncToken: "S".repeat(43),
      filePath,
      publicKeys: { [keyId]: pair.publicKey },
      now: () => nowMs,
      fetchImpl: async () => new Response(JSON.stringify(responseSnapshot), {
        headers: { "Content-Type": "application/json" },
      }),
    });

    await synchronizer.synchronize();
    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")).revokedTicketIds, [ticketId]);

    responseSnapshot = signedSnapshot({ revokedTicketIds: [otherTicketId] });
    await synchronizer.synchronize();
    const lastGood = await readFile(filePath, "utf8");
    assert.deepEqual(JSON.parse(lastGood).revokedTicketIds, [otherTicketId]);

    responseSnapshot = { ...responseSnapshot, revokedTicketIds: [] };
    await assert.rejects(synchronizer.synchronize(), hasCode("invalid_signature"));
    assert.equal(await readFile(filePath, "utf8"), lastGood);
    assert.equal(synchronizer.status().consecutiveFailures, 1);
  });
});

test("rejects wrong content types and both declared and streamed oversized responses without publishing", async () => {
  await withTemporaryDirectory(async (directory) => {
    for (const [response, code] of [
      [new Response("{}", { headers: { "Content-Type": "text/plain" } }), "invalid_content_type"],
      [new Response("{}", {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(desktopRevocationSynchronizationContract.maximumSnapshotBytes + 1),
        },
      }), "response_too_large"],
      [new Response(new Uint8Array(desktopRevocationSynchronizationContract.maximumSnapshotBytes + 1), {
        headers: { "Content-Type": "application/json" },
      }), "response_too_large"],
    ]) {
      const synchronizer = new DesktopRevocationSynchronizer({
        endpoint: "https://www.kwantdesk.com/api/desktop-auth/revocations",
        syncToken: "S".repeat(43),
        filePath: join(directory, `${code}.json`),
        publicKeys: { [keyId]: pair.publicKey },
        fetchImpl: async () => response,
        now: () => nowMs,
      });
      await assert.rejects(synchronizer.synchronize(), hasCode(code));
    }
  });
});

test("configuration is all-or-nothing and rejects unsafe origins", () => {
  assert.equal(loadDesktopRevocationSynchronizerFromEnv({}), null);
  assert.throws(
    () => loadDesktopRevocationSynchronizerFromEnv({ KWANTDESK_DESKTOP_REVOCATIONS_URL: "https://example.com/revocations" }),
    /requires URL, sync token, file, and public keys together/,
  );
  assert.throws(() => new DesktopRevocationSynchronizer({
    endpoint: "http://example.com/revocations",
    syncToken: "S".repeat(43),
    filePath: join(tmpdir(), "revocations.json"),
    publicKeys: { [keyId]: pair.publicKey },
  }), /HTTPS endpoint/);
});

function hasCode(code) {
  return (error) => error?.code === code;
}
