import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredQuantDataApiKey, getGexMapFutureChain, getQuantDataHttpError } from "@/lib/quantData.server";
import { GEX_MAP_GREEKS } from "@/lib/gexMap";
import { OPTIONS_FLOW_TICKERS, type GreekMode } from "@/lib/optionsFlow";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessConfigured,
  isValidSiteAccessToken,
} from "@/lib/siteAccess";

export const maxDuration = 60;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return true;
  }
  if (
    isSiteAccessConfigured()
    && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)
  ) return true;
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
  if (!new Set<string>(OPTIONS_FLOW_TICKERS).has(symbol)) {
    return NextResponse.json({ error: "Unsupported options series." }, { status: 400 });
  }
  if (!GEX_MAP_GREEKS.some((item) => item.mode === greekMode)) {
    return NextResponse.json({ error: "Unsupported exposure greek." }, { status: 400 });
  }
  try {
    const payload = await getGexMapFutureChain(symbol, greekMode);
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
