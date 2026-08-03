import "server-only";

import { getChartInterval, isEventBasedChartInterval } from "@/lib/chartIntervals";
import {
  applyMarketTradesToEventBars,
  type MarketTrade,
} from "@/lib/eventBars";
import type { Candle } from "@/lib/backtester";

const DATABENTO_HISTORICAL_BASE_URL = "https://api.databento.com/v0";
const MAX_EVENT_BARS = 5_000;

function fixedPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

function eventTime(value: unknown) {
  const text = String(value ?? "").trim();
  const numeric = typeof value === "number" || /^\d+$/.test(text) ? Number(value) : Number.NaN;
  if (Number.isFinite(numeric)) {
    if (numeric > 10_000_000_000_000_000) return Math.floor(numeric / 1_000_000);
    if (numeric > 10_000_000_000_000) return Math.floor(numeric / 1_000);
    return numeric;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
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

function adaptiveEventStart(timeframe: string, requestedStart: number, end: number) {
  const interval = getChartInterval(timeframe);
  if (!interval || !isEventBasedChartInterval(timeframe)) return requestedStart;
  const hour = 60 * 60_000;
  const day = 24 * hour;
  let lookback = 18 * hour;
  if (interval.kind === "volume") lookback = Math.max(18 * hour, Math.min(10 * day, interval.value / 200 * 18 * hour));
  else if (interval.kind === "trade") lookback = Math.max(18 * hour, Math.min(10 * day, interval.value / 50 * 18 * hour));
  else if (["range", "renko", "volume-bars"].includes(interval.kind)) {
    lookback = Math.max(18 * hour, Math.min(10 * day, interval.value / 4 * 18 * hour));
  } else if (interval.kind === "delta") lookback = Math.min(10 * day, 3 * day);
  else lookback = 10 * day;
  return Math.max(requestedStart, end - lookback);
}

function decodeTrade(row: Record<string, unknown>): MarketTrade | null {
  const size = Math.max(0, Number(row.size ?? 0));
  const side = String(row.side ?? "").toUpperCase();
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
    delta: side === "A" || side === "ASK" ? size : side === "B" || side === "BID" ? -size : 0,
  };
}

async function streamEventBars(args: {
  symbol: string;
  timeframe: string;
  start: number;
  end: number;
  canRetryEnd?: boolean;
}): Promise<Candle[]> {
  const key = process.env.DATABENTO_API_KEY?.trim();
  if (!key) throw new Error("CME market data is not configured.");
  const form = new URLSearchParams({
    dataset: "GLBX.MDP3",
    encoding: "json",
    pretty_px: "false",
    pretty_ts: "false",
    map_symbols: "false",
    symbols: args.symbol,
    stype_in: isContinuousFuture(args.symbol) ? "continuous" : "raw_symbol",
    schema: "trades",
    start: new Date(args.start).toISOString(),
    end: new Date(args.end).toISOString(),
  });
  const response = await fetch(`${DATABENTO_HISTORICAL_BASE_URL}/timeseries.get_range`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
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
        const trade = decodeTrade(row as Record<string, unknown>);
        if (trade) batch.push(trade);
      });
      if (batch.length >= 2_048) flush();
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
  return streamEventBars({
    symbol,
    timeframe,
    start: adaptiveEventStart(timeframe, requestedStart, requestedEnd),
    end: requestedEnd,
  });
}
