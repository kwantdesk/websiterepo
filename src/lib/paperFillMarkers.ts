import type { Candle } from './backtester';
import { normalizePaperSymbol, type PaperTradeFill } from './paperTrading';

export type PaperFillMarker = Pick<PaperTradeFill, 'id' | 'price' | 'side' | 'role'> & { time: number };

/** Actual executions only; time chooses the candle, price remains the fill. */
export function buildPaperFillMarkers(
  candles: Candle[], fills: PaperTradeFill[], instrument: string,
  intervalMs: number | null, eventChartTimes?: ReadonlyMap<number, number>,
): PaperFillMarker[] {
  if (!candles.length) return [];
  const symbol = normalizePaperSymbol(instrument);
  const markers = new Map<string, PaperFillMarker>();
  const sourceTime = (candle: Candle) => intervalMs === null
    ? candle.sourceStartTimestamp ?? candle.timestamp : candle.timestamp;
  for (const fill of fills) {
    if (normalizePaperSymbol(fill.symbol) !== symbol || !Number.isFinite(fill.timestamp)
      || !Number.isFinite(fill.price) || fill.price <= 0
      || !['entry', 'take_profit', 'stop_loss', 'manual_close'].includes(fill.role)) continue;
    let low = 0, high = candles.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (sourceTime(candles[mid]) <= fill.timestamp) low = mid + 1;
      else high = mid;
    }
    const candle = candles[low - 1];
    if (!candle) continue;
    // A fill in an absent/new bucket must not be pinned to an older candle.
    // It appears when that real bucket is available, including direct paints.
    if (intervalMs !== null && intervalMs > 0 && fill.timestamp >= candle.timestamp + intervalMs) continue;
    const time = (intervalMs === null ? eventChartTimes?.get(candle.timestamp) : undefined) ?? Math.floor(candle.timestamp / 1000);
    markers.set(fill.id, { id: fill.id, time, price: fill.price, side: fill.side, role: fill.role });
  }
  return [...markers.values()];
}
