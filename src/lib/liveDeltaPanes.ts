import type { Candle } from "@/lib/backtester";
import { calculateIndicatorSeries, type CalculatedIndicatorSeries, type IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { mergeLiveIndicatorTail } from "@/lib/chartLiveEvents";

export const LIVE_DELTA_PANE_INTERVAL_MS = 200;
export const isLiveDeltaPane = (id: string) => ["cumulative-volume-delta", "delta-cumulative-candlestick", "delta-cumulative-histogram", "delta-bar"].includes(id);
export const isLivePriceStudy = (id: string) => id === "standard-deviation"
  || id === "average-true-range-atr" || id === "average-directional-index-adx"
  || id === "awesome-oscillator";
export const isLiveCumulativeVolumeStudy = (id: string) => id === "chaikin-accumulation-distribution";
export type LiveDeltaGroup = { key: string; indicatorId: string; settings?: Record<string, number | string | boolean>; series: CalculatedIndicatorSeries[] };
export type LiveDeltaInputs = { candles: Candle[]; preserveEarlierHistory?: boolean; volumeCandles?: Candle[]; priceCandles?: Candle[]; instrument: string; tickSize: number; theme: IndicatorTheme; mapTime?: (sourceTime: number) => number | undefined };
export const deltaPaneIdentity = (group: LiveDeltaGroup) => JSON.stringify([group.indicatorId, group.settings ?? {}]);

/** Shares the price chart's execution-backed candle events, never another feed.
 * Keeps live bars across a delayed parent history render. Reuses the normal
 * engine so resets, filters, trade-count inputs and delta OHLC stay identical. */
export class LiveDeltaPaneModel {
  private history: Candle[] = [];
  private live: Candle[] = [];
  private source: Candle[] | null = null;
  private preserveEarlierHistory = false;
  private readonly extendedSeries = new Map<string, {
    source: Candle[];
    identity: string;
    start: number;
    prefix: Map<string, CalculatedIndicatorSeries["data"]>;
  }>();
  hydrate(candles: Candle[], preserveEarlierHistory = false) {
    if (this.source === candles && this.preserveEarlierHistory === preserveEarlierHistory) return;
    this.source = candles;
    this.preserveEarlierHistory = preserveEarlierHistory;
    this.history = mergeLiveIndicatorTail(candles, this.live);
  }
  private historyLimit() {
    return Math.max(4000, (this.source?.length ?? 0) + (this.preserveEarlierHistory ? 256 : 0));
  }
  observe(candle: Candle) {
    this.live = mergeLiveIndicatorTail(this.live, [candle]).slice(-256);
    this.history = mergeLiveIndicatorTail(this.history, [candle]);
    const limit = this.historyLimit();
    if (this.history.length > limit) this.history = this.history.slice(-limit);
  }
  observeSnapshot(candles: Candle[], preserveEarlierHistory = false) {
    if (!candles.length || (candles.at(-1)!.timestamp < (this.history.at(-1)?.timestamp ?? -Infinity))) return;
    // A coalesced batch may span more than four second/event bars. Keep every
    // canonical bar in the study window, not just a sampled price tail.
    this.live = mergeLiveIndicatorTail(candles.slice(-256), this.live);
    const limit = this.historyLimit();
    const snapshot = preserveEarlierHistory && this.history[0]?.timestamp < candles[0].timestamp
      ? [...this.history.filter(candle => candle.timestamp < candles[0].timestamp), ...candles].slice(-limit)
      : candles.slice(-limit);
    this.history = mergeLiveIndicatorTail(snapshot, this.live);
  }
  calculate(group: LiveDeltaGroup, inputs: LiveDeltaInputs) {
    if (!isLiveDeltaPane(group.indicatorId) && group.indicatorId !== "volume" && !isLivePriceStudy(group.indicatorId) && !isLiveCumulativeVolumeStudy(group.indicatorId)) return group.series;
    const instance = { indicatorId: group.indicatorId, instanceId: group.key, enabled: true, settings: group.settings ?? {} };
    const extended = inputs.preserveEarlierHistory && isLiveDeltaPane(group.indicatorId) && !inputs.mapTime;
    const identity = extended ? JSON.stringify([deltaPaneIdentity(group), inputs.theme]) : "";
    const cached = extended ? this.extendedSeries.get(group.key) : undefined;
    let series: CalculatedIndicatorSeries[];
    if (cached && cached.source === this.source && cached.identity === identity) {
      const tail = this.history.slice(this.history.findIndex((candle) => candle.timestamp >= cached.start));
      series = calculateIndicatorSeries(instance, tail, inputs.theme, inputs).map((definition) => ({
        ...definition,
        data: [...(cached.prefix.get(definition.key) ?? []), ...definition.data],
      }));
    } else {
      series = calculateIndicatorSeries(instance, this.history, inputs.theme, inputs);
      if (extended && this.source && series.length) {
        // Only cut at a real cumulative reset. Continuous settings with no
        // such boundary keep using the complete series.
        const updateFrom = this.history.at(-257)?.timestamp;
        if (updateFrom != null) {
          const points = series[0].data;
          for (let i = points.length - 1; i >= 0; i--) {
            const point = points[i];
            const startMs = point.time * 1000;
            if (startMs > updateFrom || (group.indicatorId !== "delta-bar" && !point.breakBefore)) continue;
            this.extendedSeries.set(group.key, {
              source: this.source,
              identity,
              start: startMs,
              prefix: new Map(series.map((definition) => [
                definition.key, definition.data.filter((point) => point.time * 1000 < startMs),
              ])),
            });
            break;
          }
        }
      }
    }
    return series.map(definition => ({ ...definition, groupKey: group.key,
      data: inputs.mapTime ? definition.data.flatMap(point => {
        const time = inputs.mapTime!(point.time);
        return time === undefined ? [] : [{ ...point, time }];
      }) : definition.data,
    }));
  }
}
