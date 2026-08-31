import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  fetchMarketIndexCandles,
  fetchMarketIndexSnapshots,
  hasIntradayMarketIndexHistoryAccess,
} from "@/lib/marketIndices.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";
import {
  buildVixEnvironmentSnapshot,
  normalizeVixEnvironmentThresholds,
  normalizeVixHistoryCandles,
} from "@/lib/vixEnvironment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Receipt = {
  schemaVersion: 1;
  id: "vix-environment";
  symbol: "VIX" | "VXN";
  revision: string;
  value: number;
  open: number | null;
  change: number | null;
  changePercent: number | null;
  sessionHigh: number | null;
  sessionLow: number | null;
  sessionPositionPercent: number | null;
  rank52Week: number | null;
  percentile52Week: number | null;
  regime: "CALM" | "NORMAL" | "ELEVATED" | "HIGH" | "EXTREME";
  normalThreshold: number;
  elevatedThreshold: number;
  highThreshold: number;
  extremeThreshold: number;
  checkedAtMs: number;
  receivedAtMs: number;
  sourceLabel: string;
  stale: boolean;
  delayed: boolean;
  marketOpen: boolean;
  historySamples: number;
  replayAsOfMs: number | null;
};

const cache = new Map<string, { expiresAt: number; payload: Receipt }>();

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

function finiteQuery(request: NextRequest, key: string, fallback: number) {
  const parsed = Number(request.nextUrl.searchParams.get(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const symbol = (request.nextUrl.searchParams.get("symbol") || "VIX").trim().toUpperCase();
  if (symbol !== "VIX" && symbol !== "VXN") {
    return NextResponse.json({ error: "VIX Environment supports only VIX and VXN." }, { status: 400 });
  }
  const asOfText = request.nextUrl.searchParams.get("asOf")?.trim() ?? "";
  const replayAsOfMs = asOfText ? Date.parse(asOfText) : null;
  const receivedAtMs = Date.now();
  if (asOfText && (!Number.isFinite(replayAsOfMs) || replayAsOfMs! <= 0 || replayAsOfMs! > receivedAtMs)) {
    return NextResponse.json({ error: "A valid non-future VIX replay cutoff is required." }, { status: 400 });
  }
  const thresholds = normalizeVixEnvironmentThresholds({
    normal: finiteQuery(request, "normal", 15),
    elevated: finiteQuery(request, "elevated", 20),
    high: finiteQuery(request, "high", 25),
    extreme: finiteQuery(request, "extreme", 30),
  });
  const key = [symbol, thresholds.normal, thresholds.elevated, thresholds.high, thresholds.extreme, replayAsOfMs ?? "live"].join(":");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > receivedAtMs) {
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const clock = replayAsOfMs ?? receivedAtMs;
    const historyPromise = fetchMarketIndexCandles({
      symbol,
      timeframe: "1D",
      from: clock - 370 * 86_400_000,
      to: clock,
    });
    const [historyResult, liveResult] = await Promise.allSettled([
      historyPromise,
      replayAsOfMs === null ? fetchMarketIndexSnapshots([symbol]) : Promise.resolve([]),
    ]);
    const history = historyResult.status === "fulfilled"
      ? normalizeVixHistoryCandles(historyResult.value)
      : [];
    const live = liveResult.status === "fulfilled"
      ? liveResult.value.find((value) => value.symbol === symbol) ?? null
      : null;
    if (!history.length && !live) {
      throw historyResult.status === "rejected"
        ? historyResult.reason
        : liveResult.status === "rejected"
          ? liveResult.reason
          : new Error(`${symbol} volatility data is unavailable.`);
    }
    let snapshot = buildVixEnvironmentSnapshot({
      symbol,
      live,
      history,
      asOfMs: clock,
      thresholds,
      replay: replayAsOfMs !== null,
    });
    if (!snapshot) throw new Error(`${symbol} volatility data is unavailable.`);
    if (!live) {
      const historySource = symbol === "VIX" && !hasIntradayMarketIndexHistoryAccess()
        ? "CBOE EOD"
        : "server market-index history";
      snapshot = { ...snapshot, sourceLabel: `${symbol} · ${historySource}` };
    }
    const checkedAtMs = Date.parse(snapshot.checkedAt);
    if (!Number.isFinite(checkedAtMs) || checkedAtMs > clock + 60_000 ||
        replayAsOfMs !== null && checkedAtMs > replayAsOfMs) {
      return NextResponse.json({ error: "The VIX Environment receipt is not point-in-time safe." }, { status: 502 });
    }
    const revision = createHash("sha256").update(JSON.stringify([
      symbol, snapshot.value, snapshot.open, snapshot.change, snapshot.changePercent,
      snapshot.sessionHigh, snapshot.sessionLow, snapshot.rank52Week,
      snapshot.percentile52Week, snapshot.regime, checkedAtMs, thresholds,
      snapshot.stale, snapshot.delayed, snapshot.marketOpen,
    ])).digest("hex");
    const payload: Receipt = {
      schemaVersion: 1,
      id: "vix-environment",
      symbol,
      revision,
      value: snapshot.value,
      open: snapshot.open,
      change: snapshot.change,
      changePercent: snapshot.changePercent,
      sessionHigh: snapshot.sessionHigh,
      sessionLow: snapshot.sessionLow,
      sessionPositionPercent: snapshot.sessionPositionPercent,
      rank52Week: snapshot.rank52Week,
      percentile52Week: snapshot.percentile52Week,
      regime: snapshot.regime,
      normalThreshold: thresholds.normal,
      elevatedThreshold: thresholds.elevated,
      highThreshold: thresholds.high,
      extremeThreshold: thresholds.extreme,
      checkedAtMs,
      receivedAtMs,
      sourceLabel: snapshot.sourceLabel,
      stale: snapshot.stale,
      delayed: snapshot.delayed,
      marketOpen: snapshot.marketOpen,
      historySamples: history.filter((row) => row.timestamp <= clock).slice(-252).length,
      replayAsOfMs,
    };
    if (cache.size >= 32) {
      for (const [cacheKey, entry] of cache) if (entry.expiresAt <= receivedAtMs) cache.delete(cacheKey);
      if (cache.size >= 32) cache.delete(cache.keys().next().value as string);
    }
    cache.set(key, { expiresAt: receivedAtMs + (replayAsOfMs === null ? 10_000 : 15 * 60_000), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "VIX Environment is unavailable." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
