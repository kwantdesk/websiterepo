import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getOptionsMarketPulse, getQuantDataHttpError } from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "Options Flow is not configured." }, { status: 503 });
  }
  // Authentication is already enforced centrally by `middleware.ts`. A
  // second Supabase read here used the pre-refresh request cookie and could
  // incorrectly reject another computer's otherwise valid session.

  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const priceMode = (request.nextUrl.searchParams.get("priceMode") || "CASH").trim().toUpperCase();
  const includeHistory = request.nextUrl.searchParams.get("history") === "1";
  if (!SYMBOL_PATTERN.test(symbol)) {
    return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  }
  if (priceMode !== "CASH" && priceMode !== "FUTURES") {
    return NextResponse.json({ error: "Invalid price mode." }, { status: 400 });
  }

  try {
    const payload = await getOptionsMarketPulse(symbol, priceMode, includeHistory);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message, rateLimitRemaining: problem.remaining },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
