import { sign, timingSafeEqual } from "node:crypto";

import {
  DESKTOP_GATEWAY_TICKET_LIFETIME_SECONDS,
  type DesktopTicketSigningConfig,
} from "@/lib/desktopAuthProtocol.server.ts";
import type { DesktopAuthStore } from "@/lib/desktopAuthStore.server.ts";

export const DESKTOP_REVOCATION_SNAPSHOT_SCHEMA = "kwantdesk-desktop-revocations-v1";
export const DESKTOP_REVOCATION_SNAPSHOT_LIFETIME_MS = 60_000;
export const DESKTOP_REVOCATION_CLOCK_SKEW_MS = 30_000;

export type DesktopRevocationSnapshot = {
  schemaVersion: typeof DESKTOP_REVOCATION_SNAPSHOT_SCHEMA;
  keyId: string;
  generatedAt: string;
  expiresAt: string;
  revokedTicketIds: string[];
  revokedSessionIds: string[];
  signature: string;
};

export async function createDesktopRevocationSnapshot(options: {
  store: DesktopAuthStore;
  signingConfig: DesktopTicketSigningConfig;
  now?: Date;
  signal?: AbortSignal;
}): Promise<DesktopRevocationSnapshot> {
  const currentTime = options.now ?? new Date();
  const currentTimeMs = currentTime.getTime();
  if (!Number.isFinite(currentTimeMs)) throw new Error("Desktop revocation snapshot time is invalid.");
  const revocations = await options.store.readActiveRevocations({
    sessionRevokedAfter: new Date(
      currentTimeMs - (DESKTOP_GATEWAY_TICKET_LIFETIME_SECONDS * 1_000) - DESKTOP_REVOCATION_CLOCK_SKEW_MS,
    ).toISOString(),
    ticketExpiresAfter: new Date(currentTimeMs - DESKTOP_REVOCATION_CLOCK_SKEW_MS).toISOString(),
  }, options.signal);
  const unsigned = {
    schemaVersion: DESKTOP_REVOCATION_SNAPSHOT_SCHEMA,
    keyId: options.signingConfig.keyId,
    generatedAt: currentTime.toISOString(),
    expiresAt: new Date(currentTimeMs + DESKTOP_REVOCATION_SNAPSHOT_LIFETIME_MS).toISOString(),
    revokedTicketIds: normalizedIds(revocations.ticketIds),
    revokedSessionIds: normalizedIds(revocations.sessionIds),
  } as const;
  const signature = sign(
    null,
    desktopRevocationSigningBytes(unsigned),
    options.signingConfig.privateKey,
  ).toString("base64url");
  return { ...unsigned, signature };
}

export function desktopRevocationSigningBytes(
  snapshot: Omit<DesktopRevocationSnapshot, "signature">,
): Buffer {
  return Buffer.from(JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    keyId: snapshot.keyId,
    generatedAt: snapshot.generatedAt,
    expiresAt: snapshot.expiresAt,
    revokedTicketIds: snapshot.revokedTicketIds,
    revokedSessionIds: snapshot.revokedSessionIds,
  }), "utf8");
}

export function loadDesktopRevocationSyncToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = String(env.KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN || "").trim();
  if (!token) return null;
  if (token.length < 32 || token.length > 512 || /\s/.test(token)) {
    throw new Error("Desktop revocation synchronization token is invalid.");
  }
  return token;
}

export function isDesktopRevocationSyncAuthorized(header: string | null, expectedToken: string): boolean {
  const value = String(header || "");
  if (!value.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7).trim(), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function normalizedIds(values: readonly string[]) {
  const result = values.map((value) => String(value).toLowerCase()).sort();
  if (
    result.some((value) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) ||
    new Set(result).size !== result.length
  ) {
    throw new Error("Desktop revocation identifiers are invalid.");
  }
  return result;
}
