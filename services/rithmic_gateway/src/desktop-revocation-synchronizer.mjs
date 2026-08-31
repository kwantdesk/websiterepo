import { createPublicKey, randomUUID, verify as verifySignature } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";

const SNAPSHOT_SCHEMA = "kwantdesk-desktop-revocations-v1";
const MAXIMUM_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MAXIMUM_IDENTIFIERS = 50_000;
const DEFAULT_POLL_INTERVAL_MS = 15_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const NORMALIZED_KEY_ID = /^[A-Za-z0-9._:+-]{1,180}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class DesktopRevocationSynchronizer {
  constructor({
    endpoint,
    syncToken,
    filePath,
    publicKeys,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    fetchImpl = fetch,
    now = () => Date.now(),
    log = () => {},
  }) {
    this.endpoint = validateEndpoint(endpoint);
    this.syncToken = validateSyncToken(syncToken);
    if (!isAbsolute(String(filePath || ""))) {
      throw new Error("KWANTDESK_DESKTOP_REVOCATIONS_FILE must be an absolute path.");
    }
    this.filePath = filePath;
    this.publicKeys = loadPublicKeys(publicKeys);
    this.pollIntervalMs = boundedInteger(pollIntervalMs, 5_000, 60_000, "poll interval");
    this.requestTimeoutMs = boundedInteger(requestTimeoutMs, 1_000, 15_000, "request timeout");
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.log = log;
    this.timer = null;
    this.inFlight = null;
    this.lastSuccessAt = null;
    this.lastErrorAt = null;
    this.lastErrorCode = null;
    this.consecutiveFailures = 0;
  }

  start() {
    if (this.timer) return;
    void this.synchronize().catch(() => {});
    this.timer = setInterval(() => void this.synchronize().catch(() => {}), this.pollIntervalMs);
    this.timer.unref?.();
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.inFlight?.catch(() => {});
  }

  synchronize() {
    if (!this.inFlight) {
      this.inFlight = this.synchronizeOnce()
        .finally(() => { this.inFlight = null; });
    }
    return this.inFlight;
  }

  async synchronizeOnce() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("desktop revocation sync timeout")), this.requestTimeoutMs);
    timeout.unref?.();
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.syncToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw syncFailure(`http_${response.status}`);
      const mediaType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
      if (mediaType !== "application/json") throw syncFailure("invalid_content_type");
      const bytes = await readBoundedResponse(response, MAXIMUM_SNAPSHOT_BYTES);
      try {
        let parsed;
        try {
          parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          throw syncFailure("invalid_json");
        }
        const snapshot = verifyDesktopRevocationSnapshot(parsed, this.publicKeys, this.now());
        await writeSnapshotAtomically(this.filePath, snapshot);
        this.lastSuccessAt = new Date(this.now()).toISOString();
        this.lastErrorAt = null;
        this.lastErrorCode = null;
        this.consecutiveFailures = 0;
        return snapshot;
      } finally {
        bytes.fill(0);
      }
    } catch (error) {
      const failure = error?.code ? error : syncFailure("sync_unavailable");
      this.lastErrorAt = new Date(this.now()).toISOString();
      this.lastErrorCode = failure.code;
      this.consecutiveFailures += 1;
      this.log(`[desktop-revocations] synchronization failed: ${failure.code}`);
      throw failure;
    } finally {
      clearTimeout(timeout);
    }
  }

  status() {
    return Object.freeze({
      configured: true,
      running: Boolean(this.timer),
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastErrorCode: this.lastErrorCode,
      consecutiveFailures: this.consecutiveFailures,
    });
  }
}

export function loadDesktopRevocationSynchronizerFromEnv(env = process.env, options = {}) {
  const endpoint = String(env.KWANTDESK_DESKTOP_REVOCATIONS_URL || "").trim();
  const syncToken = String(env.KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN || "").trim();
  const filePath = String(env.KWANTDESK_DESKTOP_REVOCATIONS_FILE || "").trim();
  const encodedKeys = String(env.KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON || "").trim();
  const configuredCount = [endpoint, syncToken, filePath, encodedKeys].filter(Boolean).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== 4) {
    throw new Error("Desktop revocation synchronization requires URL, sync token, file, and public keys together.");
  }
  let publicKeys;
  try {
    publicKeys = JSON.parse(encodedKeys);
  } catch {
    throw new Error("KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON must be valid JSON.");
  }
  const pollIntervalMs = optionalInteger(env.KWANTDESK_DESKTOP_REVOCATIONS_POLL_MS, DEFAULT_POLL_INTERVAL_MS);
  return new DesktopRevocationSynchronizer({
    endpoint,
    syncToken,
    filePath,
    publicKeys,
    pollIntervalMs,
    ...options,
  });
}

