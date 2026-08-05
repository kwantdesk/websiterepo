export type ZyonPriceBar = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ZyonSessionOhlc = {
  sessionDate: string;
  from: string;
  to: string;
  asOf: string;
  complete: boolean;
  bars: number;
  open: number;
  high: number;
  highAt: string;
  low: number;
  lowAt: string;
  close: number;
  current: number;
  change: number;
  range: number;
  volume: number;
};

export type ZyonTimeframeStructure = {
  timeframe: "1H" | "4H";
  asOf: string;
  bars: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  locationInRange: number | null;
  direction: "UP" | "DOWN" | "BALANCED";
  structure: "HIGHER_HIGH_HIGHER_LOW" | "LOWER_HIGH_LOWER_LOW" | "MIXED";
  recentBars: Array<{
    from: string;
    to: string;
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
};

export type ZyonFuturesPriceCandidate = {
  price: number | null;
  timestamp: number | null;
  source: "BROWSER_FUTURES_TICK" | "CME_HISTORY";
};

const NEW_YORK_TIME_ZONE = "America/New_York";
const zonedFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Pick the newest verified futures-domain price. A browser tick is accepted
 * only when it is a plausible continuation of the CME history reference.
 * This prevents a fresh QQQ/SPY options quote from outranking a slightly older
 * NQ/ES bar merely because both values arrived in the same market context.
 */
export function selectZyonFuturesPrice(args: {
  browserTick: ZyonFuturesPriceCandidate;
  history: ZyonFuturesPriceCandidate;
}) {
  const historyPrice = finite(args.history.price);
  return [args.browserTick, args.history]
    .filter((candidate): candidate is ZyonFuturesPriceCandidate & { price: number; timestamp: number } =>
      finite(candidate.price) !== null
      && finite(candidate.timestamp) !== null
      && Number(candidate.price) > 0
      && Number(candidate.timestamp) > 0)
    .filter((candidate) => candidate.source === "CME_HISTORY"
      || historyPrice === null
      || Math.abs(candidate.price / historyPrice - 1) <= 0.2)
    .sort((left, right) => right.timestamp - left.timestamp)[0] ?? null;
}

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validBars(bars: ZyonPriceBar[]) {
  const unique = new Map<number, ZyonPriceBar>();
  bars.forEach((bar) => {
    const timestamp = finite(bar.timestamp);
    const open = finite(bar.open);
    const high = finite(bar.high);
    const low = finite(bar.low);
    const close = finite(bar.close);
    if (
      timestamp === null
      || timestamp <= 0
      || open === null
      || high === null
      || low === null
      || close === null
      || open <= 0
      || high <= 0
      || low <= 0
      || close <= 0
      || high < low
    ) return;
    unique.set(timestamp, {
      timestamp,
      open,
      high,
      low,
      close,
      volume: Math.max(0, finite(bar.volume) ?? 0),
    });
  });
  return [...unique.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function addUtcDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function newYorkParts(timestamp: number) {
  const parts = Object.fromEntries(
    zonedFormatter.formatToParts(timestamp).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * CME equity-index futures use the trading date of the session that starts at
 * 18:00 New York on the preceding calendar day. Grouping bars by this key
 * keeps Sunday evening attached to Monday and survives DST without fixed UTC
 * offsets.
 */
export function cmeTradingDateKey(timestamp: number) {
  const parts = newYorkParts(timestamp);
  return parts.minute >= 18 * 60 ? addUtcDays(parts.date, 1) : parts.date;
}

function sessionIsComplete(latestTimestamp: number, latestTradingDate: string) {
  const parts = newYorkParts(latestTimestamp);
  return cmeTradingDateKey(latestTimestamp) === latestTradingDate
    && parts.minute >= 16 * 60 + 55
    && parts.minute < 18 * 60;
}

function summarizeSession(
  sessionDate: string,
  bars: ZyonPriceBar[],
  latestTradingDate: string,
): ZyonSessionOhlc | null {
  const sorted = validBars(bars);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return null;
  const highBar = sorted.reduce((best, bar) => bar.high > best.high ? bar : best, first);
  const lowBar = sorted.reduce((best, bar) => bar.low < best.low ? bar : best, first);
  return {
    sessionDate,
    from: new Date(first.timestamp).toISOString(),
    to: new Date(last.timestamp + 5 * 60_000).toISOString(),
    asOf: new Date(last.timestamp).toISOString(),
    complete: sessionDate !== latestTradingDate || sessionIsComplete(last.timestamp, sessionDate),
    bars: sorted.length,
    open: first.open,
    high: highBar.high,
    highAt: new Date(highBar.timestamp).toISOString(),
    low: lowBar.low,
    lowAt: new Date(lowBar.timestamp).toISOString(),
    close: last.close,
    current: last.close,
    change: last.close - first.open,
    range: highBar.high - lowBar.low,
    volume: sorted.reduce((sum, bar) => sum + Math.max(0, Number(bar.volume ?? 0)), 0),
  };
}

export function summarizeCmeSessions(bars: ZyonPriceBar[]) {
  const sorted = validBars(bars);
  const groups = new Map<string, ZyonPriceBar[]>();
  sorted.forEach((bar) => {
    const key = cmeTradingDateKey(bar.timestamp);
    groups.set(key, [...(groups.get(key) ?? []), bar]);
  });
  const keys = [...groups.keys()].sort();
  const currentKey = keys.at(-1) ?? "";
  const previousKey = keys.at(-2) ?? "";
  return {
    convention: "CME_EQUITY_INDEX_1800_TO_1700_NEW_YORK" as const,
    current: currentKey
      ? summarizeSession(currentKey, groups.get(currentKey) ?? [], currentKey)
      : null,
    previous: previousKey
      ? summarizeSession(previousKey, groups.get(previousKey) ?? [], currentKey)
      : null,
  };
}

function aggregateBars(bars: ZyonPriceBar[], intervalMs: number) {
  const buckets = new Map<number, ZyonPriceBar>();
  validBars(bars).forEach((bar) => {
    const timestamp = Math.floor(bar.timestamp / intervalMs) * intervalMs;
    const existing = buckets.get(timestamp);
    if (!existing) {
      buckets.set(timestamp, { ...bar, timestamp });
      return;
    }
    existing.high = Math.max(existing.high, bar.high);
    existing.low = Math.min(existing.low, bar.low);
    existing.close = bar.close;
    existing.volume = Number(existing.volume ?? 0) + Number(bar.volume ?? 0);
  });
  return [...buckets.values()].sort((left, right) => left.timestamp - right.timestamp);
}

function structureState(recent: ZyonPriceBar[]) {
  const last = recent.at(-1);
  const previous = recent.at(-2);
  if (!last || !previous) return "MIXED" as const;
  if (last.high > previous.high && last.low > previous.low) return "HIGHER_HIGH_HIGHER_LOW" as const;
  if (last.high < previous.high && last.low < previous.low) return "LOWER_HIGH_LOWER_LOW" as const;
  return "MIXED" as const;
}

export function summarizeTimeframeStructure(
  bars: ZyonPriceBar[],
  timeframe: "1H" | "4H",
): ZyonTimeframeStructure | null {
  const intervalMs = timeframe === "1H" ? 60 * 60_000 : 4 * 60 * 60_000;
  const aggregated = aggregateBars(bars, intervalMs);
  const contextBars = aggregated.slice(timeframe === "1H" ? -12 : -8);
  const first = contextBars[0];
  const last = contextBars.at(-1);
  if (!first || !last) return null;
  const high = Math.max(...contextBars.map((bar) => bar.high));
  const low = Math.min(...contextBars.map((bar) => bar.low));
  const range = high - low;
  const change = last.close - first.open;
  const averageRange = contextBars.reduce((sum, bar) => sum + bar.high - bar.low, 0) / contextBars.length;
  const threshold = Math.max(range * 0.12, averageRange * 0.75);
  return {
    timeframe,
    asOf: new Date(last.timestamp).toISOString(),
    bars: contextBars.length,
    open: first.open,
    high,
    low,
    close: last.close,
    change,
    changePercent: first.open ? change / first.open * 100 : 0,
    locationInRange: range > 0 ? (last.close - low) / range : null,
    direction: change > threshold ? "UP" : change < -threshold ? "DOWN" : "BALANCED",
    structure: structureState(contextBars),
    recentBars: contextBars.slice(-6).map((bar) => ({
      from: new Date(bar.timestamp).toISOString(),
      to: new Date(bar.timestamp + intervalMs).toISOString(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    })),
  };
}

export function buildZyonPriceAnalytics(bars: ZyonPriceBar[]) {
  const sorted = validBars(bars);
  return {
    sessions: summarizeCmeSessions(sorted),
    structure: {
      oneHour: summarizeTimeframeStructure(sorted, "1H"),
      fourHour: summarizeTimeframeStructure(sorted, "4H"),
    },
  };
}
