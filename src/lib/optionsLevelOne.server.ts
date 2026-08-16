import "server-only";

import type { OptionsCandle, OptionsMarketData } from "@/lib/optionsFlow";
import {
  mergeCashLevelOneCandle,
  parseMassiveCashLevelOne,
} from "@/lib/optionsLevelOne";

const MASSIVE_API_BASE = "https://api.massive.com";
const CASH_LIVE_MAX_AGE_MS = 30_000;

function getMassiveApiKey() {
  return process.env.MASSIVE_API_KEY?.trim()
    || process.env.POLYGON_API_KEY?.trim()
    || "";
}

export async function resolveCashLevelOne(args: {
  symbol: string;
  cashCandles: OptionsCandle[];
  cashMarketOpen: boolean;
}): Promise<OptionsMarketData | null> {
  const apiKey = getMassiveApiKey();
  if (!apiKey) return null;

  const indexTicker = args.symbol === "SPX" || args.symbol === "SPXW"
    ? "I:SPX"
    : args.symbol === "NDX"
      ? "I:NDX"
      : null;
  const kind = indexTicker ? "INDEX" : "STOCK";
  const endpoint = indexTicker
    ? `${MASSIVE_API_BASE}/v3/snapshot/indices?ticker=${encodeURIComponent(indexTicker)}`
    : `${MASSIVE_API_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(args.symbol)}`;

  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const quote = parseMassiveCashLevelOne(args.symbol, kind, await response.json());
    if (!quote) return null;

    const ageMs = Math.max(0, Date.now() - quote.asOfMs);
    const marketOpen = args.cashMarketOpen && quote.marketOpen;
    const stale = !marketOpen || quote.delayed || ageMs > CASH_LIVE_MAX_AGE_MS;
    return {
      requestedMode: "CASH",
      mode: "CASH",
      provider: "Massive",
      status: !marketOpen ? "LAST_SESSION" : stale ? "DELAYED" : "LIVE",
      symbol: args.symbol,
      futuresRoot: null,
      asOf: new Date(quote.asOfMs).toISOString(),
      lastPrice: quote.lastPrice,
      bid: quote.bid,
      ask: quote.ask,
      basisToOptionsUnderlying: null,
      levelPriceScale: 1,
      stale,
      fallback: false,
      detail: kind === "INDEX"
        ? `${args.symbol} index value from Massive${quote.delayed ? " (delayed by the active data entitlement)" : " (real time)"}. Index values do not publish an exchange bid/ask.`
        : `${args.symbol} trade and NBBO from Massive${quote.delayed ? " (delayed by the active data entitlement)" : " (real time)"}.`,
      candles: mergeCashLevelOneCandle(args.cashCandles, quote),
    };
  } catch {
    return null;
  }
}

