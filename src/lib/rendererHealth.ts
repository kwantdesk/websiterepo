"use client";

// Renderer health recorder. An "Aw, Snap" kills the tab before anything can
// be logged, so this keeps a tiny rolling snapshot of main-thread health in
// localStorage while the app runs. If the next boot finds the previous
// session's flag still set (the page never fired pagehide — a crash), the
// final snapshot is reported to the server console and to the browser console
// so the crash finally leaves evidence behind instead of an empty tab.
//
// Cost budget: one 1s timer, one longtask PerformanceObserver, one ~1KB
// localStorage write every 5s. Nothing here may allocate per-frame.

type RendererHealthSnapshot = {
  at: number;
  url: string;
  uptimeSeconds: number;
  heapUsedMB: number | null;
  heapLimitMB: number | null;
  // Worst event-loop lag (ms beyond the expected 1s timer cadence) and the
  // number of long tasks plus the longest one, all within the last window.
  worstLagMs: number;
  longTasks: number;
  longestTaskMs: number;
  domNodes: number;
};

const ACTIVE_KEY = "kwantdesk:renderer-health:active:v1";
const CRASH_KEY = "kwantdesk:renderer-health:last-crash:v1";
const SNAPSHOT_INTERVAL_MS = 5_000;
const SAMPLE_INTERVAL_MS = 1_000;

type PerformanceMemory = { usedJSHeapSize: number; jsHeapSizeLimit: number };

function heapNow(): { used: number | null; limit: number | null } {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) return { used: null, limit: null };
  return {
    used: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
    limit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)),
  };
}

function reportPreviousCrash() {
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return;
    window.localStorage.removeItem(ACTIVE_KEY);
    const snapshot = JSON.parse(raw) as RendererHealthSnapshot;
    if (!snapshot || !Number.isFinite(snapshot.at)) return;
    // A stale flag from a machine sleep/power cut is indistinguishable from a
    // crash, but only recent flags are worth reporting at all.
    if (Date.now() - snapshot.at > 24 * 60 * 60 * 1_000) return;
    window.localStorage.setItem(CRASH_KEY, JSON.stringify(snapshot));
    // Visible in the user's DevTools after the post-crash reload.
    // eslint-disable-next-line no-console
    console.warn(
      "[KwantDesk] The previous session ended without a clean unload (browser crash or kill). Final health snapshot:",
      snapshot,
    );
    void fetch("/api/telemetry/renderer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Telemetry must never break the app.
  }
}

let started = false;

export function startRendererHealthRecorder() {
  if (started || typeof window === "undefined") return;
  started = true;

  reportPreviousCrash();

  const startedAt = Date.now();
  let worstLagMs = 0;
  let longTasks = 0;
  let longestTaskMs = 0;
  let lastSample = performance.now();

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks += 1;
        if (entry.duration > longestTaskMs) longestTaskMs = entry.duration;
      }
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch {
    // Longtask timing is Chromium-only; lag sampling below still works.
  }

  window.setInterval(() => {
    const now = performance.now();
    const lag = now - lastSample - SAMPLE_INTERVAL_MS;
    lastSample = now;
    if (lag > worstLagMs) worstLagMs = lag;
  }, SAMPLE_INTERVAL_MS);

  window.setInterval(() => {
    try {
      const heap = heapNow();
      const snapshot: RendererHealthSnapshot = {
        at: Date.now(),
        url: window.location.pathname,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
        heapUsedMB: heap.used,
        heapLimitMB: heap.limit,
        worstLagMs: Math.round(worstLagMs),
        longTasks,
        longestTaskMs: Math.round(longestTaskMs),
        domNodes: document.getElementsByTagName("*").length,
      };
      window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(snapshot));
      // The window resets each snapshot so the stored values describe the
      // FINAL five seconds before a crash, not the whole session.
      worstLagMs = 0;
      longTasks = 0;
      longestTaskMs = 0;
    } catch {
      // Storage may be full or blocked; recording is best-effort.
    }
  }, SNAPSHOT_INTERVAL_MS);

  const clearFlag = () => {
    try {
      window.localStorage.removeItem(ACTIVE_KEY);
    } catch {}
  };
  // pagehide fires on every clean navigation/close, including bfcache moves.
  window.addEventListener("pagehide", clearFlag);
  // A resumed bfcache page must resume recording (the flag was cleared).
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) {
      try {
        const heap = heapNow();
        window.localStorage.setItem(ACTIVE_KEY, JSON.stringify({
          at: Date.now(),
          url: window.location.pathname,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
          heapUsedMB: heap.used,
          heapLimitMB: heap.limit,
          worstLagMs: 0,
          longTasks: 0,
          longestTaskMs: 0,
          domNodes: document.getElementsByTagName("*").length,
        } satisfies RendererHealthSnapshot));
      } catch {}
    }
  });
}
