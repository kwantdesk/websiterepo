type PaintEnvironment = {
  visible: () => boolean;
  requestFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  delay: (callback: () => void, milliseconds: number) => number;
  cancelDelay: (handle: number) => void;
};

/** Every visible pane paints on the next display frame, regardless of selection.
 * Hidden documents retain lossless batching without spending foreground CPU. */
export function createExecutionPaintScheduler(flush: () => void, env: PaintEnvironment) {
  let frame: number | null = null, timer: number | null = null, pending = false;
  const run = () => { frame = null; timer = null; pending = false; flush(); };
  const clear = () => {
    if (frame !== null) env.cancelFrame(frame);
    if (timer !== null) env.cancelDelay(timer);
    frame = null; timer = null;
  };
  const schedule = () => {
    pending = true;
    if (frame !== null || timer !== null) return;
    if (env.visible()) frame = env.requestFrame(run);
    else timer = env.delay(run, 750);
  };
  return {
    schedule,
    visibilityChanged() { if (pending) { clear(); schedule(); } },
    cancel() { clear(); pending = false; },
  };
}

/** Lossless model checkpoints run outside the candle's animation-frame work.
 * Never use this queue for prices, orders, executions or footprint prints. */
export function createExecutionStudyScheduler<T>(
  commit: (records: T[]) => void,
  env: Pick<PaintEnvironment, "delay" | "cancelDelay"> & {
    active: () => boolean;
    checkpoint?: (record: T) => number;
  },
) {
  let pending: T[] = [];
  let timer: number | null = null;
  let scheduledDelay = Infinity;
  const run = () => {
    timer = null;
    scheduledDelay = Infinity;
    const batch = pending;
    pending = [];
    if (!batch.length) return;
    // Preserve a completed minute's developing POC/VA/VWAP checkpoint when
    // a deferred batch straddles its boundary. The final partial run follows.
    if (!env.checkpoint) { commit(batch); return; }
    let start = 0;
    let checkpoint = env.checkpoint(batch[0]);
    for (let index = 1; index < batch.length; index++) {
      const next = env.checkpoint(batch[index]);
      if (next === checkpoint) continue;
      commit(batch.slice(start, index));
      start = index;
      checkpoint = next;
    }
    commit(start ? batch.slice(start) : batch);
  };
  const schedule = () => {
    if (!pending.length) return;
    const delay = env.active() ? 100 : 3_000;
    if (timer !== null && delay >= scheduledDelay) return;
    if (timer !== null) env.cancelDelay(timer);
    scheduledDelay = delay;
    timer = env.delay(run, delay);
  };
  return {
    push(records: T[]) {
      for (const record of records) pending.push(record);
      schedule();
    },
    visibilityChanged: schedule,
    cancel() {
      if (timer !== null) env.cancelDelay(timer);
      timer = null;
      pending = [];
      scheduledDelay = Infinity;
    },
  };
}
