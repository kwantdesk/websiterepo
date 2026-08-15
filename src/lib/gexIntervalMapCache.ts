"use client";

import { fetchWorkspaceData } from "@/lib/workspaceDataCache";
import { isGexIntervalProviderSurface, type GexIntervalProviderSurface } from "@/lib/gexIntervalMap";

type Listener = (state: { data: GexIntervalProviderSurface | null; loading: boolean; error: string | null }) => void;
type Entry = {
  key: string;
  url: string;
  listeners: Set<Listener>;
  data: GexIntervalProviderSurface | null;
  error: string | null;
  loading: boolean;
  timer: number | null;
  inFlight: Promise<void> | null;
  attempts: number;
  refreshMs: number;
};

const entries = new Map<string, Entry>();

function publish(entry: Entry) {
  const state = { data: entry.data, loading: entry.loading, error: entry.error };
  entry.listeners.forEach((listener) => listener(state));
}

function schedule(entry: Entry) {
  if (!entry.listeners.size || typeof window === "undefined") return;
  if (entry.timer !== null) window.clearTimeout(entry.timer);
  const backoff = entry.error ? Math.min(60_000, entry.refreshMs * 2 ** Math.min(4, entry.attempts)) : entry.refreshMs;
  entry.timer = window.setTimeout(() => void refresh(entry, true), backoff);
}

async function refresh(entry: Entry, force: boolean) {
  if (entry.inFlight) return entry.inFlight;
  entry.loading = !entry.data;
  publish(entry);
  entry.inFlight = (async () => {
    try {
      const data = await fetchWorkspaceData<GexIntervalProviderSurface>(entry.key, entry.url, {
        force,
        maxAgeMs: entry.refreshMs,
        timeoutMs: 35_000,
        validate: isGexIntervalProviderSurface,
        invalidMessage: "GEX Interval Map returned an incomplete interval surface.",
      });
      entry.data = data;
      entry.refreshMs = Math.max(2_000, Math.min(60_000, data.refreshAfterMs));
      entry.error = null;
      entry.attempts = 0;
    } catch (error) {
      entry.error = error instanceof Error ? error.message : "GEX Interval Map could not refresh.";
      entry.attempts += 1;
    } finally {
      entry.loading = false;
      entry.inFlight = null;
      publish(entry);
      schedule(entry);
    }
  })();
  return entry.inFlight;
}

export function subscribeGexIntervalMap(input: {
  key: string;
  url: string;
  refreshMs: number;
  listener: Listener;
}) {
  let entry = entries.get(input.key);
  if (!entry) {
    entry = {
      key: input.key,
      url: input.url,
      listeners: new Set(),
      data: null,
      error: null,
      loading: true,
      timer: null,
      inFlight: null,
      attempts: 0,
      refreshMs: input.refreshMs,
    };
    entries.set(input.key, entry);
  }
  entry.url = input.url;
  entry.refreshMs = input.refreshMs;
  entry.listeners.add(input.listener);
  input.listener({ data: entry.data, loading: entry.loading, error: entry.error });
  void refresh(entry, false);
  return () => {
    entry?.listeners.delete(input.listener);
    if (entry && !entry.listeners.size) {
      if (entry.timer !== null) window.clearTimeout(entry.timer);
      entry.timer = null;
      window.setTimeout(() => {
        const current = entries.get(input.key);
        if (current && !current.listeners.size && !current.inFlight) entries.delete(input.key);
      }, 60_000);
    }
  };
}

export function clearGexIntervalMapCacheForTests() {
  for (const entry of entries.values()) if (entry.timer !== null && typeof window !== "undefined") window.clearTimeout(entry.timer);
  entries.clear();
}
