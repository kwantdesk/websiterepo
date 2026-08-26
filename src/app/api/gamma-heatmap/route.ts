import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  buildGammaHeatmapPayload,
  defaultGammaHeatmapSource,
  gammaHeatmapGreek,
  normalizeGammaHeatmapInstrument,
  type GammaHeatmapSourceMode,
} from "@/lib/gammaHeatmap";
import { getNativeFuturesSpot } from "@/lib/databentoGamma.server";
import { getConfiguredQuantDataApiKey, getGexMapPanel, getQuantDataHttpError } from "@/lib/quantData.server";
import { OPTIONS_FLOW_TICKERS } from "@/lib/optionsFlow";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";
import { conditionalJson } from "@/lib/conditionalJson";

export const maxDuration = 60;

const SOURCE_MODES = new Set<GammaHeatmapSourceMode>(["quantdata", "databento-raw", "hybrid"]);
// The freshness stamp and refresh interval are read back out on a cache hit
// to build the ETag, so the entry is typed rather than unknown.
type CachedHeatmapPayload = { asOf: string; refreshAfterMs: number };
const payloadCache = new Map<string, { expiresAt: number; payload: CachedHeatmapPayload }>();

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

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Gamma Heatmap options data is not configured." }, { status: 503 });

  const display = normalizeGammaHeatmapInstrument(request.nextUrl.searchParams.get("display") || "NQ");
  const source = (request.nextUrl.searchParams.get("source") || defaultGammaHeatmapSource(display)).toUpperCase();
  const metric = request.nextUrl.searchParams.get("metric") || "GAMMA";
  const sourceMode = (request.nextUrl.searchParams.get("sourceMode") || "hybrid") as GammaHeatmapSourceMode;
  const requestedSpot = Number(request.nextUrl.searchParams.get("displayPrice"));
  const historyHours = Number(request.nextUrl.searchParams.get("historyHours") || 24);
  const binSize = Number(request.nextUrl.searchParams.get("binSize") || (display === "ES" || display === "MES" ? 1 : 5));
  if (!/^(NQ|MNQ|ES|MES)$/.test(display)) return NextResponse.json({ error: "Gamma Heatmap supports NQ, MNQ, ES and MES." }, { status: 400 });
  if (!OPTIONS_FLOW_TICKERS.includes(source as (typeof OPTIONS_FLOW_TICKERS)[number])) return NextResponse.json({ error: "Unsupported options source." }, { status: 400 });
  if (!SOURCE_MODES.has(sourceMode)) return NextResponse.json({ error: "Unsupported source mode." }, { status: 400 });
  if (sourceMode === "databento-raw") {
    return NextResponse.json({
      error: "Databento raw historical option-chain surfaces are not available on this adapter yet. Select Hybrid or QuantData; no substitute surface was shown.",
    }, { status: 422 });
  }
  const greekMode = gammaHeatmapGreek(metric);
  const futuresRoot = display === "ES" || display === "MES" ? "ES" : "NQ";

  try {
    const displayPrice = requestedSpot > 0 ? requestedSpot : await getNativeFuturesSpot(futuresRoot);
    if (!(displayPrice && displayPrice > 0)) throw new Error("The live futures price required for strike mapping is unavailable.");
    const key = [source, greekMode, display, sourceMode, historyHours, binSize, Math.round(displayPrice * 4) / 4].join(":");
    const cached = payloadCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return conditionalJson(request, cached.payload, {
        identity: `${key}:${cached.payload.asOf}`,
        maxAgeMs: cached.payload.refreshAfterMs,
      });
    }
    const panel = await getGexMapPanel(source, greekMode);
    const payload = buildGammaHeatmapPayload({ panel, displayInstrument: display, displayPrice, sourceMode, historyHours, binSize });
    if (payloadCache.size > 64) {
      for (const [cacheKey, entry] of payloadCache) if (entry.expiresAt <= Date.now()) payloadCache.delete(cacheKey);
    }
    payloadCache.set(key, { expiresAt: Date.now() + Math.max(2_000, Math.min(15_000, payload.refreshAfterMs)), payload });
    // `asOf` moves only when the upstream surface does, so a pane that polls
    // faster than the data changes revalidates into a 304 instead of pulling
    // several megabytes out of origin again.
    return conditionalJson(request, payload, {
      identity: `${key}:${payload.asOf}`,
      maxAgeMs: payload.refreshAfterMs,
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
