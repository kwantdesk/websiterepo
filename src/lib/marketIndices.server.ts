import "server-only";

import type { Candle } from "@/lib/backtester";
import { fetchGexBotVixSpot, hasGexBotVixAccess } from "@/lib/gexBotVix.server";
import { getMarketIndexDefinition } from "@/lib/marketIndices";
import { parseMassiveCashLevelOne } from "@/lib/optionsLevelOne";
import {
  getConfiguredQuantDataApiKey,
  getOptionsMarketPulse,
  getOptionsUnderlyingHistory,
} from "@/lib/quantData.server";

type JsonRecord = Record<string, unknown>;

export type MarketIndexSnapshot = {
  symbol: string;
  broker: "Market Index";
  exchange: "CBOE" | "NASDAQ" | "NYSE ARCA";
  lastPrice: number;
  openPrice: number;
  change: number;
  changePercent: number;
  timestamp: number;
  delayed: boolean;
  marketOpen: boolean;
  provider: "GEXBot" | "Massive" | "KwantData" | "CBOE EOD";
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
  return Boolean(getMassiveApiKey()) || Boolean(getConfiguredQuantDataApiKey());
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeframeToAggregate(timeframe: string) {
  const minuteMatch = timeframe.match(/^(\d+)m$/);
  if (minuteMatch) {
    const multiplier = Number(minuteMatch[1]);
    if (Number.isInteger(multiplier) && multiplier >= 1 && multiplier <= 240) {
      return { multiplier, timespan: "minute" };
    }
  }
  const resolutions: Record<string, { multiplier: number; timespan: string }> = {
    "1h": { multiplier: 1, timespan: "hour" },
    "2h": { multiplier: 2, timespan: "hour" },
    "4h": { multiplier: 4, timespan: "hour" },
    "1D": { multiplier: 1, timespan: "day" },
    "1W": { multiplier: 1, timespan: "week" },
    "1M": { multiplier: 1, timespan: "month" },
  };
  const resolution = resolutions[timeframe];
  if (!resolution) throw new Error(`Market instruments do not support ${timeframe}.`);
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
  const marketSessionOpen = newYorkMarketOpen();
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
    // VIX is intentionally marked delayed while New York is closed. At the
    // open, the warning clears only after GEXBot has supplied a fresh frame,
    // so an overnight close can never be presented as a live print.
    delayed: !marketSessionOpen || spot.stale,
    marketOpen: marketSessionOpen && !spot.stale,
    provider: "GEXBot",
  };
}

