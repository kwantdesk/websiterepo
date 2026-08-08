import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";
import { applyMarketTradesToEventBars, type MarketTrade } from "@/lib/eventBars";
import type { Candle } from "@/lib/backtester";
import {
  addValueAreaTrade,
  createValueAreaAccumulator,
  finalizeValueAreaProfile,
  type ValueAreaProfile,
} from "@/lib/valueArea";
import {
  databentoEventTimestampMs,
  databentoTradeAggressor,
} from "@/lib/tradeAggressor";

export const DATABENTO_HISTORICAL_BASE_URL = "https://api.databento.com/v0";

export type DatabentoInstrument = {
  symbol: string;
  label: string;
  venue: "CME" | "CBOT" | "NYMEX" | "COMEX";
  kind: "future" | "option";
  group: string;
  parent?: string;
};

export type DatabentoBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// Compact tuple sent to the browser for execution-tape indicators:
// timestamp, price, size, signed aggressor delta.
export type DatabentoExecutionTuple = [
  timestamp: number,
  price: number,
  size: number,
  delta: number,
];

export type DatabentoOrderFlowHistory = {
  candles: Candle[];
  executions: DatabentoExecutionTuple[];
};

export const DATABENTO_FUTURES: DatabentoInstrument[] = [
  { symbol: "ES.v.0", label: "E-mini S&P 500", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "NQ.v.0", label: "E-mini Nasdaq-100", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "YM.v.0", label: "E-mini Dow", venue: "CBOT", kind: "future", group: "Equity index" },
  { symbol: "RTY.v.0", label: "E-mini Russell 2000", venue: "CME", kind: "future", group: "Equity index" },
  { symbol: "MES.v.0", label: "Micro E-mini S&P 500", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "MNQ.v.0", label: "Micro E-mini Nasdaq-100", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "M2K.v.0", label: "Micro E-mini Russell 2000", venue: "CME", kind: "future", group: "Micro index" },
  { symbol: "MYM.v.0", label: "Micro E-mini Dow", venue: "CBOT", kind: "future", group: "Micro index" },
  { symbol: "CL.v.0", label: "WTI Crude Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "NG.v.0", label: "Henry Hub Natural Gas", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "RB.v.0", label: "RBOB Gasoline", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "HO.v.0", label: "ULSD Heating Oil", venue: "NYMEX", kind: "future", group: "Energy" },
  { symbol: "GC.v.0", label: "Gold", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "SI.v.0", label: "Silver", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "HG.v.0", label: "Copper", venue: "COMEX", kind: "future", group: "Metals" },
  { symbol: "PL.v.0", label: "Platinum", venue: "NYMEX", kind: "future", group: "Metals" },
  { symbol: "ZN.v.0", label: "10-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZB.v.0", label: "30-Year Treasury Bond", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZF.v.0", label: "5-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "ZT.v.0", label: "2-Year Treasury Note", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "10Y.v.0", label: "10-Year Treasury Yield", venue: "CBOT", kind: "future", group: "Rates" },
  { symbol: "SR3.v.0", label: "3-Month SOFR", venue: "CME", kind: "future", group: "Rates" },
  { symbol: "6E.v.0", label: "Euro FX", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6J.v.0", label: "Japanese Yen", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6B.v.0", label: "British Pound", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6A.v.0", label: "Australian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "6C.v.0", label: "Canadian Dollar", venue: "CME", kind: "future", group: "FX" },
  { symbol: "ZC.v.0", label: "Corn", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZS.v.0", label: "Soybeans", venue: "CBOT", kind: "future", group: "Agriculture" },
  { symbol: "ZW.v.0", label: "Wheat", venue: "CBOT", kind: "future", group: "Agriculture" },
];

export const DATABENTO_DEFAULT_SYMBOLS = [
  "ES.v.0",
  "NQ.v.0",
  "MES.v.0",
  "MNQ.v.0",
  "YM.v.0",
  "RTY.v.0",
  "CL.v.0",
  "GC.v.0",
  "ZN.v.0",
  "10Y.v.0",
  "6E.v.0",
];

const OPTION_ROOTS: Array<{ root: string; label: string; venue: DatabentoInstrument["venue"] }> = [
  { root: "ES", label: "E-mini S&P 500", venue: "CME" },
  { root: "NQ", label: "E-mini Nasdaq-100", venue: "CME" },
  { root: "CL", label: "WTI Crude Oil", venue: "NYMEX" },
  { root: "GC", label: "Gold", venue: "COMEX" },
  { root: "ZN", label: "10-Year Treasury Note", venue: "CBOT" },
];

function parseRows(payload: string): Record<string, unknown>[] {
  return payload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        if (Array.isArray(value)) return value;
        return value && typeof value === "object" ? [value] : [];
      } catch {
        return [];
      }
    });
}

