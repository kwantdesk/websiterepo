import type { Candle } from "./backtester.ts";
import { mergeHistoricalAndLiveCandle, retainFormingCandleExtrema } from "./liveCandleAuthority.ts";

/** Bounded per-chart live observations, never shared across symbol/timeframe/replay. */
export class ObservedCandleHistory {
  private scope = "";
  private firstTimestamp: number | null = null;
  private historyTail: Candle | null = null;
  private latestTimestamp = -Infinity;
  private bars = new Map<number, { candle: Candle; sourceTime: number; seededOpen: boolean }>();
  private readonly limit: number;
  constructor(limit = 2048) { this.limit = Math.max(1, Math.floor(limit)); }

  selectScope(scope: string) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.bars.clear();
    this.firstTimestamp = null;
    this.historyTail = null;
    this.latestTimestamp = -Infinity;
  }

  observe(scope: string, incoming: Candle, sourceTime: number) {
    this.selectScope(scope);
    sourceTime = Number.isFinite(sourceTime) ? sourceTime : incoming.timestamp;
    const previous = this.bars.get(incoming.timestamp);
    // A receipt time stamped after a known rollover is not an exchange close
    // watermark for an older candle. Do not let it poison the saved clock.
    let invalidClosedClock = false;
    if (previous && incoming.timestamp < this.latestTimestamp) {
      let nextBucket = Infinity;
      for (const timestamp of this.bars.keys()) if (timestamp > incoming.timestamp) nextBucket = Math.min(nextBucket, timestamp);
      invalidClosedClock = sourceTime >= nextBucket;
    }
    const seed = !previous && this.historyTail?.timestamp === incoming.timestamp
      ? this.historyTail : null;
    const merged = retainFormingCandleExtrema(previous?.candle ?? seed, incoming);
    // Older same-bar packets may add a true extremum, but cannot rewind close.
    const candle = previous && (sourceTime < previous.sourceTime || invalidClosedClock) ? { ...merged, close: previous.candle.close } : merged;
    this.firstTimestamp ??= incoming.timestamp;
    this.latestTimestamp = Math.max(this.latestTimestamp, incoming.timestamp);
    this.bars.set(incoming.timestamp, { candle, seededOpen: previous?.seededOpen ?? Boolean(seed), sourceTime: invalidClosedClock ? previous!.sourceTime : Math.max(sourceTime, previous?.sourceTime ?? -Infinity) });
    while (this.bars.size > this.limit) this.bars.delete(this.bars.keys().next().value!);
    return candle;
  }

  merge(scope: string, history: Candle[]) {
    this.selectScope(scope);
    // The first live packet may arrive halfway through a history-seeded bar.
    // Keep its already known open/extrema, not just the ticks received later.
    this.historyTail = history.at(-1) ?? this.historyTail;
    if (!this.bars.size) return history;
    // History is already sorted. Search only our bounded observations and
    // copy lazily: a 1s chart can carry hundreds of thousands of older bars.
    // Building/sorting a Map of that whole history on every bar would hitch.
    let result = history;
    for (const [timestamp, observed] of this.bars) {
      let low = 0;
      let high = result.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (result[middle].timestamp < timestamp) low = middle + 1;
        else high = middle;
      }
      const archived = result[low]?.timestamp === timestamp ? result[low] : null;
      const merged = archived ? mergeHistoricalAndLiveCandle(archived, observed.candle, timestamp,
        timestamp !== this.firstTimestamp || timestamp < this.latestTimestamp && observed.seededOpen) : observed.candle;
      // An accepted history response can extend a live-observed bar too.
      // Remember that union: otherwise the next stale refresh shrinks its wick
      // back to the smaller direct-tick-only observation.
      this.bars.set(timestamp, { candle: merged, sourceTime: observed.sourceTime, seededOpen: observed.seededOpen || Boolean(archived) });
      if (archived && archived.open === merged.open && archived.high === merged.high && archived.low === merged.low && archived.close === merged.close && archived.volume === merged.volume) continue;
      if (result === history) result = [...history];
      if (archived) result[low] = merged;
      else result.splice(low, 0, merged);
    }
    return result;
  }
}

/** series.update can append one bar, not repair earlier OHLC or fill skipped bars. */
export function clockCandleHistoryNeedsRedraw(previous: Candle[], next: Candle[]) {
  if (!previous.length || next.length < previous.length || next.length > previous.length + 1) return true;
  if (next.length === previous.length + 1 && previous.at(-1)?.timestamp !== next.at(-2)?.timestamp) return true;
  // The previous tail can receive its final print in the same React batch as
  // the next bar opens. Both can be updated in place; it is not a history reset.
  for (let index = 0; index < Math.max(0, previous.length - 1); index++) {
    const a = previous[index];
    const b = next[index];
    if (!b || a.timestamp !== b.timestamp || a.open !== b.open || a.high !== b.high || a.low !== b.low || a.close !== b.close) return true;
  }
  return false;
}

/** Only interior timestamp changes invalidate the drawing projection. OHLC
 * corrections, tail appends and prefix trimming retain an affine timeline. */
export function clockCandleTimelineChanged(previous: Candle[], next: Candle[]) {
  if (!previous.length || !next.length) return previous.length !== next.length;
  let left = 0;
  let right = 0;
  while (left < previous.length && previous[left].timestamp < next[0].timestamp) left++;
  while (right < next.length && next[right].timestamp < previous[0].timestamp) right++;
  if (left === previous.length || right === next.length) return true;
  while (left < previous.length && right < next.length) {
    if (previous[left++].timestamp !== next[right++].timestamp) return true;
  }
  return false;
}
