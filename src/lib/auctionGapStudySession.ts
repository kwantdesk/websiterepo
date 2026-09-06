import { AuctionGapLiveLifecycle } from "./auctionGapLiveLifecycle.ts";
import { prepareAuctionGapStudy, type AuctionGapStudyInput, type AuctionGapStudyResult } from "./auctionGapStudy.ts";
import { normalizeAuctionGapDetection } from "./auctionGapTracker.ts";
import type { AuctionGapChartGeometry } from "./auctionGapRows.ts";

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
 * Event charts still require exact seed reconstruction; never time-bin them.
 */
export class AuctionGapStudySession {
  private engine: AuctionGapLiveLifecycle | null = null;
  private signature = "";
  private scope = "";
  private last: AuctionGapChartGeometry | null = null;
  private lastIndex = -1;
  private asOf = -Infinity;

  reset(scope: string, input: AuctionGapStudyInput): AuctionGapStudyResult {
    // A failed replacement seed must not allow live updates against stale history.
    this.engine = null;
    const prepared = prepareAuctionGapStudy(input);
    if (prepared.status !== "ready") return unavailable(prepared.reason);
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
    return { status: "ready", reason: null, zones: engine.snapshot() };
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
