import { NextRequest, NextResponse } from "next/server";

import { GEX_BOX_INSTRUMENTS } from "@/lib/gex-box/domain";
import { fetchGexBotTerminal } from "@/lib/gexBot.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const validTickers = new Set(GEX_BOX_INSTRUMENTS.map((item) => item.providerTicker));

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "NQ_NDX").toUpperCase();
  if (!validTickers.has(ticker)) return NextResponse.json({ error: "Unsupported GEX BOX history ticker." }, { status: 400 });
  // GEX BOX never substitutes generated preview frames for unavailable
  // provider history. A missing archive must remain an explicit unavailable
  // state in production.
  const envelope = await fetchGexBotTerminal("orderflow", ticker, "orderflow", true, false);
  return NextResponse.json({
    ok: envelope.ok,
    ticker,
    status: envelope.historyStatus,
    date: envelope.historyDate,
    simulated: envelope.historySimulated === true,
    error: envelope.historyError ?? envelope.error,
    frames: envelope.history ?? [],
    provider: envelope,
  }, {
    status: envelope.ok ? 200 : envelope.entitlementRequired ? 403 : 503,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
