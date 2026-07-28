import {
  readStrategyBuilderGithubConnection,
  upsertGithubTextContent,
  type StrategyBuilderGithubConnection,
} from "@/lib/strategyBuilderGithub.server";

type GithubRepoRef = {
  owner: string;
  repo: string;
  label: string;
};

type GithubTextFile = {
  path: string;
  text: string;
  sha: string | null;
};

type GithubRepoInfo = {
  defaultBranch: string;
};

export const STRATEGY_BUILDER_MEMORY_FILES = [
  "AGENTS.md",
  ".kwantify/memory/MEMORY.md",
  ".kwantify/memory/PROJECT_STATE.md",
  ".kwantify/memory/PREFERENCES.md",
  ".kwantify/memory/STRATEGY_LOG.md",
];

const MAX_MEMORY_FILE_CHARS = 12000;
const MAX_MEMORY_CONTEXT_CHARS = 32000;
const MAX_SESSION_FIELD_CHARS = 6000;
const GITHUB_API_BASE = "https://api.github.com";

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 80).trimEnd()}\n\n[Truncated by Kwantify memory adapter]`;
}

function getGithubToken() {
  return (
    process.env.GITHUB_STRATEGY_BUILDER_TOKEN?.trim() ||
    process.env.KWANTIFY_GITHUB_MEMORY_TOKEN?.trim() ||
    ""
  );
}

function githubHeaders(token = getGithubToken()) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kwantify-strategy-builder",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function githubConnectionHeaders(connection: StrategyBuilderGithubConnection) {
  return githubHeaders(connection.accessToken);
}

function decodeBase64(value: string) {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export function parseGithubRepoFromWorkspaceContext(workspaceContext: string): GithubRepoRef | null {
  const text = workspaceContext.trim();
  if (!text) return null;

  const urlMatch = text.match(/https:\/\/github\.com\/([^/\s]+)\/([^/\s?#)]+)(?:[/?#)\s]|$)/i);
  const labelMatch = text.match(/GitHub repo\s+-\s+([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  const plainMatch = text.match(/(?:^|\s)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\s|$)/);
  const match = urlMatch ?? labelMatch ?? plainMatch;

  if (!match) return null;
  const owner = match[1]?.trim();
  const repo = match[2]?.replace(/\.git$/i, "").trim();
  if (!owner || !repo) return null;

  return {
    owner,
    repo,
    label: `${owner}/${repo}`,
  };
}

async function githubFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...githubHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getGithubRepoInfo(repoRef: GithubRepoRef): Promise<GithubRepoInfo> {
  const data = await githubFetchJson<{ default_branch?: string }>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}`,
  );

  return { defaultBranch: data?.default_branch || "main" };
}

async function readGithubTextFile(repoRef: GithubRepoRef, path: string, branch: string): Promise<GithubTextFile | null> {
  const data = await githubFetchJson<{
    content?: string;
    encoding?: string;
    sha?: string;
    type?: string;
  }>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(branch)}`,
  );

  if (!data || data.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string") {
    return null;
  }

  return {
    path,
    text: decodeBase64(data.content),
    sha: typeof data.sha === "string" ? data.sha : null,
  };
}

async function readGithubTextFileWithConnection(
  connection: StrategyBuilderGithubConnection,
  path: string,
): Promise<GithubTextFile | null> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(connection.repoOwner)}/${encodeURIComponent(connection.repoName)}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(connection.defaultBranch)}`,
    {
      headers: githubConnectionHeaders(connection),
      cache: "no-store",
    },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub memory file read failed with ${response.status}`);

  const data = (await response.json()) as {
    content?: string;
    encoding?: string;
    sha?: string;
    type?: string;
  };
  if (data.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string") return null;

  return {
    path,
    text: decodeBase64(data.content),
    sha: typeof data.sha === "string" ? data.sha : null,
  };
}

export async function loadStrategyBuilderRepoMemory(workspaceContext: string, accountId?: string) {
  const connection = accountId ? await readStrategyBuilderGithubConnection(accountId) : null;
  const repoRef = connection
    ? { owner: connection.repoOwner, repo: connection.repoName, label: connection.repoFullName }
    : parseGithubRepoFromWorkspaceContext(workspaceContext);
  if (!repoRef) return "";

  try {
    const repoInfo = connection ? { defaultBranch: connection.defaultBranch } : await getGithubRepoInfo(repoRef);
    const files = (
      await Promise.all(
        STRATEGY_BUILDER_MEMORY_FILES.map((path) =>
          connection ? readGithubTextFileWithConnection(connection, path) : readGithubTextFile(repoRef, path, repoInfo.defaultBranch),
        ),
      )
    ).filter((file): file is GithubTextFile => Boolean(file));

    if (!files.length) {
      return [
        `Connected GitHub memory repo: ${repoRef.label}`,
        "No Kwantify/Codex-style memory files were found yet.",
        "Expected files: AGENTS.md plus .kwantify/memory/MEMORY.md, PROJECT_STATE.md, PREFERENCES.md, and STRATEGY_LOG.md.",
      ].join("\n");
    }

    const memoryText = files
      .map((file) => `# ${file.path}\n${truncate(file.text, MAX_MEMORY_FILE_CHARS)}`)
      .join("\n\n---\n\n");

    return truncate(`Connected GitHub memory repo: ${repoRef.label}\n\n${memoryText}`, MAX_MEMORY_CONTEXT_CHARS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GitHub memory error";
    return `Connected GitHub memory repo: ${repoRef.label}\nGitHub memory read failed: ${message}`;
  }
}

