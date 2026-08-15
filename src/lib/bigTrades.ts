import type { Candle } from "@/lib/backtester";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type BigTradePrint = {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
  radius: number;
  opacity: number;
};

export type AnchoredBigTradePrint = BigTradePrint & { chartTimestamp: number };

type BigTradeSettings = Record<string, number | string | boolean>;

type TradeCandidate = {
  id: string;
  timestamp: number;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function quantile(sorted: number[], percentile: number) {
  if (!sorted.length) return 0;
  const position = clamp(percentile, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function tradeCandidates(
  _candles: Candle[],
  marketTrades: InstitutionalTrade[],
  cutoff: number,
  settings: BigTradeSettings,
): TradeCandidate[] {
  // This is an execution-tape study. Candle volume is never treated as one
  // large order; only real CME trade records are eligible.
  const liveCandidates = marketTrades.flatMap((trade) => {
    if (
      trade.flowOnly
      || trade.timestamp < cutoff
      || trade.volume <= 0
      || trade.aggressor === "UNKNOWN"
    ) return [];
    return [{
      id: trade.eventId ?? `record-${trade.recordIndex}`,
      timestamp: trade.timestamp,
      price: trade.close,
      volume: trade.volume,
      executions: Math.max(1, trade.trades),
      side: trade.aggressor === "BUY" ? "ASK" as const : "BID" as const,
    }];
  });
  if (settings.enableClustering === false || liveCandidates.length < 2) {
    return liveCandidates;
  }

  const clusterWindowMs = clamp(Number(settings.clusterWindowMs ?? 100), 0, 10_000);
  const clusterPriceTicks = clamp(Number(settings.clusterPriceTicks ?? 0), 0, 100);
  const tickSize = Math.max(Number(settings.tickSize ?? 0.25), Number.EPSILON);
  const priceTolerance = clusterPriceTicks * tickSize + Number.EPSILON;
  const clustered: TradeCandidate[] = [];
  liveCandidates
    .sort((left, right) => left.timestamp - right.timestamp)
    .forEach((candidate) => {
      const previous = clustered.at(-1);
      if (
        previous
        && previous.side === candidate.side
        && candidate.timestamp - previous.timestamp <= clusterWindowMs
        && Math.abs(candidate.price - previous.price) <= priceTolerance
      ) {
        const combinedVolume = previous.volume + candidate.volume;
        previous.price = (
          previous.price * previous.volume + candidate.price * candidate.volume
        ) / combinedVolume;
        previous.volume = combinedVolume;
        previous.executions += candidate.executions;
        previous.timestamp = candidate.timestamp;
        previous.id = `${previous.id}:${candidate.id}`;
        return;
      }
      clustered.push({ ...candidate });
    });
  return clustered;
}

export function calculateBigTradePrints(
  orderFlowCandles: Candle[],
  marketTrades: InstitutionalTrade[],
  settings: BigTradeSettings,
  now = Date.now(),
): BigTradePrint[] {
  const daysToLoad = clamp(Number(settings.daysToLoad ?? 1), 1, 90);
  const cutoff = now - daysToLoad * 86_400_000;
  const candidates = tradeCandidates(orderFlowCandles, marketTrades, cutoff, settings);
  if (!candidates.length) return [];
  const volumes = candidates.map((candidate) => candidate.volume).sort((left, right) => left - right);
  const filterMode = String(settings.filterMode ?? "automatic");
  const intensity = String(settings.automaticIntensity ?? "medium");
  const automaticPercentile = intensity === "low" ? 0.8 : intensity === "strong" ? 0.975 : 0.9;
  const threshold = filterMode === "manual"
    ? clamp(Number(settings.manualFilter ?? 30), 1, 100)
    : quantile(volumes, automaticPercentile);
  const maximumFilter = Math.max(0, Number(settings.maximumFilter ?? 0));
  const qualified = candidates.filter((candidate) =>
    candidate.volume >= threshold && (maximumFilter === 0 || candidate.volume <= maximumFilter));
  if (!qualified.length) return [];
  const qualifiedVolumes = qualified.map((candidate) => candidate.volume);
  const mean = qualifiedVolumes.reduce((total, value) => total + value, 0) / qualifiedVolumes.length;
  const deviation = Math.sqrt(
    qualifiedVolumes.reduce((total, value) => total + (value - mean) ** 2, 0) / qualifiedVolumes.length,
  );
  const standardDevScale = Math.max(0.1, Number(settings.standardDeviation ?? 1));
  const minSize = clamp(Number(settings.minimumSize ?? 6), 1, 80);
  const maxSize = Math.max(minSize, clamp(Number(settings.maximumSize ?? 32), 1, 160));
  const minOpacity = clamp(Number(settings.minimumOpacity ?? 25) / 100, 0, 1);
  const maxOpacity = Math.max(minOpacity, clamp(Number(settings.maximumOpacity ?? 90) / 100, 0, 1));
  const sortedQualifiedVolumes = [...qualifiedVolumes].sort((left, right) => left - right);
  const visualCeiling = Math.max(
    threshold + 1,
    threshold + deviation * standardDevScale,
    quantile(sortedQualifiedVolumes, 0.95),
  );
  const visualRange = Math.max(1, visualCeiling - threshold);

  // Keep the qualified history across the loaded chart. The former 2,500
  // tail cap made older bars lose their prints even though the execution tape
  // was present; 12,000 remains bounded while covering the adaptive top decile
  // of the retained, time-distributed execution history.
  return qualified.slice(-12_000).map((candidate) => {
    const significance = clamp((candidate.volume - threshold) / visualRange, 0, 1);
    const visualWeight = Math.sqrt(significance);
    return {
      ...candidate,
      radius: minSize + (maxSize - minSize) * visualWeight,
      opacity: minOpacity + (maxOpacity - minOpacity) * visualWeight,
    };
  });
}

/**
 * Project exact execution timestamps onto the selected chart's bars.
 *
 * This deliberately uses bar boundaries rather than a clock interval, so the
 * same 24-hour tape can be recalculated correctly for time, volume, range,
 * tick, delta-volume and Renko charts.
 */
export function anchorBigTradePrintsToCandles(
  prints: BigTradePrint[],
  candles: Candle[],
): AnchoredBigTradePrint[] {
  if (!candles.length || !prints.length) return [];
  const firstTimestamp = candles[0].timestamp;
  return prints.flatMap((print): AnchoredBigTradePrint[] => {
    if (print.timestamp < firstTimestamp) return [];
    let low = 0;
    let high = candles.length - 1;
    let anchorIndex = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (candles[middle].timestamp <= print.timestamp) {
        anchorIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return [{ ...print, chartTimestamp: candles[anchorIndex].timestamp }];
  });
}
