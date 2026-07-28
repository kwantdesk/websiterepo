import type { Candle } from "@/lib/backtester";
import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";

export type MarketTrade = {
  timestamp: number;
  price: number;
  size: number;
  trades?: number;
  delta?: number;
};

export type EventCandle = Candle & {
  trades?: number;
  delta?: number;
};

export function futuresTickSize(symbol: string) {
  const root = symbol.toUpperCase().split(".")[0].replace(/[FGHJKMNQUVXZ]\d{1,2}$/u, "");
  if (["ES", "MES", "NQ", "MNQ"].includes(root)) return 0.25;
  if (["YM", "MYM"].includes(root)) return 1;
  if (["RTY", "M2K"].includes(root)) return 0.1;
  if (["CL", "MCL", "RB", "HO"].includes(root)) return 0.01;
  if (root === "NG") return 0.001;
  if (["GC", "MGC", "PL"].includes(root)) return 0.1;
  if (root === "SI") return 0.005;
  if (root === "HG") return 0.0005;
  if (["ZN", "ZF"].includes(root)) return 1 / 64;
  if (["ZB", "ZT"].includes(root)) return 1 / 32;
  if (root === "SR3") return 0.0025;
  if (["6E", "6A", "6C"].includes(root)) return 0.00005;
  if (root === "6B") return 0.0001;
  if (root === "6J") return 0.0000005;
  if (["ZC", "ZW"].includes(root)) return 0.25;
  if (root === "ZS") return 0.25;
  return 0.01;
}

function eventThreshold(timeframe: string, symbol: string) {
  const interval = getChartInterval(timeframe);
  if (!interval || !isEventBasedChartInterval(timeframe)) return null;
  if (interval.kind === "volume") return { kind: interval.kind, value: interval.value };
  if (interval.kind === "trade") return { kind: interval.kind, value: interval.value };
  if (interval.kind === "delta") return { kind: interval.kind, value: interval.value };
  return {
    kind: interval.kind,
    value: interval.value * futuresTickSize(symbol),
    secondary: (interval.secondaryValue ?? 1) * futuresTickSize(symbol),
  };
}

function isComplete(candle: EventCandle, timeframe: string, symbol: string) {
  const threshold = eventThreshold(timeframe, symbol);
  if (!threshold) return false;
  if (threshold.kind === "volume") return (candle.volume ?? 0) >= threshold.value;
  if (threshold.kind === "trade") return (candle.trades ?? 0) >= threshold.value;
  if (threshold.kind === "delta") return Math.abs(candle.delta ?? 0) >= threshold.value;
  if (threshold.kind === "renko") return Math.abs(candle.close - candle.open) >= threshold.value;
  if (threshold.kind === "point-figure") {
    return Math.abs(candle.close - candle.open) >= threshold.value
      || candle.high - candle.low >= threshold.value + threshold.secondary;
  }
  return candle.high - candle.low >= threshold.value;
}

export function applyMarketTradesToEventBars(
  current: Candle[],
  records: MarketTrade[],
  timeframe: string,
  symbol: string,
  limit = 3_000,
) {
  const threshold = eventThreshold(timeframe, symbol);
  if (!threshold || records.length === 0) return current;
  const next = current.map((candle) => ({ ...candle })) as EventCandle[];

  for (const record of records) {
    if (!Number.isFinite(record.timestamp) || !Number.isFinite(record.price) || record.price <= 0) continue;
    const size = Number.isFinite(record.size) ? Math.max(0, record.size) : 0;
    const tradeCount = Number.isFinite(record.trades) ? Math.max(1, record.trades ?? 1) : 1;
    const delta = Number.isFinite(record.delta) ? record.delta ?? 0 : 0;
    const last = next.at(-1);
    const wouldOverflowRange = Boolean(
      last
      && ["range", "volume-bars"].includes(threshold.kind)
      && Math.max(last.high, record.price) - Math.min(last.low, record.price) > threshold.value,
    );

    if (!last || isComplete(last, timeframe, symbol) || wouldOverflowRange) {
      next.push({
        timestamp: last ? Math.max(record.timestamp, last.timestamp + 1) : record.timestamp,
        open: record.price,
        high: record.price,
        low: record.price,
        close: record.price,
        volume: size,
        trades: tradeCount,
        delta,
      });
      continue;
    }

    last.high = Math.max(last.high, record.price);
    last.low = Math.min(last.low, record.price);
    last.close = record.price;
    last.volume = (last.volume ?? 0) + size;
    last.trades = (last.trades ?? 0) + tradeCount;
    last.delta = (last.delta ?? 0) + delta;
  }

  return next.slice(-Math.max(1, limit));
}