function shouldWriteGithubMemory() {
  return process.env.KWANTIFY_GITHUB_MEMORY_WRITES === "true" && Boolean(getGithubToken());
}

function buildSessionEntry(args: {
  accountId: string;
  modelMode: string;
  intent?: string | null;
  userMessage: string;
  assistantResponse: string;
}) {
  return [
    `\n## ${new Date().toISOString()}`,
    `- Account scope: ${args.accountId}`,
    `- Model mode: ${args.modelMode}`,
    args.intent ? `- Intent: ${args.intent}` : "",
    "",
    "### User",
    truncate(args.userMessage.trim(), MAX_SESSION_FIELD_CHARS),
    "",
    "### Assistant",
    truncate(args.assistantResponse.trim(), MAX_SESSION_FIELD_CHARS),
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function upsertGithubTextFile(args: {
  repoRef: GithubRepoRef;
  branch: string;
  path: string;
  content: string;
  message: string;
  existingSha?: string | null;
}) {
  const body: Record<string, unknown> = {
    message: args.message,
    content: encodeBase64(args.content),
    branch: args.branch,
  };
  if (args.existingSha) body.sha = args.existingSha;

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(args.repoRef.owner)}/${encodeURIComponent(args.repoRef.repo)}/contents/${args.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    {
      method: "PUT",
      headers: {
        ...githubHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub memory write failed with ${response.status}`);
  }
}

export async function persistStrategyBuilderGithubMemory(args: {
  workspaceContext: string;
  accountId: string;
  modelMode: string;
  intent?: string | null;
  userMessage: string;
  assistantResponse: string;
}) {
  const connection = await readStrategyBuilderGithubConnection(args.accountId);
  if (connection) {
    const today = new Date().toISOString().slice(0, 10);
    const sessionPath = `.kwantify/memory/sessions/${today}.md`;
    const existing = await readGithubTextFileWithConnection(connection, sessionPath);
    const entry = buildSessionEntry(args);
    const nextContent = existing?.text
      ? `${existing.text.trimEnd()}\n${entry}`
      : `# Kwantify Strategy Builder Session Log - ${today}\n${entry}`;

    await upsertGithubTextContent({
      accessToken: connection.accessToken,
      repoFullName: connection.repoFullName,
      branch: connection.defaultBranch,
      path: sessionPath,
      content: nextContent,
      message: `Kwantify memory update ${today}`,
    });

    return { status: "written" as const, path: sessionPath, repo: connection.repoFullName };
  }

  const repoRef = parseGithubRepoFromWorkspaceContext(args.workspaceContext);
  if (!repoRef || !shouldWriteGithubMemory()) {
    return { status: "skipped" as const };
  }

  const repoInfo = await getGithubRepoInfo(repoRef);
  const today = new Date().toISOString().slice(0, 10);
  const sessionPath = `.kwantify/memory/sessions/${today}.md`;
  const existing = await readGithubTextFile(repoRef, sessionPath, repoInfo.defaultBranch);
  const entry = buildSessionEntry(args);
  const nextContent = existing?.text ? `${existing.text.trimEnd()}\n${entry}` : `# Kwantify Strategy Builder Session Log - ${today}\n${entry}`;

  await upsertGithubTextFile({
    repoRef,
    branch: repoInfo.defaultBranch,
    path: sessionPath,
    content: nextContent,
    message: `Kwantify memory update ${today}`,
    existingSha: existing?.sha,
  });

  return { status: "written" as const, path: sessionPath, repo: repoRef.label };
}
