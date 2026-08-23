import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  DATABENTO_FUTURES,
  getDatabentoBars,
  getDatabentoOrderFlowHistory,
  type DatabentoExecutionTuple,
} from "@/lib/databento";
import { isEventBasedChartInterval, supportsChartInterval } from "@/lib/chartIntervals";
import {
  getDatabentoEventHistory,
  type DatabentoEventExecutionTuple,
} from "@/lib/databentoEventHistory.server";
import {
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

const EARLIEST_CME_HISTORY_MS = Date.parse("2010-06-06T00:00:00.000Z");
const MAX_REQUEST_MS = 9 * 24 * 60 * 60_000;
const RECENT_MARKET_WINDOW_MS = 48 * 60 * 60_000;

type ReplayCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  trades?: number;
  bidVolume?: number;
  askVolume?: number;
  delta?: number;
  deltaOpen?: number;
  deltaHigh?: number;
  deltaLow?: number;
  deltaClose?: number;
  sourceStartTimestamp?: number;
  sourceEndTimestamp?: number;
};

type ReplayExecutionTuple = DatabentoExecutionTuple | DatabentoEventExecutionTuple;

function validCandles(value: unknown): ReplayCandle[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is ReplayCandle => {
    if (!candidate || typeof candidate !== "object") return false;
    const candle = candidate as Record<string, unknown>;
    return ["timestamp", "open", "high", "low", "close"]
      .every((key) => Number.isFinite(Number(candle[key])));
  }).map((candle) => ({
    ...candle,
    timestamp: Number(candle.timestamp),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  }));
}

function mergeCandles(...sources: ReplayCandle[][]) {
  const merged = new Map<number, ReplayCandle>();
  sources.flat().forEach((candle) => merged.set(candle.timestamp, candle));
  return [...merged.values()].sort((left, right) => left.timestamp - right.timestamp);
}

async function recentTickerPlantBars(symbol: string, start: number, end: number) {
  if (!isInstitutionalMarketDataConfigured()) return [];
  try {
    // The archive uses Databento continuous symbols (NQ.v.0), while the
    // Rithmic gateway resolves the live front contract from its root (NQ).
    const root = symbol.split(".")[0] || symbol;
    const params = new URLSearchParams({
      symbol: root,
      interval: "1m",
      fromMs: String(start),
      toMs: String(end),
    });
    const response = await fetchInstitutionalMarketData(
      `/v1/market-data/order-flow-levels?${params.toString()}`,
      { method: "GET" },
      8_000,
    );
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null) as { candles?: unknown } | null;
    return validCandles(payload?.candles);
  } catch {
    return [];
  }
}

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!vendorMarketDataConfigured("databento")) {
    return NextResponse.json({ error: "CME replay data is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "").trim();
  const timeframe = (request.nextUrl.searchParams.get("timeframe") || "1m").trim();
  const requestedStart = Date.parse(request.nextUrl.searchParams.get("start") || "");
  const requestedEnd = Date.parse(request.nextUrl.searchParams.get("end") || "");
  const orderFlowRequested = request.nextUrl.searchParams.get("orderFlow") === "1";
  const executionsRequested = request.nextUrl.searchParams.get("executions") !== "0";
  // Where the replay's execution tape should begin. A replay window reaches a
  // day past the session so the forming bar is covered, so a tape anchored to
  // the window's END sits well after the moment the trader hits play.
  const requestedExecutionStart = Number(request.nextUrl.searchParams.get("executionStart"));
  const instrument = DATABENTO_FUTURES.find((candidate) =>
    candidate.kind === "future" && candidate.symbol.toUpperCase() === symbol.toUpperCase());

  if (!instrument) {
    return NextResponse.json({ error: "A valid CME futures instrument is required." }, { status: 400 });
  }
  if (!supportsChartInterval(timeframe, "Databento")) {
    return NextResponse.json({ error: "That replay timeframe is not supported." }, { status: 400 });
  }
  const end = Math.min(requestedEnd, Date.now());
  if (!Number.isFinite(requestedStart) || !Number.isFinite(end) || requestedStart < EARLIEST_CME_HISTORY_MS || end <= requestedStart) {
    return NextResponse.json({ error: "A valid historical replay window is required." }, { status: 400 });
  }
  // A date/time change must never strand the user behind a request-window
  // error. Keep the newest permitted context and serve the replay normally.
  const start = Math.max(requestedStart, end - MAX_REQUEST_MS);

  try {
    let archiveCandles: ReplayCandle[] = [];
    let executions: ReplayExecutionTuple[] = [];
    let archiveError: unknown = null;
    try {
      const startIso = new Date(start).toISOString();
      const endIso = new Date(end).toISOString();
      if (orderFlowRequested) {
        const history = isEventBasedChartInterval(timeframe)
          ? await getDatabentoEventHistory(
            instrument.symbol,
            timeframe,
            startIso,
            endIso,
            Number.isFinite(requestedExecutionStart) && requestedExecutionStart > 0
              ? requestedExecutionStart
              : undefined,
          )
          : await getDatabentoOrderFlowHistory(instrument.symbol, timeframe, startIso, endIso);
        archiveCandles = validCandles(history.candles);
        executions = executionsRequested ? history.executions : [];
      } else {
        archiveCandles = validCandles(await getDatabentoBars(
          instrument.symbol,
          timeframe,
          startIso,
          endIso,
        ));
      }
    } catch (error) {
      archiveError = error;
    }

    const recentRequest = end >= Date.now() - RECENT_MARKET_WINDOW_MS;
    const newestArchiveBar = archiveCandles.at(-1)?.timestamp ?? 0;
    const needsRecentTail = recentRequest
      && !orderFlowRequested
      && timeframe === "1m"
      && newestArchiveBar < end - 2 * 60_000;
    const tickerPlantCandles = needsRecentTail
      ? await recentTickerPlantBars(instrument.symbol, start, end)
      : [];
    const candles = mergeCandles(archiveCandles, tickerPlantCandles);
    if (!candles.length) {
      if (archiveError) throw archiveError;
      return NextResponse.json({ error: "No CME candles were returned for this replay window." }, { status: 422 });
    }
    return NextResponse.json({
      symbol: instrument.symbol,
      timeframe,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      dataset: "GLBX.MDP3",
      candles,
      executions,
      orderFlow: {
        requested: orderFlowRequested,
        ready: !orderFlowRequested || candles.some((candle) =>
          Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0),
        source: orderFlowRequested ? "historical-executions" : "bars",
        semantics: orderFlowRequested
          ? "Exchange executions classified by aggressor side; replay-clock clipped in the browser."
          : "OHLCV bars only.",
      },
      recentTail: tickerPlantCandles.length ? "ticker-plant" : "archive",
      coverage: {
        earliestDocumented: "2010-06-06",
        note: "Actual availability depends on the Databento account entitlement and selected schema.",
      },
    }, {
      headers: {
        "Cache-Control": recentRequest
          ? "private, no-store, max-age=0"
          : "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? error.message.replaceAll("Databento", "CME")
        : "CME replay history could not be loaded.",
    }, { status: 502 });
  }
}
