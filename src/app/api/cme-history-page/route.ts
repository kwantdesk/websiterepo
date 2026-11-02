import { chunkedJsonBody } from "@/lib/chunkedJsonBody";
import { NextResponse } from "next/server";
import { isEventBasedChartInterval } from "@/lib/chartIntervals";
import { getDatabentoEventHistory } from "@/lib/databentoEventHistory.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 150;
export const preferredRegion = "iad1";

// Older pages keep the archive's continuous bar seed. Cutting a new tick
// window and starting again would shift every volume/range/Renko boundary.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const symbol = q.get("symbol") ?? "", timeframe = q.get("timeframe") ?? "";
  const before = Number(q.get("before")), to = Number(q.get("to"));
  const from = Math.max(Date.now() - 120 * 86400000, Number(q.get("from")) || Date.now() - 30 * 86400000);
  if (!/^[A-Za-z0-9._-]{1,90}$/.test(symbol) || !isEventBasedChartInterval(timeframe)
    || !Number.isFinite(before) || !Number.isFinite(to) || before <= 0 || to <= from || to > Date.now() + 60000) {
    return NextResponse.json({ error: "Invalid chart-history page." }, { status: 400 });
  }
  try {
    const history = await getDatabentoEventHistory(symbol, timeframe, new Date(from).toISOString(),
      new Date(to).toISOString(), undefined, { limit: 50000, beforeTimestamp: before, includeExecutions: false });
    return new Response(chunkedJsonBody(JSON.stringify({ candles: history.candles, source: "VPS recorded live trades" })), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The recorded history page could not load." }, { status: 502 });
  }
}
