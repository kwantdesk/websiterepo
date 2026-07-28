import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type StoredTradovateConnectionConfig = {
  environment: "demo" | "live" | "staging";
  username: string;
  password: string;
  appId: string;
  appVersion: string;
  cid: string;
  secret: string;
  accountIdOverride: string;
  accountNameOverride: string;
  updatedAt: string;
};

const TRADOVATE_CONNECTION_DIRECTORY = path.join(process.cwd(), "data-cache");
const TRADOVATE_CONNECTION_FILE = path.join(
  TRADOVATE_CONNECTION_DIRECTORY,
  "tradovate-connection.json"
);

export function getTradovateConnectionStoreLocation() {
  return TRADOVATE_CONNECTION_FILE;
}

function normalizeEnvironment(value: string | undefined): StoredTradovateConnectionConfig["environment"] {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "live" ? "live" : normalized === "staging" ? "staging" : "demo";
}

function normalizeSnapshot(
  snapshot: Partial<StoredTradovateConnectionConfig> | null
): StoredTradovateConnectionConfig | null {
  if (!snapshot) {
    return null;
  }

  return {
    environment: normalizeEnvironment(snapshot.environment),
    username: String(snapshot.username ?? "").trim(),
    password: String(snapshot.password ?? ""),
    appId: String(snapshot.appId ?? "").trim(),
    appVersion: String(snapshot.appVersion ?? "").trim() || "1.0.0",
    cid: String(snapshot.cid ?? "").trim(),
    secret: String(snapshot.secret ?? ""),
    accountIdOverride: String(snapshot.accountIdOverride ?? "").trim(),
    accountNameOverride: String(snapshot.accountNameOverride ?? "").trim(),
    updatedAt:
      typeof snapshot.updatedAt === "string" && snapshot.updatedAt.trim()
        ? snapshot.updatedAt
        : new Date().toISOString(),
  };
}

export function readStoredTradovateConnectionConfigSync(): StoredTradovateConnectionConfig | null {
  try {
    const raw = fs.readFileSync(TRADOVATE_CONNECTION_FILE, "utf8");
    return normalizeSnapshot(JSON.parse(raw) as Partial<StoredTradovateConnectionConfig>);
  } catch {
    return null;
  }
}

export async function saveStoredTradovateConnectionConfig(
  payload: Partial<StoredTradovateConnectionConfig>
) {
  const next = normalizeSnapshot(payload);
  if (!next) {
    throw new Error("Tradovate connection payload could not be normalized.");
  }

  await fsp.mkdir(TRADOVATE_CONNECTION_DIRECTORY, { recursive: true });
  await fsp.writeFile(TRADOVATE_CONNECTION_FILE, JSON.stringify(next, null, 2));
  return next;
}

export async function clearStoredTradovateConnectionConfig() {
  try {
    await fsp.unlink(TRADOVATE_CONNECTION_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
