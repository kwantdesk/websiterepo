import { NextResponse } from "next/server";
import { getDatabentoBars, getDatabentoBarsWithOrderFlow } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export const preferredRegion = "iad1";

type HistoryCacheEntry = {
  candles: Awaited<ReturnType<typeof getDatabentoBars>>;
  updatedAt: number;
};

const globalHistoryCache = globalThis as typeof globalThis & {
  __kwantdeskCmeHistory?: Map<string, HistoryCacheEntry>;
};
const historyCache = globalHistoryCache.__kwantdeskCmeHistory
  ?? (globalHistoryCache.__kwantdeskCmeHistory = new Map<string, HistoryCacheEntry>());
const FRESH_CACHE_MS = 5 * 60_000;
const HISTORY_WINDOW_MS = 5 * 24 * 60 * 60_000;

export async function GET(request: Request) {
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  const includeOrderFlow = url.searchParams.get("orderFlow") === "1";
  if (!symbol || symbol.length > 90) {
    return NextResponse.json({ error: "A valid CME instrument is required." }, { status: 400 });
  }

  const now = Date.now();
  const earliest = now - HISTORY_WINDOW_MS;
  const start = new Date(earliest).toISOString();
  const cacheKey = `${symbol}::${timeframe}::${includeOrderFlow ? "flow" : "bars"}`;
  const cached = historyCache.get(cacheKey);

  if (cached && now - cached.updatedAt <= FRESH_CACHE_MS) {
    return NextResponse.json(
      { candles: cached.candles, source: "CME", dataset: "GLBX.MDP3", range: "5D", cached: true },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
    );
  }

  try {
    const candles = includeOrderFlow
      ? await getDatabentoBarsWithOrderFlow(symbol, timeframe, start, new Date(now).toISOString())
      : await getDatabentoBars(symbol, timeframe, start, new Date(now).toISOString());
    if (candles.length) historyCache.set(cacheKey, { candles, updatedAt: now });
    return NextResponse.json(
      { candles, source: "CME", dataset: "GLBX.MDP3", range: "5D", cached: false },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
    );
  } catch (error) {
    if (cached?.candles.length) {
      return NextResponse.json(
        { candles: cached.candles, source: "CME", dataset: "GLBX.MDP3", range: "5D", cached: true, stale: true },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message.replaceAll("Databento", "CME") : "CME history failed." },
      { status: 502 },
    );
  }
}