function price(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

function time(value: unknown) {
  return databentoEventTimestampMs(value) ?? 0;
}

function availableEndFromError(detail: string) {
  try {
    const payload = JSON.parse(detail) as {
      detail?: {
        case?: string;
        payload?: { available_end?: unknown };
      };
    };
    if (payload.detail?.case !== "data_end_after_available_end") return null;
    const value = String(payload.detail.payload?.available_end ?? "");
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  } catch {
    return null;
  }
}

async function historicalRequest(params: Record<string, string>, canRetryAvailableEnd = true) {
  const key = process.env.DATABENTO_API_KEY?.trim();
  if (!key) throw new Error("Databento is not configured.");

  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    ...params,
  });
  const response = await fetch(`${DATABENTO_HISTORICAL_BASE_URL}/timeseries.get_range`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    const availableEnd = response.status === 422 && canRetryAvailableEnd
      ? availableEndFromError(detail)
      : null;
    const requestedStart = Date.parse(params.start ?? "");
    const requestedEnd = Date.parse(params.end ?? "");
    if (
      availableEnd
      && Number.isFinite(requestedStart)
      && availableEnd > requestedStart
      && (!Number.isFinite(requestedEnd) || availableEnd < requestedEnd)
    ) {
      return historicalRequest(
        {
          ...params,
          end: new Date(availableEnd - 1).toISOString(),
        },
        false,
      );
    }
    throw new Error(`Databento request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return parseRows(await response.text());
}

/**
 * Stream the raw `trades` schema for an arbitrary window. Exposed so the
 * execution-accurate volume profile can aggregate every real print at every
 * real price, rather than reconstructing a profile from OHLCV bars.
 */
export async function streamHistoricalTradeRows(
  params: Record<string, string>,
  onRow: (row: Record<string, unknown>) => void,
): Promise<void> {
  return streamHistoricalRows({ schema: "trades", ...params }, onRow);
}

async function streamHistoricalRows(
  params: Record<string, string>,
  onRow: (row: Record<string, unknown>) => void,
): Promise<void> {
  const key = process.env.DATABENTO_API_KEY?.trim();
  if (!key) throw new Error("Databento is not configured.");

  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "true",
    pretty_ts: "true",
    map_symbols: "true",
    ...params,
  });
  const response = await fetch(`${DATABENTO_HISTORICAL_BASE_URL}/timeseries.get_range`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    const availableEnd = response.status === 422
      ? availableEndFromError(detail)
      : null;
    const requestedStart = Date.parse(params.start ?? "");
    const requestedEnd = Date.parse(params.end ?? "");
    if (
      availableEnd
      && Number.isFinite(requestedStart)
      && availableEnd > requestedStart
      && (!Number.isFinite(requestedEnd) || availableEnd < requestedEnd)
    ) {
      // Carry the available edge as data, not prose. Rewriting it into a
      // sentence made it unrecoverable: callers that could simply retry
      // against the edge had nothing to parse, so a live-session profile
      // failed permanently instead of returning the data that does exist.
      const incomplete = new Error(
        "Databento has not completed the requested CME profile window yet.",
      ) as Error & { availableEndMs?: number };
      incomplete.availableEndMs = availableEnd;
      throw incomplete;
    }
    throw new Error(`Databento request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  if (!response.body) throw new Error("Databento returned an empty CME trade stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let malformedRecords = 0;
  const processLine = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      const decoded = JSON.parse(text) as unknown;
      const records = Array.isArray(decoded) ? decoded : [decoded];
      records.forEach((record) => {
        if (record && typeof record === "object" && !Array.isArray(record)) {
          onRow(record as Record<string, unknown>);
        }
      });
    } catch {
      malformedRecords += 1;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      processLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  buffer += decoder.decode();
  processLine(buffer);
  if (malformedRecords > 0) {
    throw new Error("Databento returned malformed CME trade records; the profile was rejected.");
  }
}

export async function getDatabentoValueAreaProfile(
  symbol: string,
  start: string,
  end: string,
  tickSize: number,
): Promise<ValueAreaProfile | null> {
  return (await getDatabentoValueAreaProfiles(
    symbol,
    [{ start, end }],
    tickSize,
  ))[0] ?? null;
}

/**
 * Build several exact trade-by-trade profiles from one Databento stream.
 *
 * This matters at the Sunday/Monday reopen: the prior daily session (Friday)
 * sits completely inside the prior weekly window. Downloading both windows
 * separately duplicated Friday's full tick tape and made a cold chart wait.
 */
export async function getDatabentoValueAreaProfiles(
  symbol: string,
  windows: Array<{ start: string; end: string }>,
  tickSize: number,
): Promise<Array<ValueAreaProfile | null>> {
  const parsedWindows = windows.map((window) => ({
    start: Date.parse(window.start),
    end: Date.parse(window.end),
  }));
  if (
    parsedWindows.length === 0
    || parsedWindows.some((window) =>
      !Number.isFinite(window.start)
      || !Number.isFinite(window.end)
      || window.end <= window.start)
  ) {
    throw new Error("A valid CME value-area window is required.");
  }

  const accumulators = parsedWindows.map(() => createValueAreaAccumulator(tickSize));
  const requestStart = Math.min(...parsedWindows.map((window) => window.start));
  const requestEnd = Math.max(...parsedWindows.map((window) => window.end));
  await streamHistoricalRows({
    symbols: symbol,
    stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
    schema: "trades",
    start: new Date(requestStart).toISOString(),
    end: new Date(requestEnd).toISOString(),
    // Price and timestamp formatting plus symbol mapping add substantial JSON
    // weight to a weekly tick stream. Raw numeric fields retain the exact same
    // CME trades while transferring and parsing much faster.
    pretty_px: "false",
    pretty_ts: "false",
    map_symbols: "false",
  }, (row) => {
    const timestamp = time(
      row.ts_event
      ?? row.ts_recv
      ?? (row.hd as Record<string, unknown> | undefined)?.ts_event,
    );
    const trade = {
      timestamp,
      price: price(row.price),
      size: Math.max(0, Number(row.size ?? 0)),
    };
    parsedWindows.forEach((window, index) => {
      if (timestamp >= window.start && timestamp < window.end) {
        addValueAreaTrade(accumulators[index], trade);
      }
    });
  });
  return accumulators.map((accumulator) => finalizeValueAreaProfile(accumulator));
}

function sourceSchema(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (match?.[2] === "s") return "ohlcv-1s";
  if (match?.[2] === "h") return "ohlcv-1h";
  if (match && ["D", "W", "M"].includes(match[2])) return "ohlcv-1d";
  return "ohlcv-1m";
}

function timeframeMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return 5 * 60_000;
  const value = Math.max(1, Number(match[1]));
  const units: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 86_400_000,
    W: 7 * 86_400_000,
    M: 30 * 86_400_000,
  };
  return value * (units[match[2]] ?? 5 * 60_000);
}

