import type { Candle } from "@/lib/backtester";
import { exchangeClockParts } from "@/lib/exchangeClock";

export type VwapSource = "hlc3" | "hl2" | "ohlc4" | "close";
export type VwapPeriodMode = "days" | "minutes" | "seconds" | "orders" | "bars";
export type VwapEnvelopeMode = "standard-deviation" | "price-percentage";

export type VwapPoint = {
  time: number;
  value: number;
  deviation: number;
  breakBefore: boolean;
};

type WeightedBar = {
  timestamp: number;
  weight: number;
  weightedPrice: number;
  weightedPriceSquared: number;
};

const finite = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function vwapSourcePrice(candle: Pick<Candle, "open" | "high" | "low" | "close">, source: VwapSource): number {
  if (source === "close") return candle.close;
  if (source === "hl2") return (candle.high + candle.low) / 2;
  if (source === "ohlc4") return (candle.open + candle.high + candle.low + candle.close) / 4;
  return (candle.high + candle.low + candle.close) / 3;
}

function weightedBar(candle: Candle, source: VwapSource): WeightedBar {
  const price = vwapSourcePrice(candle, source);
  const weight = Math.max(0, finite(candle.volume));
  return {
    timestamp: candle.timestamp,
    weight,
    weightedPrice: price * weight,
    weightedPriceSquared: price * price * weight,
  };
}

function pointFromTotals(candle: Candle, source: VwapSource, totals: { weight: number; pv: number; p2v: number }, breakBefore: boolean): VwapPoint {
  const fallback = vwapSourcePrice(candle, source);
  const value = totals.weight > 0 ? totals.pv / totals.weight : fallback;
  const variance = totals.weight > 0
    ? Math.max(0, totals.p2v / totals.weight - value * value)
    : 0;
  return { time: candle.timestamp / 1000, value, deviation: Math.sqrt(variance), breakBefore };
}

function tradingDayOrdinal(timestamp: number, startHour: number): number {
  const parts = exchangeClockParts(timestamp, "America/Chicago");
  const date = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.floor((date - (parts.hour < startHour ? 86_400_000 : 0)) / 86_400_000);
}

/**
 * Period VWAP matching the study contract: trading days, wall-clock buckets,
 * aggregate order counts, or bars. A new bucket starts a visually broken
 * series so Lightweight Charts never joins unrelated VWAP periods.
 */
export function calculatePeriodVwap(
  candles: Candle[],
  options: {
    source?: VwapSource;
    periodMode?: VwapPeriodMode;
    periodValue?: number;
    sessionStartHour?: number;
  } = {},
): VwapPoint[] {
  const source = options.source ?? "hlc3";
  const mode = options.periodMode ?? "days";
  const value = Math.max(1, Math.round(finite(options.periodValue, 1)));
  const startHour = Math.max(0, Math.min(23, Math.round(finite(options.sessionStartHour, 17))));
  let activeBucket = "";
  let cumulativeOrders = 0;
  const totals = { weight: 0, pv: 0, p2v: 0 };

  return candles.map((candle, index) => {
    const seconds = Math.floor(candle.timestamp / 1000);
    let bucket: string;
    if (mode === "minutes") bucket = `m:${Math.floor(seconds / (value * 60))}`;
    else if (mode === "seconds") bucket = `s:${Math.floor(seconds / value)}`;
    else if (mode === "bars") bucket = `b:${Math.floor(index / value)}`;
    else if (mode === "orders") bucket = `o:${Math.floor(cumulativeOrders / value)}`;
    else bucket = `d:${Math.floor(tradingDayOrdinal(candle.timestamp, startHour) / value)}`;

    const breakBefore = activeBucket !== "" && bucket !== activeBucket;
    if (bucket !== activeBucket) {
      activeBucket = bucket;
      totals.weight = 0;
      totals.pv = 0;
      totals.p2v = 0;
    }
    const bar = weightedBar(candle, source);
    totals.weight += bar.weight;
    totals.pv += bar.weightedPrice;
    totals.p2v += bar.weightedPriceSquared;
    cumulativeOrders += Math.max(0, Math.round(finite(candle.trades)));
    return pointFromTotals(candle, source, totals, breakBefore);
  });
}

/** Continuous rolling VWAP. It deliberately does not reset at the CME reopen. */
export function calculateRollingVwap(
  candles: Candle[],
  options: { source?: VwapSource; periodMode?: "bars" | "minutes" | "days"; periodValue?: number } = {},
): VwapPoint[] {
  const source = options.source ?? "hlc3";
  const mode = options.periodMode ?? "bars";
  const value = Math.max(1, Math.round(finite(options.periodValue, 60)));
  const windowMs = mode === "days" ? value * 86_400_000 : mode === "minutes" ? value * 60_000 : 0;
  const queue: WeightedBar[] = [];
  let head = 0;
  const totals = { weight: 0, pv: 0, p2v: 0 };
  const output: VwapPoint[] = [];

  candles.forEach((candle) => {
    const bar = weightedBar(candle, source);
    queue.push(bar);
    totals.weight += bar.weight;
    totals.pv += bar.weightedPrice;
    totals.p2v += bar.weightedPriceSquared;
    const cutoff = candle.timestamp - windowMs;
    while (head < queue.length && (
      mode === "bars" ? queue.length - head > value : queue[head].timestamp < cutoff
    )) {
      const removed = queue[head++];
      totals.weight -= removed.weight;
      totals.pv -= removed.weightedPrice;
      totals.p2v -= removed.weightedPriceSquared;
    }
    // Compact long-lived live arrays without changing their mathematical window.
    if (head > 2048 && head * 2 > queue.length) {
      queue.splice(0, head);
      head = 0;
    }
    output.push(pointFromTotals(candle, source, totals, false));
  });
  return output;
}

export function vwapEnvelopeOffset(point: Pick<VwapPoint, "value" | "deviation">, multiplier: number, mode: VwapEnvelopeMode): number {
  const factor = Math.max(0, finite(multiplier));
  return mode === "price-percentage"
    ? Math.abs(point.value) * factor / 100
    : point.deviation * factor;
}
