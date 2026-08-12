import { pruneChartHistoryCache } from "@/lib/chartHistoryCache";

const HYGIENE_KEY = "kwantdesk:storage-hygiene:v1";
const HYGIENE_INTERVAL_MS = 6 * 60 * 60_000;
const OBSOLETE_CACHE_NAMES = [
  "kwantify-indicator-data-v1",
  "kwantify-indicator-data-v2",
];
let scheduled = false;

/**
 * Keeps disposable market caches bounded without touching journals, chats,
 * drawings, preferences, or other user-created information.
 */
export function scheduleClientStorageHygiene() {
  if (typeof window === "undefined" || scheduled) return;
  scheduled = true;
  const run = async () => {
    try {
      const previous = Number(window.localStorage.getItem(HYGIENE_KEY) ?? 0);
      if (Date.now() - previous < HYGIENE_INTERVAL_MS) return;
      window.localStorage.setItem(HYGIENE_KEY, String(Date.now()));
      await pruneChartHistoryCache(true);
      if ("caches" in window) {
        await Promise.all(OBSOLETE_CACHE_NAMES.map((name) => window.caches.delete(name)));
      }
    } catch {
      // Storage cleanup is best-effort and must not delay authentication.
    }
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void run(), { timeout: 5_000 });
  } else {
    globalThis.setTimeout(() => void run(), 1_000);
  }
}
