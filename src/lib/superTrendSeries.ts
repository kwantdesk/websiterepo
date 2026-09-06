import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { calculateSuperTrendValues } from "./superTrend";
import { normalizeSuperTrendSettings } from "./superTrendSettings";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export function calculateSuperTrendSeries(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, difference = false,
): CalculatedIndicatorSeries[] {
  const s = normalizeSuperTrendSettings(raw, difference);
  const values = calculateSuperTrendValues(candles, { length: Number(s.length), multiplier: Number(s.multiplier) });
  if (!values.length) return [];
  const gradient = resolveVolumeProfileGradient(s.gradientPreset);
  const pick = (key: string, fallback: string) => s.useThemeColors === false
    && typeof s[key] === "string" && String(s[key]).trim() ? String(s[key]) : fallback;
  const primary = gradient?.from ?? pick("plotColor", theme.positive);
  const secondary = gradient?.to ?? pick("secondaryColor", theme.negative);
  let previous: number | undefined;
  const data = values.map(point => {
    if (point.breakBefore) previous = undefined;
    const value = difference ? point.difference : point.value;
    const negative = s.colorMode === "slope" ? previous !== undefined && value < previous
      : s.colorMode === "none" ? false : difference ? value < 0 : point.direction === "down";
    previous = value;
    return { time: point.time, value, color: negative ? secondary : primary,
      ...(point.breakBefore ? { breakBefore: true } : {}) };
  });
  return [{ key: difference ? "super-trend-difference" : "super-trend", label: String(s.shortName),
    kind: difference && s.displayStyle === "histogram" ? "histogram" : "line",
    placement: difference ? "pane" : "overlay", color: primary,
    lineWidth: s.lineWidth as 1 | 2 | 3 | 4,
    lineStyle: s.lineStyle as "solid" | "dashed" | "dotted",
    lineVisible: difference || s.displayStyle !== "points",
    pointMarkersVisible: !difference && s.displayStyle !== "line",
    lastValueVisible: !difference && s.valueLabel === true,
    excludeFromAutoScale: !difference && s.includeOnAutoCenter === false,
    independentScale: !difference && s.useSecondaryAxis === true,
    priceScaleId: !difference && s.useSecondaryAxis === true ? `super-trend-${instanceId}` : undefined,
    ...(difference ? { showZeroLine: true, includeZeroInScale: true, histogramBarWidth: Number(s.lineWidth) } : {}), data }];
}
