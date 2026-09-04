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
  "deep-delta": [
    { key: "positiveColor", role: "positive" },
    { key: "negativeColor", role: "negative" },
    { key: "range1AskColor", role: "positive" },
    { key: "range1BidColor", role: "negative" },
    { key: "range2AskColor", role: "positive" },
    { key: "range2BidColor", role: "negative" },
    { key: "range3AskColor", role: "positive" },
    { key: "range3BidColor", role: "negative" },
    { key: "range4AskColor", role: "positive" },
    { key: "range4BidColor", role: "negative" },
    { key: "maximumPositiveColor", role: "positive" },
    { key: "minimumNegativeColor", role: "negative" },
    { key: "level1Color", role: "secondary" },
    { key: "level2Color", role: "secondary" },
    { key: "markerColor", role: "muted" },
  ],
  "book-speed": [
    { key: "bidColor", role: "positive" },
    { key: "askColor", role: "negative" },
    { key: "averageBidColor", role: "secondary" },
    { key: "averageAskColor", role: "negative" },
    { key: "markerBidColor", role: "positive" },
    { key: "markerAskColor", role: "negative" },
  ],
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
    { key: "upper1Color", role: "secondary" },
    { key: "lower1Color", role: "secondary" },
    { key: "upper2Color", role: "secondary" },
    { key: "lower2Color", role: "secondary" },
    { key: "upper3Color", role: "secondary" },
    { key: "lower3Color", role: "secondary" },
    { key: "upper4Color", role: "secondary" },
    { key: "lower4Color", role: "secondary" },
    { key: "upper5Color", role: "secondary" },
    { key: "lower5Color", role: "secondary" },
  ],
  "vwap-envelopes": [
    { key: "mainColor", role: "primary" },
    { key: "upper1Color", role: "secondary" },
    { key: "lower1Color", role: "secondary" },
    { key: "upper2Color", role: "secondary" },
    { key: "lower2Color", role: "secondary" },
    { key: "upper3Color", role: "secondary" },
    { key: "lower3Color", role: "secondary" },
    { key: "upper4Color", role: "secondary" },
    { key: "lower4Color", role: "secondary" },
    { key: "upper5Color", role: "secondary" },
    { key: "lower5Color", role: "secondary" },
  ],
  "rolling-vwap": [
    { key: "plotColor", role: "primary" },
    { key: "upper1Color", role: "secondary" },
    { key: "lower1Color", role: "secondary" },
    { key: "upper2Color", role: "secondary" },
    { key: "lower2Color", role: "secondary" },
    { key: "upper3Color", role: "secondary" },
    { key: "lower3Color", role: "secondary" },
    { key: "upper4Color", role: "secondary" },
    { key: "lower4Color", role: "secondary" },
    { key: "upper5Color", role: "secondary" },
    { key: "lower5Color", role: "secondary" },
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
  if (indicatorId === "deep-delta") {
    const mirroredLevel = seriesKey.match(/^deep-delta-level([12])-negative$/);
    if (mirroredLevel) return `level${mirroredLevel[1]}Color`;
  }
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
/**
 * The colours a study may seed from, guaranteed to be visible on the chart.
 *
 * A theme is free to paint a candle BODY the same colour as the chart - that is
 * what a hollow candle is, and Chromey Mono draws its bearish bars that way.
 * Studies then seeded their "negative" from that body and their "muted" from
 * the grid, and drew black bars on a black chart: CVD, the delta histograms and
 * volume all went invisible the moment that theme was selected.
 *
 * A candle body is a candle body. The colour that MEANS bearish on a hollow
 * theme is the outline, so where a body cannot be seen against the background
 * the outline stands in for it. Nothing changes for a theme whose candles are
 * solid, which is every other one.
 */
export function visibleIndicatorTheme(chart: {
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  gridColor: string;
  backgroundColor: string;
}): Record<IndicatorThemeRole, string> {
  const seen = (colour: string, instead: string) => (
    distinguishable(colour, chart.backgroundColor) ? colour : instead
  );
  // The grid is deliberately near-invisible on most themes; volume rides on
  // `muted`, so it falls back to the outline rather than to another hairline.
  const muted = seen(chart.gridColor, seen(chart.borderDownColor, chart.borderUpColor));
  const positive = seen(chart.upColor, chart.borderUpColor);
  /*
   * The two sides of a study have to be told apart from EACH OTHER, not just
   * from the background.
   *
   * Checking only against the background is why a rising and a falling CVD bar
   * could arrive the same colour: five of the palettes pair two shades of one
   * hue for up and down - brick against maroon, orange against red-orange -
   * which reads fine on candles, where position says the rest, and not at all
   * on a delta histogram where colour is the only signal.
   *
   * The falling side tries its own outline first, so a palette that already
   * distinguishes them keeps exactly the colour it chose. Only when that is
   * no help too is it separated by force.
   */
  const negative = separable(seen(chart.downColor, chart.borderDownColor), positive, chart.borderDownColor);
  return {
    primary: positive,
    secondary: seen(chart.borderUpColor, chart.upColor),
    positive,
    negative,
    muted,
  };
}

/**
 * A colour that can be told apart from `from`.
 *
 * Tries the caller's own alternative before altering anything, so a palette
 * that already separates its two sides is left exactly as its author wrote it.
 */
function separable(colour: string, from: string, alternative: string): string {
  if (colourDistance(colour, from) >= MINIMUM_SIDE_DISTANCE) return colour;
  if (colourDistance(alternative, from) >= MINIMUM_SIDE_DISTANCE) return alternative;
  // Both shades of the same hue. Push the falling side away from the rising one
  // rather than inventing a colour unrelated to the palette.
  return shiftAway(colour, from);
}

/*
 * Straight-line distance in RGB. Measured across the palettes: brick #B5482E
 * against maroon #8F2440 lands at 55 and is indistinguishable on a histogram,
 * while orange #FF8A00 against blue #28A8E0 lands past 200 and is obvious.
 */
const MINIMUM_SIDE_DISTANCE = 60;

function colourDistance(left: string, right: string): number {
  const a = channels(left);
  const b = channels(right);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function shiftAway(colour: string, from: string): string {
  const source = channels(colour);
  const other = channels(from);
  if (!source || !other) return colour;
  // Darken when the other side is bright, lighten when it is dark, so the two
  // separate by weight while both stay visible against the chart.
  const otherIsBright = (other[0] + other[1] + other[2]) / 3 >= 128;
  const shifted = source.map((value) => otherIsBright
    ? Math.max(0, Math.round(value * 0.55))
    : Math.min(255, Math.round(value + (255 - value) * 0.45)));
  return `#${shifted.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function channels(colour: string): [number, number, number] | null {
  const hex = String(colour).trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

/**
 * Whether two colours can be told apart on screen.
 *
 * Compared by relative luminance rather than by equality, because "invisible"
 * includes #0E120E on #000000 - not the same colour, and not a visible one
 * either.
 */
function distinguishable(colour: string, background: string): boolean {
  const a = luminance(colour);
  const b = luminance(background);
  if (a === null || b === null) return true;
  /*
   * A deliberately low bar. This decides only whether a colour is EFFECTIVELY
   * the background, not whether it is easy to read - a grid line is supposed to
   * be nearly invisible, and substituting for every dim colour would repaint
   * volume on most of the palettes. Measured: #0E120E on black lands at 1.12
   * and is replaced; the usual #1F1F1F gridline lands at 1.30 and is left
   * alone.
   */
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 1.2;
}

function luminance(colour: string): number | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(colour).trim());
  if (!hex) return null;
  const channels = [0, 2, 4].map((at) => {
    const value = parseInt(hex[1].slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

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
/**
 * Recolour a series that paints its bars individually.
 *
 * A histogram like Volume does not take one colour: every point carries its
 * own, set from the theme's positive or negative to show direction. Setting
 * only the series colour therefore changed nothing a trader could see - the
 * picker and the scheme were both dead on it, which is what "volume doesn't
 * even work" meant.
 *
 * The theme is what says which of those two a point is, so direction survives
 * being recoloured instead of every bar flattening to one colour.
 */
function recolourPoints<T extends { data?: unknown }>(
  entry: T,
  theme: Partial<Record<IndicatorThemeRole, string>> | undefined,
  up: string,
  down: string,
): T {
  if (!Array.isArray(entry.data) || !entry.data.length) return entry;
  const positive = theme?.positive?.toLowerCase();
  const negative = theme?.negative?.toLowerCase();
  let touched = false;
  const data = (entry.data as { color?: string }[]).map((point) => {
    if (typeof point?.color !== "string") return point;
    const current = point.color.toLowerCase();
    // Anything that is neither of the theme's two direction colours is left
    // alone: it was deliberate, not a default.
    const next = current === positive ? up : current === negative ? down : null;
    if (!next || next.toLowerCase() === current) return point;
    touched = true;
    return { ...point, color: next };
  });
  return touched ? { ...entry, data } : entry;
}

export function applyIndicatorPlotColors<
  T extends { key: string; color?: string; upColor?: string; downColor?: string; data?: unknown },
>(
  indicatorId: string,
  settings: Record<string, unknown> | undefined,
  series: T[],
  /**
   * The theme the series was computed with, so a per-point colour can be
   * recognised as "the positive one" rather than guessed at by luminance.
   */
  theme?: Partial<Record<IndicatorThemeRole, string>>,
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
      const recoloured = recolourPoints(entry, theme, gradient.to, gradient.from);
      return {
        ...recoloured,
        color,
        ...(entry.upColor === undefined ? {} : { upColor: gradient.to }),
        ...(entry.downColor === undefined ? {} : { downColor: gradient.from }),
      };
    });
  }
  /*
   * In theme mode the stored colours are not choices, so they must not apply.
   *
   * A study that plots one series carries one colour setting, and a study that
   * paints its bars by direction carries per-point colours. Where both are
   * true, the single setting was being pushed into BOTH directions below -
   * `up ?? color`, `down ?? color` - so every rising and falling bar collapsed
   * onto the same colour. Eight studies did this: CVD and its three delta
   * variants, Volume, Delta Bar, the MACD histogram and the Awesome
   * Oscillator.
   *
   * It was invisible to every colour-layer check because the colour APPLIED
   * was correct; there was simply only ever one of it. And it was invisible in
   * a settings dialog too, because with the theme driving them those values
   * are defaults nobody chose.
   *
   * Picking a colour sets `useThemeColors: false`, which is what makes a
   * deliberate choice reach the bars - the behaviour that put this line here.
   * A scheme still outranks both and is handled above.
   */
  if (settings.useThemeColors !== false) return series;
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
    /*
     * A chosen colour has to reach the bars as well as the series. Without
     * this, picking a colour for Volume moved a value nothing reads.
     */
    const recoloured = recolourPoints(entry, theme, up ?? color ?? "", down ?? color ?? "");
    return {
      ...recoloured,
      ...(color ? { color } : {}),
      ...(up ? { upColor: up } : {}),
      ...(down ? { downColor: down } : {}),
    };
  });
  return changed ? next : series;
}
