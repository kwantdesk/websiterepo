import type { OptionsCandle } from "@/lib/optionsFlow";

type JsonRecord = Record<string, unknown>;

const NEW_YORK_CASH_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export type ParsedCashLevelOne = {
  symbol: string;
  lastPrice: number;
  bid: number | null;
  ask: number | null;
  asOfMs: number;
  delayed: boolean;
  marketOpen: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

export function normalizeMarketTimestamp(value: unknown): number | null {
  const number = finiteNumber(value);
  if (number === null) return null;
  if (number >= 1e18) return Math.floor(number / 1e6);
  if (number >= 1e15) return Math.floor(number / 1e3);
  if (number >= 1e12) return Math.floor(number);
  if (number >= 1e9) return Math.floor(number * 1e3);
  return null;
}

function firstRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return value.find(isRecord) ?? null;
  return isRecord(value) ? value : null;
}

export function isUsRegularCashSessionTimestamp(timestamp: number) {
  if (!Number.isFinite(timestamp)) return false;
  const normalizedTimestamp = timestamp < 1e12 ? timestamp * 1_000 : timestamp;
  const parts = NEW_YORK_CASH_CLOCK.formatToParts(new Date(normalizedTimestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;
  const hour = Number(read("hour"));
  const minute = Number(read("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const sessionMinute = hour * 60 + minute;
  return sessionMinute >= 9 * 60 + 30 && sessionMinute <= 16 * 60;
}

export function filterUsRegularCashSessionCandles(candles: OptionsCandle[]) {
  return candles.filter((candle) => isUsRegularCashSessionTimestamp(candle.timestamp));
}

function parseIndexSnapshot(symbol: string, payload: JsonRecord): ParsedCashLevelOne | null {
  const result = firstRecord(payload.results);
  if (!result) return null;
  const lastPrice = finiteNumber(result.value ?? result.last_value ?? result.price);
  const asOfMs = normalizeMarketTimestamp(result.last_updated ?? result.timestamp);
  if (lastPrice === null || lastPrice <= 0 || asOfMs === null) return null;
  const timeframe = String(result.timeframe ?? "").toUpperCase();
  const marketStatus = String(
    (isRecord(payload.market_status) ? payload.market_status.market : null)
    ?? result.market_status
    ?? "",
  ).toUpperCase();
  return {
    symbol,
    lastPrice,
    bid: null,
    ask: null,
    asOfMs,
    delayed: timeframe !== "REAL-TIME" && timeframe !== "REALTIME",
    marketOpen: marketStatus !== "CLOSED",
  };
}

function parseStockSnapshot(symbol: string, payload: JsonRecord): ParsedCashLevelOne | null {
  const ticker = firstRecord(payload.ticker ?? payload.results);
  if (!ticker) return null;
  const trade = firstRecord(ticker.lastTrade ?? ticker.last_trade);
  const quote = firstRecord(ticker.lastQuote ?? ticker.last_quote);
  const minute = firstRecord(ticker.min ?? ticker.minute);
  const lastPrice = finiteNumber(trade?.p ?? trade?.price ?? minute?.c ?? minute?.close);
  const asOfMs = normalizeMarketTimestamp(
    trade?.t ?? trade?.timestamp ?? quote?.t ?? quote?.timestamp ?? minute?.t ?? minute?.timestamp,
  );
  if (lastPrice === null || lastPrice <= 0 || asOfMs === null) return null;
  return {
    symbol,
    lastPrice,
    bid: finiteNumber(quote?.p ?? quote?.bid ?? quote?.bid_price),
    ask: finiteNumber(quote?.P ?? quote?.ask ?? quote?.ask_price),
    asOfMs,
    delayed: Boolean(ticker.delayed ?? payload.delayed ?? false),
    marketOpen: true,
  };
}

export function parseMassiveCashLevelOne(
  symbol: string,
  kind: "INDEX" | "STOCK",
  payload: unknown,
): ParsedCashLevelOne | null {
  if (!isRecord(payload)) return null;
  return kind === "INDEX"
    ? parseIndexSnapshot(symbol, payload)
    : parseStockSnapshot(symbol, payload);
}

export function mergeCashLevelOneCandle(
  candles: OptionsCandle[],
  quote: ParsedCashLevelOne,
): OptionsCandle[] {
  if (!isUsRegularCashSessionTimestamp(quote.asOfMs)) return candles;
  const bucket = Math.floor(quote.asOfMs / 60_000) * 60_000;
  const rows = new Map(candles.map((candle) => [candle.timestamp, candle]));
  const current = rows.get(bucket);
  rows.set(bucket, current
    ? {
        ...current,
        high: Math.max(current.high, quote.lastPrice),
        low: Math.min(current.low, quote.lastPrice),
        close: quote.lastPrice,
      }
    : {
        timestamp: bucket,
        open: quote.lastPrice,
        high: quote.lastPrice,
        low: quote.lastPrice,
        close: quote.lastPrice,
        volume: 0,
      });
  return [...rows.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-600);
}


