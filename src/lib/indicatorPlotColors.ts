import { mixHexColors, resolveVolumeProfileGradient } from "@/lib/volumeProfileGradients";

/**
 * Which colours each indicator actually paints, and what to call them.
 *
 * Every study drew straight from the chart theme, so twenty-two of the
 * twenty-six that plot anything carried no colour setting at all — the panel
 * offered "use theme colours" and nothing else. These slots give each plotted
 * series its own picker.
 *
 * The list is GENERATED from the engine rather than written by hand: each
 * entry is a series the engine really returns, and the key is derived from the
 * series key so it reads as a label ("Signal Color", "Upper Color"). A study
 * that gains or loses a plot then shows up as a slot mismatch in
 * test:indicator-plot-colors, rather than as a picker that silently controls
 * nothing.
 *
 * `role` names the theme colour the engine falls back to, so an indicator
 * nobody has touched keeps following the chart theme exactly as before.
 */
export type IndicatorThemeRole = "primary" | "secondary" | "positive" | "negative" | "muted";

export type IndicatorPlotColorSlot = {
  /** Settings key holding the override. */
  key: string;
  /** Theme colour used when the trader has not chosen one. */
  role: IndicatorThemeRole;
  /** Candlestick and histogram series also carry a rising and falling colour. */
  upRole?: IndicatorThemeRole;
  downRole?: IndicatorThemeRole;
};

export const INDICATOR_PLOT_COLOR_SLOTS: Record<string, IndicatorPlotColorSlot[]> = {
  "cumulative-volume-delta": [
    { key: "plotColor", role: "primary" },
  ],
  "cvd-divergence": [
    { key: "plotColor", role: "primary" },
    { key: "bullishColor", role: "positive" },
    { key: "bearishColor", role: "negative" },
  ],
  "delta-bar": [
    { key: "plotColor", role: "primary" },
  ],
  "delta-cumulative-candlestick": [
    { key: "plotColor", role: "primary" },
  ],
  "delta-cumulative-histogram": [
    { key: "plotColor", role: "primary" },
  ],
  "volume": [
    { key: "plotColor", role: "muted" },
  ],
  "vwap": [
    { key: "mainColor", role: "primary" },
  ],
  "vwap-envelopes": [
    { key: "mainColor", role: "primary" },
    { key: "upper1Color", role: "secondary" },
    { key: "lower1Color", role: "secondary" },
    { key: "upper2Color", role: "secondary" },
    { key: "lower2Color", role: "secondary" },
    { key: "upper3Color", role: "secondary" },
    { key: "lower3Color", role: "secondary" },
  ],
  "rolling-vwap": [
    { key: "plotColor", role: "primary" },
    { key: "upper1Color", role: "secondary" },
    { key: "lower1Color", role: "secondary" },
    { key: "upper2Color", role: "secondary" },
    { key: "lower2Color", role: "secondary" },
    { key: "upper3Color", role: "secondary" },
    { key: "lower3Color", role: "secondary" },
  ],
  "moving-average": [
    { key: "plotColor", role: "primary" },
  ],
  "keltner-channel": [
    { key: "middleColor", role: "primary" },
    { key: "upperColor", role: "secondary" },
    { key: "lowerColor", role: "secondary" },
  ],
  "bollinger-bands": [
    { key: "middleColor", role: "primary" },
    { key: "upperColor", role: "secondary" },
    { key: "lowerColor", role: "secondary" },
  ],
  "donchian-channel": [
    { key: "upperColor", role: "positive" },
    { key: "middleColor", role: "primary" },
    { key: "lowerColor", role: "negative" },
  ],
  "relative-strength-index-rsi": [
    { key: "plotColor", role: "primary" },
  ],
  "rate-of-change-roc": [
    { key: "plotColor", role: "primary" },
  ],
  "macd-indicator": [
    { key: "macdColor", role: "primary" },
    { key: "signalColor", role: "secondary" },
    { key: "histogramColor", role: "muted" },
  ],
  "momentum-indicator": [
    { key: "plotColor", role: "primary" },
  ],
  "commodity-channel-index-cci": [
    { key: "plotColor", role: "primary" },
  ],
  "aroon-up-down": [
    { key: "upColor", role: "positive" },
    { key: "downColor", role: "negative" },
  ],
  "aroon-oscillator": [
    { key: "plotColor", role: "primary" },
  ],
  "awesome-oscillator": [
    { key: "plotColor", role: "primary" },
  ],
  "stochastic-oscillator": [
    { key: "kColor", role: "primary" },
    { key: "dColor", role: "secondary" },
  ],
  "williams-r": [
    { key: "plotColor", role: "primary" },
  ],
  "chaikin-accumulation-distribution": [
    { key: "plotColor", role: "primary" },
  ],
  "standard-deviation": [
    { key: "plotColor", role: "primary" },
  ],
  "average-true-range-atr": [
    { key: "plotColor", role: "primary" },
  ],
};

