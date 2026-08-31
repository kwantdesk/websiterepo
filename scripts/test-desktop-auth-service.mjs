import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createPkceS256Challenge,
  hashOpaqueDesktopToken,
  loadDesktopTicketSigningConfig,
} from "../src/lib/desktopAuthProtocol.server.ts";
import {
  createDesktopAuthService,
  DesktopAuthServiceError,
} from "../src/lib/desktopAuthService.server.ts";
import { DesktopTicketVerifier } from "../services/rithmic_gateway/src/desktop-ticket-verifier.mjs";

const now = new Date("2026-08-28T10:00:00.000Z");
const userId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4a";
const sessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4b";
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const codeChallenge = createPkceS256Challenge(verifier);
const redirectUri = "http://127.0.0.1:54321/desktop-auth/callback/";
const firstCode = "A".repeat(43);
const firstRefresh = "B".repeat(43);
const secondRefresh = "C".repeat(43);
const thirdRefresh = "D".repeat(43);
const ticketIds = [
  "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c",
  "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4d",
  "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4e",
];

class MemoryStore {
  entitlement = {
    userId,
    enabled: true,
    scopes: ["market.trades:read", "market.depth:read"],
    expiresAt: null,
  };
  codes = new Map();
  handles = new Map();
  revoked = false;

  async readEntitlement() {
    return this.entitlement;
  }

  async insertAuthorizationCode(record) {
    this.codes.set(record.codeHash, structuredClone(record));
  }

  async readAuthorizationCode(codeHash) {
    return this.codes.get(codeHash) ?? null;
  }

  async exchangeAuthorizationCode(input) {
    const code = this.codes.get(input.codeHash);
    if (!code || code.consumedAt || code.redirectUri !== input.redirectUri) return null;
    code.consumedAt = now.toISOString();
    this.handles.set(input.refreshHash, { consumed: false });
    return {
      sessionId,
      userId,
      grantedScopes: [...code.scopes],
      clientVersion: code.clientVersion,
    };
  }

  async rotateRefreshHandle(input) {
    const current = this.handles.get(input.currentRefreshHash);
    if (!current || current.consumed || this.revoked) {
      if (current?.consumed) this.revoked = true;
      return null;
    }
    current.consumed = true;
    this.handles.set(input.nextRefreshHash, { consumed: false });
    return {
      sessionId,
      userId,
      grantedScopes: ["market.trades:read", "market.depth:read"],
      clientVersion: "1.2.3-canary",
    };
  }

  async revokeSession(refreshHash) {
    if (!this.handles.has(refreshHash)) return false;
    this.revoked = true;
    return true;
  }
}

const pair = generateKeyPairSync("ed25519");
const signingConfig = loadDesktopTicketSigningConfig({
  KWANTDESK_DESKTOP_TICKET_ISSUER: "https://www.kwantdesk.com/desktop-ticket",
  KWANTDESK_DESKTOP_TICKET_AUDIENCE: "https://gateway.kwantdesk.com",
  KWANTDESK_DESKTOP_TICKET_KEY_ID: "2026-08-test",
  KWANTDESK_DESKTOP_TICKET_PRIVATE_KEY_PEM: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
});
assert.ok(signingConfig);

function serviceWith(store, opaqueValues = [firstCode, firstRefresh, secondRefresh, thirdRefresh]) {
  const values = [...opaqueValues];
  const ids = [...ticketIds];
  return createDesktopAuthService({
    store,
    signingConfig,
    now: () => new Date(now),
    opaqueToken: () => values.shift() ?? "Z".repeat(43),
    ticketId: () => ids.shift() ?? ticketIds.at(-1),
  });
}

const store = new MemoryStore();
const service = serviceWith(store);
const authorization = await service.authorize(userId, {
  redirectUri,
  state: "S".repeat(43),
  codeChallenge,
  clientVersion: "1.2.3-canary",
  scopes: ["market.trades:read", "market.depth:read"],
});
const callback = new URL(authorization.redirectUri);
assert.equal(callback.searchParams.get("code"), firstCode);
assert.equal(callback.searchParams.get("state"), "S".repeat(43));
assert.equal(store.codes.has(firstCode), false, "plaintext authorization code must never be stored");
assert.equal(store.codes.has(hashOpaqueDesktopToken(firstCode)), true);

await assert.rejects(
  service.exchange({ authorizationCode: firstCode, codeVerifier: `${verifier}x`, redirectUri }),
  (error) => error instanceof DesktopAuthServiceError && error.code === "invalid_grant",
);

const exchanged = await service.exchange({ authorizationCode: firstCode, codeVerifier: verifier, redirectUri });
assert.equal(exchanged.refreshHandle, firstRefresh);
assert.equal(store.handles.has(firstRefresh), false, "plaintext refresh handle must never be stored");
assert.equal(store.handles.has(hashOpaqueDesktopToken(firstRefresh)), true);

const gatewayVerifier = new DesktopTicketVerifier({
  issuer: signingConfig.issuer,
  audience: signingConfig.audience,
  publicKeys: { "2026-08-test": pair.publicKey },
  now: () => now.getTime(),
});
assert.equal(
  (await gatewayVerifier.verifyTicket(exchanged.accessTicket.accessToken, {
    requiredScope: "market.depth:read",
  })).subject,
  userId,
);

await assert.rejects(
  service.exchange({ authorizationCode: firstCode, codeVerifier: verifier, redirectUri }),
  (error) => error instanceof DesktopAuthServiceError && error.code === "invalid_grant",
);

const refreshed = await service.refresh(firstRefresh);
assert.equal(refreshed.refreshHandle, secondRefresh);
await assert.rejects(
  service.refresh(firstRefresh),
  (error) => error instanceof DesktopAuthServiceError && error.code === "invalid_refresh",
);
assert.equal(store.revoked, true, "refresh replay must revoke the session family");
await assert.rejects(
  service.refresh(secondRefresh),
  (error) => error instanceof DesktopAuthServiceError && error.code === "invalid_refresh",
);

const deniedStore = new MemoryStore();
deniedStore.entitlement = { ...deniedStore.entitlement, enabled: false };
await assert.rejects(
  serviceWith(deniedStore).authorize(userId, {
    redirectUri,
    state: "S".repeat(43),
    codeChallenge,
    clientVersion: "1.2.3-canary",
    scopes: ["market.trades:read"],
  }),
  (error) => error instanceof DesktopAuthServiceError && error.code === "desktop_access_denied",
);

const reducedStore = new MemoryStore();
reducedStore.entitlement = { ...reducedStore.entitlement, scopes: ["market.trades:read"] };
await assert.rejects(
  serviceWith(reducedStore).authorize(userId, {
    redirectUri,
    state: "S".repeat(43),
    codeChallenge,
    clientVersion: "1.2.3-canary",
    scopes: ["market.depth:read"],
  }),
  (error) => error instanceof DesktopAuthServiceError && error.status === 403,
);

assert.doesNotMatch(String(new DesktopAuthServiceError("invalid_grant", 400)), /A{10}|B{10}/);
console.log("desktop auth durable service contract: pass");
