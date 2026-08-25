/**
 * Pixel-to-time past the live edge, counted in bars.
 *
 * A chart's time scale only names times it has bars for, so every pixel to the
 * right of the last bar - the blank space every chart leaves at the live edge -
 * resolves to nothing. That is where a position calculator's right edge lives:
 * it is deliberately placed twelve bars past the entry. Asking the scale for a
 * time there returns null, which is why dragging those corners did nothing at
 * all.
 *
 * Past the last bar the answer is counted in BARS rather than clock time: how
 * many bar widths the pixel sits beyond the final bar, times the spacing
 * between recent bars. Counting in bars is what makes this behave the same on
 * a volume, range or tick chart, whose bars carry irregular times and have no
 * fixed interval to extrapolate with at all.
 */

/**
 * Typical spacing between recent bars.
 *
 * The MEDIAN, not the mean: one daily maintenance break is a gap many times
 * longer than a bar, and averaging it in would stretch every extrapolated step
 * across the whole session.
 */
export function medianBarStep(times: readonly number[]): number | null {
  const gaps: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index] - times[index - 1];
    if (gap > 0 && Number.isFinite(gap)) gaps.push(gap);
  }
  if (!gaps.length) return null;
  gaps.sort((left, right) => left - right);
  return gaps[Math.floor(gaps.length / 2)];
}

export type PastEdgeTimeInput = {
  /** Pixel being asked about. */
  localX: number;
  /** Time and pixel of the final bar. */
  lastTime: number;
  lastX: number;
  /** Time and pixel of the bar before it, which give the bar width in pixels. */
  previousTime: number;
  previousX: number;
  /** Recent bar times, oldest first, for the spacing median. */
  recentTimes: readonly number[];
};

/**
 * The chart time at a pixel, extrapolated past the last bar.
 *
 * Returns null when the geometry cannot support an answer — fewer than two
 * bars, a degenerate bar width, or a non-positive spacing — rather than
 * inventing one.
 */
export function timeAtPixelPastLastBar(input: PastEdgeTimeInput): number | null {
  const { localX, lastTime, lastX, previousTime, previousX, recentTimes } = input;
  if (![localX, lastTime, lastX, previousTime, previousX].every(Number.isFinite)) return null;
  const pixelsPerBar = lastX - previousX;
  // A collapsed or inverted bar width gives no scale to count with.
  if (!(Math.abs(pixelsPerBar) > 0.01)) return null;
  const step = medianBarStep(recentTimes) ?? (lastTime - previousTime);
  if (!(step > 0)) return null;
  return lastTime + ((localX - lastX) / pixelsPerBar) * step;
}
