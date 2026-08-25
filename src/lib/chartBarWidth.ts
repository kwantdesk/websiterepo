/**
 * The width a bar is drawn at, for anything that has to line up with the
 * candles.
 *
 * The lower panes draw their own bars in SVG rather than as chart series, so
 * nothing made them agree with the candles above. CVD, Delta Bar and Volume
 * used a flat 72% of bar spacing capped at twelve pixels, so the moment the
 * chart was zoomed past that cap the candles kept growing and the histogram
 * beneath them stayed narrow — a bar and its delta no longer the same width,
 * which is the one thing that makes a lower pane readable against price.
 *
 * This is Lightweight Charts' own `optimalCandlestickWidth`, so a pane bar is
 * exactly as wide as the candle it belongs to at every zoom level, including
 * the special case the library carries for very tight spacing.
 */
export function chartCandleBodyWidth(barSpacing: number, pixelRatio = 1): number {
  if (!Number.isFinite(barSpacing) || barSpacing <= 0) return Math.max(1, Math.floor(pixelRatio));
  const specialCaseFrom = 2.5;
  const specialCaseTo = 4;
  const specialCaseCoeff = 3;
  if (barSpacing >= specialCaseFrom && barSpacing <= specialCaseTo) {
    return Math.floor(specialCaseCoeff * pixelRatio);
  }
  // The coefficient is 1 at tight spacing and eases toward 0.8 as it widens.
  const reducingCoeff = 0.2;
  const coeff = 1
    - (reducingCoeff * Math.atan(Math.max(specialCaseTo, barSpacing) - specialCaseTo)) / (Math.PI * 0.5);
  const scaled = Math.floor(barSpacing * pixelRatio);
  return Math.max(Math.floor(pixelRatio), Math.min(Math.floor(barSpacing * coeff * pixelRatio), scaled));
}

/**
 * Bar spacing read off the points a pane is about to draw.
 *
 * Adjacent points are adjacent bars except at extreme zoom-out, where the
 * pane buckets them; there the gap it measures is a whole bucket, which is
 * still the width one drawn bar should occupy.
 */
export function paneBarSpacing(points: readonly { x: number }[], fallback = 4): number {
  if (points.length < 2) return fallback;
  let smallest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    const gap = Math.abs(points[index].x - points[index - 1].x);
    if (gap > 0 && gap < smallest) smallest = gap;
  }
  return Number.isFinite(smallest) ? smallest : fallback;
}
