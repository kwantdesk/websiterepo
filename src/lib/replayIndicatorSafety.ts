import { canonicalChartIndicatorId, type ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";
import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

/** No current-only data or cross-chart state may impersonate a replay adapter. */
export const REPLAY_UNAVAILABLE_INDICATORS = new Set([
  "pulling-stacking", "absorption-detector", "iceberg-refresh-detector",
  "liquidity-stop-sweep-detector", "cumulative-iceberg-stop", "book-speed",
  "depth-of-market", "mini-dom", "big-blocks-options", "implied-volatility-rank",
  "classic-gex-profile", "expected-move", "gamma-environment", "gamma-levels",
  "net-gamma-exposure-by-strike", "dark-pool-map", "hedge-levels", "tpo-levels",
  "annotations-overlay", "divergence-detector",
]);

export function replaySafeIndicators(indicators: readonly ChartIndicatorInstance[], clock: number | null | undefined) {
  if (clock == null) return indicators as ChartIndicatorInstance[];
  return indicators.map(instance => REPLAY_UNAVAILABLE_INDICATORS.has(canonicalChartIndicatorId(instance.indicatorId))
    ? { ...instance, enabled: false } : instance);
}

export function replayCausalCandles(candles: Candle[], clock: number | null | undefined) {
  return clock == null ? candles : candles.filter(candle => Number.isFinite(candle.timestamp) && candle.timestamp <= clock);
}

export function replayCausalTrades(trades: InstitutionalTrade[], clock: number | null | undefined) {
  // Whole-bar reductions have a bar-open timestamp, not an execution timestamp.
  // Their final distribution cannot be exposed inside a forming replay bar.
  return clock == null ? trades : trades.filter(trade => trade.timestamp <= clock && !trade.flowOnly && !trade.footprintSummary);
}

export function replayRetentionMustReset(previousClock: number | null, clock: number | null) {
  return clock != null && (previousClock == null || clock < previousClock);
}

export function clipReplayIndicatorSeries(series: CalculatedIndicatorSeries[], clock: number | null | undefined) {
  if (clock == null) return series;
  const end = clock / 1_000;
  return series.map(definition => ({
    ...definition,
    data: definition.data.filter(point => Number.isFinite(point.time) && point.time <= end),
    ...(definition.ichimokuCloud ? { ichimokuCloud: {
      ...definition.ichimokuCloud, points: definition.ichimokuCloud.points.filter(point => point.time <= end),
    } } : {}),
    ...(definition.gapZones ? { gapZones: {
      ...definition.gapZones, zones: definition.gapZones.zones.filter(zone => zone.startTime <= end)
        .map(zone => ({ ...zone, endTime: Math.min(zone.endTime, end) })),
    } } : {}),
    ...(definition.zigZagRetracements ? { zigZagRetracements: {
      ...definition.zigZagRetracements, endTime: Math.min(definition.zigZagRetracements.endTime, end),
    } } : {}),
  }));
}
