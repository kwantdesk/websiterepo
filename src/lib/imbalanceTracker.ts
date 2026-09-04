import type { Candle } from "@/lib/backtester";
import { exchangeDateKey, exchangeMinuteOfDay } from "@/lib/exchangeClock";
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
  /** Bars still owed to the zone beyond the newest candle currently loaded. */
  futureBars: number;
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

/**
 * Buckets executions into per-bar price levels. `groupingTicks` merges N
 * adjacent ticks into one level before any imbalance test — the reference
 * tracker's "Tick grouping ticks", which is how a 1-tick book is read at the
 * granularity the trader actually watches.
 */
function priceLevelRecords(
  candles: Candle[],
  records: InstitutionalTrade[],
  tickSize: number,
  groupingTicks: number,
) {
  const levelsByBar = new Map<number, Map<number, Level>>();
  const group = Math.max(1, Math.round(groupingTicks));
  records.forEach((record) => {
    const candleIndex = candleIndexForTimestamp(candles, record.timestamp);
    if (candleIndex < 0) return;
    const rawTick = Math.round(record.close / tickSize);
    const tick = group > 1 ? Math.floor(rawTick / group) * group : rawTick;
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

function consecutiveRuns(ticks: number[], minimumLength: number, step = 1) {
  const sorted = [...new Set(ticks)].sort((left, right) => left - right);
  const runs: number[][] = [];
  let run: number[] = [];
  sorted.forEach((tick) => {
    if (!run.length || tick === run.at(-1)! + step) {
      run.push(tick);
    } else {
      if (run.length >= minimumLength) runs.push(run);
      run = [tick];
    }
  });
  if (run.length >= minimumLength) runs.push(run);
  return runs;
}

const EXCHANGE_TIME_ZONE = "America/Chicago";

/** Chicago (exchange) wall-clock minutes for a timestamp. */
function exchangeMinutes(timestamp: number) {
  return exchangeMinuteOfDay(timestamp, EXCHANGE_TIME_ZONE);
}

function clockMinutes(value: unknown, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return fallback;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return Number.isFinite(minutes) ? minutes : fallback;
}

/** The exchange-session key a bar belongs to, for reset modes. */
function sessionKeyFor(timestamp: number, mode: string) {
  // Built a fresh Intl.DateTimeFormat per call, and this runs inside the
  // extension loop for every zone: measured at 29.9s against 52ms with the
  // reset mode off, on 780 candles. The shared clock caches per minute.
  if (mode === "session" || mode === "day") return exchangeDateKey(timestamp, EXCHANGE_TIME_ZONE);
  if (mode === "week") {
    const date = new Date(timestamp);
    const week = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    return week.toISOString().slice(0, 10);
  }
  return "";
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
    mode === "delta-percentage-horizontal" ? 50 : 400,
  ));
  const minimumDelta = Math.max(0, finite(settings.minimumDelta, 0));
  const minimumConsecutive = Math.max(1, Math.round(finite(settings.minimumConsecutive, 3)));
  const extendedBars = Math.max(1, Math.round(finite(settings.extendedBars, 10)));
  const groupingTicks = Math.max(1, Math.round(finite(settings.tickGroupingTicks, 1)));
  const zonesExtraTicks = Math.max(0, Math.round(finite(settings.zonesExtraTicks, 0)));
  const includeZero = settings.includeZero === true;
  const showTriggered = settings.showTriggered !== false;
  const resetMode = String(settings.resetMode ?? "none");
  const filterTime = String(settings.filterTime ?? "none");
  const sessionStart = clockMinutes(settings.sessionStart, 9 * 60 + 30);
  const sessionEnd = clockMinutes(settings.sessionEnd, 16 * 60);
  const levelsByBar = priceLevelRecords(candles, records, tickSize, groupingTicks);
  const output: ImbalanceZone[] = [];

  levelsByBar.forEach((bar, candleIndex) => {
    // Filter Time: only bars inside the configured exchange-time window may
    // create zones. An overnight window (end before start) wraps midnight.
    if (filterTime === "custom") {
      const minutes = exchangeMinutes(candles[candleIndex].timestamp);
      const inWindow = sessionStart <= sessionEnd
        ? minutes >= sessionStart && minutes < sessionEnd
        : minutes >= sessionStart || minutes < sessionEnd;
      if (!inWindow) return;
    }
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
      consecutiveRuns(side === "BUY" ? buyTicks : sellTicks, minimumConsecutive, groupingTicks).forEach((run) => {
        const firstTick = run[0];
        const lastTick = run.at(-1)!;
        // A grouped level spans `groupingTicks` ticks; "Zones extra ticks"
        // then pads the drawn zone symmetrically.
        const bottom = (firstTick - 0.5 - zonesExtraTicks) * tickSize;
        const top = (lastTick + groupingTicks - 0.5 + zonesExtraTicks) * tickSize;
        // Reset mode ends every zone at its session/day/week boundary rather
        // than letting it run the full extension.
        const requestedExtensionEnd = candleIndex + extendedBars;
        const extensionEnd = Math.min(candles.length - 1, requestedExtensionEnd);
        let intendedEnd = extensionEnd;
        if (resetMode !== "none") {
          const originKey = sessionKeyFor(candles[candleIndex].timestamp, resetMode);
          for (let index = candleIndex + 1; index <= extensionEnd; index += 1) {
            if (sessionKeyFor(candles[index].timestamp, resetMode) !== originKey) {
              intendedEnd = index - 1;
              break;
            }
          }
        }
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
        // A live-edge zone must still occupy its configured number of bars.
        // Clamping it to the last loaded candle made every newly detected
        // imbalance a two-pixel mark until ten more candles happened to load.
        // Reset and trigger boundaries are authoritative and never project.
        const futureBars = lifecycle.triggered || intendedEnd < extensionEnd
          ? 0
          : Math.max(0, requestedExtensionEnd - lifecycle.index);
        output.push({
          id: `${candles[candleIndex].timestamp}:${side}:${firstTick}:${lastTick}`,
          side,
          startIndex: candleIndex,
          endIndex: lifecycle.triggered ? lifecycle.index : intendedEnd,
          startTimestamp: candles[candleIndex].timestamp,
          top,
          bottom,
          triggered: lifecycle.triggered,
          futureBars,
        });
      });
    });
  });
  return output;
}
