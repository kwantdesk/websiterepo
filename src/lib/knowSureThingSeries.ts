import type { Candle } from "./backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "./chartIndicatorEngine";
import { calculateKstValues } from "./knowSureThing";
import { kstParametersFromSettings, normalizeKstSettings } from "./knowSureThingSettings";
import { indicatorSlotGradientColor } from "./indicatorPlotColors";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

/** Opt-in presentation carried only by the pending KST implementation. */
export type KstPanePresentation = {
  nameLabel: boolean; valueLabel: boolean;
  nameBackground: boolean; valueBackground: boolean;
  chartMarker: boolean;
};
export type KstSeries = CalculatedIndicatorSeries & { kstPresentation?: KstPanePresentation };

export const KST_COLOR_SLOTS = [
  { key: "kstColor", role: "primary" },
  { key: "kstSecondaryColor", role: "negative" },
  { key: "signalColor", role: "secondary" },
  { key: "signalSecondaryColor", role: "positive" },
  { key: "middleColor", role: "muted" },
] as const;

/** Returns fully owned styles/colours; do not run generic recolouring afterward. */
export function calculateKstSeries(
  candles: readonly Candle[], raw: Record<string, unknown>, theme: IndicatorTheme,
): KstSeries[] {
  const s = normalizeKstSettings(raw);
  const values = calculateKstValues(candles, kstParametersFromSettings(s));
  const gradient = resolveVolumeProfileGradient(s.gradientPreset);
  const colours = Object.fromEntries(KST_COLOR_SLOTS.map((slot, i) => {
    const custom = s[slot.key];
    return [slot.key, gradient ? indicatorSlotGradientColor(gradient, i, KST_COLOR_SLOTS.length)
      : s.useThemeColors === false && typeof custom === "string" && custom.trim() ? custom : theme[slot.role]];
  }));
  const result: KstSeries[] = [];
  for (const prefix of ["kst", "signal"] as const) {
    if (s[prefix === "kst" ? "showKst" : "showSignal"] === false || !values[prefix].length) continue;
    const colour = colours[`${prefix}Color`];
    let previous: number | undefined;
    const data = values[prefix].map(point => {
      if (point.breakBefore) previous = undefined;
      const color = s[`${prefix}ColorMode`] === "slope" && previous !== undefined && point.value < previous
        ? colours[`${prefix}SecondaryColor`] : colour;
      previous = point.value;
      return { ...point, color };
    });
    result.push({
      key: `know-sure-thing-kst-${prefix}`, label: String(s[`${prefix}ShortName`]),
      kind: "line", placement: "pane", color: colour,
      lineWidth: s[`${prefix}LineWidth`] as 1 | 2 | 3 | 4,
      lineStyle: s[`${prefix}LineStyle`] as "solid" | "dashed" | "dotted",
      lineVisible: s[`${prefix}DisplayStyle`] !== "points",
      pointMarkersVisible: s[`${prefix}DisplayStyle`] !== "line",
      excludeFromAutoScale: s[`${prefix}AutoCenter`] === false,
      lastValueVisible: s[`${prefix}ValueLabel`] === true,
      kstPresentation: {
        nameLabel: s[`${prefix}NameLabel`] === true, valueLabel: s[`${prefix}ValueLabel`] === true,
        nameBackground: s[`${prefix}NameBackground`] === true, valueBackground: s[`${prefix}ValueBackground`] === true,
        chartMarker: s[`${prefix}ChartMarker`] === true,
      }, data,
    });
  }
  // Do not show a false, apparently calculated zero panel during warmup.
  if (s.showMiddle && values.kst.length) {
    result.push({ key: "know-sure-thing-kst-middle", label: "Middle", kind: "line", placement: "pane",
      color: colours.middleColor, lineWidth: s.middleLineWidth as 1 | 2 | 3 | 4, lineStyle: "dotted",
      horizontalPriceLine: true, lastValueVisible: false,
      data: [{ time: values.kst[0].time, value: Number(s.middleLevel) }],
    });
  }
  return result;
}
