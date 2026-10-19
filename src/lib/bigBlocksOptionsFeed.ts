import type { GexFlowPayload } from "./gexFlow";

type Listener = (payload: GexFlowPayload | null, error: string | null) => void;
/** One bounded snapshot request per ticker across panes, never per candle/tick. */
export function createBigOptionsFeed(fetcher: typeof fetch = fetch) {
  const feeds = new Map<string, { listeners: Set<Listener>; stop: () => void; latest: GexFlowPayload | null }>();
  return {
    subscribe(symbol: string, listener: Listener) {
      let feed = feeds.get(symbol);
      if (!feed) {
        const listeners = new Set<Listener>();
        let stopped = false, failures = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        const entry = { listeners, latest: null as GexFlowPayload | null, stop() { stopped = true; clearTimeout(timer); controller.abort(); } };
        feed = entry;
        feeds.set(symbol, entry);
        const load = async () => {
          let delay = 3000;
          if (typeof document !== "undefined" && document.hidden) { timer = setTimeout(load, 30000); return; }
          try {
            const query = new URLSearchParams({ symbol, mode: "CONSOLIDATED", size: "100" });
            const response = await fetcher(`/api/gex-flow?${query}`, {
              cache: "no-store", credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
            });
            const payload = await response.json() as GexFlowPayload & { error?: string };
            if (!response.ok) throw new Error(payload.error || "Options flow unavailable");
            if (payload.schemaVersion !== 1 || !Array.isArray(payload.rows) || payload.rows.length > 100
              || !payload.consolidatedAvailable || !/^\d{4}-\d{2}-\d{2}$/.test(payload.sessionDate)
              || !Number.isFinite(Date.parse(payload.asOf))) throw new Error("Invalid options flow snapshot");
            if (stopped) return;
            entry.latest = payload;
            failures = 0;
            for (const callback of listeners) callback(payload, null);
            delay = payload.marketOpen ? Math.max(3000, Math.min(30000, payload.refreshAfterMs || 3000)) : 60000;
          } catch (error) {
            if (stopped) return;
            failures++;
            for (const callback of listeners) callback(entry.latest, error instanceof Error ? error.message : "Options flow unavailable");
            delay = Math.min(60000, 3000 * 2 ** Math.min(5, failures));
          } finally {
            if (!stopped) timer = setTimeout(load, delay);
          }
        };
        // Register the first subscriber before an injected synchronous fetch.
        queueMicrotask(() => { if (!stopped) void load(); });
      }
      const active = feed;
      active.listeners.add(listener);
      if (active.latest) listener(active.latest, null);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active.listeners.delete(listener);
        if (!active.listeners.size) { active.stop(); feeds.delete(symbol); }
      };
    },
  };
}
export const bigOptionsFeed = createBigOptionsFeed();
