import { randomUUID } from "node:crypto";
import {
  createOpaqueDesktopToken,
  DESKTOP_AUTHORIZATION_CODE_LIFETIME_MS,
  DESKTOP_REFRESH_LIFETIME_MS,
  hashOpaqueDesktopToken,
  signDesktopGatewayTicket,
  validateLoopbackRedirect,
  verifyPkceS256Challenge,
  type DesktopAuthorizationRequest,
  type DesktopScope,
  type DesktopTicketSigningConfig,
} from "@/lib/desktopAuthProtocol.server.ts";
import type { DesktopAuthStore, DesktopSessionRecord } from "@/lib/desktopAuthStore.server.ts";

export type DesktopSessionEnvelope = {
  refreshHandle: string;
  accessTicket: {
    accessToken: string;
    issuedAt: string;
    expiresAt: string;
    grantedScopes: DesktopScope[];
  };
};

export class DesktopAuthServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    status: number,
  ) {
    super("Desktop authentication could not be completed.");
    this.name = "DesktopAuthServiceError";
    this.code = code;
    this.status = status;
  }
}

export function createDesktopAuthService(options: {
  store: DesktopAuthStore;
  signingConfig: DesktopTicketSigningConfig;
  now?: () => Date;
  opaqueToken?: () => string;
  ticketId?: () => string;
}) {
  const now = options.now ?? (() => new Date());
  const opaqueToken = options.opaqueToken ?? createOpaqueDesktopToken;
  const ticketId = options.ticketId ?? randomUUID;

  return {
    async authorize(
      userId: string,
      request: DesktopAuthorizationRequest,
      signal?: AbortSignal,
    ) {
      const currentTime = now();
      const entitlement = await options.store.readEntitlement(userId, signal);
      if (
        !entitlement ||
        !entitlement.enabled ||
        (entitlement.expiresAt && Date.parse(entitlement.expiresAt) <= currentTime.getTime()) ||
        request.scopes.some((scope) => !entitlement.scopes.includes(scope))
      ) {
        throw new DesktopAuthServiceError("desktop_access_denied", 403);
      }

      const code = opaqueToken();
      const codeHash = hashOpaqueDesktopToken(code);
      const createdAt = currentTime.toISOString();
      const expiresAt = new Date(currentTime.getTime() + DESKTOP_AUTHORIZATION_CODE_LIFETIME_MS).toISOString();
      await options.store.insertAuthorizationCode({
        codeHash,
        userId,
        codeChallenge: request.codeChallenge,
        redirectUri: request.redirectUri,
        scopes: request.scopes,
        clientVersion: request.clientVersion,
        createdAt,
        expiresAt,
        consumedAt: null,
      }, signal);

      const redirect = new URL(request.redirectUri);
      redirect.searchParams.set("code", code);
      redirect.searchParams.set("state", request.state);
      return { redirectUri: redirect.toString(), expiresAt };
    },

    async exchange(input: {
      authorizationCode: string;
      codeVerifier: string;
      redirectUri: string;
    }, signal?: AbortSignal): Promise<DesktopSessionEnvelope> {
      validateOpaqueToken(input.authorizationCode, "invalid_grant");
      validateLoopbackRedirect(input.redirectUri);
      const currentTime = now();
      const codeHash = hashOpaqueDesktopToken(input.authorizationCode);
      const code = await options.store.readAuthorizationCode(codeHash, signal);
      if (
        !code ||
        code.consumedAt ||
        code.redirectUri !== input.redirectUri ||
        Date.parse(code.expiresAt) <= currentTime.getTime() ||
        !verifyPkceS256Challenge(input.codeVerifier, code.codeChallenge)
      ) {
        throw new DesktopAuthServiceError("invalid_grant", 400);
      }

      const refreshHandle = opaqueToken();
      const jti = ticketId();
      const session = await options.store.exchangeAuthorizationCode({
        codeHash,
        redirectUri: input.redirectUri,
        refreshHash: hashOpaqueDesktopToken(refreshHandle),
        refreshExpiresAt: new Date(currentTime.getTime() + DESKTOP_REFRESH_LIFETIME_MS).toISOString(),
        ticketJti: jti,
      }, signal);
      if (!session) throw new DesktopAuthServiceError("invalid_grant", 400);
      return sessionEnvelope(refreshHandle, session, jti, options.signingConfig, currentTime);
    },

    async refresh(refreshHandle: string, signal?: AbortSignal): Promise<DesktopSessionEnvelope> {
      validateOpaqueToken(refreshHandle, "invalid_refresh");
      const currentTime = now();
      const nextRefreshHandle = opaqueToken();
      const jti = ticketId();
      const session = await options.store.rotateRefreshHandle({
        currentRefreshHash: hashOpaqueDesktopToken(refreshHandle),
        nextRefreshHash: hashOpaqueDesktopToken(nextRefreshHandle),
        nextRefreshExpiresAt: new Date(currentTime.getTime() + DESKTOP_REFRESH_LIFETIME_MS).toISOString(),
        ticketJti: jti,
      }, signal);
      if (!session) throw new DesktopAuthServiceError("invalid_refresh", 401);
      return sessionEnvelope(nextRefreshHandle, session, jti, options.signingConfig, currentTime);
    },

    async revoke(refreshHandle: string, signal?: AbortSignal): Promise<void> {
      validateOpaqueToken(refreshHandle, "invalid_refresh");
      await options.store.revokeSession(hashOpaqueDesktopToken(refreshHandle), "sign_out", signal);
    },
  };
}

function sessionEnvelope(
  refreshHandle: string,
  session: DesktopSessionRecord,
  jti: string,
  signingConfig: DesktopTicketSigningConfig,
  now: Date,
): DesktopSessionEnvelope {
  const ticket = signDesktopGatewayTicket({
    userId: session.userId,
    sessionId: session.sessionId,
    scopes: session.grantedScopes,
    clientVersion: session.clientVersion,
    jti,
  }, signingConfig, now);
  return {
    refreshHandle,
    accessTicket: {
      accessToken: ticket.accessToken,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt,
      grantedScopes: ticket.scopes,
    },
  };
}

function validateOpaqueToken(value: string, code: string) {
  if (typeof value !== "string" || value.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new DesktopAuthServiceError(code, code === "invalid_grant" ? 400 : 401);
  }
}
