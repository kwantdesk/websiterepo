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

    /*
     * aggregate=1 collapses the tape to signed contract sums per strike, per
     * side, per aggressor level.
     *
     * The raw tape is thousands of prints and cannot be read back through a
     * browser, but the calibration does not need the prints - it needs to know
     * how much size sits behind ABOVE_ASK versus ASK versus BID versus
     * BELOW_BID at each strike. That is a few hundred numbers, and it is
     * exactly the distinction the earlier capture destroyed by collapsing side
     * to BUY / SELL / MID.
     */
    /*
     * aggregate=net returns ONE signed contract total per strike for each
     * candidate aggressor rule, for a single expiration.
     *
     * Sign agreement against the reference has sat at 55-61% under every
     * magnitude model tried, which means the error is in the SIGN of the
     * accumulated flow, not in how it is valued. The sign comes entirely from
     * which prints are counted as customer buying. These are the rules worth
     * separating, and each needs one number per strike to be scored - not
     * thousands of prints.
     */
    if (request.nextUrl.searchParams.get("aggregate") === "net") {
      const wanted = (request.nextUrl.searchParams.get("expiration") || sessionDate).trim();
      // dealerSign: a customer lifting the offer leaves the dealer short.
      const RULES: Record<string, (side: string, consolidation: string) => number> = {
        all: (side) => (side === "ASK" || side === "ABOVE_ASK" ? -1 : side === "BID" || side === "BELOW_BID" ? 1 : 0),
        aggressive: (side) => (side === "ABOVE_ASK" ? -1 : side === "BELOW_BID" ? 1 : 0),
        atQuote: (side) => (side === "ASK" ? -1 : side === "BID" ? 1 : 0),
        sweep: (side, consolidation) => (consolidation !== "SWEEP" ? 0
          : side === "ASK" || side === "ABOVE_ASK" ? -1 : side === "BID" || side === "BELOW_BID" ? 1 : 0),
        block: (side, consolidation) => (consolidation !== "BLOCK" ? 0
          : side === "ASK" || side === "ABOVE_ASK" ? -1 : side === "BID" || side === "BELOW_BID" ? 1 : 0),
      };
      const net: Record<number, Record<string, number>> = {};
      for (const raw of tape.prints) {
        if (!raw || typeof raw !== "object") continue;
        const print = raw as Record<string, unknown>;
        const expiration = typeof print.expirationDate === "string" ? print.expirationDate.slice(0, 10) : "";
        if (expiration !== wanted) continue;
        const strike = Number(print.strikePrice);
        const size = Number(print.size);
        if (!Number.isFinite(strike) || !Number.isFinite(size) || size <= 0) continue;
        const side = String(print.tradeSideCode ?? "").toUpperCase();
        const consolidation = String(print.tradeConsolidationType ?? "").toUpperCase();
        const row = net[strike] ?? (net[strike] = {});
        for (const [name, rule] of Object.entries(RULES)) {
          row[name] = (row[name] ?? 0) + size * rule(side, consolidation);
        }
      }
      return NextResponse.json({
        symbol: tape.symbol, sessionDate: tape.sessionDate, expiration: wanted,
        prints: tape.prints.length, truncated: tape.truncated,
        rules: Object.keys(RULES), net,
      }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }

    if (request.nextUrl.searchParams.get("aggregate") === "1") {
      const buckets = new Map<string, number>();
      let classified = 0;
      for (const raw of tape.prints) {
        if (!raw || typeof raw !== "object") continue;
        const print = raw as Record<string, unknown>;
        const strike = Number(print.strikePrice);
        const size = Number(print.size);
        const right = String(print.contractType ?? "").toUpperCase();
        const side = String(print.tradeSideCode ?? "").toUpperCase();
        const expiration = typeof print.expirationDate === "string" ? print.expirationDate.slice(0, 10) : "";
        if (!Number.isFinite(strike) || !Number.isFinite(size) || size <= 0) continue;
        if (right !== "CALL" && right !== "PUT") continue;
        classified += 1;
        const key = `${expiration}|${strike}|${right}|${side}|${String(print.tradeConsolidationType ?? "")}`;
        buckets.set(key, (buckets.get(key) ?? 0) + size);
      }
      return NextResponse.json({
        symbol: tape.symbol,
        sessionDate: tape.sessionDate,
        prints: tape.prints.length,
        classified,
        truncated: tape.truncated,
        // "expiration|strike|right|tradeSideCode|consolidation": contracts
        buckets: Object.fromEntries([...buckets.entries()].sort()),
      }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }

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
