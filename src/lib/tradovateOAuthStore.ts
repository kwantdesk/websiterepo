import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type StoredTradovateOAuthConnection = {
  environment: "demo" | "live" | "staging";
  accessToken: string;
  mdAccessToken: string | null;
  expiresAt: string | null;
  receivedAt: string;
  connectedAt: string;
  user: {
    userId: string | null;
    name: string | null;
    userName: string | null;
  } | null;
};

const TRADOVATE_OAUTH_DIRECTORY = path.join(process.cwd(), "data-cache");
const TRADOVATE_OAUTH_FILE = path.join(TRADOVATE_OAUTH_DIRECTORY, "tradovate-oauth.json");

export function getTradovateOAuthStoreLocation() {
  return TRADOVATE_OAUTH_FILE;
}

function normalizeEnvironment(value: string | undefined): StoredTradovateOAuthConnection["environment"] {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "live" ? "live" : normalized === "staging" ? "staging" : "demo";
}

function normalizeSnapshot(
  snapshot: Partial<StoredTradovateOAuthConnection> | null
): StoredTradovateOAuthConnection | null {
  if (!snapshot?.accessToken) {
    return null;
  }

  return {
    environment: normalizeEnvironment(snapshot.environment),
    accessToken: String(snapshot.accessToken),
    mdAccessToken: snapshot.mdAccessToken ? String(snapshot.mdAccessToken) : null,
    expiresAt:
      typeof snapshot.expiresAt === "string" && snapshot.expiresAt.trim() ? snapshot.expiresAt : null,
    receivedAt:
      typeof snapshot.receivedAt === "string" && snapshot.receivedAt.trim()
        ? snapshot.receivedAt
        : new Date().toISOString(),
    connectedAt:
      typeof snapshot.connectedAt === "string" && snapshot.connectedAt.trim()
        ? snapshot.connectedAt
        : new Date().toISOString(),
    user:
      snapshot.user && typeof snapshot.user === "object"
        ? {
            userId:
              typeof snapshot.user.userId === "string" && snapshot.user.userId.trim()
                ? snapshot.user.userId
                : null,
            name:
              typeof snapshot.user.name === "string" && snapshot.user.name.trim()
                ? snapshot.user.name
                : null,
            userName:
              typeof snapshot.user.userName === "string" && snapshot.user.userName.trim()
                ? snapshot.user.userName
                : null,
          }
        : null,
  };
}

export function readStoredTradovateOAuthConnectionSync(): StoredTradovateOAuthConnection | null {
  try {
    const raw = fs.readFileSync(TRADOVATE_OAUTH_FILE, "utf8");
    return normalizeSnapshot(JSON.parse(raw) as Partial<StoredTradovateOAuthConnection>);
  } catch {
    return null;
  }
}

export async function saveStoredTradovateOAuthConnection(
  payload: Partial<StoredTradovateOAuthConnection>
) {
  const next = normalizeSnapshot(payload);
  if (!next) {
    throw new Error("Tradovate OAuth payload could not be normalized.");
  }

  await fsp.mkdir(TRADOVATE_OAUTH_DIRECTORY, { recursive: true });
  await fsp.writeFile(TRADOVATE_OAUTH_FILE, JSON.stringify(next, null, 2));
  return next;
}

export async function clearStoredTradovateOAuthConnection() {
  try {
    await fsp.unlink(TRADOVATE_OAUTH_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
