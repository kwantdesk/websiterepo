import "server-only";

import {
  isOptionsFuturesRatioSane,
  OPTIONS_FLOW_INSTRUMENTS,
  type OptionsCandle,
  type OptionsFuturesRoot,
  type OptionsMarketData,
  type OptionsPriceMode,
} from "@/lib/optionsFlow";
import { resolveCashLevelOne } from "@/lib/optionsLevelOne.server";

type JsonRecord = Record<string, unknown>;
type FuturesProvider = "Rithmic" | "dxFeed";

const DEFAULT_TIMEOUT_MS = 6_000;
const LIVE_QUOTE_MAX_AGE_MS = 30_000;
const LIVE_CASH_BAR_MAX_AGE_MS = 3 * 60_000;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampMs(value: unknown): number | null {
  const numeric = finiteNumber(value);
  if (numeric !== null) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCandles(value: unknown): OptionsCandle[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<number, OptionsCandle>();

  for (const item of value) {
    if (!isRecord(item)) continue;
    const timestamp = timestampMs(item.timestamp ?? item.time ?? item.startTime);
    const open = finiteNumber(item.open ?? item.openPrice);
    const high = finiteNumber(item.high ?? item.highPrice);
    const low = finiteNumber(item.low ?? item.lowPrice);
    const close = finiteNumber(item.close ?? item.closePrice);
    const volume = finiteNumber(item.volume) ?? 0;
    if (timestamp === null || open === null || high === null || low === null || close === null) continue;
    if (open <= 0 || high < Math.max(open, close) || low > Math.min(open, close) || low <= 0) continue;
    deduped.set(timestamp, { timestamp, open, high, low, close, volume });
  }

  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-600);
}

