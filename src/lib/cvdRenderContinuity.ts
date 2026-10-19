import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

/**
 * Reject a transient older/empty rehydration frame, without requiring an old
 * history-window size before newer verified live data is allowed to paint.
 * Shape-only regression protection applies only to an unchanged live tail.
 */
export function cvdSeriesRegressed(
  previous: CalculatedIndicatorSeries[],
  next: CalculatedIndicatorSeries[],
) {
  if (!previous.length) return false;
  if (!next.length) return true;
  if (previous.length !== next.length) return false;
  for (let index = 0; index < next.length; index += 1) {
    if (previous[index].key !== next[index].key || previous[index].kind !== next[index].kind) return false;
  }
  const previousPrimary = previous[0].data;
  const nextPrimary = next[0].data;
  if (!previousPrimary.length) return false;
  if (!nextPrimary.length) return true;
  const previousEnd = previousPrimary.at(-1)?.time ?? -Infinity;
  const nextEnd = nextPrimary.at(-1)?.time ?? -Infinity;
  if (nextEnd < previousEnd) return true;
  // The retained-history size is not a live watermark. After a rolling window,
  // reconnect or session change, a shorter verified series can be NEWER. The
  // old size guard rejected every subsequent update until it grew back to95%
  // of a window that might never be loaded again: a permanent frozen pane.
  if (nextEnd > previousEnd) return false;
  if ((nextPrimary[0]?.time ?? -Infinity) > (previousPrimary[0]?.time ?? -Infinity)) return false;
  const before = previousPrimary.at(-1)!;
  const after = nextPrimary.at(-1)!;
  if ((["value", "open", "high", "low", "close"] as const)
    .some(field => !Object.is(before[field], after[field]))) return false;
  if (nextPrimary.length < previousPrimary.length * 0.95) return true;
  if (nextEnd === previousEnd) {
    const previousBreaks = previousPrimary.reduce((total, point) => total + (point.breakBefore ? 1 : 0), 0);
    const nextBreaks = nextPrimary.reduce((total, point) => total + (point.breakBefore ? 1 : 0), 0);
    if (nextBreaks > previousBreaks) return true;
  }
  return false;
}
