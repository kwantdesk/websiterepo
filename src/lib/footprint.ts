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
  showEmptyPriceRows?: boolean;
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

/**
 * Where a bar stops accepting trades.
 *
 * A bar ends where the next one begins. The LAST bar has no next one, and this
 * used to guess its width from the single previous gap — fine on a clock chart
 * where every gap is the interval, wrong on a volume, range or tick chart
 * where they are not. A quick previous bar gave the forming bar a window of a
 * second or two, and every trade after that was dropped: the bar kept its
 * open, high, low and close from the candle and showed no rows at all, so the
 * footprint climbed with price while empty.
 *
 * The last bar is the forming one and owns everything at or after its start.
 * Which trades reach here is the caller's window to choose, and it already
 * fetches candles and tape for the same span.
 *
 * Note this guard only ever fires for the last bar: lowerBoundCandle already
 * assigns a trade to the latest candle starting at or before it, so a trade
 * belonging to the next bar is never offered to this one.
 */
function approximateBarEnd(candles: Candle[], index: number) {
  return candles[index + 1]?.timestamp ?? Number.POSITIVE_INFINITY;
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
    if (settings.showEmptyPriceRows) {
      const firstTick = Math.floor(priceToTickIndex(mutable.candle.low, tickSize) / groupTicks) * groupTicks;
      const lastTick = Math.floor(priceToTickIndex(mutable.candle.high, tickSize) / groupTicks) * groupTicks;
      for (let tick = firstTick; tick <= lastTick; tick += groupTicks) {
        if (!mutable.levels.has(tick)) mutable.levels.set(tick, createEmptyFootprintLevel(tick, tickSize));
      }
    }
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

export type FootprintBuildCache = {
  key: string;
  bars: FootprintBar[];
  builtAt: number;
  lastBarTimestamp: number;
};

// Late prints and dedupe corrections can retouch a closed bar, so the
// incremental path still reconciles everything on a bounded clock.
const FOOTPRINT_FULL_REBUILD_MS = 30_000;

function footprintWindowKey(candles: Candle[], settings: FootprintBuildSettings) {
  return [
    settings.tickSize,
    settings.groupTicks,
    settings.minimumTradeVolume,
    settings.maximumTradeVolume,
    settings.imbalanceMode,
    settings.minimumImbalancePercent,
    settings.minimumDelta,
    settings.includeZero,
    settings.showEmptyPriceRows,
    settings.instrument,
    settings.valueAreaPercent,
    settings.minimumDominantVolume,
    settings.stackedImbalanceLevels,
    settings.unfinishedAuctionEnabled,
    settings.unfinishedAuctionMinimumVolume,
    candles.length,
    candles[0]?.timestamp,
    candles.length > 1 ? candles[candles.length - 2].timestamp : 0,
  ].join("|");
}

/**
 * Incremental wrapper around {@link buildFootprintBars}. Rebuilding every
 * visible bar from a six-figure RTH tape several times a second — from the
 * live refresh AND the React sampling path, twice each when the per-bar
 * profile uses its own grouping — pegged the main thread and froze the whole
 * site. Closed bars are immutable between full reconciles: while the candle
 * window and settings are unchanged, only the forming bar is rebuilt from its
 * own prints; a full rebuild runs on window/settings change, bar roll, or the
 * bounded reconcile clock.
 */
export function buildFootprintBarsCached(
  cache: { current: FootprintBuildCache | null },
  candlesInput: Candle[],
  records: InstitutionalTrade[],
  settings: FootprintBuildSettings,
): FootprintBar[] {
  if (!candlesInput.length) return [];
  const lastCandle = candlesInput[candlesInput.length - 1];
  const windowKey = footprintWindowKey(candlesInput, settings);
  const now = Date.now();
  const entry = cache.current;
  if (
    entry
    && entry.key === windowKey
    && entry.lastBarTimestamp === lastCandle.timestamp
    && entry.bars.length === candlesInput.length
    && now - entry.builtAt < FOOTPRINT_FULL_REBUILD_MS
  ) {
    // Only the forming bar can have gained prints; the tape is ordered, so
    // its slice starts at the bar's own open.
    let low = 0;
    let high = records.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (records[middle].timestamp < lastCandle.timestamp) low = middle + 1;
      else high = middle;
    }
    const tail = candlesInput.length > 1 ? candlesInput.slice(-2) : candlesInput;
    const rebuilt = buildFootprintBars(tail, records.slice(low), settings);
    const formingBar = rebuilt[rebuilt.length - 1];
    if (formingBar && formingBar.timestamp === lastCandle.timestamp) {
      const bars = [...entry.bars.slice(0, -1), formingBar];
      cache.current = { ...entry, bars };
      return bars;
    }
  }
  const bars = buildFootprintBars(candlesInput, records, settings);
  cache.current = { key: windowKey, bars, builtAt: now, lastBarTimestamp: lastCandle.timestamp };
  return bars;
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
