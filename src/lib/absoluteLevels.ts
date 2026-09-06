import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const ABSOLUTE_LEVEL_DEFAULTS = {
  firstValue: 0, secondValue: 0, firstLineWidth: 1, secondLineWidth: 1,
  firstLineStyle: "solid", secondLineStyle: "solid", useThemeColors: true,
};

export function calculateAbsoluteLevels(
  candles: Candle[], settings: Record<string, unknown>, theme: IndicatorTheme,
): CalculatedIndicatorSeries[] {
  // The prices are user references, not forecasts or values inferred from data.
  // A single real chart timestamp anchors the horizontal price line without
  // adding synthetic future timestamps or scanning all loaded history.
  const time = (candles.at(-1)?.timestamp ?? NaN) / 1000;
  if (!Number.isFinite(time)) return [];
  return (["first", "second"] as const).flatMap((side, index) => {
    const raw = settings[`${side}Value`] === undefined ? ABSOLUTE_LEVEL_DEFAULTS[`${side}Value`] : settings[`${side}Value`];
    if (raw === "" || raw === null || typeof raw === "boolean") return [];
    const value = Number(raw);
    if (!Number.isFinite(value)) return [];
    const style = settings[`${side}LineStyle`];
    const width = Number(settings[`${side}LineWidth`] ?? 1);
    return [{
      key: `absolute-levels-${side}-line`, label: `${index ? "Second" : "First"} Level`,
      kind: "line" as const, placement: "overlay" as const,
      color: index ? theme.secondary : theme.primary,
      lineWidth: Math.min(4, Math.max(1, Math.round(Number.isFinite(width) ? width : 1))) as 1 | 2 | 3 | 4,
      lineStyle: style === "dashed" || style === "dotted" ? style : "solid",
      horizontalPriceLine: true, excludeFromAutoScale: true,
      lastValueVisible: true, data: [{ time, value }],
    }];
  });
}
