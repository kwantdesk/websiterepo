export type CachedProfileIdentity = {
  avatarUrl: string;
  displayName: string;
  handle: string;
  updatedAt: number;
};

const CACHE_PREFIX = "kwantdesk:profile-identity:v1:";
const memoryCache = new Map<string, CachedProfileIdentity>();
const IDENTITY_EVENT = "kwantdesk:profile-identity-cache";
const IDENTITY_CHANNEL = "kwantdesk-profile-identity";

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
  broadcast = false,
) {
  if (!userId) return null;
  const current = readProfileIdentityCache(userId);
  const next: CachedProfileIdentity = {
    avatarUrl: update.avatarUrl ?? current?.avatarUrl ?? "",
    displayName: update.displayName ?? current?.displayName ?? "",
    handle: update.handle ?? current?.handle ?? "",
    updatedAt: Date.now(),
  };
  const changed = !current || next.displayName !== current.displayName || next.handle !== current.handle || next.avatarUrl !== current.avatarUrl;
  if (!changed && !broadcast) return current;
  memoryCache.set(userId, next);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } catch {
      // Large, high-quality data URLs remain available in memory for this app session.
    }
    window.dispatchEvent(new CustomEvent(IDENTITY_EVENT, { detail: { userId, identity: next } }));
    if (broadcast && typeof BroadcastChannel !== "undefined") {
      try {
        const channel = new BroadcastChannel(IDENTITY_CHANNEL);
        channel.postMessage({ userId, identity: next });
        channel.close();
      } catch { /* Optional cross-tab transport must not fail a saved identity. */ }
    }
  }
  return next;
}

/** Account-scoped local and cross-tab updates; no polling or extra provider requests. */
export function subscribeProfileIdentity(userId: string, receive: (identity: CachedProfileIdentity) => void) {
  if (!userId || typeof window === "undefined") return () => {};
  const local = (event: Event) => {
    const detail = (event as CustomEvent<{ userId?: string; identity?: CachedProfileIdentity }>).detail;
    if (detail?.userId === userId && detail.identity) receive(detail.identity);
  };
  window.addEventListener(IDENTITY_EVENT, local);
  const cached = readProfileIdentityCache(userId);
  if (cached) receive(cached);
  let channel: BroadcastChannel | null = null;
  try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(IDENTITY_CHANNEL); } catch { /* Local updates still work. */ }
  if (channel) channel.onmessage = event => {
    if (event.data?.userId !== userId) return;
    const incoming = cleanIdentity(event.data.identity), current = readProfileIdentityCache(userId);
    if (!incoming || (current && incoming.updatedAt < current.updatedAt)) return;
    cacheProfileIdentity(userId, incoming);
  };
  return () => { window.removeEventListener(IDENTITY_EVENT, local); channel?.close(); };
}
