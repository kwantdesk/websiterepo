import "server-only";

import type { Candle } from "@/lib/backtester";
import { fetchGexBotVixSpot, hasGexBotVixAccess } from "@/lib/gexBotVix.server";
import { getMarketIndexDefinition } from "@/lib/marketIndices";
import { parseMassiveCashLevelOne } from "@/lib/optionsLevelOne";

type JsonRecord = Record<string, unknown>;

export type MarketIndexSnapshot = {
  symbol: string;
  broker: "Market Index";
  exchange: "CBOE";
  lastPrice: number;
  openPrice: number;
  change: number;
  changePercent: number;
  timestamp: number;
  delayed: boolean;
  marketOpen: boolean;
  provider: "GEXBot" | "Massive" | "CBOE EOD";
};

const MASSIVE_API_BASE = "https://api.massive.com";
const CBOE_VIX_DAILY_HISTORY_URL =
  "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv";

function getMassiveApiKey() {
  return process.env.MASSIVE_API_KEY?.trim()
    || process.env.POLYGON_API_KEY?.trim()
    || "";
}

function requireMassiveApiKey() {
  const key = getMassiveApiKey();
  if (!key) {
    throw new Error("Market indices are not configured. Add MASSIVE_API_KEY in Vercel.");
  }
  return key;
}

export function hasLiveMarketIndexAccess() {
  return Boolean(getMassiveApiKey()) || hasGexBotVixAccess();
}

