import type { CTraderTokenSet } from "@/lib/ctraderSession";
import { getCTraderCandles, getCTraderInstrumentSymbols } from "@/lib/ctrader.server";
import {
  fetchMassiveContinuousCandles,
  getMassiveSupportedTimeframes,
} from "@/lib/massiveFutures.server";
import { getMassiveFuturesSymbols } from "@/lib/massiveFutures";

type HistoricalCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type MarketDataConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  candleTable: string;
  datasetTable: string;
  backfillJobTable: string;
};

type MarketDataDatasetRow = {
  broker: string;
  provider: string;
  source: string;
  symbol: string;
  timeframe: string;
  available_from: string | null;
  available_to: string | null;
  candle_count: number | null;
  last_ingested_at: string | null;
};

type MarketDataCandleRow = {
  broker: string;
  provider: string;
  source: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type MarketDataBackfillJobRow = {
  id: string;
  broker: string;
  provider: string;
  source: string;
  symbol: string;
  timeframe: string;
  status: "pending" | "active" | "complete" | "error";
  cursor_from: string;
  target_to: string;
  chunk_days: number;
  attempts: number | null;
  last_error: string | null;
  last_run_at: string | null;
};

export const KWANTIFY_LAUNCH_HISTORY_SYMBOLS = [
  "NAS100",
  "S&P500",
  "US30",
  "GER40",
  "UK100",
  "NIKKEI",
  "DOW30",
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "NZDUSD",
  "USDCAD",
  "USDCHF",
  "XAUUSD",
  "XAGUSD",
  "OIL",
  "NATGAS",
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "XRPUSD",
] as const;

export const KWANTIFY_TOP10_HISTORY_SYMBOLS = [
  "XAUUSD",
  "NAS100",
  "EURUSD",
  "GBPUSD",
  "US30",
  "S&P500",
  "GER40",
  "UK100",
  "BTCUSD",
  "ETHUSD",
] as const;

export const KWANTIFY_MAJOR_HISTORY_TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1D"] as const;
export const KWANTIFY_TWO_YEARS_MS = 730 * 24 * 60 * 60 * 1000;
export const KWANTIFY_FUTURES_HISTORY_SYMBOLS = getMassiveFuturesSymbols() as ReturnType<typeof getMassiveFuturesSymbols>;

export const KWANTIFY_OANDA_HISTORY_TIMEFRAMES = [
  "5s",
  "10s",
  "15s",
  "30s",
  "1m",
  "2m",
  "4m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "2h",
  "3h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1D",
  "1W",
  "1M",
] as const;
export const KWANTIFY_CTRADER_HISTORY_TIMEFRAMES = [
  "1m",
  "2m",
  "3m",
  "4m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "4h",
  "12h",
  "1D",
  "1W",
  "1M",
] as const;
export const KWANTIFY_LAUNCH_HISTORY_TIMEFRAMES = Array.from(
  new Set([...KWANTIFY_OANDA_HISTORY_TIMEFRAMES, ...KWANTIFY_CTRADER_HISTORY_TIMEFRAMES, ...getMassiveSupportedTimeframes()]),
);
export const KWANTIFY_CTRADER_HISTORY_BROKERS = ["Pepperstone", "IC Markets", "FP Markets", "BlackBull Markets", "FxPro"] as const;
export const KWANTIFY_MASSIVE_HISTORY_BROKER = "Massive" as const;

const OANDA_HISTORY_SYMBOL_MAP: Record<string, string> = {
  EURUSD: "EUR_USD",
  GBPUSD: "GBP_USD",
  USDJPY: "USD_JPY",
  XAUUSD: "XAU_USD",
  NAS100: "NAS100_USD",
  "S&P500": "SPX500_USD",
  US30: "US30_USD",
  DOW30: "US30_USD",
  GER40: "DE30_EUR",
  UK100: "UK100_GBP",
  NIKKEI: "JP225_USD",
  AUDUSD: "AUD_USD",
  NZDUSD: "NZD_USD",
  USDCAD: "USD_CAD",
  USDCHF: "USD_CHF",
  XAGUSD: "XAG_USD",
  OIL: "BCO_USD",
  BTCUSD: "BTC_USD",
  ETHUSD: "ETH_USD",
  SOLUSD: "SOL_USD",
  XRPUSD: "XRP_USD",
};

const OANDA_HISTORY_SYMBOL_REVERSE_MAP = Object.fromEntries(
  Object.entries(OANDA_HISTORY_SYMBOL_MAP).map(([displaySymbol, oandaInstrument]) => [oandaInstrument, displaySymbol]),
) as Record<string, string>;

const OANDA_HISTORY_TIMEFRAME_MAP: Record<string, string> = {
  "5s": "S5",
  "10s": "S10",
  "15s": "S15",
  "30s": "S30",
  "1m": "M1",
  "2m": "M2",
  "4m": "M4",
  "5m": "M5",
  "10m": "M10",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
  "2h": "H2",
  "3h": "H3",
  "4h": "H4",
  "6h": "H6",
  "8h": "H8",
  "12h": "H12",
  "1D": "D",
  "1W": "W",
  "1M": "M",
};

const DEFAULT_CANDLE_TABLE = "kwantify_market_candles";
const DEFAULT_DATASET_TABLE = "kwantify_market_data_sets";
const DEFAULT_BACKFILL_JOB_TABLE = "kwantify_market_data_backfill_jobs";
const MAX_CANDLES_PER_UPSERT = 1_000;
const SUPABASE_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
export const KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_ISO = "2016-01-01T00:00:00.000Z";
export const KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS = new Date(KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_ISO).getTime();

function getMarketDataConfig(): MarketDataConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    supabaseUrl,
    serviceRoleKey,
    candleTable: process.env.KWANTIFY_MARKET_CANDLES_TABLE?.trim() || DEFAULT_CANDLE_TABLE,
    datasetTable: process.env.KWANTIFY_MARKET_DATASETS_TABLE?.trim() || DEFAULT_DATASET_TABLE,
    backfillJobTable: process.env.KWANTIFY_MARKET_DATA_BACKFILL_JOBS_TABLE?.trim() || DEFAULT_BACKFILL_JOB_TABLE,
  };
}

