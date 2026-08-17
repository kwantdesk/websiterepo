import { NextRequest, NextResponse } from "next/server";

import { GEX_BOX_INSTRUMENTS } from "@/lib/gex-box/domain";
import { normalizeGexBotEnvelope } from "@/lib/gex-box/normalize";
import { fetchGexBotTerminal } from "@/lib/gexBot.server";
import type { GexBotProfileFrame } from "@/lib/gexBotTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const validTickers = new Set(GEX_BOX_INSTRUMENTS.map((item) => item.providerTicker));
const validViews = new Set(["classic", "state", "orderflow"]);

export async function GET(request: NextRequest) {
  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "NQ_NDX").toUpperCase();
  const view = (request.nextUrl.searchParams.get("view") ?? "classic").toLowerCase();
  const category = (request.nextUrl.searchParams.get("category") ?? (view === "classic" ? "gex_full" : "gamma")).toLowerCase();
  if (!validTickers.has(ticker) || !validViews.has(view)) return NextResponse.json({ error: "Unsupported GEX BOX snapshot request." }, { status: 400 });
  const envelope = await fetchGexBotTerminal(view as "classic" | "state" | "orderflow", ticker, category, false);
  const frame = view === "orderflow"
    ? null
    : normalizeGexBotEnvelope(envelope as typeof envelope & { frame: GexBotProfileFrame | null });
  return NextResponse.json({ ok: envelope.ok, frame, provider: envelope, error: envelope.error }, {
    status: envelope.ok ? 200 : envelope.entitlementRequired ? 403 : 503,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}
