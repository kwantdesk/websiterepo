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

/**
 * Resolves an emoji's current screen size from spans stored in chart units.
 *
 * The smaller axis wins, so zooming out either time or price cannot leave a
 * giant fixed-pixel icon floating over compressed candles. A legacy drawing
 * without chart spans keeps its nominal size until the layer seeds spans at
 * the current viewport.
 */
export function chartAnchoredEmojiScreenSize(input: EmojiScreenSizeInput) {
  const nominalSize = Math.max(16, Math.min(160, finitePositive(input.nominalSize) ?? 36));
  const referenceSize = Math.max(16, Math.min(160, finitePositive(input.referenceSize) ?? nominalSize));
  const candidates: number[] = [];
  const timeRadius = finitePositive(input.timeRadius);
  if (timeRadius !== null) {
    const edgeX = input.toX(input.anchorTime + timeRadius);
    if (edgeX !== null && Number.isFinite(edgeX)) candidates.push(Math.abs(edgeX - input.anchorX) * 2);
  }
  const priceRadius = finitePositive(input.priceRadius);
  if (priceRadius !== null) {
    const edgeY = input.toY(input.anchorPrice + priceRadius);
    if (edgeY !== null && Number.isFinite(edgeY)) candidates.push(Math.abs(edgeY - input.anchorY) * 2);
  }
  if (!candidates.length) return nominalSize;
  const scaleAtReference = Math.min(...candidates);
  return Math.max(2, Math.min(320, scaleAtReference * nominalSize / referenceSize));
}