function resample(rows: DatabentoBar[], timeframe: string) {
  const size = timeframeMs(timeframe);
  const schema = sourceSchema(timeframe);
  const sourceSize = schema === "ohlcv-1s"
    ? 1_000
    : schema === "ohlcv-1m"
      ? 60_000
      : schema === "ohlcv-1h"
        ? 60 * 60_000
        : 86_400_000;
  if (size < sourceSize) return rows;
  const buckets = new Map<number, DatabentoBar>();
  for (const row of rows) {
    const timestamp = Math.floor(row.timestamp / size) * size;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...row, timestamp });
      continue;
    }
    existing.high = Math.max(existing.high, row.high);
    existing.low = Math.min(existing.low, row.low);
    existing.close = row.close;
    existing.volume += row.volume;
  }
  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function isContinuousFuture(symbol: string) {
  return /\.[vnc]\.\d+$/.test(symbol);
}

export async function getDatabentoBars(symbol: string, timeframe: string, start: string, end: string): Promise<DatabentoBar[]> {
  if (!getChartInterval(timeframe)) throw new Error(`Unsupported chart interval: ${timeframe}`);
  if (isEventBasedChartInterval(timeframe)) {
    const requestedStart = Date.parse(start);
    const requestedEnd = Date.parse(end);
    const recentStart = new Date(Math.max(
      Number.isFinite(requestedStart) ? requestedStart : 0,
      (Number.isFinite(requestedEnd) ? requestedEnd : Date.now()) - 6 * 60 * 60_000,
    )).toISOString();
    let tradeRows = await historicalRequest({
      symbols: symbol,
      stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
      schema: "trades",
      start: recentStart,
      end,
      limit: "200000",
    });
    if (tradeRows.length === 0 && recentStart !== start) {
      tradeRows = await historicalRequest({
        symbols: symbol,
        stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
        schema: "trades",
        start,
        end,
        limit: "200000",
      });
    }
    const trades: MarketTrade[] = tradeRows
      .map((row) => {
        const size = Math.max(0, Number(row.size ?? 0));
        const aggressor = databentoTradeAggressor(row.side ?? row.aggressor_side);
        return {
          timestamp: time(row.ts_event ?? row.ts_recv ?? (row.hd as Record<string, unknown> | undefined)?.ts_event),
          price: price(row.price),
          size,
          trades: 1,
          delta: aggressor === "BUY" ? size : aggressor === "SELL" ? -size : 0,
        };
      })
      .filter((row) => row.timestamp > 0 && row.price > 0)
      .sort((a, b) => a.timestamp - b.timestamp);
    return applyMarketTradesToEventBars([], trades, timeframe, symbol, 3_000).map((bar) => ({
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? 0,
    }));
  }

  const rows = await historicalRequest({
    symbols: symbol,
    stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
    schema: sourceSchema(timeframe),
    start,
    end,
  });
  const bars = rows
    .map((row) => ({
      timestamp: time(row.ts_event ?? row.ts_recv ?? (row.hd as Record<string, unknown> | undefined)?.ts_event),
      open: price(row.open),
      high: price(row.high),
      low: price(row.low),
      close: price(row.close),
      volume: Number(row.volume ?? 0),
    }))
    .filter((row) => row.timestamp > 0 && row.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  return resample(bars, timeframe);
}

export async function getDatabentoOrderFlowHistory(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
): Promise<DatabentoOrderFlowHistory> {
  const bars = await getDatabentoBars(symbol, timeframe, start, end);
  if (!bars.length || isEventBasedChartInterval(timeframe)) {
    return { candles: bars, executions: [] };
  }

  // Raw CME executions are deliberately bounded to the latest six hours.
  // This is enough to hydrate order-flow studies immediately without making
  // each chart load download an unbounded multi-day trade tape.
  const requestedStart = Date.parse(start);
  const requestedEnd = Date.parse(end);
  const safeEnd = Number.isFinite(requestedEnd) ? requestedEnd : Date.now();
  // During Globex pauses and weekends, wall-clock "last six hours" contains
  // no executions even though the chart correctly ends at Friday's close.
  // Anchor flow history to the newest returned CME bar so the last completed
  // session still hydrates CVD, Big Trades and KWANT Effort.
  const size = timeframeMs(timeframe);
  const latestBarEnd = (bars.at(-1)?.timestamp ?? safeEnd) + size;
  const flowEndMs = Math.min(safeEnd, latestBarEnd);
  const flowStart = new Date(Math.max(
    Number.isFinite(requestedStart) ? requestedStart : 0,
    flowEndMs - 6 * 60 * 60_000,
  )).toISOString();
  const tradeRows = await historicalRequest({
    symbols: symbol,
    stype_in: isContinuousFuture(symbol) ? "continuous" : "raw_symbol",
    schema: "trades",
    start: flowStart,
    end: new Date(flowEndMs).toISOString(),
    // No record limit: Databento documents an omitted limit as unbounded.
    // A hard 200k cap silently cut off busy NQ/ES windows and produced a
    // partial CVD that looked like it began mid-session.
  });
  const flowByBucket = new Map<number, {
    volume: number;
    trades: number;
    askVolume: number;
    bidVolume: number;
    delta: number;
    deltaHigh: number;
    deltaLow: number;
  }>();

  const executions = tradeRows
    .map((row) => {
      const timestamp = time(row.ts_event ?? row.ts_recv ?? (row.hd as Record<string, unknown> | undefined)?.ts_event);
      const tradePrice = price(row.price);
      const tradeSize = Math.max(0, Number(row.size ?? 0));
      const aggressor = databentoTradeAggressor(row.side ?? row.aggressor_side);
      const delta = aggressor === "BUY"
        ? tradeSize
        : aggressor === "SELL" ? -tradeSize : 0;
      return { timestamp, price: tradePrice, tradeSize, delta };
    })
    .filter((row) => row.timestamp > 0 && row.price > 0 && row.tradeSize > 0 && row.delta !== 0)
    .sort((left, right) => left.timestamp - right.timestamp);

  executions.forEach((trade) => {
      const bucket = Math.floor(trade.timestamp / size) * size;
      const current = flowByBucket.get(bucket) ?? {
        volume: 0,
        trades: 0,
        askVolume: 0,
        bidVolume: 0,
        delta: 0,
        deltaHigh: 0,
        deltaLow: 0,
      };
      current.volume += trade.tradeSize;
      current.trades += 1;
      if (trade.delta > 0) current.askVolume += trade.tradeSize;
      if (trade.delta < 0) current.bidVolume += trade.tradeSize;
      current.delta += trade.delta;
      current.deltaHigh = Math.max(current.deltaHigh, current.delta);
      current.deltaLow = Math.min(current.deltaLow, current.delta);
      flowByBucket.set(bucket, current);
    });

  const candles = bars.map((bar) => {
    const flow = flowByBucket.get(Math.floor(bar.timestamp / size) * size);
    if (!flow) return bar;
    return {
      ...bar,
      volume: Math.max(Number(bar.volume ?? 0), flow.volume),
      trades: flow.trades,
      askVolume: flow.askVolume,
      bidVolume: flow.bidVolume,
      delta: flow.delta,
      deltaOpen: 0,
      deltaHigh: flow.deltaHigh,
      deltaLow: flow.deltaLow,
      deltaClose: flow.delta,
    };
  });

  // Raw GLBX trades are extremely dense. Keeping only the latest prints made
  // Big Trades appear to begin at the moment the indicator was enabled. Keep
  // the strongest executions from every minute instead: the full tape still
  // builds exact CVD/effort candles above, while this compact, time-distributed
  // sample preserves historical large prints without shipping millions of
  // ordinary executions to the browser.
  const strongestByMinute = new Map<number, typeof executions>();
  executions.forEach((trade) => {
    const minute = Math.floor(trade.timestamp / 60_000) * 60_000;
    const bucket = strongestByMinute.get(minute) ?? [];
    bucket.push(trade);
    bucket.sort((left, right) => right.tradeSize - left.tradeSize || left.timestamp - right.timestamp);
    if (bucket.length > 12) bucket.length = 12;
    strongestByMinute.set(minute, bucket);
  });
  const compactExecutions = [...strongestByMinute.values()]
    .flat()
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-50_000)
    .map((trade): DatabentoExecutionTuple => [
      trade.timestamp,
      trade.price,
      trade.tradeSize,
      trade.delta,
    ]);

  return { candles, executions: compactExecutions };
}

