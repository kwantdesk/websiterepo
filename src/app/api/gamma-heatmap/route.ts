import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  buildGammaHeatmapPayload,
  defaultGammaHeatmapSource,
  gammaHeatmapGreek,
  normalizeGammaHeatmapInstrument,
  type GammaHeatmapPayload,
  type GammaHeatmapSourceMode,
} from "@/lib/gammaHeatmap";
import { latestGexMapStrikesFromFrames, type GexMapPanelPayload } from "@/lib/gexMap";
import { getNativeFuturesSpot } from "@/lib/databentoGamma.server";
import {
  getConfiguredQuantDataApiKey,
  getGexMapPanel,
  getQuantDataHttpError,
  QuantDataError,
} from "@/lib/quantData.server";
import { OPTIONS_FLOW_TICKERS } from "@/lib/optionsFlow";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";
import { conditionalJson } from "@/lib/conditionalJson";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const SOURCE_MODES = new Set<GammaHeatmapSourceMode>(["quantdata", "databento-raw", "hybrid"]);
const MAX_CACHE_ENTRIES = 64;
const MAX_SNAPSHOTS = 300;
const MAX_BINS_PER_SNAPSHOT = 512;
const MAX_TOTAL_BINS = MAX_SNAPSHOTS * MAX_BINS_PER_SNAPSHOT;
const MAX_LEVELS = 1_024;

type HeatmapReceipt = GammaHeatmapPayload & {
  id: "gamma-heatmap";
  asOfMs: number;
  receivedAtMs: number;
  replayAsOfMs: number | null;
  revision: string;
};

const payloadCache = new Map<string, { expiresAt: number; payload: HeatmapReceipt }>();

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