/**
 * The settings key for one plotted series.
 *
 * The indicator id is stripped from the front of the series key, so
 * `macd-indicator-signal` becomes `signalColor` and a lone series becomes
 * `plotColor`. Deriving it in one place means the engine and this map cannot
 * disagree about where a colour is stored.
 */
export function indicatorSeriesColorKey(indicatorId: string, seriesKey: string): string {
  const suffix = seriesKey === indicatorId
    ? "plot"
    : seriesKey.startsWith(indicatorId)
      ? seriesKey.slice(indicatorId.length).replace(/^[-_]/, "")
      : seriesKey;
  const camel = suffix
    .split(/[-_]/)
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join("");
  return `${camel || "plot"}Color`;
}

const upKey = (key: string) => `${key.replace(/Color$/, "")}UpColor`;
const downKey = (key: string) => `${key.replace(/Color$/, "")}DownColor`;

/** Every colour setting an indicator understands, seeded from the theme. */
export function defaultIndicatorPlotColors(
  indicatorId: string,
  theme: Record<IndicatorThemeRole, string>,
): Record<string, string> {
  const slots = INDICATOR_PLOT_COLOR_SLOTS[indicatorId];
  if (!slots) return {};
  const out: Record<string, string> = {};
  for (const slot of slots) {
    out[slot.key] = theme[slot.role];
    if (slot.upRole) out[upKey(slot.key)] = theme[slot.upRole];
    if (slot.downRole) out[downKey(slot.key)] = theme[slot.downRole];
  }
  return out;
}

/**
 * A slot's position along a chosen scheme.
 *
 * Slots are declared in the order the study plots them, so spreading a scheme
 * across that order is what makes a multi-series study read as one graded
 * object - the envelopes fading out from the mean rather than each band
 * picking an unrelated colour.
 */
export function indicatorSlotGradientColor(
  gradient: { from: string; to: string },
  index: number,
  count: number,
): string {
  // A study that plots ONE series takes the scheme's finishing colour, not its
  // starting one. Picking "Red -> Terminal Green" for a lone VWAP line and
  // getting the dark red reads as the wrong scheme entirely; the end of the
  // ramp is what a trader means by "that colour".
  if (count <= 1) return gradient.to;
  if (index <= 0) return gradient.from;
  if (index >= count - 1) return gradient.to;
  return mixHexColors(gradient.from, gradient.to, index / (count - 1));
}

/** Apply a trader's chosen colours over what the engine produced. */
export function applyIndicatorPlotColors<
  T extends { key: string; color?: string; upColor?: string; downColor?: string },
>(
  indicatorId: string,
  settings: Record<string, unknown> | undefined,
  series: T[],
): T[] {
  if (!settings) return series;
  /*
   * A scheme outranks the individual pickers.
   *
   * Every study already routes its colours through here, so this is the one
   * place that has to know about schemes for all of them to gain one - rather
   * than each study growing its own copy of the same logic. Letting a scheme
   * and the pickers both apply produces a study that half-follows the scheme,
   * which reads as a bug; the panel greys the pickers out to say so.
   */
  const gradient = resolveVolumeProfileGradient(settings.gradientPreset);
  const slots = INDICATOR_PLOT_COLOR_SLOTS[indicatorId] ?? [];
  if (gradient && slots.length) {
    const colorForKey = new Map(
      slots.map((slot, index) => [slot.key, indicatorSlotGradientColor(gradient, index, slots.length)]),
    );
    return series.map((entry) => {
      const color = colorForKey.get(indicatorSeriesColorKey(indicatorId, entry.key));
      if (!color) return entry;
      // A candlestick or histogram carries a rising and falling colour too.
      // Both ends of the scheme are the natural pair for those.
      return {
        ...entry,
        color,
        ...(entry.upColor === undefined ? {} : { upColor: gradient.to }),
        ...(entry.downColor === undefined ? {} : { downColor: gradient.from }),
      };
    });
  }
  const pick = (key: string) => {
    const value = settings[key];
    return typeof value === "string" && value.trim() ? value : null;
  };
  let changed = false;
  const next = series.map((entry) => {
    const key = indicatorSeriesColorKey(indicatorId, entry.key);
    const color = pick(key);
    const up = pick(upKey(key));
    const down = pick(downKey(key));
    if (!color && !up && !down) return entry;
    changed = true;
    return {
      ...entry,
      ...(color ? { color } : {}),
      ...(up ? { upColor: up } : {}),
      ...(down ? { downColor: down } : {}),
    };
  });
  return changed ? next : series;
}
