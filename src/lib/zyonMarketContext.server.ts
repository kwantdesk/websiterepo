import "server-only";

import { getDatabentoBars, type DatabentoBar } from "@/lib/databento";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";
import { getZyonOvernightMacroBrief } from "@/lib/macroIntelligence.server";
import { buildMarketSessionWindows } from "@/lib/marketSessions";
import { getKwantBotMarketContext } from "@/lib/kwantBotContext.server";
import type {
  KwantBotInterpreterMessage,
  KwantBotMarketContext,
  KwantBotMarketRoot,
  KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";
import {
  fetchInstitutionalMarketIndexSnapshots,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import { fetchMarketIndexSnapshots } from "@/lib/marketIndices.server";
import { createClient } from "@/lib/supabase/server";
import { buildZyonPriceAnalytics } from "@/lib/zyonPriceContext";

type WindowName = "1H" | "4H" | "1D" | "1W";
export type ZyonMarketContextFocus = "FULL" | "GAMMA";

export type ZyonMarketWindow = {
  window: WindowName;
  basis: "LATEST_MARKET_DATA";
  from: string;
  to: string;
  asOf: string;
  ageMs: number;
  bars: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  range: number;
  volume: number;
  vwap: number | null;
  averageBarRange: number;
  locationInRange: number | null;
  trend: "UP" | "DOWN" | "BALANCED";
  highAt: string;
  lowAt: string;
};

type HistoryCacheEntry = {
  value: ZyonPriceHistory | null;
  expiresAt: number;
  staleUntil: number;
  promise: Promise<ZyonPriceHistory> | null;
};

type ZyonPriceHistory = {
  intraday: DatabentoBar[];
  daily: DatabentoBar[];
};

const historyGlobal = globalThis as typeof globalThis & {
  __kwantdeskZyonHistory?: Map<KwantBotMarketRoot, HistoryCacheEntry>;
};
const historyCache = historyGlobal.__kwantdeskZyonHistory
  ?? (historyGlobal.__kwantdeskZyonHistory = new Map());

function timeout<T>(promise: Promise<T>, milliseconds: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out.`)), milliseconds);
      timer.unref?.();
    }),
  ]);
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function marketHistory(root: KwantBotMarketRoot) {
  const now = Date.now();
  const cached = historyCache.get(root);
  if (cached?.value && cached.expiresAt > now) return cached.value;
  if (cached?.promise) return cached.promise;

  const entry: HistoryCacheEntry = cached ?? {
    value: null,
    expiresAt: 0,
    staleUntil: 0,
    promise: null,
  };
  const request = timeout(
    Promise.all([
      getDatabentoBars(
        `${root}.v.0`,
        "1h",
        new Date(now - 8 * 24 * 60 * 60_000).toISOString(),
        new Date(now).toISOString(),
      ),
      timeout(
        getDatabentoBars(
          `${root}.v.0`,
          "1m",
          new Date(now - 3 * 60 * 60_000).toISOString(),
          new Date(now).toISOString(),
        ),
        4_000,
        "CME recent minute history",
      ).catch(() => [] as DatabentoBar[]),
      timeout(
        getDatabentoBars(
          `${root}.v.0`,
          "1D",
          new Date(now - 14 * 24 * 60 * 60_000).toISOString(),
          new Date(now).toISOString(),
        ),
        3_500,
        "CME daily history",
      ).catch(() => [] as DatabentoBar[]),
    ]).then(([hourly, recentMinutes, daily]) => {
      const firstRecentMinute = recentMinutes[0]?.timestamp ?? null;
      const recentHour = firstRecentMinute === null
        ? null
        : Math.floor(firstRecentMinute / (60 * 60_000)) * 60 * 60_000;
      const intraday = [
        ...hourly.filter((bar) => recentHour === null || bar.timestamp < recentHour),
        ...recentMinutes,
      ].sort((left, right) => left.timestamp - right.timestamp);
      return { intraday, daily };
    }),
    15_000,
    "CME history",
  )
    .then((rawHistory) => {
      const normalizeBars = (rawBars: DatabentoBar[]) => rawBars.map((bar) => ({
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: Number(bar.volume ?? 0),
      }));
      const history = {
        intraday: normalizeBars(rawHistory.intraday),
        daily: normalizeBars(rawHistory.daily),
      };
      entry.value = history;
      entry.expiresAt = Date.now() + 60_000;
      entry.staleUntil = Date.now() + 6 * 60 * 60_000;
      return history;
    })
    .catch((error) => {
      if (entry.value?.intraday.length && entry.staleUntil > Date.now()) return entry.value;
      throw error;
    })
    .finally(() => {
      entry.promise = null;
    });
  entry.promise = request;
  historyCache.set(root, entry);
  // Price windows are supporting evidence for chat. Keep serving the last
  // verified bars while the one shared refresh runs instead of blocking every
  // market question on a ten-day historical request.
  if (entry.value?.intraday.length && entry.staleUntil > now) {
    void request.catch(() => undefined);
    return entry.value;
  }
  return request;
}

function summarizePricePath(allBars: DatabentoBar[], now: number) {
  const latest = allBars.at(-1);
  if (!latest) return null;
  const bars = allBars.filter((bar) => bar.timestamp >= latest.timestamp - 24 * 60 * 60_000);
  const first = bars[0] ?? latest;
  const highBar = bars.reduce((best, bar) => bar.high > best.high ? bar : best, first);
  const lowBar = bars.reduce((best, bar) => bar.low < best.low ? bar : best, first);
  const current = latest.close;
  const sequence = highBar.timestamp <= lowBar.timestamp
    ? `Opened near ${first.open}, rallied to ${highBar.high}, pulled back to ${lowBar.low}, and is now ${current}.`
    : `Opened near ${first.open}, sold to ${lowBar.low}, rallied to ${highBar.high}, and is now ${current}.`;
  const sessions = buildMarketSessionWindows(bars, { lookbackDays: 3 })
    .filter((session) => session.endTimestamp >= latest.timestamp - 36 * 60 * 60_000)
    .sort((left, right) => left.startTimestamp - right.startTimestamp)
    .slice(-8)
    .map((session) => ({
      name: session.label,
      from: new Date(session.startTimestamp).toISOString(),
      to: new Date(session.endTimestamp).toISOString(),
      open: session.open,
      high: session.high,
      highAt: new Date(session.highTimestamp).toISOString(),
      low: session.low,
      lowAt: new Date(session.lowTimestamp).toISOString(),
      close: session.close,
      change: session.close - session.open,
    }));
  return {
    basis: "LATEST_24H_CME_1H_PLUS_RECENT_1M" as const,
    asOf: new Date(latest.timestamp).toISOString(),
    ageMs: Math.max(0, now - latest.timestamp),
    open: first.open,
    high: highBar.high,
    highAt: new Date(highBar.timestamp).toISOString(),
    low: lowBar.low,
    lowAt: new Date(lowBar.timestamp).toISOString(),
    current,
    change: current - first.open,
    pullbackFromHigh: current - highBar.high,
    recoveryFromLow: current - lowBar.low,
    sequence,
    sessions,
  };
}

function summarizeWindow(
  allBars: DatabentoBar[],
  name: WindowName,
  durationMs: number,
  now: number,
): ZyonMarketWindow | null {
  const latest = allBars.at(-1);
  if (!latest) return null;
  const end = latest.timestamp + (name === "1W" ? 24 * 60 * 60_000 : 5 * 60_000);
  const start = end - durationMs;
  const bars = allBars.filter((bar) => bar.timestamp >= start && bar.timestamp < end);
  if (!bars.length) return null;
  const first = bars[0];
  const last = bars.at(-1) ?? first;
  const highBar = bars.reduce((best, bar) => bar.high > best.high ? bar : best, first);
  const lowBar = bars.reduce((best, bar) => bar.low < best.low ? bar : best, first);
  const high = highBar.high;
  const low = lowBar.low;
  const range = high - low;
  const change = last.close - first.open;
  const volume = bars.reduce((sum, bar) => sum + Math.max(0, bar.volume), 0);
  const weighted = bars.reduce(
    (sum, bar) => sum + ((bar.high + bar.low + bar.close) / 3) * Math.max(0, bar.volume),
    0,
  );
  const averageBarRange = bars.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / bars.length;
  const directionalThreshold = Math.max(range * 0.12, averageBarRange);
  return {
    window: name,
    basis: "LATEST_MARKET_DATA",
    from: new Date(first.timestamp).toISOString(),
    to: new Date(end).toISOString(),
    asOf: new Date(latest.timestamp).toISOString(),
    ageMs: Math.max(0, now - latest.timestamp),
    bars: bars.length,
    open: first.open,
    high,
    low,
    close: last.close,
    change,
    changePercent: first.open ? (change / first.open) * 100 : 0,
    range,
    volume,
    vwap: volume > 0 ? weighted / volume : null,
    averageBarRange,
    locationInRange: range > 0 ? (last.close - low) / range : null,
    trend: change > directionalThreshold
      ? "UP"
      : change < -directionalThreshold
        ? "DOWN"
        : "BALANCED",
    highAt: new Date(highBar.timestamp).toISOString(),
    lowAt: new Date(lowBar.timestamp).toISOString(),
  };
}

function payloadObjects<T>(rows: Array<{ payload?: unknown }> | null) {
  return (rows ?? []).flatMap((row) =>
    row.payload && typeof row.payload === "object" ? [row.payload as T] : []);
}

async function archivedMarketMemory(actorId: string, root: KwantBotMarketRoot) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const [messagesResult, memoryResult, contextResult] = await Promise.all([
    supabase
      .from("kwantbot_messages")
      .select("payload,created_at")
      .eq("user_id", actorId)
      .eq("root", root)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("kwantbot_memory_events")
      .select("payload,created_at")
      .eq("user_id", actorId)
      .eq("root", root)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(180),
    supabase
      .from("kwantbot_context_snapshots")
      .select("payload,generated_at")
      .eq("user_id", actorId)
      .eq("root", root)
      .gte("generated_at", since)
      .order("generated_at", { ascending: false })
      .limit(12),
  ]);
  const error = messagesResult.error ?? memoryResult.error ?? contextResult.error;
  if (error) throw new Error(error.message);
  return {
    recentInterpreterMessages: payloadObjects<KwantBotInterpreterMessage>(messagesResult.data)
      .reverse()
      .slice(-40),
    recentMemory: payloadObjects<KwantBotMemoryEvent>(memoryResult.data)
      .filter((event) => event.type !== "price")
      .reverse()
      .slice(-80),
    contextCheckpoints: payloadObjects<KwantBotMarketContext>(contextResult.data)
      .reverse()
      .slice(-8)
      .map((context) => ({
        generatedAt: context.generatedAt,
        sessionDate: context.sessionDate,
        status: context.status,
        currentPrice: context.currentPrice,
        futuresStatus: context.futuresStatus,
        oneLiner: context.oneLiner,
        gammaRegime: context.options.gammaRegime,
        gammaStrength: context.options.gammaStrength,
        volatilityState: context.options.volatilityState,
        netPremium: context.options.netPremium,
        bullishShare: context.options.bullishShare,
        majorPositiveGamma: context.options.majorPositiveGamma,
        majorNegativeGamma: context.options.majorNegativeGamma,
      })),
  };
}

function calendarDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export async function getZyonMarketContext(
  root: KwantBotMarketRoot,
  actorId: string,
  focus: ZyonMarketContextFocus = "FULL",
) {
  const now = Date.now();
  const gammaFocused = focus === "GAMMA";
  const relatedMarketSymbols = root === "NQ" ? ["VXN", "VIX"] : ["VIX", "VXN"];
  const relatedMarketsPromise = gammaFocused
    ? Promise.resolve([])
    : isInstitutionalMarketDataConfigured()
      ? fetchInstitutionalMarketIndexSnapshots(relatedMarketSymbols, 3_000)
      : fetchMarketIndexSnapshots(relatedMarketSymbols);
  const results = await Promise.allSettled([
    timeout(getKwantBotMarketContext(root), gammaFocused ? 2_600 : 4_500, "options context"),
    timeout(marketHistory(root), gammaFocused ? 3_500 : 8_500, "CME history"),
    gammaFocused
      ? Promise.resolve(null)
      : timeout(archivedMarketMemory(actorId, root), 2_500, "market memory"),
    timeout(relatedMarketsPromise, 3_500, "market indices"),
    gammaFocused
      ? Promise.resolve(null)
      : timeout(getEconomicCalendar(
        calendarDate(now - 12 * 60 * 60_000),
        calendarDate(now + 48 * 60 * 60_000),
      ), 3_500, "economic calendar"),
    gammaFocused
      ? Promise.resolve(null)
      : timeout(getZyonOvernightMacroBrief(), 4_000, "overnight macro brief"),
  ] as const);

  const warnings: string[] = [];
  const rawCurrent = results[0].status === "fulfilled" ? results[0].value : null;
  const current = rawCurrent?.priceDomain === "OPTIONS_UNDERLYING"
    ? {
        ...rawCurrent,
        optionsUnderlyingPrice: rawCurrent.currentPrice,
        currentPrice: null,
        levels: [],
        scenarios: [],
        oneLiner: `${rawCurrent.sourceSymbol} options positioning is available, but no verified ${root} futures calibration is attached to this frame.`,
      }
    : rawCurrent;
  const history = results[1].status === "fulfilled"
    ? results[1].value
    : { intraday: [], daily: [] };
  const bars = history.intraday;
  const archive = results[2].status === "fulfilled" ? results[2].value : null;
  const indices = results[3].status === "fulfilled" ? results[3].value : [];
  const calendar = results[4].status === "fulfilled" ? results[4].value : null;
  const overnightMacro = results[5].status === "fulfilled" ? results[5].value : null;
  if (results[0].status === "rejected") warnings.push(`Options/Gameplan: ${messageOf(results[0].reason)}`);
  if (results[1].status === "rejected") warnings.push(`CME history: ${messageOf(results[1].reason)}`);
  if (results[2].status === "rejected") warnings.push(`Account market memory: ${messageOf(results[2].reason)}`);
  if (results[3].status === "rejected") warnings.push(`Market indices: ${messageOf(results[3].reason)}`);
  if (results[4].status === "rejected") warnings.push(`Economic calendar: ${messageOf(results[4].reason)}`);
  if (results[5].status === "rejected") warnings.push(`Overnight macro: ${messageOf(results[5].reason)}`);
  if (current?.options.errors.length) {
    warnings.push(...current.options.errors.map((error: string) => `Options context: ${error}`));
  }
  if (results[3].status === "fulfilled" && !indices.length) {
    warnings.push("Related volatility indices are unavailable or not configured.");
  }

  const usdEvents = (calendar?.events ?? [])
    .filter((event) => event.currency === "USD")
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
    .slice(0, 30);
  const latestBar = bars.at(-1) ?? null;
  const priceAnalytics = buildZyonPriceAnalytics(bars);
  return {
    authority: "KWANT_DESK_SERVER",
    focus,
    root,
    generatedAt: new Date(now).toISOString(),
    current,
    priceHistory: {
      symbol: `${root}.v.0`,
      source: "CME",
      latestBarAt: latestBar ? new Date(latestBar.timestamp).toISOString() : null,
      latestPrice: latestBar?.close ?? null,
      latestPriceAgeMs: latestBar ? Math.max(0, now - latestBar.timestamp) : null,
      path: summarizePricePath(bars, now),
      basis: "CME_1H_PLUS_RECENT_1M" as const,
      sessions: priceAnalytics.sessions,
      structure: priceAnalytics.structure,
      windows: {
        oneHour: summarizeWindow(bars, "1H", 60 * 60_000, now),
        fourHour: summarizeWindow(bars, "4H", 4 * 60 * 60_000, now),
        oneDay: summarizeWindow(bars, "1D", 24 * 60 * 60_000, now),
        oneWeek: summarizeWindow(history.daily, "1W", 7 * 24 * 60 * 60_000, now),
      },
    },
    marketMemory: archive,
    relatedMarkets: indices,
    economicCalendar: calendar ? {
      provider: calendar.provider,
      fetchedAt: calendar.fetchedAt,
      partial: calendar.partial,
      note: calendar.note,
      usdEvents,
    } : null,
    overnightMacro,
    warnings,
  };
}
