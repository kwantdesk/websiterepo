import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";

export const DESKTOP_AUTHORIZATION_CODE_LIFETIME_MS = 60_000;
export const DESKTOP_REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const DESKTOP_GATEWAY_TICKET_LIFETIME_SECONDS = 5 * 60;

export const DESKTOP_ALLOWED_SCOPES = Object.freeze([
  "market.trades:read",
  "market.depth:read",
  "market.replay:read",
  "market.indices:read",
  "lab.snapshot:read",
  "options.analytics:read",
  "assistant.zyon:read",
  "assistant.zyon:write",
  "news.intelligence:read",
  "news.intelligence:write",
  "socials.account:read",
  "socials.account:write",
  "journal.account:read",
  "journal.account:write",
] as const);

export type DesktopScope = (typeof DESKTOP_ALLOWED_SCOPES)[number];

export type DesktopAuthorizationRequest = {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  clientVersion: string;
  scopes: DesktopScope[];
};

export type DesktopTicketSigningConfig = {
  issuer: string;
  audience: string;
  keyId: string;
  privateKey: KeyObject;
};

export type DesktopGatewayTicket = {
  accessToken: string;
  issuedAt: string;
  expiresAt: string;
  jti: string;
  scopes: DesktopScope[];
};

const BASE64_URL = /^[A-Za-z0-9_-]+$/;
const NORMALIZED_VERSION = /^[A-Za-z0-9.+-]{1,64}$/;
const NORMALIZED_KEY_ID = /^[A-Za-z0-9._:+-]{1,180}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SCOPE_SET = new Set<string>(DESKTOP_ALLOWED_SCOPES);

export function parseDesktopAuthorizationRequest(
  source: URLSearchParams | Record<string, unknown>,
): DesktopAuthorizationRequest {
  const read = (name: string) => source instanceof URLSearchParams
    ? source.get(name)
    : source[name];
  const redirectUri = requiredString(read("redirect_uri"), "redirect_uri", 500);
  const state = requiredString(read("state"), "state", 128);
  const codeChallenge = requiredString(read("code_challenge"), "code_challenge", 128);
  const challengeMethod = requiredString(read("code_challenge_method"), "code_challenge_method", 16);
  const clientVersion = requiredString(read("client_version"), "client_version", 64);
  const scopeText = requiredString(read("scope"), "scope", 500);
  const responseType = requiredString(read("response_type"), "response_type", 16);

  validateLoopbackRedirect(redirectUri);
  if (responseType !== "code") throw new DesktopAuthorizationRequestError("invalid_response_type");
  if (challengeMethod !== "S256") throw new DesktopAuthorizationRequestError("invalid_challenge_method");
  if (codeChallenge.length !== 43 || !BASE64_URL.test(codeChallenge)) {
    throw new DesktopAuthorizationRequestError("invalid_code_challenge");
  }
  if (state.length < 43 || state.length > 128 || !BASE64_URL.test(state)) {
    throw new DesktopAuthorizationRequestError("invalid_state");
  }
  if (!NORMALIZED_VERSION.test(clientVersion)) {
    throw new DesktopAuthorizationRequestError("invalid_client_version");
  }

  const scopes = scopeText.split(" ");
  if (
    !scopes.length ||
    scopes.some((scope) => !ALLOWED_SCOPE_SET.has(scope)) ||
    new Set(scopes).size !== scopes.length
  ) {
    throw new DesktopAuthorizationRequestError("invalid_scope");
  }

  return {
    redirectUri,
    state,
    codeChallenge,
    clientVersion,
    scopes: scopes as DesktopScope[],
  };
}

export class DesktopAuthorizationRequestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("The desktop authorization request is invalid.");
    this.name = "DesktopAuthorizationRequestError";
    this.code = code;
  }
}

export function validateLoopbackRedirect(value: string): URL {
  let redirect: URL;
  try {
    redirect = new URL(value);
  } catch {
    throw new DesktopAuthorizationRequestError("invalid_redirect");
  }

  const port = Number(redirect.port);
  if (
    redirect.protocol !== "http:" ||
    redirect.hostname !== "127.0.0.1" ||
    !Number.isInteger(port) ||
    port < 1_024 ||
    port > 65_535 ||
    redirect.pathname !== "/desktop-auth/callback/" ||
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash
  ) {
    throw new DesktopAuthorizationRequestError("invalid_redirect");
  }

  return redirect;
}

export function createOpaqueDesktopToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueDesktopToken(value: string): string {
  if (!value || value.length > 512) throw new Error("Opaque desktop token is invalid.");
  return createHash("sha256").update(value, "ascii").digest("hex");
}

