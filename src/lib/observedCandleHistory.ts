import type { Candle } from "./backtester.ts";
import { mergeHistoricalAndLiveCandle, retainFormingCandleExtrema } from "./liveCandleAuthority.ts";

/** Bounded per-chart live observations, never shared across symbol/timeframe/replay. */
export class ObservedCandleHistory {
  private scope = "";
  private firstTimestamp: number | null = null;
  private historyTail: Candle | null = null;
  private bars = new Map<number, { candle: Candle; sourceTime: number }>();
  private readonly limit: number;
  constructor(limit = 2048) { this.limit = Math.max(1, Math.floor(limit)); }

  selectScope(scope: string) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.bars.clear();
    this.firstTimestamp = null;
    this.historyTail = null;
  }

  observe(scope: string, incoming: Candle, sourceTime: number) {
    this.selectScope(scope);
    sourceTime = Number.isFinite(sourceTime) ? sourceTime : incoming.timestamp;
    const previous = this.bars.get(incoming.timestamp);
    const seed = !previous && this.historyTail?.timestamp === incoming.timestamp
      ? this.historyTail : null;
    const merged = retainFormingCandleExtrema(previous?.candle ?? seed, incoming);
    // Older same-bar packets may add a true extremum, but cannot rewind close.
    const candle = previous && sourceTime < previous.sourceTime ? { ...merged, close: previous.candle.close } : merged;
    this.firstTimestamp ??= incoming.timestamp;
    this.bars.set(incoming.timestamp, { candle, sourceTime: Math.max(sourceTime, previous?.sourceTime ?? -Infinity) });
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
      const merged = archived ? mergeHistoricalAndLiveCandle(archived, observed.candle, timestamp, timestamp !== this.firstTimestamp) : observed.candle;
      // An accepted history response can extend a live-observed bar too.
      // Remember that union: otherwise the next stale refresh shrinks its wick
      // back to the smaller direct-tick-only observation.
      this.bars.set(timestamp, { candle: merged, sourceTime: observed.sourceTime });
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
  for (let index = 0; index < Math.min(previous.length, Math.max(0, next.length - 1)); index++) {
    const a = previous[index];
    const b = next[index];
    if (!b || a.timestamp !== b.timestamp || a.open !== b.open || a.high !== b.high || a.low !== b.low || a.close !== b.close) return true;
  }
  return false;
}
