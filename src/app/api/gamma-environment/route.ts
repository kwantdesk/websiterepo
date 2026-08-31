import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  getCashCalibratedChartGammaLevels,
  getChartGammaLevels,
  getConfiguredQuantDataApiKey,
  getHistoricalReplayChartGammaLevels,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 120;

type FuturesRoot = "NQ" | "ES";

const SCOPES = new Map<string, { root: FuturesRoot; source: string; futures: boolean }>([
  ["NQ", { root: "NQ", source: "QQQ", futures: true }],
  ["MNQ", { root: "NQ", source: "QQQ", futures: true }],
  ["QQQ", { root: "NQ", source: "QQQ", futures: false }],
  ["NDX", { root: "NQ", source: "NDX", futures: false }],
  ["ES", { root: "ES", source: "SPY", futures: true }],
  ["MES", { root: "ES", source: "SPY", futures: true }],
  ["SPY", { root: "ES", source: "SPY", futures: false }],
  ["SPX", { root: "ES", source: "SPX", futures: false }],
  ["SPXW", { root: "ES", source: "SPXW", futures: false }],
]);

async function isAuthenticated(request: NextRequest) {
  const expectedInternalToken = String(process.env.KWANTDESK_ANALYTICS_SERVICE_TOKEN || "").trim();
  const suppliedInternalToken = String(request.headers.get("x-kwantdesk-internal-analytics-token") || "").trim();
  if (expectedInternalToken.length >= 32 && suppliedInternalToken.length === expectedInternalToken.length) {
    const supplied = Buffer.from(suppliedInternalToken, "utf8");
    const expected = Buffer.from(expectedInternalToken, "utf8");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
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

function sourceLabel(args: {
  display: string;
  source: string;
  sessionDate: string;
  marketOpen: boolean;
  replay: boolean;
  levelPriceScale?: number;
}) {
  if (args.replay) return `${args.source} options · ${args.sessionDate} historical replay`;
  if (args.display === "NQ" || args.display === "MNQ" || args.display === "ES" || args.display === "MES") {
    const scale = Number(args.levelPriceScale);
    const suffix = Number.isFinite(scale) && scale > 0 ? ` · ${scale.toFixed(6)}×` : "";
    return `Kwant levels · ${args.marketOpen ? "LIVE NY OPTIONS" : "STALE"}${suffix}`;
  }
  return `${args.source} options · ${args.marketOpen ? "LIVE NY OPTIONS" : "NEW YORK EOD"}`;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Gamma options data is not configured." }, { status: 503 });

  const display = (request.nextUrl.searchParams.get("display") || "").trim().toUpperCase();
  const source = (request.nextUrl.searchParams.get("source") || "").trim().toUpperCase();
  const root = (request.nextUrl.searchParams.get("root") || "").trim().toUpperCase();
  const scope = SCOPES.get(display);
  if (!scope || scope.source !== source || scope.root !== root) {
    return NextResponse.json({ error: "Unsupported Gamma Environment scope." }, { status: 400 });
  }

  const asOfText = request.nextUrl.searchParams.get("asOf")?.trim() ?? "";
  const replayAsOfMs = asOfText ? Date.parse(asOfText) : null;
  const futuresPrice = Number(request.nextUrl.searchParams.get("futuresPrice"));
  if (asOfText && (!Number.isFinite(replayAsOfMs) || replayAsOfMs! <= 0 || replayAsOfMs! > Date.now() || !(futuresPrice > 0))) {
    return NextResponse.json({ error: "A valid replay cutoff and futures price are required." }, { status: 400 });
  }

  try {
    const replay = replayAsOfMs !== null;
    const payload = replay
      ? await getHistoricalReplayChartGammaLevels(scope.root, scope.source, asOfText, futuresPrice)
      : scope.futures
        ? await getCashCalibratedChartGammaLevels(scope.root, scope.source)
        : await getChartGammaLevels(scope.root, scope.source);
    const checkedAtMs = Date.parse(payload.checkedAt);
    if (!Number.isFinite(checkedAtMs) || (replayAsOfMs !== null && checkedAtMs > replayAsOfMs)) {
      return NextResponse.json({ error: "The Gamma Environment receipt is not point-in-time safe." }, { status: 502 });
    }
    const marketOpen = !replay && Boolean(payload.marketOpen);
    const snapshotMode = replay
      ? payload.snapshotMode === "HISTORICAL_INTRADAY" || payload.positioning?.status === "HISTORICAL_INTRADAY"
        ? "HISTORICAL_INTRADAY"
        : "NEW_YORK_EOD"
      : marketOpen ? "LIVE" : "NEW_YORK_EOD";
    const actualSource = payload.requestedSource;
    const revision = createHash("sha256").update(String(payload.revision)).digest("hex");
    const response = {
      schemaVersion: 1,
      id: "gamma-environment",
      displayInstrument: display,
      futuresRoot: scope.root,
      sourceSymbol: actualSource,
      sessionDate: payload.sessionDate,
      revision,
      checkedAtMs,
      receivedAtMs: Date.now(),
      refreshAfterMs: Math.max(1_000, Math.min(21_600_000, Number(payload.refreshAfterMs) || 60_000)),
      snapshotMode,
      marketOpen,
      gammaRegime: payload.environment.gammaRegime,
      gammaStrength: payload.environment.gammaStrength,
      gammaStateLabel: payload.environment.gammaStateLabel,
      regimeStrength: payload.environment.regimeStrength,
      sourceLabel: sourceLabel({
        display,
        source: actualSource,
        sessionDate: payload.sessionDate,
        marketOpen,
        replay,
        levelPriceScale: payload.levelPriceScale,
      }),
      stale: replay || !marketOpen,
      replayAsOfMs,
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
