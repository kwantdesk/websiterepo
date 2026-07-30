import type { Candle } from "@/lib/backtester";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { InstitutionalTrade } from "@/lib/institutionalMarketData";

export type ImbalanceSide = "BUY" | "SELL";

export type ImbalanceZone = {
  id: string;
  side: ImbalanceSide;
  startIndex: number;
  endIndex: number;
  startTimestamp: number;
  top: number;
  bottom: number;
  triggered: boolean;
};

type Level = { tick: number; bid: number; ask: number };

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

function priceLevelRecords(candles: Candle[], records: InstitutionalTrade[], tickSize: number) {
  const levelsByBar = new Map<number, Map<number, Level>>();
  records.forEach((record) => {
    const candleIndex = candleIndexForTimestamp(candles, record.timestamp);
    if (candleIndex < 0) return;
    const tick = Math.round(record.close / tickSize);
    const bar = levelsByBar.get(candleIndex) ?? new Map<number, Level>();
    const level = bar.get(tick) ?? { tick, bid: 0, ask: 0 };
    level.bid += Math.max(0, finite(record.bidVolume));
    level.ask += Math.max(0, finite(record.askVolume));
    bar.set(tick, level);
    levelsByBar.set(candleIndex, bar);
  });
  return levelsByBar;
}

function qualifies(
  numerator: number,
  denominator: number,
  minimumPercent: number,
  minimumDelta: number,
  includeZero: boolean,
) {
  if (!includeZero && (numerator <= 0 || denominator <= 0)) return false;
  if (numerator <= denominator || numerator - denominator < minimumDelta) return false;
  if (denominator === 0) return includeZero && numerator > 0;
  return (numerator / denominator) * 100 >= minimumPercent;
}

function consecutiveRuns(ticks: number[], minimumLength: number) {
  const sorted = [...new Set(ticks)].sort((left, right) => left - right);
  const runs: number[][] = [];
  let run: number[] = [];
  sorted.forEach((tick) => {
    if (!run.length || tick === run.at(-1)! + 1) {
      run.push(tick);
    } else {
      if (run.length >= minimumLength) runs.push(run);
      run = [tick];
    }
  });
  if (run.length >= minimumLength) runs.push(run);
  return runs;
}

function zoneLifecycle(
  candles: Candle[],
  startIndex: number,
  endIndex: number,
  top: number,
  bottom: number,
  side: ImbalanceSide,
  touchOnly: boolean,
) {
  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const candle = candles[index];
    if (!candle) break;
    const triggered = touchOnly
      ? candle.low <= top && candle.high >= bottom
      : side === "BUY" ? candle.close < bottom : candle.close > top;
    if (triggered) return { triggered: true, index };
  }
  return { triggered: false, index: endIndex };
}

export function calculateImbalanceZones(
  candles: Candle[],
  records: InstitutionalTrade[],
  instance: ChartIndicatorInstance,
  tickSize: number,
) {
  if (!instance.enabled || instance.indicatorId !== "imbalance-tracker") return [];
  if (!candles.length || !records.length || !Number.isFinite(tickSize) || tickSize <= 0) return [];
  const settings = instance.settings ?? {};
  const mode = String(settings.calculationMode ?? "diagonal");
  const minimumPercent = Math.max(0, finite(
    settings.minimumPercent,
    mode === "delta-percentage-horizontal" ? 50 : 300,
  ));
  const minimumDelta = Math.max(0, finite(settings.minimumDelta, 10));
  const minimumConsecutive = Math.max(1, Math.round(finite(settings.minimumConsecutive, 3)));
  const extendedBars = Math.max(1, Math.round(finite(settings.extendedBars, 40)));
  const includeZero = settings.includeZero === true;
  const showTriggered = settings.showTriggered !== false;
  const levelsByBar = priceLevelRecords(candles, records, tickSize);
  const output: ImbalanceZone[] = [];

  levelsByBar.forEach((bar, candleIndex) => {
    const buyTicks: number[] = [];
    const sellTicks: number[] = [];
    bar.forEach((level) => {
      if (mode === "delta-percentage-horizontal") {
        const total = level.ask + level.bid;
        const delta = level.ask - level.bid;
        if (
          total > 0
          && (includeZero || (level.ask > 0 && level.bid > 0))
          && Math.abs(delta) >= minimumDelta
          && Math.abs(delta) / total * 100 >= minimumPercent
        ) {
          (delta > 0 ? buyTicks : sellTicks).push(level.tick);
        }
        return;
      }
      const buyComparison = mode === "diagonal" ? bar.get(level.tick - 1)?.bid ?? 0 : level.bid;
      const sellComparison = mode === "diagonal" ? bar.get(level.tick + 1)?.ask ?? 0 : level.ask;
      if (qualifies(level.ask, buyComparison, minimumPercent, minimumDelta, includeZero)) {
        buyTicks.push(level.tick);
      }
      if (qualifies(level.bid, sellComparison, minimumPercent, minimumDelta, includeZero)) {
        sellTicks.push(level.tick);
      }
    });

    (["BUY", "SELL"] as const).forEach((side) => {
      consecutiveRuns(side === "BUY" ? buyTicks : sellTicks, minimumConsecutive).forEach((run) => {
        const firstTick = run[0];
        const lastTick = run.at(-1)!;
        const bottom = (firstTick - 0.5) * tickSize;
        const top = (lastTick + 0.5) * tickSize;
        const intendedEnd = Math.min(candles.length - 1, candleIndex + extendedBars);
        const lifecycle = zoneLifecycle(
          candles,
          candleIndex,
          intendedEnd,
          top,
          bottom,
          side,
          settings.triggerOnlyTouch === true,
        );
        if (lifecycle.triggered && !showTriggered) return;
        output.push({
          id: `${candles[candleIndex].timestamp}:${side}:${firstTick}:${lastTick}`,
          side,
          startIndex: candleIndex,
          endIndex: lifecycle.triggered ? lifecycle.index : intendedEnd,
          startTimestamp: candles[candleIndex].timestamp,
          top,
          bottom,
          triggered: lifecycle.triggered,
        });
      });
    });
  });
  return output;
}
