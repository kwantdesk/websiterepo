import { createPublicKey, verify as verifySignature } from "node:crypto";

const MAXIMUM_TICKET_SECONDS = 5 * 60;
const DEFAULT_CLOCK_SKEW_SECONDS = 30;
const MAXIMUM_TOKEN_LENGTH = 16 * 1024;
const NORMALIZED_ID = /^[A-Za-z0-9._:+-]{1,180}$/;
const NORMALIZED_SCOPE = /^[A-Za-z0-9._:-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DesktopTicketVerificationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DesktopTicketVerificationError";
    this.code = code;
  }
}

export class DesktopTicketVerifier {
  constructor({
    issuer,
    audience,
    publicKeys,
    clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
    now = () => Date.now(),
    isRevoked = null,
  }) {
    this.issuer = requiredText(issuer, "issuer");
    this.audience = requiredText(audience, "audience");
    this.clockSkewSeconds = boundedInteger(clockSkewSeconds, 0, 120, "clockSkewSeconds");
    this.now = now;
    this.isRevoked = isRevoked;
    this.publicKeys = loadPublicKeys(publicKeys);
  }

  async verifyAuthorizationHeader(authorizationHeader, { requiredScope } = {}) {
    const value = String(authorizationHeader || "");
    if (!value.startsWith("Bearer ")) {
      throw failure("authorization_required", "A bearer desktop ticket is required.");
    }

    const token = value.slice(7).trim();
    if (!token || token.length > MAXIMUM_TOKEN_LENGTH) {
      throw failure("malformed_ticket", "The desktop ticket is malformed.");
    }

    return this.verifyTicket(token, { requiredScope });
  }

  async verifyTicket(token, { requiredScope } = {}) {
    if (typeof token !== "string" || !token || token.length > MAXIMUM_TOKEN_LENGTH) {
      throw failure("malformed_ticket", "The desktop ticket is malformed.");
    }
    const segments = String(token || "").split(".");
    if (segments.length !== 3 || segments.some((segment) => !isCanonicalBase64Url(segment))) {
      throw failure("malformed_ticket", "The desktop ticket is malformed.");
    }

    const header = parseObject(segments[0], "header");
    const claims = parseObject(segments[1], "claims");
    if (header.alg !== "EdDSA" || header.typ !== "JWT" || !NORMALIZED_ID.test(String(header.kid || ""))) {
      throw failure("unsupported_ticket", "The desktop ticket header is not accepted.");
    }

    const publicKey = this.publicKeys.get(header.kid);
    if (!publicKey) {
      throw failure("unknown_key", "The desktop ticket signing key is not trusted.");
    }

    const signingInput = Buffer.from(`${segments[0]}.${segments[1]}`, "ascii");
    const signature = decodeBase64Url(segments[2]);
    if (!verifySignature(null, signingInput, publicKey, signature)) {
      throw failure("invalid_signature", "The desktop ticket signature is invalid.");
    }

    const principal = validateClaims(claims, {
      issuer: this.issuer,
      audience: this.audience,
      clockSkewSeconds: this.clockSkewSeconds,
      nowSeconds: Math.floor(this.now() / 1000),
      requiredScope,
    });

    if (this.isRevoked && await this.isRevoked({ jti: principal.jti, sid: principal.sid })) {
      throw failure("revoked_ticket", "The desktop ticket has been revoked.");
    }

    return principal;
  }
}

export function loadDesktopTicketVerifierFromEnv(env = process.env, options = {}) {
  const issuer = String(env.KWANTDESK_DESKTOP_TICKET_ISSUER || "").trim();
  const audience = String(env.KWANTDESK_DESKTOP_TICKET_AUDIENCE || "").trim();
  const rawKeys = String(env.KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON || "").trim();
  const configuredCount = [issuer, audience, rawKeys].filter(Boolean).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== 3) {
    throw new Error(
      "Desktop ticket verification requires issuer, audience, and KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON together.",
    );
  }

  let publicKeys;
  try {
    publicKeys = JSON.parse(rawKeys);
  } catch {
    throw new Error("KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON must be valid JSON.");
  }

  return new DesktopTicketVerifier({
    issuer,
    audience,
    publicKeys,
    ...options,
  });
}

