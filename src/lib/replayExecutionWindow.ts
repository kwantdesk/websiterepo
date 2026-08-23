/**
 * Return the exact, timestamp-ordered execution window visible at a replay
 * clock. Historical order-flow tapes can contain hundreds of thousands of
 * prints; filtering the complete tape on every replay frame stalls every
 * chart sharing the browser main thread. Binary bounds keep the lookup
 * logarithmic while preserving every classified execution inside the window.
 */
export function sliceReplayExecutionWindow<T extends { timestamp: number }>(
  records: readonly T[],
  clock: number | null,
  lookbackMs: number,
): T[] {
  if (clock === null || !Number.isFinite(clock) || !records.length) return [];
  const start = Math.max(0, clock - Math.max(0, lookbackMs));

  let low = 0;
  let high = records.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (records[middle].timestamp < start) low = middle + 1;
    else high = middle;
  }
  const startIndex = low;

  low = startIndex;
  high = records.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (records[middle].timestamp <= clock) low = middle + 1;
    else high = middle;
  }

  return records.slice(startIndex, low);
}
