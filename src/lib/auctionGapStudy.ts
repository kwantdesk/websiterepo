import type { Candle } from "./backtester.ts";
import type { InstitutionalTrade } from "./institutionalMarketData.ts";
import { AuctionGapSessionClock, type AuctionGapCalendar, type AuctionGapTimeSettings } from "./auctionGapSessionClock.ts";
import { prepareAuctionGapExecutions } from "./auctionGapExecutions.ts";
import { allocateAuctionGapTimeExecutions } from "./auctionGapTimeAllocation.ts";
import { allocateAuctionGapEventExecutions } from "./auctionGapEventAllocation.ts";
import { buildAuctionGapRows, type AuctionGapChartGeometry } from "./auctionGapRows.ts";
import { buildAuctionGapLifecycle, type AuctionGapLifecycleSettings, type AuctionGapZone, type AuctionGapSourceBar } from "./auctionGapLifecycle.ts";

export type AuctionGapStudyInput = {
  contractSymbol: string;
  expectedContract: string;
  tickSize: number;
  asOfMs: number;
  coverage: "complete" | "partial";
  records: InstitutionalTrade[];
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
export type AuctionGapPreparedStudy = { status: "ready"; reason: null; segments: AuctionGapSourceBar[] }
  | { status: "unavailable"; reason: string; segments: [] };

export function prepareAuctionGapStudy(input: AuctionGapStudyInput): AuctionGapPreparedStudy {
  const unavailable = (reason: string): AuctionGapPreparedStudy => ({ status: "unavailable", reason, segments: [] });
  let clock: AuctionGapSessionClock;
  try { clock = new AuctionGapSessionClock(input.calendar, input.timeSettings); }
  catch { return unavailable("invalid-calendar"); }
  const source = prepareAuctionGapExecutions(input, clock);
  if (source.status !== "ready") return unavailable(source.status);
  if (input.candles.length !== input.geometry.length) return unavailable("geometry-mismatch");
  for (let i = 0; i < input.candles.length; i++) {
    const candle = input.candles[i], geometry = input.geometry[i];
    if (candle.timestamp !== geometry.timestamp) return unavailable("geometry-mismatch");
    for (const [price, tick] of [[candle.open, geometry.openTick], [candle.close, geometry.closeTick],
      [candle.low, geometry.lowTick], [candle.high, geometry.highTick]]) {
      if (!Number.isFinite(price) || Math.abs(price / input.tickSize - tick) > 1e-6) return unavailable("geometry-mismatch");
    }
  }
  const allocation = input.chart.kind === "time"
    ? allocateAuctionGapTimeExecutions(source.executions, input.geometry.map((bar, i) => ({
      id: bar.id, startMs: bar.timestamp, endMs: bar.endTime, expectedVolume: Number(input.candles[i].volume),
    })))
    : allocateAuctionGapEventExecutions({ executions: source.executions, expectedCandles: input.candles,
      timeframe: input.chart.timeframe, symbol: input.chart.symbol, tickSize: input.tickSize });
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
