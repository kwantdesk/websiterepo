import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { DATABENTO_FUTURES, getDatabentoBars } from "@/lib/databento";
import { supportsChartInterval } from "@/lib/chartIntervals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

const EARLIEST_CME_HISTORY_MS = Date.parse("2010-06-06T00:00:00.000Z");
const MAX_REQUEST_MS = 16 * 24 * 60 * 60_000;

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
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "CME replay data is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const symbol = (request.nextUrl.searchParams.get("symbol") || "").trim();
  const timeframe = (request.nextUrl.searchParams.get("timeframe") || "1m").trim();
  const start = Date.parse(request.nextUrl.searchParams.get("start") || "");
  const requestedEnd = Date.parse(request.nextUrl.searchParams.get("end") || "");
  const instrument = DATABENTO_FUTURES.find((candidate) =>
    candidate.kind === "future" && candidate.symbol.toUpperCase() === symbol.toUpperCase());

  if (!instrument) {
    return NextResponse.json({ error: "A valid CME futures instrument is required." }, { status: 400 });
  }
  if (!supportsChartInterval(timeframe, "Databento")) {
    return NextResponse.json({ error: "That replay timeframe is not supported." }, { status: 400 });
  }
  const end = Math.min(requestedEnd, Date.now());
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < EARLIEST_CME_HISTORY_MS || end <= start) {
    return NextResponse.json({ error: "A valid historical replay window is required." }, { status: 400 });
  }
  if (end - start > MAX_REQUEST_MS) {
    return NextResponse.json({ error: "Replay requests are limited to 16 calendar days." }, { status: 400 });
  }

  try {
    const candles = await getDatabentoBars(
      instrument.symbol,
      timeframe,
      new Date(start).toISOString(),
      new Date(end).toISOString(),
    );
    if (!candles.length) {
      return NextResponse.json({ error: "No CME candles were returned for this replay window." }, { status: 422 });
    }
    return NextResponse.json({
      symbol: instrument.symbol,
      timeframe,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      dataset: "GLBX.MDP3",
      candles,
      coverage: {
        earliestDocumented: "2010-06-06",
        note: "Actual availability depends on the Databento account entitlement and selected schema.",
      },
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error
        ? error.message.replaceAll("Databento", "CME")
        : "CME replay history could not be loaded.",
    }, { status: 502 });
  }
}
