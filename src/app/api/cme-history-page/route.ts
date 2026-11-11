import { chunkedJsonBody } from "@/lib/chunkedJsonBody";
import { NextResponse } from "next/server";
import { getChartInterval, isEventBasedChartInterval, supportsChartInterval } from "@/lib/chartIntervals";
import { getDatabentoOrderFlowHistory } from "@/lib/databento";
import { getDatabentoEventHistory } from "@/lib/databentoEventHistory.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 150;
export const preferredRegion = "iad1";

const DAY_MS = 86_400_000;
const PAGE_LIMIT = 50_000;
const SECONDS_PAGE_WINDOW_MS = 2 * DAY_MS;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const symbol = query.get("symbol") ?? "";
  const timeframe = query.get("timeframe") ?? "";
  const interval = getChartInterval(timeframe);
  const eventBased = isEventBasedChartInterval(timeframe);
  const before = Number(query.get("before"));
  const to = Number(query.get("to"));
  const now = Date.now();
  const from = Math.max(now - 120 * DAY_MS, Number(query.get("from")) || now - 30 * DAY_MS);
  if (!Number.isFinite(from) || !/^[A-Za-z0-9._-]{1,90}$/.test(symbol) || !supportsChartInterval(timeframe, "Databento")
    || (!eventBased && interval?.kind !== "second")
    || !Number.isSafeInteger(before) || !Number.isSafeInteger(to) || before <= 0 || to <= from || to > now + 60_000) {
    return NextResponse.json({ error: "Invalid chart-history page." }, { status: 400 });
  }

  try {
    // Event bars keep the archive's continuous seed. Restarting the fold from
    // an arbitrary page boundary would shift volume, range and Renko bars.
    const bucketMs = interval?.kind === "second" ? interval.value * 1_000 : 1;
    const secondsEnd = Math.min(before, to);
    const pageStart = eventBased ? from
      : Math.floor(Math.max(from, secondsEnd - SECONDS_PAGE_WINDOW_MS) / bucketMs) * bucketMs;
    const pageEnd = eventBased ? to : secondsEnd - 1;
    if (pageEnd < pageStart) {
      return NextResponse.json({ candles: [], nextBefore: null });
    }
    const start = new Date(pageStart).toISOString();
    const end = new Date(pageEnd).toISOString();
    const history = eventBased
      ? await getDatabentoEventHistory(symbol, timeframe, start, end, undefined, {
          limit: PAGE_LIMIT, beforeTimestamp: before, includeExecutions: false,
        })
      : await getDatabentoOrderFlowHistory(symbol, timeframe, start, end, { limit: PAGE_LIMIT });
    const candles = history.candles.filter((bar) => bar.timestamp < before);
    // An empty seconds window may be a weekend or a gap in the recording.
    // Advance through it without creating candles or treating it as the end.
    const nextBefore = candles.length === PAGE_LIMIT
      ? eventBased ? candles[0].sourceStartTimestamp ?? candles[0].timestamp : candles[0].timestamp
      : !eventBased && pageStart > from ? pageStart : null;
    return new Response(chunkedJsonBody(JSON.stringify({ candles, nextBefore, source: "VPS recorded live trades" })), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "The recorded history page could not load." }, { status: 502 });
  }
}
