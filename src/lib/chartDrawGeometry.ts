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
 * Geometry for an entry/exit fill marker, in pixels.
 *
 * This is the shape the chart already paints when a paper order fills: a
 * SIDEWAYS triangle centred on the fill, pointing RIGHT for an entry and LEFT
 * for an exit (PaperFillMarkersRenderer in Chart.tsx). Its real size is 12x8
 * around the anchor; the drawn version keeps those proportions and lets the
 * handle scale them.
 *
 * Direction belongs to the TOOL, never to where the handle is dragged: the
 * half-extents are distances, so dragging the size handle to the far side of
 * the anchor makes the marker bigger rather than turning an entry into an
 * exit.
 */
export type FillMarkerGeometryInput = {
  /** Which way the tool always points. */
  direction: "right" | "left";
  /** The fill's price/time in pixels — the CENTRE of the marker, as the real one is. */
  anchorX: number;
  anchorY: number;
  /** The size handle. Absent while the marker is being placed. */
  handleX?: number | null;
  handleY?: number | null;
  defaultHalfWidth: number;
  defaultHalfHeight: number;
  minHalfWidth: number;
  minHalfHeight: number;
};

export type FillMarkerGeometry = {
  halfWidth: number;
  halfHeight: number;
  /** Where the point of the triangle sits. */
  tipX: number;
  /** The flat back, opposite the tip. */
  backX: number;
  /** The three corners, tip first. */
  points: Array<[number, number]>;
};

export function fillMarkerGeometry(input: FillMarkerGeometryInput): FillMarkerGeometry {
  const {
    direction, anchorX, anchorY,
    defaultHalfWidth, defaultHalfHeight, minHalfWidth, minHalfHeight,
  } = input;

  const right = direction === "right";
  const requestedX = Number.isFinite(input.handleX as number)
    ? (input.handleX as number)
    : anchorX + (right ? defaultHalfWidth : -defaultHalfWidth);
  const requestedY = Number.isFinite(input.handleY as number)
    ? (input.handleY as number)
    : anchorY + defaultHalfHeight;

  // Width is measured ALONG the direction the marker points, not as a raw
  // distance. Measuring the distance meant pulling the handle inward shrank
  // the marker only until it reached the anchor and then GREW it again out
  // the other side, so it could not be made small: overshoot by a pixel and
  // it started expanding. Signed, dragging inward shrinks to the minimum and
  // stays there, and the marker still cannot be turned around.
  const reach = right ? requestedX - anchorX : anchorX - requestedX;
  const halfWidth = Math.max(minHalfWidth, reach);
  // Height is symmetric about the anchor, so distance is the right measure.
  const halfHeight = Math.max(minHalfHeight, Math.abs(requestedY - anchorY));

  const tipX = right ? anchorX + halfWidth : anchorX - halfWidth;
  const backX = right ? anchorX - halfWidth : anchorX + halfWidth;

  return {
    halfWidth,
    halfHeight,
    tipX,
    backX,
    points: [
      [tipX, anchorY],
      [backX, anchorY - halfHeight],
      [backX, anchorY + halfHeight],
    ],
  };
}