async function fetchKwantDataUnderlyingSnapshot(symbol: string): Promise<MarketIndexSnapshot | null> {
  const definition = getMarketIndexDefinition(symbol);
  if (!definition || definition.group !== "Options Underlyings") return null;
  const pulse = await getOptionsMarketPulse(definition.symbol, "CASH", false);
  const marketData = pulse.marketData;
  const lastPrice = marketData.lastPrice;
  if (lastPrice === null || !Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  const openPrice = marketData.candles[0]?.open ?? lastPrice;
  const change = lastPrice - openPrice;
  const timestamp = Date.parse(marketData.asOf);
  return {
    symbol: definition.symbol,
    broker: "Market Index",
    exchange: definition.exchange,
    lastPrice,
    openPrice,
    change,
    changePercent: openPrice ? change / openPrice * 100 : 0,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    delayed: marketData.stale || marketData.status !== "LIVE",
    marketOpen: marketData.status === "LIVE" && !marketData.stale,
    provider: "KwantData",
  };
}

async function fetchMassiveJson(url: string, timeoutMs = 12_000) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${requireMassiveApiKey()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
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
  if (!definition) throw new Error(`${options.symbol} is not a supported market instrument.`);
  const canUseOfficialVixArchive = definition.symbol === "VIX"
    && ["1D", "1W", "1M"].includes(options.timeframe);
  const canUseKwantDataHistory = definition.group === "Options Underlyings"
    && Boolean(getConfiguredQuantDataApiKey());
  // These instruments belong to the options surface and KwantData is the
  // authoritative shared VPS adapter for their chart history. Prefer it before
  // probing Massive: an account without the matching minute entitlement used
  // to burn the full Massive timeout before falling back, which made 1m/5m
  // charts appear frozen even though valid KwantData candles were available.
  if (canUseKwantDataHistory) {
    try {
      const candles = await getOptionsUnderlyingHistory(options);
      if (candles.length) return candles;
    } catch (error) {
      if (!getMassiveApiKey()) throw error;
    }
  }
  if (!getMassiveApiKey()) {
    if (definition.symbol !== "VIX") {
      throw new Error(`${definition.symbol} market history is not configured.`);
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

  try {
    const payload = await fetchMassiveJson(endpoint.toString());
    const rows = Array.isArray(payload.results) ? payload.results : [];
    const candles = rows.flatMap((value) => {
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
    if (candles.length) return candles;
    if (canUseKwantDataHistory) {
      const fallback = await getOptionsUnderlyingHistory(options);
      if (fallback.length) return fallback;
    }
    if (!canUseOfficialVixArchive) return [];
  } catch (error) {
    if (canUseKwantDataHistory) {
      const fallback = await getOptionsUnderlyingHistory(options).catch(() => []);
      if (fallback.length) return fallback;
    }
    if (!canUseOfficialVixArchive) throw error;
  }

  // A configured Massive key may still lack the indices entitlement. VIX
  // daily/weekly/monthly charts must remain usable in that case.
  return fetchCboeVixEodCandles(options);
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
    const quantDataResults = getConfiguredQuantDataApiKey()
      ? await Promise.allSettled(unresolved.map(fetchKwantDataUnderlyingSnapshot))
      : [];
    const quantDataSnapshots = quantDataResults.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : []);
    return [
      ...snapshots,
      ...quantDataSnapshots,
      ...await fetchCboeVixEodSnapshots(unresolved),
    ];
  }

  const results = await Promise.allSettled(unresolved.map(async (symbol): Promise<MarketIndexSnapshot | null> => {
    const definition = getMarketIndexDefinition(symbol);
    if (!definition) return null;
    const endpoint = definition.providerKind === "INDEX"
      ? `${MASSIVE_API_BASE}/v3/snapshot/indices?ticker=${encodeURIComponent(definition.providerTicker)}`
      : `${MASSIVE_API_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(definition.providerTicker)}`;
    // A live batch must not wait twelve seconds because one upstream ticker is
    // slow. The browser retains the last verified frame and retries the full
    // batch, so a short snapshot deadline is both smoother and more honest.
    const payload = await fetchMassiveJson(endpoint, 2_500);
    const quote = parseMassiveCashLevelOne(definition.symbol, definition.providerKind, payload);
    if (!quote) return null;

    const result = definition.providerKind === "INDEX"
      ? Array.isArray(payload.results) && isRecord(payload.results[0])
        ? payload.results[0]
        : null
      : isRecord(payload.ticker)
        ? payload.ticker
        : null;
    const session = result && isRecord(result.session) ? result.session : null;
    const previousDay = result && isRecord(result.prevDay ?? result.previousDay)
      ? result.prevDay ?? result.previousDay
      : null;
    const currentDay = result && isRecord(result.day)
      ? result.day
      : null;
    const previousClose = finiteNumber(
      session?.previous_close
      ?? session?.previousClose
      ?? (isRecord(previousDay) ? previousDay.c ?? previousDay.close : null)
      ?? result?.previous_close
      ?? result?.previousClose,
    );
    const sessionOpen = finiteNumber(
      session?.open
      ?? (isRecord(currentDay) ? currentDay.o ?? currentDay.open : null)
      ?? result?.open,
    );
    const openPrice = previousClose ?? sessionOpen ?? quote.lastPrice;
    const change = quote.lastPrice - openPrice;
    const suppliedChange = finiteNumber(session?.change ?? result?.todaysChange ?? result?.change);
    const suppliedChangePercent = finiteNumber(
      session?.change_percent
      ?? session?.changePercent
      ?? result?.todaysChangePerc
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
      marketOpen: definition.providerKind === "STOCK"
        ? newYorkMarketOpen(quote.asOfMs)
        : quote.marketOpen,
      provider: "Massive",
    };
  }));

  snapshots.push(...results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []));
  const stillUnresolved = unresolved.filter((symbol) =>
    !snapshots.some((snapshot) => snapshot.symbol === symbol));
  if (stillUnresolved.length && getConfiguredQuantDataApiKey()) {
    const fallbackResults = await Promise.allSettled(
      stillUnresolved.map(fetchKwantDataUnderlyingSnapshot),
    );
    snapshots.push(...fallbackResults.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : []));
  }
  if (snapshots.some((snapshot) => snapshot.symbol === "VIX") || !requested.includes("VIX")) return snapshots;
  return [...snapshots, ...await fetchCboeVixEodSnapshots(["VIX"])];
}
