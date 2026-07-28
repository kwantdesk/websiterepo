import crypto from "node:crypto";

export type StrategyBuilderGithubConnection = {
  userId: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  defaultBranch: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  accessToken: string;
};

type StrategyBuilderGithubConnectionRow = {
  user_id: string;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
  default_branch: string | null;
  token_ciphertext: string;
  token_iv: string;
  token_auth_tag: string;
  scopes: string[] | string | null;
  connected_at: string;
  updated_at: string;
};

export type StrategyBuilderGithubState = {
  userId: string;
  action: "connect" | "create";
  repoFullName?: string;
  repoName?: string;
  redirectTo: string;
  issuedAt: number;
};

const DEFAULT_CONNECTION_TABLE = "kwantify_strategy_builder_github_connections";
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_BASE = "https://api.github.com";
const STATE_TTL_MS = 15 * 60 * 1000;

export const STRATEGY_BUILDER_GITHUB_MEMORY_FILES = [
  {
    path: "AGENTS.md",
    content: [
      "# Kwantify Strategy Builder Instructions",
      "",
      "- This repo is the user's durable Strategy Builder workspace.",
      "- Read `.kwantify/memory/` before responding.",
      "- Keep generated strategy code compatible with the Kwantify JavaScript runtime.",
      "- Do not use lookahead, future candles, hidden state, network calls, imports, or unsupported runtime APIs.",
      "- Treat backtests as evidence, not truth. Track assumptions, risks, and failures.",
    ].join("\n"),
  },
  {
    path: ".kwantify/memory/MEMORY.md",
    content: "# Strategy Builder Memory\n\nDurable user preferences, lessons, and never-repeat notes live here.\n",
  },
  {
    path: ".kwantify/memory/PROJECT_STATE.md",
    content: "# Strategy Builder Project State\n\nCurrent strategies, active research threads, broker/data state, and next steps live here.\n",
  },
  {
    path: ".kwantify/memory/PREFERENCES.md",
    content: "# User Preferences\n\nMarkets, risk style, coding preferences, and communication preferences live here.\n",
  },
  {
    path: ".kwantify/memory/STRATEGY_LOG.md",
    content: "# Strategy Log\n\nStrategy versions, backtest evidence, improvements, and failures live here.\n",
  },
];

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    supabaseUrl,
    serviceRoleKey,
    table: process.env.KWANTIFY_STRATEGY_BUILDER_GITHUB_TABLE?.trim() || DEFAULT_CONNECTION_TABLE,
  };
}

