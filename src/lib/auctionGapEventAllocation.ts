import type { Candle } from "./backtester.ts";
import { applyMarketTradesToEventBars, futuresTickSize, type EventCandle } from "./eventBars.ts";
import { getChartInterval, isEventBasedChartInterval } from "./chartIntervals.ts";
import type { AuctionGapExecution } from "./auctionGapExecutions.ts";

export type AuctionGapEventContinuation = {
  timeframe: string; symbol: string; tickSize: number;
  lastCandle: EventCandle | null;
  chartIndex: number;
  lastTimestamp: number;
};
type AllocationInput = {
  executions: readonly AuctionGapExecution[];
  expectedCandles: readonly Candle[];
  timeframe: string;
  symbol: string;
  tickSize: number;
};
type AllocationResult = {
  status: "ready" | "source-chart-mismatch" | "invalid-source";
  assignments: { executionId: string; chartIndex: number }[];
  continuation: AuctionGapEventContinuation | null;
};

/** Use the unchanged chart builder, but replay only its forming tail per print.
 * Compare volume deltas to recover the exact owning chart index. Never allocate
 * by synthetic chart timestamp or copy flow into zero-volume bridge bars.
 * Expected candles must cover this exact source seed, not a truncated viewport.
 */
export function allocateAuctionGapEventExecutions(input: AllocationInput): AllocationResult {
  return allocate(input, null, new Set());
}

/** Append-only source batch after a validated allocation checkpoint. Expected
 * candles cover the old last candle plus every resulting new/bridge candle.
 * Caller supplies committed IDs, commits returned state only on success, and
 * rebuilds on corrections. This function never mutates the checkpoint or IDs.
 */
export function advanceAuctionGapEventExecutions(input: AllocationInput,
  continuation: AuctionGapEventContinuation, committedIds: ReadonlySet<string>): AllocationResult {
  return allocate(input, continuation, committedIds);
}

function allocate(input: AllocationInput, seed: AuctionGapEventContinuation | null,
  committedIds: ReadonlySet<string>): AllocationResult {
  const fail = (status: "source-chart-mismatch" | "invalid-source"): AllocationResult => ({ status, assignments: [], continuation: null });
  const interval = getChartInterval(input.timeframe);
  if (!interval || !isEventBasedChartInterval(input.timeframe) || input.tickSize !== futuresTickSize(input.symbol)) return fail("invalid-source");
  if (seed && (seed.timeframe !== input.timeframe || seed.symbol !== input.symbol || seed.tickSize !== input.tickSize
    || !Number.isSafeInteger(seed.chartIndex) || seed.chartIndex < -1
    || (seed.lastCandle === null) !== (seed.chartIndex === -1))) return fail("invalid-source");
  const rebuilt: EventCandle[] = seed?.lastCandle ? [{ ...seed.lastCandle }] : [];
  const indexOffset = seed?.lastCandle ? seed.chartIndex : 0;
  const assignments: { executionId: string; chartIndex: number }[] = [];
  const identities = new Set<string>();
  let priorTimestamp = seed?.lastTimestamp ?? -Infinity;
  for (const execution of input.executions) {
    const price = execution.tickIndex * input.tickSize;
    if (committedIds.has(execution.id) || identities.has(execution.id) || !Number.isFinite(execution.timestamp) || execution.timestamp < priorTimestamp
      || !Number.isSafeInteger(execution.tickIndex) || !(price > 0) || !Number.isFinite(price)
      || !(execution.volume > 0) || !Number.isFinite(execution.volume)
      || !(execution.tradeCount > 0) || !Number.isFinite(execution.tradeCount)
      || [execution.bidVolume, execution.askVolume, execution.unknownVolume].some(v => !Number.isFinite(v) || v < 0)
      || Math.abs(execution.bidVolume + execution.askVolume + execution.unknownVolume - execution.volume) > 1e-8) return fail("invalid-source");
    identities.add(execution.id); priorTimestamp = execution.timestamp;
    const previous = rebuilt.at(-1);
    const startIndex = previous ? rebuilt.length - 1 : 0;
    const next = applyMarketTradesToEventBars(previous ? [previous] : [], [{ timestamp: execution.timestamp,
      price, size: execution.volume, trades: execution.tradeCount, delta: execution.askVolume - execution.bidVolume }],
    input.timeframe, input.symbol, Number.MAX_SAFE_INTEGER) as EventCandle[];
    let owner = -1, allocated = 0;
    for (let i = 0; i < next.length; i++) {
      const added = Number(next[i].volume ?? 0) - (i === 0 && previous ? Number(previous.volume ?? 0) : 0);
      if (added < 0 || !Number.isFinite(added)) return fail("invalid-source");
      if (added > 0) {
        if (owner !== -1) return fail("source-chart-mismatch");
        owner = indexOffset + startIndex + i;
        allocated += added;
      }
    }
    if (owner < 0 || Math.abs(allocated - execution.volume) > 1e-8) return fail("source-chart-mismatch");
    if (previous) rebuilt.pop();
    rebuilt.push(...next);
    assignments.push({ executionId: execution.id, chartIndex: owner });
  }
  if (rebuilt.length !== input.expectedCandles.length) return fail("source-chart-mismatch");
  for (let index = 0; index < rebuilt.length; index++) {
    const expected = input.expectedCandles[index], actual = rebuilt[index];
    if (expected.timestamp !== actual.timestamp) return fail("source-chart-mismatch");
    for (const key of ["open", "high", "low", "close", "volume"] as const) {
      const value = Number(expected[key]), computed = Number(actual[key]);
      const tolerance = key === "volume" ? 1e-8 : input.tickSize * 1e-6;
      if (!Number.isFinite(value) || Math.abs(value - computed) > tolerance) return fail("source-chart-mismatch");
    }
  }
  return { status: "ready", assignments, continuation: {
    timeframe: input.timeframe, symbol: input.symbol, tickSize: input.tickSize,
    lastCandle: rebuilt.length ? { ...rebuilt.at(-1)! } : null,
    chartIndex: rebuilt.length ? indexOffset + rebuilt.length - 1 : -1,
    lastTimestamp: priorTimestamp,
  } };
}
