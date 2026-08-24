/**
 * Bounds the worker -> renderer execution queue.
 *
 * `postMessage` structured-clones its payload and the browser retains every
 * queued clone until the renderer handles it. A busy tape could therefore
 * enqueue a new batch every 40 ms while a chart frame was still folding the
 * previous one. One slow frame became a self-amplifying multi-gigabyte queue.
 *
 * Keep exactly one batch in flight per contract. Further prints remain in the
 * market worker and are coalesced until the renderer acknowledges that batch.
 * The worker's authoritative tape remains the source of truth; this is only a
 * bounded delivery window between the worker and the renderer.
 */
export const MAX_PENDING_WORKER_TRADE_RECORDS = 25_000;

type PublishState<T> = {
  inFlight: boolean;
  pending: T[];
};

export function createWorkerTradeBackpressure<T>(
  send: (key: string, records: T[]) => void,
  maximumPending = MAX_PENDING_WORKER_TRADE_RECORDS,
) {
  const states = new Map<string, PublishState<T>>();

  const stateFor = (key: string) => {
    let state = states.get(key);
    if (!state) {
      state = { inFlight: false, pending: [] };
      states.set(key, state);
    }
    return state;
  };

  const appendBounded = (target: T[], records: T[]) => {
    if (!records.length) return;
    if (records.length >= maximumPending) {
      target.length = 0;
      for (let index = records.length - maximumPending; index < records.length; index += 1) {
        target.push(records[index]);
      }
      return;
    }
    const overflow = target.length + records.length - maximumPending;
    if (overflow > 0) target.splice(0, overflow);
    for (const record of records) target.push(record);
  };

  const sendNext = (key: string, state: PublishState<T>) => {
    if (state.inFlight || !state.pending.length) return;
    const records = state.pending;
    state.pending = [];
    state.inFlight = true;
    send(key, records);
  };

  return {
    publish(key: string, records: T[]) {
      if (!records.length) return;
      const state = stateFor(key);
      if (!state.inFlight && !state.pending.length) {
        state.inFlight = true;
        send(key, records);
        return;
      }
      appendBounded(state.pending, records);
    },
    acknowledge(key: string) {
      const state = states.get(key);
      if (!state) return;
      state.inFlight = false;
      sendNext(key, state);
    },
    remove(key: string) {
      states.delete(key);
    },
    clear() {
      states.clear();
    },
    pendingCount(key: string) {
      return states.get(key)?.pending.length ?? 0;
    },
    hasInFlight(key: string) {
      return states.get(key)?.inFlight ?? false;
    },
  };
}
