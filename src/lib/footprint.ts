import type { Candle } from "./backtester.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import { assertFootprintInvariants, calculateFootprintAnalytics } from "./footprintAnalytics.ts";
import { institutionalTradeToFootprintTrade, orderFootprintTrades } from "./footprintTradeAdapter.ts";
import {
  createEmptyFootprintLevel,
  type FootprintBarModel,
  type FootprintComparisonMode,
  type FootprintNumberFormat,
  type FootprintPriceLevel,
} from "./footprintTypes.ts";

export type FootprintImbalanceMode = "diagonal" | "horizontal" | "same-row" | "delta-percent";

export type FootprintBuildSettings = {
  tickSize: number;
  groupTicks: number;
  minimumTradeVolume: number;
  maximumTradeVolume: number;
  imbalanceMode: FootprintImbalanceMode;
  minimumImbalancePercent: number;
  minimumDelta: number;
  includeZero: boolean;
  instrument?: string;
  valueAreaPercent?: number;
  minimumDominantVolume?: number;
  stackedImbalanceLevels?: number;
  unfinishedAuctionEnabled?: boolean;
  unfinishedAuctionMinimumVolume?: number;
};

export type FootprintRow = FootprintPriceLevel & {
  // Compatibility aliases retained for the existing chart primitive.
  betweenVolume: number;
  betweenTrades: number;
  volume: number;
  bidImbalance: boolean;
  askImbalance: boolean;
};

export type FootprintBar = Omit<FootprintBarModel, "rows"> & {
  rows: FootprintRow[];
  betweenVolume: number;
  volume: number;
  trades: number;
  pocPrice: number | null;
  deltaPocPrice: number | null;
  vah: number | null;
  val: number | null;
};

type MutableBar = {
  candle: Candle;
  levels: Map<number, FootprintPriceLevel>;
  weightedPriceVolume: number;
  delta: number;
  deltaHigh: number;
  deltaLow: number;
};

const finite = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function priceToTickIndex(price: number, tickSize: number): number {
  return Math.round(price / Math.max(0.000000001, tickSize));
}

export function tickIndexToPrice(tickIndex: number, tickSize: number): number {
  return tickIndex * tickSize;
}

