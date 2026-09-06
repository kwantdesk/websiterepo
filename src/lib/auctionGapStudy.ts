import type { Candle } from "./backtester.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import { AuctionGapSessionClock, type AuctionGapCalendar, type AuctionGapTimeSettings } from "./auctionGapSessionClock.ts";
import { prepareAuctionGapExecutions, type AuctionGapExecution } from "./auctionGapExecutions.ts";
import { allocateAuctionGapTimeExecutions } from "./auctionGapTimeAllocation.ts";
import { allocateAuctionGapEventExecutions, type AuctionGapEventContinuation } from "./auctionGapEventAllocation.ts";
import { buildAuctionGapRows, type AuctionGapChartGeometry } from "./auctionGapRows.ts";
import { buildAuctionGapLifecycle, type AuctionGapLifecycleSettings, type AuctionGapZone, type AuctionGapSourceBar } from "./auctionGapLifecycle.ts";
import { buildAuctionGapCompactSegments } from "./auctionGapCompactSegments.ts";
import type { AuctionGapCompactRowsResult } from "./auctionGapCompactRows.ts";

export type AuctionGapStudyInput = {
  contractSymbol: string;
  expectedContract: string;
  tickSize: number;
  asOfMs: number;
  coverage: "complete" | "partial";
  records: InstitutionalTrade[];
  compactHistory?: AuctionGapCompactRowsResult;
  candles: Candle[];
  geometry: AuctionGapChartGeometry[];
  chart: { kind: "time" } | { kind: "event"; timeframe: string; symbol: string };
  calendar: AuctionGapCalendar;
  timeSettings: AuctionGapTimeSettings;
  detectionSettings: Record<string, unknown>;
  lifecycleSettings: AuctionGapLifecycleSettings;
};
export type AuctionGapStudyResult = {
  status: "ready" | "unavailable";
  reason: string | null;
  zones: AuctionGapZone[];
};

/** Pure whole-history pipeline for worker execution. Failure does not mean
 * empty-success: UI must retain prior display with a truthful unavailable state.
 * Caller must supply fully source-matched/replay-clipped candles and coverage.
 */
export type AuctionGapPreparedStudy = { status: "ready"; reason: null; segments: AuctionGapSourceBar[];
  executions: AuctionGapExecution[]; assignments: { executionId: string; chartIndex: number }[];
  eventContinuation: AuctionGapEventContinuation | null }
  | { status: "unavailable"; reason: string; segments: [] };

export function auctionGapGeometryMatches(input: Pick<AuctionGapStudyInput, "candles" | "geometry" | "tickSize">) {
  if (input.candles.length !== input.geometry.length) return false;
  return input.candles.every((candle, i) => {
    const geometry = input.geometry[i];
    return candle.timestamp === geometry.timestamp
      && [[candle.open, geometry.openTick], [candle.close, geometry.closeTick],
        [candle.low, geometry.lowTick], [candle.high, geometry.highTick]]
        .every(([price, tick]) => Number.isFinite(price) && Number.isSafeInteger(tick)
          && Math.abs(price / input.tickSize - tick) <= 1e-6);
  });
}

