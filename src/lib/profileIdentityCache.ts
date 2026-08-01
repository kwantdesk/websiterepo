export type CachedProfileIdentity = {
  avatarUrl: string;
  displayName: string;
  handle: string;
  updatedAt: number;
};

const CACHE_PREFIX = "kwantdesk:profile-identity:v1:";
const memoryCache = new Map<string, CachedProfileIdentity>();

function cacheKey(userId: string) {
  return `${CACHE_PREFIX}${encodeURIComponent(userId)}`;
}

function cleanIdentity(value: unknown): CachedProfileIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CachedProfileIdentity>;
  return {
    avatarUrl: typeof candidate.avatarUrl === "string" ? candidate.avatarUrl : "",
    displayName: typeof candidate.displayName === "string" ? candidate.displayName : "",
    handle: typeof candidate.handle === "string" ? candidate.handle : "",
    updatedAt: Number.isFinite(candidate.updatedAt) ? Number(candidate.updatedAt) : Date.now(),
  };
}

export function readProfileIdentityCache(userId: string) {
  if (!userId) return null;
  const inMemory = memoryCache.get(userId);
  if (inMemory) return inMemory;
  if (typeof window === "undefined") return null;
  try {
    const parsed = cleanIdentity(JSON.parse(window.sessionStorage.getItem(cacheKey(userId)) ?? "null"));
    if (parsed) memoryCache.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function cacheProfileIdentity(
  userId: string,
  update: Partial<Omit<CachedProfileIdentity, "updatedAt">>,
) {
  if (!userId) return null;
  const current = readProfileIdentityCache(userId);
  const next: CachedProfileIdentity = {
    avatarUrl: update.avatarUrl ?? current?.avatarUrl ?? "",
    displayName: update.displayName ?? current?.displayName ?? "",
    handle: update.handle ?? current?.handle ?? "",
    updatedAt: Date.now(),
  };
  memoryCache.set(userId, next);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } catch {
      // Large, high-quality data URLs remain available in memory for this app session.
    }
  }
  return next;
}
