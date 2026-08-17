import { NextRequest, NextResponse } from "next/server";

import { GEX_BOX_INSTRUMENTS } from "@/lib/gex-box/domain";
import { parseGexResearchCommand } from "@/lib/gex-box/research";
import { fetchGexBotTerminal } from "@/lib/gexBot.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const providerTicker = (symbol: string) => symbol === "NQ" ? "NQ_NDX" : symbol === "ES" ? "ES_SPX" : symbol;

export async function GET(request: NextRequest) {
  const command = request.nextUrl.searchParams.get("command") ?? "";
  try {
    const parsed = parseGexResearchCommand(command);
    const ticker = providerTicker(parsed.symbol);
    const supported = GEX_BOX_INSTRUMENTS.some((instrument) => instrument.id === ticker || instrument.underlyingSymbol === parsed.symbol);
    if (!supported) {
      return NextResponse.json({ ok: false, request: parsed, error: `${parsed.symbol} is not in the connected GEX BOX instrument catalog.` }, { status: 422 });
    }
    if (parsed.view !== "profile" || parsed.dteMin !== 0 || parsed.dteMax !== 90 || parsed.calls !== "all" || parsed.puts !== "all" || !parsed.combine) {
      return NextResponse.json({
        ok: false,
        request: parsed,
        error: "The connected aggregate provider frame currently supports profile view, dte=0..90, calls=all, puts=all, combine=true. The request was rejected rather than silently approximated.",
      }, { status: 422 });
    }
    const category = parsed.chart === "gex" || parsed.chart === "oi" ? "gex_full" : parsed.chart === "dex" ? "delta" : parsed.chart;
    const view = parsed.chart === "gex" || parsed.chart === "oi" ? "classic" : "state";
    const envelope = await fetchGexBotTerminal(view, ticker, category, false);
    if (!envelope.ok || !envelope.frame) {
      return NextResponse.json({ ok: false, request: parsed, error: envelope.error ?? "Research source is unavailable." }, { status: envelope.entitlementRequired ? 403 : 503 });
    }
    const rows = [...envelope.frame.strikes]
      .sort((a, b) => Math.abs(b[parsed.chart === "oi" ? 2 : 1]) - Math.abs(a[parsed.chart === "oi" ? 2 : 1]))
      .slice(0, parsed.strikes)
      .sort((a, b) => a[0] - b[0]);
    return NextResponse.json({
      ok: true,
      request: parsed,
      source: { provider: "gexbot", providerTimestamp: envelope.frame.timestamp, checkedAt: envelope.checkedAt, session: envelope.session, simulated: false },
      spot: envelope.frame.spot,
      rows: rows.map(([strike, volumeExposure, openInterestExposure, priors]) => ({ strike, volumeExposure, openInterestExposure, priors })),
    }, { headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Invalid research command." }, { status: 400 });
  }
}