function getGatewayConfig() {
  const requested = process.env.OPTIONS_FUTURES_FEED_PROVIDER?.trim().toLowerCase();
  const institutionalProvider = process.env.KWANTIFY_MARKET_DATA_PROVIDER?.trim().toLowerCase();
  const institutionalOrigin = process.env.KWANTIFY_MARKET_DATA_GATEWAY_URL
    ?.trim()
    .replace(/\/+$/, "") || null;
  const inferred = process.env.RITHMIC_MARKET_DATA_URL?.trim()
    ? "rithmic"
    : process.env.DXFEED_MARKET_DATA_URL?.trim()
      ? "dxfeed"
      : institutionalProvider === "rithmic" && institutionalOrigin
        ? "rithmic"
      : null;
  const providerKey = requested === "rithmic" || requested === "dxfeed" ? requested : inferred;
  const provider: FuturesProvider | null = providerKey === "rithmic" ? "Rithmic" : providerKey === "dxfeed" ? "dxFeed" : null;
  const endpoint = provider === "Rithmic"
    ? process.env.RITHMIC_MARKET_DATA_URL?.trim()
      || (institutionalOrigin ? `${institutionalOrigin}/v1/market-data/snapshot` : null)
    : provider === "dxFeed"
      ? process.env.DXFEED_MARKET_DATA_URL?.trim() || null
      : null;
  const token = provider === "Rithmic"
    ? process.env.RITHMIC_MARKET_DATA_TOKEN?.trim()
      || process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN?.trim()
      || null
    : provider === "dxFeed"
      ? process.env.DXFEED_MARKET_DATA_TOKEN?.trim() || null
      : null;
  const timeout = finiteNumber(process.env.OPTIONS_FUTURES_FEED_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;

  return {
    provider,
    endpoint,
    token,
    timeoutMs: Math.min(15_000, Math.max(1_000, timeout)),
  };
}

function unavailableCashFallback(args: {
  requestedMode: OptionsPriceMode;
  symbol: string;
  futuresRoot: OptionsFuturesRoot | null;
  cashPrice: number | null;
  cashAsOf: string | null;
  cashCandles: OptionsCandle[];
  cashMarketOpen: boolean;
  sourceLevels?: number[];
  detail?: string;
}): OptionsMarketData {
  const { requestedMode, symbol, futuresRoot, cashPrice, cashCandles, cashMarketOpen, detail } = args;
  const latestCandle = cashCandles.at(-1) ?? null;
  const lastPrice = cashPrice ?? latestCandle?.close ?? null;
  const asOfMs = latestCandle?.timestamp ?? Date.now();
  const stale = !cashMarketOpen || Date.now() - asOfMs > LIVE_CASH_BAR_MAX_AGE_MS;
  return {
    requestedMode,
    mode: "CASH",
    provider: "KwantData",
    status: !cashMarketOpen ? "LAST_SESSION" : stale ? "DELAYED" : "LIVE",
    symbol,
    futuresRoot,
    asOf: new Date(asOfMs).toISOString(),
    lastPrice,
    bid: null,
    ask: null,
    basisToOptionsUnderlying: null,
    levelPriceScale: 1,
    stale,
    fallback: requestedMode === "FUTURES",
    detail: detail ?? (cashMarketOpen ? "KwantData one-minute underlying bars via fast REST polling." : "Latest completed KwantData options session."),
    candles: cashCandles,
  };
}

async function requestFuturesSnapshot(args: {
  provider: FuturesProvider;
  endpoint: string;
  token: string | null;
  timeoutMs: number;
  root: OptionsFuturesRoot;
}) {
  const preferredContract = process.env[`OPTIONS_FLOW_${args.root}_CONTRACT`]?.trim() || args.root;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(args.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.token ? { Authorization: `Bearer ${args.token}` } : {}),
      },
      body: JSON.stringify({
        schemaVersion: "kwantify-market-data-v1",
        operation: "snapshot",
        root: args.root,
        symbol: preferredContract,
        interval: "1m",
        lookbackBars: 480,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload)) {
      throw new Error(`${args.provider} gateway returned HTTP ${response.status}.`);
    }
    const node = isRecord(payload.data) ? payload.data : payload;
    const quote = isRecord(node.quote) ? node.quote : node;
    const lastPrice = finiteNumber(quote.lastPrice ?? quote.last ?? quote.price);
    const bid = finiteNumber(quote.bid ?? quote.bidPrice);
    const ask = finiteNumber(quote.ask ?? quote.askPrice);
    const asOfMs = timestampMs(quote.asOf ?? quote.timestamp ?? quote.time ?? node.asOf);
    const candles = normalizeCandles(node.candles ?? node.bars);
    const symbol = typeof node.symbol === "string" && node.symbol.trim() ? node.symbol.trim().toUpperCase() : preferredContract;

    if (lastPrice === null || lastPrice <= 0 || asOfMs === null) {
      throw new Error(`${args.provider} gateway response is missing a valid last price or quote timestamp.`);
    }

    return { symbol, lastPrice, bid, ask, asOfMs, candles };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveOptionsMarketData(args: {
  symbol: string;
  requestedMode: OptionsPriceMode;
  cashPrice: number | null;
  cashAsOf: string | null;
  cashCandles: OptionsCandle[];
  cashMarketOpen: boolean;
  sourceLevels?: number[];
}): Promise<OptionsMarketData> {
  const instrument = OPTIONS_FLOW_INSTRUMENTS.find((item) => item.symbol === args.symbol);
  const futuresRoot = instrument?.futuresRoot ?? null;
  const levelTranslation = instrument?.levelTranslation ?? null;

  if (args.requestedMode !== "FUTURES") {
    const levelOne = await resolveCashLevelOne({
      symbol: args.symbol,
      cashCandles: args.cashCandles,
      cashMarketOpen: args.cashMarketOpen,
    });
    return levelOne ?? unavailableCashFallback({ ...args, futuresRoot });
  }

  if (!futuresRoot || !levelTranslation) {
    return unavailableCashFallback({ ...args, futuresRoot });
  }

  const config = getGatewayConfig();
  if (!config.provider || !config.endpoint) {
    return unavailableCashFallback({
      ...args,
      futuresRoot,
      detail: `${futuresRoot} futures requested. Checking the private Rithmic gateway; ${args.symbol} remains visible until a futures snapshot is confirmed.`,
    });
  }

  try {
    const snapshot = await requestFuturesSnapshot({
      provider: config.provider,
      endpoint: config.endpoint,
      token: config.token,
      timeoutMs: config.timeoutMs,
      root: futuresRoot,
    });
    const quoteAgeMs = Math.max(0, Date.now() - snapshot.asOfMs);
    const stale = quoteAgeMs > LIVE_QUOTE_MAX_AGE_MS;
    const cashAsOfMs = args.cashAsOf ? Date.parse(args.cashAsOf) : Number.NaN;
    const quotesConcurrent = Number.isFinite(cashAsOfMs)
      && Math.abs(snapshot.asOfMs - cashAsOfMs) <= 60_000;
    const scale = args.cashPrice !== null && args.cashPrice > 0
      ? snapshot.lastPrice / args.cashPrice
      : Number.NaN;
    const convertedLevels = (args.sourceLevels ?? [])
      .filter((level) => Number.isFinite(level) && level > 0)
      .map((level) => level * scale);
    const bracketed = convertedLevels.length < 2
      || (
        convertedLevels.some((level) => level <= snapshot.lastPrice)
        && convertedLevels.some((level) => level >= snapshot.lastPrice)
      );
    const transformIsSane = args.cashMarketOpen
      && quotesConcurrent
      && bracketed
      && isOptionsFuturesRatioSane(args.symbol, scale);

    if (!transformIsSane) {
      throw new Error(`${config.provider} ${snapshot.symbol} and ${args.symbol} do not provide a concurrent, sane calibration pair.`);
    }

    return {
      requestedMode: "FUTURES",
      mode: "FUTURES",
      provider: config.provider,
      status: stale ? "DELAYED" : "LIVE",
      symbol: snapshot.symbol,
      futuresRoot,
      asOf: new Date(snapshot.asOfMs).toISOString(),
      lastPrice: snapshot.lastPrice,
      bid: snapshot.bid,
      ask: snapshot.ask,
      basisToOptionsUnderlying: 0,
      levelPriceScale: scale,
      stale,
      fallback: false,
      detail: stale
        ? `${config.provider} quote is stale; a new options-level calibration was refused.`
        : `${config.provider} live futures quote. Options strikes use a concurrent, bounded ${futuresRoot}/${args.symbol} calibration ratio.`,
      candles: snapshot.candles,
    };
  } catch (error) {
    return unavailableCashFallback({
      ...args,
      futuresRoot,
      detail: `${config.provider} futures feed unavailable: ${error instanceof Error ? error.message : "unknown gateway error"} Showing ${args.symbol} from KwantData.`,
    });
  }
}


