import {
  INDICATOR_GRADIENT_KEY,
  gradientStop,
} from "@/lib/indicatorPalettes";
import { resolveVolumeProfileGradient } from "@/lib/volumeProfileGradients";

/**
 * How the price series is drawn, and in what colours.
 *
 * The candles were the one thing on the chart with no settings at all - a
 * visibility toggle in the indicator list and nothing else - while every study
 * drawn on top of them had a dialog. Their colours came from the chart theme
 * and could not be changed per chart.
 *
 * The knobs are the ones the desks that traders come from actually expose.
 * Read out of the installed platforms rather than guessed: DeepChart carries
 * HollowFill, BodyOpacity, BorderColor, BorderWidth, FixedBorder, CandleWidth,
 * ShadowOpacity and MinBodyTick on its bars; ATAS carries a CandleVisualMode of
 * Candles or Bars, with Renko, Range, Delta and Reversal being how it
 * AGGREGATES rather than how it draws, which this platform already handles as
 * timeframes.
 *
 * Bars, Line and Area are deliberately absent for now. Lightweight Charts needs
 * a different series object for those, and every profile, level, drawing and
 * footprint on the chart is attached to the candle series - swapping it means
 * re-attaching all of them, which is its own change rather than a footnote to
 * this one.
 */

export const CANDLE_STYLES = [
  {
    id: "candles",
    label: "Candles",
    detail: "Filled bodies, the standard rendering.",
  },
  {
    id: "hollow",
    label: "Hollow candles",
    detail: "Up bars drawn as an outline, down bars filled - direction reads as weight.",
  },
  {
    id: "heikin-ashi",
    label: "Heikin Ashi",
    detail: "Averaged bodies that smooth noise. The values are derived, not traded prices.",
  },
  {
    id: "heikin-ashi-hollow",
    label: "Heikin Ashi hollow",
    detail: "The same averaging, drawn as outlines.",
  },
] as const;

export type CandleStyleId = typeof CANDLE_STYLES[number]["id"];

export type CandleThemeColors = {
  up: string;
  down: string;
  borderUp: string;
  borderDown: string;
  wickUp: string;
  wickDown: string;
};

export type CandleSeriesColors = {
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  borderVisible: boolean;
  wickVisible: boolean;
};

/** The settings keys the dialog writes, so the pickers and this agree. */
export const CANDLE_SETTING_KEYS = {
  style: "candleStyle",
  up: "candleUpColor",
  down: "candleDownColor",
  borderUp: "candleBorderUpColor",
  borderDown: "candleBorderDownColor",
  wickUp: "candleWickUpColor",
  wickDown: "candleWickDownColor",
  bodyOpacity: "candleBodyOpacity",
  borderVisible: "candleBorderVisible",
  wickVisible: "candleWickVisible",
} as const;

export function resolveCandleStyle(value: unknown): CandleStyleId {
  return CANDLE_STYLES.some((style) => style.id === value) ? value as CandleStyleId : "candles";
}

export function isHollowStyle(style: CandleStyleId): boolean {
  return style === "hollow" || style === "heikin-ashi-hollow";
}

export function isHeikinAshiStyle(style: CandleStyleId): boolean {
  return style === "heikin-ashi" || style === "heikin-ashi-hollow";
}

/**
 * The series options for a set of candle settings.
 *
 * Order of precedence matches every other surface: a chosen scheme wins, then
 * an explicit picker, then the chart theme - so a chart nobody has touched
 * paints exactly what it painted before this existed.
 */
export function resolveCandleSeriesColors(
  settings: Record<string, unknown> | null | undefined,
  theme: CandleThemeColors,
): CandleSeriesColors {
  const style = resolveCandleStyle(settings?.[CANDLE_SETTING_KEYS.style]);
  const gradient = resolveVolumeProfileGradient(settings?.[INDICATOR_GRADIENT_KEY]);
  const pick = (key: string, fallback: string) => hexOrNull(settings?.[key]) ?? fallback;

  // A scheme spreads across the pair the way it does on a two-role study: the
  // falling side takes its start, the rising side its end.
  const up = gradient ? gradientStop(gradient, 1, 2) : pick(CANDLE_SETTING_KEYS.up, theme.up);
  const down = gradient ? gradientStop(gradient, 0, 2) : pick(CANDLE_SETTING_KEYS.down, theme.down);
  const borderUp = gradient ? up : pick(CANDLE_SETTING_KEYS.borderUp, theme.borderUp);
  const borderDown = gradient ? down : pick(CANDLE_SETTING_KEYS.borderDown, theme.borderDown);
  const wickUp = gradient ? up : pick(CANDLE_SETTING_KEYS.wickUp, theme.wickUp);
  const wickDown = gradient ? down : pick(CANDLE_SETTING_KEYS.wickDown, theme.wickDown);

  const opacity = clampPercent(settings?.[CANDLE_SETTING_KEYS.bodyOpacity], 100);
  const hollow = isHollowStyle(style);

  return {
    /*
     * Hollow empties the BODY only. The border and wick keep their colour, or
     * the bar disappears entirely - which is what separates a hollow candle
     * from a hidden one.
     */
    upColor: hollow ? "rgba(0,0,0,0)" : withOpacity(up, opacity),
    downColor: hollow ? "rgba(0,0,0,0)" : withOpacity(down, opacity),
    borderUpColor: borderUp,
    borderDownColor: borderDown,
    wickUpColor: wickUp,
    wickDownColor: wickDown,
    // A hollow candle with no border is nothing at all, so hollow forces it on
    // regardless of the switch.
    borderVisible: hollow ? true : settings?.[CANDLE_SETTING_KEYS.borderVisible] !== false,
    wickVisible: settings?.[CANDLE_SETTING_KEYS.wickVisible] !== false,
  };
}

export type OhlcCandle = { open: number; high: number; low: number; close: number };

/**
 * Heikin Ashi, computed from the real bars.
 *
 * Close is the bar's own average; open is the running average of the previous
 * synthetic bar, which is what does the smoothing. High and low must include
 * the synthetic open and close or the body can escape its own wick.
 *
 * These are DERIVED values, not traded prices - the first bar seeds from the
 * real open and close rather than inventing a prior bar to average against.
 */
export function toHeikinAshi<T extends OhlcCandle>(candles: readonly T[]): T[] {
  const out: T[] = [];
  let previousOpen = 0;
  let previousClose = 0;
  for (const [index, candle] of candles.entries()) {
    const close = (candle.open + candle.high + candle.low + candle.close) / 4;
    const open = index === 0
      ? (candle.open + candle.close) / 2
      : (previousOpen + previousClose) / 2;
    out.push({
      ...candle,
      open,
      close,
      high: Math.max(candle.high, open, close),
      low: Math.min(candle.low, open, close),
    });
    previousOpen = open;
    previousClose = close;
  }
  return out;
}

function hexOrNull(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null;
}

function clampPercent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(5, numeric));
}

/** Body opacity, applied to the fill only. */
function withOpacity(colour: string, percent: number): string {
  if (percent >= 100) return colour;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour.trim());
  if (!hex) return colour;
  const [r, g, b] = hex.slice(1).map((part) => parseInt(part, 16));
  return `rgba(${r}, ${g}, ${b}, ${(percent / 100).toFixed(3)})`;
}