function validateClaims(claims, {
  issuer,
  audience,
  clockSkewSeconds,
  nowSeconds,
  requiredScope,
}) {
  if (claims.iss !== issuer || claims.aud !== audience) {
    throw failure("wrong_ticket_boundary", "The desktop ticket issuer or audience is invalid.");
  }

  const subject = uuidClaim(claims.sub, "sub");
  const jti = uuidClaim(claims.jti, "jti");
  const sid = uuidClaim(claims.sid, "sid");
  const clientVersion = normalizedClaim(claims.client_version, "client_version");
  const issuedAt = integerClaim(claims.iat, "iat");
  const notBefore = integerClaim(claims.nbf, "nbf");
  const expiresAt = integerClaim(claims.exp, "exp");

  if (expiresAt <= issuedAt || notBefore > expiresAt || expiresAt - issuedAt > MAXIMUM_TICKET_SECONDS) {
    throw failure("invalid_lifetime", "The desktop ticket lifetime is invalid.");
  }
  if (issuedAt > nowSeconds + clockSkewSeconds || notBefore > nowSeconds + clockSkewSeconds) {
    throw failure("ticket_not_active", "The desktop ticket is not active yet.");
  }
  if (expiresAt <= nowSeconds - clockSkewSeconds) {
    throw failure("expired_ticket", "The desktop ticket has expired.");
  }

  if (typeof claims.scope !== "string" || !claims.scope.trim()) {
    throw failure("invalid_scope", "The desktop ticket has no explicit scopes.");
  }
  const scopes = claims.scope.split(" ");
  if (
    scopes.some((scope) => !NORMALIZED_SCOPE.test(scope) || scope === "*") ||
    new Set(scopes).size !== scopes.length
  ) {
    throw failure("invalid_scope", "The desktop ticket scopes are malformed.");
  }
  if (requiredScope && (!NORMALIZED_SCOPE.test(requiredScope) || !scopes.includes(requiredScope))) {
    throw failure("insufficient_scope", "The desktop ticket does not grant this route scope.");
  }

  return Object.freeze({
    subject,
    jti,
    sid,
    clientVersion,
    issuedAt,
    notBefore,
    expiresAt,
    scopes: Object.freeze([...scopes]),
  });
}

function loadPublicKeys(publicKeys) {
  const entries = publicKeys instanceof Map
    ? [...publicKeys.entries()]
    : Object.entries(publicKeys || {});
  if (!entries.length) throw new Error("At least one desktop ticket public key is required.");

  const result = new Map();
  for (const [kid, encodedKey] of entries) {
    if (!NORMALIZED_ID.test(kid)) throw new Error("Desktop ticket key IDs must be normalized tokens.");
    const publicKey = encodedKey?.type === "public" && typeof encodedKey.export === "function"
      ? encodedKey
      : createPublicKey(encodedKey);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new Error(`Desktop ticket key ${kid} must be Ed25519.`);
    }
    result.set(kid, publicKey);
  }
  return result;
}

function parseObject(segment, label) {
  try {
    const parsed = JSON.parse(decodeBase64Url(segment).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not object");
    return parsed;
  } catch {
    throw failure("malformed_ticket", `The desktop ticket ${label} is malformed.`);
  }
}

function isCanonicalBase64Url(value) {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  return decodeBase64Url(value).toString("base64url") === value;
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url");
}

function normalizedClaim(value, name) {
  if (typeof value !== "string" || !NORMALIZED_ID.test(value)) {
    throw failure("invalid_claims", `The desktop ticket ${name} claim is invalid.`);
  }
  return value;
}

function uuidClaim(value, name) {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw failure("invalid_claims", `The desktop ticket ${name} claim is invalid.`);
  }
  return value;
}

function integerClaim(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw failure("invalid_claims", `The desktop ticket ${name} claim is invalid.`);
  }
  return value;
}

function requiredText(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function boundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function failure(code, message) {
  return new DesktopTicketVerificationError(code, message);
}

export const desktopTicketLimits = Object.freeze({
  maximumTicketSeconds: MAXIMUM_TICKET_SECONDS,
  defaultClockSkewSeconds: DEFAULT_CLOCK_SKEW_SECONDS,
  maximumTokenLength: MAXIMUM_TOKEN_LENGTH,
});
