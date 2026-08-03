import "server-only";

import { getDatabentoBars, type DatabentoBar } from "@/lib/databento";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";
import { getKwantBotMarketContext } from "@/lib/kwantBotContext.server";
import type {
  KwantBotInterpreterMessage,
  KwantBotMarketContext,
  KwantBotMarketRoot,
  KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";
import { fetchMarketIndexSnapshots } from "@/lib/marketIndices.server";
import { createClient } from "@/lib/supabase/server";

type WindowName = "1H" | "1D" | "1W";

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
  value: DatabentoBar[] | null;
  expiresAt: number;
  staleUntil: number;
  promise: Promise<DatabentoBar[]> | null;
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
    getDatabentoBars(
      `${root}.v.0`,
      "1m",
      new Date(now - 10 * 24 * 60 * 60_000).toISOString(),
      new Date(now).toISOString(),
    ),
    15_000,
    "CME history",
  )
    .then((rawBars) => {
      const bars: DatabentoBar[] = rawBars.map((bar) => ({
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: Number(bar.volume ?? 0),
      }));
      entry.value = bars;
      entry.expiresAt = Date.now() + 30_000;
      entry.staleUntil = Date.now() + 30 * 60_000;
      return bars;
    })
    .catch((error) => {
      if (entry.value?.length && entry.staleUntil > Date.now()) return entry.value;
      throw error;
    })
    .finally(() => {
      entry.promise = null;
    });
  entry.promise = request;
  historyCache.set(root, entry);
  return request;
}

function summarizeWindow(
  allBars: DatabentoBar[],
  name: WindowName,
  durationMs: number,
  now: number,
): ZyonMarketWindow | null {
  const latest = allBars.at(-1);
  if (!latest) return null;
  const end = latest.timestamp + 60_000;
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
) {
  const now = Date.now();
  const results = await Promise.allSettled([
    timeout(getKwantBotMarketContext(root), 5_500, "options context"),
    timeout(marketHistory(root), 5_500, "CME history"),
    timeout(archivedMarketMemory(actorId, root), 2_500, "market memory"),
    timeout(fetchMarketIndexSnapshots(root === "NQ" ? ["VXN", "VIX"] : ["VIX", "VXN"]), 4_000, "market indices"),
    timeout(getEconomicCalendar(
      calendarDate(now - 12 * 60 * 60_000),
      calendarDate(now + 48 * 60 * 60_000),
    ), 4_000, "economic calendar"),
  ] as const);

  const warnings: string[] = [];
  const current = results[0].status === "fulfilled" ? results[0].value : null;
  const bars = results[1].status === "fulfilled" ? results[1].value : [];
  const archive = results[2].status === "fulfilled" ? results[2].value : null;
  const indices = results[3].status === "fulfilled" ? results[3].value : [];
  const calendar = results[4].status === "fulfilled" ? results[4].value : null;
  if (results[0].status === "rejected") warnings.push(`Options/Gameplan: ${messageOf(results[0].reason)}`);
  if (results[1].status === "rejected") warnings.push(`CME history: ${messageOf(results[1].reason)}`);
  if (results[2].status === "rejected") warnings.push(`Account market memory: ${messageOf(results[2].reason)}`);
  if (results[3].status === "rejected") warnings.push(`Market indices: ${messageOf(results[3].reason)}`);
  if (results[4].status === "rejected") warnings.push(`Economic calendar: ${messageOf(results[4].reason)}`);
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
  return {
    authority: "KWANT_DESK_SERVER",
    root,
    generatedAt: new Date(now).toISOString(),
    current,
    priceHistory: {
      symbol: `${root}.v.0`,
      source: "CME",
      latestBarAt: latestBar ? new Date(latestBar.timestamp).toISOString() : null,
      windows: {
        oneHour: summarizeWindow(bars, "1H", 60 * 60_000, now),
        oneDay: summarizeWindow(bars, "1D", 24 * 60 * 60_000, now),
        oneWeek: summarizeWindow(bars, "1W", 7 * 24 * 60 * 60_000, now),
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
    warnings,
  };
}
