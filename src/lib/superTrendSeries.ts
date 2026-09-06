import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { calculateSuperTrendValues, type SuperTrendPoint } from "./superTrend";
import { normalizeSuperTrendSettings } from "./superTrendSettings";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export function calculateSuperTrendSeries(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, difference = false,
): CalculatedIndicatorSeries[] {
  const s = normalizeSuperTrendSettings(raw, difference);
  const values = calculateSuperTrendValues(candles, { length: Number(s.length), multiplier: Number(s.multiplier) });
  return paintSuperTrendSeries(values, s, theme, instanceId, difference);
}

export function paintSuperTrendSeries(
  values: readonly SuperTrendPoint[], raw: Record<string, unknown>, theme: IndicatorTheme,
  instanceId: string, difference = false, previousValue?: number,
): CalculatedIndicatorSeries[] {
  const s = normalizeSuperTrendSettings(raw, difference);
  if (!values.length) return [];
  const gradient = resolveVolumeProfileGradient(s.gradientPreset);
  const pick = (key: string, fallback: string) => s.useThemeColors === false
    && typeof s[key] === "string" && String(s[key]).trim() ? String(s[key]) : fallback;
  const primary = gradient?.from ?? pick("plotColor", theme.positive);
  const secondary = gradient?.to ?? pick("secondaryColor", theme.negative);
  let previous = previousValue;
  const data = values.map(point => {
    if (point.breakBefore) previous = undefined;
    const value = difference ? point.difference : point.value;
    const negative = s.colorMode === "slope" ? previous !== undefined && value < previous
      : s.colorMode === "none" ? false : difference ? value < 0 : point.direction === "down";
    previous = value;
    return { time: point.time, value, color: negative ? secondary : primary,
      ...(point.breakBefore ? { breakBefore: true } : {}) };
  });
  return [{ key: `${difference ? "super-trend-difference" : "super-trend"}-${instanceId}`, label: String(s.shortName),
    superTrendStyleKey: JSON.stringify([s, theme]),
    kind: difference && s.displayStyle === "histogram" ? "histogram" : "line",
    placement: difference ? "pane" : "overlay", color: primary,
    lineWidth: s.lineWidth as 1 | 2 | 3 | 4,
    lineStyle: s.lineStyle as "solid" | "dashed" | "dotted",
    lineVisible: difference || s.displayStyle !== "points",
    pointMarkersVisible: !difference && s.displayStyle !== "line",
    lastValueVisible: false,
    excludeFromAutoScale: !difference && s.includeOnAutoCenter === false,
    independentScale: !difference && s.useSecondaryAxis === true,
    priceScaleId: !difference && s.useSecondaryAxis === true ? `super-trend-${instanceId}` : undefined,
    ...(difference ? { showZeroLine: true, includeZeroInScale: true, histogramBarWidth: Number(s.lineWidth) }
      : { superTrendLabels: { name: String(s.shortName), nameLabel: s.nameLabel === true, valueLabel: s.valueLabel === true,
        nameBackground: s.nameBackground === true, valueBackground: s.valueBackground === true,
        chartColorForMarker: s.chartColorForMarker === true } }), data }];
}
