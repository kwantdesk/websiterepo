import {
  DEFAULT_GEX_MAP_EXPIRY_SCOPE,
  type GexMapExpiryScope,
} from "@/lib/gexMap";

type WorkspaceCacheEntry = {
  value: unknown;
  updatedAt: number;
  bytes?: number;
};

const workspaceDataCache = new Map<string, WorkspaceCacheEntry>();
// Some entries (gamma-heatmap surfaces, gex-map frame sets) are 25-50 MB in
// heap each. A flat entry-count cap of 10 still allowed ~500 MB of standing
// retention — the baseline that made live allocation churn fatal. Evict by an
// approximate BYTE budget instead; sessionStorage/last-good keep a durable
// copy so eviction only costs a re-fetch. A small entry-count cap bounds the
// many-small-entries case.
const WORKSPACE_DATA_CACHE_MAX = 8;
const WORKSPACE_DATA_CACHE_MAX_BYTES = 64 * 1024 * 1024;

// Cheap heap-size estimate for the known-large payload shapes — never a full
// JSON.stringify (that alone churned ~8 MB strings per refresh).
function estimateEntryBytes(value: unknown): number {
  if (!value || typeof value !== "object") return 2_048;
  const record = value as Record<string, unknown>;
  const snapshots = record.snapshots;
  if (Array.isArray(snapshots)) {
    const first = snapshots[0] as Record<string, unknown> | undefined;
    const bins = Array.isArray(first?.bins) ? (first!.bins as unknown[]).length : 0;
    return snapshots.length * Math.max(1, bins) * 120;
  }
  const frames = record.frames;
  if (Array.isArray(frames)) {
    const first = frames[0] as Record<string, unknown> | undefined;
    const strikes = Array.isArray(first?.strikes)
      ? (first!.strikes as unknown[]).length
      : Array.isArray(first?.rows) ? (first!.rows as unknown[]).length : 0;
    return frames.length * Math.max(1, strikes) * 120;
  }
  const levels = record.levels;
  if (Array.isArray(levels)) return levels.length * 96;
  return 64 * 1024;
}

function workspaceCacheBytes(): number {
  let total = 0;
  for (const entry of workspaceDataCache.values()) total += entry.bytes ?? 64 * 1024;
  return total;
}

function setWorkspaceCacheEntry(key: string, entry: WorkspaceCacheEntry) {
  if (entry.bytes === undefined) entry.bytes = estimateEntryBytes(entry.value);
  if (workspaceDataCache.has(key)) workspaceDataCache.delete(key);
  workspaceDataCache.set(key, entry);
  while (
    workspaceDataCache.size > 1
    && (workspaceDataCache.size > WORKSPACE_DATA_CACHE_MAX || workspaceCacheBytes() > WORKSPACE_DATA_CACHE_MAX_BYTES)
  ) {
    const oldest = workspaceDataCache.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    workspaceDataCache.delete(oldest);
  }
}

// Payload shapes that are too large to be worth mirroring into sessionStorage;
// serializing them (JSON.stringify) allocated a multi-MB throwaway string on
// every refresh for a write that then fails the size gate anyway.
function isLargeWorkspacePayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.snapshots) || Array.isArray(record.frames);
}
const workspaceDataRequests = new Map<string, Promise<unknown>>();
const SESSION_CACHE_PREFIX = "kwantdesk:workspace-view:v1:";
const SESSION_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const SESSION_CACHE_MAX_CHARS = 1_500_000;
const GEX_MAP_LAST_GOOD_PREFIX = "kwantdesk:gex-map-last-good:v1:";
const GEX_MAP_LAST_GOOD_MAX_AGE_MS = 72 * 60 * 60 * 1_000;
const WORKSPACE_REQUEST_TIMEOUT_MS = 20_000;
const WORKSPACE_RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryableWorkspaceStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isGexMapKey(key: string) {
  return key.startsWith("gex-map:");
}

