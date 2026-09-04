import type { Candle } from "./backtester.ts";
import type { FootprintBar } from "./footprint.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import { exchangeMidnightMs, exchangeMinuteOfDay } from "./volumeProfileSessions.ts";

export type MarketStatisticsMode = "trades" | "bars";
export type MarketStatisticsDataType = "volume" | "order" | "aggregate-trades";
export type MarketStatisticsBarInput = "poc" | "delta-poc" | "volume";
export type MarketStatisticsStatus =
  | "LIVE"
  | "HISTORICAL"
  | "WAITING_FOR_EXECUTIONS"
  | "WAITING_FOR_VOLUME_AT_PRICE"
  | "WAITING_FOR_ORDER_HISTORY";

export type MarketStatisticsSettings = {
  statMode: MarketStatisticsMode;
  dataType: MarketStatisticsDataType;
  barInput: MarketStatisticsBarInput;
  standardDeviationPercent: number;
  filterMin: number;
  filterMax: number;
  initialRange: number;
  endRange: number;
  stepRange: number;
  initialFilterMinutes: number;
  endFilterMinutes: number;
};

export type MarketStatisticsRange = {
  lower: number;
  upper: number;
  average: number;
  deviation: number;
  peak: number;
};

export type MarketStatisticsFrame = {
  status: MarketStatisticsStatus;
  ranges: MarketStatisticsRange[];
  sampleDays: number;
  eventCount: number;
};

export const DEFAULT_MARKET_STATISTICS_SETTINGS: MarketStatisticsSettings = {
  statMode: "trades",
  dataType: "volume",
  barInput: "volume",
  standardDeviationPercent: 2,
  filterMin: 0,
  filterMax: 0,
  initialRange: 0,
  endRange: 500,
  stepRange: 50,
  initialFilterMinutes: 0,
  endFilterMinutes: 1_439,
};

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

export function normalizeMarketStatisticsSettings(settings: Record<string, unknown> = {}): MarketStatisticsSettings {
  const initialRange = Math.max(0, finite(settings.initialRange, DEFAULT_MARKET_STATISTICS_SETTINGS.initialRange));
  const endRange = Math.max(initialRange + 1, finite(settings.endRange, DEFAULT_MARKET_STATISTICS_SETTINGS.endRange));
  return {
    statMode: settings.statMode === "bars" ? "bars" : "trades",
    dataType: settings.dataType === "order" || settings.dataType === "aggregate-trades" ? settings.dataType : "volume",
    barInput: settings.barInput === "poc" || settings.barInput === "delta-poc" ? settings.barInput : "volume",
    standardDeviationPercent: clamp(finite(settings.standardDeviationPercent, 2), 0.1, 5),
    filterMin: Math.max(0, finite(settings.filterMin, 0)),
    filterMax: Math.max(0, finite(settings.filterMax, 0)),
    initialRange,
    endRange,
    stepRange: clamp(finite(settings.stepRange, 50), 1, Math.max(1, endRange - initialRange)),
    initialFilterMinutes: clamp(Math.round(finite(settings.initialFilterMinutes, 0)), 0, 1_439),
    endFilterMinutes: clamp(Math.round(finite(settings.endFilterMinutes, 1_439)), 0, 1_439),
  };
}

function insideTimeFilter(timestamp: number, startMinute: number, endMinute: number) {
  const minute = exchangeMinuteOfDay(timestamp);
  return startMinute <= endMinute
    ? minute >= startMinute && minute <= endMinute
    : minute >= startMinute || minute <= endMinute;
}

function eventDay(timestamp: number, startMinute: number, endMinute: number) {
  const midnight = exchangeMidnightMs(timestamp);
  const minute = exchangeMinuteOfDay(timestamp);
  return startMinute > endMinute && minute <= endMinute ? midnight - 86_400_000 : midnight;
}

function accepted(value: number, settings: MarketStatisticsSettings) {
  return Number.isFinite(value)
    && value >= settings.filterMin
    && (settings.filterMax <= 0 || value <= settings.filterMax);
}

type DayEvent = { day: number; value: number };

function tradeEvents(trades: InstitutionalTrade[], settings: MarketStatisticsSettings): DayEvent[] {
  const exact = trades
    .filter((trade) => !trade.flowOnly && trade.timestamp > 0 && insideTimeFilter(trade.timestamp, settings.initialFilterMinutes, settings.endFilterMinutes))
    .sort((left, right) => left.timestamp - right.timestamp || left.recordIndex - right.recordIndex);
  if (settings.dataType === "volume") {
    return exact
      .map((trade) => ({ day: eventDay(trade.timestamp, settings.initialFilterMinutes, settings.endFilterMinutes), value: trade.volume }))
      .filter((event) => accepted(event.value, settings));
  }
  const aggregates = new Map<string, DayEvent>();
  for (const trade of exact) {
    const price = Number.isFinite(trade.close) ? trade.close : trade.open;
    const key = `${trade.timestamp}:${price}`;
    const current = aggregates.get(key);
    if (current) current.value += trade.volume;
    else aggregates.set(key, { day: eventDay(trade.timestamp, settings.initialFilterMinutes, settings.endFilterMinutes), value: trade.volume });
  }
  return [...aggregates.values()].filter((event) => accepted(event.value, settings));
}

