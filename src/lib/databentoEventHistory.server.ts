import "server-only";

import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";
import {
  applyMarketTradesToEventBars,
  type MarketTrade,
} from "@/lib/eventBars";
import type { Candle } from "@/lib/backtester";
import { fetchRecordedTrades } from "@/lib/recordedTradeTape.server";
import { cmeEventTailCutoffMs } from "@/lib/chartHistoryWindow";
import { replayEventFlowWindow } from "@/lib/replayExecutionWindow";
import {
  databentoEventTimestampMs,
  databentoTradeAggressor,
} from "@/lib/tradeAggressor";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";

// Event charts must retain the same five-session history window as time-based
// charts. The previous 5,000-bar tail was too small for active contracts on
// 200/500-volume and smaller range intervals, so a fresh selection appeared to
// begin at the current tick even though Databento returned older executions.
// Four-tick range bars on NQ can exceed 120,000 rows inside five complete
// sessions. Capping at 120k and then requiring five sessions made the route
// reject its own correctly-built result as incomplete. Keep this aligned with
// the browser's 500k persistent-history ceiling while retaining headroom for
// the other chart state held alongside it.
const MAX_EVENT_BARS = 250_000;
const EVENT_BAR_FLUSH_SIZE = 16_384;
// Keep one exact aggressor-flow bucket per second instead of retaining only
// the final 25,000 raw prints. NQ can exhaust 25,000 executions in minutes,
// leaving a historical CVD line visible only at the far-right edge. A
// one-second bucket preserves total ask volume, bid volume and net delta for
// the complete requested window while staying small enough for the browser.
const MAX_EVENT_FLOW_BUCKETS = 30_000;
const EVENT_FLOW_BUCKET_MS = 1_000;
const EVENT_EXECUTION_LOOKBACK_MS = 6 * 60 * 60_000;
/**
 * A replay asks for its flow FORWARD from where the trader hits play, not
 * backward from the end of the fetched window.
 *
 * A backtest loads candles for [session - 5 days, session + 1 day] so the
 * profiles behind the cursor have history. Looking six hours back from that
 * window's end lands most of a day AFTER the replay start, so order-flow
 * studies stayed empty through the entire session being replayed and only
 * woke up near the end. Anchoring to the start instead covers the session the
 * trader is actually watching.
 *
 * Eight hours spans a full RTH session with room either side, and stays
 * inside MAX_EVENT_FLOW_BUCKETS at one-second resolution (28,800 of 30,000).
 */
const EVENT_REPLAY_EXECUTION_WINDOW_MS = 8 * 60 * 60_000;
type EventHistorySchema = "trades";

export type DatabentoEventExecutionTuple = [
  timestamp: number,
  price: number,
  size: number,
  delta: number,
  askVolume?: number,
  bidVolume?: number,
  trades?: number,
  kind?: "flow",
];

function fixedPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

function eventTime(value: unknown) {
  return databentoEventTimestampMs(value) ?? 0;
}

function isContinuousFuture(symbol: string) {
  return /\.[vnc]\.\d+$/.test(symbol);
}

