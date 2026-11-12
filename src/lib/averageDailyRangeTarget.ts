import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { exchangeClockParts } from "./exchangeClock";
import { isMarketIndexSymbol } from "./marketIndices";

const DAY_MS = 86_400_000;
const EXCHANGE_TIME_ZONE = "America/Chicago";
const INDEX_FUTURE = /^(?:ES|MES|NQ|MNQ|YM|MYM|RTY|M2K)(?:[FGHJKMNQUVXZ]\d+|\.[VNC]\.\d+)?$/i;

export const AVERAGE_DAILY_RANGE_TARGET_DEFAULTS = {
  lengthType: "daily", length: 1, fontSize: 12, textAlign: "right",
  useThemeColors: true, backgroundColor: "#000000", textColor: "#FFFFFF",
} as const;

export type AverageDailyRangeTargetSettings = {
  lengthType: "daily" | "weekly" | "monthly";
  length: number;
  fontSize: number;
  textAlign: "left" | "right";
  useThemeColors: boolean;
  backgroundColor: string;
  textColor: string;
};

type PeriodBucket = { key: string; order: number; first: Candle; last: Candle; high: number; low: number };
type AdrChartContext = {
  instrument?: string;
  timeframe?: string;
  adrDailyCandles?: readonly Candle[];
  adrAsOfMs?: number;
};

export function supportsAdrDailyHistory(instrument: string) {
  return INDEX_FUTURE.test(instrument) || isMarketIndexSymbol(instrument);
}
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const color = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;

export function normalizeAverageDailyRangeTargetSettings(raw: Record<string, unknown> = {}): AverageDailyRangeTargetSettings {
  return {
    lengthType: raw.lengthType === "weekly" || raw.lengthType === "monthly" ? raw.lengthType : "daily",
    length: Math.round(clamp(finite(raw.length, 1), 1, 500)),
    fontSize: clamp(finite(raw.fontSize, 12), 6, 40),
    textAlign: raw.textAlign === "left" ? "left" : "right",
    useThemeColors: raw.useThemeColors !== false,
    backgroundColor: color(raw.backgroundColor, "#000000"),
    textColor: color(raw.textColor, "#FFFFFF"),
  };
}

function tradingDate(timestamp: number, cashMarket: boolean, calendarBars: boolean) {
  // Some daily cash sources encode a trading-date label at UTC midnight.
  if (cashMarket && calendarBars && timestamp % DAY_MS === 0) return new Date(timestamp);
  const parts = exchangeClockParts(timestamp, cashMarket ? "America/New_York" : EXCHANGE_TIME_ZONE);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (!cashMarket && parts.hour >= 17) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function periodIdentity(timestamp: number, type: AverageDailyRangeTargetSettings["lengthType"], cashMarket: boolean, calendarBars: boolean) {
  const date = tradingDate(timestamp, cashMarket, calendarBars);
  if (type === "daily") {
    const order = Math.floor(date.getTime() / DAY_MS);
    return { key: `d:${order}`, order };
  }
  if (type === "weekly") {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const order = Math.floor(date.getTime() / (7 * DAY_MS));
    return { key: `w:${order}`, order };
  }
  const order = date.getUTCFullYear() * 12 + date.getUTCMonth();
  return { key: `m:${order}`, order };
}

export function adrHistoryDay(timestamp: number, instrument: string) {
  if (!Number.isFinite(timestamp)) return null;
  return periodIdentity(timestamp, "daily", isMarketIndexSymbol(instrument), false).order;
}

function valid(candle: Candle, previousTimestamp: number) {
  return Number.isFinite(candle.timestamp) && candle.timestamp > previousTimestamp
    && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close);
}

export function buildAverageRangeBuckets(candles: readonly Candle[], type: AverageDailyRangeTargetSettings["lengthType"], context: AdrChartContext = {}) {
  const cashMarket = isMarketIndexSymbol(context.instrument ?? "");
  const calendarBars = context.timeframe === "1D" || context.timeframe === "1W" || context.timeframe === "1M";
  const buckets: PeriodBucket[] = [];
  let active: PeriodBucket | null = null;
  let previousTimestamp = -Infinity;
  let invalidThrough = -Infinity;
  for (const candle of candles) {
    if (!valid(candle, previousTimestamp)) {
      if (Number.isFinite(candle.timestamp)) previousTimestamp = Math.max(previousTimestamp, candle.timestamp);
      if (Number.isFinite(previousTimestamp)) {
        invalidThrough = periodIdentity(previousTimestamp, type, cashMarket, calendarBars).order;
      }
      // A damaged period cannot supply an opening price or a completed range.
      // Rebuild the lookback after the seam instead of counting its fragments.
      buckets.length = 0;
      active = null;
      continue;
    }
    previousTimestamp = candle.timestamp;
    const identity = periodIdentity(candle.timestamp, type, cashMarket, calendarBars);
    if (identity.order <= invalidThrough) continue;
    if (!active || active.key !== identity.key) {
      active = { ...identity, first: candle, last: candle, high: candle.high, low: candle.low };
      buckets.push(active); continue;
    }
    active.last = candle;
    active.high = Math.max(active.high, candle.high);
    active.low = Math.min(active.low, candle.low);
  }
  return buckets;
}

