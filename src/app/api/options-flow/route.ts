import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getOptionsFlowPayload, getQuantDataHttpError } from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "Options Flow is not configured." }, { status: 503 });
  }

  // `middleware.ts` is the single authentication boundary for every private
  // API route. Re-reading the original Supabase cookie here raced middleware's
  // token refresh and made a newly signed-in second device look unauthenticated
  // even though middleware had already approved it.

  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const priceMode = (request.nextUrl.searchParams.get("priceMode") || "CASH").trim().toUpperCase();
  const detailMode = (request.nextUrl.searchParams.get("detail") || "FULL").trim().toUpperCase();
  if (!SYMBOL_PATTERN.test(symbol)) {
    return NextResponse.json({ error: "Invalid ticker symbol." }, { status: 400 });
  }
  if (priceMode !== "CASH" && priceMode !== "FUTURES") {
    return NextResponse.json({ error: "Invalid price mode." }, { status: 400 });
  }
  if (detailMode !== "CORE" && detailMode !== "FULL") {
    return NextResponse.json({ error: "Invalid options-flow detail mode." }, { status: 400 });
  }

  try {
    const payload = await getOptionsFlowPayload(symbol, priceMode, undefined, detailMode);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message, rateLimitRemaining: problem.remaining },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
