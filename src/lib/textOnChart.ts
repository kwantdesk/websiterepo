import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";

export const TEXT_ON_CHART_DEFAULTS = {
  fontSize: 30, textColor: "#FFFFFF", backgroundColor: "#333333", text: "", useThemeColors: true,
} as const;

export function normalizeTextOnChartSettings(raw: Record<string, unknown> = {}) {
  const merged = { ...TEXT_ON_CHART_DEFAULTS, ...raw };
  const size = Number(merged.fontSize);
  return { ...merged, fontSize: Math.min(50, Math.max(6, Number.isFinite(size) ? size : 30)),
    text: String(merged.text ?? "").slice(0, 2000), useThemeColors: (merged.useThemeColors as unknown) !== false };
}

export function calculateTextOnChart(candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme): CalculatedIndicatorSeries[] {
  if (!candles.length) return [];
  const settings = normalizeTextOnChartSettings(raw);
  const last = candles.at(-1)!;
  return [{ key: "text-on-chart", label: "Text on Chart", kind: "line", placement: "overlay",
    color: "rgba(0,0,0,0)", lineVisible: false, lastValueVisible: false, excludeFromAutoScale: true,
    textOnChart: { text: settings.text, fontSize: settings.fontSize,
      textColor: settings.useThemeColors ? theme.primary : String(settings.textColor),
      backgroundColor: settings.useThemeColors ? theme.muted : String(settings.backgroundColor) },
    data: [{ time: last.timestamp / 1000, value: last.close }] }];
}
