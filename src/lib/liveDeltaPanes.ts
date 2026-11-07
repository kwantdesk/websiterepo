import type { Candle } from "@/lib/backtester";
import { calculateIndicatorSeries, type CalculatedIndicatorSeries, type IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { mergeLiveIndicatorTail } from "@/lib/chartLiveEvents";

export const LIVE_DELTA_PANE_INTERVAL_MS = 200;
export const isLiveDeltaPane = (id: string) => ["cumulative-volume-delta", "delta-cumulative-candlestick", "delta-cumulative-histogram", "delta-bar"].includes(id);
export type LiveDeltaGroup = { key: string; indicatorId: string; settings?: Record<string, number | string | boolean>; series: CalculatedIndicatorSeries[] };
export type LiveDeltaInputs = { candles: Candle[]; volumeCandles?: Candle[]; priceCandles?: Candle[]; instrument: string; tickSize: number; theme: IndicatorTheme; mapTime?: (sourceTime: number) => number | undefined };
export const deltaPaneIdentity = (group: LiveDeltaGroup) => JSON.stringify([group.indicatorId, group.settings ?? {}]);

/** Shares the price chart's execution-backed candle events, never another feed.
 * Keeps live bars across a delayed parent history render. Reuses the normal
 * engine so resets, filters, trade-count inputs and delta OHLC stay identical. */
export class LiveDeltaPaneModel {
  private history: Candle[] = [];
  private live: Candle[] = [];
  private source: Candle[] | null = null;
  hydrate(candles: Candle[]) {
    if (this.source === candles) return;
    this.source = candles;
    this.history = mergeLiveIndicatorTail(candles, this.live);
  }
  observe(candle: Candle) {
    this.live = mergeLiveIndicatorTail(this.live, [candle]).slice(-256);
    this.history = mergeLiveIndicatorTail(this.history, [candle]);
    const limit = Math.max(4000, this.source?.length ?? 0);
    if (this.history.length > limit) this.history = this.history.slice(-limit);
  }
  observeSnapshot(candles: Candle[], preserveEarlierHistory = false) {
    if (!candles.length || (candles.at(-1)!.timestamp < (this.history.at(-1)?.timestamp ?? -Infinity))) return;
    // A coalesced batch may span more than four second/event bars. Keep every
    // canonical bar in the study window, not just a sampled price tail.
    this.live = mergeLiveIndicatorTail(candles.slice(-256), this.live);
    const limit = Math.max(4000, this.source?.length ?? 0);
    const snapshot = preserveEarlierHistory && this.history[0]?.timestamp < candles[0].timestamp
      ? [...this.history.filter(candle => candle.timestamp < candles[0].timestamp), ...candles].slice(-limit)
      : candles.slice(-limit);
    this.history = mergeLiveIndicatorTail(snapshot, this.live);
  }
  calculate(group: LiveDeltaGroup, inputs: LiveDeltaInputs) {
    if (!isLiveDeltaPane(group.indicatorId) && !["volume", "standard-deviation", "average-true-range-atr"].includes(group.indicatorId)) return group.series;
    const series = calculateIndicatorSeries({ indicatorId: group.indicatorId, instanceId: group.key,
      enabled: true, settings: group.settings ?? {} }, this.history, inputs.theme, inputs);
    return series.map(definition => ({ ...definition, groupKey: group.key,
      data: inputs.mapTime ? definition.data.flatMap(point => {
        const time = inputs.mapTime!(point.time);
        return time === undefined ? [] : [{ ...point, time }];
      }) : definition.data,
    }));
  }
}