function getEncryptionKey() {
  const secret =
    process.env.STRATEGY_BUILDER_GITHUB_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.GITHUB_STRATEGY_BUILDER_CLIENT_SECRET?.trim();

  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

function getStateSecret() {
  return (
    process.env.STRATEGY_BUILDER_GITHUB_STATE_SECRET?.trim() ||
    process.env.GITHUB_STRATEGY_BUILDER_CLIENT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function supabaseHeaders(config: NonNullable<ReturnType<typeof getSupabaseConfig>>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function githubHeaders(accessToken: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kwantify-strategy-builder",
  };
}

function encryptAccessToken(accessToken: string) {
  const key = getEncryptionKey();
  if (!key) throw new Error("Strategy Builder GitHub token encryption key is not configured.");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);

  return {
    token_ciphertext: ciphertext.toString("base64"),
    token_iv: iv.toString("base64"),
    token_auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptAccessToken(row: StrategyBuilderGithubConnectionRow) {
  const key = getEncryptionKey();
  if (!key) throw new Error("Strategy Builder GitHub token encryption key is not configured.");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(row.token_iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.token_auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.token_ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function normalizeScopes(scopes: StrategyBuilderGithubConnectionRow["scopes"]) {
  if (Array.isArray(scopes)) return scopes.filter((scope): scope is string => typeof scope === "string");
  if (typeof scopes === "string") {
    try {
      const parsed = JSON.parse(scopes) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((scope): scope is string => typeof scope === "string");
    } catch {
      return scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
    }
  }
  return [];
}

function mapConnectionRow(row: StrategyBuilderGithubConnectionRow): StrategyBuilderGithubConnection {
  return {
    userId: row.user_id,
    repoOwner: row.repo_owner,
    repoName: row.repo_name,
    repoFullName: row.repo_full_name,
    defaultBranch: row.default_branch || "main",
    scopes: normalizeScopes(row.scopes),
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    accessToken: decryptAccessToken(row),
  };
}

export function parseGithubRepoFullName(value: string) {
  const text = value.trim().replace(/\.git$/i, "");
  const match =
    text.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[/?#].*)?$/i) ??
    text.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);

  if (!match) return null;
  return `${match[1]}/${match[2]}`;
}

export function sanitizeGithubRepoName(value: string) {
  const repoName = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return repoName || "kwantify-strategy-memory";
}

export function getGithubOAuthConfig(requestUrl: string) {
  const clientId = process.env.GITHUB_STRATEGY_BUILDER_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_STRATEGY_BUILDER_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GITHUB_STRATEGY_BUILDER_REDIRECT_URI?.trim() ||
    new URL("/api/strategy-builder/github/callback", requestUrl).toString();

  if (!clientId || !clientSecret) {
    return { ok: false as const, error: "GitHub Strategy Builder OAuth is not configured." };
  }

  return { ok: true as const, clientId, clientSecret, redirectUri };
}

export function encodeGithubState(state: StrategyBuilderGithubState) {
  const secret = getStateSecret();
  if (!secret) throw new Error("Strategy Builder GitHub state secret is not configured.");

  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeGithubState(value: string | null) {
  if (!value) return null;
  const secret = getStateSecret();
  if (!secret) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<StrategyBuilderGithubState>;
  if (!parsed.userId || !parsed.action || !parsed.redirectTo || typeof parsed.issuedAt !== "number") return null;
  if (Date.now() - parsed.issuedAt > STATE_TTL_MS) return null;
  if (parsed.action !== "connect" && parsed.action !== "create") return null;

  return parsed as StrategyBuilderGithubState;
}

export function buildGithubAuthorizationUrl(args: {
  requestUrl: string;
  userId: string;
  action: "connect" | "create";
  repoFullName?: string;
  repoName?: string;
  redirectTo?: string | null;
}) {
  const config = getGithubOAuthConfig(args.requestUrl);
  if (!config.ok) return config;

  const state = encodeGithubState({
    userId: args.userId,
    action: args.action,
    repoFullName: args.repoFullName,
    repoName: args.repoName,
    redirectTo: args.redirectTo || "/ai",
    issuedAt: Date.now(),
  });

  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "true");

  return { ok: true as const, authorizationUrl: url.toString() };
}

export async function exchangeGithubCode(requestUrl: string, code: string) {
  const config = getGithubOAuthConfig(requestUrl);
  if (!config.ok) throw new Error(config.error);

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as { access_token?: string; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub OAuth token exchange failed.");
  }

  return {
    accessToken: data.access_token,
    scopes: typeof data.scope === "string" ? data.scope.split(",").map((scope) => scope.trim()).filter(Boolean) : [],
  };
}

async function githubJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...githubHeaders(accessToken),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GitHub request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getGithubRepo(accessToken: string, repoFullName: string) {
  return githubJson<{
    name: string;
    full_name: string;
    owner: { login: string };
    default_branch?: string;
  }>(`${GITHUB_API_BASE}/repos/${repoFullName}`, accessToken);
}

export async function createGithubRepo(accessToken: string, repoName: string) {
  return githubJson<{
    name: string;
    full_name: string;
    owner: { login: string };
    default_branch?: string;
  }>(`${GITHUB_API_BASE}/user/repos`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: repoName,
      private: true,
      auto_init: true,
      description: "Kwantify Strategy Builder memory workspace",
    }),
  });
}

async function readGithubContent(args: {
  accessToken: string;
  repoFullName: string;
  path: string;
  branch: string;
}) {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${args.repoFullName}/contents/${args.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(args.branch)}`,
    {
      headers: githubHeaders(args.accessToken),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub content read failed with ${response.status}`);

  return (await response.json()) as { sha?: string; content?: string; encoding?: string; type?: string };
}

export async function upsertGithubTextContent(args: {
  accessToken: string;
  repoFullName: string;
  branch: string;
  path: string;
  content: string;
  message: string;
}) {
  const existing = await readGithubContent(args);
  const body: Record<string, unknown> = {
    message: args.message,
    content: Buffer.from(args.content, "utf8").toString("base64"),
    branch: args.branch,
  };
  if (existing?.sha) body.sha = existing.sha;

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${args.repoFullName}/contents/${args.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "PUT",
      headers: {
        ...githubHeaders(args.accessToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `GitHub content write failed with ${response.status}`);
  }
}

export async function seedStrategyBuilderGithubMemory(args: {
  accessToken: string;
  repoFullName: string;
  branch: string;
}) {
  for (const file of STRATEGY_BUILDER_GITHUB_MEMORY_FILES) {
    const existing = await readGithubContent({
      accessToken: args.accessToken,
      repoFullName: args.repoFullName,
      branch: args.branch,
      path: file.path,
    });
    if (existing) continue;

    await upsertGithubTextContent({
      accessToken: args.accessToken,
      repoFullName: args.repoFullName,
      branch: args.branch,
      path: file.path,
      content: file.content,
      message: `Kwantify memory seed: ${file.path}`,
    });
  }
}

export async function saveStrategyBuilderGithubConnection(args: {
  userId: string;
  accessToken: string;
  scopes: string[];
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  defaultBranch: string;
}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured for Strategy Builder GitHub connections.");

  const encrypted = encryptAccessToken(args.accessToken);
  const now = new Date().toISOString();
  const row = {
    user_id: args.userId,
    repo_owner: args.repoOwner,
    repo_name: args.repoName,
    repo_full_name: args.repoFullName,
    default_branch: args.defaultBranch,
    ...encrypted,
    scopes: args.scopes,
    connected_at: now,
    updated_at: now,
  };

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.table}?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(config),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([row]),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strategy Builder GitHub connection save failed: ${text || response.status}`);
  }
}

export async function readStrategyBuilderGithubConnection(userId: string) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const query = new URLSearchParams({
    select: "user_id,repo_owner,repo_name,repo_full_name,default_branch,token_ciphertext,token_iv,token_auth_tag,scopes,connected_at,updated_at",
    user_id: `eq.${userId}`,
    limit: "1",
  });
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${config.table}?${query.toString()}`, {
    headers: supabaseHeaders(config),
    cache: "no-store",
  });

  if (!response.ok) return null;
  const rows = (await response.json()) as StrategyBuilderGithubConnectionRow[];
  const row = rows[0];
  if (!row) return null;

  return mapConnectionRow(row);
}

export function publicGithubConnection(connection: StrategyBuilderGithubConnection | null) {
  if (!connection) return null;
  return {
    repoOwner: connection.repoOwner,
    repoName: connection.repoName,
    repoFullName: connection.repoFullName,
    defaultBranch: connection.defaultBranch,
    scopes: connection.scopes,
    connectedAt: connection.connectedAt,
    updatedAt: connection.updatedAt,
  };
}
