import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import type { IvRankContractMode } from "@/lib/impliedVolatilityRank";
import {
  getConfiguredQuantDataApiKey,
  getImpliedVolatilityRankSnapshot,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const ALLOWED_SOURCES = new Set(["QQQ", "SPY", "NDX", "SPX", "IWM", "DIA"]);
const ALLOWED_DISPLAYS = new Set(["QQQ", "NDX", "NQ", "MNQ", "SPY", "SPX", "ES", "MES", "IWM", "DIA"]);
const ALLOWED_MODES = new Set<IvRankContractMode>(["combined", "average-call-put", "call", "put", "call-put-split"]);

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (isSiteAccessConfigured() && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function boundedInteger(raw: string | null, fallback: number, minimum: number, maximum: number) {
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "IV Rank options data is not configured." }, { status: 503 });

  const source = (request.nextUrl.searchParams.get("source") || "QQQ").toUpperCase();
  const display = (request.nextUrl.searchParams.get("display") || "NQ").toUpperCase();
  const contractMode = (request.nextUrl.searchParams.get("contractMode") || "average-call-put") as IvRankContractMode;
  if (!ALLOWED_SOURCES.has(source)) return NextResponse.json({ error: "Unsupported IV Rank options source." }, { status: 400 });
  if (!ALLOWED_DISPLAYS.has(display)) return NextResponse.json({ error: "Unsupported IV Rank display instrument." }, { status: 400 });
  if (!ALLOWED_MODES.has(contractMode)) return NextResponse.json({ error: "Unsupported IV Rank contract mode." }, { status: 400 });

  try {
    const payload = await getImpliedVolatilityRankSnapshot({
      sourceTicker: source,
      displayInstrument: display,
      lookBackPeriodDays: boundedInteger(request.nextUrl.searchParams.get("lookback"), 252, 2, 365),
      targetMaturityDays: boundedInteger(request.nextUrl.searchParams.get("maturity"), 30, 0, 365),
      contractMode,
      useLiveIntradayIv: request.nextUrl.searchParams.get("live") !== "0",
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
