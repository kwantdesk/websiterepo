import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import type { GapZone } from "@/lib/gapDetector";
import { exchangeClockParts } from "@/lib/exchangeClock";

export const FAIR_VALUE_GAP_DEFAULTS = {
  minNumTicks: 10,
  maxNumTicks: 0,
  lineWidth: 1,
  backgroundOpacity: 40,
  resetStartDay: true,
  removeOnShadowTriggered: false,
  maxBarsExtension: 0,
  breakoutPercent: 35,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, finite(value, fallback)));
const colour = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;

export function normalizeFairValueGapSettings(raw: Record<string, unknown> = {}) {
  return {
    minNumTicks: Math.round(clamp(raw.minNumTicks, 10, 0, 1_000_000)),
    maxNumTicks: Math.round(clamp(raw.maxNumTicks, 0, 0, 1_000_000)),
    lineWidth: Math.round(clamp(raw.lineWidth, 1, 0, 8)),
    backgroundOpacity: Math.round(clamp(raw.backgroundOpacity, 40, 0, 100)),
    resetStartDay: raw.resetStartDay !== false,
    removeOnShadowTriggered: raw.removeOnShadowTriggered === true,
    maxBarsExtension: Math.round(clamp(raw.maxBarsExtension, 0, 0, 1_000_000)),
    breakoutPercent: clamp(raw.breakoutPercent, 35, 0, 100),
    useThemeColors: raw.useThemeColors !== false,
    upColor: colour(raw.upColor, "#22C55E"),
    downColor: colour(raw.downColor, "#EF4444"),
  };
}

type ExtremumTree = { size: number; values: Float64Array; mode: "min" | "max" };

function buildTree(values: readonly number[], mode: ExtremumTree["mode"]): ExtremumTree {
  let size = 1;
  while (size < values.length) size *= 2;
  const empty = mode === "min" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const tree = new Float64Array(size * 2);
  tree.fill(empty);
  values.forEach((value, index) => { tree[size + index] = value; });
  for (let index = size - 1; index > 0; index -= 1) {
    tree[index] = mode === "min"
      ? Math.min(tree[index * 2], tree[index * 2 + 1])
      : Math.max(tree[index * 2], tree[index * 2 + 1]);
  }
  return { size, values: tree, mode };
}

function firstMatch(tree: ExtremumTree, start: number, end: number, threshold: number): number | null {
  const matches = (value: number) => tree.mode === "min" ? value <= threshold : value >= threshold;
  const visit = (node: number, left: number, right: number): number | null => {
    if (right < start || left > end || !matches(tree.values[node])) return null;
    if (left === right) return left;
    const middle = Math.floor((left + right) / 2);
    return visit(node * 2, left, middle) ?? visit(node * 2 + 1, middle + 1, right);
  };
  return start > end ? null : visit(1, 0, tree.size - 1);
}

function tradingDayKey(timestamp: number) {
  const parts = exchangeClockParts(timestamp, "America/Chicago");
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (parts.hour < 17) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function valid(candle: Candle) {
  return [candle.timestamp, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    && candle.timestamp > 0 && candle.high >= candle.low
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close);
}

type Segment = { candles: Candle[]; reachesLiveTail: boolean };

function continuitySegments(candles: readonly Candle[], resetStartDay: boolean): Segment[] {
  const segments: Segment[] = [];
  let current: Candle[] = [];
  let priorTime = Number.NEGATIVE_INFINITY;
  let priorDay = "";
  const flush = (reachesLiveTail: boolean) => {
    if (current.length) segments.push({ candles: current, reachesLiveTail });
    current = [];
  };
  candles.forEach((candle, index) => {
    if (!valid(candle) || candle.timestamp <= priorTime) {
      flush(false);
      priorTime = Number.NEGATIVE_INFINITY;
      priorDay = "";
      return;
    }
    const day = tradingDayKey(candle.timestamp);
    if (current.length && resetStartDay && day !== priorDay) flush(false);
    current.push(candle);
    priorTime = candle.timestamp;
    priorDay = day;
    if (index === candles.length - 1) flush(true);
  });
  return segments;
}

export function detectFairValueGaps(candles: readonly Candle[], raw: Record<string, unknown>, tickSize = 0.25) {
  const settings = normalizeFairValueGapSettings(raw);
  const tick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const zones: GapZone[] = [];

  for (const segment of continuitySegments(candles, settings.resetStartDay)) {
    if (segment.candles.length < 3) continue;
    const lowTree = buildTree(segment.candles.map((candle) => settings.removeOnShadowTriggered ? candle.low : candle.close), "min");
    const highTree = buildTree(segment.candles.map((candle) => settings.removeOnShadowTriggered ? candle.high : candle.close), "max");
    for (let index = 2; index < segment.candles.length; index += 1) {
      const first = segment.candles[index - 2];
      const current = segment.candles[index];
      const direction = current.low > first.high ? "up" : current.high < first.low ? "down" : null;
      if (!direction) continue;
      const low = direction === "up" ? first.high : current.high;
      const high = direction === "up" ? current.low : first.low;
      const gapTicks = (high - low) / tick;
      if (gapTicks + 1e-9 < settings.minNumTicks) continue;
      if (settings.maxNumTicks > 0 && gapTicks - 1e-9 > settings.maxNumTicks) continue;

      const permittedEnd = settings.maxBarsExtension > 0
        ? Math.min(segment.candles.length - 1, index + settings.maxBarsExtension)
        : segment.candles.length - 1;
      const depth = (high - low) * settings.breakoutPercent / 100;
      const threshold = direction === "up" ? high - depth : low + depth;
      const mitigation = firstMatch(direction === "up" ? lowTree : highTree, index + 1, permittedEnd, threshold);
      const endIndex = mitigation ?? permittedEnd;
      zones.push({
        direction,
        startTime: current.timestamp / 1000,
        endTime: segment.candles[endIndex].timestamp / 1000,
        low,
        high,
        extendToRight: mitigation === null && settings.maxBarsExtension === 0 && segment.reachesLiveTail,
      });
    }
  }
  return { zones, settings };
}

export function calculateFairValueGaps(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, tickSize?: number,
): CalculatedIndicatorSeries[] {
  const { zones, settings } = detectFairValueGaps(candles, raw, tickSize);
  return (["up", "down"] as const).map((direction) => {
    const sideZones = zones.filter((zone) => zone.direction === direction);
    const color = settings.useThemeColors
      ? direction === "up" ? theme.positive : theme.negative
      : direction === "up" ? settings.upColor : settings.downColor;
    return {
      key: `fvg-identifier-${direction}`,
      label: direction === "up" ? "Bullish FVG" : "Bearish FVG",
      kind: "line" as const,
      placement: "overlay" as const,
      color,
      lineVisible: false,
      lastValueVisible: false,
      excludeFromAutoScale: true,
      gapZones: { zones: sideZones, opacity: settings.backgroundOpacity / 100, borderWidth: settings.lineWidth },
      // The invisible carrier series needs strictly increasing chart times;
      // the primitive owns each zone's independent end coordinate.
      data: sideZones.map((zone, index) => ({
        time: zone.startTime,
        value: (zone.low + zone.high) / 2,
        breakBefore: index > 0,
      })),
    };
  });
}
