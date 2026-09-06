import type { IndicatorNumericSetting } from "./chartIndicatorConfig";

export const SUPER_TREND_DEFAULTS = {
  length: 10, multiplier: 3, lineWidth: 1, lineStyle: "solid",
  displayStyle: "line", colorMode: "direction", shortName: "ST", chartArea: "overlay",
  useThemeColors: true, useSecondaryAxis: false, includeOnAutoCenter: true,
  valueLabel: false, nameLabel: false, nameBackground: false,
  valueBackground: false, chartColorForMarker: false,
  alertSoundEnabled: false, messagePopupEnabled: false, alertName: "Super Trend",
};
export const SUPER_TREND_DIFFERENCE_DEFAULTS = {
  length: 10, multiplier: 3, lineWidth: 4, lineStyle: "solid",
  displayStyle: "histogram", colorMode: "sign", shortName: "STD",
  useThemeColors: true, includeOnAutoCenter: true,
  valueLabel: false, nameLabel: false, nameBackground: false,
  valueBackground: false, chartColorForMarker: false,
};

export const superTrendNumericSettings = (difference = false): IndicatorNumericSetting[] => [
  { key: "length", label: "ATR length", defaultValue: 10, min: 1, max: 1000, step: 1 },
  { key: "multiplier", label: "ATR multiplier", defaultValue: 3, min: 0.01, max: 100, step: 0.01 },
  { key: "lineWidth", label: difference ? "Plot width" : "Line width", defaultValue: difference ? 4 : 1, min: 1, max: 4, step: 1 },
];

export function normalizeSuperTrendSettings(raw: Record<string, unknown> = {}, difference = false): Record<string, number | string | boolean> {
  const defaults = difference ? SUPER_TREND_DIFFERENCE_DEFAULTS : SUPER_TREND_DEFAULTS;
  const result: Record<string, number | string | boolean> = { ...defaults };
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  for (const field of superTrendNumericSettings(difference)) {
    const n = Number(raw[field.key] ?? field.defaultValue);
    const bounded = Number.isFinite(n) ? Math.min(field.max, Math.max(field.min, n)) : field.defaultValue;
    result[field.key] = Math.round(bounded / (field.step ?? 1)) * (field.step ?? 1);
  }
  for (const [key, fallback] of Object.entries(defaults)) {
    if (typeof fallback === "boolean") result[key] = typeof raw[key] === "boolean" ? raw[key] : fallback;
  }
  const choose = (key: string, options: string[], fallback: string) => {
    result[key] = typeof raw[key] === "string" && options.includes(raw[key]) ? raw[key] : fallback;
  };
  choose("displayStyle", difference ? ["histogram", "line"] : ["line", "points", "line-points"], defaults.displayStyle);
  choose("colorMode", difference ? ["sign", "none", "slope"] : ["direction", "none", "slope"], defaults.colorMode);
  choose("lineStyle", ["solid", "dashed", "dotted"], "solid");
  if (!difference) choose("chartArea", ["overlay", "pane"], "overlay");
  result.shortName = typeof raw.shortName === "string" ? raw.shortName.trim().slice(0, 40) || defaults.shortName : defaults.shortName;
  if (!difference) result.alertName = typeof raw.alertName === "string" ? raw.alertName.trim().slice(0, 80) || "Super Trend" : "Super Trend";
  return result;
}