function marketDataHeaders(config: MarketDataConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(input: string, init: RequestInit, options?: { attempts?: number; label?: string }) {
  const attempts = Math.max(1, options?.attempts ?? 5);
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      lastResponse = response;
      if (response.ok || !SUPABASE_RETRY_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }

    await sleep(Math.min(15_000, 750 * 2 ** (attempt - 1)));
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error(`${options?.label ?? "Supabase request"} failed.`);
}

function isMarketDataSchemaMissing(message: string) {
  return /PRST205|Could not find the table|schema cache|kwantify_market_(candles|data_sets|data_backfill_jobs)/i.test(message);
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function normalizeSymbols(symbols?: string[]) {
  const source = symbols?.length ? symbols : Array.from(KWANTIFY_LAUNCH_HISTORY_SYMBOLS);
  return Array.from(new Set(source.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)));
}

function normalizeTimeframes(timeframes?: string[]) {
  const source = timeframes?.length ? timeframes : Array.from(KWANTIFY_LAUNCH_HISTORY_TIMEFRAMES);
  return Array.from(new Set(source.map((timeframe) => timeframe.trim()).filter(Boolean)));
}

function normalizeProviderTimeframes(timeframes: string[] | undefined, supported: readonly string[]) {
  const requested = timeframes?.length ? timeframes : Array.from(supported);
  const supportedSet = new Set(supported);
  return Array.from(new Set(requested.map((timeframe) => timeframe.trim()).filter((timeframe) => supportedSet.has(timeframe))));
}

function resolveOandaInstrument(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  return OANDA_HISTORY_SYMBOL_MAP[normalized] ?? (normalized.includes("_") ? normalized : undefined);
}

function displaySymbolFromOandaInstrument(instrument: string) {
  return OANDA_HISTORY_SYMBOL_REVERSE_MAP[instrument] ?? instrument;
}

function parseBackfillFrom(value?: string | null) {
  const configured = value?.trim() || process.env.KWANTIFY_MARKET_DATA_BACKFILL_FROM?.trim() || KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_ISO;
  const timestamp = new Date(configured).getTime();
  return Number.isFinite(timestamp) ? Math.max(timestamp, KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS) : KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS;
}

function chunkRange(from: number, to: number, chunkDays: number) {
  const chunkMs = Math.max(1, chunkDays) * 24 * 60 * 60 * 1000;
  const chunks: Array<{ from: number; to: number }> = [];
  let cursor = from;

  while (cursor < to) {
    const nextTo = Math.min(to, cursor + chunkMs);
    chunks.push({ from: cursor, to: nextTo });
    cursor = nextTo + 1;
  }

  return chunks;
}

async function upsertCandleRows(options: {
  config: MarketDataConfig;
  broker: string;
  provider: string;
  source: string;
  symbol: string;
  timeframe: string;
  candles: HistoricalCandle[];
}) {
  if (!options.candles.length) return;

  for (let index = 0; index < options.candles.length; index += MAX_CANDLES_PER_UPSERT) {
    const slice = options.candles.slice(index, index + MAX_CANDLES_PER_UPSERT);
    const rows = slice.map((candle) => ({
      broker: options.broker,
      provider: options.provider,
      source: options.source,
      symbol: options.symbol,
      timeframe: options.timeframe,
      timestamp: toIso(candle.timestamp),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }));

    const response = await fetchWithRetry(
      `${options.config.supabaseUrl}/rest/v1/${options.config.candleTable}?on_conflict=broker,provider,source,symbol,timeframe,timestamp`,
      {
        method: "POST",
        headers: {
          ...marketDataHeaders(options.config),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
        cache: "no-store",
      },
      { label: "Market candle upsert" },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Market candle upsert failed: ${text || response.status}`);
    }
  }
}

async function upsertDatasetRow(options: {
  config: MarketDataConfig;
  broker: string;
  provider: string;
  source: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  candleCount: number;
}) {
  const row = {
    broker: options.broker,
    provider: options.provider,
    source: options.source,
    symbol: options.symbol,
    timeframe: options.timeframe,
    available_from: toIso(options.from),
    available_to: toIso(options.to),
    candle_count: options.candleCount,
    last_ingested_at: new Date().toISOString(),
  };

  const response = await fetchWithRetry(
    `${options.config.supabaseUrl}/rest/v1/${options.config.datasetTable}?on_conflict=broker,provider,source,symbol,timeframe`,
    {
      method: "POST",
      headers: {
        ...marketDataHeaders(options.config),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([row]),
      cache: "no-store",
    },
    { label: "Market dataset upsert" },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Market dataset upsert failed: ${text || response.status}`);
  }
}

export async function ingestCTraderHistoricalCandles(options: {
  broker?: string;
  symbols?: string[];
  timeframes?: string[];
  months?: number;
  lookbackDays?: number;
  chunkDays?: number;
  tokenSet?: CTraderTokenSet;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      provider: "cTrader",
      broker: options.broker ?? "Pepperstone",
      datasets: [],
      message: "Supabase market-data storage is not configured.",
    };
  }

  const broker = options.broker?.trim() || "Pepperstone";
  const symbols = normalizeSymbols(options.symbols);
  const timeframes = normalizeProviderTimeframes(options.timeframes, KWANTIFY_CTRADER_HISTORY_TIMEFRAMES);
  const months = Math.max(1, Math.min(options.months ?? 24, 24));
  const lookbackDays = options.lookbackDays ? Math.max(1, Math.min(options.lookbackDays, 14)) : null;
  const chunkDays = Math.max(1, Math.min(options.chunkDays ?? (lookbackDays ? 1 : 30), 90));
  const to = Date.now();
  const from = lookbackDays
    ? to - lookbackDays * 24 * 60 * 60 * 1000
    : to - months * 30 * 24 * 60 * 60 * 1000;
  const chunks = chunkRange(from, to, chunkDays);
  const datasets: Array<{
    symbol: string;
    timeframe: string;
    candles: number;
    chunks: number;
    availableFrom: string | null;
    availableTo: string | null;
    error?: string;
  }> = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      const merged = new Map<number, HistoricalCandle>();
      let chunkErrors = 0;
      let firstError = "";

      for (const chunk of chunks) {
        try {
          const candles = await getCTraderCandles(
            broker,
            symbol,
            timeframe,
            {
              from: chunk.from,
              to: chunk.to,
              count: 50_000,
            },
            options.tokenSet,
          );

          candles.forEach((candle) => {
            if (Number.isFinite(candle.timestamp)) {
              merged.set(candle.timestamp, candle);
            }
          });
        } catch (error) {
          chunkErrors += 1;
          if (!firstError) firstError = error instanceof Error ? error.message : String(error);
        }
      }

      const candles = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
      if (candles.length) {
        await upsertCandleRows({
          config,
          broker,
          provider: "cTrader",
          source: "cTrader Open API trendbars",
          symbol,
          timeframe,
          candles,
        });
        await upsertDatasetRow({
          config,
          broker,
          provider: "cTrader",
          source: "cTrader Open API trendbars",
          symbol,
          timeframe,
          from: candles[0].timestamp,
          to: candles[candles.length - 1].timestamp,
          candleCount: candles.length,
        });
      }

      datasets.push({
        symbol,
        timeframe,
        candles: candles.length,
        chunks: chunks.length,
        availableFrom: candles[0] ? toIso(candles[0].timestamp) : null,
        availableTo: candles[candles.length - 1] ? toIso(candles[candles.length - 1].timestamp) : null,
        error: chunkErrors ? `${chunkErrors}/${chunks.length} chunks failed${firstError ? `: ${firstError}` : ""}` : undefined,
      });
    }
  }

  return {
    configured: true,
    provider: "cTrader",
    broker,
    months,
    lookbackDays,
    chunkDays,
    datasets,
  };
}

