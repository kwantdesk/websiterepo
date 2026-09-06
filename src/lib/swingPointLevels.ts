import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import type { SwingPointLevelOptions } from "./swingPointLevelPrimitive";

export const SWING_POINT_DEFAULTS = {
  leftBars: 2, rightBars: 2, filterSwing: false,
  displayMode: "line", lineWidth: 2, lineStyle: "dashed",
  textTickOffset: 1, textSize: 11, useThemeColors: true,
  highColor: "#22C55E", lowColor: "#EF4444",
  highTextColor: "#FFFFFF", lowTextColor: "#FFFFFF",
} as const;

type Swing = { index: number; type: "high" | "low"; value: number; segment: number; segmentEnd: number };
const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
};

export function normalizeSwingPointSettings(raw: Record<string, unknown> = {}) {
  const merged = { ...SWING_POINT_DEFAULTS, ...raw };
  const displayMode = ["line", "text", "line-and-text"].includes(String(merged.displayMode))
    ? String(merged.displayMode) : "line";
  const lineStyle = ["solid", "dashed", "dotted", "dash-dot", "dash-dot-dot"].includes(String(merged.lineStyle))
    ? String(merged.lineStyle) : "dashed";
  return {
    ...merged,
    leftBars: Math.round(bounded(merged.leftBars, 2, 1, 500)),
    rightBars: Math.round(bounded(merged.rightBars, 2, 0, 500)),
    filterSwing: (merged.filterSwing as unknown) === true,
    displayMode,
    lineWidth: Math.round(bounded(merged.lineWidth, 2, 1, 4)),
    lineStyle,
    textTickOffset: Math.round(bounded(merged.textTickOffset, 1, -1000, 1000)),
    textSize: bounded(merged.textSize, 11, 6, 50),
    useThemeColors: (merged.useThemeColors as unknown) !== false,
  };
}

function confirmedSwings(candles: readonly Candle[], left: number, right: number): Swing[] {
  const swings: Swing[] = [];
  const ranges: Array<{ start: number; end: number }> = [];
  let start = -1;
  candles.forEach((candle, index) => {
    const previous = index > 0 ? candles[index - 1] : undefined;
    const valid = [candle.timestamp, candle.high, candle.low].every(Number.isFinite);
    const continuous = valid && (!previous || !Number.isFinite(previous.timestamp) || candle.timestamp > previous.timestamp);
    if (!continuous) {
      if (start >= 0) ranges.push({ start, end: index - 1 });
      start = valid ? index : -1;
    } else if (start < 0) start = index;
  });
  if (start >= 0) ranges.push({ start, end: candles.length - 1 });

  ranges.forEach((range, segment) => {
    for (let index = range.start + left; index <= range.end - right; index += 1) {
      const candle = candles[index];
      const before = candles.slice(index - left, index);
      const after = candles.slice(index + 1, index + right + 1);
      const high = before.every(item => item.high <= candle.high)
        && after.every(item => item.high < candle.high);
      const low = before.every(item => item.low >= candle.low)
        && after.every(item => item.low > candle.low);
      if (high) swings.push({ index, type: "high", value: candle.high, segment, segmentEnd: range.end });
      if (low) swings.push({ index, type: "low", value: candle.low, segment, segmentEnd: range.end });
    }
  });
  return swings;
}

function filterAlternating(swings: Swing[]): Swing[] {
  const filtered: Swing[] = [];
  for (const swing of swings) {
    const previous = filtered.at(-1);
    if (!previous || previous.segment !== swing.segment || previous.type !== swing.type) { filtered.push(swing); continue; }
    const moreExtreme = swing.type === "high" ? swing.value >= previous.value : swing.value <= previous.value;
    if (moreExtreme) filtered[filtered.length - 1] = swing;
  }
  return filtered;
}

export function calculateSwingPoints(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
  tickSize = 0,
): CalculatedIndicatorSeries[] {
  const settings = normalizeSwingPointSettings(raw);
  if (candles.length < settings.leftBars + settings.rightBars + 1) return [];
  const swings = settings.filterSwing
    ? filterAlternating(confirmedSwings(candles, settings.leftBars, settings.rightBars))
    : confirmedSwings(candles, settings.leftBars, settings.rightBars);
  if (!swings.length) return [];
  const lineColor = (side: "high" | "low") => settings.useThemeColors
    ? side === "high" ? theme.positive : theme.negative
    : String(side === "high" ? settings.highColor : settings.lowColor);
  const textColor = (side: "high" | "low") => settings.useThemeColors
    ? theme.primary : String(side === "high" ? settings.highTextColor : settings.lowTextColor);
  const make = (side: "high" | "low"): CalculatedIndicatorSeries => {
    const points: CalculatedIndicatorSeries["data"] = [];
    swings.forEach((swing, position) => {
      if (swing.type !== side) return;
      const next = swings[position + 1];
      const end = next?.segment === swing.segment ? next.index : swing.segmentEnd;
      points.push({ time: candles[swing.index].timestamp / 1000, value: swing.value, breakBefore: true });
      if (end > swing.index) points.push({ time: candles[end].timestamp / 1000, value: swing.value });
    });
    const options: SwingPointLevelOptions = {
      side, displayMode: settings.displayMode as SwingPointLevelOptions["displayMode"],
      lineStyle: settings.lineStyle as SwingPointLevelOptions["lineStyle"],
      lineWidth: settings.lineWidth, lineColor: lineColor(side), textColor: textColor(side),
      textSize: settings.textSize, textOffset: tickSize * settings.textTickOffset,
    };
    return { key: `swing-point-${side}`, label: side === "high" ? "Swing High" : "Swing Low",
      kind: "line", placement: "overlay", color: lineColor(side), lineVisible: false,
      lastValueVisible: false, swingPointLevels: options, data: points };
  };
  return [make("high"), make("low")].filter(series => series.data.length);
}
