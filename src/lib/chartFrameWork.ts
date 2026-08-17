type ChartFrameTask = () => void;

// Heavy studies used to run independently in every pane. Keeping the newest
// task per pane/study and allowing only one such task into each animation frame
// prevents several history folds from blocking pointer and price painting at
// the same moment.
const pendingTasks = new Map<string, ChartFrameTask>();
let scheduledFrame: number | null = null;

function scheduleNextFrame() {
  if (scheduledFrame !== null || pendingTasks.size === 0 || typeof window === "undefined") return;
  scheduledFrame = window.requestAnimationFrame(() => {
    scheduledFrame = null;
    const next = pendingTasks.entries().next();
    if (next.done) return;
    const [key, task] = next.value;
    pendingTasks.delete(key);
    try {
      task();
    } finally {
      // One failed study must never strand every other panel's newest update.
      scheduleNextFrame();
    }
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
