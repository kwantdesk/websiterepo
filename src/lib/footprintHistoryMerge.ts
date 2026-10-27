import type { Candle } from './backtester';
import type { InstitutionalTrade } from './institutionalMarketData';

/** Exact summaries own only the candle buckets actually returned, never an
 * entire requested time range. Uncovered/newly closed bars keep their tape. */
export function mergeFootprintHistoryRecords(
  exact: readonly InstitutionalTrade[], tape: readonly InstitutionalTrade[],
  candles: readonly Pick<Candle, 'timestamp'>[], intervalMs: number | null,
): InstitutionalTrade[] {
  if (!candles.length) return [];
  const start = candles[0].timestamp;
  const step = intervalMs && intervalMs > 0 ? intervalMs : null;
  const end = step ? candles[candles.length - 1].timestamp + step : Infinity;
  const bucket = (timestamp: number) => start + Math.floor((timestamp - start) / (step || 1)) * (step || 1);
  const history = step ? exact.filter(row => row.footprintSummary && row.timestamp >= start && row.timestamp < end) : [];
  const covered = new Set(history.map(row => bucket(row.timestamp)));
  const live = tape.filter(row => !row.flowOnly && row.timestamp >= start && row.timestamp < end && !covered.has(bucket(row.timestamp)));
  // Both sources are chronological; keep one linear merge on the live path.
  const merged: InstitutionalTrade[] = [];
  let a=0,b=0;
  while (a<history.length || b<live.length) {
    if (b>=live.length || a<history.length && history[a].timestamp<=live[b].timestamp) merged.push(history[a++]);
    else merged.push(live[b++]);
  }
  return merged;
}
