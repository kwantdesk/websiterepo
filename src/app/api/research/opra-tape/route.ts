import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { readRawConsolidatedTape, getQuantDataHttpError } from "@/lib/quantData.server";
import { OPTIONS_FLOW_TICKERS } from "@/lib/optionsFlow";
import { providerErrorMessage, logProviderError } from "@/lib/providerErrorMessage";

/**
 * Raw consolidated tape, for calibrating the GEX Map v2 flow weights.
 *
 * The v2 weights cannot be improved from the existing capture: its `side` is
 * collapsed to BUY / SELL / MID, while the feed carries `tradeSideCode` at five
 * levels plus consolidation type, trade condition and per-print greeks. Those
 * are exactly the distinctions that separate directional customer positioning
 * from hedging and spread flow, so a capture that drops them cannot answer the
 * question. This returns the provider records UNMODIFIED.
 *
 * Deliberately NOT a generic {path, body} passthrough. That would let any
 * signed-in user address any provider endpoint through our credential, which is
 * a vendor-boundary hole rather than a research tool. One endpoint, one shape,
 * an allowlisted ticker and a bounded page count.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** 100 rows a page. Bounded so one request cannot drain the provider quota. */
const MAX_PAGES = 80;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "SPX").trim().toUpperCase();
  const sessionDate = (request.nextUrl.searchParams.get("sessionDate") || "").trim();
  const pages = Math.min(MAX_PAGES, Math.max(1, Number(request.nextUrl.searchParams.get("pages") || 60)));

  if (!OPTIONS_FLOW_TICKERS.includes(symbol as (typeof OPTIONS_FLOW_TICKERS)[number])) {
    return NextResponse.json({ error: "Unsupported instrument." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return NextResponse.json({ error: "A sessionDate of YYYY-MM-DD is required." }, { status: 400 });
  }

  try {
    const tape = await readRawConsolidatedTape(symbol, sessionDate, pages);
    return NextResponse.json(tape, {
      // Research output, bound to one signed-in operator. Never shared-cached.
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    logProviderError("research/opra-tape", error);
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: providerErrorMessage(error, "The options tape") },
      { status: problem?.status ?? 502 },
    );
  }
}