type OandaCandleResponse = {
  candles?: Array<{
    time: string;
    volume?: number;
    mid?: { o: string; h: string; l: string; c: string };
  }>;
  errorMessage?: string;
};

async function fetchOandaHistoricalCandles(options: {
  instrument: string;
  granularity: string;
  from: number;
  to: number;
}) {
  const token = process.env.OANDA_API_TOKEN;
  const baseUrl = process.env.OANDA_API_URL || "https://api-fxpractice.oanda.com";

  if (!token) {
    throw new Error("OANDA_API_TOKEN is not configured.");
  }

  const candles = new Map<number, HistoricalCandle>();
  let cursor = options.from;
  let batches = 0;
  const maxBatches = 250;

  while (cursor < options.to && batches < maxBatches) {
    const url = new URL(`${baseUrl}/v3/instruments/${options.instrument}/candles`);
    url.searchParams.set("granularity", options.granularity);
    url.searchParams.set("price", "M");
    url.searchParams.set("count", "5000");
    url.searchParams.set("from", new Date(cursor).toISOString());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const data = (await response.json()) as OandaCandleResponse;

    if (!response.ok || data.errorMessage) {
      throw new Error(data.errorMessage || `OANDA candle request failed: ${response.status}`);
    }

    const batch = data.candles ?? [];
    if (!batch.length) break;

    for (const candle of batch) {
      if (!candle.mid) continue;
      const timestamp = new Date(candle.time).getTime();
      if (!Number.isFinite(timestamp)) continue;
      if (timestamp > options.to) continue;
      candles.set(timestamp, {
        timestamp,
        open: Number(candle.mid.o),
        high: Number(candle.mid.h),
        low: Number(candle.mid.l),
        close: Number(candle.mid.c),
        volume: Number(candle.volume ?? 0),
      });
    }

    const lastTimestamp = new Date(batch[batch.length - 1].time).getTime();
    if (!Number.isFinite(lastTimestamp) || lastTimestamp <= cursor) break;
    cursor = lastTimestamp + 1;
    batches += 1;
    if (lastTimestamp >= options.to) break;
    if (batch.length < 5000) break;
  }

  return Array.from(candles.values()).sort((a, b) => a.timestamp - b.timestamp);
}

