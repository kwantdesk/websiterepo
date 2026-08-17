import { NextRequest, NextResponse } from "next/server";

import { GEX_BOX_INSTRUMENTS } from "@/lib/gex-box/domain";
import { fetchGexBotReplay } from "@/lib/gexBot.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const validTickers = new Set(GEX_BOX_INSTRUMENTS.map((item) => item.providerTicker));
const validViews = new Set(["classic", "state", "orderflow"]);

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "NQ_NDX").toUpperCase();
  const view = (request.nextUrl.searchParams.get("view") ?? "classic").toLowerCase();
  const category = (request.nextUrl.searchParams.get("category") ?? (view === "classic" ? "gex_full" : view === "state" ? "gamma" : "orderflow")).toLowerCase();
  const requestedDate = request.nextUrl.searchParams.get("date");
  if (!validTickers.has(ticker) || !validViews.has(view)) return NextResponse.json({ error: "Unsupported GEX BOX history request." }, { status: 400 });
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return NextResponse.json({ error: "History date must use YYYY-MM-DD." }, { status: 400 });
  // GEX BOX never substitutes generated preview frames for unavailable
  // provider history. A missing archive must remain an explicit unavailable
  // state in production.
  const replay = await fetchGexBotReplay(view as "classic" | "state" | "orderflow", ticker, category, requestedDate);
  return NextResponse.json({
    ok: replay.ok,
    ticker,
    view,
    category,
    status: replay.status,
    date: replay.date,
    simulated: replay.simulated,
    error: replay.error,
    frames: replay.frames,
  }, {
    status: replay.ok ? 200 : 503,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
