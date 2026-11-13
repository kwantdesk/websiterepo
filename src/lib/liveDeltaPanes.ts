import type { Candle } from "@/lib/backtester";
import { calculateIndicatorSeries, type CalculatedIndicatorSeries, type IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { mergeLiveIndicatorTail } from "@/lib/chartLiveEvents";
import { CCI_INDICATOR_ID, cciAverageType, cciPeriods } from "@/lib/commodityChannelIndex";

export const LIVE_DELTA_PANE_INTERVAL_MS = 200;
export const isLiveDeltaPane = (id: string) => ["cumulative-volume-delta", "delta-cumulative-candlestick", "delta-cumulative-histogram", "delta-bar"].includes(id);
export const isLivePriceStudy = (id: string) => id === "standard-deviation"
  || id === "average-true-range-atr" || id === "average-directional-index-adx"
  || id === "awesome-oscillator";
export const isLiveCumulativeVolumeStudy = (id: string) => id === "chaikin-accumulation-distribution";
export const isFullHistoryPriceStudy = (id: string) => id === CCI_INDICATOR_ID;
export type LiveDeltaGroup = { key: string; indicatorId: string; settings?: Record<string, number | string | boolean>; series: CalculatedIndicatorSeries[] };
export type LiveDeltaInputs = { candles: Candle[]; preserveEarlierHistory?: boolean; volumeCandles?: Candle[]; priceCandles?: Candle[]; instrument: string; tickSize: number; theme: IndicatorTheme; mapTime?: (sourceTime: number) => number | undefined };
export const deltaPaneIdentity = (group: LiveDeltaGroup) => JSON.stringify([group.indicatorId, group.settings ?? {}]);

type CciHistory = { identity: string; candles: Candle[]; series: CalculatedIndicatorSeries[] };

function sameCciCandle(previous: Candle, current: Candle) {
  return previous === current || previous.timestamp === current.timestamp
    && Object.is(previous.open, current.open) && Object.is(previous.high, current.high)
    && Object.is(previous.low, current.low) && Object.is(previous.close, current.close);
}

function cciPointBoundary(data: CalculatedIndicatorSeries["data"], time: number, inclusive = false) {
  let first = 0;
  let end = data.length;
  while (first < end) {
    const middle = (first + end) >>> 1;
    if (data[middle].time < time || (inclusive && data[middle].time === time)) first = middle + 1;
    else end = middle;
  }
  return first;
}

/** CCI and its optional SMA only depend on a finite preceding candle window. */
export class CciSeriesCache {
  private readonly entries = new Map<string, CciHistory>();

  retain(keys: readonly string[]) {
    for (const key of this.entries.keys()) if (!keys.includes(key)) this.entries.delete(key);
  }

  calculate(group: Pick<LiveDeltaGroup, "key" | "indicatorId" | "settings">, candles: Candle[], theme: IndicatorTheme) {
    const identity = JSON.stringify([group.indicatorId, group.settings ?? {}, theme]);
    const instance = { indicatorId: group.indicatorId, instanceId: group.key, enabled: true, settings: group.settings ?? {} };
    const prior = this.entries.get(group.key);
    let changed = 0;
    if (prior?.identity === identity) {
      if (prior.candles === candles) return prior.series;
      const shared = Math.min(prior.candles.length, candles.length);
      while (changed < shared && sameCciCandle(prior.candles[changed], candles[changed])) changed++;
    }
    let series: CalculatedIndicatorSeries[];
    if (!prior || changed === 0 || group.settings?.indicatorHistoryMode === "manual") {
      series = calculateIndicatorSeries(instance, candles, theme);
    } else if (changed === candles.length && changed === prior.candles.length) {
      series = prior.series;
    } else if (changed === candles.length) {
      const end = candles[changed - 1].timestamp / 1_000;
      series = prior.series.map(definition => ({
        ...definition, data: definition.data.slice(0, cciPointBoundary(definition.data, end, true)),
      }));
    } else {
      const { length, averageLength } = cciPeriods(instance.settings);
      // Include the preceding window so an invalid candle at the splice can
      // still mark the first valid point as a new line segment.
      // An EMA carries its prior state beyond the finite warm-up window.
      const seed = averageLength && cciAverageType(instance.settings.averageType) === "exponential"
        ? 0 : Math.max(0, changed - length - averageLength);
      const cutoff = Math.min(candles[changed].timestamp, prior.candles[changed]?.timestamp ?? Infinity) / 1_000;
      series = calculateIndicatorSeries(instance, candles.slice(seed), theme).map(definition => {
        const previous = prior.series.find(item => item.key === definition.key)?.data ?? [];
        const prefix = previous.slice(0, cciPointBoundary(previous, cutoff));
        return { ...definition, data: prefix.concat(definition.data.slice(cciPointBoundary(definition.data, cutoff))) };
      });
    }
    this.entries.set(group.key, { identity, candles, series });
    return series;
  }
}

/** Shares the price chart's execution-backed candle events, never another feed.
 * Keeps live bars across a delayed parent history render. Reuses the normal
 * engine so resets, filters, trade-count inputs and delta OHLC stay identical. */
export class LiveDeltaPaneModel {
  private history: Candle[] = [];
  private live: Candle[] = [];
  private source: Candle[] | null = null;
  private preserveEarlierHistory = false;
  readonly cciHistory = new CciSeriesCache();
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
    if (!isLiveDeltaPane(group.indicatorId) && group.indicatorId !== "volume" && !isLivePriceStudy(group.indicatorId)
      && !isLiveCumulativeVolumeStudy(group.indicatorId) && !isFullHistoryPriceStudy(group.indicatorId)) return group.series;
    const instance = { indicatorId: group.indicatorId, instanceId: group.key, enabled: true, settings: group.settings ?? {} };
    const extended = inputs.preserveEarlierHistory && isLiveDeltaPane(group.indicatorId) && !inputs.mapTime
      && group.settings?.indicatorHistoryMode !== "manual";
    const identity = extended ? JSON.stringify([deltaPaneIdentity(group), inputs.theme]) : "";
    const cached = extended ? this.extendedSeries.get(group.key) : undefined;
    let series: CalculatedIndicatorSeries[];
    if (isFullHistoryPriceStudy(group.indicatorId)) {
      series = this.cciHistory.calculate(group, this.history, inputs.theme);
    } else if (cached && cached.source === this.source && cached.identity === identity) {
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