function availableEnd(detail: string) {
  try {
    const payload = JSON.parse(detail) as {
      detail?: { case?: string; payload?: { available_end?: unknown } };
    };
    if (payload.detail?.case !== "data_end_after_available_end") return null;
    const timestamp = Date.parse(String(payload.detail.payload?.available_end ?? ""));
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

function eventHistorySchema(timeframe: string): EventHistorySchema {
  // Every non-time interval is defined by the ordered execution tape. A
  // one-second OHLCV candle cannot reveal the order in which its high/low
  // printed or how volume was distributed along that path. Reconstructing a
  // 500V/range/Renko bar from four invented pseudo-trades therefore changes
  // opens, closes and threshold boundaries. Stream native trades for every
  // event interval so history and the live Rithmic continuation use one
  // deterministic bar builder.
  void timeframe;
  return "trades";
}

function adaptiveEventStart(timeframe: string, requestedStart: number, end: number, schema: EventHistorySchema) {
  const interval = getChartInterval(timeframe);
  if (!interval || !isEventBasedChartInterval(timeframe)) return requestedStart;
  // The stream is processed incrementally and keeps only bounded finished
  // bars, so retaining the requested five-session window does not require
  // holding the raw tape in server memory.
  void end;
  void schema;
  return requestedStart;
}

function decodeTrade(row: Record<string, unknown>): MarketTrade | null {
  const size = Math.max(0, Number(row.size ?? 0));
  const aggressor = databentoTradeAggressor(row.side ?? row.aggressor_side);
  const timestamp = eventTime(
    row.ts_event
    ?? row.ts_recv
    ?? (row.hd as Record<string, unknown> | undefined)?.ts_event,
  );
  const price = fixedPrice(row.price);
  if (timestamp <= 0 || price <= 0 || size <= 0) return null;
  return {
    timestamp,
    price,
    size,
    trades: 1,
    // Databento encodes the resting book side: ASK is a sell aggressor and
    // BID is a buy aggressor.
    delta: aggressor === "BUY" ? size : aggressor === "SELL" ? -size : 0,
  };
}

async function streamEventBars(args: {
  symbol: string;
  timeframe: string;
  start: number;
  end: number;
  canRetryEnd?: boolean;
}): Promise<Candle[]> {
  /*
   * Built from the desk's own recorded prints.
   *
   * This asked the vendor for a raw GLBX trades feed, which now answers 422
   * "requires a subscription" for the whole window - so every range, volume,
   * renko and tick chart returned no history at all. The prints the geometry
   * needs are the ones the collector has been recording the whole time.
   */
  const trades = (await fetchRecordedTrades({
    symbol: args.symbol,
    startMs: args.start,
    endMs: args.end,
  })).map((trade) => ({
    timestamp: trade.timestamp,
    price: trade.price,
    size: trade.size,
    trades: 1,
    // The tape carries the recorded aggressor as 1 / -1 / 0. Zero means the
    // feed did not say, and a delta bar must show no delta rather than a
    // guessed one.
    delta: trade.side > 0 ? trade.size : trade.side < 0 ? -trade.size : 0,
  } satisfies MarketTrade));

  let bars: Candle[] = [];
  /*
   * In batches, exactly as the streaming path did. The builder carries the
   * open bar across calls, so this is only about peak memory - a whole
   * session handed over in one array would hold every print live at once.
   */
  for (let index = 0; index < trades.length; index += EVENT_BAR_FLUSH_SIZE) {
    bars = applyMarketTradesToEventBars(
      bars,
      trades.slice(index, index + EVENT_BAR_FLUSH_SIZE),
      args.timeframe,
      args.symbol,
      MAX_EVENT_BARS,
    );
  }
  return bars;
}

/**
 * Fetch the recent native execution tape alongside event-built candles.
 *
 * Keep a bounded recent native tape so Big Contracts stays attached to the
 * bar where each print happened. Event-bar geometry itself is already built
 * from the complete ordered execution stream above.
 */
async function streamEventFlow(args: {
  symbol: string;
  candles: Candle[];
  start: number;
  end: number;
  canRetryEnd?: boolean;
}): Promise<{ candles: Candle[]; executions: DatabentoEventExecutionTuple[] }> {
  // The same recorded prints the geometry above was built from, bucketed for
  // Big Trades and live-seam repair.
  const trades = await fetchRecordedTrades({
    symbol: args.symbol,
    startMs: args.start,
    endMs: args.end,
  });
  const executions: DatabentoEventExecutionTuple[] = [];
  const recentExecutionStart = args.end - EVENT_EXECUTION_LOOKBACK_MS;

  for (const trade of trades) {
    const askVolume = trade.side > 0 ? trade.size : 0;
    const bidVolume = trade.side < 0 ? trade.size : 0;
    const delta = askVolume - bidVolume;
    // A print the feed gave no side for carries no delta, so it cannot belong
    // to a flow bucket - the same test the vendor path applied.
    if (delta === 0 || !args.candles.length) continue;
    // Big Trades and live seam repair only need the recent compact tape. CVD
    // has already received the full-history flow through the bar geometry.
    if (trade.timestamp < recentExecutionStart) continue;

    const bucketTimestamp = Math.floor(trade.timestamp / EVENT_FLOW_BUCKET_MS) * EVENT_FLOW_BUCKET_MS;
    const previous = executions.at(-1);
    if (previous?.[0] === bucketTimestamp) {
      previous[1] = trade.price;
      previous[2] += trade.size;
      previous[3] += delta;
      previous[4] = Number(previous[4] ?? 0) + askVolume;
      previous[5] = Number(previous[5] ?? 0) + bidVolume;
      previous[6] = Number(previous[6] ?? 0) + 1;
      continue;
    }
    executions.push([bucketTimestamp, trade.price, trade.size, delta, askVolume, bidVolume, 1, "flow"]);
    if (executions.length > MAX_EVENT_FLOW_BUCKETS) {
      executions.splice(0, executions.length - MAX_EVENT_FLOW_BUCKETS);
    }
  }

  return {
    // Geometry and full-window order flow were already calculated from the
    // exact same execution stream. Never overwrite a threshold bar with a
    // second-pass aggregate: one large execution can legitimately be split
    // across several volume bars at the same source timestamp.
    candles: args.candles,
    executions,
  };
}

export async function getDatabentoEventBars(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
) {
  const requestedStart = Date.parse(start);
  const requestedEnd = Date.parse(end);
  if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd) || requestedEnd <= requestedStart) {
    throw new Error("A valid CME event-history window is required.");
  }
  if (!isEventBasedChartInterval(timeframe)) throw new Error(`Unsupported event interval: ${timeframe}`);
  const schema = eventHistorySchema(timeframe);
  return streamEventBars({
    symbol,
    timeframe,
    start: adaptiveEventStart(timeframe, requestedStart, requestedEnd, schema),
    end: requestedEnd,
  });
}

