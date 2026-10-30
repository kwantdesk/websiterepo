type IdleScheduler = (task: () => void) => () => void;

/** Code only: never mount a destination, prefetch an API, or start a feed. */
export function warmWorkspaceCodeInBackground(
  targets: readonly string[],
  load: (target: string) => Promise<unknown>,
  schedule: IdleScheduler = scheduleBrowserIdle,
) {
  const queue = [...new Set(targets)];
  let stopped = false;
  let index = 0;
  let cancelScheduled = () => {};
  const next = () => {
    if (stopped || index >= queue.length) return;
    cancelScheduled = schedule(() => {
      if (stopped) return;
      const target = queue[index++];
      void Promise.resolve().then(() => stopped ? undefined : load(target)).catch(() => {
        // Speculative failure must not block navigation or the other pages.
      }).finally(next);
    });
  };
  next();
  return () => { stopped = true; cancelScheduled(); };
}

function scheduleBrowserIdle(task: () => void) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType ?? "")) return () => {};
  let stopped = false;
  let idle: number | undefined;
  let timer: number | undefined;
  const run = () => {
    if (stopped) return;
    if (document.hidden) {
      document.addEventListener("visibilitychange", run, { once: true });
      return;
    }
    const ready = () => {
      if (stopped) return;
      if (document.hidden) { run(); return; }
      task();
    };
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(ready);
    else timer = window.setTimeout(ready, 1_500);
  };
  run();
  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", run);
    if (idle !== undefined) window.cancelIdleCallback(idle);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}
