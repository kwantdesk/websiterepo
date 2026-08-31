import { open, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

const SNAPSHOT_SCHEMA = "kwantdesk-desktop-revocations-v1";
const MAXIMUM_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const MAXIMUM_IDENTIFIERS = 50_000;
const DEFAULT_REFRESH_INTERVAL_MS = 5_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DesktopTicketRevocationUnavailableError extends Error {
  constructor() {
    super("Desktop ticket revocation state is unavailable.");
    this.name = "DesktopTicketRevocationUnavailableError";
    this.code = "revocation_unavailable";
  }
}

export class DesktopTicketRevocationCache {
  constructor({
    filePath,
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
    now = () => Date.now(),
  }) {
    if (!isAbsolute(String(filePath || ""))) {
      throw new Error("KWANTDESK_DESKTOP_REVOCATIONS_FILE must be an absolute path.");
    }
    if (!Number.isInteger(refreshIntervalMs) || refreshIntervalMs < 250 || refreshIntervalMs > 60_000) {
      throw new Error("Desktop revocation refresh interval must be between 250 and 60000 milliseconds.");
    }
    this.filePath = filePath;
    this.refreshIntervalMs = refreshIntervalMs;
    this.now = now;
    this.nextRefreshAt = 0;
    this.modifiedAtMs = -1;
    this.snapshot = null;
    this.refreshPromise = null;
  }

  async isRevoked({ jti, sid }) {
    const normalizedJti = String(jti || "").toLowerCase();
    const normalizedSid = String(sid || "").toLowerCase();
    if (!UUID.test(normalizedJti) || !UUID.test(normalizedSid)) {
      throw new DesktopTicketRevocationUnavailableError();
    }
    await this.refreshIfDue();
    const snapshot = this.snapshot;
    if (!snapshot || snapshot.expiresAtMs <= this.now()) {
      throw new DesktopTicketRevocationUnavailableError();
    }
    return snapshot.ticketIds.has(normalizedJti) || snapshot.sessionIds.has(normalizedSid);
  }

  async refreshIfDue() {
    const currentTime = this.now();
    if (currentTime < this.nextRefreshAt && this.snapshot) return;
    if (!this.refreshPromise) {
      this.refreshPromise = this.loadSnapshot(currentTime).finally(() => {
        this.refreshPromise = null;
      });
    }
    await this.refreshPromise;
  }

  async loadSnapshot(currentTime) {
    this.nextRefreshAt = currentTime + this.refreshIntervalMs;
    let metadata;
    try {
      metadata = await stat(this.filePath);
    } catch {
      this.snapshot = null;
      throw new DesktopTicketRevocationUnavailableError();
    }
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > MAXIMUM_SNAPSHOT_BYTES) {
      this.snapshot = null;
      throw new DesktopTicketRevocationUnavailableError();
    }
    if (this.snapshot && metadata.mtimeMs === this.modifiedAtMs) return;

    let handle;
    let bytes;
    try {
      handle = await open(this.filePath, "r");
      bytes = Buffer.allocUnsafe(metadata.size);
      const { bytesRead } = await handle.read(bytes, 0, metadata.size, 0);
      if (bytesRead !== metadata.size) throw new Error("partial revocation snapshot");
      const parsed = JSON.parse(bytes.toString("utf8"));
      const snapshot = parseSnapshot(parsed, currentTime);
      this.snapshot = snapshot;
      this.modifiedAtMs = metadata.mtimeMs;
    } catch {
      this.snapshot = null;
      throw new DesktopTicketRevocationUnavailableError();
    } finally {
      bytes?.fill(0);
      if (handle) await handle.close().catch(() => {});
    }
  }
}

export function loadDesktopTicketRevocationCacheFromEnv(env = process.env, options = {}) {
  const filePath = String(env.KWANTDESK_DESKTOP_REVOCATIONS_FILE || "").trim();
  if (!filePath) return null;
  return new DesktopTicketRevocationCache({ filePath, ...options });
}

function parseSnapshot(value, nowMs) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== SNAPSHOT_SCHEMA) {
    throw new Error("invalid revocation snapshot");
  }
  const generatedAtMs = Date.parse(value.generatedAt);
  const expiresAtMs = Date.parse(value.expiresAt);
  if (
    !Number.isFinite(generatedAtMs) ||
    !Number.isFinite(expiresAtMs) ||
    generatedAtMs > nowMs + 30_000 ||
    expiresAtMs <= generatedAtMs ||
    expiresAtMs > generatedAtMs + 5 * 60_000
  ) {
    throw new Error("invalid revocation lifetime");
  }
  return Object.freeze({
    generatedAtMs,
    expiresAtMs,
    ticketIds: identifierSet(value.revokedTicketIds),
    sessionIds: identifierSet(value.revokedSessionIds),
  });
}

function identifierSet(value) {
  if (!Array.isArray(value) || value.length > MAXIMUM_IDENTIFIERS) {
    throw new Error("invalid revocation identifiers");
  }
  const result = new Set();
  for (const identifier of value) {
    const normalized = String(identifier || "").toLowerCase();
    if (!UUID.test(normalized) || result.has(normalized)) {
      throw new Error("invalid revocation identifier");
    }
    result.add(normalized);
  }
  return result;
}

export const desktopRevocationSnapshotContract = Object.freeze({
  schemaVersion: SNAPSHOT_SCHEMA,
  maximumSnapshotBytes: MAXIMUM_SNAPSHOT_BYTES,
  maximumIdentifiers: MAXIMUM_IDENTIFIERS,
  defaultRefreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
});
