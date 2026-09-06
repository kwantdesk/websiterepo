import type { AuctionGapExecution } from "./auctionGapExecutions.ts";

export type AuctionGapTimeBar = {
  id: string;
  startMs: number;
  endMs: number;
  /** Authoritative actual execution volume, not interpolated gap-fill volume. */
  expectedVolume: number;
};

/** Explicit half-open intervals, no approximate duration inferred from the next
 * candle. Records in a market/session gap cannot leak into the previous bar.
 * Input and expected volumes must already be clipped to the same replay cutoff.
 */
export function allocateAuctionGapTimeExecutions(
  executions: readonly AuctionGapExecution[], bars: readonly AuctionGapTimeBar[],
): { status: "ready" | "invalid-source" | "unassigned-execution" | "source-chart-mismatch";
  assignments: { executionId: string; chartIndex: number }[] } {
  const fail = (status: "invalid-source" | "unassigned-execution" | "source-chart-mismatch") => ({ status, assignments: [] });
  const barIds = new Set<string>();
  let lastEnd = -Infinity;
  for (const bar of bars) {
    if (!bar.id || barIds.has(bar.id) || !Number.isFinite(bar.startMs) || !Number.isFinite(bar.endMs)
      || bar.endMs <= bar.startMs || bar.startMs < lastEnd || !Number.isFinite(bar.expectedVolume) || bar.expectedVolume < 0) {
      return fail("invalid-source");
    }
    barIds.add(bar.id); lastEnd = bar.endMs;
  }
  const assignments: { executionId: string; chartIndex: number }[] = [];
  const sums = new Float64Array(bars.length);
  const executionIds = new Set<string>();
  let index = 0, previous = -Infinity;
  for (const execution of executions) {
    if (!execution.id || executionIds.has(execution.id) || !Number.isFinite(execution.timestamp)
      || execution.timestamp < previous || !Number.isFinite(execution.volume) || execution.volume <= 0) return fail("invalid-source");
    executionIds.add(execution.id); previous = execution.timestamp;
    while (index < bars.length && execution.timestamp >= bars[index].endMs) index++;
    if (index >= bars.length || execution.timestamp < bars[index].startMs) return fail("unassigned-execution");
    sums[index] += execution.volume;
    assignments.push({ executionId: execution.id, chartIndex: index });
  }
  for (let i = 0; i < bars.length; i++) {
    if (!Number.isFinite(sums[i]) || Math.abs(sums[i] - bars[i].expectedVolume) > 1e-8) return fail("source-chart-mismatch");
  }
  return { status: "ready", assignments };
}