function readLastGoodGexMap<T>(key: string): T | null {
  if (typeof window === "undefined" || !isGexMapKey(key)) return null;
  try {
    const stored = window.localStorage.getItem(`${GEX_MAP_LAST_GOOD_PREFIX}${key}`);
    if (!stored) return null;
    const entry = JSON.parse(stored) as WorkspaceCacheEntry;
    if (!entry || Date.now() - entry.updatedAt > GEX_MAP_LAST_GOOD_MAX_AGE_MS) {
      window.localStorage.removeItem(`${GEX_MAP_LAST_GOOD_PREFIX}${key}`);
      return null;
    }
    setWorkspaceCacheEntry(key, entry);
    return entry.value as T;
  } catch {
    return null;
  }
}

function writeLastGoodGexMap<T>(key: string, value: T, updatedAt: number) {
  if (typeof window === "undefined" || !isGexMapKey(key) || !value || typeof value !== "object") return;
  try {
    const payload = value as Record<string, unknown>;
    // The active map can contain hundreds of minute frames per panel. Keep a
    // compact, verified close snapshot outside the tab-scoped cache so an API
    // restart never turns the map blank. The live request still restores the
    // full playback history when the provider is healthy.
    const compact = {
      ...payload,
      frames: Array.isArray(payload.frames) ? payload.frames.slice(-5) : [],
      candles: Array.isArray(payload.candles) ? payload.candles.slice(-10) : [],
    };
    window.localStorage.setItem(
      `${GEX_MAP_LAST_GOOD_PREFIX}${key}`,
      JSON.stringify({ value: compact, updatedAt }),
    );
  } catch {}
}

async function fetchWorkspaceResponse(url: string, timeoutMs = WORKSPACE_REQUEST_TIMEOUT_MS) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
  if (memoryEntry) {
    setWorkspaceCacheEntry(key, memoryEntry);
    return memoryEntry.value as T;
  }
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${key}`);
    if (!stored) return readLastGoodGexMap<T>(key);
    const entry = JSON.parse(stored) as WorkspaceCacheEntry;
    if (!entry || Date.now() - entry.updatedAt > SESSION_CACHE_MAX_AGE_MS) {
      window.sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${key}`);
      return readLastGoodGexMap<T>(key);
    }
    setWorkspaceCacheEntry(key, entry);
    return entry.value as T;
  } catch {
    return readLastGoodGexMap<T>(key);
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
  setWorkspaceCacheEntry(key, entry);
  writeLastGoodGexMap(key, value, entry.updatedAt);
  if (typeof window === "undefined") return;
  // Large heatmap/gex-map payloads are never mirrored to sessionStorage (they
  // exceed the size gate) — do not allocate the multi-MB throwaway string.
  if (isLargeWorkspacePayload(value)) return;
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
    timeoutMs?: number;
    validate?: (value: unknown) => boolean;
    invalidMessage?: string;
  } = {},
): Promise<T> {
  // Restore the tab-scoped cache before deciding whether a network request is
  // necessary. Previously fetches only checked the in-memory Map, so a page
  // reload ignored valid sessionStorage data and forced every heavy indicator
  // to cold-start again.
  if (!workspaceDataCache.has(key) && typeof window !== "undefined") readWorkspaceData<T>(key);
  const cached = workspaceDataCache.get(key);
  const maxAgeMs = options.maxAgeMs ?? 15_000;
  if (!options.force && cached && Date.now() - cached.updatedAt <= maxAgeMs) {
    if (!options.validate || options.validate(cached.value)) return cached.value as T;
    clearWorkspaceData(key);
  }

  const existing = workspaceDataRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = fetchWorkspaceResponse(url, options.timeoutMs)
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

export function gexMapCacheKey(
  symbol: string,
  greekMode: string,
  sessionDate = "",
  scope: GexMapExpiryScope = DEFAULT_GEX_MAP_EXPIRY_SCOPE,
) {
  return `gex-map:${symbol}:${greekMode}:${sessionDate || "live"}:${scope}`;
}

export function compactGexMapLiveCacheKey(
  symbol: string,
  greekMode: string,
  scope: GexMapExpiryScope = DEFAULT_GEX_MAP_EXPIRY_SCOPE,
) {
  return `${gexMapCacheKey(symbol, greekMode, "", scope)}:compact`;
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
      query.set("compact", "1");
      return fetchWorkspaceData(
        compactGexMapLiveCacheKey(symbol, greekMode),
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
