/** Explicit widths are opt-in. Legacy studies retain their candle-body width. */
export function indicatorHistogramWidth(candleWidth: number, explicitWidth?: number): number {
  return explicitWidth !== undefined && Number.isFinite(explicitWidth)
    ? Math.min(candleWidth, Math.max(1, Math.min(4, explicitWidth))) : candleWidth;
}
