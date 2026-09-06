import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import { exchangeDateKey } from "@/lib/exchangeClock";

export type GapZone = {
  direction: "up" | "down";
  startTime: number;
  endTime: number;
  low: number;
  high: number;
};

export const GAP_DETECTOR_DEFAULTS = {
  gapMode: "day-begin",
  calculationMode: "tick",
  percentValue: 1,
  tickValue: 20,
  triggerWholeBar: true,
  backgroundOpacity: 40,
  useThemeColors: true,
};

export type GapDetectorSettings = typeof GAP_DETECTOR_DEFAULTS;

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function normalizeGapDetectorSettings(raw: Record<string, unknown>): GapDetectorSettings {
  return {
    gapMode: raw.gapMode === "always" ? "always" : "day-begin",
    calculationMode: raw.calculationMode === "percent" ? "percent" : "tick",
    percentValue: Math.max(0, Math.min(100, finite(raw.percentValue, 1))),
    tickValue: Math.max(0, Math.min(100_000, finite(raw.tickValue, 20))),
    triggerWholeBar: raw.triggerWholeBar !== false,
    backgroundOpacity: Math.max(0, Math.min(100, Math.round(finite(raw.backgroundOpacity, 40)))),
    useThemeColors: raw.useThemeColors !== false,
  };
}

type ExtremumTree = { size: number; values: Float64Array; mode: "min" | "max" };

function buildExtremumTree(values: number[], mode: "min" | "max"): ExtremumTree {
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

function firstMatching(tree: ExtremumTree, start: number, threshold: number): number | null {
  const matches = (value: number) => tree.mode === "min" ? value <= threshold : value >= threshold;
  const visit = (node: number, left: number, right: number): number | null => {
    if (right < start || !matches(tree.values[node])) return null;
    if (left === right) return left;
    const middle = Math.floor((left + right) / 2);
    return visit(node * 2, left, middle) ?? visit(node * 2 + 1, middle + 1, right);
  };
  return visit(1, 0, tree.size - 1);
}

export function detectGapZones(
  candles: Candle[], raw: Record<string, unknown>, tickSize = 0.25,
): { zones: GapZone[]; settings: GapDetectorSettings } {
  const settings = normalizeGapDetectorSettings(raw);
  const ordered = candles.filter((candle) => [candle.timestamp, candle.high, candle.low, candle.close]
    .every((value) => Number.isFinite(value))).slice().sort((a, b) => a.timestamp - b.timestamp);
  if (ordered.length < 2) return { zones: [], settings };
  const minimumTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const lowTree = buildExtremumTree(ordered.map((candle) => candle.low), "min");
  const highTree = buildExtremumTree(ordered.map((candle) => candle.high), "max");
  const zones: GapZone[] = [];
  const lastTime = ordered.at(-1)!.timestamp / 1000;

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (settings.gapMode === "day-begin"
      && exchangeDateKey(previous.timestamp, "America/Chicago") === exchangeDateKey(current.timestamp, "America/Chicago")) continue;
    const direction = current.low > previous.high ? "up" : current.high < previous.low ? "down" : null;
    if (!direction) continue;
    const low = direction === "up" ? previous.high : current.high;
    const high = direction === "up" ? current.low : previous.low;
    const gap = high - low;
    const qualifies = settings.calculationMode === "percent"
      ? (gap / Math.max(Math.abs(previous.close), Number.EPSILON)) * 100 >= settings.percentValue
      : gap / minimumTick >= settings.tickValue;
    if (!qualifies) continue;

    const fillThreshold = direction === "up"
      ? (settings.triggerWholeBar ? low : high)
      : (settings.triggerWholeBar ? high : low);
    const fillIndex = firstMatching(direction === "up" ? lowTree : highTree, index + 1, fillThreshold);
    zones.push({
      direction,
      startTime: current.timestamp / 1000,
      endTime: fillIndex !== null && fillIndex < ordered.length ? ordered[fillIndex].timestamp / 1000 : lastTime,
      low,
      high,
    });
  }
  return { zones, settings };
}

export function calculateGapDetector(
  candles: Candle[], raw: Record<string, unknown>, theme: IndicatorTheme, tickSize?: number,
): CalculatedIndicatorSeries[] {
  const { zones, settings } = detectGapZones(candles, raw, tickSize);
  return (["up", "down"] as const).map((direction) => {
    const sideZones = zones.filter((zone) => zone.direction === direction);
    const color = direction === "up" ? theme.positive : theme.negative;
    return {
      key: `gap-detector-${direction}`,
      label: direction === "up" ? "Gap Up" : "Gap Down",
      kind: "line" as const,
      placement: "overlay" as const,
      color,
      lineVisible: false,
      lastValueVisible: false,
      excludeFromAutoScale: true,
      gapZones: { zones: sideZones, opacity: settings.backgroundOpacity / 100 },
      data: sideZones.flatMap((zone, index) => [
        { time: zone.startTime, value: (zone.low + zone.high) / 2, breakBefore: index > 0 },
        { time: zone.endTime, value: (zone.low + zone.high) / 2 },
      ]),
    };
  });
}
