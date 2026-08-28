/**
 * The KwantDesk mark that identifies a surface, and the rules for sizing it.
 *
 * Shared rather than copied. The chart and the liquidity map carry the same
 * mark, and two sets of constants that were meant to agree would drift the
 * first time one of them was tuned.
 */

export const CHART_WATERMARK_SRC = "/brand/kwantdesk-wordmark-white.png";
export const CHART_WATERMARK_ASPECT = 1911 / 305;
const CHART_WATERMARK_WIDTH_FRACTION = 0.14;
const CHART_WATERMARK_MIN_WIDTH = 80;
const CHART_WATERMARK_MAX_WIDTH = 280;
const CHART_WATERMARK_MAX_HEIGHT_FRACTION = 0.08;

/** Faint enough to read past, solid enough to be a mark rather than a stain. */
export const CHART_WATERMARK_OPACITY = 0.55;

/**
 * The liquidity map wears it at half size.
 *
 * That surface is denser than a candle chart - the heat fills the whole plot
 * rather than leaving space above the price - so the mark has to be quieter to
 * stay a mark rather than something painted over the book.
 */
export const LIQUIDITY_MAP_WATERMARK_SCALE = 0.5;

/**
 * The mark's rendered box for a pane, or null when the pane is too small.
 *
 * `scale` shrinks it without changing when it appears or disappears, so a
 * surface that wants a quieter mark keeps the same thresholds as every other.
 */
export function chartWatermarkSize(paneWidth: number, paneHeight: number, scale = 1) {
  if (!(paneWidth > 0) || !(paneHeight > 0)) return null;
  const width = Math.min(
    CHART_WATERMARK_MAX_WIDTH,
    Math.max(CHART_WATERMARK_MIN_WIDTH, paneWidth * CHART_WATERMARK_WIDTH_FRACTION),
  ) * scale;
  const height = Math.min(
    width / CHART_WATERMARK_ASPECT,
    paneHeight * CHART_WATERMARK_MAX_HEIGHT_FRACTION * scale,
  );
  // Below this the wordmark is a smudge rather than a mark, and a pane that
  // small has nothing to spare for it.
  if (height < 9 * scale || paneWidth < CHART_WATERMARK_MIN_WIDTH + 40) return null;
  return { width: Math.round(height * CHART_WATERMARK_ASPECT), height: Math.round(height) };
}
