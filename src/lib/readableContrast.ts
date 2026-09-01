/**
 * Which of black or white can actually be read on a given colour.
 *
 * WCAG relative luminance and contrast ratio, nothing more. It was written for
 * the GEX Map's strike ladder, where rows painted their text with the THEME
 * foreground while the cell behind it came from the palette - two colours with
 * no relationship to each other, so the text was present and simply could not
 * be seen.
 *
 * It lives here rather than in that component because the same question is
 * asked wherever a label sits on a surface the theme controls: a second copy
 * would drift from this one, and the two would disagree about the same colour.
 */

export type RgbColor = { r: number; g: number; b: number };

export function parseResolvedColor(value: string): RgbColor | null {
  const normalized = value.trim();
  const hex = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join("") : hex;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgb = normalized.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };

  const srgb = normalized.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
    };
  }
  return null;
}

export function colorLuminance(color: RgbColor) {
  const channel = (value: number) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(color.r) * 0.2126 + channel(color.g) * 0.7152 + channel(color.b) * 0.0722;
}

export function contrastRatio(left: RgbColor, right: RgbColor) {
  const leftLuminance = colorLuminance(left);
  const rightLuminance = colorLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05)
    / (Math.min(leftLuminance, rightLuminance) + 0.05);
}

export function rgbHex(color: RgbColor) {
  const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export const PURE_WHITE = { r: 255, g: 255, b: 255 };
export const PURE_BLACK = { r: 0, g: 0, b: 0 };
const readableTextCache = new Map<string, string>();

/**
 * Black or white, whichever can actually be read on this cell.
 *
 * The rows painted their text with the THEME foreground while the cell behind
 * it came from the palette - two colours with no relationship to each other. On
 * a theme with a dark foreground the negative nodes went unreadable, and on a
 * light palette slot the light foreground did the same: the text was there and
 * simply could not be seen.
 *
 * The contrast maths already existed for the Star accent; every row uses it
 * now. Black and white are the choices deliberately - a third colour from the
 * palette would contrast against some slots of its own scale and not others,
 * which is the failure being fixed.
 *
 * Cached because a strike ladder renders hundreds of rows several times a
 * second and the answer only depends on the colour.
 */
export function readableTextOn(background: string): string {
  const cached = readableTextCache.get(background);
  if (cached) return cached;
  const rgb = parseResolvedColor(background);
  const resolved = !rgb
    ? "#FFFFFF"
    : contrastRatio(rgb, PURE_BLACK) >= contrastRatio(rgb, PURE_WHITE)
      ? "#000000"
      : "#FFFFFF";
  if (readableTextCache.size > 512) readableTextCache.clear();
  readableTextCache.set(background, resolved);
  return resolved;
}
