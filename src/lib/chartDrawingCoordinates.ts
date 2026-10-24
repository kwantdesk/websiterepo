/** Drawing anchors are seconds/prices, never indices from a prior timeframe.
 * Read the native timeline, not pending React candles: during a timeframe
 * change those can describe different series. Preserve fractional positions
 * between bars (coordinateToTime alone rounds to a whole bar).
 */
export type DrawingTimeScale = {
  timeToIndex: (time: number, nearest: boolean) => number | null;
  coordinateToLogical: (x: number) => number | null;
  logicalToCoordinate: (logical: number) => number | null;
  coordinateToTime: (x: number) => number | null;
};

function timeAtIndex(scale: DrawingTimeScale, index: number): number | null {
  const x = scale.logicalToCoordinate(index);
  const time = x == null ? null : scale.coordinateToTime(x);
  return time != null && Number.isFinite(time) ? time : null;
}

function edgeStep(scale: DrawingTimeScale, index: number, direction: number): number | null {
  const gaps: number[] = [];
  let previous = timeAtIndex(scale, index);
  for (let offset = 1; offset <= 12; offset++) {
    const next = timeAtIndex(scale, index + offset * direction);
    if (next == null || previous == null) break;
    const gap = Math.abs(next - previous);
    if (gap > 0) gaps.push(gap);
    previous = next;
  }
  gaps.sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
}

export function drawingTimeToCoordinate(scale: DrawingTimeScale, time: number): number | null {
  if (!Number.isFinite(time)) return null;
  const index = scale.timeToIndex(time, true);
  if (index == null) return null;
  const anchor = timeAtIndex(scale, index);
  if (anchor == null) return null;
  if (time === anchor) return scale.logicalToCoordinate(index);
  const direction = time < anchor ? -1 : 1;
  const neighbor = timeAtIndex(scale, index + direction);
  const step = neighbor == null
    ? edgeStep(scale, index, -direction)
    : Math.abs(neighbor - anchor);
  if (step == null || step <= 0) return null;
  return scale.logicalToCoordinate(index + (time - anchor) / step);
}

export function drawingCoordinateToTime(scale: DrawingTimeScale, x: number): number | null {
  if (!Number.isFinite(x)) return null;
  const logical = scale.coordinateToLogical(x);
  if (logical == null || !Number.isFinite(logical)) return null;
  const lower = Math.floor(logical);
  const a = timeAtIndex(scale, lower);
  const b = timeAtIndex(scale, lower + 1);
  if (a != null && b != null) return a + (b - a) * (logical - lower);
  // Outside either edge the native scale no longer names the time. Resolve
  // its actual boundary; a maintenance/weekend gap must not become bar size.
  const namedTime = a ?? b ?? scale.coordinateToTime(x);
  const boundary = namedTime == null
    ? scale.timeToIndex(logical < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE, true)
    : scale.timeToIndex(namedTime, false);
  if (boundary == null) return null;
  const time = timeAtIndex(scale, boundary);
  const step = edgeStep(scale, boundary, logical < boundary ? 1 : -1);
  return time == null || step == null ? null : time + (logical - boundary) * step;
}
