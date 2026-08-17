import "server-only";

import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";
import {
  applyMarketTradesToEventBars,
  type MarketTrade,
} from "@/lib/eventBars";
import type { Candle } from "@/lib/backtester";
import { cmeEventTailCutoffMs } from "@/lib/chartHistoryWindow";
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
const MAX_EVENT_BARS = 120_000;
const EVENT_BAR_FLUSH_SIZE = 16_384;
// Keep one exact aggressor-flow bucket per second instead of retaining only
// the final 25,000 raw prints. NQ can exhaust 25,000 executions in minutes,
// leaving a historical CVD line visible only at the far-right edge. A
// one-second bucket preserves total ask volume, bid volume and net delta for
// the complete requested window while staying small enough for the browser.
const MAX_EVENT_FLOW_BUCKETS = 30_000;
const EVENT_FLOW_BUCKET_MS = 1_000;
const EVENT_EXECUTION_LOOKBACK_MS = 6 * 60 * 60_000;
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
  if (!vendorMarketDataConfigured("databento")) throw new Error("CME market data is not configured.");
  const schema = eventHistorySchema(args.timeframe);
  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "false",
    pretty_ts: "false",
    map_symbols: "false",
    symbols: args.symbol,
    stype_in: isContinuousFuture(args.symbol) ? "continuous" : "raw_symbol",
    schema,
    start: new Date(args.start).toISOString(),
    end: new Date(args.end).toISOString(),
  });
  const response = await vendorMarketDataFetch("databento", "/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // The VPS may retain this large rolling archive for several minutes.
      // Event geometry is continued by live executions, unlike ordinary
      // clock candles where a stale archive could create missing buckets.
      "X-KwantDesk-Event-History": "1",
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(280_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    const completedEnd = response.status === 422 && args.canRetryEnd !== false
      ? availableEnd(detail)
      : null;
    if (completedEnd && completedEnd > args.start && completedEnd < args.end) {
      return streamEventBars({ ...args, end: completedEnd - 1, canRetryEnd: false });
    }
    throw new Error(`CME event history failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  if (!response.body) throw new Error("CME returned an empty event-history stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bars: Candle[] = [];
  let batch: MarketTrade[] = [];
  let malformed = 0;
  const flush = () => {
    if (!batch.length) return;
    bars = applyMarketTradesToEventBars(bars, batch, args.timeframe, args.symbol, MAX_EVENT_BARS);
    batch = [];
  };
  const consume = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      const decoded = JSON.parse(text) as unknown;
      const rows = Array.isArray(decoded) ? decoded : [decoded];
      rows.forEach((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return;
        const record = row as Record<string, unknown>;
        const trade = decodeTrade(record);
        if (trade) batch.push(trade);
      });
      if (batch.length >= EVENT_BAR_FLUSH_SIZE) flush();
    } catch {
      malformed += 1;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  consume(buffer);
  flush();
  if (malformed > 10 && !bars.length) throw new Error("CME returned malformed event-history records.");
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
  if (!vendorMarketDataConfigured("databento")) throw new Error("CME market data is not configured.");
  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "false",
    pretty_ts: "false",
    map_symbols: "false",
    symbols: args.symbol,
    stype_in: isContinuousFuture(args.symbol) ? "continuous" : "raw_symbol",
    schema: "trades",
    // CVD must cover the same requested history as the chart. Aggregate the
    // complete raw tape into its event-bar boundaries on the server instead
    // of returning hundreds of thousands of one-second flow buckets.
    start: new Date(args.start).toISOString(),
    end: new Date(args.end).toISOString(),
  });
  const response = await vendorMarketDataFetch("databento", "/v0/timeseries.get_range", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(280_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    const completedEnd = response.status === 422 && args.canRetryEnd !== false
      ? availableEnd(detail)
      : null;
    if (completedEnd && completedEnd > args.start && completedEnd < args.end) {
      return streamEventFlow({
        ...args,
        end: completedEnd - 1,
        canRetryEnd: false,
      });
    }
    throw new Error(`CME execution history failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  if (!response.body) return { candles: args.candles, executions: [] };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const executions: DatabentoEventExecutionTuple[] = [];
  const recentExecutionStart = args.end - EVENT_EXECUTION_LOOKBACK_MS;
  let buffer = "";
  const append = (row: Record<string, unknown>) => {
    const timestamp = eventTime(
      row.ts_event
      ?? row.ts_recv
      ?? (row.hd as Record<string, unknown> | undefined)?.ts_event,
    );
    const tradePrice = fixedPrice(row.price);
    const size = Math.max(0, Number(row.size ?? 0));
    const aggressor = databentoTradeAggressor(row.side ?? row.aggressor_side);
    // Databento's trade side is the aggressor: Bid is a buyer and Ask a seller.
    const askVolume = aggressor === "BUY" ? size : 0;
    const bidVolume = aggressor === "SELL" ? size : 0;
    const delta = askVolume - bidVolume;
    if (timestamp <= 0 || tradePrice <= 0 || size <= 0 || delta === 0 || !args.candles.length) return;

    // Big Trades and live seam repair only need the recent compact tape. CVD
    // has already received the full-history flow above.
    if (timestamp < recentExecutionStart) return;
    const bucketTimestamp = Math.floor(timestamp / EVENT_FLOW_BUCKET_MS) * EVENT_FLOW_BUCKET_MS;
    const previous = executions.at(-1);
    if (previous?.[0] === bucketTimestamp) {
      previous[1] = tradePrice;
      previous[2] += size;
      previous[3] += delta;
      previous[4] = Number(previous[4] ?? 0) + askVolume;
      previous[5] = Number(previous[5] ?? 0) + bidVolume;
      previous[6] = Number(previous[6] ?? 0) + 1;
      return;
    }
    executions.push([
      bucketTimestamp,
      tradePrice,
      size,
      delta,
      askVolume,
      bidVolume,
      1,
      "flow",
    ]);
    if (executions.length > MAX_EVENT_FLOW_BUCKETS) {
      executions.splice(0, executions.length - MAX_EVENT_FLOW_BUCKETS);
    }
  };
  const consume = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      const decoded = JSON.parse(text) as unknown;
      const rows = Array.isArray(decoded) ? decoded : [decoded];
      rows.forEach((row) => {
        if (row && typeof row === "object" && !Array.isArray(row)) {
          append(row as Record<string, unknown>);
        }
      });
    } catch {
      // One malformed line must not discard the valid tape around it.
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  consume(buffer);
  return {
    // Geometry and full-window order flow were already calculated from the
    // exact same native execution stream. Never overwrite a threshold bar
    // with a second-pass aggregate: one large execution can legitimately be
    // split across several volume bars at the same source timestamp.
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
  const flow = await streamEventFlow({
    symbol,
    candles,
    // Event candles already contain exact full-window volume/delta. This
    // second pass exists only to return the compact recent indicator tape;
    // do not download and parse the same five sessions twice.
    start: Math.max(requestedStart, executionEnd - EVENT_EXECUTION_LOOKBACK_MS),
    end: executionEnd,
  }).catch(() => ({ candles, executions: [] as DatabentoEventExecutionTuple[] }));
  return flow;
}
