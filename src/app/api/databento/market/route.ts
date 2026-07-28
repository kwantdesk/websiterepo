import { NextResponse } from "next/server";
import { getDatabentoBars } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "Databento is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol")?.trim();
  const timeframe = url.searchParams.get("timeframe")?.trim() || "5m";
  if (!symbol || symbol.length > 90) {
    return NextResponse.json({ error: "A valid Databento instrument is required." }, { status: 400 });
  }

  const now = Date.now();
  const earliest = now - 7 * 24 * 60 * 60_000;
  const requestedStart = Date.parse(url.searchParams.get("start") ?? "");
  const start = new Date(Number.isFinite(requestedStart) ? Math.max(earliest, requestedStart) : earliest).toISOString();

  try {
    const candles = await getDatabentoBars(symbol, timeframe, start, new Date(now).toISOString());
    return NextResponse.json(
      { candles, source: "Databento", dataset: "GLBX.MDP3", range: "1W" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Databento history failed." },
      { status: 502 },
    );
  }
}