function barEvents(bars: FootprintBar[], settings: MarketStatisticsSettings): DayEvent[] {
  const events: DayEvent[] = [];
  for (const bar of bars) {
    if (!insideTimeFilter(bar.startTime, settings.initialFilterMinutes, settings.endFilterMinutes)) continue;
    let value = bar.totalVolume;
    if (settings.barInput === "poc") {
      const row = bar.pocTick == null ? null : bar.rows.find((candidate) => candidate.tickIndex === bar.pocTick);
      value = row?.totalVolume ?? Number.NaN;
    } else if (settings.barInput === "delta-poc") {
      const row = bar.deltaPocPrice == null
        ? null
        : bar.rows.reduce<typeof bar.rows[number] | null>((best, candidate) => (
          Math.abs(candidate.price - bar.deltaPocPrice!) < 0.0000001 ? candidate : best
        ), null);
      value = row == null ? Number.NaN : Math.abs(row.delta);
    }
    if (accepted(value, settings)) events.push({ day: eventDay(bar.startTime, settings.initialFilterMinutes, settings.endFilterMinutes), value });
  }
  return events;
}

function applyDeviationWindow(events: DayEvent[], multiplier: number) {
  if (events.length < 2) return events;
  const mean = events.reduce((sum, event) => sum + event.value, 0) / events.length;
  const variance = events.reduce((sum, event) => sum + ((event.value - mean) ** 2), 0) / events.length;
  const maximumDistance = Math.sqrt(variance) * multiplier;
  if (maximumDistance <= 0) return events;
  return events.filter((event) => Math.abs(event.value - mean) <= maximumDistance);
}

export function calculateMarketStatistics(args: {
  candles: Candle[];
  trades: InstitutionalTrade[];
  footprintBars: FootprintBar[];
  settings?: Record<string, unknown>;
  isLive?: boolean;
}): MarketStatisticsFrame {
  const settings = normalizeMarketStatisticsSettings(args.settings);
  if (settings.statMode === "trades" && settings.dataType === "order") {
    return { status: "WAITING_FOR_ORDER_HISTORY", ranges: [], sampleDays: 0, eventCount: 0 };
  }
  if (settings.statMode === "trades" && !args.trades.some((trade) => !trade.flowOnly)) {
    return { status: "WAITING_FOR_EXECUTIONS", ranges: [], sampleDays: 0, eventCount: 0 };
  }
  if (settings.statMode === "bars" && settings.barInput !== "volume" && !args.footprintBars.some((bar) => bar.hasPriceLevelFlow)) {
    return { status: "WAITING_FOR_VOLUME_AT_PRICE", ranges: [], sampleDays: 0, eventCount: 0 };
  }

  const unfilteredEvents = settings.statMode === "trades"
    ? tradeEvents(args.trades, settings)
    : barEvents(args.footprintBars, settings);
  // DeepCharts describes % Dev. Std. as a breadth control: lower values retain
  // observations near the centre, higher values include less-frequent tails.
  // The protected coefficient is not inspectable, so this uses the documented
  // standard score directly and keeps the calculation explicit.
  const events = applyDeviationWindow(unfilteredEvents, settings.standardDeviationPercent);
  const days = new Set<number>();
  for (const candle of args.candles) {
    if (insideTimeFilter(candle.timestamp, settings.initialFilterMinutes, settings.endFilterMinutes)) {
      days.add(eventDay(candle.timestamp, settings.initialFilterMinutes, settings.endFilterMinutes));
    }
  }
  for (const event of events) days.add(event.day);
  const sampleDays = Math.max(1, days.size);
  const binCount = Math.min(200, Math.ceil((settings.endRange - settings.initialRange) / settings.stepRange));
  const counts = Array.from({ length: binCount }, () => new Map<number, number>());
  for (const event of events) {
    if (event.value < settings.initialRange || event.value > settings.endRange) continue;
    const index = Math.min(binCount - 1, Math.floor((event.value - settings.initialRange) / settings.stepRange));
    counts[index].set(event.day, (counts[index].get(event.day) ?? 0) + 1);
  }
  const dayList = [...days];
  const ranges = counts.map((byDay, index) => {
    const observations = dayList.length > 0 ? dayList.map((day) => byDay.get(day) ?? 0) : [0];
    const average = observations.reduce((sum, value) => sum + value, 0) / observations.length;
    return {
      lower: settings.initialRange + index * settings.stepRange,
      upper: Math.min(settings.endRange, settings.initialRange + (index + 1) * settings.stepRange),
      average,
      // The public help defines Dev as the maximum observed daily frequency.
      deviation: Math.max(...observations),
      peak: Math.max(...observations),
    };
  });
  return {
    status: args.isLive === false ? "HISTORICAL" : "LIVE",
    ranges,
    sampleDays,
    eventCount: events.length,
  };
}
