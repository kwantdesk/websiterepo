/**
 * Bounds the worker -> renderer execution queue.
 *
 * `postMessage` structured-clones its payload and the browser retains every
 * queued clone until the renderer handles it. A busy tape could therefore
 * enqueue a new batch every 40 ms while a chart frame was still folding the
 * previous one. One slow frame became a self-amplifying multi-gigabyte queue.
 *
 * Keep exactly one bounded batch in flight per contract. Further prints remain
 * in the market worker and are delivered in order after the renderer
 * acknowledges that batch. Never discard the front of this queue: those are
 * real executions and dropping them creates holes in CVD during the exact
 * aggressive bursts this backpressure is meant to survive.
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

  const appendLossless = (target: T[], records: T[]) => {
    for (const record of records) target.push(record);
  };

  const sendNext = (key: string, state: PublishState<T>) => {
    if (state.inFlight || !state.pending.length) return;
    const records = state.pending.splice(0, maximumPending);
    state.inFlight = true;
    send(key, records);
  };

  return {
    publish(key: string, records: T[]) {
      if (!records.length) return;
      const state = stateFor(key);
      appendLossless(state.pending, records);
      sendNext(key, state);
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
