import crypto from "node:crypto";
import type { CTraderTokenSet } from "@/lib/ctraderSession";

type StoredCTraderTokenRow = {
  token_key: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  permission_scope: string | null;
  account_count: number | null;
  updated_at: string;
};

const DEFAULT_TOKEN_TABLE = "kwantify_ctrader_token_store";
const DEFAULT_TOKEN_KEY = "default";
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return {
    supabaseUrl,
    serviceRoleKey,
    table: process.env.KWANTIFY_CTRADER_TOKEN_TABLE?.trim() || DEFAULT_TOKEN_TABLE,
  };
}

function getEncryptionKey() {
  const secret =
    process.env.CTRADER_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CTRADER_CLIENT_SECRET?.trim();

  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function headers(config: NonNullable<ReturnType<typeof getSupabaseConfig>>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: string, init: RequestInit, attempts = 5) {
  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(input, init);
    lastResponse = response;
    if (response.ok || !RETRY_STATUSES.has(response.status) || attempt === attempts) {
      return response;
    }
    await sleep(Math.min(15_000, 750 * 2 ** (attempt - 1)));
  }
  return lastResponse as Response;
}

function encryptTokenSet(tokenSet: CTraderTokenSet) {
  const key = getEncryptionKey();
  if (!key) throw new Error("CTRADER_TOKEN_ENCRYPTION_KEY or another server secret is required to store cTrader tokens.");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokenSet), "utf8"), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptTokenSet(row: StoredCTraderTokenRow) {
  const key = getEncryptionKey();
  if (!key) return null;

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(plain) as Partial<CTraderTokenSet>;
  if (!parsed.accessToken || typeof parsed.accessToken !== "string") return null;

  return {
    accessToken: parsed.accessToken,
    refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
    tokenType: typeof parsed.tokenType === "string" ? parsed.tokenType : undefined,
    expiresIn: typeof parsed.expiresIn === "number" ? parsed.expiresIn : undefined,
    issuedAt: typeof parsed.issuedAt === "number" ? parsed.issuedAt : undefined,
    expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
  } satisfies CTraderTokenSet;
}

export async function saveCTraderServerTokenSet(
  tokenSet: CTraderTokenSet,
  metadata?: { permissionScope?: string; accountCount?: number },
) {
  const config = getSupabaseConfig();
  if (!config || !tokenSet.refreshToken) return { stored: false, reason: "not_configured_or_no_refresh_token" };

  const encrypted = encryptTokenSet(tokenSet);
  const row = {
    token_key: DEFAULT_TOKEN_KEY,
    ...encrypted,
    permission_scope: metadata?.permissionScope ?? null,
    account_count: metadata?.accountCount ?? null,
    updated_at: new Date().toISOString(),
  };

  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.table}?on_conflict=token_key`, {
    method: "POST",
    headers: {
      ...headers(config),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([row]),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`cTrader token store upsert failed: ${text || response.status}`);
  }

  return { stored: true };
}

export async function readCTraderServerTokenSet() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const query = new URLSearchParams({
    select: "token_key,ciphertext,iv,auth_tag,permission_scope,account_count,updated_at",
    token_key: `eq.${DEFAULT_TOKEN_KEY}`,
    limit: "1",
  });
  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.table}?${query.toString()}`, {
    headers: headers(config),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as StoredCTraderTokenRow[];
  const row = rows[0];
  if (!row) return null;

  try {
    return decryptTokenSet(row);
  } catch {
    return null;
  }
}
