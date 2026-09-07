import type { CalculatedIndicatorSeries } from "@/lib/chartIndicatorEngine";

/**
 * A live CVD snapshot may grow or receive corrected values, but it must not
 * temporarily lose its tail, a material part of its verified history, or gain
 * new unexplained breaks while reconciliation is still on the same endpoint.
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
  if (nextPrimary.length < previousPrimary.length * 0.95) return true;
  if (nextEnd === previousEnd) {
    const previousBreaks = previousPrimary.reduce((total, point) => total + (point.breakBefore ? 1 : 0), 0);
    const nextBreaks = nextPrimary.reduce((total, point) => total + (point.breakBefore ? 1 : 0), 0);
    if (nextBreaks > previousBreaks) return true;
  }
  return false;
}
