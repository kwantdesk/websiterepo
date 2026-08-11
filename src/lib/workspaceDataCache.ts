type WorkspaceCacheEntry = {
  value: unknown;
  updatedAt: number;
};

const workspaceDataCache = new Map<string, WorkspaceCacheEntry>();
const workspaceDataRequests = new Map<string, Promise<unknown>>();
const SESSION_CACHE_PREFIX = "kwantdesk:workspace-view:v1:";
const SESSION_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const SESSION_CACHE_MAX_CHARS = 1_500_000;
const WORKSPACE_REQUEST_TIMEOUT_MS = 20_000;
const WORKSPACE_RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryableWorkspaceStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchWorkspaceResponse(url: string) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WORKSPACE_REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!retryableWorkspaceStatus(response.status) || attempt === 1) return response;
      lastError = new Error(`Workspace request returned ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(WORKSPACE_RETRY_DELAY_MS);
  }
  throw lastError instanceof Error ? lastError : new Error("Workspace data could not be loaded.");
}

export function readWorkspaceData<T>(key: string): T | null {
  const memoryEntry = workspaceDataCache.get(key);
  if (memoryEntry) return memoryEntry.value as T;
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${key}`);
    if (!stored) return null;
    const entry = JSON.parse(stored) as WorkspaceCacheEntry;
    if (!entry || Date.now() - entry.updatedAt > SESSION_CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
      return null;
    }
    workspaceDataCache.set(key, entry);
    return entry.value as T;
  } catch {
    return null;
  }
}

export function clearWorkspaceData(key: string) {
  workspaceDataCache.delete(key);
  workspaceDataRequests.delete(key);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
  } catch {}
}

export function writeWorkspaceData<T>(key: string, value: T) {
  const entry = {
    value,
    updatedAt: Date.now(),
  };
  workspaceDataCache.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length <= SESSION_CACHE_MAX_CHARS) {
      window.sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${key}`, serialized);
    }
  } catch {}
}

export async function fetchWorkspaceData<T>(
  key: string,
  url: string,
  options: {
    force?: boolean;
    maxAgeMs?: number;
    validate?: (value: unknown) => boolean;
    invalidMessage?: string;
  } = {},
): Promise<T> {
  const cached = workspaceDataCache.get(key);
  const maxAgeMs = options.maxAgeMs ?? 15_000;
  if (!options.force && cached && Date.now() - cached.updatedAt <= maxAgeMs) {
    if (!options.validate || options.validate(cached.value)) return cached.value as T;
    clearWorkspaceData(key);
  }

  const existing = workspaceDataRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = fetchWorkspaceResponse(url)
    .then(async (response) => {
      const payload = await response.json() as unknown;
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload
          && typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : "Workspace data could not be loaded.";
        throw new Error(message);
      }
      if (options.validate && !options.validate(payload)) {
        throw new Error(options.invalidMessage || "Workspace data was incomplete.");
      }
      writeWorkspaceData(key, payload);
      return payload as T;
    })
    .finally(() => {
      workspaceDataRequests.delete(key);
    });

  workspaceDataRequests.set(key, request);
  return request;
}

export function optionsFlowCacheKey(symbol: string, priceMode: string) {
  return `options-flow:${symbol}:${priceMode}`;
}

export function gexMapCacheKey(symbol: string, greekMode: string, sessionDate = "") {
  return `gex-map:${symbol}:${greekMode}:${sessionDate || "live"}`;
}

export function gameplanCacheKey(root: string, session: string) {
  return `gameplan:v2:${root}:${session}`;
}

export function gexdeskHistoryCacheKey(source: string, instrument = "NQ") {
  return `gexdesk-history:${instrument}:${source}`;
}

export async function preloadWorkspaceData(key: string) {
  if (key === "gamma") {
    return fetchWorkspaceData(
      optionsFlowCacheKey("QQQ", "CASH"),
      "/api/options-flow?symbol=QQQ&priceMode=CASH",
    );
  }

  if (key === "gexmap") {
    const panels = [
      { symbol: "SPX", greekMode: "GAMMA" },
      { symbol: "SPY", greekMode: "DELTA" },
      { symbol: "QQQ", greekMode: "VANNA" },
    ];
    return Promise.all(panels.map(({ symbol, greekMode }) => {
      const query = new URLSearchParams({ symbol, greekMode });
      return fetchWorkspaceData(
        gexMapCacheKey(symbol, greekMode),
        `/api/gex-map?${query}`,
      );
    }));
  }

  if (key === "gexdesk") {
    return Promise.all([
      fetchWorkspaceData("gexdesk:map", "/api/gexdesk"),
      fetchWorkspaceData(
        gexdeskHistoryCacheKey("COMBINED", "NQ"),
        "/api/gexdesk/history?instrument=NQ&source=COMBINED",
      ),
    ]);
  }

  if (key === "heatmap") {
    return Promise.all([
      fetchWorkspaceData("gexdesk:map", "/api/gexdesk"),
      fetchWorkspaceData(
        gexdeskHistoryCacheKey("COMBINED", "NQ"),
        "/api/gexdesk/history?instrument=NQ&source=COMBINED",
      ),
    ]);
  }

  if (key === "gexbot") {
    return fetchWorkspaceData(
      "gexbot:classic:NQ_NDX:gex_full",
      "/api/gexbot-terminal?view=classic&ticker=NQ_NDX&category=gex_full&history=1",
    );
  }

  if (key === "gameplan") {
    return fetchWorkspaceData(
      gameplanCacheKey("NQ", "newyork"),
      "/api/gameplan?root=NQ&session=newyork",
    );
  }

  return Promise.resolve(null);
}
