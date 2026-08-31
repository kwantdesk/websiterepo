import type { DesktopScope } from "@/lib/desktopAuthProtocol.server.ts";

export type DesktopEntitlementRecord = {
  userId: string;
  enabled: boolean;
  scopes: DesktopScope[];
  expiresAt: string | null;
};

export type DesktopAuthorizationCodeRecord = {
  codeHash: string;
  userId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: DesktopScope[];
  clientVersion: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type DesktopSessionRecord = {
  sessionId: string;
  userId: string;
  grantedScopes: DesktopScope[];
  clientVersion: string;
};

export type DesktopActiveRevocations = {
  ticketIds: string[];
  sessionIds: string[];
};

export interface DesktopAuthStore {
  readEntitlement(userId: string, signal?: AbortSignal): Promise<DesktopEntitlementRecord | null>;
  insertAuthorizationCode(record: DesktopAuthorizationCodeRecord, signal?: AbortSignal): Promise<void>;
  readAuthorizationCode(codeHash: string, signal?: AbortSignal): Promise<DesktopAuthorizationCodeRecord | null>;
  exchangeAuthorizationCode(input: {
    codeHash: string;
    redirectUri: string;
    refreshHash: string;
    refreshExpiresAt: string;
    ticketJti: string;
  }, signal?: AbortSignal): Promise<DesktopSessionRecord | null>;
  rotateRefreshHandle(input: {
    currentRefreshHash: string;
    nextRefreshHash: string;
    nextRefreshExpiresAt: string;
    ticketJti: string;
  }, signal?: AbortSignal): Promise<DesktopSessionRecord | null>;
  revokeSession(refreshHash: string, reason: string, signal?: AbortSignal): Promise<boolean>;
  readActiveRevocations(input: {
    sessionRevokedAfter: string;
    ticketExpiresAfter: string;
  }, signal?: AbortSignal): Promise<DesktopActiveRevocations>;
}

type StoreConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

type FetchLike = typeof fetch;
const MAXIMUM_ACTIVE_REVOCATIONS_PER_KIND = 50_000;

export class DesktopAuthStoreError extends Error {
  readonly operation: string;
  readonly status: number;

  constructor(
    operation: string,
    status: number,
  ) {
    super("The durable desktop authentication store is unavailable.");
    this.name = "DesktopAuthStoreError";
    this.operation = operation;
    this.status = status;
  }
}

export function createDesktopAuthStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): DesktopAuthStore | null {
  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl && !serviceRoleKey) return null;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Desktop authentication requires Supabase URL and service-role key together.");
  }
  return createDesktopAuthStore({ supabaseUrl, serviceRoleKey }, fetchImpl);
}

