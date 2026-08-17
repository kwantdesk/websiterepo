import "server-only";

import type { OptionsCandle, OptionsMarketData } from "@/lib/optionsFlow";
import {
  fetchInstitutionalMarketIndexSnapshots,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import {
  mergeCashLevelOneCandle,
  parseMassiveCashLevelOne,
} from "@/lib/optionsLevelOne";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
} from "@/lib/vendorMarketData.server";

const CASH_LIVE_MAX_AGE_MS = 30_000;

export async function resolveCashLevelOne(args: {
  symbol: string;
  cashCandles: OptionsCandle[];
  cashMarketOpen: boolean;
}): Promise<OptionsMarketData | null> {
  if (isInstitutionalMarketDataConfigured()) {
    try {
      const snapshot = (await fetchInstitutionalMarketIndexSnapshots([args.symbol], 3_000))[0];
      if (!snapshot) return null;
      const quote = {
        symbol: args.symbol,
        lastPrice: snapshot.lastPrice,
        bid: null,
        ask: null,
        asOfMs: snapshot.timestamp,
        delayed: snapshot.delayed,
        marketOpen: snapshot.marketOpen,
      };
      const ageMs = Math.max(0, Date.now() - quote.asOfMs);
      const marketOpen = args.cashMarketOpen && quote.marketOpen;
      const stale = !marketOpen || quote.delayed || ageMs > CASH_LIVE_MAX_AGE_MS;
      const provider: OptionsMarketData["provider"] = snapshot.provider === "Databento"
        ? "Databento"
        : snapshot.provider === "QuantData"
          ? "KwantData"
          : "Massive";
      return {
        requestedMode: "CASH",
        mode: "CASH",
        provider,
        status: !marketOpen ? "LAST_SESSION" : stale ? "DELAYED" : "LIVE",
        symbol: args.symbol,
        futuresRoot: null,
        asOf: new Date(quote.asOfMs).toISOString(),
        lastPrice: quote.lastPrice,
        bid: null,
        ask: null,
        basisToOptionsUnderlying: null,
        levelPriceScale: 1,
        stale,
        fallback: false,
        detail: `${args.symbol} cash reference from the shared ${snapshot.provider} VPS feed. Bid/ask is not carried by the shared index snapshot.`,
        candles: mergeCashLevelOneCandle(args.cashCandles, quote),
      };
    } catch {
      // When the shared gateway is configured, never open a second vendor
      // connection from Vercel. The caller's existing KwantData resilience
      // path remains responsible for a temporary gateway outage.
      return null;
    }
  }

  if (!vendorMarketDataConfigured("massive")) return null;

  const indexTicker = args.symbol === "SPX" || args.symbol === "SPXW"
    ? "I:SPX"
    : args.symbol === "NDX"
      ? "I:NDX"
      : null;
  const kind = indexTicker ? "INDEX" : "STOCK";
  const endpoint = indexTicker
    ? `/v3/snapshot/indices?ticker=${encodeURIComponent(indexTicker)}`
    : `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(args.symbol)}`;

  try {
    const response = await vendorMarketDataFetch("massive", endpoint, {
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
