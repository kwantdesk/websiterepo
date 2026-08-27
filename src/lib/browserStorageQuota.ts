/**
 * Making room in browser storage for the trader's own work.
 *
 * localStorage is a few megabytes per origin and this desk keeps two very
 * different kinds of thing in it. Saved workspaces, templates, drawings and
 * settings are WORK — losing them loses something the trader made. Last-good
 * provider payloads, exposure frames and crash snapshots are CACHE — every
 * one of them can be fetched again, and they are far larger than the work is.
 *
 * A full quota used to fail the save and keep the cache, which is exactly
 * backwards: "browser storage is full" while megabytes of re-downloadable
 * gamma frames sat beside it. Anything the trader is trying to keep now
 * evicts cache and tries again.
 *
 * This only works if every cache is actually LISTED below. A re-fetchable
 * payload missing from the list is worse than not having the mechanism at all:
 * it fills the quota, cannot be evicted to make room, and the save it blocks
 * fails silently. The GEX Map ladders - the single largest thing this app
 * writes - were missing, which is exactly how a Save As came to fail while
 * megabytes of strike data it could refetch in a second sat next to it.
 */

/**
 * Key prefixes holding data that can be fetched again, newest-value-wins.
 *
 * Order matters: the first entries are the largest and least missed. Nothing
 * describing a workspace, a layout, a drawing or a preference belongs here —
 * if it cannot be rebuilt from a provider, it is not cache.
 */
const DISPOSABLE_PREFIXES = [
  "kwantdesk:gex-map-last-good:v1:",        // whole strike ladders, the largest
  "kwantdesk:gex-box:last-native:v1:",      // exposure frame envelopes
  "kwantdesk:gamma-levels:last-good:v1:",   // gamma ladders, largest per entry
  "kwantdesk:chart-gamma-overlay:last-good:v1:", // per-chart gamma overlays
  "kwantdesk:tpo-levels:last-good:v2:",     // TPO letter grids
  "kwantdesk:tpo-levels:last-good:v1:",
  "kwantdesk:value-area:last-good:v2:",     // value-area payloads
  "kwantdesk:value-area:last-good:v1:",
  "kwantdesk:economic-calendar-cache:v2",   // calendar, refetched on demand
  "kwantdesk:renderer-health",              // crash forensics snapshots
  "kwantdesk:client-render-failures",       // recorded render failures
];

export type StorageWriteResult = {
  ok: boolean;
  /** Bytes released to make the write fit, for an honest message. */
  reclaimedBytes: number;
  /** How many cache entries were dropped. */
  evicted: number;
};

function bytesOf(key: string, value: string) {
  // UTF-16 in practice, and the key counts toward the quota too.
  return (key.length + value.length) * 2;
}

/** Every disposable entry currently held, largest first. */
function disposableEntries(store: Storage) {
  const entries: Array<{ key: string; size: number }> = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (!key || !DISPOSABLE_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    entries.push({ key, size: bytesOf(key, store.getItem(key) ?? "") });
  }
  return entries.sort((left, right) => right.size - left.size);
}

/**
 * Write a value the trader is trying to keep.
 *
 * Evicts cache only when the write actually fails, and only as much as it
 * takes, so an ordinary save never disturbs anything.
 */
export function writeProtectedItem(
  key: string,
  value: string,
  store: Storage | null = typeof window === "undefined" ? null : window.localStorage,
): StorageWriteResult {
  if (!store) return { ok: false, reclaimedBytes: 0, evicted: 0 };
  try {
    store.setItem(key, value);
    return { ok: true, reclaimedBytes: 0, evicted: 0 };
  } catch {
    // Fall through and make room.
  }

  let reclaimedBytes = 0;
  let evicted = 0;
  for (const entry of disposableEntries(store)) {
    // Never evict the very thing being written, however it is prefixed.
    if (entry.key === key) continue;
    try {
      store.removeItem(entry.key);
    } catch {
      continue;
    }
    reclaimedBytes += entry.size;
    evicted += 1;
    try {
      store.setItem(key, value);
      return { ok: true, reclaimedBytes, evicted };
    } catch {
      // Still short; keep going.
    }
  }
  return { ok: false, reclaimedBytes, evicted };
}

/** What the caches are costing right now, for a diagnostic. */
export function disposableStorageBytes(
  store: Storage | null = typeof window === "undefined" ? null : window.localStorage,
): number {
  if (!store) return 0;
  return disposableEntries(store).reduce((total, entry) => total + entry.size, 0);
}
