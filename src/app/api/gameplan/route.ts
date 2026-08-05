import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { buildGameplanPayload, currentGameplanSession } from "@/lib/gameplan";
import {
  getNativeFuturesSessionClose,
  getNativeFuturesSpot,
  newYorkCashCloseIso,
} from "@/lib/databentoGamma.server";
import { isOptionsFuturesRatioSane, type OptionsFlowPayload } from "@/lib/optionsFlow";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

export const maxDuration = 120;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
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
    return NextResponse.json({ error: "The Gameplan options feed is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rootInput = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  const requestedSessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim();
  const liveSession = requestedSessionDate ? "newyork" as const : currentGameplanSession();
  if (rootInput !== "NQ" && rootInput !== "ES") {
    return NextResponse.json({ error: "Gameplan currently supports NQ and ES." }, { status: 400 });
  }
  try {
    const root = rootInput as "NQ" | "ES";
    const source = rootInput === "NQ" ? "NDX" : "SPX";
    const historical = Boolean(requestedSessionDate);
    const options = await getOptionsFlowPayload(
      source,
      historical ? "CASH" : "FUTURES",
      requestedSessionDate,
      "GAMEPLAN",
    );
    const futuresPrice = !historical && options.session.marketOpen
      ? await getNativeFuturesSpot(root).catch(() => null)
      : await getNativeFuturesSessionClose(root, options.session.sessionDate).catch(() => null);
    const cashPrice = options.stockPrice;
    const scale = futuresPrice && cashPrice && cashPrice > 0 ? futuresPrice / cashPrice : null;
    const canCalibrate = futuresPrice !== null
      && cashPrice !== null
      && scale !== null
      && isOptionsFuturesRatioSane(source, scale);
    const calibratedOptions: OptionsFlowPayload = canCalibrate
      ? {
        ...options,
        marketData: {
          ...options.marketData,
          mode: "FUTURES" as const,
          provider: "Databento" as const,
          status: !historical && options.session.marketOpen ? "LIVE" as const : "LAST_SESSION" as const,
          symbol: root,
          futuresRoot: root,
          asOf: !historical && options.session.marketOpen
            ? new Date().toISOString()
            : newYorkCashCloseIso(options.session.sessionDate),
          lastPrice: futuresPrice,
          bid: null,
          ask: null,
          basisToOptionsUnderlying: futuresPrice! - cashPrice!,
          levelPriceScale: scale,
          stale: historical || !options.session.marketOpen,
          fallback: false,
          detail: !historical && options.session.marketOpen
            ? "Live CME futures calibration against the active New York options snapshot."
            : "Frozen CME futures calibration at the selected completed New York close.",
        },
      }
      : options;
    const payload = buildGameplanPayload(calibratedOptions, root, liveSession);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": historical
          ? "private, max-age=86400, stale-while-revalidate=604800"
          : "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message },
      {
        status: problem.status,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
