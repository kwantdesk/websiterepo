import { getMassiveFuturesSymbolDefinition, MASSIVE_FUTURES_MAJOR_TIMEFRAMES } from "@/lib/massiveFutures";
import { vendorMarketDataFetch } from "@/lib/vendorMarketData.server";

type MassiveContractRow = {
  ticker?: string;
  product_code?: string;
  exchange?: string;
  active?: boolean;
  first_trade_date?: string;
  last_trade_date?: string;
  days_to_maturity?: number | null;
};

type MassiveAggRow = {
  ticker?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  window_start?: number;
};

export type MassiveHistoricalCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MassiveSnapshot = {
  symbol: string;
  broker: "Massive";
  delayed: true;
  contractTicker: string;
  exchange: string;
  lastPrice: number;
  openPrice: number;
  change: number;
  changePercent: number;
  timestamp: number;
};

const MASSIVE_API_BASE = "https://api.massive.com";

function normalizeMassiveWindowStart(value: number) {
  if (!Number.isFinite(value)) return value;
  return value > 10_000_000_000_000 ? Math.floor(value / 1_000_000) : value;
}

function timeframeToMassiveResolution(timeframe: string) {
  const map: Record<string, string> = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "1h": "1hour",
    "2h": "2hour",
    "4h": "4hour",
    "1D": "1session",
  };
  const resolution = map[timeframe];
  if (!resolution) {
    throw new Error(`Massive futures does not support ${timeframe} in the current integration flow.`);
  }
  return resolution;
}

async function fetchMassiveJson<T>(url: string) {
  const parsed = new URL(url, MASSIVE_API_BASE);
  parsed.searchParams.delete("apiKey");
  const response = await vendorMarketDataFetch("massive", `${parsed.pathname}${parsed.search}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string; message?: string; status?: string };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Massive request failed: ${response.status}`);
  }
  return payload;
}

async function fetchMassiveContracts(productCode: string, from: number, to: number) {
  const rows: MassiveContractRow[] = [];
  let nextUrl: URL | null = new URL(`${MASSIVE_API_BASE}/futures/v1/contracts`);
  nextUrl.searchParams.set("product_code", productCode);
  nextUrl.searchParams.set("first_trade_date.lte", new Date(to).toISOString().slice(0, 10));
  nextUrl.searchParams.set("last_trade_date.gte", new Date(from).toISOString().slice(0, 10));
  nextUrl.searchParams.set("limit", "1000");
  nextUrl.searchParams.set("sort", "first_trade_date.asc");

  while (nextUrl) {
    const payload: { results?: MassiveContractRow[]; next_url?: string } = await fetchMassiveJson(nextUrl.toString());
    rows.push(...(payload.results ?? []));
    nextUrl = payload.next_url ? new URL(payload.next_url, MASSIVE_API_BASE) : null;
  }

  return rows.filter((row) => typeof row.ticker === "string");
}

async function fetchMassiveAggsForTicker(ticker: string, timeframe: string, from: number, to: number) {
  const rows: MassiveAggRow[] = [];
  let nextUrl: URL | null = new URL(`${MASSIVE_API_BASE}/futures/v1/aggs/${encodeURIComponent(ticker)}`);
  nextUrl.searchParams.set("resolution", timeframeToMassiveResolution(timeframe));
  nextUrl.searchParams.set("window_start.gte", new Date(from).toISOString().slice(0, 10));
  nextUrl.searchParams.set("window_start.lte", new Date(to).toISOString().slice(0, 10));
  nextUrl.searchParams.set("limit", "50000");
  nextUrl.searchParams.set("sort", "window_start.asc");

  while (nextUrl) {
    const payload: { results?: MassiveAggRow[]; next_url?: string } = await fetchMassiveJson(nextUrl.toString());
    rows.push(...(payload.results ?? []));
    nextUrl = payload.next_url ? new URL(payload.next_url, MASSIVE_API_BASE) : null;
  }

  return rows;
}

export async function fetchMassiveContinuousCandles(options: {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
}) {
  const definition = getMassiveFuturesSymbolDefinition(options.symbol);
  if (!definition) {
    throw new Error(`Massive futures symbol ${options.symbol} is not in the current catalog.`);
  }

  const contracts = await fetchMassiveContracts(definition.productCode, options.from, options.to);
  if (!contracts.length) {
    return [] as MassiveHistoricalCandle[];
  }

  const merged = new Map<number, MassiveHistoricalCandle & { _score: number }>();

  for (const contract of contracts) {
    const firstTrade = contract.first_trade_date ? Date.parse(contract.first_trade_date) : options.from;
    const lastTrade = contract.last_trade_date ? Date.parse(contract.last_trade_date) + 24 * 60 * 60 * 1000 - 1 : options.to;
    const contractFrom = Math.max(options.from, firstTrade);
    const contractTo = Math.min(options.to, lastTrade);
    if (contractFrom > contractTo || !contract.ticker) continue;

    const candles = await fetchMassiveAggsForTicker(contract.ticker, options.timeframe, contractFrom, contractTo);
    for (const candle of candles) {
      const timestamp = normalizeMassiveWindowStart(Number(candle.window_start));
      const volume = Number(candle.volume ?? 0);
      if (!Number.isFinite(timestamp) || !Number.isFinite(Number(candle.open)) || !Number.isFinite(Number(candle.close))) {
        continue;
      }

      const next = {
        timestamp,
        open: Number(candle.open),
        high: Number(candle.high ?? candle.open),
        low: Number(candle.low ?? candle.open),
        close: Number(candle.close),
        volume,
        _score: volume,
      };
      const existing = merged.get(timestamp);
      if (!existing || next._score >= existing._score) {
        merged.set(timestamp, next);
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ _score, ...candle }) => candle);
}

export async function fetchMassiveDelayedSnapshots(symbols: string[]) {
  const snapshots: MassiveSnapshot[] = [];

  for (const symbol of symbols) {
    const definition = getMassiveFuturesSymbolDefinition(symbol);
    if (!definition) continue;

    const contracts = await fetchMassiveContracts(definition.productCode, Date.now() - 14 * 24 * 60 * 60 * 1000, Date.now());
    const activeContract =
      contracts
        .filter((row) => row.active && typeof row.ticker === "string")
        .sort((a, b) => (Number(a.days_to_maturity ?? Number.MAX_SAFE_INTEGER) - Number(b.days_to_maturity ?? Number.MAX_SAFE_INTEGER)))[0] ??
      contracts[contracts.length - 1];
    if (!activeContract?.ticker) continue;

    const candles = await fetchMassiveAggsForTicker(activeContract.ticker, "1m", Date.now() - 2 * 24 * 60 * 60 * 1000, Date.now());
    const latest = candles[candles.length - 1];
    const previous = candles[candles.length - 2] ?? latest;
    if (!latest) continue;

    const lastPrice = Number(latest.close ?? 0);
    const openPrice = Number(previous.close ?? lastPrice);
    const change = lastPrice - openPrice;
    snapshots.push({
      symbol: definition.symbol,
      broker: "Massive",
      delayed: true,
      contractTicker: activeContract.ticker,
      exchange: definition.exchange,
      lastPrice,
      openPrice,
      change,
      changePercent: openPrice ? (change / openPrice) * 100 : 0,
      timestamp: normalizeMassiveWindowStart(Number(latest.window_start ?? Date.now())),
    });
  }

  return snapshots;
}

export function getMassiveSupportedTimeframes() {
  return Array.from(MASSIVE_FUTURES_MAJOR_TIMEFRAMES);
}
