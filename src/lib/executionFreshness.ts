/** A heartbeat proves socket activity, not delivery of known executions. */
export function createExecutionFreshnessGuard(env: {
  now: () => number;
  latestExecution: () => number;
  recover: () => void;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (handle: number) => void;
}) {
  let timer: number | null = null;
  let witnessed = 0;
  let recoveredThrough = 0;
  let lastRecovery = -Infinity;
  const check = () => {
    timer = null;
    if (witnessed <= env.latestExecution() || witnessed <= recoveredThrough) return;
    const remaining = 15_000 - (env.now() - lastRecovery);
    if (remaining > 0) { timer = env.schedule(check, remaining); return; }
    recoveredThrough = witnessed;
    lastRecovery = env.now();
    env.recover();
  };
  return {
    witness(timestamp: number) {
      if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > env.now() + 1000
        || env.now() - timestamp > 5000) return;
      witnessed = Math.max(witnessed, timestamp);
      if (witnessed <= env.latestExecution() || witnessed <= recoveredThrough || timer !== null) return;
      // Allow normal worker decoding, backpressure and one display frame to
      // catch up. Further quotes cannot postpone this deadline indefinitely.
      timer = env.schedule(check, 1000);
    },
    dispose() { if (timer !== null) env.cancel(timer); timer = null; },
  };
}
