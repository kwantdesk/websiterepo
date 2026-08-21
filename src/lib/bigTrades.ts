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

/**
 * Reproduce the chart's unique time coordinate for event bars.
 *
 * Volume/range/tick bars can start inside the same wall-clock second. The
 * chart separates those bars by one synthetic second so Lightweight Charts
 * can retain every candle. Markers must use that same projection; using the
 * raw rounded second can otherwise attach a print to the preceding candle.
 */
export function buildEventBarChartTimeMap(
  candles: Pick<Candle, "timestamp">[],
) {
  const chartTimeBySourceTime = new Map<number, number>();
  let previousChartTime = Number.NEGATIVE_INFINITY;

  for (const candle of candles) {
    const sourceTimestamp = Number(candle.timestamp);
    const naturalTime = Math.floor(sourceTimestamp / 1_000);
    if (!Number.isFinite(sourceTimestamp) || !Number.isFinite(naturalTime)) continue;
    const chartTime = Math.max(naturalTime, previousChartTime + 1);
    previousChartTime = chartTime;
    chartTimeBySourceTime.set(sourceTimestamp, chartTime);
  }

  return chartTimeBySourceTime;
}

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
  const liveCandidates: TradeCandidate[] = [];
  let monotonic = true;
  let previousTimestamp = Number.NEGATIVE_INFINITY;
  for (const trade of marketTrades) {
    if (
      trade.flowOnly
      || trade.timestamp < cutoff
      || trade.volume <= 0
      || trade.aggressor === "UNKNOWN"
    ) continue;
    monotonic = monotonic && trade.timestamp >= previousTimestamp;
    previousTimestamp = trade.timestamp;
    liveCandidates.push({
      id: trade.eventId ?? `record-${trade.recordIndex}`,
      timestamp: trade.timestamp,
      price: trade.close,
      volume: trade.volume,
      executions: Math.max(1, trade.trades),
      side: trade.aggressor === "BUY" ? "ASK" as const : "BID" as const,
    });
  }
  if (!monotonic) liveCandidates.sort((left, right) => left.timestamp - right.timestamp);
  if (settings.enableClustering === false || liveCandidates.length < 2) {
    return liveCandidates;
  }

  const clusterWindowMs = clamp(Number(settings.clusterWindowMs ?? 100), 0, 10_000);
  const clusterPriceTicks = clamp(Number(settings.clusterPriceTicks ?? 0), 0, 100);
  const tickSize = Math.max(Number(settings.tickSize ?? 0.25), Number.EPSILON);
  const priceTolerance = clusterPriceTicks * tickSize + Number.EPSILON;
  const clustered: TradeCandidate[] = [];
  liveCandidates.forEach((candidate) => {
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

// Mirrors the workspace tape's own compaction window: beyond this the retained
// history is a strongest-prints-per-minute sample, not a complete record.
const COMPLETE_TAPE_WINDOW_MS = 15 * 60_000;

/**
 * Upper bound for the manual minimum trade size, in contracts. Far above any
 * real single or clustered CME index-futures print, so the setting behaves as
 * a free numeric entry while still rejecting nonsense.
 */
export const MANUAL_FILTER_CEILING = 5_000;

export function calculateBigTradePrints(
  orderFlowCandles: Candle[],
  marketTrades: InstitutionalTrade[],
  settings: BigTradeSettings,
  now = Date.now(),
): BigTradePrint[] {
  const daysToLoad = clamp(Number(settings.daysToLoad ?? 1), 1, 90);
  // Anchor the lookback to the newest execution we actually possess. CME is
  // closed over the weekend and on exchange holidays, so a wall-clock cutoff
  // can erase Friday's entire tape on Sunday even though it is still the most
  // recent market session. During live trading the newest execution tracks
  // `now`, while closed markets retain the final completed session.
  let latestExecutionTimestamp = 0;
  for (let index = marketTrades.length - 1; index >= 0; index -= 1) {
    const timestamp = marketTrades[index].timestamp;
    if (!Number.isFinite(timestamp)) continue;
    latestExecutionTimestamp = timestamp;
    break;
  }
  const marketTapeIsClosed = latestExecutionTimestamp > 0
    && now - latestExecutionTimestamp > 6 * 60 * 60_000;
  const historyAnchor = marketTapeIsClosed
    ? latestExecutionTimestamp
    : now;
  const cutoff = historyAnchor - daysToLoad * 86_400_000;
  const candidates = tradeCandidates(orderFlowCandles, marketTrades, cutoff, settings);
  if (!candidates.length) return [];
  // The automatic threshold must be measured against FULL-FIDELITY prints.
  // Beyond the browser's complete-tape window the retained history keeps only
  // the strongest prints per minute, so widening "Days to load" fed the
  // percentile a sample made almost entirely of large prints — the threshold
  // rocketed and nothing qualified any more, which is why raising the setting
  // made every marker disappear. Measure on the recent complete region and
  // apply that threshold across the whole window.
  const newestCandidate = candidates[candidates.length - 1]?.timestamp ?? historyAnchor;
  const completeFrom = newestCandidate - COMPLETE_TAPE_WINDOW_MS;
  const completeCandidates = candidates.filter((candidate) => candidate.timestamp >= completeFrom);
  const thresholdSample = completeCandidates.length >= 50 ? completeCandidates : candidates;
  const volumes = thresholdSample.map((candidate) => candidate.volume).sort((left, right) => left - right);
  const filterMode = String(settings.filterMode ?? "automatic");
  const intensity = String(settings.automaticIntensity ?? "medium");
  const automaticPercentile = intensity === "low" ? 0.8 : intensity === "strong" ? 0.975 : 0.9;
  // A manual minimum is the trader's own floor and must be honoured exactly.
  // It used to be clamped to 100 contracts, so asking for 250-lot prints
  // silently kept showing 100-lot ones.
  const threshold = filterMode === "manual"
    ? clamp(Number(settings.manualFilter ?? 30), 1, MANUAL_FILTER_CEILING)
    : quantile(volumes, automaticPercentile);
  const maximumFilter = Math.max(0, Number(settings.maximumFilter ?? 0));
  const qualified = candidates.filter((candidate) =>
    candidate.volume >= threshold && (maximumFilter === 0 || candidate.volume <= maximumFilter));
  if (!qualified.length) return [];
  const standardDevScale = Math.max(0.1, Number(settings.standardDeviation ?? 1));
  const minSize = clamp(Number(settings.minimumSize ?? 6), 1, 80);
  const maxSize = Math.max(minSize, clamp(Number(settings.maximumSize ?? 32), 1, 160));
  const minOpacity = clamp(Number(settings.minimumOpacity ?? 25) / 100, 0, 1);
  const maxOpacity = Math.max(minOpacity, clamp(Number(settings.maximumOpacity ?? 90) / 100, 0, 1));

  // Marker size describes the TRADE, never the filter.
  //
  // Both ends of the old scale were derived from the active threshold: the
  // floor was the threshold itself and the ceiling came from the surviving
  // prints' own spread. Raising a manual minimum therefore re-normalised
  // everything still on screen — the same 300-lot trade drew visibly smaller
  // purely because the filter had moved, which is why the setting looked like
  // it was "just shrinking the nodes" instead of filtering.
  //
  // The scale is now measured from the tape's own distribution, which does not
  // move when the trader changes the minimum. In automatic mode the floor is
  // still exactly the threshold (both are the same percentile), so that mode
  // is unchanged; in manual mode the minimum now only decides WHICH prints
  // appear, never how big they draw.
  const sizeFloor = quantile(volumes, automaticPercentile);
  const tapeMean = volumes.reduce((total, value) => total + value, 0) / volumes.length;
  const tapeDeviation = Math.sqrt(
    volumes.reduce((total, value) => total + (value - tapeMean) ** 2, 0) / volumes.length,
  );
  const visualCeiling = Math.max(
    sizeFloor + 1,
    sizeFloor + tapeDeviation * standardDevScale,
    quantile(volumes, 0.99),
  );
  const visualRange = Math.max(1, visualCeiling - sizeFloor);

  // Keep the qualified history across the loaded chart. The former 2,500
  // tail cap made older bars lose their prints even though the execution tape
  // was present; 12,000 remains bounded while covering the adaptive top decile
  // of the retained, time-distributed execution history.
  return qualified.slice(-12_000).map((candidate) => {
    const significance = clamp((candidate.volume - sizeFloor) / visualRange, 0, 1);
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
  const anchored: AnchoredBigTradePrint[] = [];
  let candleIndex = 0;
  for (const print of prints) {
    if (print.timestamp < firstTimestamp) continue;
    while (
      candleIndex + 1 < candles.length
      && candles[candleIndex + 1].timestamp <= print.timestamp
    ) candleIndex += 1;
    anchored.push({ ...print, chartTimestamp: candles[candleIndex].timestamp });
  }
  return anchored;
}
