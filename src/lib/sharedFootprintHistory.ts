import type { FootprintHistoryWindow } from "./compactFootprintHistory";

type Entry = {
  controller: AbortController;
  users: number;
  done: boolean;
  promise: Promise<FootprintHistoryWindow>;
};
const pending = new Map<string, Entry>();
const cache = new Map<string, {at: number; result: FootprintHistoryWindow}>();
const MAX_RECORDS = 50_000;

/** Coalesce identical validated footprint windows across panes/remounts.
 * Keys include full OHLCV/filter identity, never just instrument/timeframe. */
export function loadSharedFootprintHistory(
  key: string,
  load: (signal: AbortSignal) => Promise<FootprintHistoryWindow>,
  owner: AbortSignal,
): Promise<FootprintHistoryWindow> {
  if (owner.aborted) return Promise.reject(owner.reason);
  for (const [id, item] of cache) if (Date.now() - item.at > 60_000) cache.delete(id);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached.result);
  let entry = pending.get(key);
  if (!entry) {
    const controller = new AbortController();
    entry = {controller, users: 0, done: false, promise: Promise.resolve({records: [], missingTimestamps: [], totalBars: 0})};
    const current = entry;
    current.promise = Promise.resolve().then(() => load(controller.signal)).then(result => {
      if (!controller.signal.aborted && !result.missingTimestamps.length && result.records.length && result.records.length <= MAX_RECORDS) {
        cache.set(key, {at: Date.now(), result});
        let count = [...cache.values()].reduce((sum, value) => sum + value.result.records.length, 0);
        while (cache.size > 4 || count > MAX_RECORDS) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          count -= cache.get(oldest)!.result.records.length;
          cache.delete(oldest);
        }
      }
      return result;
    }).finally(() => {
      current.done = true;
      if (pending.get(key) === current) pending.delete(key);
    });
    pending.set(key, current);
  }
  const shared = entry;
  shared.users++;
  return new Promise((resolve, reject) => {
    let released = false;
    const release = () => {
      if (released) return false;
      released = true;
      owner.removeEventListener("abort", abort);
      shared.users--;
      if (!shared.users && !shared.done) {
        if (pending.get(key) === shared) pending.delete(key);
        shared.controller.abort();
      }
      return true;
    };
    const abort = () => { if (release()) reject(owner.reason); };
    owner.addEventListener("abort", abort, {once: true});
    shared.promise.then(
      records => { if (release()) resolve(records); },
      error => { if (release()) reject(error); },
    );
  });
}
