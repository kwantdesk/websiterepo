import { NextResponse } from "next/server";
import { logProviderError, providerErrorMessage } from "@/lib/providerErrorMessage";
import { getDatabentoOptions } from "@/lib/databento";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!vendorMarketDataConfigured("databento")) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json(
      { instruments: await getDatabentoOptions(), source: "CME", dataset: "GLBX.MDP3" },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    logProviderError("databento-options", error);
    return NextResponse.json(
      { error: providerErrorMessage(error, "Options data") },
      { status: 502 },
    );
  }
}
