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
export const maxDuration = 30;

const MAX_HISTORY_DAYS = 370;
const CBOE_VIX_HISTORY_START = Date.UTC(1990, 0, 1);

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
    try {
      if (isInstitutionalMarketDataConfigured()) {
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
      }
      const snapshots = await fetchMarketIndexSnapshots(symbols);
      const source = [...new Set(snapshots.map((snapshot) => snapshot.provider))].join(" + ") || "UNAVAILABLE";
      return NextResponse.json(
        {
          snapshots,
          source,
          asOf: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
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
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
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
