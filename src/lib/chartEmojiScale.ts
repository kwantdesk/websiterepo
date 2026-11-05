export type ChartAnchoredEmojiScale = {
  timeRadius?: number;
  priceRadius?: number;
  referenceSize?: number;
};

type EmojiScreenSizeInput = ChartAnchoredEmojiScale & {
  nominalSize: number;
  anchorTime: number;
  anchorPrice: number;
  anchorX: number;
  anchorY: number;
  toX: (time: number) => number | null;
  toY: (price: number) => number | null;
};

const finitePositive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** The anchor lives in chart coordinates; the icon size lives in CSS pixels.
 * Legacy chart-unit radii remain readable but must never scale the glyph. */
export function chartAnchoredEmojiScreenSize(input: EmojiScreenSizeInput) {
  return Math.max(16, Math.min(160, finitePositive(input.nominalSize) ?? 36));
}
