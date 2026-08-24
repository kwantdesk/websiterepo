import { NextResponse } from "next/server";

import {
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import {
  fetchMarketIndexCandles,
  fetchMarketIndexSnapshots,
  hasIntradayMarketIndexHistoryAccess,
} from "@/lib/marketIndices.server";
import { getMarketIndexDefinition } from "@/lib/marketIndices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// A single COLD session restore from the underlying-history provider was
// measured at 33 seconds; a multi-day (5D) request walks several sessions.
// With the previous 30s ceiling Vercel killed exactly those cold restores, so
// charts never received the provider's real OHLC and silently kept their
// locally cached quote-built candles — bars with no wicks that looked nothing
// like the true session (the "suspicious historical data" report). Same
// failure class and fix as the zero-gamma-line route.
export const maxDuration = 300;

const MAX_HISTORY_DAYS = 370;
const CBOE_VIX_HISTORY_START = Date.UTC(1990, 0, 1);

// Every open chart polls snapshots; a short instance cache collapses those
// bursts into one provider pass so the KwantData fallback cannot burn quota.
const snapshotCache = new Map<string, { expiresAt: number; payload: unknown }>();
const SNAPSHOT_CACHE_TTL_MS = 10_000;

type IndexHistoryCandle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function indexHistoryCandles(payload: unknown): IndexHistoryCandle[] {
  if (!isRecord(payload) || !Array.isArray(payload.candles)) return [];
  return payload.candles.flatMap((value): IndexHistoryCandle[] => {
    if (!isRecord(value)) return [];
    const timestamp = Number(value.timestamp);
    const open = Number(value.open);
    const high = Number(value.high);
    const low = Number(value.low);
    const close = Number(value.close);
    const volume = Number(value.volume ?? 0);
    if (![timestamp, open, high, low, close].every(Number.isFinite)) return [];
    return [{ timestamp, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 }];
  });
}

function newYorkDateKey(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function newYorkCashSessionHasStarted(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const weekday = part("weekday");
  const minute = Number(part("hour")) * 60 + Number(part("minute"));
  return weekday !== "Sat" && weekday !== "Sun" && minute >= 9 * 60 + 30;
}

function needsCurrentSessionRepair(candles: IndexHistoryCandle[], from: number, to: number, now: number) {
  if (!newYorkCashSessionHasStarted(now)) return false;
  const today = newYorkDateKey(now);
  if (newYorkDateKey(to) !== today || from >= now) return false;
  const latest = candles.at(-1);
  return !latest || newYorkDateKey(latest.timestamp) !== today;
}

function mergeIndexHistoryCandles(...groups: IndexHistoryCandle[][]) {
  return [...new Map(
    groups.flat().map((candle) => [candle.timestamp, candle] as const),
  ).values()].sort((left, right) => left.timestamp - right.timestamp);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("snapshot") === "1") {
    const symbols = (url.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol, index, rows) => Boolean(getMarketIndexDefinition(symbol)) && rows.indexOf(symbol) === index)
      .slice(0, 24);
    if (!symbols.length) {
      return NextResponse.json({ error: "At least one supported market instrument is required." }, { status: 400 });
    }
    const cacheKey = symbols.join(",");
    const cached = snapshotCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.payload, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    try {
      if (isInstitutionalMarketDataConfigured()) {
        try {
          const upstream = await fetchInstitutionalMarketData(
            `v1/market-data/index-snapshot?symbols=${encodeURIComponent(symbols.join(","))}`,
            { method: "GET" },
            10_000,
          );
          const payload = await upstream.json().catch(() => null) as unknown;
          if (!upstream.ok) {
            const message = payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: unknown }).error || "VPS index snapshot failed.")
              : "VPS index snapshot failed.";
            throw new Error(message);
          }
          return NextResponse.json(payload, {
            headers: { "Cache-Control": "private, no-store, max-age=0" },
          });
        } catch {
          // The VPS stream lost its Massive entitlement. Local providers
          // (KwantData underlyings, official Cboe VIX EOD) take over below
          // instead of returning the upstream failure to every chart.
        }
      }
      const snapshots = await fetchMarketIndexSnapshots(symbols);
      const source = [...new Set(snapshots.map((snapshot) => snapshot.provider))].join(" + ") || "UNAVAILABLE";
      const payload = {
        snapshots,
        source,
        asOf: new Date().toISOString(),
      };
      if (snapshots.length) {
        if (snapshotCache.size > 32) {
          for (const [key, entry] of snapshotCache) if (entry.expiresAt <= Date.now()) snapshotCache.delete(key);
        }
        snapshotCache.set(cacheKey, { expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS, payload });
      }
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Market-index snapshot failed." },
        { status: 502 },
      );
    }
  }

  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  if (!getMarketIndexDefinition(symbol)) {
    return NextResponse.json({ error: "A supported market instrument is required." }, { status: 400 });
  }
  const now = Date.now();
  const requestedFrom = Number(url.searchParams.get("from"));
  const requestedTo = Number(url.searchParams.get("to"));
  const usingCboeVixArchive = symbol === "VIX" && !hasIntradayMarketIndexHistoryAccess();
  const earliest = usingCboeVixArchive
    ? CBOE_VIX_HISTORY_START
    : now - MAX_HISTORY_DAYS * 24 * 60 * 60_000;
  const from = Number.isFinite(requestedFrom) ? Math.max(earliest, requestedFrom) : now - 8 * 24 * 60 * 60_000;
  const to = Number.isFinite(requestedTo) ? Math.min(now, requestedTo) : now;

  try {
    const definition = getMarketIndexDefinition(symbol);
    if (definition?.providerKind === "INDEX" && isInstitutionalMarketDataConfigured()) {
      try {
        const params = new URLSearchParams({
          symbol,
          timeframe,
          from: String(from),
          to: String(to),
        });
        const upstream = await fetchInstitutionalMarketData(
          `v1/market-data/index-history?${params.toString()}`,
          { method: "GET" },
          20_000,
        );
        const payload = await upstream.json().catch(() => null) as unknown;
        if (!upstream.ok) {
          const message = payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error || "VPS index history failed.")
            : "VPS index history failed.";
          throw new Error(message);
        }
        let responsePayload = payload;
        const historicalCandles = indexHistoryCandles(payload);
        if (needsCurrentSessionRepair(historicalCandles, from, to, now)) {
          // Massive can return completed sessions but omit today's NDX bars
          // when a multi-day aggregate crosses a weekend. The same provider
          // returns the live session correctly when it is requested alone.
          // Repair that stale tail here so the chart does not jump from
          // Friday history to only the few quote-built candles held by the
          // browser.
          try {
            const today = newYorkDateKey(now);
            const currentSessionFrom = Date.parse(`${today}T00:00:00.000Z`);
            const currentParams = new URLSearchParams({
              symbol,
              timeframe,
              from: String(currentSessionFrom),
              to: String(to),
            });
            const currentUpstream = await fetchInstitutionalMarketData(
              `v1/market-data/index-history?${currentParams.toString()}`,
              { method: "GET" },
              20_000,
            );
            const currentPayload = await currentUpstream.json().catch(() => null) as unknown;
            let currentCandles = currentUpstream.ok ? indexHistoryCandles(currentPayload) : [];
            if (!currentCandles.length) {
              currentCandles = (await fetchMarketIndexCandles({
                symbol,
                timeframe,
                from: currentSessionFrom,
                to,
              })).map((candle) => ({ ...candle, volume: candle.volume ?? 0 }));
            }
            if (currentCandles.length && isRecord(payload)) {
              responsePayload = {
                ...payload,
                candles: mergeIndexHistoryCandles(historicalCandles, currentCandles),
                source: `${String(payload.source || "VPS index history")} + current session`,
              };
            }
          } catch {
            // Keep the valid completed-session history. The local provider
            // chain below remains the fallback when the primary request
            // itself fails.
          }
        }
        return NextResponse.json(responsePayload, {
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        });
      } catch {
        // The VPS history proxy lost its Massive entitlement. Fall through to
        // the local provider chain — KwantData session history for options
        // underlyings and the official Cboe archive for VIX — instead of
        // handing the chart the upstream refusal.
      }
    }
    const candles = await fetchMarketIndexCandles({ symbol, timeframe, from, to });
    return NextResponse.json(
      {
        candles,
        symbol,
        source: symbol === "VIX" && !hasIntradayMarketIndexHistoryAccess()
          ? "CBOE EOD"
          : "US market data",
        from,
        to,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market-index history failed." },
      { status: 502 },
    );
  }
}