export function verifyDesktopRevocationSnapshot(value, publicKeys, nowMs = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw syncFailure("invalid_snapshot");
  if (value.schemaVersion !== SNAPSHOT_SCHEMA || !NORMALIZED_KEY_ID.test(String(value.keyId || ""))) {
    throw syncFailure("invalid_snapshot");
  }
  const publicKey = publicKeys instanceof Map ? publicKeys.get(value.keyId) : loadPublicKeys(publicKeys).get(value.keyId);
  if (!publicKey) throw syncFailure("unknown_key");
  const generatedAtMs = Date.parse(value.generatedAt);
  const expiresAtMs = Date.parse(value.expiresAt);
  if (
    !Number.isFinite(generatedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    generatedAtMs > nowMs + 30_000 ||
    expiresAtMs <= nowMs ||
    expiresAtMs <= generatedAtMs ||
    expiresAtMs > generatedAtMs + 5 * 60_000
  ) {
    throw syncFailure("invalid_lifetime");
  }
  const revokedTicketIds = normalizedIdentifiers(value.revokedTicketIds);
  const revokedSessionIds = normalizedIdentifiers(value.revokedSessionIds);
  const unsigned = {
    schemaVersion: SNAPSHOT_SCHEMA,
    keyId: value.keyId,
    generatedAt: value.generatedAt,
    expiresAt: value.expiresAt,
    revokedTicketIds,
    revokedSessionIds,
  };
  if (typeof value.signature !== "string" || !/^[A-Za-z0-9_-]+$/.test(value.signature)) {
    throw syncFailure("invalid_signature");
  }
  const signature = Buffer.from(value.signature, "base64url");
  if (signature.length !== 64 || signature.toString("base64url") !== value.signature) {
    throw syncFailure("invalid_signature");
  }
  const valid = verifySignature(null, signingBytes(unsigned), publicKey, signature);
  signature.fill(0);
  if (!valid) throw syncFailure("invalid_signature");
  return Object.freeze(unsigned);
}

async function readBoundedResponse(response, maximumBytes) {
  if (!response.body) throw syncFailure("empty_response");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) throw syncFailure("response_too_large");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumBytes) {
        value.fill(0);
        await reader.cancel();
        throw syncFailure("response_too_large");
      }
      chunks.push(value);
    }
    const result = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  } finally {
    reader.releaseLock();
    chunks.forEach((chunk) => chunk.fill(0));
  }
}

async function writeSnapshotAtomically(filePath, snapshot) {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = join(directory, `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  const bytes = Buffer.from(JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    revokedTicketIds: snapshot.revokedTicketIds,
    revokedSessionIds: snapshot.revokedSessionIds,
  }), "utf8");
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } finally {
    bytes.fill(0);
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch(() => {});
  }
}

function signingBytes(snapshot) {
  return Buffer.from(JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    keyId: snapshot.keyId,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    revokedTicketIds: snapshot.revokedTicketIds,
    revokedSessionIds: snapshot.revokedSessionIds,
  }), "utf8");
}

function normalizedIdentifiers(value) {
  if (!Array.isArray(value) || value.length > MAXIMUM_IDENTIFIERS) throw syncFailure("invalid_identifiers");
  const result = value.map((identifier) => String(identifier || "").toLowerCase());
  if (
    result.some((identifier) => !UUID.test(identifier)) ||
    new Set(result).size !== result.length ||
    result.some((identifier, index) => index > 0 && result[index - 1] > identifier)
  ) {
    throw syncFailure("invalid_identifiers");
  }
  return result;
}

function loadPublicKeys(publicKeys) {
  const entries = publicKeys instanceof Map ? [...publicKeys.entries()] : Object.entries(publicKeys || {});
  if (!entries.length) throw new Error("At least one desktop revocation verification key is required.");
  const result = new Map();
  for (const [keyId, encodedKey] of entries) {
    if (!NORMALIZED_KEY_ID.test(keyId)) throw new Error("Desktop revocation key IDs must be normalized tokens.");
    const key = encodedKey?.type === "public" && typeof encodedKey.export === "function"
      ? encodedKey
      : createPublicKey(encodedKey);
    if (key.asymmetricKeyType !== "ed25519") throw new Error(`Desktop revocation key ${keyId} must be Ed25519.`);
    result.set(keyId, key);
  }
  return result;
}

function validateEndpoint(value) {
  const endpoint = new URL(value);
  if (
    (endpoint.protocol !== "https:" && endpoint.hostname !== "127.0.0.1" && endpoint.hostname !== "localhost") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("Desktop revocation synchronization requires an HTTPS endpoint outside loopback development.");
  }
  return endpoint;
}

function validateSyncToken(value) {
  const token = String(value || "").trim();
  if (token.length < 32 || token.length > 512 || /\s/.test(token)) {
    throw new Error("Desktop revocation synchronization token is invalid.");
  }
  return token;
}

function boundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Desktop revocation ${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function optionalInteger(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return Number(value);
}

function syncFailure(code) {
  const error = new Error("Desktop revocation synchronization failed.");
  error.name = "DesktopRevocationSynchronizationError";
  error.code = code;
  return error;
}

export const desktopRevocationSynchronizationContract = Object.freeze({
  schemaVersion: SNAPSHOT_SCHEMA,
  maximumSnapshotBytes: MAXIMUM_SNAPSHOT_BYTES,
  maximumIdentifiers: MAXIMUM_IDENTIFIERS,
  defaultPollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  defaultRequestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
});
