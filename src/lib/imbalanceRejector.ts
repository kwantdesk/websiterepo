import type { Candle } from "@/lib/backtester";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type ImbalanceRejectorSignal = {
  id: string;
  side: "BULLISH" | "BEARISH";
  candleIndex: number;
  timestamp: number;
  price: number;
  imbalancePercent: number;
  comparisonDepth: number;
};

type PriceLevel = { bid: number; ask: number };

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function candleIndexForTimestamp(candles: Candle[], timestamp: number) {
  let low = 0;
  let high = candles.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (candles[middle].timestamp <= timestamp) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (result < 0) return -1;
  const nextTimestamp = candles[result + 1]?.timestamp;
  return nextTimestamp == null || timestamp < nextTimestamp ? result : -1;
}

function buildPriceLevels(candles: Candle[], records: InstitutionalTrade[], tickSize: number) {
  const levelsByBar = new Map<number, Map<number, PriceLevel>>();
  records.forEach((record) => {
    const candleIndex = candleIndexForTimestamp(candles, record.timestamp);
    if (candleIndex < 0) return;
    const tick = Math.round(record.close / tickSize);
    const levels = levelsByBar.get(candleIndex) ?? new Map<number, PriceLevel>();
    const level = levels.get(tick) ?? { bid: 0, ask: 0 };
    level.bid += Math.max(0, finite(record.bidVolume));
    level.ask += Math.max(0, finite(record.askVolume));
    levels.set(tick, level);
    levelsByBar.set(candleIndex, levels);
  });
  return levelsByBar;
}

function imbalancePercent(numerator: number, denominator: number, includeZero: boolean) {
  if (numerator <= 0) return null;
  if (denominator <= 0) return includeZero ? Number.POSITIVE_INFINITY : null;
  return numerator / denominator * 100;
}

export function calculateImbalanceRejectorSignals(
  candles: Candle[],
  records: InstitutionalTrade[],
  instance: ChartIndicatorInstance,
  tickSize: number,
) {
  if (!instance.enabled || instance.indicatorId !== "imbalance-rejector") return [];
  if (!candles.length || !records.length || !Number.isFinite(tickSize) || tickSize <= 0) return [];
  const settings = instance.settings ?? {};
  const minimumPercent = Math.max(100, finite(settings.minimumPercent, 300));
  const comparisonDepth = Math.max(1, Math.round(finite(settings.comparisonDepth, 1)));
  const lookbackPeriod = Math.max(1, Math.round(finite(settings.lookbackPeriod, 5)));
  const tickOffset = Math.max(0, finite(settings.tickOffset, 2));
  const includeZero = settings.includeZero === true;
  const lastEligibleIndex = settings.confirmedOnly !== false ? candles.length - 2 : candles.length - 1;
  const levelsByBar = buildPriceLevels(candles, records, tickSize);
  const signals: ImbalanceRejectorSignal[] = [];

  for (let candleIndex = lookbackPeriod; candleIndex <= lastEligibleIndex; candleIndex += 1) {
    const candle = candles[candleIndex];
    const levels = levelsByBar.get(candleIndex);
    if (!candle || !levels?.size) continue;
    const lookback = candles.slice(candleIndex - lookbackPeriod, candleIndex);
    const bearishRejection = candle.close < candle.open
      && lookback.every((candidate) => candle.high > candidate.high);
    const bullishRejection = candle.close > candle.open
      && lookback.every((candidate) => candle.low < candidate.low);
    if (!bearishRejection && !bullishRejection) continue;

    let strongestPercent = 0;
    let strongestDepth = 0;
    for (let depth = 0; depth < comparisonDepth; depth += 1) {
      if (bearishRejection) {
        const askTick = Math.round(candle.high / tickSize) - depth;
        const percent = imbalancePercent(
          levels.get(askTick)?.ask ?? 0,
          levels.get(askTick - 1)?.bid ?? 0,
          includeZero,
        );
        if (percent != null && percent >= minimumPercent && percent > strongestPercent) {
          strongestPercent = percent;
          strongestDepth = depth + 1;
        }
      }
      if (bullishRejection) {
        const bidTick = Math.round(candle.low / tickSize) + depth;
        const percent = imbalancePercent(
          levels.get(bidTick)?.bid ?? 0,
          levels.get(bidTick + 1)?.ask ?? 0,
          includeZero,
        );
        if (percent != null && percent >= minimumPercent && percent > strongestPercent) {
          strongestPercent = percent;
          strongestDepth = depth + 1;
        }
      }
    }
    if (!strongestDepth) continue;
    const side = bearishRejection ? "BEARISH" as const : "BULLISH" as const;
    signals.push({
      id: `${candle.timestamp}:${side}:${strongestDepth}`,
      side,
      candleIndex,
      timestamp: candle.timestamp,
      price: side === "BEARISH"
        ? candle.high + tickOffset * tickSize
        : candle.low - tickOffset * tickSize,
      imbalancePercent: strongestPercent,
      comparisonDepth: strongestDepth,
    });
  }
  return signals;
}