/** No-lookahead ADR levels: current-period open plus/minus 0.5x, 1x and 1.5x
 * the mean high-low range of the requested completed periods. */
export function calculateAverageDailyRangeTarget(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, context: AdrChartContext = {},
): CalculatedIndicatorSeries[] {
  const settings = normalizeAverageDailyRangeTargetSettings(raw);
  const hostLast = candles.at(-1);
  if (!hostLast) return [];
  const useDailyHistory = context.adrDailyCandles !== undefined;
  const cashMarket = isMarketIndexSymbol(context.instrument ?? "");
  const asOfMs = context.adrAsOfMs ?? hostLast.sourceEndTimestamp ?? hostLast.timestamp;
  if (useDailyHistory && !Number.isFinite(asOfMs)) return [];
  const activeDay = useDailyHistory ? periodIdentity(asOfMs, "daily", cashMarket, false).order : 0;
  const daily = context.adrDailyCandles?.filter(candle => {
    if (!Number.isFinite(candle.timestamp) || (candle.sourceStartTimestamp ?? candle.timestamp) > asOfMs) return false;
    const day = periodIdentity(candle.timestamp, "daily", cashMarket, true).order;
    if (cashMarket && day === activeDay && candle.timestamp % DAY_MS === 0 && candle.sourceStartTimestamp === undefined) {
      // A published date stamp alone does not establish a price before the cash open.
      const time = exchangeClockParts(asOfMs, "America/New_York");
      if (time.hour * 60 + time.minute < 9 * 60 + 30) return false;
    }
    return day <= activeDay;
  });
  const buckets = buildAverageRangeBuckets(daily ?? candles, settings.lengthType,
    useDailyHistory ? { ...context, timeframe: "1D" } : context);
  // The beginning of a loaded intraday window can cut off a Globex session.
  // Its remaining bars cannot supply a verified full-session high and low.
  if (!useDailyHistory && settings.lengthType === "daily" && context.timeframe && !/^1[DWM]$/.test(context.timeframe)
    && INDEX_FUTURE.test(context.instrument ?? "") && buckets[0]) {
    const open = exchangeClockParts(buckets[0].first.timestamp, EXCHANGE_TIME_ZONE);
    if (open.hour !== 17 || open.minute !== 0) buckets.shift();
  }
  if (useDailyHistory && settings.lengthType !== "daily" && buckets[0]) {
    const first = tradingDate(buckets[0].first.timestamp, cashMarket, true);
    const expected = new Date(first);
    if (settings.lengthType === "weekly") expected.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    else expected.setUTCDate(1);
    while (expected.getUTCDay() === 0 || expected.getUTCDay() === 6) expected.setUTCDate(expected.getUTCDate() + 1);
    if (first.getTime() !== expected.getTime()) buckets.shift();
  }
  if (buckets.length <= settings.length) return [];
  const current = buckets.at(-1)!;
  if (useDailyHistory && periodIdentity(current.last.timestamp, "daily", cashMarket, true).order !== activeDay) return [];
  const completed = buckets.slice(-(settings.length + 1), -1);
  if (completed.length !== settings.length) return [];
  const averageRange = completed.reduce((sum, bucket) => sum + bucket.high - bucket.low, 0) / completed.length;
  if (!(averageRange > 0) || !Number.isFinite(current.first.open)) return [];
  const textColor = settings.useThemeColors ? theme.primary : settings.textColor;
  const backgroundColor = settings.useThemeColors ? theme.muted : settings.backgroundColor;
  const hostStart = useDailyHistory ? candles.find(candle => candle.timestamp >= current.first.timestamp) ?? hostLast : current.first;
  const start = hostStart.timestamp / 1_000;
  const end = (useDailyHistory ? hostLast : current.last).timestamp / 1_000;
  const targets = [
    ["scaling", "Scaling Tgt", 0], ["primary-up", "Primary Tgt", 0.5], ["primary-down", "Primary Tgt", -0.5],
    ["secondary-up", "Secondary Tgt", 1], ["secondary-down", "Secondary Tgt", -1],
    ["extension-up", "Extension Tgt", 1.5], ["extension-down", "Extension Tgt", -1.5],
  ] as const;
  return targets.map(([suffix, label, multiplier]) => {
    const value = current.first.open + multiplier * averageRange;
    return {
      key: `average-daily-range-target-${suffix}`, label, kind: "line", placement: "overlay",
      color: textColor, lineWidth: 1, lineStyle: "dotted", lastValueVisible: false,
      pivotLabels: { align: settings.textAlign, fontSize: settings.fontSize, label, color: textColor, backgroundColor },
      data: start === end ? [{ time: start, value }] : [{ time: start, value }, { time: end, value }],
    } satisfies CalculatedIndicatorSeries;
  });
}