export function createPkceS256Challenge(verifier: string): string {
  if (
    verifier.length < 43 ||
    verifier.length > 128 ||
    !/^[A-Za-z0-9._~-]+$/.test(verifier)
  ) {
    throw new Error("PKCE verifier is invalid.");
  }
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function verifyPkceS256Challenge(verifier: string, expectedChallenge: string): boolean {
  let actual: string;
  try {
    actual = createPkceS256Challenge(verifier);
  } catch {
    return false;
  }
  const left = Buffer.from(actual, "ascii");
  const right = Buffer.from(expectedChallenge, "ascii");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function loadDesktopTicketSigningConfig(
  env: NodeJS.ProcessEnv = process.env,
): DesktopTicketSigningConfig | null {
  const issuer = String(env.KWANTDESK_DESKTOP_TICKET_ISSUER || "").trim();
  const audience = String(env.KWANTDESK_DESKTOP_TICKET_AUDIENCE || "").trim();
  const keyId = String(env.KWANTDESK_DESKTOP_TICKET_KEY_ID || "").trim();
  const encodedPrivateKey = String(env.KWANTDESK_DESKTOP_TICKET_PRIVATE_KEY_PEM || "").trim();
  const configuredCount = [issuer, audience, keyId, encodedPrivateKey].filter(Boolean).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== 4) {
    throw new Error("Desktop ticket signing requires issuer, audience, key ID, and private key together.");
  }
  if (!NORMALIZED_KEY_ID.test(keyId)) throw new Error("Desktop ticket key ID is invalid.");

  const privateKey = createPrivateKey(encodedPrivateKey.replace(/\\n/g, "\n"));
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("Desktop tickets require an Ed25519 private key.");
  }
  return { issuer, audience, keyId, privateKey };
}

export function signDesktopGatewayTicket(
  input: {
    userId: string;
    sessionId: string;
    scopes: readonly DesktopScope[];
    clientVersion: string;
    jti?: string;
  },
  config: DesktopTicketSigningConfig,
  now: Date = new Date(),
): DesktopGatewayTicket {
  if (!UUID.test(input.userId) || !UUID.test(input.sessionId)) {
    throw new Error("Desktop ticket subject and session must be UUIDs.");
  }
  if (!NORMALIZED_VERSION.test(input.clientVersion)) {
    throw new Error("Desktop ticket client version is invalid.");
  }
  const scopes = normalizeScopes(input.scopes);
  const jti = input.jti ?? randomUUID();
  if (!NORMALIZED_KEY_ID.test(jti)) throw new Error("Desktop ticket ID is invalid.");
  if (!NORMALIZED_KEY_ID.test(config.keyId)) throw new Error("Desktop ticket key ID is invalid.");

  const issuedAt = Math.floor(now.getTime() / 1000);
  if (!Number.isSafeInteger(issuedAt) || issuedAt <= 0) throw new Error("Desktop ticket time is invalid.");
  const expiresAt = issuedAt + DESKTOP_GATEWAY_TICKET_LIFETIME_SECONDS;
  const header = encodeJson({ alg: "EdDSA", kid: config.keyId, typ: "JWT" });
  const payload = encodeJson({
    iss: config.issuer,
    aud: config.audience,
    sub: input.userId,
    iat: issuedAt,
    nbf: issuedAt - 5,
    exp: expiresAt,
    jti,
    sid: input.sessionId,
    scope: scopes.join(" "),
    client_version: input.clientVersion,
  });
  const signingInput = Buffer.from(`${header}.${payload}`, "ascii");
  const signature = sign(null, signingInput, config.privateKey).toString("base64url");

  return {
    accessToken: `${header}.${payload}.${signature}`,
    issuedAt: new Date(issuedAt * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    jti,
    scopes,
  };
}

export function desktopTicketPublicJwk(config: DesktopTicketSigningConfig) {
  const publicKey = createPublicKey(config.privateKey);
  return {
    ...publicKey.export({ format: "jwk" }),
    kid: config.keyId,
    use: "sig",
    alg: "EdDSA",
  };
}

function normalizeScopes(scopes: readonly string[]): DesktopScope[] {
  const normalized = [...scopes];
  if (
    !normalized.length ||
    normalized.some((scope) => !ALLOWED_SCOPE_SET.has(scope)) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new Error("Desktop ticket scopes are invalid.");
  }
  return normalized as DesktopScope[];
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function requiredString(value: unknown, name: string, maximumLength: number): string {
  if (typeof value !== "string" || !value || value.length > maximumLength || value !== value.trim()) {
    throw new DesktopAuthorizationRequestError(`invalid_${name}`);
  }
  return value;
}
