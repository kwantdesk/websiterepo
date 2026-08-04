import { createServerClient } from "@supabase/ssr";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Native gamma cold-builds a session's options chain (~25s of Databento pulls); the
// default function timeout can kill it mid-build. Cached calls return in milliseconds.
export const maxDuration = 120;
import {
  getCashCalibratedChartGammaLevels,
  getChartGammaLevels,
  getConfiguredQuantDataApiKey,
  getHistoricalCashCalibratedChartGammaLevelsAtOrBefore,
  getHistoricalReplayChartGammaLevels,
  getQuantDataHttpError,
  getUsOptionsSessionDate,
  isUsOptionsMarketOpen,
} from "@/lib/quantData.server";

const getCompletedCashCalibratedGamma = unstable_cache(
  async (root: "NQ" | "ES", source: string, sessionDate: string) =>
    getCashCalibratedChartGammaLevels(root, source, sessionDate),
  ["completed-cash-calibrated-chart-gamma-v1"],
  { revalidate: 6 * 60 * 60 },
);

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
  const root = (request.nextUrl.searchParams.get("root") || "").trim().toUpperCase();
  const source = (request.nextUrl.searchParams.get("source") || "").trim().toUpperCase();
  const sessionDate = request.nextUrl.searchParams.get("sessionDate")?.trim();
  const asOf = request.nextUrl.searchParams.get("asOf")?.trim();
  const futuresPrice = Number(request.nextUrl.searchParams.get("futuresPrice"));
  const calibratedRequest = request.nextUrl.searchParams.get("calibrated") === "1";
  const replayRequest = request.nextUrl.searchParams.get("replay") === "1";
  const nativeFuturesRequest = !calibratedRequest && (root === "NQ" || root === "ES") && source === root;
  if (!nativeFuturesRequest && !getConfiguredQuantDataApiKey()) {
    return NextResponse.json({ error: "KwantData is not configured." }, { status: 503 });
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  try {
    const currentOptionsSession = getUsOptionsSessionDate();
    const effectiveSessionDate = sessionDate || currentOptionsSession;
    const completedOptionsSession = effectiveSessionDate !== currentOptionsSession || !isUsOptionsMarketOpen();
    const payload = calibratedRequest && (root === "NQ" || root === "ES")
      ? asOf
        ? await getHistoricalReplayChartGammaLevels(root, source, asOf, futuresPrice)
        : replayRequest && sessionDate
          ? await getHistoricalCashCalibratedChartGammaLevelsAtOrBefore(
              root,
              source,
              sessionDate,
              Number.isFinite(futuresPrice) && futuresPrice > 0 ? futuresPrice : undefined,
            )
          : completedOptionsSession
            ? await getCompletedCashCalibratedGamma(root, source, effectiveSessionDate)
            : await getCashCalibratedChartGammaLevels(
                root,
                source,
                sessionDate,
                Number.isFinite(futuresPrice) && futuresPrice > 0 ? futuresPrice : undefined,
              )
      : await getChartGammaLevels(root, source, sessionDate);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": asOf || sessionDate
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
