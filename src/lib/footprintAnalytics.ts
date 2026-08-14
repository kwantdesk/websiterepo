import type {
  FootprintAnalyticsSettings,
  FootprintPriceLevel,
} from "./footprintTypes";

const EPSILON = 1e-9;

function levelTradeCount(level: FootprintPriceLevel) {
  return level.bidTrades + level.askTrades + level.unknownTrades;
}

function chooseMaximum(
  levels: FootprintPriceLevel[],
  metric: (level: FootprintPriceLevel) => number,
  preferLower = true,
) {
  return levels.reduce<FootprintPriceLevel | null>((best, level) => {
    if (!best) return level;
    const value = metric(level);
    const bestValue = metric(best);
    if (value > bestValue + EPSILON) return level;
    if (Math.abs(value - bestValue) <= EPSILON) {
      return preferLower
        ? level.tickIndex < best.tickIndex ? level : best
        : level.tickIndex > best.tickIndex ? level : best;
    }
    return best;
  }, null);
}

function qualifiesImbalance(
  dominant: number,
  opposing: number,
  settings: FootprintAnalyticsSettings,
) {
  if (dominant < settings.minimumDominantVolume) return false;
  if (dominant - opposing < settings.minimumDifference) return false;
  if (opposing <= 0) return !settings.ignoreZeroValues && dominant > 0;
  return dominant / opposing >= settings.imbalanceRatio;
}

function markStacks(
  levels: FootprintPriceLevel[],
  side: "bid" | "ask",
  adjacentTickDistance: number,
  minimumLevels: number,
) {
  let start = 0;
  const imbalanceKey = side === "bid" ? "isBidImbalance" : "isAskImbalance";
  const oppositeKey = side === "bid" ? "isAskImbalance" : "isBidImbalance";
  const stackedKey = side === "bid" ? "isStackedBidImbalance" : "isStackedAskImbalance";
  const volumeKey = side === "bid" ? "bidVolume" : "askVolume";
  const stackVolumeKey = side === "bid" ? "stackedBidVolume" : "stackedAskVolume";
  while (start < levels.length) {
    if (!levels[start][imbalanceKey] || levels[start][oppositeKey]) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (
      end < levels.length
      && levels[end][imbalanceKey]
      && !levels[end][oppositeKey]
      && levels[end].tickIndex - levels[end - 1].tickIndex === adjacentTickDistance
    ) end += 1;
    if (end - start >= minimumLevels) {
      const combined = levels.slice(start, end).reduce((sum, level) => sum + level[volumeKey], 0);
      for (let index = start; index < end; index += 1) {
        levels[index][stackedKey] = true;
        levels[index][stackVolumeKey] = combined;
      }
    }
    start = end;
  }
}

export type FootprintAnalyticsResult = {
  pocTick: number | null;
  valueAreaHighTick: number | null;
  valueAreaLowTick: number | null;
  maxBidTick: number | null;
  maxAskTick: number | null;
  maxVolumeTick: number | null;
  maxPositiveDeltaTick: number | null;
  maxNegativeDeltaTick: number | null;
  maxTradesTick: number | null;
  vwap: number | null;
};

