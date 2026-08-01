import "server-only";

import type { Candle } from "@/lib/backtester";
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
};

const MASSIVE_API_BASE = "https://api.massive.com";

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
  const results = await Promise.allSettled(symbols.map(async (symbol): Promise<MarketIndexSnapshot | null> => {
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
    };
  }));

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []);
}