function newYorkSessionDate(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function replayPanel(panel: GexMapPanelPayload, cutoffMs: number): GexMapPanelPayload {
  const frames = panel.frames.filter((frame) => frame.timestamp <= cutoffMs);
  if (!frames.length) throw new QuantDataError("No options surface exists at or before the replay cutoff.", 422, null);
  const candles = panel.candles.filter((candle) => candle.timestamp <= cutoffMs);
  const sourcePrice = candles.at(-1)?.close;
  if (!(sourcePrice && sourcePrice > 0)) {
    throw new QuantDataError("No point-in-time options-source price exists at or before the replay cutoff.", 422, null);
  }
  const latestStrikes = latestGexMapStrikesFromFrames(frames);
  const netExposure = latestStrikes.reduce((total, row) => total + row.net, 0);
  const grossExposure = latestStrikes.reduce((total, row) => total + Math.abs(row.call) + Math.abs(row.put), 0);
  return {
    ...panel,
    asOf: new Date(cutoffMs).toISOString(),
    status: "LAST_SESSION",
    stockPrice: sourcePrice,
    latestStrikes,
    frames,
    candles,
    netExposure,
    grossExposure,
  };
}

function boundedReceipt(payload: GammaHeatmapPayload, receivedAtMs: number, replayAsOfMs: number | null): HeatmapReceipt {
  const snapshots = payload.snapshots.slice(-MAX_SNAPSHOTS);
  const totalBins = snapshots.reduce((total, snapshot) => {
    if (snapshot.bins.length > MAX_BINS_PER_SNAPSHOT) {
      throw new QuantDataError("The Gamma Heatmap surface exceeds the bounded per-snapshot bin contract.", 422, null);
    }
    return total + snapshot.bins.length;
  }, 0);
  if (totalBins > MAX_TOTAL_BINS || payload.levels.length > MAX_LEVELS) {
    throw new QuantDataError("The Gamma Heatmap surface exceeds the bounded desktop contract.", 422, null);
  }
  const current = snapshots.at(-1) ?? null;
  const asOfMs = replayAsOfMs ?? Date.parse(payload.asOf);
  if (!Number.isFinite(asOfMs) || asOfMs <= 0 || asOfMs > receivedAtMs + 60_000 ||
      snapshots.some((snapshot) => snapshot.timestamp > asOfMs)) {
    throw new QuantDataError("The Gamma Heatmap receipt is not point-in-time safe.", 502, null);
  }
  const normalized = {
    ...payload,
    asOf: new Date(asOfMs).toISOString(),
    status: replayAsOfMs === null ? payload.status : "LAST_SESSION" as const,
    marketClosed: replayAsOfMs !== null || payload.marketClosed,
    snapshots,
    current,
    levels: replayAsOfMs === null ? payload.levels : [],
  };
  const revision = createHash("sha256").update(JSON.stringify({
    display: normalized.displayInstrument,
    source: normalized.sourceInstrument,
    greek: normalized.greekMode,
    representation: normalized.representation,
    asOfMs,
    snapshots: snapshots.map((snapshot) => [snapshot.timestamp, snapshot.bins.length]),
    current: current?.bins.map((bin) => [bin.price, bin.call, bin.put, bin.net, bin.absolute, bin.change]) ?? [],
    levels: normalized.levels.map((level) => [level.kind, level.price, level.value]),
  })).digest("hex");
  return {
    ...normalized,
    id: "gamma-heatmap",
    asOfMs,
    receivedAtMs,
    replayAsOfMs,
    revision,
  };
}

function evictCache(receivedAtMs: number) {
  for (const [cacheKey, entry] of payloadCache) {
    if (entry.expiresAt <= receivedAtMs) payloadCache.delete(cacheKey);
  }
  while (payloadCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = payloadCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    payloadCache.delete(oldestKey);
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Gamma Heatmap options data is not configured." }, { status: 503 });

  const query = request.nextUrl.searchParams;
  const display = normalizeGammaHeatmapInstrument(query.get("display") || "NQ");
  const source = (query.get("source") || defaultGammaHeatmapSource(display)).trim().toUpperCase();
  const metric = (query.get("metric") || "GAMMA").trim().toUpperCase();
  const sourceMode = (query.get("sourceMode") || "hybrid") as GammaHeatmapSourceMode;
  const requestedSpot = Number(query.get("displayPrice"));
  const historyHours = Number(query.get("historyHours") || 24);
  const binSize = Number(query.get("binSize") || (display === "ES" || display === "MES" ? 1 : 5));
  const asOfText = query.get("asOf")?.trim() ?? "";
  const replayAsOfMs = asOfText ? Date.parse(asOfText) : null;
  const receivedAtMs = Date.now();

  if (!/^(NQ|MNQ|ES|MES)$/.test(display)) return NextResponse.json({ error: "Gamma Heatmap supports NQ, MNQ, ES and MES." }, { status: 400 });
  if (!OPTIONS_FLOW_TICKERS.includes(source as (typeof OPTIONS_FLOW_TICKERS)[number])) return NextResponse.json({ error: "Unsupported options source." }, { status: 400 });
  if (!/^(GAMMA|DELTA|DEX|VANNA|VEX|CHARM|CHEX)$/.test(metric)) return NextResponse.json({ error: "Unsupported heatmap metric." }, { status: 400 });
  if (!SOURCE_MODES.has(sourceMode)) return NextResponse.json({ error: "Unsupported source mode." }, { status: 400 });
  if (!Number.isFinite(historyHours) || historyHours < 1 || historyHours > 120 || !Number.isFinite(binSize) || binSize < 0.25 || binSize > 100) {
    return NextResponse.json({ error: "Gamma Heatmap history or bin size is outside the supported range." }, { status: 400 });
  }
  if (asOfText && (!Number.isFinite(replayAsOfMs) || replayAsOfMs! <= 0 || replayAsOfMs! > receivedAtMs || !(requestedSpot > 0))) {
    return NextResponse.json({ error: "A valid replay cutoff and point-in-time display price are required." }, { status: 400 });
  }
  if (sourceMode === "databento-raw") {
    return NextResponse.json({
      error: "Databento raw historical option-chain surfaces are not available on this adapter yet. Select Hybrid or QuantData; no substitute surface was shown.",
    }, { status: 422 });
  }

  const greekMode = gammaHeatmapGreek(metric);
  const futuresRoot = display === "ES" || display === "MES" ? "ES" : "NQ";

  try {
    const displayPrice = requestedSpot > 0 ? requestedSpot : await getNativeFuturesSpot(futuresRoot);
    if (!(displayPrice && displayPrice > 0)) throw new QuantDataError("The live futures price required for strike mapping is unavailable.", 422, null);
    const sessionDate = replayAsOfMs === null ? undefined : newYorkSessionDate(replayAsOfMs);
    const replayKey = replayAsOfMs === null ? "latest" : new Date(replayAsOfMs).toISOString();
    const key = [source, greekMode, display, sourceMode, historyHours, binSize, Math.round(displayPrice * 4) / 4, replayKey].join(":");
    const cached = payloadCache.get(key);
    if (cached && cached.expiresAt > receivedAtMs) {
      return conditionalJson(request, cached.payload, {
        identity: `${key}:${cached.payload.revision}`,
        maxAgeMs: cached.payload.refreshAfterMs,
      });
    }

    const loadedPanel = await getGexMapPanel(source, greekMode, sessionDate, "FRONT_EXPIRY", "PER_ONE_DOLLAR_MOVE");
    const panel = replayAsOfMs === null ? loadedPanel : replayPanel(loadedPanel, replayAsOfMs);
    const payload = buildGammaHeatmapPayload({ panel, displayInstrument: display, displayPrice, sourceMode, historyHours, binSize });
    const receipt = boundedReceipt(payload, receivedAtMs, replayAsOfMs);
    evictCache(receivedAtMs);
    payloadCache.set(key, {
      expiresAt: receivedAtMs + (replayAsOfMs === null ? Math.max(2_000, Math.min(15_000, receipt.refreshAfterMs)) : 86_400_000),
      payload: receipt,
    });
    return conditionalJson(request, receipt, {
      identity: `${key}:${receipt.revision}`,
      maxAgeMs: replayAsOfMs === null ? receipt.refreshAfterMs : 86_400_000,
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error, "Gamma Heatmap");
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
