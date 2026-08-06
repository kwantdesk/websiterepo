import { NextRequest, NextResponse } from "next/server";

import { fetchGexBotTerminal } from "@/lib/gexBot.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TICKERS = new Set(["NDX", "QQQ", "SPX", "SPY", "RUT", "IWM", "VIX"]);
const CLASSIC_CATEGORIES = new Set(["full", "gex_full", "zero", "gex_zero", "one", "gex_one"]);
const STATE_CATEGORIES = new Set([
  "gex_full", "gex_one", "gex_zero",
  "charm", "charm_one", "charm_zero", "delta", "delta_one", "delta_zero",
  "gamma", "gamma_one", "gamma_zero", "onecharm", "onedelta", "onegamma",
  "onevanna", "vanna", "vanna_one", "vanna_zero",
]);

export async function GET(request: NextRequest) {
  const viewParam = request.nextUrl.searchParams.get("view")?.toLowerCase() ?? "classic";
  const ticker = request.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "NDX";
  const categoryParam = request.nextUrl.searchParams.get("category")?.toLowerCase();
  const includeHistory = request.nextUrl.searchParams.get("history") === "1";
  if (viewParam !== "classic" && viewParam !== "state" && viewParam !== "orderflow") {
    return NextResponse.json({ error: "Unsupported GEXBot view." }, { status: 400 });
  }
  if (!TICKERS.has(ticker)) {
    return NextResponse.json({ error: "Unsupported GEXBot ticker." }, { status: 400 });
  }

  const category = viewParam === "orderflow"
    ? "orderflow"
    : categoryParam ?? (viewParam === "classic" ? "gex_full" : "gamma");
  const validCategory = viewParam === "classic"
    ? CLASSIC_CATEGORIES.has(category)
    : viewParam === "state"
      ? STATE_CATEGORIES.has(category)
      : category === "orderflow";
  if (!validCategory) {
    return NextResponse.json({ error: "Unsupported GEXBot category." }, { status: 400 });
  }

  const payload = await fetchGexBotTerminal(viewParam, ticker, category, includeHistory);
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : payload.entitlementRequired ? 403 : 503,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie",
    },
  });
}