export async function getDatabentoEventHistory(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
  /**
   * Where a replay's execution tape should begin. Omitted for live charts,
   * which still want the most recent window ending at `end`.
   */
  executionStartMs?: number,
) {
  const requestedStart = Date.parse(start);
  const requestedEnd = Date.parse(end);
  if (!Number.isFinite(requestedStart) || !Number.isFinite(requestedEnd) || requestedEnd <= requestedStart) {
    throw new Error("A valid CME event-history window is required.");
  }
  if (!isEventBasedChartInterval(timeframe)) throw new Error(`Unsupported event interval: ${timeframe}`);

  const candles = await getDatabentoEventBars(symbol, timeframe, start, end);
  const latestCandleTimestamp = Number(candles.at(-1)?.timestamp ?? 0);
  // On weekends and exchange closures, `requestedEnd` can sit days after the
  // final traded event. Looking back six hours from wall-clock now therefore
  // returns no executions even though the chart correctly contains Friday's
  // event bars. Anchor the flow window to the latest actual candle whenever
  // the market tail is stale; during a live session retain the real request
  // end so the forming bar receives the freshest executions.
  const requestedExecutionEnd = latestCandleTimestamp > 0
    && requestedEnd - latestCandleTimestamp > 10 * 60_000
      ? Math.min(requestedEnd, latestCandleTimestamp + 60_000)
      : requestedEnd;
  const finalBarCutoff = cmeEventTailCutoffMs(candles, requestedEnd);
  const executionEnd = finalBarCutoff === null
    ? requestedExecutionEnd
    : Math.min(requestedExecutionEnd, finalBarCutoff);
  // A replay anchors its tape to the moment play begins; a live chart wants
  // the window that ends at `end`. Both stay bounded — event candles already
  // carry exact full-window volume and delta, so this second pass only builds
  // the compact indicator tape and never re-reads the same five sessions.
  const flowWindow = replayEventFlowWindow({
    requestedStart,
    executionEnd,
    anchorMs: executionStartMs,
    trailingLookbackMs: EVENT_EXECUTION_LOOKBACK_MS,
    forwardWindowMs: EVENT_REPLAY_EXECUTION_WINDOW_MS,
  });
  const flow = flowWindow === null
    ? { candles, executions: [] as DatabentoEventExecutionTuple[] }
    : await streamEventFlow({
      symbol,
      candles,
      start: flowWindow.start,
      end: flowWindow.end,
    }).catch(() => ({ candles, executions: [] as DatabentoEventExecutionTuple[] }));
  return flow;
}