export function prepareAuctionGapStudy(input: AuctionGapStudyInput): AuctionGapPreparedStudy {
  const unavailable = (reason: string): AuctionGapPreparedStudy => ({ status: "unavailable", reason, segments: [] });
  let clock: AuctionGapSessionClock;
  try { clock = new AuctionGapSessionClock(input.calendar, input.timeSettings); }
  catch { return unavailable("invalid-calendar"); }
  if (!auctionGapGeometryMatches(input)) return unavailable("geometry-mismatch");
  if (input.compactHistory) {
    if (input.compactHistory.status !== "ready") return unavailable("partial-history");
    const compactCount = input.compactHistory.bars.length;
    if (!compactCount || compactCount > input.candles.length) return unavailable("source-chart-mismatch");
    // With no live tape this is the immutable historical seed. Once exact
    // prints arrive, replace the last compact bar and append every newer bar
    // from executions. Replacing the seam is essential: a response can finish
    // while that bar is still developing, and merging its old rows with a
    // retained tape would either double count or hide a missing print.
    const seamIndex = input.records.length ? compactCount - 1 : compactCount;
    const compactBars = input.compactHistory.bars.slice(0, seamIndex).map((bar, chartIndex) => ({
      ...bar,
      chartIndex,
    }));
    const compactHistory: AuctionGapCompactRowsResult = {
      status: "ready",
      coverage: "complete",
      contractSymbol: input.compactHistory.contractSymbol,
      bars: compactBars,
    };
    const compact = buildAuctionGapCompactSegments({
      history: compactHistory,
      candles: input.candles.slice(0, seamIndex),
      expectedContract: input.expectedContract,
      chartKind: input.chart.kind,
      tickSize: input.tickSize,
      asOfMs: input.asOfMs,
      calendar: input.calendar,
      timeSettings: input.timeSettings,
    });
    if (compact.status !== "ready") return unavailable(compact.reason);
    if (!input.records.length) return { status: "ready", reason: null, segments: compact.segments,
      executions: [], assignments: [], eventContinuation: null };

    const seamBar = input.compactHistory.bars[seamIndex];
    const seamTimestamp = Number(seamBar?.sourceStartTimestamp
      ?? seamBar?.slices[0]?.startTime
      ?? seamBar?.timestamp);
    if (!Number.isFinite(seamTimestamp)) return unavailable("source-chart-mismatch");
    const tail = prepareAuctionGapStudy({
      ...input,
      compactHistory: undefined,
      records: input.records.filter((record) => record.timestamp >= seamTimestamp),
      candles: input.candles.slice(seamIndex),
      geometry: input.geometry.slice(seamIndex),
    });
    if (tail.status !== "ready") return tail;
    return { status: "ready", reason: null,
      executions: tail.executions,
      assignments: tail.assignments.map((assignment) => ({
        ...assignment,
        chartIndex: assignment.chartIndex + seamIndex,
      })),
      eventContinuation: tail.eventContinuation
        ? { ...tail.eventContinuation, chartIndex: tail.eventContinuation.chartIndex + seamIndex }
        : null,
      segments: [
        ...compact.segments,
        ...tail.segments.map((segment) => ({
          ...segment,
          chartIndex: Number(segment.chartIndex ?? 0) + seamIndex,
        })),
      ],
    };
  }
  const source = prepareAuctionGapExecutions(input, clock);
  if (source.status !== "ready") return unavailable(source.status);
  const eventAllocation = input.chart.kind === "event"
    ? allocateAuctionGapEventExecutions({ executions: source.executions, expectedCandles: input.candles,
      timeframe: input.chart.timeframe, symbol: input.chart.symbol, tickSize: input.tickSize }) : null;
  const allocation = eventAllocation ?? allocateAuctionGapTimeExecutions(source.executions, input.geometry.map((bar, i) => ({
      id: bar.id, startMs: bar.timestamp, endMs: bar.endTime, expectedVolume: Number(input.candles[i].volume),
    })));
  if (allocation.status !== "ready") return unavailable(allocation.status);
  if (input.chart.kind === "time") {
    const ohlc = new Map<number, { open: number; high: number; low: number; close: number }>();
    for (let i = 0; i < source.executions.length; i++) {
      const tick = source.executions[i].tickIndex, index = allocation.assignments[i].chartIndex;
      const value = ohlc.get(index) ?? { open: tick, high: tick, low: tick, close: tick };
      value.high = Math.max(value.high, tick); value.low = Math.min(value.low, tick); value.close = tick;
      ohlc.set(index, value);
    }
    for (const [index, value] of ohlc) {
      const bar = input.geometry[index];
      if (value.open !== bar.openTick || value.high !== bar.highTick || value.low !== bar.lowTick || value.close !== bar.closeTick) {
        return unavailable("execution-ohlc-mismatch");
      }
    }
  }
  const rows = buildAuctionGapRows({ executions: source.executions, assignments: allocation.assignments,
    bars: input.geometry, instrument: input.contractSymbol });
  if (rows.status !== "ready") return unavailable(rows.status);
  return { status: "ready", reason: null,
    executions: source.executions, assignments: allocation.assignments,
    eventContinuation: eventAllocation?.continuation ?? null,
    segments: rows.segments.map(segment => ({ ...segment, bar: segment.rawBar, detect: true })) };
}

export function calculateAuctionGapStudy(input: AuctionGapStudyInput): AuctionGapStudyResult {
  const prepared = prepareAuctionGapStudy(input);
  if (prepared.status !== "ready") return { status: "unavailable", reason: prepared.reason, zones: [] };
  const frame = buildAuctionGapLifecycle(prepared.segments,
    { groupTicks: 1, inputType: "volume", sizeFiltered: false }, input.detectionSettings, input.lifecycleSettings);
  if (frame.status !== "ready") return { status: "unavailable", reason: frame.status, zones: [] };
  return { status: "ready", reason: null, zones: frame.zones };
}
