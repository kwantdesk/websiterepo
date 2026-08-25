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

/**
 * Geometry for an entry/exit arrow, in pixels.
 *
 * The direction is a property of the TOOL, never of where the tail handle
 * happens to be dragged: an entry is a green arrow pointing UP at the bar from
 * below and an exit a red one pointing DOWN at it from above, exactly as the
 * chart draws a real fill marker. Dragging the tail past the tip would
 * otherwise flip the arrow over, and a green buy pointing down is the one
 * thing a fill marker must never show. The tail is therefore clamped to its
 * own side of the tip; it sets length and width, not direction.
 */
export type ArrowGeometryInput = {
  /** Which way the tool always points. */
  direction: "up" | "down";
  /** The marked price/time, in pixels: the arrow's point. */
  tipX: number;
  tipY: number;
  /** The tail handle. Absent while the arrow is being placed. */
  tailX?: number | null;
  tailY?: number | null;
  defaultLength: number;
  defaultHalfWidth: number;
  minLength: number;
  minHalfWidth: number;
};

export type ArrowGeometry = {
  /** Tail end after clamping, always on the correct side of the tip. */
  tailY: number;
  length: number;
  halfWidth: number;
  /** Where the head meets the shaft. */
  headBaseY: number;
  shaftHalf: number;
  /** Closed outline, tip first. */
  points: Array<[number, number]>;
};

export function entryExitArrowGeometry(input: ArrowGeometryInput): ArrowGeometry {
  const { direction, tipX, tipY, defaultLength, defaultHalfWidth, minLength, minHalfWidth } = input;
  const up = direction === "up";
  // An arrow pointing UP has its body BELOW the tip, so its tail is at a
  // LARGER y. Screen y grows downward.
  const fallbackTailY = tipY + (up ? defaultLength : -defaultLength);
  const requestedTailY = Number.isFinite(input.tailY as number) ? (input.tailY as number) : fallbackTailY;
  const tailY = up
    ? Math.max(tipY + minLength, requestedTailY)
    : Math.min(tipY - minLength, requestedTailY);

  const requestedTailX = Number.isFinite(input.tailX as number)
    ? (input.tailX as number)
    : tipX + defaultHalfWidth;
  const halfWidth = Math.max(minHalfWidth, Math.abs(requestedTailX - tipX));

  const length = Math.abs(tailY - tipY);
  // The head keeps its proportion as the arrow lengthens, but can never eat
  // the whole shaft or the mark stops reading as an arrow.
  const head = Math.min(length * 0.55, halfWidth * 1.6);
  const headBaseY = up ? tipY + head : tipY - head;
  const shaftHalf = Math.max(1.5, halfWidth * 0.38);

  return {
    tailY,
    length,
    halfWidth,
    headBaseY,
    shaftHalf,
    points: [
      [tipX, tipY],
      [tipX - halfWidth, headBaseY],
      [tipX - shaftHalf, headBaseY],
      [tipX - shaftHalf, tailY],
      [tipX + shaftHalf, tailY],
      [tipX + shaftHalf, headBaseY],
      [tipX + halfWidth, headBaseY],
    ],
  };
}
