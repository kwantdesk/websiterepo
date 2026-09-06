import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { exchangeClockParts, exchangeSecondOfDay } from "@/lib/exchangeClock";

const DAY_MS = 86_400_000;
const EXCHANGE_TIME_ZONE = "America/Chicago";
const EPOCH_MONDAY_DAY = 4;

export type PivotReferenceTimeframe = "minute" | "hour" | "day" | "week";
export type PivotLabelAlign = "left" | "right";

export const PIVOT_POINT_DEFAULTS = {
  fontSize: 12,
  lineWidth: 1,
  lineStyle: "dashed",
  labelAlign: "left",
  periodsToShow: 1,
  customReferenceEnabled: false,
  referenceTimeframe: "hour",
  referenceValue: 1,
  customSessionEnabled: false,
  customSessionStart: "00:00:00",
  customSessionEnd: "00:00:00",
  useThemeColors: true,
} as const;

export type PivotPointSettings = {
  fontSize: number;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle: "solid" | "dashed" | "dotted";
  labelAlign: PivotLabelAlign;
  periodsToShow: number;
  customReferenceEnabled: boolean;
  referenceTimeframe: PivotReferenceTimeframe;
  referenceValue: number;
  customSessionEnabled: boolean;
  customSessionStart: string;
  customSessionEnd: string;
  useThemeColors: boolean;
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function validClock(value: unknown, fallback: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function clockSeconds(value: string) {
  const [hour, minute, second] = value.split(":").map(Number);
  return hour * 3_600 + minute * 60 + second;
}

export function normalizePivotPointSettings(input?: Record<string, unknown> | null): PivotPointSettings {
  const source = input ?? {};
  const referenceTimeframe = String(source.referenceTimeframe ?? PIVOT_POINT_DEFAULTS.referenceTimeframe);
  const lineStyle = String(source.lineStyle ?? PIVOT_POINT_DEFAULTS.lineStyle);
  const labelAlign = String(source.labelAlign ?? PIVOT_POINT_DEFAULTS.labelAlign);
  return {
    fontSize: clamp(finite(source.fontSize, PIVOT_POINT_DEFAULTS.fontSize), 6, 40),
    lineWidth: Math.round(clamp(finite(source.lineWidth, PIVOT_POINT_DEFAULTS.lineWidth), 1, 4)) as 1 | 2 | 3 | 4,
    lineStyle: lineStyle === "solid" || lineStyle === "dotted" ? lineStyle : "dashed",
    labelAlign: labelAlign === "right" ? "right" : "left",
    periodsToShow: Math.round(clamp(finite(source.periodsToShow, PIVOT_POINT_DEFAULTS.periodsToShow), 1, 30)),
    customReferenceEnabled: source.customReferenceEnabled === true,
    referenceTimeframe: (["minute", "hour", "day", "week"].includes(referenceTimeframe)
      ? referenceTimeframe
      : "hour") as PivotReferenceTimeframe,
    referenceValue: Math.round(clamp(finite(source.referenceValue, PIVOT_POINT_DEFAULTS.referenceValue), 1, 10_000)),
    customSessionEnabled: source.customSessionEnabled === true,
    customSessionStart: validClock(source.customSessionStart, PIVOT_POINT_DEFAULTS.customSessionStart),
    customSessionEnd: validClock(source.customSessionEnd, PIVOT_POINT_DEFAULTS.customSessionEnd),
    useThemeColors: source.useThemeColors !== false,
  };
}

type BucketIdentity = { key: string; order: number };

function localDaySerial(timestampMs: number) {
  const parts = exchangeClockParts(timestampMs, EXCHANGE_TIME_ZONE);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function sessionAnchorDay(timestampMs: number, settings: PivotPointSettings): number | null {
  const day = localDaySerial(timestampMs);
  if (!settings.customSessionEnabled) return day;
  const now = exchangeSecondOfDay(timestampMs, EXCHANGE_TIME_ZONE);
  const start = clockSeconds(settings.customSessionStart);
  const end = clockSeconds(settings.customSessionEnd);
  if (start === end) return now < start ? day - 1 : day;
  if (start < end) return now >= start && now < end ? day : null;
  if (now >= start) return day;
  return now < end ? day - 1 : null;
}

function bucketIdentity(timestampMs: number, settings: PivotPointSettings): BucketIdentity | null {
  const sessionDay = sessionAnchorDay(timestampMs, settings);
  if (sessionDay === null) return null;
  if (!settings.customReferenceEnabled || settings.referenceTimeframe === "day") {
    const span = settings.customReferenceEnabled ? settings.referenceValue : 1;
    const order = Math.floor(sessionDay / span) * span;
    return { key: `day:${order}`, order };
  }
  if (settings.referenceTimeframe === "week") {
    const parts = exchangeClockParts(timestampMs, EXCHANGE_TIME_ZONE);
    const monday = sessionDay - ((parts.weekday + 6) % 7);
    const span = 7 * settings.referenceValue;
    const order = Math.floor((monday - EPOCH_MONDAY_DAY) / span) * span + EPOCH_MONDAY_DAY;
    return { key: `week:${order}`, order };
  }
  const unit = settings.referenceTimeframe === "minute" ? 60_000 : 3_600_000;
  const duration = unit * settings.referenceValue;
  const order = Math.floor(timestampMs / duration) * duration;
  return { key: `${settings.referenceTimeframe}:${order}`, order };
}

type ReferenceBucket = BucketIdentity & {
  firstTimestamp: number;
  lastTimestamp: number;
  high: number;
  low: number;
  close: number;
  closeTimestamp: number;
};

function validCandle(candle: Candle) {
  return Number.isFinite(candle.timestamp) && Number.isFinite(candle.high)
    && Number.isFinite(candle.low) && Number.isFinite(candle.close)
    && candle.high >= candle.low && candle.high >= candle.close && candle.low <= candle.close;
}

function referenceBuckets(candles: Candle[], settings: PivotPointSettings) {
  const byKey = new Map<string, ReferenceBucket>();
  for (const candle of candles) {
    if (!validCandle(candle)) continue;
    const identity = bucketIdentity(candle.timestamp, settings);
    if (!identity) continue;
    const current = byKey.get(identity.key);
    if (!current) {
      byKey.set(identity.key, {
        ...identity,
        firstTimestamp: candle.timestamp,
        lastTimestamp: candle.timestamp,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        closeTimestamp: candle.timestamp,
      });
      continue;
    }
    current.firstTimestamp = Math.min(current.firstTimestamp, candle.timestamp);
    current.lastTimestamp = Math.max(current.lastTimestamp, candle.timestamp);
    current.high = Math.max(current.high, candle.high);
    current.low = Math.min(current.low, candle.low);
    if (candle.timestamp >= current.closeTimestamp) {
      current.close = candle.close;
      current.closeTimestamp = candle.timestamp;
    }
  }
  return [...byKey.values()].sort((left, right) => left.order - right.order);
}

type PivotLevel = { suffix: "pivot-point" | "r1" | "r2" | "s1" | "s2"; label: "P" | "R1" | "R2" | "S1" | "S2"; role: keyof IndicatorTheme };
const LEVELS: PivotLevel[] = [
  { suffix: "pivot-point", label: "P", role: "primary" },
  { suffix: "r1", label: "R1", role: "negative" },
  { suffix: "r2", label: "R2", role: "negative" },
  { suffix: "s1", label: "S1", role: "positive" },
  { suffix: "s2", label: "S2", role: "positive" },
];

export function calculatePivotPoints(
  candles: Candle[], input: Record<string, unknown>, theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  const settings = normalizePivotPointSettings(input);
  const buckets = referenceBuckets(candles, settings);
  if (buckets.length < 2) return [];
  const firstProjection = Math.max(1, buckets.length - settings.periodsToShow);
  const projected = buckets.slice(firstProjection).map((current, index) => {
    const previous = buckets[firstProjection + index - 1];
    const pivot = (previous.high + previous.low + previous.close) / 3;
    const range = previous.high - previous.low;
    return {
      current,
      breakBefore: index > 0,
      values: {
        "pivot-point": pivot,
        r1: 2 * pivot - previous.low,
        r2: pivot + range,
        s1: 2 * pivot - previous.high,
        s2: pivot - range,
      },
    };
  });
  return LEVELS.map((level) => ({
    key: `pivot-points-${level.suffix}`,
    label: level.label,
    kind: "line" as const,
    placement: "overlay" as const,
    color: theme[level.role],
    lineWidth: settings.lineWidth,
    lineStyle: settings.lineStyle,
    lastValueVisible: false,
    pivotLabels: { align: settings.labelAlign, fontSize: settings.fontSize, label: level.label },
    data: projected.flatMap(({ current, values, breakBefore }) => {
      const value = values[level.suffix];
      const first = { time: current.firstTimestamp / 1_000, value, ...(breakBefore ? { breakBefore: true } : {}) };
      return current.lastTimestamp === current.firstTimestamp
        ? [first]
        : [first, { time: current.lastTimestamp / 1_000, value }];
    }),
  }));
}