async function fetchOandaAccountInstruments() {
  const token = process.env.OANDA_API_TOKEN;
  const accountId = process.env.OANDA_ACCOUNT_ID;
  const baseUrl = process.env.OANDA_API_URL || "https://api-fxpractice.oanda.com";

  if (!token || !accountId) {
    throw new Error("OANDA_API_TOKEN and OANDA_ACCOUNT_ID are required to discover OANDA instruments.");
  }

  const response = await fetch(`${baseUrl}/v3/accounts/${accountId}/instruments`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const data = (await response.json()) as { instruments?: Array<{ name?: string }> ; errorMessage?: string };

  if (!response.ok || data.errorMessage) {
    throw new Error(data.errorMessage || `OANDA instrument discovery failed: ${response.status}`);
  }

  return Array.from(
    new Set(
      (data.instruments ?? [])
        .map((instrument) => (instrument.name ? displaySymbolFromOandaInstrument(instrument.name) : ""))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export async function discoverHistoricalMarketInstruments(options: {
  provider: "oanda" | "ctrader" | "massive";
  broker?: string;
  tokenSet?: CTraderTokenSet;
}) {
  if (options.provider === "oanda") {
    const instruments = await fetchOandaAccountInstruments();
    return {
      provider: "OANDA",
      broker: "OANDA",
      instruments,
    };
  }

  if (options.provider === "massive") {
    return {
      provider: "Massive",
      broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
      instruments: getMassiveFuturesSymbols(),
    };
  }

  const broker = options.broker?.trim() || "Pepperstone";
  const instruments = await getCTraderInstrumentSymbols(broker, options.tokenSet);
  return {
    provider: "cTrader",
    broker,
    instruments,
  };
}

export async function ingestSingleHistoricalDataset(options: {
  provider: "oanda" | "ctrader" | "massive";
  broker?: string;
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  tokenSet?: CTraderTokenSet;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      provider: options.provider === "oanda" ? "OANDA" : "cTrader",
      broker: options.provider === "oanda" ? "OANDA" : options.broker ?? "Pepperstone",
      symbol: options.symbol,
      timeframe: options.timeframe,
      candles: 0,
      message: "Supabase market-data storage is not configured.",
    };
  }

  const provider =
    options.provider === "oanda" ? "OANDA" : options.provider === "massive" ? "Massive" : "cTrader";
  const broker =
    options.provider === "oanda"
      ? "OANDA"
      : options.provider === "massive"
        ? KWANTIFY_MASSIVE_HISTORY_BROKER
        : options.broker?.trim() || "Pepperstone";
  let candles: HistoricalCandle[] = [];
  let source = "";

  if (options.provider === "oanda") {
    const instrument = resolveOandaInstrument(options.symbol);
    const granularity = OANDA_HISTORY_TIMEFRAME_MAP[options.timeframe];
    if (!instrument) {
      throw new Error(`OANDA does not have a mapped instrument for ${options.symbol}.`);
    }
    if (!granularity) {
      throw new Error(`OANDA does not support ${options.timeframe} candles in this ingestion flow.`);
    }
    candles = await fetchOandaHistoricalCandles({
      instrument,
      granularity,
      from: options.from,
      to: options.to,
    });
    source = "OANDA v20 candles";
  } else if (options.provider === "ctrader") {
    if (!KWANTIFY_CTRADER_HISTORY_TIMEFRAMES.includes(options.timeframe as (typeof KWANTIFY_CTRADER_HISTORY_TIMEFRAMES)[number])) {
      throw new Error(`cTrader does not support ${options.timeframe} trendbars in this ingestion flow.`);
    }
    candles = await getCTraderCandles(
      broker,
      options.symbol,
      options.timeframe,
      {
        from: options.from,
        to: options.to,
        count: 50_000,
      },
      options.tokenSet,
    );
    source = "cTrader Open API trendbars";
  } else {
    candles = await fetchMassiveContinuousCandles({
      symbol: options.symbol,
      timeframe: options.timeframe,
      from: options.from,
      to: options.to,
    });
    source = "Massive Futures continuous aggregates";
  }

  if (candles.length) {
    await upsertCandleRows({
      config,
      broker,
      provider,
      source,
      symbol: options.symbol.trim().toUpperCase(),
      timeframe: options.timeframe,
      candles,
    });
    await upsertDatasetRow({
      config,
      broker,
      provider,
      source,
      symbol: options.symbol.trim().toUpperCase(),
      timeframe: options.timeframe,
      from: candles[0].timestamp,
      to: candles[candles.length - 1].timestamp,
      candleCount: candles.length,
    });
  }

  return {
    configured: true,
    provider,
    broker,
    source,
    symbol: options.symbol.trim().toUpperCase(),
    timeframe: options.timeframe,
    candles: candles.length,
    availableFrom: candles[0] ? toIso(candles[0].timestamp) : null,
    availableTo: candles[candles.length - 1] ? toIso(candles[candles.length - 1].timestamp) : null,
  };
}

export async function ingestOandaHistoricalCandles(options: {
  symbols?: string[];
  timeframes?: string[];
  months?: number;
  lookbackDays?: number;
  chunkDays?: number;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      provider: "OANDA",
      broker: "OANDA",
      datasets: [],
      message: "Supabase market-data storage is not configured.",
    };
  }

  const symbols = normalizeSymbols(options.symbols).filter((symbol) => resolveOandaInstrument(symbol));
  const timeframes = normalizeProviderTimeframes(options.timeframes, KWANTIFY_OANDA_HISTORY_TIMEFRAMES).filter((timeframe) => OANDA_HISTORY_TIMEFRAME_MAP[timeframe]);
  const months = Math.max(1, Math.min(options.months ?? 24, 24));
  const lookbackDays = options.lookbackDays ? Math.max(1, Math.min(options.lookbackDays, 14)) : null;
  const chunkDays = Math.max(1, Math.min(options.chunkDays ?? (lookbackDays ? 1 : 30), 90));
  const to = Date.now();
  const from = lookbackDays
    ? to - lookbackDays * 24 * 60 * 60 * 1000
    : to - months * 30 * 24 * 60 * 60 * 1000;
  const chunks = chunkRange(from, to, chunkDays);
  const datasets: Array<{
    symbol: string;
    timeframe: string;
    candles: number;
    chunks: number;
    availableFrom: string | null;
    availableTo: string | null;
    error?: string;
  }> = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      const merged = new Map<number, HistoricalCandle>();
      let chunkErrors = 0;
      let firstError = "";

      for (const chunk of chunks) {
        try {
          const candles = await fetchOandaHistoricalCandles({
            instrument: resolveOandaInstrument(symbol) as string,
            granularity: OANDA_HISTORY_TIMEFRAME_MAP[timeframe],
            from: chunk.from,
            to: chunk.to,
          });

          candles.forEach((candle) => {
            if (Number.isFinite(candle.timestamp)) {
              merged.set(candle.timestamp, candle);
            }
          });
        } catch (error) {
          chunkErrors += 1;
          if (!firstError) firstError = error instanceof Error ? error.message : String(error);
        }
      }

      const candles = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
      if (candles.length) {
        await upsertCandleRows({
          config,
          broker: "OANDA",
          provider: "OANDA",
          source: "OANDA v20 candles",
          symbol,
          timeframe,
          candles,
        });
        await upsertDatasetRow({
          config,
          broker: "OANDA",
          provider: "OANDA",
          source: "OANDA v20 candles",
          symbol,
          timeframe,
          from: candles[0].timestamp,
          to: candles[candles.length - 1].timestamp,
          candleCount: candles.length,
        });
      }

      datasets.push({
        symbol,
        timeframe,
        candles: candles.length,
        chunks: chunks.length,
        availableFrom: candles[0] ? toIso(candles[0].timestamp) : null,
        availableTo: candles[candles.length - 1] ? toIso(candles[candles.length - 1].timestamp) : null,
        error: chunkErrors ? `${chunkErrors}/${chunks.length} chunks failed${firstError ? `: ${firstError}` : ""}` : undefined,
      });
    }
  }

  return {
    configured: true,
    provider: "OANDA",
    broker: "OANDA",
    months,
    lookbackDays,
    chunkDays,
    datasets,
  };
}

