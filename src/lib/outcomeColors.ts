/**
 * The two colours that mean "made money" and "lost money".
 *
 * The journal was pinned to a fixed green and red because following the theme
 * had produced a calendar where a winning day and a losing day were the same
 * colour. Following the theme is the right behaviour; the fixed pair was a
 * workaround for the theme sometimes not offering a usable one.
 *
 * So the theme is used, under three rules that cannot be broken:
 *
 *   1. Red never lands on a positive, and green never on a negative. A trader
 *      reads the colour before the number, and a red profit is a lie told
 *      faster than the figure can correct it.
 *   2. The two must be tellable apart from each other, which is the bug that
 *      caused the fixed pair in the first place.
 *   3. Both must be visible against the surface they are drawn on - a theme may
 *      paint its bearish candle the colour of the chart, and that body cannot
 *      double as the losing colour.
 *
 * Where the theme cannot satisfy those, a semantic pair is used for the side
 * that fails rather than for both, so as much of the theme survives as can.
 */

/** Used only when the theme offers nothing that satisfies the rules. */
export const SEMANTIC_WIN = "#22C55E";
export const SEMANTIC_LOSS = "#EF4444";

export type OutcomeColorSources = {
  /** The theme's bullish colour, and the outline behind it for hollow candles. */
  up: string;
  upOutline?: string;
  /** The theme's bearish colour, and its outline. */
  down: string;
  downOutline?: string;
  primary: string;
  accent: string;
  danger: string;
  /** What these are drawn on, so an invisible colour can be rejected. */
  background: string;
};

export type OutcomeColors = {
  win: string;
  loss: string;
  /** The same colours as a wash, for a calendar cell's background. */
  winSoft: string;
  lossSoft: string;
};

export function resolveOutcomeColors(sources: OutcomeColorSources): OutcomeColors {
  const visible = (colour: string | undefined): colour is string => (
    Boolean(colour) && isHex(colour!) && contrast(colour!, sources.background) >= 1.2
  );

  /*
   * Order matters: the theme's own bullish colour first, then the outline that
   * stands in for it on a hollow theme, then the accents. A red is skipped
   * rather than darkened, because a dark red is still red.
   */
  const win = [sources.up, sources.upOutline, sources.primary, sources.accent]
    .find((colour) => visible(colour) && !isRed(colour!)) ?? SEMANTIC_WIN;

  const loss = [sources.down, sources.downOutline, sources.danger]
    .find((colour) => visible(colour) && !isGreen(colour!) && distinct(colour!, win)) ?? SEMANTIC_LOSS;

  // A last resort for a theme whose danger is also too close to its bullish
  // colour: the win keeps the theme, the loss falls back.
  const finalLoss = distinct(loss, win) ? loss : SEMANTIC_LOSS;
  const finalWin = distinct(finalLoss, win) ? win : SEMANTIC_WIN;

  return {
    win: finalWin,
    loss: finalLoss,
    winSoft: `color-mix(in srgb, ${finalWin} 8%, transparent)`,
    lossSoft: `color-mix(in srgb, ${finalLoss} 8%, transparent)`,
  };
}

/**
 * Red enough that a trader would read it as a loss.
 *
 * Hue alone is not enough - a near-grey with a red cast is not "red" to anyone
 * looking at a calendar - so a colour has to be saturated before its hue counts
 * against it.
 */
export function isRed(colour: string): boolean {
  const hsl = toHsl(colour);
  if (!hsl || hsl.s < 0.25) return false;
  return hsl.h >= 340 || hsl.h <= 18;
}

/** Green enough that a trader would read it as a win. */
export function isGreen(colour: string): boolean {
  const hsl = toHsl(colour);
  if (!hsl || hsl.s < 0.25) return false;
  return hsl.h >= 90 && hsl.h <= 165;
}

/** Whether two colours can be told apart when they sit side by side. */
function distinct(left: string, right: string): boolean {
  const a = toHsl(left);
  const b = toHsl(right);
  if (!a || !b) return true;
  // Either a clear hue separation, or a clear lightness one. A dim green beside
  // a bright green is fine; the same green twice is not.
  const hueGap = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  return hueGap >= 25 || Math.abs(a.l - b.l) >= 0.18 || Math.abs(a.s - b.s) >= 0.3;
}

function isHex(colour: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(colour.trim());
}

function channels(colour: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (!hex) return null;
  return [0, 2, 4].map((at) => parseInt(hex[1].slice(at, at + 2), 16) / 255) as [number, number, number];
}

function toHsl(colour: string): { h: number; s: number; l: number } | null {
  const rgb = channels(colour);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const h = max === r
    ? 60 * (((g - b) / delta) % 6)
    : max === g
      ? 60 * ((b - r) / delta + 2)
      : 60 * ((r - g) / delta + 4);
  return { h: (h + 360) % 360, s, l };
}

function contrast(colour: string, background: string): number {
  const a = luminance(colour);
  const b = luminance(background);
  if (a === null || b === null) return Infinity;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function luminance(colour: string): number | null {
  const rgb = channels(colour);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
