import { NextResponse } from "next/server";
import { DATABENTO_INSTRUMENTS, getBars, getLevelOne } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowed = new Set(DATABENTO_INSTRUMENTS.filter((item) => item.kind === "future").map((item) => item.symbol));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "bars";
  const symbols = (url.searchParams.get("symbols") ?? "").split(",").map((symbol) => symbol.trim()).filter((symbol) => allowed.has(symbol)).slice(0, 20);

  if (!process.env.DATABENTO_API_KEY) return NextResponse.json({ error: "Databento is not configured." }, { status: 503 });
  if (!symbols.length) return NextResponse.json({ error: "Select a supported futures contract." }, { status: 400 });

  try {
    if (kind === "snapshot") return NextResponse.json({ quotes: await getLevelOne(symbols), source: "Databento", delayed: false });

    const timeframe = url.searchParams.get("timeframe") ?? "5m";
    const start = url.searchParams.get("start") ?? new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString();
    const end = url.searchParams.get("end") ?? new Date().toISOString();
    return NextResponse.json({ candles: await getBars(symbols[0], timeframe, start, end), source: "Databento" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Databento request failed." }, { status: 502 });
  }
}
