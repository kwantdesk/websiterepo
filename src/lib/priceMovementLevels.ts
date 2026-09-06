import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { exchangeClockParts, exchangeSecondOfDay } from "./exchangeClock";

const DAY_MS = 86_400_000;
const EXCHANGE_TIME_ZONE = "America/Chicago";
const MAX_LEVELS_PER_SIDE = 20;

export const PRICE_MOVEMENT_LEVEL_DEFAULTS = {
  daysToLoad: 3, levelBasedOn: "open", stepMode: "percentual", stepValue: 0.5,
  fontSize: 11, minimumLevels: 5,
  supportLineStyle: "dashed", supportLineWidth: 2,
  resistanceLineStyle: "dashed", resistanceLineWidth: 2,
  zeroLineStyle: "dotted", zeroLineWidth: 2,
  customTimeEnabled: false, customStartTime: "00:00:00", customEndTime: "00:00:00",
  useThemeColors: true,
} as const;

export type PriceMovementLevelSettings = {
  daysToLoad: number; levelBasedOn: "open" | "close"; stepMode: "percentual" | "tick";
  stepValue: number; fontSize: number; minimumLevels: number;
  supportLineStyle: "solid" | "dashed" | "dotted"; supportLineWidth: 1 | 2 | 3 | 4;
  resistanceLineStyle: "solid" | "dashed" | "dotted"; resistanceLineWidth: 1 | 2 | 3 | 4;
  zeroLineStyle: "solid" | "dashed" | "dotted"; zeroLineWidth: 1 | 2 | 3 | 4;
  customTimeEnabled: boolean; customStartTime: string; customEndTime: string; useThemeColors: boolean;
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
function validClock(value: unknown, fallback: string) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const [hour, minute, second] = [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
  if (hour > 23 || minute > 59 || second > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}
const clockSeconds = (value: string) => value.split(":").map(Number).reduce((sum, part, i) => sum + part * [3600, 60, 1][i], 0);
const lineStyle = (value: unknown, fallback: PriceMovementLevelSettings["supportLineStyle"]) =>
  value === "solid" || value === "dotted" ? value : fallback;
const lineWidth = (value: unknown, fallback: number) =>
  Math.round(clamp(finite(value, fallback), 1, 4)) as 1 | 2 | 3 | 4;

export function normalizePriceMovementLevelSettings(raw: Record<string, unknown> = {}): PriceMovementLevelSettings {
  return {
    ...raw,
    daysToLoad: Math.round(clamp(finite(raw.daysToLoad, 3), 1, 365)),
    levelBasedOn: raw.levelBasedOn === "close" ? "close" : "open",
    stepMode: raw.stepMode === "tick" ? "tick" : "percentual",
    stepValue: clamp(finite(raw.stepValue, 0.5), 0.001, 1_000_000),
    fontSize: clamp(finite(raw.fontSize, 11), 6, 50),
    minimumLevels: Math.round(clamp(finite(raw.minimumLevels, 5), 1, MAX_LEVELS_PER_SIDE)),
    supportLineStyle: lineStyle(raw.supportLineStyle, "dashed"), supportLineWidth: lineWidth(raw.supportLineWidth, 2),
    resistanceLineStyle: lineStyle(raw.resistanceLineStyle, "dashed"), resistanceLineWidth: lineWidth(raw.resistanceLineWidth, 2),
    zeroLineStyle: lineStyle(raw.zeroLineStyle, "dotted"), zeroLineWidth: lineWidth(raw.zeroLineWidth, 2),
    customTimeEnabled: raw.customTimeEnabled === true,
    customStartTime: validClock(raw.customStartTime, "00:00:00"),
    customEndTime: validClock(raw.customEndTime, "00:00:00"),
    useThemeColors: raw.useThemeColors !== false,
  };
}

function localDay(timestamp: number) {
  const p = exchangeClockParts(timestamp, EXCHANGE_TIME_ZONE);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}
function sessionDay(timestamp: number, settings: PriceMovementLevelSettings): number | null {
  const day = localDay(timestamp);
  if (!settings.customTimeEnabled) return day;
  const now = exchangeSecondOfDay(timestamp, EXCHANGE_TIME_ZONE);
  const start = clockSeconds(settings.customStartTime), end = clockSeconds(settings.customEndTime);
  if (start === end) return now < start ? day - 1 : day;
  if (start < end) return now >= start && now < end ? day : null;
  return now >= start ? day : now < end ? day - 1 : null;
}
type Bucket = { key: string; order: number; first: Candle; last: Candle; high: number; low: number };
function valid(candle: Candle, previous: number) {
  return Number.isFinite(candle.timestamp) && candle.timestamp > previous
    && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    && candle.high >= Math.max(candle.open, candle.close) && candle.low <= Math.min(candle.open, candle.close);
}
function buildBuckets(candles: readonly Candle[], settings: PriceMovementLevelSettings) {
  const result: Bucket[] = [];
  let current: Bucket | null = null, previous = -Infinity, seam = 0;
  for (const candle of candles) {
    if (!valid(candle, previous)) { current = null; seam += 1; if (Number.isFinite(candle.timestamp)) previous = candle.timestamp; continue; }
    previous = candle.timestamp;
    const order = sessionDay(candle.timestamp, settings);
    if (order === null) { current = null; continue; }
    const key = `${order}:${seam}`;
    if (!current || current.key !== key) {
      current = { key, order, first: candle, last: candle, high: candle.high, low: candle.low }; result.push(current);
    } else {
      current.last = candle; current.high = Math.max(current.high, candle.high); current.low = Math.min(current.low, candle.low);
    }
  }
  return result;
}
const chosenColor = (raw: Record<string, unknown>, key: string, fallback: string) =>
  typeof raw[key] === "string" && String(raw[key]).trim() ? String(raw[key]) : fallback;

export function calculatePriceMovementLevels(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, tickSize = 0,
): CalculatedIndicatorSeries[] {
  const settings = normalizePriceMovementLevelSettings(raw);
  const allSessions = buildBuckets(candles, settings);
  const effectiveTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0;
  if (!allSessions.length || (settings.stepMode === "tick" && effectiveTick === 0)) return [];
  // A session's own close is not known at its first bar. Close mode therefore
  // projects the last completed session close into the following session.
  // This keeps historical output future-safe and prevents live levels from
  // sliding on every tick.
  const projections = settings.levelBasedOn === "close"
    ? allSessions.slice(1).map((bucket, i) => ({ bucket, anchor: allSessions[i].last.close }))
    : allSessions.map(bucket => ({ bucket, anchor: bucket.first.open }));
  const visible = projections.slice(-settings.daysToLoad);
  if (!visible.length) return [];
  const sessions = visible.map(item => item.bucket);
  const anchors = visible.map(item => item.anchor);
  const stepFor = (anchor: number) => settings.stepMode === "tick" ? settings.stepValue * effectiveTick : anchor * settings.stepValue / 100;
  const required = sessions.reduce((max, bucket, i) => Math.max(max,
    Math.ceil(Math.max(bucket.high - anchors[i], anchors[i] - bucket.low) / stepFor(anchors[i]))), settings.minimumLevels);
  const count = Math.min(MAX_LEVELS_PER_SIDE, Math.max(settings.minimumLevels, required));
  const supportColor = settings.useThemeColors ? theme.positive : chosenColor(raw, "supportLineColor", theme.positive);
  const resistanceColor = settings.useThemeColors ? theme.secondary : chosenColor(raw, "resistanceLineColor", theme.secondary);
  const zeroColor = settings.useThemeColors ? theme.primary : chosenColor(raw, "zeroLineColor", theme.primary);
  const textColor = settings.useThemeColors ? theme.primary : chosenColor(raw, "textColor", theme.primary);
  const make = (direction: -1 | 0 | 1, level: number): CalculatedIndicatorSeries => {
    const side = direction < 0 ? "support" : direction > 0 ? "resistance" : "zero";
    const label = direction === 0 ? "0" : settings.stepMode === "percentual"
      ? `${direction > 0 ? "+" : "-"}${(settings.stepValue * level).toFixed(2)}%`
      : `${direction > 0 ? "+" : "-"}${settings.stepValue * level} ticks`;
    const data: CalculatedIndicatorSeries["data"] = [];
    sessions.forEach((bucket, i) => {
      const value = anchors[i] + direction * level * stepFor(anchors[i]);
      data.push({ time: bucket.first.timestamp / 1_000, value, breakBefore: true });
      if (bucket.last.timestamp !== bucket.first.timestamp) data.push({ time: bucket.last.timestamp / 1_000, value });
    });
    return { key: `price-movement-levels-${side}${direction ? `-${level}` : ""}`, label, kind: "line", placement: "overlay",
      color: direction < 0 ? supportColor : direction > 0 ? resistanceColor : zeroColor,
      lineWidth: direction < 0 ? settings.supportLineWidth : direction > 0 ? settings.resistanceLineWidth : settings.zeroLineWidth,
      lineStyle: direction < 0 ? settings.supportLineStyle : direction > 0 ? settings.resistanceLineStyle : settings.zeroLineStyle,
      lastValueVisible: false, pivotLabels: { align: "left", fontSize: settings.fontSize, label, color: textColor }, data };
  };
  return [make(0, 0), ...Array.from({ length: count }, (_, i) => make(1, i + 1)),
    ...Array.from({ length: count }, (_, i) => make(-1, i + 1))];
}
