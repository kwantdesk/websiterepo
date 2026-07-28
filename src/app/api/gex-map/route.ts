import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getGexMapPanel, getQuantDataHttpError } from "@/lib/quantData.server";
import { GEX_MAP_GREEKS } from "@/lib/gexMap";
import { OPTIONS_FLOW_TICKERS, type GreekMode } from "@/lib/optionsFlow";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
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
    return NextResponse.json({ error: "GEXMAP is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const greekMode = (request.nextUrl.searchParams.get("greekMode") || "GAMMA").trim().toUpperCase() as GreekMode;
  const sessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim() || undefined;
  if (!OPTIONS_FLOW_TICKERS.includes(symbol as (typeof OPTIONS_FLOW_TICKERS)[number])) {
    return NextResponse.json({ error: "Unsupported GEXMAP instrument." }, { status: 400 });
  }
  if (!GEX_MAP_GREEKS.some((item) => item.mode === greekMode)) {
    return NextResponse.json({ error: "Unsupported exposure metric." }, { status: 400 });
  }
  if (sessionDate && !DATE_PATTERN.test(sessionDate)) {
    return NextResponse.json({ error: "Invalid replay date." }, { status: 400 });
  }

  try {
    const payload = await getGexMapPanel(symbol, greekMode, sessionDate);
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
