import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { exchangeClockParts } from "./exchangeClock";

const DAY_MS = 86_400_000;
const EXCHANGE_TIME_ZONE = "America/Chicago";

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

function tradingDate(timestamp: number) {
  const parts = exchangeClockParts(timestamp, EXCHANGE_TIME_ZONE);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour >= 17) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function periodIdentity(timestamp: number, type: AverageDailyRangeTargetSettings["lengthType"]) {
  const date = tradingDate(timestamp);
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

function valid(candle: Candle, previousTimestamp: number) {
  return Number.isFinite(candle.timestamp) && candle.timestamp > previousTimestamp
    && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close);
}

export function buildAverageRangeBuckets(candles: readonly Candle[], type: AverageDailyRangeTargetSettings["lengthType"]) {
  const buckets: PeriodBucket[] = [];
  let active: PeriodBucket | null = null;
  let previousTimestamp = -Infinity;
  let seam = 0;
  for (const candle of candles) {
    if (!valid(candle, previousTimestamp)) {
      if (Number.isFinite(candle.timestamp)) previousTimestamp = Math.max(previousTimestamp, candle.timestamp);
      active = null; seam += 1; continue;
    }
    previousTimestamp = candle.timestamp;
    const identity = periodIdentity(candle.timestamp, type);
    const key = `${identity.key}:${seam}`;
    if (!active || active.key !== key) {
      active = { key, order: identity.order, first: candle, last: candle, high: candle.high, low: candle.low };
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
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  const settings = normalizeAverageDailyRangeTargetSettings(raw);
  const buckets = buildAverageRangeBuckets(candles, settings.lengthType);
  if (buckets.length <= settings.length) return [];
  const current = buckets.at(-1)!;
  const completed = buckets.slice(-(settings.length + 1), -1);
  if (completed.length !== settings.length) return [];
  const averageRange = completed.reduce((sum, bucket) => sum + bucket.high - bucket.low, 0) / completed.length;
  if (!(averageRange > 0) || !Number.isFinite(current.first.open)) return [];
  const textColor = settings.useThemeColors ? theme.primary : settings.textColor;
  const backgroundColor = settings.useThemeColors ? theme.muted : settings.backgroundColor;
  const start = current.first.timestamp / 1_000;
  const end = current.last.timestamp / 1_000;
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
