import { supportsChartInterval } from "@/lib/chartIntervals";
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
import { conditionalJson } from "@/lib/conditionalJson";
import { getQuantDataHttpError } from "@/lib/quantData.server";
import { getMarketIndexDefinition } from "@/lib/marketIndices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Read only the recorded archive for candles.
export const maxDuration = 30;

const MAX_HISTORY_DAYS = 370;
const CBOE_VIX_HISTORY_START = Date.UTC(1990, 0, 1);

// Every open chart polls snapshots; a short instance cache collapses those
// bursts into one provider pass so the KwantData fallback cannot burn quota.
const snapshotCache = new Map<string, { expiresAt: number; payload: unknown }>();
const SNAPSHOT_CACHE_TTL_MS = 10_000;

/*
 * A completed bar series does not change, and the newest bar of a live one
 * only moves when its interval closes. Ten seconds is short enough that a
 * forming bar is never visibly behind, and long enough to collapse the burst
 * of identical requests several panes make on load.
 */
const INDEX_HISTORY_MAX_AGE_MS = 10_000;

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
      /*
       * The ticker polls every four seconds against a ten-second server cache,
       * so most requests were being answered with a full re-send of a body the
       * browser already had. Reusing it for the rest of that entry's life is
       * exactly what the server would return anyway.
       */
      const asOf = (cached.payload as { asOf?: string }).asOf ?? "";
      return conditionalJson(request, cached.payload, {
        identity: `${cacheKey}::${asOf}`,
        maxAgeMs: Math.max(0, cached.expiresAt - Date.now()),
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
          return conditionalJson(request, payload, {
            // Passed straight through from the collector, so its own asOf is
            // the only honest identity. Without one it must never match.
            identity: `vps-snapshot::${cacheKey}::${
              (payload as { asOf?: string } | null)?.asOf ?? Date.now()
            }`,
            maxAgeMs: 0,
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
      return conditionalJson(request, payload, {
        identity: `${cacheKey}::${payload.asOf}`,
        maxAgeMs: snapshots.length ? SNAPSHOT_CACHE_TTL_MS : 0,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Market-index snapshot failed." },
        { status: 502 },
      );
    }
  }

  const symbol = url.searchParams.get("symbol")?.trim().toUpperCase() ?? "";
  /*
   * A bar series for a fixed window does not change once its last bar closes,
   * so the newest bar's timestamp and the bar count together say everything
   * about whether the client's copy is still the right answer.
   */
  const historyIdentity = (rows: Array<{ timestamp?: number }>) => [
    symbol, timeframe, from, to, rows.length, rows.at(-1)?.timestamp ?? "",
  ].join("::");

  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  if (!getMarketIndexDefinition(symbol)) {
    return NextResponse.json({ error: "A supported market instrument is required." }, { status: 400 });
  }
  if (!supportsChartInterval(timeframe, "Market Index", symbol)) {
    return NextResponse.json({ error: "This instrument has no recorded data at the selected interval." }, { status: 400 });
  }
  const now = Date.now();
  const requestedFrom = Number(url.searchParams.get("from") ?? NaN);
  const requestedTo = Number(url.searchParams.get("to") ?? NaN);
  const usingCboeVixArchive = symbol === "VIX" && !hasIntradayMarketIndexHistoryAccess();
  const earliest = usingCboeVixArchive
    ? CBOE_VIX_HISTORY_START
    : now - MAX_HISTORY_DAYS * 24 * 60 * 60_000;
  const from = Number.isFinite(requestedFrom) ? Math.max(earliest, requestedFrom) : now - 8 * 24 * 60 * 60_000;
  const to = Number.isFinite(requestedTo) ? Math.min(now, requestedTo) : now;

  if (from > to) {
    return NextResponse.json({ error: "Invalid chart history range." }, { status: 400 });
  }

  try {
    const candles = await fetchMarketIndexCandles({ symbol, timeframe, from, to });
    return conditionalJson(
      request,
      {
        candles,
        historyCoverage: candles.historyCoverage,
        symbol,
        source: "VPS recorded live quotes",
        from,
        to,
      },
      {
        identity: `${historyIdentity(candles)}::${Boolean(candles.historyCoverage?.partial)}`,
        maxAgeMs: INDEX_HISTORY_MAX_AGE_MS,
      },
    );
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    const status = problem.status >= 500 ? 503 : problem.status;
    return NextResponse.json(
      { error: status === 503 ? "Recorded chart history is temporarily unavailable." : problem.message },
      { status },
    );
  }
}
