import { NextRequest, NextResponse } from "next/server";

import { GEX_BOX_INSTRUMENTS } from "@/lib/gex-box/domain";
import { getNativeGexBoxReplay } from "@/lib/gex-box/native.server";
import { getQuantDataHttpError } from "@/lib/quantData.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const validTickers = new Set(GEX_BOX_INSTRUMENTS.map((item) => item.providerTicker));
const validViews = new Set(["classic", "state", "orderflow"]);

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "NQ_NDX").toUpperCase();
  const view = (request.nextUrl.searchParams.get("view") ?? "classic").toLowerCase();
  const category = (request.nextUrl.searchParams.get("category") ?? (view === "classic" ? "gex_full" : view === "state" ? "gamma" : "orderflow")).toLowerCase();
  const requestedDate = request.nextUrl.searchParams.get("date");
  if (!validTickers.has(ticker) || !validViews.has(view)) return NextResponse.json({ error: "Unsupported GEX BOX history request." }, { status: 400 });
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return NextResponse.json({ error: "History date must use YYYY-MM-DD." }, { status: 400 });
  try {
    const replay = await getNativeGexBoxReplay(view as "classic" | "state" | "orderflow", ticker, category, requestedDate);
    return NextResponse.json({
      ok: replay.ok,
      ticker,
      view,
      category,
      status: replay.status,
      date: replay.date,
      simulated: false,
      error: replay.error,
      frames: replay.frames,
      dataSource: replay.dataSource,
    }, {
      status: replay.ok ? 200 : 503,
      headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
    });
  } catch (error) {
    const response = getQuantDataHttpError(error);
    return NextResponse.json({ ok: false, ticker, view, category, status: "UNAVAILABLE", simulated: false, frames: [], error: response.message }, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
    });
  }
}
