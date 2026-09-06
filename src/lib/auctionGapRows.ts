import type { AuctionGapExecution } from "./auctionGapExecutions.ts";
import type { AuctionGapBar } from "./auctionGapTracker.ts";

export type AuctionGapChartGeometry = {
  id: string;
  timestamp: number;
  endTime: number;
  lowTick: number;
  highTick: number;
  openTick: number;
  closeTick: number;
  isClosed: boolean;
  /** Mandatory for zero-execution bars; may differ from synthetic timestamp. */
  emptySourceTime?: number;
  emptyResetKey?: string | null;
};
export type AuctionGapRowSegment = {
  chartIndex: number;
  resetKey: string | null;
  rawBar: AuctionGapBar;
  detectionBar: AuctionGapBar;
};

/** Materialize only validated, completely allocated executions. Row positions
 * are actual traded ticks, never synthetic candle boundary prices. Separate
 * maps preserve unfiltered retests and time-filtered detection. Reset changes
 * within one chart bar produce ordered subsegments, not a merged session.
 */
export function buildAuctionGapRows(input: {
  executions: readonly AuctionGapExecution[];
  assignments: readonly { executionId: string; chartIndex: number }[];
  bars: readonly AuctionGapChartGeometry[];
  instrument: string;
}): { status: "ready" | "invalid-allocation"; segments: AuctionGapRowSegment[] } {
  const fail = () => ({ status: "invalid-allocation" as const, segments: [] });
  if (!input.instrument || input.executions.length !== input.assignments.length) return fail();
  const ids = new Set<string>();
  for (const bar of input.bars) {
    if (!bar.id || ids.has(bar.id) || ![bar.timestamp, bar.endTime].every(Number.isFinite) || bar.endTime < bar.timestamp
      || ![bar.lowTick, bar.highTick, bar.openTick, bar.closeTick].every(Number.isSafeInteger)
      || bar.lowTick > Math.min(bar.openTick, bar.closeTick) || bar.highTick < Math.max(bar.openTick, bar.closeTick)) return fail();
    ids.add(bar.id);
  }
  const byBar = new Map<number, AuctionGapExecution[]>();
  const executionIds = new Set<string>();
  let previousIndex = -1, previousTime = -Infinity;
  for (let i = 0; i < input.executions.length; i++) {
    const execution = input.executions[i], assignment = input.assignments[i];
    if (executionIds.has(execution.id) || execution.id !== assignment.executionId || !Number.isInteger(assignment.chartIndex)
      || assignment.chartIndex < previousIndex || assignment.chartIndex < 0 || assignment.chartIndex >= input.bars.length
      || !Number.isFinite(execution.timestamp) || execution.timestamp < previousTime || !Number.isSafeInteger(execution.tickIndex)
      || [execution.volume, execution.bidVolume, execution.askVolume, execution.unknownVolume].some(v => !Number.isFinite(v) || v < 0)
      || execution.volume <= 0 || Math.abs(execution.volume - execution.bidVolume - execution.askVolume - execution.unknownVolume) > 1e-8) return fail();
    executionIds.add(execution.id); previousIndex = assignment.chartIndex; previousTime = execution.timestamp;
    const list = byBar.get(assignment.chartIndex) ?? [];
    list.push(execution); byBar.set(assignment.chartIndex, list);
  }
  const segments: AuctionGapRowSegment[] = [];
  for (let chartIndex = 0; chartIndex < input.bars.length; chartIndex++) {
    const geometry = input.bars[chartIndex], executions = byBar.get(chartIndex) ?? [];
    const groups: AuctionGapExecution[][] = [];
    for (const execution of executions) {
      const previous = groups.at(-1);
      if (!previous || previous[0].resetKey !== execution.resetKey) groups.push([execution]);
      else previous.push(execution);
    }
    // A synthetic bridge's timestamp can be ahead of the actual source clock.
    // Require explicit provenance instead of guessing a reset or trade time.
    if (!groups.length) {
      if (!Number.isFinite(geometry.emptySourceTime) || geometry.emptyResetKey === undefined) return fail();
      groups.push([]);
    }
    for (let part = 0; part < groups.length; part++) {
      const group = groups[part];
      const raw = new Map<number, AuctionGapBar["rows"][number]>();
      const filtered = new Map<number, AuctionGapBar["rows"][number]>();
      let lowTick = geometry.lowTick, highTick = geometry.highTick;
      const add = (map: typeof raw, execution: AuctionGapExecution) => {
        const row = map.get(execution.tickIndex) ?? { tickIndex: execution.tickIndex, bidVolume: 0, askVolume: 0, unknownVolume: 0 };
        row.bidVolume += execution.bidVolume; row.askVolume += execution.askVolume; row.unknownVolume += execution.unknownVolume;
        map.set(execution.tickIndex, row);
      };
      for (const execution of group) {
        add(raw, execution); if (execution.detect) add(filtered, execution);
        lowTick = Math.min(lowTick, execution.tickIndex); highTick = Math.max(highTick, execution.tickIndex);
      }
      const base = { id: JSON.stringify([geometry.id, part]), instrument: input.instrument,
        startTime: group[0]?.timestamp ?? geometry.emptySourceTime!, endTime: group.at(-1)?.timestamp ?? geometry.emptySourceTime!,
        openTick: geometry.openTick, closeTick: geometry.closeTick, lowTick, highTick,
        isClosed: geometry.isClosed, hasPriceLevelFlow: true };
      const rows = (map: typeof raw) => [...map.values()].sort((a, b) => a.tickIndex - b.tickIndex);
      segments.push({ chartIndex, resetKey: group.length ? group[0].resetKey : geometry.emptyResetKey!,
        rawBar: { ...base, rows: rows(raw) }, detectionBar: { ...base, rows: rows(filtered) } });
    }
  }
  return { status: "ready", segments };
}
