import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

import {
  createOpaqueDesktopToken,
  createPkceS256Challenge,
  desktopTicketPublicJwk,
  hashOpaqueDesktopToken,
  loadDesktopTicketSigningConfig,
  parseDesktopAuthorizationRequest,
  signDesktopGatewayTicket,
  verifyPkceS256Challenge,
} from "../src/lib/desktopAuthProtocol.server.ts";
import { DesktopTicketVerifier } from "../services/rithmic_gateway/src/desktop-ticket-verifier.mjs";

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const state = "0123456789abcdef0123456789abcdef0123456789a";

const parsed = parseDesktopAuthorizationRequest(new URLSearchParams({
  response_type: "code",
  redirect_uri: "http://127.0.0.1:54321/desktop-auth/callback/",
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
  client_version: "1.2.3-canary",
  scope: "market.trades:read market.depth:read",
}));
assert.deepEqual(parsed.scopes, ["market.trades:read", "market.depth:read"]);
assert.equal(parsed.redirectUri, "http://127.0.0.1:54321/desktop-auth/callback/");

for (const redirect of [
  "https://127.0.0.1:54321/desktop-auth/callback/",
  "http://localhost:54321/desktop-auth/callback/",
  "http://127.0.0.1:80/desktop-auth/callback/",
  "http://127.0.0.1:54321/wrong/",
  "http://127.0.0.1:54321/desktop-auth/callback/?query=1",
]) {
  assert.throws(() => parseDesktopAuthorizationRequest({
    response_type: "code",
    redirect_uri: redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    client_version: "1.2.3",
    scope: "market.trades:read",
  }));
}

for (const scope of ["*", "market.trades:write", "market.trades:read market.trades:read", ""]) {
  assert.throws(() => parseDesktopAuthorizationRequest({
    response_type: "code",
    redirect_uri: "http://127.0.0.1:54321/desktop-auth/callback/",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    client_version: "1.2.3",
    scope,
  }));
}

assert.equal(createPkceS256Challenge(verifier), challenge);
assert.equal(verifyPkceS256Challenge(verifier, challenge), true);
assert.equal(verifyPkceS256Challenge(`${verifier}x`, challenge), false);

const firstOpaque = createOpaqueDesktopToken();
const secondOpaque = createOpaqueDesktopToken();
assert.match(firstOpaque, /^[A-Za-z0-9_-]{43}$/);
assert.notEqual(firstOpaque, secondOpaque);
assert.match(hashOpaqueDesktopToken(firstOpaque), /^[a-f0-9]{64}$/);
assert.notEqual(hashOpaqueDesktopToken(firstOpaque), hashOpaqueDesktopToken(secondOpaque));

const pair = generateKeyPairSync("ed25519");
const privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const signingConfig = loadDesktopTicketSigningConfig({
  KWANTDESK_DESKTOP_TICKET_ISSUER: "https://www.kwantdesk.com/desktop-ticket",
  KWANTDESK_DESKTOP_TICKET_AUDIENCE: "https://gateway.kwantdesk.com",
  KWANTDESK_DESKTOP_TICKET_KEY_ID: "2026-08-test",
  KWANTDESK_DESKTOP_TICKET_PRIVATE_KEY_PEM: privatePem,
});
assert.ok(signingConfig);

const now = new Date("2026-08-28T10:00:00.000Z");
const ticket = signDesktopGatewayTicket({
  userId: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4a",
  sessionId: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4b",
  scopes: ["market.trades:read", "market.depth:read"],
  clientVersion: "1.2.3-canary",
  jti: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c",
}, signingConfig, now);

const gatewayVerifier = new DesktopTicketVerifier({
  issuer: signingConfig.issuer,
  audience: signingConfig.audience,
  publicKeys: { "2026-08-test": pair.publicKey },
  now: () => now.getTime(),
});
const principal = await gatewayVerifier.verifyTicket(ticket.accessToken, {
  requiredScope: "market.depth:read",
});
assert.equal(principal.subject, "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4a");
assert.equal(ticket.expiresAt, "2026-08-28T10:05:00.000Z");

const jwk = desktopTicketPublicJwk(signingConfig);
assert.equal(jwk.kty, "OKP");
assert.equal(jwk.crv, "Ed25519");
assert.equal(jwk.kid, "2026-08-test");
assert.equal("d" in jwk, false, "public JWK must never contain private key material");

assert.equal(loadDesktopTicketSigningConfig({}), null);
assert.throws(() => loadDesktopTicketSigningConfig({
  KWANTDESK_DESKTOP_TICKET_ISSUER: "partial",
}));

console.log("desktop auth protocol and issuer/verifier compatibility: pass");
