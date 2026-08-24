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

import { captureStallProfile, isRendererProfilerAvailable, startRendererProfiler } from "@/lib/rendererProfiler";

const ACTIVE_KEY = "kwantdesk:renderer-health:active:v1";
const STALL_KEY = "kwantdesk:renderer-health:stalls:v1";
const STALL_PROFILE_KEY = "kwantdesk:renderer-health:stall-profiles:v1";
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

/**
 * Watchdog that survives the failure it is watching for.
 *
 * Everything above samples on the main thread, so a hard freeze — the exact
 * case worth capturing — stops the sampler too. The last snapshot then
 * describes the healthy seconds BEFORE the block, which is why a frozen tab
 * has repeatedly reported single-digit lag and a calm heap.
 *
 * A worker keeps its own thread. The page beats twice a second; the worker
 * notices when the beats stop, reports the stall from its own thread while
 * the page is still wedged, and reports the true duration once beats resume.
 */
const STALL_WORKER_SOURCE = `
let lastBeat = 0, state = null, stallFrom = 0, reported = false, endpoint = "";
self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "config") { endpoint = message.endpoint; return; }
  if (message.type !== "beat") return;
  if (stallFrom) {
    self.postMessage({ type: "recovered", stalledMs: message.at - stallFrom, state });
    stallFrom = 0; reported = false;
  }
  lastBeat = message.at; state = message.state;
};
setInterval(() => {
  if (!lastBeat) return;
  const gap = Date.now() - lastBeat;
  if (gap < 2000) return;
  if (!stallFrom) stallFrom = lastBeat;
  // Report from this thread while the page is still blocked, so a stall that
  // ends in a dead tab still leaves evidence.
  if (!reported && gap > 5000 && endpoint) {
    reported = true;
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "stall", ongoingGapMs: Math.round(gap), ...state }),
      keepalive: true,
    }).catch(() => {});
  }
}, 500);
`;

const STALL_BEAT_INTERVAL_MS = 500;
/** Stalls shorter than this are ordinary jank, not the reported freeze. */
const STALL_RECORD_FLOOR_MS = 1_500;

function startStallWatchdog(startedAt: number, longestTaskRef: { value: number }) {
  let worker: Worker;
  try {
    const url = URL.createObjectURL(new Blob([STALL_WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch {
    // A CSP without blob: workers leaves the main-thread recorder in place.
    return;
  }
  worker.postMessage({ type: "config", endpoint: "/api/telemetry/renderer" });
  worker.addEventListener("message", (event: MessageEvent) => {
    const message = event.data as { type?: string; stalledMs?: number };
    if (message?.type !== "recovered") return;
    const stalledMs = Math.round(message.stalledMs ?? 0);
    if (stalledMs < STALL_RECORD_FLOOR_MS) return;
    // Timing says the thread was blocked; the profile says by what. Stopping
    // the sampler is async, so the record is written once it resolves.
    void captureStallProfile(stalledMs).then((profile) => {
      if (!profile) return;
      try {
        const previous = JSON.parse(window.localStorage.getItem(STALL_PROFILE_KEY) ?? "[]") as unknown[];
        const record = { at: Date.now(), url: window.location.pathname, stalledMs, ...profile };
        window.localStorage.setItem(
          STALL_PROFILE_KEY,
          JSON.stringify([record, ...previous].slice(0, 5)),
        );
        // eslint-disable-next-line no-console
        console.error("[renderer-stall-profile]", JSON.stringify(record));
        void fetch("/api/telemetry/renderer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "stall-profile", ...record }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Best-effort.
      }
    });
    try {
      const heap = heapNow();
      const previous = JSON.parse(window.localStorage.getItem(STALL_KEY) ?? "[]") as unknown[];
      const record = {
        at: Date.now(),
        url: window.location.pathname,
        stalledMs,
        // The browser still records long tasks while JS cannot run, and the
        // observer callback fires on recovery — so this names the task that
        // did the blocking rather than merely its duration.
        longestTaskMs: Math.round(longestTaskRef.value),
        heapUsedMB: heap.used,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
      };
      const next = [record, ...previous].slice(0, 20);
      window.localStorage.setItem(STALL_KEY, JSON.stringify(next));
      // eslint-disable-next-line no-console
      console.error("[renderer-stall]", JSON.stringify(record));
    } catch {
      // Best-effort: a full quota must not break the page.
    }
  });
  window.setInterval(() => {
    const heap = heapNow();
    worker.postMessage({
      type: "beat",
      at: Date.now(),
      state: {
        url: window.location.pathname,
        heapUsedMB: heap.used,
        heapLimitMB: heap.limit,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1_000),
      },
    });
  }, STALL_BEAT_INTERVAL_MS);
}

export function startRendererHealthRecorder() {
  if (started || typeof window === "undefined") return;
  started = true;

  reportPreviousCrash();

  const startedAt = Date.now();
  let worstLagMs = 0;
  let longTasks = 0;
  let longestTaskMs = 0;
  const longestTaskRef = { value: 0 };
  let lastSample = performance.now();

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks += 1;
        if (entry.duration > longestTaskMs) longestTaskMs = entry.duration;
        if (entry.duration > longestTaskRef.value) longestTaskRef.value = entry.duration;
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
      longestTaskRef.value = 0;
    } catch {
      // Storage may be full or blocked; recording is best-effort.
    }
  }, SNAPSHOT_INTERVAL_MS);

  startStallWatchdog(startedAt, longestTaskRef);
  // The JS self-profiler is a diagnostics instrument, not a production
  // runtime dependency. Keeping it active all trading day retains thousands
  // of stack samples and rotates a trace every minute. Enable it explicitly
  // when investigating a stall; normal production tabs stay profiler-free.
  let profilerEnabled = process.env.NODE_ENV !== "production";
  try {
    profilerEnabled = profilerEnabled || window.localStorage.getItem("kwantdesk:renderer-profiler") === "1";
  } catch {}
  if (profilerEnabled) startRendererProfiler();

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
