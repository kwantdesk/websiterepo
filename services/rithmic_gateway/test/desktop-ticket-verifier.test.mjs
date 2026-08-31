import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  DesktopTicketVerificationError,
  DesktopTicketVerifier,
  loadDesktopTicketVerifierFromEnv,
} from "../src/desktop-ticket-verifier.mjs";

const NOW_SECONDS = 1_787_875_200;
const issuer = "https://www.kwantdesk.com/desktop-ticket";
const audience = "https://gateway.kwantdesk.com";
const firstPair = generateKeyPairSync("ed25519");
const secondPair = generateKeyPairSync("ed25519");
const publicKeys = {
  "2026-08-a": firstPair.publicKey.export({ type: "spki", format: "pem" }),
  "2026-09-b": secondPair.publicKey.export({ type: "spki", format: "pem" }),
};
const subject = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4a";
const sessionId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4b";
const ticketId = "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4c";

function claims(overrides = {}) {
  return {
    iss: issuer,
    aud: audience,
    sub: subject,
    iat: NOW_SECONDS,
    nbf: NOW_SECONDS - 5,
    exp: NOW_SECONDS + 300,
    jti: ticketId,
    sid: sessionId,
    scope: "market.trades:read market.depth:read",
    client_version: "1.2.3-canary",
    ...overrides,
  };
}

function ticket({
  body = claims(),
  keyPair = firstPair,
  kid = "2026-08-a",
  alg = "EdDSA",
  typ = "JWT",
} = {}) {
  const header = Buffer.from(JSON.stringify({ alg, kid, typ })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signingInput = Buffer.from(`${header}.${payload}`, "ascii");
  const signature = sign(null, signingInput, keyPair.privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifier(options = {}) {
  return new DesktopTicketVerifier({
    issuer,
    audience,
    publicKeys,
    now: () => NOW_SECONDS * 1000,
    ...options,
  });
}

async function rejects(code, action) {
  await assert.rejects(
    action,
    (error) => error instanceof DesktopTicketVerificationError && error.code === code,
  );
}

test("accepts an exact Ed25519 audience-bound scoped ticket", async () => {
  const principal = await verifier().verifyAuthorizationHeader(
    `Bearer ${ticket()}`,
    { requiredScope: "market.depth:read" },
  );

  assert.equal(principal.subject, subject);
  assert.equal(principal.jti, ticketId);
  assert.equal(principal.sid, sessionId);
  assert.deepEqual(principal.scopes, ["market.trades:read", "market.depth:read"]);
  assert.equal(Object.isFrozen(principal), true);
});

test("accepts both active public keys during rotation", async () => {
  const first = await verifier().verifyTicket(ticket());
  const second = await verifier().verifyTicket(ticket({ keyPair: secondPair, kid: "2026-09-b" }));
  assert.equal(first.subject, second.subject);
});

test("rejects unknown keys, wrong algorithms, and altered signatures", async () => {
  await rejects("unknown_key", () => verifier().verifyTicket(ticket({ kid: "unknown-key" })));
  await rejects("unsupported_ticket", () => verifier().verifyTicket(ticket({ alg: "HS256" })));

  const altered = ticket().split(".");
  altered[1] = Buffer.from(JSON.stringify(claims({ sub: "018f47a8-2a79-7b63-9e6c-0f0e1d2c3b4d" }))).toString("base64url");
  await rejects("invalid_signature", () => verifier().verifyTicket(altered.join(".")));
});

test("rejects wrong boundary, future, expired, and overlong tickets", async () => {
  await rejects("wrong_ticket_boundary", () => verifier().verifyTicket(ticket({ body: claims({ aud: "wrong" }) })));
  await rejects("ticket_not_active", () => verifier().verifyTicket(ticket({
    body: claims({ iat: NOW_SECONDS + 31, nbf: NOW_SECONDS + 31, exp: NOW_SECONDS + 300 }),
  })));
  await rejects("expired_ticket", () => verifier().verifyTicket(ticket({
    body: claims({ iat: NOW_SECONDS - 300, nbf: NOW_SECONDS - 300, exp: NOW_SECONDS - 31 }),
  })));
  await rejects("invalid_lifetime", () => verifier().verifyTicket(ticket({
    body: claims({ exp: NOW_SECONDS + 301 }),
  })));
});

test("rejects missing, wildcard, duplicated, and insufficient scopes", async () => {
  await rejects("invalid_scope", () => verifier().verifyTicket(ticket({ body: claims({ scope: "" }) })));
  await rejects("invalid_scope", () => verifier().verifyTicket(ticket({ body: claims({ scope: "*" }) })));
  await rejects("invalid_scope", () => verifier().verifyTicket(ticket({
    body: claims({ scope: "market.trades:read market.trades:read" }),
  })));
  await rejects("insufficient_scope", () => verifier().verifyTicket(
    ticket(),
    { requiredScope: "market.replay:read" },
  ));
});

test("checks both ticket and desktop-session revocation identifiers", async () => {
  const checked = [];
  const revokedVerifier = verifier({
    isRevoked: async (identity) => {
      checked.push(identity);
      return identity.sid === sessionId;
    },
  });

  await rejects("revoked_ticket", () => revokedVerifier.verifyTicket(ticket()));
  assert.deepEqual(checked, [{ jti: ticketId, sid: sessionId }]);
});

test("environment configuration is all-or-nothing and supports key rotation", async () => {
  assert.equal(loadDesktopTicketVerifierFromEnv({}), null);
  assert.throws(
    () => loadDesktopTicketVerifierFromEnv({ KWANTDESK_DESKTOP_TICKET_ISSUER: issuer }),
    /requires issuer, audience/,
  );

  const configured = loadDesktopTicketVerifierFromEnv({
    KWANTDESK_DESKTOP_TICKET_ISSUER: issuer,
    KWANTDESK_DESKTOP_TICKET_AUDIENCE: audience,
    KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON: JSON.stringify(publicKeys),
  }, { now: () => NOW_SECONDS * 1000 });
  assert.equal((await configured.verifyTicket(ticket())).subject, subject);
});

test("rejects malformed and oversized authorization values without parsing them", async () => {
  await rejects("authorization_required", () => verifier().verifyAuthorizationHeader("Basic abc"));
  await rejects("malformed_ticket", () => verifier().verifyTicket("one.two"));
  await rejects("malformed_ticket", () => verifier().verifyAuthorizationHeader(`Bearer ${"a".repeat(17_000)}`));
});

test("refuses a non-Ed25519 verifier key", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.throws(
    () => new DesktopTicketVerifier({
      issuer,
      audience,
      publicKeys: { rsa: rsa.publicKey },
    }),
    /must be Ed25519/,
  );
});
