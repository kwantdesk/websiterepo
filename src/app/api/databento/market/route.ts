import { NextResponse } from "next/server";
import {
  getDatabentoBars,
  getDatabentoOrderFlowHistory,
  type DatabentoExecutionTuple,
} from "@/lib/databento";
import type { Candle } from "@/lib/backtester";
import { DEFAULT_CHART_HISTORY_CALENDAR_DAYS } from "@/lib/chartHistoryWindow";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import { getDatabentoEventBars } from "@/lib/databentoEventHistory.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

type HistoryCacheEntry = {
  candles: Candle[];
  executions: DatabentoExecutionTuple[];
  updatedAt: number;
};

const globalHistoryCache = globalThis as typeof globalThis & {
  __kwantdeskCmeHistory?: Map<string, HistoryCacheEntry>;
};
const historyCache = globalHistoryCache.__kwantdeskCmeHistory
  ?? (globalHistoryCache.__kwantdeskCmeHistory = new Map<string, HistoryCacheEntry>());
// Intraday charts cannot reuse a five-minute-old tail: the live stream only
// builds the current bucket and would leave the intervening closed bars blank.
// A short process-local cache still deduplicates simultaneous pane requests.
const FRESH_CACHE_MS = 12_000;
const DEFAULT_HISTORY_DAYS = DEFAULT_CHART_HISTORY_CALENDAR_DAYS;
const MAX_HISTORY_DAYS = 14;

export async function GET(request: Request) {
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  const includeOrderFlow = url.searchParams.get("orderFlow") === "1";
  const requestedDays = Number(url.searchParams.get("days") ?? DEFAULT_HISTORY_DAYS);
  const historyDays = Number.isFinite(requestedDays)
    ? Math.max(DEFAULT_HISTORY_DAYS, Math.min(MAX_HISTORY_DAYS, Math.round(requestedDays)))
    : DEFAULT_HISTORY_DAYS;
  if (!symbol || symbol.length > 90) {
    return NextResponse.json({ error: "A valid CME instrument is required." }, { status: 400 });
  }

  const now = Date.now();
  const earliest = now - historyDays * 24 * 60 * 60_000;
  const start = new Date(earliest).toISOString();
  const cacheKey = `${symbol}::${timeframe}::${historyDays}d::${includeOrderFlow ? "flow" : "bars"}`;
  const cached = historyCache.get(cacheKey);

  if (cached && now - cached.updatedAt <= FRESH_CACHE_MS) {
    return NextResponse.json(
      {
        candles: cached.candles,
        executions: includeOrderFlow ? cached.executions : [],
        source: "CME",
        dataset: "GLBX.MDP3",
        range: `${historyDays}D`,
        cached: true,
        cachedAt: cached.updatedAt,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const end = new Date(now).toISOString();
    const history = isEventBasedChartInterval(timeframe)
      ? {
          candles: await getDatabentoEventBars(symbol, timeframe, start, end),
          executions: [] as DatabentoExecutionTuple[],
        }
      : includeOrderFlow
        ? await getDatabentoOrderFlowHistory(symbol, timeframe, start, end)
        : {
            candles: await getDatabentoBars(symbol, timeframe, start, end),
            executions: [] as DatabentoExecutionTuple[],
          };
    const { candles, executions } = history;
    if (candles.length) historyCache.set(cacheKey, { candles, executions, updatedAt: now });
    return NextResponse.json(
      {
        candles,
        executions,
        source: "CME",
        dataset: "GLBX.MDP3",
        range: `${historyDays}D`,
        cached: false,
        cachedAt: now,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    if (cached?.candles.length) {
      return NextResponse.json(
        {
          candles: cached.candles,
          executions: includeOrderFlow ? cached.executions : [],
          source: "CME",
          dataset: "GLBX.MDP3",
          range: `${historyDays}D`,
          cached: true,
          stale: true,
          cachedAt: cached.updatedAt,
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message.replaceAll("Databento", "CME") : "CME history failed." },
      { status: 502 },
    );
  }
}