export function calculateFootprintAnalytics(
  levels: FootprintPriceLevel[],
  close: number,
  groupedTickDistance: number,
  settings: FootprintAnalyticsSettings,
): FootprintAnalyticsResult {
  for (const level of levels) {
    level.classifiedVolume = level.bidVolume + level.askVolume;
    level.totalVolume = level.classifiedVolume + level.unknownVolume;
    level.delta = level.askVolume - level.bidVolume;
    level.deltaPercent = level.classifiedVolume > 0 ? level.delta / level.classifiedVolume : 0;
    level.isPoc = false;
    level.isValueArea = false;
    level.isBidImbalance = false;
    level.isAskImbalance = false;
    level.isStackedBidImbalance = false;
    level.isStackedAskImbalance = false;
    level.stackedBidVolume = 0;
    level.stackedAskVolume = 0;
    level.isUnfinishedAuctionHigh = false;
    level.isUnfinishedAuctionLow = false;
    level.isMaxBid = false;
    level.isMaxAsk = false;
    level.isMaxVolume = false;
    level.isMaxPositiveDelta = false;
    level.isMaxNegativeDelta = false;
    level.isMaxTrades = false;
  }

  if (!levels.length) {
    return {
      pocTick: null,
      valueAreaHighTick: null,
      valueAreaLowTick: null,
      maxBidTick: null,
      maxAskTick: null,
      maxVolumeTick: null,
      maxPositiveDeltaTick: null,
      maxNegativeDeltaTick: null,
      maxTradesTick: null,
      vwap: null,
    };
  }

  const totalVolume = levels.reduce((sum, level) => sum + level.totalVolume, 0);
  const weighted = levels.reduce((sum, level) => sum + level.price * level.totalVolume, 0);
  const vwap = totalVolume > 0 ? weighted / totalVolume : null;
  const maximumVolume = Math.max(...levels.map((level) => level.totalVolume));
  const tiedPocLevels = levels.filter((level) => Math.abs(level.totalVolume - maximumVolume) <= EPSILON);
  tiedPocLevels.sort((left, right) => {
    const leftVwapDistance = vwap === null ? 0 : Math.abs(left.price - vwap);
    const rightVwapDistance = vwap === null ? 0 : Math.abs(right.price - vwap);
    return leftVwapDistance - rightVwapDistance
      || Math.abs(left.price - close) - Math.abs(right.price - close)
      || left.tickIndex - right.tickIndex;
  });
  const poc = tiedPocLevels[0] ?? null;
  if (poc) {
    poc.isPoc = true;
    poc.isMaxVolume = true;
  }

  let valueAreaLowTick = poc?.tickIndex ?? null;
  let valueAreaHighTick = poc?.tickIndex ?? null;
  if (poc && totalVolume > 0) {
    const byTick = new Map(levels.map((level) => [level.tickIndex, level]));
    const target = totalVolume * Math.min(1, Math.max(0.5, settings.valueAreaPercent));
    let included = poc.totalVolume;
    let lower = poc.tickIndex - groupedTickDistance;
    let upper = poc.tickIndex + groupedTickDistance;
    const minimumTick = levels[0].tickIndex;
    const maximumTick = levels.at(-1)!.tickIndex;
    while (included < target && (lower >= minimumTick || upper <= maximumTick)) {
      while (lower >= minimumTick && !byTick.has(lower)) lower -= groupedTickDistance;
      while (upper <= maximumTick && !byTick.has(upper)) upper += groupedTickDistance;
      const below = lower >= minimumTick ? byTick.get(lower) : undefined;
      const above = upper <= maximumTick ? byTick.get(upper) : undefined;
      if (below && above && Math.abs(below.totalVolume - above.totalVolume) <= EPSILON) {
        included += below.totalVolume + above.totalVolume;
        valueAreaLowTick = below.tickIndex;
        valueAreaHighTick = above.tickIndex;
        lower -= groupedTickDistance;
        upper += groupedTickDistance;
      } else if (above && (!below || above.totalVolume > below.totalVolume)) {
        included += above.totalVolume;
        valueAreaHighTick = above.tickIndex;
        upper += groupedTickDistance;
      } else if (below) {
        included += below.totalVolume;
        valueAreaLowTick = below.tickIndex;
        lower -= groupedTickDistance;
      } else break;
    }
    for (const level of levels) {
      level.isValueArea = level.tickIndex >= valueAreaLowTick! && level.tickIndex <= valueAreaHighTick!;
    }
  }

  const byTick = new Map(levels.map((level) => [level.tickIndex, level]));
  for (const level of levels) {
    if (settings.comparisonMode === "delta-percent") {
      level.isAskImbalance = level.delta > 0
        && level.delta >= settings.minimumDifference
        && level.deltaPercent * 100 >= settings.imbalanceRatio * 10;
      level.isBidImbalance = level.delta < 0
        && -level.delta >= settings.minimumDifference
        && -level.deltaPercent * 100 >= settings.imbalanceRatio * 10;
      continue;
    }
    const askOpposing = settings.comparisonMode === "diagonal"
      ? byTick.get(level.tickIndex - groupedTickDistance)?.bidVolume ?? 0
      : level.bidVolume;
    const bidOpposing = settings.comparisonMode === "diagonal"
      ? byTick.get(level.tickIndex + groupedTickDistance)?.askVolume ?? 0
      : level.askVolume;
    level.isAskImbalance = qualifiesImbalance(level.askVolume, askOpposing, settings);
    level.isBidImbalance = qualifiesImbalance(level.bidVolume, bidOpposing, settings);
  }
  markStacks(levels, "ask", groupedTickDistance, Math.max(2, settings.stackedImbalanceLevels));
  markStacks(levels, "bid", groupedTickDistance, Math.max(2, settings.stackedImbalanceLevels));

  const low = levels[0];
  const high = levels.at(-1)!;
  if (settings.unfinishedAuctionEnabled) {
    high.isUnfinishedAuctionHigh = high.bidVolume >= settings.unfinishedAuctionMinimumVolume
      && high.askVolume >= settings.unfinishedAuctionMinimumVolume;
    low.isUnfinishedAuctionLow = low.bidVolume >= settings.unfinishedAuctionMinimumVolume
      && low.askVolume >= settings.unfinishedAuctionMinimumVolume;
  }

  const maxBid = chooseMaximum(levels, (level) => level.bidVolume);
  const maxAsk = chooseMaximum(levels, (level) => level.askVolume);
  const maxPositiveDelta = chooseMaximum(levels, (level) => level.delta);
  const maxNegativeDelta = chooseMaximum(levels, (level) => -level.delta);
  const maxTrades = chooseMaximum(levels, levelTradeCount);
  if (maxBid) maxBid.isMaxBid = true;
  if (maxAsk) maxAsk.isMaxAsk = true;
  if (maxPositiveDelta) maxPositiveDelta.isMaxPositiveDelta = true;
  if (maxNegativeDelta) maxNegativeDelta.isMaxNegativeDelta = true;
  if (maxTrades) maxTrades.isMaxTrades = true;

  return {
    pocTick: poc?.tickIndex ?? null,
    valueAreaHighTick,
    valueAreaLowTick,
    maxBidTick: maxBid?.tickIndex ?? null,
    maxAskTick: maxAsk?.tickIndex ?? null,
    maxVolumeTick: poc?.tickIndex ?? null,
    maxPositiveDeltaTick: maxPositiveDelta?.tickIndex ?? null,
    maxNegativeDeltaTick: maxNegativeDelta?.tickIndex ?? null,
    maxTradesTick: maxTrades?.tickIndex ?? null,
    vwap,
  };
}

export function assertFootprintInvariants(levels: FootprintPriceLevel[], totals: {
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  classifiedVolume: number;
  totalVolume: number;
  delta: number;
}) {
  const sum = (metric: (level: FootprintPriceLevel) => number) =>
    levels.reduce((total, level) => total + metric(level), 0);
  const close = (left: number, right: number) => Math.abs(left - right) < 1e-7;
  if (!close(sum((level) => level.bidVolume), totals.bidVolume)) throw new Error("Footprint Bid invariant failed");
  if (!close(sum((level) => level.askVolume), totals.askVolume)) throw new Error("Footprint Ask invariant failed");
  if (!close(sum((level) => level.unknownVolume), totals.unknownVolume)) throw new Error("Footprint unknown invariant failed");
  if (!close(totals.classifiedVolume, totals.bidVolume + totals.askVolume)) throw new Error("Footprint classified invariant failed");
  if (!close(totals.totalVolume, totals.classifiedVolume + totals.unknownVolume)) throw new Error("Footprint total invariant failed");
  if (!close(totals.delta, totals.askVolume - totals.bidVolume)) throw new Error("Footprint Delta invariant failed");
}