export function hasIntradayMarketIndexHistoryAccess() {
  return Boolean(getMassiveApiKey());
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeframeToAggregate(timeframe: string) {
  const resolutions: Record<string, { multiplier: number; timespan: string }> = {
    "1m": { multiplier: 1, timespan: "minute" },
    "5m": { multiplier: 5, timespan: "minute" },
    "15m": { multiplier: 15, timespan: "minute" },
    "30m": { multiplier: 30, timespan: "minute" },
    "1h": { multiplier: 1, timespan: "hour" },
    "2h": { multiplier: 2, timespan: "hour" },
    "4h": { multiplier: 4, timespan: "hour" },
    "1D": { multiplier: 1, timespan: "day" },
    "1W": { multiplier: 1, timespan: "week" },
    "1M": { multiplier: 1, timespan: "month" },
  };
  const resolution = resolutions[timeframe];
  if (!resolution) throw new Error(`Market indices do not support ${timeframe}.`);
  return resolution;
}

function parseCboeDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function fetchCboeVixDailyCandles() {
  const response = await fetch(CBOE_VIX_DAILY_HISTORY_URL, {
    next: { revalidate: 3_600 },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Cboe VIX history failed (${response.status}).`);
  }
  const lines = (await response.text()).split(/\r?\n/).slice(1);
  return lines.flatMap((line): Candle[] => {
    const [date, openValue, highValue, lowValue, closeValue] = line.split(",");
    const timestamp = parseCboeDate(date ?? "");
    const open = finiteNumber(openValue);
    const high = finiteNumber(highValue);
    const low = finiteNumber(lowValue);
    const close = finiteNumber(closeValue);
    if (timestamp === null || open === null || high === null || low === null || close === null) return [];
    return [{ timestamp, open, high, low, close, volume: 0 }];
  });
}

function aggregateCboeDailyCandles(candles: Candle[], timeframe: string) {
  if (timeframe === "1D") return candles;
  if (timeframe !== "1W" && timeframe !== "1M") {
    throw new Error(
      "Live and intraday VIX require an indices-entitled MASSIVE_API_KEY. Official Cboe end-of-day history is available on 1D, 1W and 1M.",
    );
  }
  const grouped = new Map<string, Candle[]>();
  for (const candle of candles) {
    const date = new Date(candle.timestamp);
    const key = timeframe === "1M"
      ? `${date.getUTCFullYear()}-${date.getUTCMonth()}`
      : (() => {
          const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
          const day = monday.getUTCDay() || 7;
          monday.setUTCDate(monday.getUTCDate() - day + 1);
          return monday.toISOString().slice(0, 10);
        })();
    grouped.set(key, [...(grouped.get(key) ?? []), candle]);
  }
  return [...grouped.values()].map((rows) => ({
    timestamp: rows[0].timestamp,
    open: rows[0].open,
    high: Math.max(...rows.map((row) => row.high)),
    low: Math.min(...rows.map((row) => row.low)),
    close: rows[rows.length - 1].close,
    volume: 0,
  }));
}

async function fetchCboeVixEodCandles(options: { timeframe: string; from: number; to: number }) {
  const daily = (await fetchCboeVixDailyCandles()).filter(
    (candle) => candle.timestamp >= options.from && candle.timestamp <= options.to,
  );
  return aggregateCboeDailyCandles(daily, options.timeframe);
}

async function fetchCboeVixEodSnapshots(symbols: string[]): Promise<MarketIndexSnapshot[]> {
  if (!symbols.some((symbol) => symbol.trim().toUpperCase() === "VIX")) return [];
  const rows = await fetchCboeVixDailyCandles();
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  if (!latest) return [];
  const previousClose = previous?.close ?? latest.open;
  const change = latest.close - previousClose;
  return [{
    symbol: "VIX",
    broker: "Market Index",
    exchange: "CBOE",
    lastPrice: latest.close,
    openPrice: previousClose,
    change,
    changePercent: previousClose ? change / previousClose * 100 : 0,
    timestamp: latest.timestamp,
    delayed: true,
    marketOpen: false,
    provider: "CBOE EOD",
  }];
}

function newYorkMarketOpen(timestamp = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  return weekday !== "Sat" && weekday !== "Sun" && minute >= 9 * 60 + 30 && minute < 16 * 60;
}

async function fetchGexBotVixSnapshot(): Promise<MarketIndexSnapshot> {
  const spot = await fetchGexBotVixSpot();
  let previousClose = spot.price;
  try {
    const daily = await fetchCboeVixDailyCandles();
    const latest = daily.at(-1);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const latestDate = latest ? new Date(latest.timestamp).toISOString().slice(0, 10) : "";
    previousClose = latestDate === today
      ? daily.at(-2)?.close ?? latest?.open ?? spot.price
      : latest?.close ?? spot.price;
  } catch {
    // The live VIX remains usable when the official EOD archive is temporarily unavailable.
  }
  const change = spot.price - previousClose;
  return {
    symbol: "VIX",
    broker: "Market Index",
    exchange: "CBOE",
    lastPrice: spot.price,
    openPrice: previousClose,
    change,
    changePercent: previousClose ? change / previousClose * 100 : 0,
    timestamp: spot.timestamp,
    delayed: spot.stale,
    marketOpen: newYorkMarketOpen() && !spot.stale,
    provider: "GEXBot",
  };
}

async function fetchMassiveJson(url: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${requireMassiveApiKey()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(
      String(payload.error ?? payload.message ?? `Market-index request failed (${response.status}).`),
    );
  }
  return payload;
}

export async function fetchMarketIndexCandles(options: {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
}): Promise<Candle[]> {
  const definition = getMarketIndexDefinition(options.symbol);
  if (!definition) throw new Error(`${options.symbol} is not a supported market index.`);
  if (!hasIntradayMarketIndexHistoryAccess()) {
    if (definition.symbol !== "VIX") {
      throw new Error(`${definition.symbol} requires an indices-entitled MASSIVE_API_KEY.`);
    }
    return fetchCboeVixEodCandles(options);
  }
  const { multiplier, timespan } = timeframeToAggregate(options.timeframe);
  const fromDate = new Date(options.from).toISOString().slice(0, 10);
  const toDate = new Date(options.to).toISOString().slice(0, 10);
  const endpoint = new URL(
    `${MASSIVE_API_BASE}/v2/aggs/ticker/${encodeURIComponent(definition.providerTicker)}/range/${multiplier}/${timespan}/${fromDate}/${toDate}`,
  );
  endpoint.searchParams.set("adjusted", "true");
  endpoint.searchParams.set("sort", "asc");
  endpoint.searchParams.set("limit", "50000");

  const payload = await fetchMassiveJson(endpoint.toString());
  const rows = Array.isArray(payload.results) ? payload.results : [];
  return rows.flatMap((value) => {
    if (!isRecord(value)) return [];
    const timestamp = finiteNumber(value.t ?? value.timestamp);
    const open = finiteNumber(value.o ?? value.open);
    const high = finiteNumber(value.h ?? value.high);
    const low = finiteNumber(value.l ?? value.low);
    const close = finiteNumber(value.c ?? value.close);
    if (timestamp === null || open === null || high === null || low === null || close === null) return [];
    return [{
      timestamp,
      open,
      high,
      low,
      close,
      volume: finiteNumber(value.v ?? value.volume) ?? 0,
    }];
  });
}

export async function fetchMarketIndexSnapshots(symbols: string[]) {
  const requested = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()))];
  const snapshots: MarketIndexSnapshot[] = [];
  if (requested.includes("VIX") && hasGexBotVixAccess()) {
    try {
      snapshots.push(await fetchGexBotVixSnapshot());
    } catch {
      // Massive and then the official Cboe EOD archive remain the resilience path.
    }
  }

  const resolved = new Set(snapshots.map((snapshot) => snapshot.symbol));
  const unresolved = requested.filter((symbol) => !resolved.has(symbol));
  if (!unresolved.length) return snapshots;
  if (!getMassiveApiKey()) {
    return [...snapshots, ...await fetchCboeVixEodSnapshots(unresolved)];
  }

  const results = await Promise.allSettled(unresolved.map(async (symbol): Promise<MarketIndexSnapshot | null> => {
    const definition = getMarketIndexDefinition(symbol);
    if (!definition) return null;
    const endpoint = `${MASSIVE_API_BASE}/v3/snapshot/indices?ticker=${encodeURIComponent(definition.providerTicker)}`;
    const payload = await fetchMassiveJson(endpoint);
    const quote = parseMassiveCashLevelOne(definition.symbol, "INDEX", payload);
    if (!quote) return null;

    const result = Array.isArray(payload.results) && isRecord(payload.results[0])
      ? payload.results[0]
      : null;
    const session = result && isRecord(result.session) ? result.session : null;
    const previousClose = finiteNumber(
      session?.previous_close
      ?? session?.previousClose
      ?? result?.previous_close
      ?? result?.previousClose,
    );
    const sessionOpen = finiteNumber(session?.open ?? result?.open);
    const openPrice = previousClose ?? sessionOpen ?? quote.lastPrice;
    const change = quote.lastPrice - openPrice;
    const suppliedChange = finiteNumber(session?.change ?? result?.change);
    const suppliedChangePercent = finiteNumber(
      session?.change_percent
      ?? session?.changePercent
      ?? result?.change_percent
      ?? result?.changePercent,
    );

    return {
      symbol: definition.symbol,
      broker: "Market Index",
      exchange: definition.exchange,
      lastPrice: quote.lastPrice,
      openPrice,
      change: suppliedChange ?? change,
      changePercent: suppliedChangePercent ?? (openPrice ? (change / openPrice) * 100 : 0),
      timestamp: quote.asOfMs,
      delayed: quote.delayed,
      marketOpen: quote.marketOpen,
      provider: "Massive",
    };
  }));

  snapshots.push(...results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []));
  if (snapshots.some((snapshot) => snapshot.symbol === "VIX") || !requested.includes("VIX")) return snapshots;
  return [...snapshots, ...await fetchCboeVixEodSnapshots(["VIX"])];
}
