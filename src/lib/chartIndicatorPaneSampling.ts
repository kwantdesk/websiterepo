import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

export type HorizontalPanePoint = CalculatedIndicatorSeries["data"][number] & { x: number };
export type VerticalPanePoint = CalculatedIndicatorSeries["data"][number] & { y: number };

export type PaneTimeWindow = { from: number; to: number } | null;

/** Indicator output is chronological. Cull by native chart time before asking
 * the chart to project thousands of off-screen points on every live refresh.
 * Retain neighbours for strokes entering the plot; final pixel clipping stays
 * with the existing renderer. This never changes calculation/history inputs. */
export function visiblePaneData<T extends { time: number }>(data: T[], window?: PaneTimeWindow): T[] {
  if (!window || !Number.isFinite(window.from) || !Number.isFinite(window.to)
    || window.to < window.from || data.length < 3) return data;
  const lowerBound = (time: number) => {
    let low = 0, high = data.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (data[middle].time < time) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const start = Math.max(0, lowerBound(window.from) - 1);
  const end = Math.min(data.length, lowerBound(window.to) + 2);
  return start === 0 && end === data.length ? data : data.slice(start, end);
}

/**
 * Downsample a pane series without ever aggregating across an explicit break.
 *
 * Cumulative studies reset between sessions. At a zoomed-out scale the last
 * old-session point and first new-session point can share one pixel bucket;
 * treating that as one candle creates an invented full-height body that
 * disappears after zoom. The segment ordinal makes a break a hard bucket
 * boundary even when both points occupy the same x-coordinate.
 */
export function sampledPanePoints(
  definition: CalculatedIndicatorSeries,
  xForTime: (time: number) => number | null,
  plotWidth: number,
  window?: PaneTimeWindow,
): HorizontalPanePoint[] {
  const visible = visiblePaneData(definition.data, window)
    .map((point) => ({ ...point, x: xForTime(point.time) }))
    .filter((point): point is HorizontalPanePoint =>
      point.x !== null && point.x >= -10 && point.x <= plotWidth + 10);
  const maximumPoints = Math.max(160, Math.floor(plotWidth * 1.25));
  if (visible.length <= maximumPoints) return visible;

  const bucketWidth = Math.max(1, plotWidth / maximumPoints);
  const buckets = new Map<string, HorizontalPanePoint>();
  let segment = 0;
  visible.forEach((point, index) => {
    if (index > 0 && point.breakBefore) segment += 1;
    const pixelBucket = Math.floor(Math.max(0, point.x) / bucketWidth);
    const bucketKey = `${segment}:${pixelBucket}`;
    const current = buckets.get(bucketKey);
    if (!current) {
      buckets.set(bucketKey, { ...point });
      return;
    }
    if (definition.kind === "candlestick") {
      const currentOpen = current.open ?? current.value;
      const pointClose = point.close ?? point.value;
      current.open = currentOpen;
      current.close = pointClose;
      current.value = point.value;
      current.high = Math.max(current.high ?? currentOpen, point.high ?? pointClose);
      current.low = Math.min(current.low ?? currentOpen, point.low ?? pointClose);
      current.color = point.color ?? current.color;
      current.borderColor = point.borderColor ?? current.borderColor;
      current.time = point.time;
      current.x = point.x;
      current.breakBefore = Boolean(current.breakBefore || point.breakBefore);
      return;
    }
    // CVD bars and lines are cumulative values. Keep the final value in each
    // screen bucket rather than creating thousands of SVG nodes per refresh.
    buckets.set(bucketKey, { ...point, breakBefore: Boolean(current.breakBefore || point.breakBefore) });
  });
  return [...buckets.values()].sort((left, right) => left.x - right.x);
}

/** Same hard session boundary for panes docked vertically at either side. */
export function sampledVerticalPanePoints(
  definition: CalculatedIndicatorSeries,
  yForTime: (time: number) => number | null,
  plotHeight: number,
  window?: PaneTimeWindow,
): VerticalPanePoint[] {
  const visible = visiblePaneData(definition.data, window)
    .map((point) => ({ ...point, y: yForTime(point.time) }))
    .filter((point): point is VerticalPanePoint =>
      point.y !== null && point.y >= -10 && point.y <= plotHeight + 10);
  if (visible.length <= Math.max(240, plotHeight * 2)) return visible;

  const buckets = new Map<string, VerticalPanePoint>();
  let segment = 0;
  visible.forEach((point, index) => {
    if (index > 0 && point.breakBefore) segment += 1;
    const pixelBucket = Math.max(0, Math.min(Math.ceil(plotHeight), Math.round(point.y)));
    const bucketKey = `${segment}:${pixelBucket}`;
    const current = buckets.get(bucketKey);
    if (!current) {
      buckets.set(bucketKey, point);
      return;
    }
    if (definition.kind !== "candlestick") {
      buckets.set(bucketKey, { ...point, breakBefore: Boolean(current.breakBefore || point.breakBefore) });
      return;
    }
    buckets.set(bucketKey, {
      ...point,
      open: current.open ?? current.value,
      high: Math.max(current.high ?? current.value, point.high ?? point.value),
      low: Math.min(current.low ?? current.value, point.low ?? point.value),
      close: point.close ?? point.value,
      breakBefore: Boolean(current.breakBefore || point.breakBefore),
    });
  });
  return [...buckets.values()].sort((left, right) => left.y - right.y);
}
