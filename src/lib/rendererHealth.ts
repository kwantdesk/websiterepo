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
  /*
   * Browser resources this page is holding open, net of teardown.
   *
   * The 08-25 trace named the failure: 276,938 event listeners in 148 seconds
   * while DOM nodes rose by 178. Heap alone could never have said that - it
   * only ever said "something grew". Six sites were repaired and the crash
   * came back, so the next one has to arrive already carrying its own cause.
   *
   * `listenerTypes` is the naming field. A net count says a leak exists;
   * "mousemove 41,882" says which effect to open.
   */
  listeners: number;
  listenerTypes: string;
  intervals: number;
  observers: number;
};

import { captureStallProfile, isRendererProfilerAvailable, startRendererProfiler } from "@/lib/rendererProfiler";

const ACTIVE_KEY = "kwantdesk:renderer-health:active:v1";
/*
 * v2: every v1 record was a backgrounded tab rather than a stall, so the ring
 * is started fresh instead of leaving twenty false positives to be read as
 * history.
 */
const STALL_KEY = "kwantdesk:renderer-health:stalls:v2";
const STALL_PROFILE_KEY = "kwantdesk:renderer-health:stall-profiles:v1";
const CRASH_KEY = "kwantdesk:renderer-health:last-crash:v1";
const SNAPSHOT_INTERVAL_MS = 5_000;
const SAMPLE_INTERVAL_MS = 1_000;

type PerformanceMemory = { usedJSHeapSize: number; jsHeapSizeLimit: number };

/*
 * Net add/remove balance for the resources an effect can leak.
 *
 * Counted by wrapping the browser's own methods, because the alternative -
 * getEventListeners - exists only inside DevTools and cannot run in a user's
 * session. Every wrapper delegates to the original and returns what it
 * returned, so behaviour is unchanged whether or not this ever runs.
 *
 * The number is a BALANCE, not a census. Adding the same listener twice is a
 * DOM no-op that still counts twice here, and a removeEventListener whose
 * arguments do not match removes nothing while still counting down. Neither
 * matters for what this is for: the churn pattern is add-in-effect,
 * remove-in-cleanup, which balances exactly, so a number that climbs and never
 * settles is a cleanup that is not running.
 */
const resourceCounts = { listeners: 0, intervals: 0, observers: 0 };
/** Per event type, so the report names the listener instead of just counting. */
const listenersByType = new Map<string, number>();
let countersInstalled = false;

function installResourceCounters() {
  if (countersInstalled || typeof window === "undefined") return;
  countersInstalled = true;
  try {
    const target = EventTarget.prototype;
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    target.addEventListener = function patchedAdd(this: EventTarget, type, listener, options) {
      resourceCounts.listeners += 1;
      listenersByType.set(type, (listenersByType.get(type) ?? 0) + 1);
      return add.call(this, type, listener, options);
    };
    target.removeEventListener = function patchedRemove(this: EventTarget, type, listener, options) {
      resourceCounts.listeners -= 1;
      const held = listenersByType.get(type);
      if (held !== undefined) listenersByType.set(type, held - 1);
      return remove.call(this, type, listener, options);
    };

    const setIntervalOriginal = window.setInterval;
    const clearIntervalOriginal = window.clearInterval;
    window.setInterval = function patchedSetInterval(this: Window, ...args: unknown[]) {
      resourceCounts.intervals += 1;
      return (setIntervalOriginal as unknown as (...a: unknown[]) => number).apply(this, args);
    } as typeof window.setInterval;
    window.clearInterval = function patchedClearInterval(this: Window, handle?: number) {
      if (handle !== undefined) resourceCounts.intervals -= 1;
      return clearIntervalOriginal.call(this, handle);
    } as typeof window.clearInterval;

    // A ResizeObserver rebuilt per tick was one of the repaired sites, so the
    // count that would have caught it is worth keeping.
    const ObserverOriginal = window.ResizeObserver;
    if (ObserverOriginal) {
      class CountedResizeObserver extends ObserverOriginal {
        constructor(callback: ResizeObserverCallback) {
          super(callback);
          resourceCounts.observers += 1;
        }
        disconnect() {
          resourceCounts.observers -= 1;
          super.disconnect();
        }
      }
      window.ResizeObserver = CountedResizeObserver;
    }
  } catch {
    // Counting is diagnostic. A browser that refuses the patch keeps its page.
    countersInstalled = true;
  }
}

/** The few types holding the most listeners, as "mousemove 41882, resize 12". */
function busiestListenerTypes(limit = 4): string {
  return [...listenersByType.entries()]
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([type, count]) => `${type} ${count}`)
    .join(", ");
}

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
let lastBeat = 0, state = null, stallFrom = 0, reported = false, endpoint = "", paused = false;
self.onmessage = (event) => {
  const message = event.data;
  if (message.type === "config") { endpoint = message.endpoint; return; }
  /*
   * A hidden tab is not a stalled tab.
   *
   * Chrome throttles the page's timers to roughly once a minute in a
   * background tab. The worker is not throttled, so it saw the beats stop and
   * called every backgrounded minute a sixty-second freeze - and POSTed each
   * one to our own telemetry. Twenty such records, all 59,995-60,003ms with
   * longestTaskMs 0, were sitting in the ring where the real stalls should
   * have been, which is why a genuine hang could not be found in it.
   *
   * The page announces the change directly, before throttling can begin.
   */
  if (message.type === "visibility") {
    paused = message.hidden === true;
    stallFrom = 0; reported = false;
    lastBeat = Date.now();
    return;
  }
  if (message.type !== "beat") return;
  // Belt and braces: a beat that arrives late but says it was hidden resyncs
  // rather than resolving into a stall, in case the announcement was missed.
  if (message.hidden === true) {
    paused = true; stallFrom = 0; reported = false; lastBeat = message.at; state = message.state;
    return;
  }
  paused = false;
  if (stallFrom) {
    self.postMessage({ type: "recovered", stalledMs: message.at - stallFrom, state });
    stallFrom = 0; reported = false;
  }
  lastBeat = message.at; state = message.state;
};
setInterval(() => {
  if (!lastBeat) return;
  // While the page is hidden its timers are throttled, so keep sliding the
  // baseline forward instead of letting a gap accumulate against it.
  if (paused) { lastBeat = Date.now(); return; }
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
  /*
   * Announced the moment it changes, which is before the browser starts
   * throttling this page's timers - the beat below cannot do it on its own,
   * because by the time it next runs the gap already looks like a freeze.
   */
  const announceVisibility = () => {
    try {
      worker.postMessage({ type: "visibility", hidden: document.visibilityState === "hidden" });
    } catch {
      // The worker is gone; the main-thread recorder still stands.
    }
  };
  document.addEventListener("visibilitychange", announceVisibility);
  announceVisibility();

  window.setInterval(() => {
    const heap = heapNow();
    worker.postMessage({
      type: "beat",
      at: Date.now(),
      hidden: document.visibilityState === "hidden",
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

  // Before anything else subscribes, so the balance starts from zero and the
  // app's own listeners are all counted.
  installResourceCounters();

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
        listeners: resourceCounts.listeners,
        listenerTypes: busiestListenerTypes(),
        intervals: resourceCounts.intervals,
        observers: resourceCounts.observers,
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
        listeners: resourceCounts.listeners,
        listenerTypes: busiestListenerTypes(),
        intervals: resourceCounts.intervals,
        observers: resourceCounts.observers,
        } satisfies RendererHealthSnapshot));
      } catch {}
    }
  });
}
