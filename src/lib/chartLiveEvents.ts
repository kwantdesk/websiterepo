import type { Candle } from "@/lib/backtester";

export const LIVE_CHART_CANDLE_EVENT = "kwantdesk:live-chart-candle";
export const DATABENTO_LIVE_TICK_EVENT = "kwantdesk:databento-tick";
export const DATABENTO_LIVE_STATUS_EVENT = "kwantdesk:databento-status";

export type LiveChartCandleDetail = {
  key: string;
  candle: Candle;
};

export type DatabentoLiveStatus = "connecting" | "live" | "reconnecting";

export type DatabentoLiveTick = {
  instrument: string;
  mid: number;
  timestamp?: string | number;
  isTrade?: boolean;
  size?: number;
  trades?: number;
  delta?: number;
  cached?: boolean;
};

type DatabentoLiveStatusSnapshot = {
  status: DatabentoLiveStatus;
  updatedAt: number;
};

let latestDatabentoLiveStatus: DatabentoLiveStatusSnapshot | null = null;
const LIVE_TAIL_MAX_AGE_MS = 15 * 60_000;
const liveSecondsBySymbol = new Map<string, Map<number, Candle>>();

function tickTimestamp(value: unknown) {
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return tickTimestamp(Number(value));
  }
  if (typeof value === "number") {
    if (value > 10_000_000_000_000_000) return Math.floor(value / 1_000_000);
    if (value > 10_000_000_000_000) return Math.floor(value / 1_000);
    if (value < 10_000_000_000) return Math.floor(value * 1_000);
    return Math.floor(value);
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/**
 * Keeps a compact one-second OHLC tail from the shared CME stream. New chart
 * panes can replay the bars already observed by this browser instead of
 * jumping from the historical endpoint straight to the first post-mount tick.
 */
export function recordDatabentoLiveTick(tick: DatabentoLiveTick) {
  const symbol = String(tick.instrument ?? "").trim();
  const price = Number(tick.mid);
  const timestamp = tickTimestamp(tick.timestamp);
  const now = Date.now();
  if (
    !symbol
    || !Number.isFinite(price)
    || price <= 0
    || !Number.isFinite(timestamp)
    || timestamp < now - LIVE_TAIL_MAX_AGE_MS
    || timestamp > now + 60_000
  ) return;

  const second = Math.floor(timestamp / 1_000) * 1_000;
  const executedSize = tick.isTrade ? Math.max(0, Number(tick.size ?? 0)) : 0;
  const executedTrades = tick.isTrade ? Math.max(1, Number(tick.trades ?? 1)) : 0;
  const executedDelta = tick.isTrade ? Number(tick.delta ?? 0) : 0;
  const seconds = liveSecondsBySymbol.get(symbol) ?? new Map<number, Candle>();
  const existing = seconds.get(second);
  if (existing) {
    seconds.set(second, {
      ...existing,
      high: Math.max(existing.high, price),
      low: Math.min(existing.low, price),
      close: price,
      volume: Math.max(0, Number(existing.volume ?? 0)) + executedSize,
      trades: Math.max(0, Number(existing.trades ?? 0)) + executedTrades,
      delta: Number(existing.delta ?? 0) + executedDelta,
      deltaClose: Number(existing.deltaClose ?? existing.delta ?? 0) + executedDelta,
      askVolume: Math.max(0, Number(existing.askVolume ?? 0)) + (executedDelta > 0 ? executedSize : 0),
      bidVolume: Math.max(0, Number(existing.bidVolume ?? 0)) + (executedDelta < 0 ? executedSize : 0),
    });
  } else {
    seconds.set(second, {
      timestamp: second,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: executedSize,
      trades: executedTrades,
      delta: executedDelta,
      deltaClose: executedDelta,
      askVolume: executedDelta > 0 ? executedSize : 0,
      bidVolume: executedDelta < 0 ? executedSize : 0,
    });
  }

  const cutoff = now - LIVE_TAIL_MAX_AGE_MS;
  for (const key of seconds.keys()) {
    if (key < cutoff) seconds.delete(key);
  }
  liveSecondsBySymbol.set(symbol, seconds);
}

export function readDatabentoLiveTail(symbol: string) {
  const seconds = liveSecondsBySymbol.get(symbol);
  if (!seconds) return [];
  const cutoff = Date.now() - LIVE_TAIL_MAX_AGE_MS;
  for (const key of seconds.keys()) {
    if (key < cutoff) seconds.delete(key);
  }
  return [...seconds.values()].sort((left, right) => left.timestamp - right.timestamp);
}

export function publishDatabentoLiveStatus(status: DatabentoLiveStatus) {
  latestDatabentoLiveStatus = {
    status,
    updatedAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATABENTO_LIVE_STATUS_EVENT, {
      detail: status,
    }));
  }
}

export function readDatabentoLiveStatus(maxAgeMs = 30_000) {
  if (
    !latestDatabentoLiveStatus
    || Date.now() - latestDatabentoLiveStatus.updatedAt > maxAgeMs
  ) {
    return null;
  }
  return latestDatabentoLiveStatus.status;
}
