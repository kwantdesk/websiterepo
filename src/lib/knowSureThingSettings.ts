import type { IndicatorNumericSetting } from "./chartIndicatorConfig";
import type { KstAverage, KstParameters } from "./knowSureThing";

/** Observed DeepCharts settings; theme ownership is KwantDesk's convention. */
export const KST_DEFAULTS = {
  roc1: 10, roc2: 15, roc3: 20, roc4: 30,
  average1: 10, average2: 10, average3: 10, average4: 15,
  signalPeriod: 9, averageType: "simple", usePercent: false,
  middleLevel: 0, middleLineWidth: 1, showMiddle: true,
  showKst: true, showSignal: true,
  kstColorMode: "slope", signalColorMode: "none",
  kstDisplayStyle: "line", signalDisplayStyle: "line",
  kstLineStyle: "solid", signalLineStyle: "dashed",
  kstLineWidth: 2, signalLineWidth: 1,
  kstShortName: "KST", signalShortName: "Sig",
  kstNameLabel: false, signalNameLabel: false,
  kstValueLabel: false, signalValueLabel: false,
  kstNameBackground: false, signalNameBackground: false,
  kstValueBackground: false, signalValueBackground: false,
  kstChartMarker: false, signalChartMarker: false,
  kstAutoCenter: true, signalAutoCenter: true,
  useThemeColors: true,
};

export const KST_NUMERIC_SETTINGS: IndicatorNumericSetting[] = [
  ...([1, 2, 3, 4] as const).map(i => ({ key: `roc${i}`, label: `ROC length ${i}`, defaultValue: KST_DEFAULTS[`roc${i}`], min: 1, max: 1000, step: 1 })),
  ...([1, 2, 3, 4] as const).map(i => ({ key: `average${i}`, label: `Average length ${i}`, defaultValue: KST_DEFAULTS[`average${i}`], min: 1, max: 1000, step: 1 })),
  { key: "signalPeriod", label: "Signal period", defaultValue: 9, min: 1, max: 1000, step: 1 },
  { key: "middleLevel", label: "Middle level", defaultValue: 0, min: -1000000000, max: 1000000000, step: 0.01 },
  { key: "middleLineWidth", label: "Middle line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  { key: "kstLineWidth", label: "KST line width", defaultValue: 2, min: 1, max: 4, step: 1 },
  { key: "signalLineWidth", label: "Signal line width", defaultValue: 1, min: 1, max: 4, step: 1 },
];

export function normalizeKstSettings(raw: Record<string, unknown> = {}): Record<string, number | string | boolean> {
  const settings: Record<string, number | string | boolean> = { ...KST_DEFAULTS };
  // Preserve extra existing colour/template keys, without admitting structured
  // data into the scalar settings contract.
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) settings[key] = value;
  }
  for (const field of KST_NUMERIC_SETTINGS) {
    const value = Number(raw[field.key] ?? field.defaultValue);
    const valid = Number.isFinite(value) ? Math.min(field.max, Math.max(field.min, value)) : field.defaultValue;
    const step = field.step ?? 1;
    settings[field.key] = step === 1 ? Math.round(valid) : Math.round(valid / step) * step;
  }
  const pick = (key: string, allowed: readonly string[], fallback: string) => {
    settings[key] = typeof raw[key] === "string" && allowed.includes(raw[key]) ? raw[key] : fallback;
  };
  pick("averageType", ["simple", "exponential", "triangular", "weighted"], "simple");
  for (const prefix of ["kst", "signal"] as const) {
    pick(`${prefix}ColorMode`, ["none", "slope"], KST_DEFAULTS[`${prefix}ColorMode`]);
    pick(`${prefix}DisplayStyle`, ["line", "points", "line-points"], "line");
    pick(`${prefix}LineStyle`, ["solid", "dashed", "dotted"], KST_DEFAULTS[`${prefix}LineStyle`]);
    const nameKey = `${prefix}ShortName` as const;
    settings[nameKey] = typeof raw[nameKey] === "string" ? raw[nameKey].trim().slice(0, 24) || KST_DEFAULTS[nameKey] : KST_DEFAULTS[nameKey];
  }
  for (const [key, value] of Object.entries(KST_DEFAULTS)) {
    if (typeof value === "boolean") settings[key] = typeof raw[key] === "boolean" ? raw[key] : value;
  }
  return settings;
}

export function kstParametersFromSettings(raw: Record<string, unknown>): KstParameters {
  const s = normalizeKstSettings(raw);
  return {
    rocLengths: [Number(s.roc1), Number(s.roc2), Number(s.roc3), Number(s.roc4)],
    averageLengths: [Number(s.average1), Number(s.average2), Number(s.average3), Number(s.average4)],
    signalPeriod: Number(s.signalPeriod), averageType: s.averageType as KstAverage, usePercent: s.usePercent === true,
  };
}

export function kstRequiredBars(raw: Record<string, unknown>): number {
  const p = kstParametersFromSettings(raw);
  return Math.max(...p.rocLengths.map((roc, i) => roc + p.averageLengths[i])) + p.signalPeriod - 1;
}