export function createDesktopAuthStore(
  config: StoreConfig,
  fetchImpl: FetchLike = fetch,
): DesktopAuthStore {
  const origin = new URL(config.supabaseUrl);
  if (origin.protocol !== "https:" && origin.hostname !== "127.0.0.1" && origin.hostname !== "localhost") {
    throw new Error("Supabase desktop-auth storage requires HTTPS outside loopback development.");
  }
  if (!config.serviceRoleKey.trim()) throw new Error("Supabase service-role key is required.");

  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function request(path: string, init: RequestInit, operation: string) {
    const response = await fetchImpl(new URL(path, origin), {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new DesktopAuthStoreError(operation, response.status);
    return response;
  }

  return {
    async readEntitlement(userId, signal) {
      const query = new URLSearchParams({
        select: "user_id,enabled,scopes,expires_at",
        user_id: `eq.${userId}`,
        limit: "1",
      });
      const response = await request(
        `/rest/v1/desktop_access_entitlements?${query}`,
        { signal },
        "read_entitlement",
      );
      const rows = await response.json() as unknown[];
      return rows.length ? parseEntitlement(rows[0]) : null;
    },

    async insertAuthorizationCode(record, signal) {
      await request(
        "/rest/v1/desktop_authorization_codes",
        {
          method: "POST",
          signal,
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify([{
            code_hash: record.codeHash,
            user_id: record.userId,
            code_challenge: record.codeChallenge,
            redirect_uri: record.redirectUri,
            scopes: record.scopes,
            client_version: record.clientVersion,
            created_at: record.createdAt,
            expires_at: record.expiresAt,
            consumed_at: record.consumedAt,
          }]),
        },
        "insert_authorization_code",
      );
    },

    async readAuthorizationCode(codeHash, signal) {
      const query = new URLSearchParams({
        select: "code_hash,user_id,code_challenge,redirect_uri,scopes,client_version,created_at,expires_at,consumed_at",
        code_hash: `eq.${codeHash}`,
        limit: "1",
      });
      const response = await request(
        `/rest/v1/desktop_authorization_codes?${query}`,
        { signal },
        "read_authorization_code",
      );
      const rows = await response.json() as unknown[];
      return rows.length ? parseAuthorizationCode(rows[0]) : null;
    },

    async exchangeAuthorizationCode(input, signal) {
      const response = await request(
        "/rest/v1/rpc/desktop_exchange_authorization_code",
        {
          method: "POST",
          signal,
          body: JSON.stringify({
            requested_code_hash: input.codeHash,
            requested_redirect_uri: input.redirectUri,
            new_refresh_hash: input.refreshHash,
            new_refresh_expires_at: input.refreshExpiresAt,
            new_ticket_jti: input.ticketJti,
          }),
        },
        "exchange_authorization_code",
      );
      const rows = await response.json() as unknown[];
      return rows.length ? parseSession(rows[0]) : null;
    },

    async rotateRefreshHandle(input, signal) {
      const response = await request(
        "/rest/v1/rpc/desktop_rotate_refresh_handle",
        {
          method: "POST",
          signal,
          body: JSON.stringify({
            current_refresh_hash: input.currentRefreshHash,
            next_refresh_hash: input.nextRefreshHash,
            next_refresh_expires_at: input.nextRefreshExpiresAt,
            next_ticket_jti: input.ticketJti,
          }),
        },
        "rotate_refresh_handle",
      );
      const rows = await response.json() as unknown[];
      return rows.length ? parseSession(rows[0]) : null;
    },

    async revokeSession(refreshHash, reason, signal) {
      const response = await request(
        "/rest/v1/rpc/desktop_revoke_session",
        {
          method: "POST",
          signal,
          body: JSON.stringify({
            requested_refresh_hash: refreshHash,
            requested_reason: reason,
          }),
        },
        "revoke_session",
      );
      return Boolean(await response.json());
    },

    async readActiveRevocations(input, signal) {
      const sessionQuery = new URLSearchParams({
        select: "id",
        revoked_at: `gte.${input.sessionRevokedAfter}`,
        order: "id.asc",
        limit: String(MAXIMUM_ACTIVE_REVOCATIONS_PER_KIND + 1),
      });
      const ticketQuery = new URLSearchParams({
        select: "jti",
        expires_at: `gt.${input.ticketExpiresAfter}`,
        order: "jti.asc",
        limit: String(MAXIMUM_ACTIVE_REVOCATIONS_PER_KIND + 1),
      });
      const [sessionResponse, ticketResponse] = await Promise.all([
        request(`/rest/v1/desktop_sessions?${sessionQuery}`, { signal }, "read_revoked_sessions"),
        request(`/rest/v1/desktop_revoked_ticket_ids?${ticketQuery}`, { signal }, "read_revoked_tickets"),
      ]);
      const [sessionRows, ticketRows] = await Promise.all([
        sessionResponse.json() as Promise<unknown[]>,
        ticketResponse.json() as Promise<unknown[]>,
      ]);
      if (
        sessionRows.length > MAXIMUM_ACTIVE_REVOCATIONS_PER_KIND ||
        ticketRows.length > MAXIMUM_ACTIVE_REVOCATIONS_PER_KIND
      ) {
        throw new DesktopAuthStoreError("active_revocations_overflow", 507);
      }
      return {
        sessionIds: sessionRows.map((value) => uuidText(objectRow(value).id)),
        ticketIds: ticketRows.map((value) => uuidText(objectRow(value).jti)),
      };
    },
  };
}

function parseEntitlement(value: unknown): DesktopEntitlementRecord {
  const row = objectRow(value);
  return {
    userId: text(row.user_id),
    enabled: row.enabled === true,
    scopes: scopes(row.scopes),
    expiresAt: nullableText(row.expires_at),
  };
}

function parseAuthorizationCode(value: unknown): DesktopAuthorizationCodeRecord {
  const row = objectRow(value);
  return {
    codeHash: text(row.code_hash),
    userId: text(row.user_id),
    codeChallenge: text(row.code_challenge),
    redirectUri: text(row.redirect_uri),
    scopes: scopes(row.scopes),
    clientVersion: text(row.client_version),
    createdAt: text(row.created_at),
    expiresAt: text(row.expires_at),
    consumedAt: nullableText(row.consumed_at),
  };
}

function parseSession(value: unknown): DesktopSessionRecord {
  const row = objectRow(value);
  return {
    sessionId: text(row.session_id),
    userId: text(row.user_id),
    grantedScopes: scopes(row.granted_scopes),
    clientVersion: text(row.client_version),
  };
}

function objectRow(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DesktopAuthStoreError("parse_response", 502);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value) throw new DesktopAuthStoreError("parse_response", 502);
  return value;
}

function uuidText(value: unknown): string {
  const result = text(value).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)) {
    throw new DesktopAuthStoreError("parse_response", 502);
  }
  return result;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function scopes(value: unknown): DesktopScope[] {
  if (!Array.isArray(value) || value.some((scope) => typeof scope !== "string")) {
    throw new DesktopAuthStoreError("parse_response", 502);
  }
  return [...value] as DesktopScope[];
}
