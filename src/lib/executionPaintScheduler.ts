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
