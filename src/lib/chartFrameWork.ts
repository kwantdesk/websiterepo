type ChartFrameTask = () => void;

// Heavy studies used to run independently in every pane. Keeping the newest
// task per pane/study and allowing only one such task into each animation frame
// prevents several history folds from blocking pointer and price painting at
// the same moment.
const pendingTasks = new Map<string, ChartFrameTask>();
let scheduledFrame: number | null = null;

/**
 * How long a frame may spend on queued study work.
 *
 * Exactly one task ran per frame, which is fine with two studies and starves
 * everything with ten: each waits for every study ahead of it to have its own
 * frame first. Price and candles paint on their own imperative path, so what
 * the trader saw was the footprint box following price immediately while its
 * numbers arrived seconds later — the box was never waiting, the DATA was.
 *
 * A budget keeps the original point — never block a frame — while letting a
 * queue that can be cleared cheaply be cleared now. Eight milliseconds leaves
 * the rest of a 60fps frame for paint.
 */
const FRAME_WORK_BUDGET_MS = 8;

function scheduleNextFrame() {
  if (scheduledFrame !== null || pendingTasks.size === 0 || typeof window === "undefined") return;
  scheduledFrame = window.requestAnimationFrame(() => {
    scheduledFrame = null;
    const started = performance.now();
    // At least one task always runs, so a single slow study still makes
    // progress instead of being deferred for ever by its own cost.
    do {
      const next = pendingTasks.entries().next();
      if (next.done) return;
      const [key, task] = next.value;
      pendingTasks.delete(key);
      try {
        task();
      } catch {
        // One failed study must never strand every other panel's newest
        // update; the next one runs regardless.
      }
    } while (pendingTasks.size > 0 && performance.now() - started < FRAME_WORK_BUDGET_MS);
    // Anything left over takes the next frame.
    scheduleNextFrame();
  });
}

export function queueChartFrameWork(key: string, task: ChartFrameTask) {
  if (typeof window === "undefined") return;
  pendingTasks.set(key, task);
  scheduleNextFrame();
}

export function cancelChartFrameWork(key: string) {
  pendingTasks.delete(key);
}
