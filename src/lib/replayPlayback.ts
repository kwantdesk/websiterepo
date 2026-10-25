export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120] as const;
export const REPLAY_CLOCK_PUBLISH_MS = 100;

export function replaySpeedLabel(speed: number) {
  return speed === 1 ? "1× · Real time" : `${speed}×`;
}

/** Elapsed market time, never a candle/observation step or guessed price path. */
export function replayTimestampAfterElapsed(timestampMs: number, elapsedMs: number, speed: number, endMs: number) {
  if (![timestampMs, elapsedMs, speed, endMs].every(Number.isFinite) || elapsedMs < 0 || speed <= 0) return timestampMs;
  return Math.min(endMs, timestampMs + elapsedMs * speed);
}

type ReplayTickerRuntime = {
  now: () => number;
  requestFrame: (callback: (time: number) => void) => number;
  cancelFrame: (id: number) => void;
  visible: () => boolean;
};

/** Frame-aligned, bounded UI cadence. Count actual monotonic elapsed time so
 * callback jitter never turns 1× into a slower/faster candle-step mode.
 * Hidden tabs pause instead of replaying a throttled multi-minute catch-up. */
export function startReplayTicker(onElapsed: (elapsedMs: number) => void, onHidden: () => void,
  runtime: ReplayTickerRuntime = {
    now: () => performance.now(),
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: id => window.cancelAnimationFrame(id),
    visible: () => !document.hidden,
  }) {
  let stopped = false;
  let frame = 0;
  let previous = runtime.now();
  const stop = () => {
    if (stopped) return;
    stopped = true;
    runtime.cancelFrame(frame);
  };
  const tick = () => {
    if (stopped) return;
    if (!runtime.visible()) { stop(); onHidden(); return; }
    const now = runtime.now();
    if (now < previous) previous = now;
    const elapsed = now - previous;
    if (elapsed >= REPLAY_CLOCK_PUBLISH_MS) {
      previous = now;
      onElapsed(elapsed);
    }
    if (!stopped) frame = runtime.requestFrame(tick);
  };
  frame = runtime.requestFrame(tick);
  return stop;
}
