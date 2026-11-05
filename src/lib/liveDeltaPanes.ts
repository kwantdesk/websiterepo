import type { Candle } from "@/lib/backtester";
import { calculateIndicatorSeries, type CalculatedIndicatorSeries, type IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { mergeLiveIndicatorTail } from "@/lib/chartLiveEvents";

export const LIVE_DELTA_PANE_INTERVAL_MS = 200;
export const isLiveDeltaPane = (id: string) => ["cumulative-volume-delta", "delta-cumulative-candlestick", "delta-cumulative-histogram", "delta-bar"].includes(id);
export type LiveDeltaGroup = { key: string; indicatorId: string; settings?: Record<string, number | string | boolean>; series: CalculatedIndicatorSeries[] };
export type LiveDeltaInputs = { candles: Candle[]; instrument: string; tickSize: number; theme: IndicatorTheme; mapTime?: (sourceTime: number) => number | undefined };
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
  calculate(group: LiveDeltaGroup, inputs: LiveDeltaInputs) {
    if (!isLiveDeltaPane(group.indicatorId)) return group.series;
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
