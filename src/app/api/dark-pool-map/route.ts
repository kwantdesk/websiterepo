import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  DARK_POOL_MAP_SCHEMA_VERSION,
  aggregateDarkPoolLevels,
  clusterDarkPoolZones,
  createMappingReceipt,
  deduplicateDarkPoolPrints,
  defaultDarkPoolMapSettings,
  defaultDarkPoolSource,
  mapDarkPoolPrint,
  normalizeDarkPoolInstrument,
  normalizeDarkPoolPrint,
  type DarkPoolMapPayload,
  type DarkPoolMapSettings,
  type DarkPoolMappingMode,
  type DarkPoolMappingReceipt,
  type DarkPoolPrint,
} from "@/lib/darkPoolMap";
import {
  getConfiguredQuantDataApiKey,
  getDarkPoolLevelsPayload,
  getDarkPoolPrintsPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const maxDuration = 60;

const mappingSamples = new Map<string, Array<{ source: number; display: number; timeMs: number }>>();
const frozenPrintMappings = new Map<string, DarkPoolMappingReceipt>();

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

function finite(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectRows(payload: unknown) {
  const rows: unknown[] = [];
  const walk = (value: unknown, depth: number) => {
    if (depth > 5 || value == null) return;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (record(entry) && (entry.PRICE != null || entry.price != null) && (entry.TRADE_TIME != null || entry.tradeTime != null || entry.timestamp != null)) rows.push(entry);
        else walk(entry, depth + 1);
      }
      return;
    }
    if (!record(value)) return;
    if ((value.PRICE != null || value.price != null) && (value.TRADE_TIME != null || value.tradeTime != null || value.timestamp != null)) {
      rows.push(value);
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (["data", "rows", "results", "items", "prints", "records", "equityPrints"].includes(key)) {
        walk(entry, depth + 1);
      }
    }
  };
  walk(payload, 0);
  return rows;
}

function readLatestStockPrice(payload: unknown) {
  if (!record(payload)) return null;
  const direct = finite(payload.latestStockPrice);
  if (direct && direct > 0) return direct;
  if (record(payload.data)) {
    const nested = finite(payload.data.latestStockPrice);
    if (nested && nested > 0) return nested;
  }
  return null;
}

function readBaseline(payload: unknown) {
  const root = record(payload) && record(payload.data) ? payload.data : payload;
  const levelMap = record(root) && record(root.data) ? root.data : root;
  if (!record(levelMap)) return null;
  let levelCount = 0;
  let totalNotional = 0;
  for (const [price, value] of Object.entries(levelMap)) {
    if (!Number.isFinite(Number(price)) || !record(value)) continue;
    const notional = finite(value.notionalValue) ?? 0;
    if (notional <= 0) continue;
    levelCount += 1;
    totalNotional += notional;
  }
  return { latestStockPrice: readLatestStockPrice(payload), levelCount, totalNotional };
}

function nyDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function settingsFromRequest(request: NextRequest): DarkPoolMapSettings {
  const query = request.nextUrl.searchParams;
  const number = (key: string, fallback: number) => finite(query.get(key)) ?? fallback;
  const bool = (key: string, fallback: boolean) => query.has(key) ? query.get(key) !== "false" : fallback;
  return {
    ...defaultDarkPoolMapSettings,
    historyDays: Math.max(1, Math.min(365, number("historyDays", defaultDarkPoolMapSettings.historyDays))),
    pollSeconds: Math.max(1, Math.min(30, number("pollSeconds", defaultDarkPoolMapSettings.pollSeconds))),
    minimumPrintNotional: Math.max(0, number("minimumPrintNotional", defaultDarkPoolMapSettings.minimumPrintNotional)),
    maximumPrintNotional: Math.max(0, number("maximumPrintNotional", 0)),
    minimumPrintShares: Math.max(0, number("minimumPrintShares", 0)),
    maximumPrintShares: Math.max(0, number("maximumPrintShares", 0)),
    minimumLevelNotional: Math.max(0, number("minimumLevelNotional", defaultDarkPoolMapSettings.minimumLevelNotional)),
    minimumLevelShares: Math.max(0, number("minimumLevelShares", 0)),
    minimumTradeCount: Math.max(1, number("minimumTradeCount", 1)),
    topLevels: Math.max(1, Math.min(200, number("topLevels", 50))),
    minimumStrengthScore: Math.max(0, Math.min(100, number("minimumStrengthScore", 30))),
    mappedBinPoints: Math.max(0.01, number("mappedBinPoints", 2)),
    sourceBinCents: Math.max(1, number("sourceBinCents", 5)),
    displayTickMultiple: Math.max(1, number("displayTickMultiple", 4)),
    mergeNearbyLevels: bool("mergeNearbyLevels", true),
    mergeTolerancePoints: Math.max(0, number("mergeTolerancePoints", 3)),
    maximumZoneWidthPoints: Math.max(0.25, number("maximumZoneWidthPoints", 20)),
    recencyHalfLifeHours: Math.max(0.25, number("recencyHalfLifeHours", 24)),
    mappingWindowMinutes: Math.max(5, number("mappingWindowMinutes", 60)),
    minimumMappingSamples: Math.max(2, number("minimumMappingSamples", 120)),
    minimumMappingR2: Math.max(0, Math.min(1, number("minimumMappingR2", 0.95))),
    sessionsForFullPersistenceScore: Math.max(1, number("sessionsForFullPersistenceScore", 5)),
    showDelayedPrints: bool("showDelayedPrints", true),
    includeDelayedInLevels: bool("includeDelayedInLevels", true),
    includeAskSide: bool("includeAskSide", true),
    includeBidSide: bool("includeBidSide", true),
    includeMid: bool("includeMid", true),
    includeUnknown: bool("includeUnknown", true),
    priceBinMode: (query.get("priceBinMode") || "mapped-points") as DarkPoolMapSettings["priceBinMode"],
  };
}