function lowerBoundCandle(candles: Candle[], timestamp: number) {
  let low = 0;
  let high = candles.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (candles[middle].timestamp <= timestamp) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function allocateTradeCounts(
  count: number,
  bid: number,
  ask: number,
  unknown: number,
) {
  const total = bid + ask + unknown;
  if (!(total > 0)) return { bidTrades: 0, askTrades: 0, unknownTrades: 0 };
  if (ask > 0 && bid === 0 && unknown === 0) return { bidTrades: 0, askTrades: count, unknownTrades: 0 };
  if (bid > 0 && ask === 0 && unknown === 0) return { bidTrades: count, askTrades: 0, unknownTrades: 0 };
  if (unknown > 0 && bid === 0 && ask === 0) return { bidTrades: 0, askTrades: 0, unknownTrades: count };
  const bidTrades = count * bid / total;
  const askTrades = count * ask / total;
  return { bidTrades, askTrades, unknownTrades: count - bidTrades - askTrades };
}

function comparisonMode(mode: FootprintImbalanceMode): FootprintComparisonMode {
  if (mode === "horizontal" || mode === "same-row") return "same-row";
  return mode;
}

function approximateBarEnd(candles: Candle[], index: number) {
  const next = candles[index + 1]?.timestamp;
  if (next !== undefined) return next;
  const previous = candles[index - 1]?.timestamp;
  return candles[index].timestamp + Math.max(1, candles[index].timestamp - (previous ?? candles[index].timestamp - 60_000));
}

function levelWithAliases(level: FootprintPriceLevel): FootprintRow {
  return {
    ...level,
    betweenVolume: level.unknownVolume,
    betweenTrades: level.unknownTrades,
    volume: level.totalVolume,
    bidImbalance: level.isBidImbalance,
    askImbalance: level.isAskImbalance,
  };
}

export function buildFootprintBars(
  candlesInput: Candle[],
  records: InstitutionalTrade[],
  settings: FootprintBuildSettings,
): FootprintBar[] {
  if (!candlesInput.length) return [];
  const candles = [...candlesInput].sort((left, right) => left.timestamp - right.timestamp);
  const tickSize = Math.max(0.000000001, finite(settings.tickSize, 0.25));
  const groupTicks = Math.max(1, Math.round(finite(settings.groupTicks, 1)));
  const minimumTradeVolume = Math.max(0, finite(settings.minimumTradeVolume));
  const maximumTradeVolume = Math.max(0, finite(settings.maximumTradeVolume));
  const instrument = settings.instrument ?? "UNKNOWN";
  const mutableBars: MutableBar[] = candles.map((candle) => ({
    candle,
    levels: new Map(),
    weightedPriceVolume: 0,
    delta: 0,
    deltaHigh: 0,
    deltaLow: 0,
  }));

  const adapted = records
    .map((record, index) => institutionalTradeToFootprintTrade(record, instrument, tickSize, index))
    .filter((trade): trade is NonNullable<typeof trade> => trade !== null);
  const ordered = orderFootprintTrades(adapted);

  for (const trade of ordered) {
    if (trade.size < minimumTradeVolume || (maximumTradeVolume > 0 && trade.size > maximumTradeVolume)) continue;
    const candleIndex = lowerBoundCandle(candles, trade.timestamp);
    if (candleIndex < 0 || trade.timestamp >= approximateBarEnd(candles, candleIndex)) continue;
    const bar = mutableBars[candleIndex];
    const rawTick = priceToTickIndex(trade.price, tickSize);
    const groupedTick = Math.floor(rawTick / groupTicks) * groupTicks;
    const level = bar.levels.get(groupedTick) ?? createEmptyFootprintLevel(groupedTick, tickSize);
    const counts = allocateTradeCounts(
      trade.tradeCount,
      trade.bidVolume,
      trade.askVolume,
      trade.unknownVolume,
    );
    level.bidVolume += trade.bidVolume;
    level.askVolume += trade.askVolume;
    level.unknownVolume += trade.unknownVolume;
    level.bidTrades += counts.bidTrades;
    level.askTrades += counts.askTrades;
    level.unknownTrades += counts.unknownTrades;
    level.classifiedVolume = level.bidVolume + level.askVolume;
    level.totalVolume = level.classifiedVolume + level.unknownVolume;
    level.delta = level.askVolume - level.bidVolume;
    level.deltaPercent = level.classifiedVolume > 0 ? level.delta / level.classifiedVolume : 0;
    bar.levels.set(groupedTick, level);
    bar.weightedPriceVolume += trade.price * trade.size;
    bar.delta += trade.askVolume - trade.bidVolume;
    bar.deltaHigh = Math.max(bar.deltaHigh, bar.delta);
    bar.deltaLow = Math.min(bar.deltaLow, bar.delta);
  }

  return mutableBars.map((mutable, index) => {
    const levels = [...mutable.levels.values()].sort((left, right) => left.tickIndex - right.tickIndex);
    const analytics = calculateFootprintAnalytics(
      levels,
      mutable.candle.close,
      groupTicks,
      {
        valueAreaPercent: Math.min(1, Math.max(0.5, finite(settings.valueAreaPercent, 0.7))),
        comparisonMode: comparisonMode(settings.imbalanceMode),
        imbalanceRatio: Math.max(1, finite(settings.minimumImbalancePercent, 300) / 100),
        minimumDominantVolume: Math.max(0, finite(settings.minimumDominantVolume, 10)),
        minimumDifference: Math.max(0, finite(settings.minimumDelta, 0)),
        ignoreZeroValues: !settings.includeZero,
        stackedImbalanceLevels: Math.min(10, Math.max(2, Math.round(finite(settings.stackedImbalanceLevels, 3)))),
        unfinishedAuctionEnabled: settings.unfinishedAuctionEnabled === true,
        unfinishedAuctionMinimumVolume: Math.max(0, finite(settings.unfinishedAuctionMinimumVolume, 1)),
      },
    );
    const bidVolume = levels.reduce((sum, level) => sum + level.bidVolume, 0);
    const askVolume = levels.reduce((sum, level) => sum + level.askVolume, 0);
    const unknownVolume = levels.reduce((sum, level) => sum + level.unknownVolume, 0);
    const classifiedVolume = bidVolume + askVolume;
    const totalVolume = classifiedVolume + unknownVolume;
    const bidTrades = levels.reduce((sum, level) => sum + level.bidTrades, 0);
    const askTrades = levels.reduce((sum, level) => sum + level.askTrades, 0);
    const unknownTrades = levels.reduce((sum, level) => sum + level.unknownTrades, 0);
    const delta = askVolume - bidVolume;
    if (process.env.NODE_ENV !== "production") {
      assertFootprintInvariants(levels, {
        bidVolume,
        askVolume,
        unknownVolume,
        classifiedVolume,
        totalVolume,
        delta,
      });
    }
    const rows = levels.map(levelWithAliases);
    const pocPrice = analytics.pocTick === null ? null : tickIndexToPrice(analytics.pocTick, tickSize);
    const vah = analytics.valueAreaHighTick === null ? null : tickIndexToPrice(analytics.valueAreaHighTick, tickSize);
    const val = analytics.valueAreaLowTick === null ? null : tickIndexToPrice(analytics.valueAreaLowTick, tickSize);
    const deltaPoc = levels.reduce<FootprintPriceLevel | null>((best, level) =>
      !best || Math.abs(level.delta) > Math.abs(best.delta) ? level : best, null);
    const candle = mutable.candle;
    return {
      id: `${instrument}:${candle.timestamp}`,
      instrument,
      startTime: candle.timestamp,
      endTime: approximateBarEnd(candles, index),
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      openTick: priceToTickIndex(candle.open, tickSize),
      highTick: priceToTickIndex(candle.high, tickSize),
      lowTick: priceToTickIndex(candle.low, tickSize),
      closeTick: priceToTickIndex(candle.close, tickSize),
      bidVolume,
      askVolume,
      unknownVolume,
      betweenVolume: unknownVolume,
      classifiedVolume,
      totalVolume,
      volume: totalVolume,
      delta,
      deltaPercent: classifiedVolume > 0 ? delta / classifiedVolume : 0,
      deltaOpen: 0,
      deltaHigh: mutable.deltaHigh,
      deltaLow: mutable.deltaLow,
      deltaClose: mutable.delta,
      bidTrades,
      askTrades,
      unknownTrades,
      totalTrades: bidTrades + askTrades + unknownTrades,
      trades: bidTrades + askTrades + unknownTrades,
      levels: new Map(levels.map((level) => [level.tickIndex, level])),
      rows,
      ...analytics,
      vwap: totalVolume > 0 ? mutable.weightedPriceVolume / totalVolume : analytics.vwap,
      isClosed: index < mutableBars.length - 1,
      hasPriceLevelFlow: rows.length > 0,
      pocPrice,
      deltaPocPrice: deltaPoc?.price ?? null,
      vah,
      val,
    };
  });
}

export function formatFootprintValue(
  value: number,
  format: FootprintNumberFormat | "normal" | "thousands" = "automatic",
) {
  if (!Number.isFinite(value)) return "0";
  const normalized = format === "normal" ? "full" : format === "thousands" ? "compact" : format;
  if (normalized === "full") return Math.round(value).toLocaleString("en-US");
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const compact = (divisor: number, suffix: string) => {
    const scaled = absolute / divisor;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    return `${sign}${scaled.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0$/, "")}${suffix}`;
  };
  const shouldCompact = normalized === "compact" || absolute >= 10_000;
  if (shouldCompact && absolute >= 1_000_000) return compact(1_000_000, "M");
  if (shouldCompact && absolute >= 1_000) return compact(1_000, "K");
  return Math.round(value).toLocaleString("en-US");
}

export type {
  FootprintAggressorSide,
  FootprintContentMode,
  FootprintNumberFormat,
  FootprintPriceLevel,
  FootprintScaleMode,
  FootprintTrade,
  FootprintVisualizationMode,
} from "./footprintTypes.ts";