export async function ingestMassiveHistoricalCandles(options: {
  symbols?: string[];
  timeframes?: string[];
  months?: number;
  lookbackDays?: number;
  chunkDays?: number;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      provider: "Massive",
      broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
      datasets: [],
      message: "Supabase market-data storage is not configured.",
    };
  }

  const symbols = normalizeSymbols(options.symbols?.length ? options.symbols : getMassiveFuturesSymbols());
  const timeframes = normalizeProviderTimeframes(options.timeframes, getMassiveSupportedTimeframes());
  const months = Math.max(1, Math.min(options.months ?? 24, 24));
  const lookbackDays = options.lookbackDays ? Math.max(1, Math.min(options.lookbackDays, 14)) : null;
  const chunkDays = Math.max(1, Math.min(options.chunkDays ?? (lookbackDays ? 1 : 30), 90));
  const to = Date.now();
  const from = lookbackDays
    ? to - lookbackDays * 24 * 60 * 60 * 1000
    : to - months * 30 * 24 * 60 * 60 * 1000;
  const chunks = chunkRange(from, to, chunkDays);
  const datasets: Array<{
    symbol: string;
    timeframe: string;
    candles: number;
    chunks: number;
    availableFrom: string | null;
    availableTo: string | null;
    error?: string;
  }> = [];

  for (const symbol of symbols) {
    for (const timeframe of timeframes) {
      const merged = new Map<number, HistoricalCandle>();
      let chunkErrors = 0;
      let firstError = "";

      for (const chunk of chunks) {
        try {
          const candles = await fetchMassiveContinuousCandles({
            symbol,
            timeframe,
            from: chunk.from,
            to: chunk.to,
          });

          candles.forEach((candle) => {
            if (Number.isFinite(candle.timestamp)) {
              merged.set(candle.timestamp, candle);
            }
          });
        } catch (error) {
          chunkErrors += 1;
          if (!firstError) firstError = error instanceof Error ? error.message : String(error);
        }
      }

      const candles = Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
      if (candles.length) {
        await upsertCandleRows({
          config,
          broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
          provider: "Massive",
          source: "Massive Futures continuous aggregates",
          symbol,
          timeframe,
          candles,
        });
        await upsertDatasetRow({
          config,
          broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
          provider: "Massive",
          source: "Massive Futures continuous aggregates",
          symbol,
          timeframe,
          from: candles[0].timestamp,
          to: candles[candles.length - 1].timestamp,
          candleCount: candles.length,
        });
      }

      datasets.push({
        symbol,
        timeframe,
        candles: candles.length,
        chunks: chunks.length,
        availableFrom: candles[0] ? toIso(candles[0].timestamp) : null,
        availableTo: candles[candles.length - 1] ? toIso(candles[candles.length - 1].timestamp) : null,
        error: chunkErrors ? `${chunkErrors}/${chunks.length} chunks failed${firstError ? `: ${firstError}` : ""}` : undefined,
      });
    }
  }

  return {
    configured: true,
    provider: "Massive",
    broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
    months,
    lookbackDays,
    chunkDays,
    datasets,
  };
}

