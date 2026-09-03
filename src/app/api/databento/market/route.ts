import { NextResponse } from "next/server";
import { conditionalJson } from "@/lib/conditionalJson";
import { logProviderError, providerErrorMessage } from "@/lib/providerErrorMessage";
import { unstable_cache } from "next/cache";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  getDatabentoBars,
  getDatabentoOrderFlowHistory,
  type DatabentoExecutionTuple,
} from "@/lib/databento";
import type { Candle } from "@/lib/backtester";
import {
  DEFAULT_CHART_HISTORY_CALENDAR_DAYS,
  hasMinimumChartHistory,
} from "@/lib/chartHistoryWindow";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import {
  getDatabentoEventBars,
  getDatabentoEventHistory,
  type DatabentoEventExecutionTuple,
} from "@/lib/databentoEventHistory.server";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

/*
 * What these bars actually are. They said GLBX.MDP3 while every one of them
 * was being read off the desk's own recorder - and the source field is the
 * first thing anyone checks when a number looks wrong, so a label naming a
 * provider we no longer buy this from is worse than no label at all.
 */
const RECORDED_DATASET = "Rithmic recorded trade tape";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

type HistoryCacheEntry = {
  candles: Candle[];
  executions: Array<DatabentoExecutionTuple | DatabentoEventExecutionTuple>;
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
const EVENT_HISTORY_CACHE_MS = 5 * 60_000;
const DEFAULT_HISTORY_DAYS = DEFAULT_CHART_HISTORY_CALENDAR_DAYS;
// Big Contracts can be asked for up to 30 days of executions. The ceiling has
// to match what the UI offers, or the setting silently tops out and the study
// shows nothing for the extra days. Payloads stay bounded by gzip on the wire
// and by the browser tape's own compaction once decoded.
const MAX_HISTORY_DAYS = 30;
const MAX_EXPLICIT_RANGE_MS = 4 * 24 * 60 * 60_000;
const MAX_EXPLICIT_LOOKBACK_MS = 120 * 24 * 60 * 60_000;
const HISTORICAL_SESSION_CACHE_MS = 6 * 60 * 60_000;
const DURABLE_EVENT_HISTORY_REVALIDATE_SECONDS = 5 * 60;
// Time bars form continuously. Reusing a five-minute-old durable order-flow
// payload leaves several closed candles missing at the live seam. Keep the
// expensive event-bar cache long-lived, but revalidate ordinary time bars at
// the same cadence as the process-local intraday cache.
const DURABLE_TIME_HISTORY_REVALIDATE_SECONDS = 12;

type EventHistoryPayload = Awaited<ReturnType<typeof getDatabentoEventHistory>>;
type TimeHistoryPayload = Awaited<ReturnType<typeof getDatabentoOrderFlowHistory>>;
type EventBarsPayload = {
  candles: Awaited<ReturnType<typeof getDatabentoEventBars>>;
  executions: DatabentoExecutionTuple[];
};

function encodeHistory(history: EventHistoryPayload | TimeHistoryPayload | EventBarsPayload) {
  return gzipSync(Buffer.from(JSON.stringify(history))).toString("base64");
}

function decodeHistory<T extends EventHistoryPayload | TimeHistoryPayload | EventBarsPayload>(encoded: string) {
  return JSON.parse(
    gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"),
  ) as T;
}

/**
 * Range and volume geometry is expensive to rebuild from ten days of
 * one-second CME history. Persist the base bars across serverless instances,
 * not only in the process-local map, so a cold Vercel worker does not make a
 * newly selected 40R/200V chart wait while the same tape is replayed again.
 * Live Rithmic executions continue the forming bar in the browser.
 */
async function getDurableEventBars(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope = `${historyDays}d`,
): Promise<EventBarsPayload> {
  const encoded = await unstable_cache(
    async () => {
      const candles = await getDatabentoEventBars(symbol, timeframe, start, end);
      if (candles.length < 2) {
        throw new Error("CME event history returned no historical bars.");
      }
      return encodeHistory({
        candles,
        executions: [] as DatabentoExecutionTuple[],
      });
    },
    ["cme-event-bars-v3", symbol, timeframe, cacheScope],
    { revalidate: DURABLE_EVENT_HISTORY_REVALIDATE_SECONDS },
  )();
  return decodeHistory<EventBarsPayload>(encoded);
}

/**
 * Event CVD is expensive because exact aggressor flow has to be folded into
 * range/volume/Renko boundaries. Store the compressed enriched result in
 * Next/Vercel's durable data cache so a cold serverless instance reuses work
 * completed by another instance instead of replaying the raw seven-day tape.
 * Compression keeps the cache record compact even for dense 40R charts.
 */
async function getDurableEventHistory(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope = `${historyDays}d`,
): Promise<EventHistoryPayload> {
  const encoded = await unstable_cache(
    async () => {
      const history = await getDatabentoEventHistory(symbol, timeframe, start, end);
      if (!history.candles.some((candle) =>
        Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0)) {
        throw new Error("CME event flow returned no aggressor history.");
      }
      return encodeHistory(history);
    },
    ["cme-event-flow-v3", symbol, timeframe, cacheScope],
    { revalidate: DURABLE_EVENT_HISTORY_REVALIDATE_SECONDS },
  )();
  return decodeHistory<EventHistoryPayload>(encoded);
}

async function getDurableTimeHistory(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope = `${historyDays}d`,
): Promise<TimeHistoryPayload> {
  const encoded = await unstable_cache(
    async () => {
      const history = await getDatabentoOrderFlowHistory(symbol, timeframe, start, end);
      if (!history.candles.some((candle) =>
        Number(candle.askVolume ?? 0) + Number(candle.bidVolume ?? 0) > 0)) {
        throw new Error("CME timed flow returned no aggressor history.");
      }
      return encodeHistory(history);
    },
    ["cme-time-flow-v3", symbol, timeframe, cacheScope],
    { revalidate: DURABLE_TIME_HISTORY_REVALIDATE_SECONDS },
  )();
  return decodeHistory<TimeHistoryPayload>(encoded);
}

async function durableEventHistoryOrDirect(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope?: string,
) {
  try {
    return await getDurableEventHistory(symbol, timeframe, historyDays, start, end, cacheScope);
  } catch (error) {
    // Local scripts and unusual runtimes can lack Next's incremental cache.
    // The data path must remain available there, while production still gains
    // the cross-instance durable cache above.
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return getDatabentoEventHistory(symbol, timeframe, start, end);
    }
    throw error;
  }
}