function addMappingSample(key: string, source: number | null, display: number | null, nowMs: number, windowMinutes: number) {
  if (!(source && display && source > 0 && display > 0)) return [];
  const samples = [...(mappingSamples.get(key) ?? []), { source, display, timeMs: nowMs }]
    .filter((sample) => sample.timeMs >= nowMs - windowMinutes * 60_000)
    .slice(-1_000);
  mappingSamples.set(key, samples);
  return samples.map(({ source: nextSource, display: nextDisplay }) => ({ source: nextSource, display: nextDisplay }));
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!getConfiguredQuantDataApiKey()) return NextResponse.json({ error: "Dark Pool Map requires the configured QuantData equity-print entitlement." }, { status: 503 });

  const query = request.nextUrl.searchParams;
  const displayInstrument = normalizeDarkPoolInstrument(query.get("display") || "NQ");
  const sourceTicker = (query.get("source") || defaultDarkPoolSource(displayInstrument)).toUpperCase().replace(/[^A-Z.]/g, "");
  const displayPrice = finite(query.get("displayPrice"));
  const mappingMode = (query.get("mappingMode") || "rolling-affine") as DarkPoolMappingMode;
  const direct = sourceTicker === displayInstrument;
  const settings = settingsFromRequest(request);
  const nowMs = Date.now();
  const endDate = nyDate(new Date(nowMs));
  const startDate = nyDate(new Date(nowMs - settings.historyDays * 86_400_000));
  // Dark Pool GEX uses a one-page request for first paint and enriches it with
  // deeper history in the background. Do not silently turn that fast path
  // back into a ten-page cursor walk.
  const maximumRows = Math.max(100, Math.min(100_000, Math.round(finite(query.get("maximumHistoricalPrints")) ?? 100_000)));

  try {
    const [levelsPayload, printsPayload] = await Promise.all([
      getDarkPoolLevelsPayload(sourceTicker, startDate, endDate),
      getDarkPoolPrintsPayload(sourceTicker, startDate, endDate, maximumRows, settings.minimumPrintNotional),
    ]);
    const baseline = readBaseline(levelsPayload);
    const prints = deduplicateDarkPoolPrints(collectRows(printsPayload).map(normalizeDarkPoolPrint).filter((print): print is DarkPoolPrint => Boolean(print)));
    const sourceMid = baseline?.latestStockPrice ?? prints.at(-1)?.price ?? null;
    const sampleKey = `${sourceTicker}:${displayInstrument}`;
    const samples = addMappingSample(sampleKey, sourceMid, direct ? sourceMid : displayPrice, nowMs, settings.mappingWindowMinutes);
    const receipt = createMappingReceipt({
      mode: mappingMode,
      direct,
      sourceMid,
      displayMid: direct ? sourceMid : displayPrice,
      samples,
      alpha: finite(query.get("manualAlpha")) ?? 0,
      beta: finite(query.get("manualBeta")) ?? 1,
      minimumSamples: settings.minimumMappingSamples,
      minimumR2: settings.minimumMappingR2,
      calculatedAtMs: nowMs,
    });
    if (!receipt) {
      const payload: DarkPoolMapPayload = { schemaVersion: DARK_POOL_MAP_SCHEMA_VERSION, provider: "quantdata", sourceTicker, displayInstrument, direct, status: "UNAVAILABLE", checkedAtMs: nowMs, dataAgeMs: null, pollIntervalMs: settings.pollSeconds * 1_000, mapping: null, prints: [], levels: [], zones: [], baseline, limitations: [`${sourceTicker} dark-pool data is available, but a valid ${sourceTicker} → ${displayInstrument} mapping is not currently available. No guessed futures levels were drawn.`] };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
    }
    const mapped = prints.map((print) => {
      const frozenKey = `${sampleKey}:${print.id}`;
      const historicalReceipt = frozenPrintMappings.get(frozenKey) ?? { ...receipt };
      frozenPrintMappings.set(frozenKey, historicalReceipt);
      return mapDarkPoolPrint(print, displayInstrument, historicalReceipt);
    });
    if (frozenPrintMappings.size > 200_000) {
      for (const key of frozenPrintMappings.keys()) {
        frozenPrintMappings.delete(key);
        if (frozenPrintMappings.size <= 150_000) break;
      }
    }
    const levels = aggregateDarkPoolLevels(mapped, settings, nowMs);
    const zones = clusterDarkPoolZones(levels, settings);
    const latestTradeTime = mapped.at(-1)?.tradeTimeMs ?? null;
    const dataAgeMs = latestTradeTime ? Math.max(0, nowMs - latestTradeTime) : null;
    const mappingStale = nowMs - receipt.calculatedAtMs > settings.staleAllowanceSeconds * 1_000;
    const status = mappingStale ? "MAPPING_STALE" : dataAgeMs !== null && dataAgeMs > 15 * 60_000 ? "CACHED" : "LIVE";
    const limitations = [
      direct
        ? `${sourceTicker} uses native off-exchange prints and levels in ${displayInstrument} price space.`
        : `${sourceTicker} is the tradable off-exchange source mapped to ${displayInstrument}; ${displayInstrument} itself does not publish dark-pool executions.`,
      "Trade-side labels describe execution location relative to the quote, not participant identity or intent.",
      ...(direct ? [] : ["Historical prints retain the first valid mapping receipt observed by this adapter; the current provider endpoint does not supply a pre-ingestion cross-instrument mapping history."]),
    ];
    if (record(printsPayload) && printsPayload.truncated === true) limitations.push("The initial provider cursor walk reached its bounded serverless page limit; newer head pages continue merging into the retained browser history without blocking the chart.");
    if (!mapped.length && baseline?.levelCount) limitations.push("Aggregate levels are available, but timestamped prints were unavailable. No fake historical circles were painted from aggregate totals.");
    const payload: DarkPoolMapPayload = { schemaVersion: DARK_POOL_MAP_SCHEMA_VERSION, provider: "quantdata", sourceTicker, displayInstrument, direct, status, checkedAtMs: nowMs, dataAgeMs, pollIntervalMs: settings.pollSeconds * 1_000, mapping: receipt, prints: mapped.slice(-maximumRows), levels, zones, baseline, limitations };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json({ error: problem.message }, { status: problem.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