async function upsertBackfillJobs(options: {
  config: MarketDataConfig;
  jobs: Array<{
    broker: string;
    provider: string;
    source: string;
    symbol: string;
    timeframe: string;
    cursorFrom: number;
    targetTo: number;
    chunkDays: number;
  }>;
}) {
  if (!options.jobs.length) return 0;

  const rows = options.jobs.map((job) => ({
    broker: job.broker,
    provider: job.provider,
    source: job.source,
    symbol: job.symbol.trim().toUpperCase(),
    timeframe: job.timeframe,
    status: "pending",
    cursor_from: toIso(job.cursorFrom),
    target_to: toIso(job.targetTo),
    chunk_days: job.chunkDays,
    attempts: 0,
    last_error: null,
    last_run_at: null,
  }));

  const response = await fetchWithRetry(
    `${options.config.supabaseUrl}/rest/v1/${options.config.backfillJobTable}?on_conflict=broker,provider,source,symbol,timeframe`,
    {
      method: "POST",
      headers: {
        ...marketDataHeaders(options.config),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      cache: "no-store",
    },
    { label: "Market-data backfill job upsert" },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Market-data backfill job upsert failed: ${text || response.status}`);
  }

  return rows.length;
}

export async function seedHistoricalMarketDataBackfillJobs(options: {
  provider: "oanda" | "ctrader" | "massive" | "all";
  brokers?: string[];
  symbols?: string[];
  timeframes?: string[];
  from?: string;
  to?: number;
  chunkDays?: number;
  tokenSet?: CTraderTokenSet;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      seeded: 0,
      message: "Supabase market-data storage is not configured.",
    };
  }

  const from = parseBackfillFrom(options.from);
  const to = options.to ?? Date.now();
  const chunkDays = Math.max(1, Math.min(options.chunkDays ?? 14, 90));
  const jobs: Array<{
    broker: string;
    provider: string;
    source: string;
    symbol: string;
    timeframe: string;
    cursorFrom: number;
    targetTo: number;
    chunkDays: number;
  }> = [];
  const discoveries: unknown[] = [];

  if (options.provider === "oanda" || options.provider === "all") {
    const instruments = options.symbols?.length
      ? normalizeSymbols(options.symbols).filter((symbol) => resolveOandaInstrument(symbol))
      : (await discoverHistoricalMarketInstruments({ provider: "oanda" })).instruments;
    const timeframes = normalizeProviderTimeframes(options.timeframes, KWANTIFY_OANDA_HISTORY_TIMEFRAMES);
    discoveries.push({ provider: "OANDA", broker: "OANDA", instruments: instruments.length, timeframes: timeframes.length });

    for (const symbol of instruments) {
      for (const timeframe of timeframes) {
        jobs.push({
          broker: "OANDA",
          provider: "OANDA",
          source: "OANDA v20 candles",
          symbol,
          timeframe,
          cursorFrom: from,
          targetTo: to,
          chunkDays,
        });
      }
    }
  }

  if (options.provider === "ctrader" || options.provider === "all") {
    const brokers = options.brokers?.length ? options.brokers : Array.from(KWANTIFY_CTRADER_HISTORY_BROKERS);
    const timeframes = normalizeProviderTimeframes(options.timeframes, KWANTIFY_CTRADER_HISTORY_TIMEFRAMES);

    for (const broker of brokers) {
      const instruments = options.symbols?.length
        ? normalizeSymbols(options.symbols)
        : (await discoverHistoricalMarketInstruments({ provider: "ctrader", broker, tokenSet: options.tokenSet })).instruments;
      discoveries.push({ provider: "cTrader", broker, instruments: instruments.length, timeframes: timeframes.length });

      for (const symbol of instruments) {
        for (const timeframe of timeframes) {
          jobs.push({
            broker,
            provider: "cTrader",
            source: "cTrader Open API trendbars",
            symbol,
            timeframe,
            cursorFrom: from,
            targetTo: to,
            chunkDays,
          });
        }
      }
    }
  }

  if (options.provider === "massive" || options.provider === "all") {
    const instruments = options.symbols?.length
      ? normalizeSymbols(options.symbols)
      : (await discoverHistoricalMarketInstruments({ provider: "massive" })).instruments;
    const timeframes = normalizeProviderTimeframes(options.timeframes, getMassiveSupportedTimeframes());
    discoveries.push({ provider: "Massive", broker: KWANTIFY_MASSIVE_HISTORY_BROKER, instruments: instruments.length, timeframes: timeframes.length });

    for (const symbol of instruments) {
      for (const timeframe of timeframes) {
        jobs.push({
          broker: KWANTIFY_MASSIVE_HISTORY_BROKER,
          provider: "Massive",
          source: "Massive Futures continuous aggregates",
          symbol,
          timeframe,
          cursorFrom: from,
          targetTo: to,
          chunkDays,
        });
      }
    }
  }

  return {
    configured: true,
    seeded: await upsertBackfillJobs({ config, jobs }),
    from: toIso(from),
    to: toIso(to),
    chunkDays,
    discoveries,
  };
}

async function patchBackfillJob(config: MarketDataConfig, id: string, patch: Record<string, unknown>) {
  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.backfillJobTable}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...marketDataHeaders(config),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  }, { label: "Market-data backfill job update" });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Market-data backfill job update failed: ${text || response.status}`);
  }
}

