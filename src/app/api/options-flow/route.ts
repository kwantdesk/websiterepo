import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getOptionsFlowPayload, getQuantDataHttpError } from "@/lib/quantData.server";

const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" &&
    (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });

  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "Options Flow is not configured." }, { status: 503 });
  }

  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

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