async function durableEventBarsOrDirect(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope?: string,
) {
  try {
    return await getDurableEventBars(symbol, timeframe, historyDays, start, end, cacheScope);
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return {
        candles: await getDatabentoEventBars(symbol, timeframe, start, end),
        executions: [] as DatabentoExecutionTuple[],
      };
    }
    throw error;
  }
}

async function durableTimeHistoryOrDirect(
  symbol: string,
  timeframe: string,
  historyDays: number,
  start: string,
  end: string,
  cacheScope?: string,
) {
  try {
    return await getDurableTimeHistory(symbol, timeframe, historyDays, start, end, cacheScope);
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return getDatabentoOrderFlowHistory(symbol, timeframe, start, end);
    }
    throw error;
  }
}

export async function GET(request: Request) {
  if (!vendorMarketDataConfigured("databento")) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  const includeOrderFlow = url.searchParams.get("orderFlow") === "1";
  // Flow-heal polling only needs the flow-baked candles; the multi-megabyte
  // execution tuple tape is skippable per request without a separate cache.
  const includeExecutions = includeOrderFlow && url.searchParams.get("exec") !== "0";
  const forceFresh = url.searchParams.get("fresh") === "1";
  const requestedFrom = Number(url.searchParams.get("from"));
  const requestedTo = Number(url.searchParams.get("to"));
  const hasExplicitRange = Number.isFinite(requestedFrom) && Number.isFinite(requestedTo)
    && requestedFrom > 0 && requestedTo > 0;
  const requestedDays = Number(url.searchParams.get("days") ?? DEFAULT_HISTORY_DAYS);
  // The floor used to be the ten-day default, so a caller asking for a SHORT
  // window silently received the full one. Event-based bars have to be built
  // from the raw tape, and a chart that wants one session for its first paint
  // was therefore made to wait for ten days of reconstruction before it could
  // show anything. A request for less history is now honoured.
  const historyDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(MAX_HISTORY_DAYS, Math.round(requestedDays)))
    : DEFAULT_HISTORY_DAYS;
  if (!symbol || symbol.length > 90) {
    return NextResponse.json({ error: "A valid CME instrument is required." }, { status: 400 });
  }

  const now = Date.now();
  if (hasExplicitRange && (
    requestedFrom >= requestedTo
    || requestedTo - requestedFrom > MAX_EXPLICIT_RANGE_MS
    || requestedFrom < now - MAX_EXPLICIT_LOOKBACK_MS
    || requestedTo > now + 60_000
  )) {
    return NextResponse.json(
      { error: "The requested CME replay window is outside the supported historical range." },
      { status: 400 },
    );
  }
  const fromMs = hasExplicitRange ? Math.round(requestedFrom) : now - historyDays * 24 * 60 * 60_000;
  const toMs = hasExplicitRange ? Math.min(now, Math.round(requestedTo)) : now;
  const start = new Date(fromMs).toISOString();
  const end = new Date(toMs).toISOString();
  const cacheScope = hasExplicitRange ? `range-${fromMs}-${toMs}` : `${historyDays}d`;
  const rangeLabel = hasExplicitRange ? `${start}/${end}` : `${historyDays}D`;
  const cacheKey = `${symbol}::${timeframe}::${cacheScope}::${includeOrderFlow ? "flow" : "bars"}`;
  const cached = historyCache.get(cacheKey);
  const cacheLifetime = hasExplicitRange
    ? HISTORICAL_SESSION_CACHE_MS
    : isEventBasedChartInterval(timeframe)
    ? EVENT_HISTORY_CACHE_MS
    : FRESH_CACHE_MS;

  /*
   * This is the largest response the platform serves - a full candle history
   * plus its execution tuples, megabytes of it - and the panes ask for it
   * repeatedly: on load, on every timeframe change, on tail reconciliation and
   * on the four-minute flow-heal loop, once per pane.
   *
   * It was `no-store`, so every one of those dragged the whole body out of
   * origin even when the server was answering from a cache entry it had
   * already sent. One month measured 795 GB of origin transfer at $61.69.
   *
   * The identity below changes exactly when the payload does, so an unchanged
   * surface comes back as a header-only 304. The browser is allowed to reuse
   * its copy for the REMAINING life of the server's own cache entry, never
   * longer: inside that window the server would hand back this same entry
   * anyway, so nothing older is ever shown than what a request would return.
   */
  const bodyIdentity = (cachedAt: number, extra = "") =>
    `${cacheKey}::${includeExecutions ? "exec" : "bars"}::${cachedAt}${extra}`;

  if (!forceFresh && cached && now - cached.updatedAt <= cacheLifetime) {
    return conditionalJson(
      request,
      {
        candles: cached.candles,
        executions: includeExecutions ? cached.executions : [],
        source: "CME",
        dataset: RECORDED_DATASET,
        range: rangeLabel,
        cached: true,
        cachedAt: cached.updatedAt,
      },
      {
        identity: bodyIdentity(cached.updatedAt),
        maxAgeMs: Math.max(0, cacheLifetime - (now - cached.updatedAt)),
      },
    );
  }

  try {
    const history = isEventBasedChartInterval(timeframe)
      ? includeOrderFlow
        ? await durableEventHistoryOrDirect(
            symbol,
            timeframe,
            historyDays,
            start,
            end,
            cacheScope,
          )
        : await durableEventBarsOrDirect(
            symbol,
            timeframe,
            historyDays,
            start,
            end,
            cacheScope,
          )
      : includeOrderFlow && !forceFresh
        ? await durableTimeHistoryOrDirect(
            symbol,
            timeframe,
            historyDays,
            start,
            end,
            cacheScope,
          )
        : {
            candles: await getDatabentoBars(symbol, timeframe, start, end),
            executions: [] as DatabentoExecutionTuple[],
          };
    const { candles, executions } = history;
    if (!hasExplicitRange && !hasMinimumChartHistory(candles, timeframe)) {
      throw new Error(
        `Rithmic has not recorded five complete trading sessions for ${symbol} ${timeframe}; partial candle history was rejected.`,
      );
    }
    if (candles.length) historyCache.set(cacheKey, { candles, executions, updatedAt: now });
    return conditionalJson(
      request,
      {
        candles,
        executions: includeExecutions ? executions : [],
        source: "CME",
        dataset: RECORDED_DATASET,
        range: rangeLabel,
        cached: false,
        cachedAt: now,
      },
      // Just stored as the cache entry for `cacheLifetime`, so that is exactly
      // how long the same request would be answered from it.
      { identity: bodyIdentity(now), maxAgeMs: cacheLifetime },
    );
  } catch (error) {
    if (cached?.candles.length) {
      return conditionalJson(
        request,
        {
          candles: cached.candles,
          executions: includeExecutions ? cached.executions : [],
          source: "CME",
          dataset: RECORDED_DATASET,
          range: rangeLabel,
          cached: true,
          stale: true,
          cachedAt: cached.updatedAt,
        },
        // Held past its lifetime because the provider failed. The body is still
        // worth a 304, but the browser must come back every time so it picks up
        // the moment the provider answers again.
        { identity: bodyIdentity(cached.updatedAt, "::stale"), maxAgeMs: 0 },
      );
    }
    logProviderError("cme-history", error);
    return NextResponse.json(
      { error: providerErrorMessage(error, "CME history") },
      { status: 502 },
    );
  }
}
