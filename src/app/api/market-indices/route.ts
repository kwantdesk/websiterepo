import { NextResponse } from "next/server";

import {
  fetchMarketIndexCandles,
  fetchMarketIndexSnapshots,
} from "@/lib/marketIndices.server";
import { getMarketIndexDefinition } from "@/lib/marketIndices";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_HISTORY_DAYS = 370;

export async function GET(request: Request) {
  if (!process.env.MASSIVE_API_KEY && !process.env.POLYGON_API_KEY) {
    return NextResponse.json(
      { error: "Market indices are not configured. Add MASSIVE_API_KEY in Vercel." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  if (url.searchParams.get("snapshot") === "1") {
    const symbols = (url.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol, index, rows) => Boolean(getMarketIndexDefinition(symbol)) && rows.indexOf(symbol) === index)
      .slice(0, 8);
    if (!symbols.length) {
      return NextResponse.json({ error: "At least one supported market index is required." }, { status: 400 });
    }
    try {
      const snapshots = await fetchMarketIndexSnapshots(symbols);
      return NextResponse.json(
        { snapshots, source: "CBOE", asOf: new Date().toISOString() },
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
    return NextResponse.json({ error: "A supported market index is required." }, { status: 400 });
  }
  const now = Date.now();
  const requestedFrom = Number(url.searchParams.get("from"));
  const requestedTo = Number(url.searchParams.get("to"));
  const earliest = now - MAX_HISTORY_DAYS * 24 * 60 * 60_000;
  const from = Number.isFinite(requestedFrom) ? Math.max(earliest, requestedFrom) : now - 8 * 24 * 60 * 60_000;
  const to = Number.isFinite(requestedTo) ? Math.min(now, requestedTo) : now;

  try {
    const candles = await fetchMarketIndexCandles({ symbol, timeframe, from, to });
    return NextResponse.json(
      { candles, symbol, source: "CBOE", from, to },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market-index history failed." },
      { status: 502 },
    );
  }
}