async function fetchDueBackfillJobs(
  config: MarketDataConfig,
  limit: number,
  filters?: {
    provider?: "oanda" | "ctrader" | "massive" | "all";
    brokers?: string[];
    symbols?: string[];
    timeframes?: string[];
  },
) {
  const query = new URLSearchParams({
    select: "id,broker,provider,source,symbol,timeframe,status,cursor_from,target_to,chunk_days,attempts,last_error,last_run_at",
    status: "in.(pending,active,error)",
    order: "last_run_at.asc.nullsfirst,provider.asc,broker.asc,symbol.asc,timeframe.asc",
    limit: String(Math.max(1, Math.min(limit, 50))),
  });

  if (filters?.provider === "oanda") query.set("provider", "eq.OANDA");
  if (filters?.provider === "ctrader") query.set("provider", "eq.cTrader");
  if (filters?.provider === "massive") query.set("provider", "eq.Massive");
  if (filters?.brokers?.length) {
    query.set("broker", `in.(${filters.brokers.map((broker) => `"${broker.replace(/"/g, '\\"')}"`).join(",")})`);
  }
  if (filters?.symbols?.length) {
    query.set("symbol", `in.(${filters.symbols.map((symbol) => `"${symbol.replace(/"/g, '\\"')}"`).join(",")})`);
  }
  if (filters?.timeframes?.length) {
    query.set("timeframe", `in.(${filters.timeframes.map((timeframe) => `"${timeframe.replace(/"/g, '\\"')}"`).join(",")})`);
  }

  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.backfillJobTable}?${query.toString()}`, {
    headers: marketDataHeaders(config),
    cache: "no-store",
  }, { label: "Market-data backfill job read" });

  if (!response.ok) {
    const text = await response.text();
    if (isMarketDataSchemaMissing(text)) {
      return null;
    }
    throw new Error(`Market-data backfill job read failed: ${text || response.status}`);
  }

  return (await response.json()) as MarketDataBackfillJobRow[];
}

export async function runHistoricalMarketDataBackfillBatch(options: {
  limit?: number;
  tokenSet?: CTraderTokenSet;
  provider?: "oanda" | "ctrader" | "massive" | "all";
  brokers?: string[];
  symbols?: string[];
  timeframes?: string[];
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      processed: 0,
      message: "Supabase market-data storage is not configured.",
    };
  }

  const jobs = await fetchDueBackfillJobs(config, options.limit ?? 5, {
    provider: options.provider,
    brokers: options.brokers,
    symbols: options.symbols,
    timeframes: options.timeframes,
  });
  if (!jobs) {
    return {
      configured: false,
      processed: 0,
      message: "Market-data backfill job table is not configured.",
    };
  }

  const processed: Array<Record<string, unknown>> = [];
  for (const job of jobs) {
    const cursorFrom = Math.max(new Date(job.cursor_from).getTime(), KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS);
    const targetTo = new Date(job.target_to).getTime();
    const chunkDays = Math.max(1, Math.min(Number(job.chunk_days || 1), 90));

    if (!Number.isFinite(cursorFrom) || !Number.isFinite(targetTo) || cursorFrom >= targetTo) {
      await patchBackfillJob(config, job.id, {
        status: "complete",
        last_run_at: new Date().toISOString(),
        last_error: null,
      });
      processed.push({ id: job.id, symbol: job.symbol, timeframe: job.timeframe, status: "complete", candles: 0 });
      continue;
    }

    const chunkTo = Math.min(targetTo, cursorFrom + chunkDays * 24 * 60 * 60 * 1000);
    try {
      await patchBackfillJob(config, job.id, {
        status: "active",
        last_run_at: new Date().toISOString(),
      });
      const result = await ingestSingleHistoricalDataset({
        provider:
          job.provider.toLowerCase() === "oanda"
            ? "oanda"
            : job.provider.toLowerCase() === "massive"
              ? "massive"
              : "ctrader",
        broker: job.broker,
        symbol: job.symbol,
        timeframe: job.timeframe,
        from: cursorFrom,
        to: chunkTo,
        tokenSet: options.tokenSet,
      });
      const nextCursor = chunkTo + 1;
      const complete = nextCursor >= targetTo;
      await patchBackfillJob(config, job.id, {
        status: complete ? "complete" : "active",
        cursor_from: toIso(nextCursor),
        attempts: 0,
        last_error: null,
        last_run_at: new Date().toISOString(),
      });
      processed.push({
        id: job.id,
        broker: job.broker,
        provider: job.provider,
        symbol: job.symbol,
        timeframe: job.timeframe,
        from: toIso(cursorFrom),
        to: toIso(chunkTo),
        nextCursor: complete ? null : toIso(nextCursor),
        status: complete ? "complete" : "active",
        candles: result.candles,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = Number(job.attempts ?? 0) + 1;
      await patchBackfillJob(config, job.id, {
        status: "error",
        attempts,
        last_error: message.slice(0, 1000),
        last_run_at: new Date().toISOString(),
      });
      processed.push({
        id: job.id,
        broker: job.broker,
        provider: job.provider,
        symbol: job.symbol,
        timeframe: job.timeframe,
        status: "error",
        error: message,
      });
    }
  }

  return {
    configured: true,
    requested: options.limit ?? 5,
    processed: processed.length,
    jobs: processed,
  };
}

export async function getHistoricalDataAvailability() {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      datasets: [] as MarketDataDatasetRow[],
    };
  }

  const query = new URLSearchParams({
    select: "broker,provider,source,symbol,timeframe,available_from,available_to,candle_count,last_ingested_at",
    order: "broker.asc,symbol.asc,timeframe.asc",
    limit: "200",
  });

  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.datasetTable}?${query.toString()}`, {
    headers: marketDataHeaders(config),
    cache: "no-store",
  }, { label: "Market data availability read" });

  if (!response.ok) {
    const text = await response.text();
    if (isMarketDataSchemaMissing(text)) {
      return {
        configured: false,
        datasets: [] as MarketDataDatasetRow[],
      };
    }
    throw new Error(`Market data availability read failed: ${text || response.status}`);
  }

  return {
    configured: true,
    datasets: ((await response.json()) as MarketDataDatasetRow[]).map((dataset) => {
      const availableFrom = dataset.available_from ? new Date(dataset.available_from).getTime() : null;
      return {
        ...dataset,
        available_from:
          availableFrom != null && Number.isFinite(availableFrom) && availableFrom < KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS
            ? KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_ISO
            : dataset.available_from,
      };
    }),
  };
}

