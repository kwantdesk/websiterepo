/**
 * Shared geometry for the ladders drawn against the chart's price scale.
 *
 * Both the Mini DOM and the Delta Bar's side mode draw the same shape: a rail
 * at one edge of the pane with a horizontal bar per price band. The banding is
 * the part that has to be right — a tick is a couple of pixels at normal zoom,
 * so a bar per tick gives hairlines with no room for a number, which is how the
 * Mini DOM first shipped. These helpers are pure so that shape can be checked
 * without a canvas.
 */

/**
 * How many ticks one drawn band covers.
 *
 * Chosen to leave roughly `spacingPx` between bands, so every resting order or
 * execution inside a band is summed into one bar thick enough to read.
 */
export function ladderBandStep(visibleTickSpan: number, plotHeight: number, spacingPx: number) {
  if (!(visibleTickSpan > 0) || !(plotHeight > 0)) return 1;
  const targetLevels = Math.max(12, plotHeight / Math.max(4, spacingPx));
  return Math.max(1, Math.round(visibleTickSpan / targetLevels));
}

/**
 * Bar thickness. Floored at 8px so a zoomed-out ladder still reads as bars with
 * numbers on them, and capped at 16 so a zoomed-in one does not become blocks
 * that swallow the price levels between them.
 */
export function ladderBarHeight(levelSpacing: number) {
  return Math.max(8, Math.min(16, levelSpacing * 0.62));
}

/**
 * Bar length against the largest band in the frame.
 *
 * Clamped: a band larger than the peak the frame was scaled from — which a late
 * update can produce — must not draw past the end of its own track.
 */
export function ladderBarWidth(size: number, peak: number, extent: number) {
  if (!(size > 0) || !(peak > 0) || !(extent > 0)) return 0;
  return Math.max(1, Math.min(extent, (size / peak) * extent));
}