export async function getDatabentoBarsWithOrderFlow(
  symbol: string,
  timeframe: string,
  start: string,
  end: string,
) {
  return (await getDatabentoOrderFlowHistory(symbol, timeframe, start, end)).candles;
}

function optionClass(value: unknown) {
  const normalized = String(value ?? "").toUpperCase();
  if (normalized === "C" || normalized === "CALL" || normalized === "3") return "Call";
  if (normalized === "P" || normalized === "PUT" || normalized === "4") return "Put";
  return null;
}

export async function getDatabentoOptions() {
  const now = Date.now();
  const instruments: DatabentoInstrument[] = [];

  for (const optionRoot of OPTION_ROOTS) {
    const underlying = `${optionRoot.root}.v.0`;
    const recentBars = await getDatabentoBars(
      underlying,
      "1m",
      new Date(now - 6 * 60 * 60_000).toISOString(),
      new Date(now).toISOString(),
    );
    const underlyingPrice = recentBars.at(-1)?.close ?? 0;
    const definitions = await historicalRequest({
      symbols: `${optionRoot.root}.OPT`,
      stype_in: "parent",
      schema: "definition",
      start: new Date(now).toISOString().slice(0, 10),
      limit: "50000",
    });

    const candidates = definitions
      .map((row) => {
        const symbol = String(row.raw_symbol ?? row.symbol ?? "").trim();
        const side = optionClass(row.instrument_class);
        const strike = price(row.strike_price);
        const expiration = time(row.expiration);
        return { symbol, side, strike, expiration };
      })
      .filter((row) => row.symbol && row.side && row.strike > 0 && row.expiration > now && row.expiration < now + 75 * 86_400_000)
      .sort((a, b) => a.expiration - b.expiration || Math.abs(a.strike - underlyingPrice) - Math.abs(b.strike - underlyingPrice));

    const nearestExpiry = candidates[0]?.expiration;
    if (!nearestExpiry) continue;
    for (const side of ["Call", "Put"] as const) {
      candidates
        .filter((row) => row.expiration === nearestExpiry && row.side === side)
        .slice(0, 6)
        .forEach((row) => {
          instruments.push({
            symbol: row.symbol,
            label: `${optionRoot.label} ${side} ${row.strike.toLocaleString("en-US")}`,
            venue: optionRoot.venue,
            kind: "option",
            group: `Options · ${new Date(row.expiration).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" })}`,
            parent: `${optionRoot.root}.OPT`,
          });
        });
    }
  }
  return instruments;
}
