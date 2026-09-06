import { AuctionGapLiveLifecycle } from "./auctionGapLiveLifecycle.ts";
import { prepareAuctionGapStudy, auctionGapGeometryMatches, type AuctionGapStudyInput, type AuctionGapStudyResult } from "./auctionGapStudy.ts";
import { normalizeAuctionGapDetection } from "./auctionGapTracker.ts";
import { buildAuctionGapRows, type AuctionGapChartGeometry } from "./auctionGapRows.ts";
import { prepareAuctionGapExecutions, type AuctionGapExecution } from "./auctionGapExecutions.ts";
import { AuctionGapSessionClock } from "./auctionGapSessionClock.ts";
import { advanceAuctionGapEventExecutions, type AuctionGapEventContinuation } from "./auctionGapEventAllocation.ts";

const unavailable = (reason: string): AuctionGapStudyResult => ({ status: "unavailable", reason, zones: [] });
function configuration(input: AuctionGapStudyInput) {
  const c = input.calendar, t = input.timeSettings, l = input.lifecycleSettings;
  return JSON.stringify([input.contractSymbol, input.expectedContract, input.tickSize, input.chart,
    c.timeZone, c.sessionOpenMinutes, c.rthStartMinutes, c.rthEndMinutes,
    t.resetMode, t.filterTime, t.customStartMinutes, t.customEndMinutes,
    normalizeAuctionGapDetection(input.detectionSettings), l.extendedBars, l.retestMode, l.showTriggered, l.onlyTriggered]);
}

/** Owns a validated historical seed and its live lifecycle inside a worker.
 * Time-tail input is the COMPLETE current bar's executions, not a tick delta.
 * Event tails append new executions using the unchanged builder checkpoint;
 * historical corrections still require exact reconstruction, never time bins.
 */
export class AuctionGapStudySession {
  private engine: AuctionGapLiveLifecycle | null = null;
  private signature = "";
  private scope = "";
  private last: AuctionGapChartGeometry | null = null;
  private lastIndex = -1;
  private asOf = -Infinity;
  private eventState: AuctionGapEventContinuation | null = null;
  private committedIds = new Set<string>();
  private eventTail: AuctionGapExecution[] = [];
  private readonly executionLimit: number;

  constructor(executionLimit = 1_000_000) {
    if (!Number.isSafeInteger(executionLimit) || executionLimit < 1) throw new Error("Invalid execution retention limit");
    this.executionLimit = executionLimit;
  }

  reset(scope: string, input: AuctionGapStudyInput): AuctionGapStudyResult {
    // A failed replacement seed must not allow live updates against stale history.
    this.engine = null;
    this.eventState = null; this.committedIds.clear(); this.eventTail = [];
    const prepared = prepareAuctionGapStudy(input);
    if (prepared.status !== "ready") return unavailable(prepared.reason);
    if (prepared.eventContinuation && prepared.executions.length > this.executionLimit) return unavailable("execution-capacity-limit");
    const engine = new AuctionGapLiveLifecycle({ groupTicks: 1, inputType: "volume", sizeFiltered: false },
      input.detectionSettings, input.lifecycleSettings);
    for (let start = 0; start < prepared.segments.length;) {
      let end = start + 1;
      while (end < prepared.segments.length && prepared.segments[end].chartIndex === prepared.segments[start].chartIndex) end++;
      const status = engine.updateTail(prepared.segments.slice(start, end));
      if (status !== "ready") return unavailable(status);
      start = end;
    }
    this.engine = engine; this.signature = configuration(input); this.scope = scope;
    this.last = input.geometry.length ? { ...input.geometry.at(-1)! } : null;
    this.lastIndex = input.geometry.length - 1; this.asOf = input.asOfMs;
    this.eventState = prepared.eventContinuation;
    if (this.eventState) {
      this.committedIds = new Set(prepared.executions.map(execution => execution.id));
      this.eventTail = prepared.executions.filter((_, i) => prepared.assignments[i].chartIndex === this.lastIndex);
    }
    return { status: "ready", reason: null, zones: engine.snapshot() };
  }

