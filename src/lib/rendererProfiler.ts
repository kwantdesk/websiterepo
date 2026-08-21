"use client";

/**
 * Continuous self-profiling for the workspace.
 *
 * A stall can be timed from a worker, but timing only says the thread was
 * blocked — not by what. Chrome's JS Self-Profiling API samples the page's own
 * call stacks, so when the watchdog reports a stall the samples covering it
 * name the function that did the blocking.
 *
 * Cost budget: one sampler at a 10ms interval, restarted on a fixed window.
 * Chrome samples on a separate thread, so this does not add main-thread work;
 * summarising only happens when a stall actually fires.
 */

type ProfilerFrame = { name?: string; resourceId?: number; line?: number; column?: number };
type ProfilerStack = { parentId?: number; frameId: number };
type ProfilerSample = { timestamp: number; stackId?: number };
type ProfilerTrace = {
  frames: ProfilerFrame[];
  stacks: ProfilerStack[];
  samples: ProfilerSample[];
  resources: string[];
};
type JsProfiler = {
  stop: () => Promise<ProfilerTrace>;
  stopped: boolean;
};
type ProfilerConstructor = new (options: { sampleInterval: number; maxBufferSize: number }) => JsProfiler;

const SAMPLE_INTERVAL_MS = 10;
// A 30s window at 10ms is 3,000 samples; the buffer is sized with headroom so
// a burst of oversampling cannot silently truncate the window.
const MAX_BUFFER_SIZE = 6_000;
const WINDOW_MS = 30_000;

let current: JsProfiler | null = null;
let startedAt = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

function profilerConstructor(): ProfilerConstructor | null {
  const candidate = (window as unknown as { Profiler?: ProfilerConstructor }).Profiler;
  return typeof candidate === "function" ? candidate : null;
}

/** Resolves each sample to its leaf frame and ranks by self time. */
function summarize(trace: ProfilerTrace, sinceMs: number) {
  const frameLabel = (frameId: number) => {
    const frame = trace.frames[frameId];
    if (!frame) return "(unknown)";
    const name = frame.name && frame.name.length ? frame.name : "(anonymous)";
    const resource = frame.resourceId !== undefined ? trace.resources[frame.resourceId] : undefined;
    const file = resource ? resource.split("/").pop() : undefined;
    return file ? `${name} @ ${file}:${frame.line ?? 0}` : name;
  };

  const selfSamples = new Map<string, number>();
  let counted = 0;
  for (const sample of trace.samples) {
    if (sample.timestamp < sinceMs) continue;
    counted += 1;
    // A sample with no stack is idle time, which is exactly what a blocked
    // thread does NOT look like — keep it visible rather than dropping it.
    if (sample.stackId === undefined) {
      selfSamples.set("(idle)", (selfSamples.get("(idle)") ?? 0) + 1);
      continue;
    }
    const stack = trace.stacks[sample.stackId];
    if (!stack) continue;
    const label = frameLabel(stack.frameId);
    selfSamples.set(label, (selfSamples.get(label) ?? 0) + 1);
  }

  const top = [...selfSamples.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 15)
    .map(([frame, samples]) => ({
      frame,
      samples,
      percent: counted ? Math.round((samples / counted) * 100) : 0,
      approxMs: samples * SAMPLE_INTERVAL_MS,
    }));
  return { sampledWindowMs: counted * SAMPLE_INTERVAL_MS, top };
}

async function rotate() {
  const previous = current;
  current = null;
  if (previous && !previous.stopped) {
    try { await previous.stop(); } catch { /* a stopped profiler is fine */ }
  }
  if (running) start();
}

function start() {
  const Constructor = profilerConstructor();
  if (!Constructor) return;
  try {
    current = new Constructor({ sampleInterval: SAMPLE_INTERVAL_MS, maxBufferSize: MAX_BUFFER_SIZE });
    startedAt = performance.now();
  } catch {
    // Missing Document-Policy, or profiling unavailable in this build.
    running = false;
    return;
  }
  if (restartTimer !== null) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => { void rotate(); }, WINDOW_MS);
}

export function startRendererProfiler() {
  if (running || typeof window === "undefined") return;
  if (!profilerConstructor()) return;
  running = true;
  start();
}

/**
 * Stops the sampler and returns what was running during the stall. Called by
 * the health watchdog on recovery, so the profile covers the block itself.
 */
export async function captureStallProfile(stalledMs: number) {
  const active = current;
  if (!active || active.stopped) return null;
  current = null;
  if (restartTimer !== null) clearTimeout(restartTimer);
  restartTimer = null;
  let trace: ProfilerTrace;
  try {
    trace = await active.stop();
  } catch {
    if (running) start();
    return null;
  }
  // Only the samples from the stall window are of interest; anything earlier
  // is the healthy period before it.
  const stallStartedAt = Math.max(startedAt, performance.now() - stalledMs - 1_000);
  const summary = summarize(trace, stallStartedAt);
  if (running) start();
  return summary;
}

export function isRendererProfilerAvailable() {
  return typeof window !== "undefined" && profilerConstructor() !== null;
}