export async function getStoredHistoricalCandles(options: {
  broker?: string;
  symbol: string;
  timeframe: string;
  from?: number;
  to?: number;
  limit?: number;
}) {
  const config = getMarketDataConfig();
  if (!config) {
    return {
      configured: false,
      candles: [] as HistoricalCandle[],
      source: "Historical data store not configured",
    };
  }

  const limit = Math.max(1, Math.min(options.limit ?? 5000, 500_000));
  const query = new URLSearchParams({
    select: "broker,provider,source,symbol,timeframe,timestamp,open,high,low,close,volume",
    symbol: `eq.${options.symbol.trim().toUpperCase()}`,
    timeframe: `eq.${options.timeframe.trim()}`,
    order: options.from || options.to ? "timestamp.asc" : "timestamp.desc",
    limit: String(limit),
  });

  if (options.broker?.trim()) {
    query.set("broker", `eq.${options.broker.trim()}`);
  }
  const from = Number.isFinite(options.from)
    ? Math.max(options.from as number, KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS)
    : KWANTIFY_MARKET_DATA_ARCHIVE_FLOOR_MS;
  query.append("timestamp", `gte.${toIso(from)}`);
  if (Number.isFinite(options.to)) {
    query.append("timestamp", `lte.${toIso(options.to as number)}`);
  }

  const response = await fetchWithRetry(`${config.supabaseUrl}/rest/v1/${config.candleTable}?${query.toString()}`, {
    headers: marketDataHeaders(config),
    cache: "no-store",
  }, { label: "Market candle read" });

  if (!response.ok) {
    const text = await response.text();
    if (isMarketDataSchemaMissing(text)) {
      return {
        configured: false,
        candles: [] as HistoricalCandle[],
        source: "Historical data store not configured",
      };
    }
    throw new Error(`Market candle read failed: ${text || response.status}`);
  }

  const rawRows = (await response.json()) as MarketDataCandleRow[];
  const rows = options.from || options.to ? rawRows : rawRows.reverse();
  const candles = rows.map((row) => ({
    timestamp: new Date(row.timestamp).getTime(),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume ?? 0),
  }));
  const first = rows[0];

  return {
    configured: true,
    candles,
    source: first ? `${first.broker}/${first.provider}` : "Stored historical data",
  };
}

export async function getHistoricalDataAvailabilitySummary() {
  try {
    const availability = await getHistoricalDataAvailability();
    if (!availability.configured) {
      return [
        "Historical market data store: not configured yet.",
        "Do not claim a strategy is data-backed until an ingestion job has populated the market-data tables.",
      ].join("\n");
    }

    if (!availability.datasets.length) {
      return [
        "Historical market data store: configured but empty.",
        "Do not claim a strategy is data-backed until candles exist for the requested broker, symbol, and timeframe.",
      ].join("\n");
    }

    const lines = availability.datasets.slice(0, 30).map((dataset) => {
      const range =
        dataset.available_from && dataset.available_to
          ? `${dataset.available_from.slice(0, 10)} -> ${dataset.available_to.slice(0, 10)}`
          : "range unknown";
      return `- ${dataset.broker}/${dataset.provider} ${dataset.symbol} ${dataset.timeframe}: ${dataset.candle_count ?? "?"} candles, ${range}`;
    });

    return [`Historical market data available:`, ...lines].join("\n");
  } catch (error) {
    return `Historical market data availability check failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}