  /** Append-only new executions, with expected geometry from the previous last
   * event bar onward. Corrections and coalesced/missing batches need reseeding.
   */
  updateEventTail(scope: string, chartIndex: number, input: AuctionGapStudyInput): AuctionGapStudyResult {
    if (!this.engine || !this.eventState || !this.last || scope !== this.scope
      || configuration(input) !== this.signature || input.chart.kind !== "event"
      || input.asOfMs < this.asOf || chartIndex !== this.lastIndex) return unavailable("requires-rebuild");
    if (!auctionGapGeometryMatches(input) || input.geometry[0]?.id !== this.last.id
      || input.geometry[0]?.timestamp !== this.last.timestamp) return unavailable("geometry-mismatch");
    const source = prepareAuctionGapExecutions(input, new AuctionGapSessionClock(input.calendar, input.timeSettings));
    if (source.status !== "ready") return unavailable(source.status);
    if (this.committedIds.size + source.executions.length > this.executionLimit) return unavailable("execution-capacity-limit");
    const allocation = advanceAuctionGapEventExecutions({ executions: source.executions, expectedCandles: input.candles,
      timeframe: input.chart.timeframe, symbol: input.chart.symbol, tickSize: input.tickSize }, this.eventState, this.committedIds);
    if (allocation.status !== "ready" || !allocation.continuation) return unavailable(allocation.status);
    const executions = [...this.eventTail, ...source.executions];
    const assignments = [
      ...this.eventTail.map(execution => ({ executionId: execution.id, chartIndex: 0 })),
      ...allocation.assignments.map(assignment => ({ ...assignment, chartIndex: assignment.chartIndex - chartIndex })),
    ];
    const rows = buildAuctionGapRows({ executions, assignments, bars: input.geometry, instrument: input.contractSymbol });
    if (rows.status !== "ready") return unavailable(rows.status);
    for (let start = 0; start < rows.segments.length;) {
      let end = start + 1;
      while (end < rows.segments.length && rows.segments[end].chartIndex === rows.segments[start].chartIndex) end++;
      const status = this.engine.updateTail(rows.segments.slice(start, end).map(segment => ({
        ...segment, bar: segment.rawBar, detect: true, chartIndex: chartIndex + segment.chartIndex,
      })));
      if (status !== "ready") { this.engine = null; return unavailable(status); }
      start = end;
    }
    this.eventState = allocation.continuation;
    source.executions.forEach(execution => this.committedIds.add(execution.id));
    this.lastIndex = allocation.continuation.chartIndex;
    this.last = { ...input.geometry.at(-1)! }; this.asOf = input.asOfMs;
    this.eventTail = executions.filter((_, i) => assignments[i].chartIndex === input.geometry.length - 1);
    return { status: "ready", reason: null, zones: this.engine.snapshot() };
  }

  updateTimeTail(scope: string, chartIndex: number, input: AuctionGapStudyInput): AuctionGapStudyResult {
    if (!this.engine || scope !== this.scope || configuration(input) !== this.signature
      || input.chart.kind !== "time" || input.asOfMs < this.asOf) return unavailable("requires-rebuild");
    if (!Number.isSafeInteger(chartIndex) || chartIndex < 0 || input.geometry.length !== 1
      || input.candles.length !== 1) return unavailable("invalid-tail");
    const bar = input.geometry[0];
    if (chartIndex === this.lastIndex) {
      if (!this.last || bar.id !== this.last.id || bar.timestamp !== this.last.timestamp
        || bar.endTime !== this.last.endTime || (this.last.isClosed && !bar.isClosed)) return unavailable("requires-rebuild");
    } else if (chartIndex !== this.lastIndex + 1 || (this.last && (!this.last.isClosed || bar.timestamp < this.last.endTime))) {
      // Finalize the previous bar before advancing. A dropped closing update
      // must not freeze provisional zones or lose the last executions of a bar.
      return unavailable("requires-rebuild");
    }
    const prepared = prepareAuctionGapStudy(input);
    if (prepared.status !== "ready") return unavailable(prepared.reason);
    const status = this.engine.updateTail(prepared.segments.map(segment => ({ ...segment, chartIndex })));
    if (status !== "ready") return unavailable(status);
    this.last = { ...bar }; this.lastIndex = chartIndex; this.asOf = input.asOfMs;
    return { status: "ready", reason: null, zones: this.engine.snapshot() };
  }
}
