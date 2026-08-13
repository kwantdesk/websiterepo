import { after, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  completedCmeDailyWindows,
  completedCmeWeeklyWindows,
  nextCmeDailyCompletion,
  type CmeProfileWindow,
} from "@/lib/cmeProfileWindows";
import {
  DATABENTO_FUTURES,
  getDatabentoValueAreaProfile,
  getDatabentoValueAreaProfiles,
} from "@/lib/databento";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";
import { futuresTickSize } from "@/lib/eventBars";
import {
  marketDataGatewayToken,
  marketDataGatewayUrlCandidates,
} from "@/lib/marketDataGatewayEnv";
import type { ValueAreaProfile } from "@/lib/valueArea";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

const MINIMUM_DAILY_TRADES = 500;
const MINIMUM_WEEKLY_TRADES = 2_500;

type ValueAreaPayload = {
  symbol: string;
  source: "CME";
  dataset: "GLBX.MDP3";
  method: "TRADE_BY_TRADE";
  valueAreaTarget: 0.7;
  generatedAt: string;
  nextRefreshAt: string;
  daily: ValueAreaProfile & {
    start: string;
    end: string;
    label: string;
  };
  weekly: ValueAreaProfile & {
    start: string;
    end: string;
    label: string;
  };
};

type CachedProfile = {
  expiresAt: number;
  promise: Promise<ValueAreaPayload>;
};

type CachedWindowProfile = {
  expiresAt: number;
  promise: Promise<ValueAreaProfile | null>;
};

const globalValueAreaCache = globalThis as typeof globalThis & {
  __kwantdeskValueArea?: Map<string, CachedProfile>;
  __kwantdeskValueAreaWindows?: Map<string, CachedWindowProfile>;
};
const valueAreaCache = globalValueAreaCache.__kwantdeskValueArea
  ?? (globalValueAreaCache.__kwantdeskValueArea = new Map<string, CachedProfile>());
const valueAreaWindowCache = globalValueAreaCache.__kwantdeskValueAreaWindows
  ?? (globalValueAreaCache.__kwantdeskValueAreaWindows = new Map<string, CachedWindowProfile>());

type ArchivedValueAreaProfile = ValueAreaProfile & {
  provider: "Rithmic";
  source: string;
  integrityGaps: number;
  droppedMessages: number;
};

function validArchivedProfile(value: unknown): value is ArchivedValueAreaProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<ArchivedValueAreaProfile>;
  return [
    profile.vah,
    profile.val,
    profile.poc,
    profile.vwap,
    profile.totalVolume,
    profile.tradeRecords,
    profile.firstTradeAt,
    profile.lastTradeAt,
  ].every((entry) => Number.isFinite(entry))
    && Number(profile.totalVolume) > 0
    && Number(profile.tradeRecords) > 0
    && Number(profile.integrityGaps ?? 0) === 0
    && Number(profile.droppedMessages ?? 0) === 0;
}

async function recordedWindowProfile(
  symbol: string,
  window: CmeProfileWindow,
): Promise<ValueAreaProfile | null> {
  const token = marketDataGatewayToken();
  if (!token) return null;
  const root = symbol.split(".")[0]?.toUpperCase();
  if (!root) return null;
  const query = new URLSearchParams({
    symbol: root,
    startMs: String(window.start),
    endMs: String(window.end),
  });
  for (const origin of marketDataGatewayUrlCandidates()) {
    try {
      const response = await fetch(
        `${origin}/v1/market-data/archive-value-area?${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(240_000),
        },
      );
      if (response.status === 404) return null;
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        continue;
      }
      const payload = await response.json() as unknown;
      return validArchivedProfile(payload) ? payload : null;
    } catch {
      continue;
    }
  }
  return null;
}

function durableWindowProfile(
  symbol: string,
  window: CmeProfileWindow,
  tickSize: number,
) {
  return unstable_cache(
    () => getDatabentoValueAreaProfile(
      symbol,
      new Date(window.start).toISOString(),
      new Date(window.end).toISOString(),
      tickSize,
    ),
    ["cme-value-area-v1", symbol, String(window.start), String(window.end), String(tickSize)],
    { revalidate: 8 * 24 * 60 * 60 },
  )();
}

function durableNestedWindowProfiles(
  symbol: string,
  dailyWindow: CmeProfileWindow,
  weeklyWindow: CmeProfileWindow,
  tickSize: number,
) {
  return unstable_cache(
    () => getDatabentoValueAreaProfiles(
      symbol,
      [dailyWindow, weeklyWindow].map((window) => ({
        start: new Date(window.start).toISOString(),
        end: new Date(window.end).toISOString(),
      })),
      tickSize,
    ),
    [
      "cme-value-area-nested-v1",
      symbol,
      String(dailyWindow.start),
      String(dailyWindow.end),
      String(weeklyWindow.start),
      String(weeklyWindow.end),
      String(tickSize),
    ],
    { revalidate: 8 * 24 * 60 * 60 },
  )();
}

async function nestedWindowProfiles(
  symbol: string,
  dailyWindow: CmeProfileWindow,
  weeklyWindow: CmeProfileWindow,
  tickSize: number,
) {
  try {
    return await durableNestedWindowProfiles(symbol, dailyWindow, weeklyWindow, tickSize);
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return getDatabentoValueAreaProfiles(
        symbol,
        [dailyWindow, weeklyWindow].map((window) => ({
          start: new Date(window.start).toISOString(),
          end: new Date(window.end).toISOString(),
        })),
        tickSize,
      );
    }
    throw error;
  }
}

async function durableOrDirectWindowProfile(
  symbol: string,
  window: CmeProfileWindow,
  tickSize: number,
) {
  try {
    return await durableWindowProfile(symbol, window, tickSize);
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return getDatabentoValueAreaProfile(
        symbol,
        new Date(window.start).toISOString(),
        new Date(window.end).toISOString(),
        tickSize,
      );
    }
    throw error;
  }
}

async function firstCompleteProfile(
  symbol: string,
  tickSize: number,
  windows: CmeProfileWindow[],
  minimumTrades: number,
) {
  for (const window of windows) {
    const cacheKey = `${symbol}:${window.start}:${window.end}:${tickSize}`;
    const now = Date.now();
    const cached = valueAreaWindowCache.get(cacheKey);
    const promise = cached && cached.expiresAt > now
      ? cached.promise
      : durableOrDirectWindowProfile(symbol, window, tickSize);
    if (!cached || cached.expiresAt <= now) {
      valueAreaWindowCache.set(cacheKey, {
        expiresAt: now + 8 * 24 * 60 * 60_000,
        promise,
      });
    }
    let profile: ValueAreaProfile | null;
    try {
      profile = await promise;
    } catch (error) {
      if (valueAreaWindowCache.get(cacheKey)?.promise === promise) {
        valueAreaWindowCache.delete(cacheKey);
      }
      const availableEndMs = Number((error as Error & { availableEndMs?: number })?.availableEndMs);
      // Databento's historical edge trails the live close. A newer window can
      // therefore be complete on CME while it is not complete in the vendor
      // archive yet. Keep walking backwards instead of failing the entire
      // value-area surface and painting no levels at all.
      if (Number.isFinite(availableEndMs) && availableEndMs < window.end) continue;
      throw error;
    }
    if (profile && profile.tradeRecords >= minimumTrades) {
      return { profile, window };
    }
  }
  return null;
}

export async function buildValueAreaPayload(symbol: string, now: number): Promise<ValueAreaPayload> {
  const tickSize = futuresTickSize(symbol);
  const dailyWindows = completedCmeDailyWindows(now);
  const weeklyWindows = completedCmeWeeklyWindows(now);
  if (!dailyWindows.length || !weeklyWindows.length) {
    throw new Error("No completed CME profile window is available.");
  }

  let daily: { profile: ValueAreaProfile; window: CmeProfileWindow } | null = null;
  let weekly: { profile: ValueAreaProfile; window: CmeProfileWindow } | null = null;
  const latestDaily = dailyWindows[0];
  const latestWeekly = weeklyWindows[0];
  const dailyInsideWeekly = latestDaily.start >= latestWeekly.start
    && latestDaily.end <= latestWeekly.end;

  // The always-on Rithmic collector records the just-finished session before
  // Databento's historical archive exposes its final hours. Prefer that exact
  // completed tape for PD VAH/VAL/POC/VWAP so Asia and Globex never lose the
  // newest levels while waiting for the historical vendor to catch up.
  const recordedDaily = await recordedWindowProfile(symbol, latestDaily);
  if (recordedDaily && recordedDaily.tradeRecords >= MINIMUM_DAILY_TRADES) {
    daily = { profile: recordedDaily, window: latestDaily };
  }

  // On the Sunday/Monday reopen, Friday's completed daily session is already
  // contained by the completed weekly profile. Build both accumulators during
  // one exact tick pass instead of downloading Friday twice.
  if (!daily && dailyInsideWeekly) {
    const [dailyProfile, weeklyProfile] = await nestedWindowProfiles(
      symbol,
      latestDaily,
      latestWeekly,
      tickSize,
    );
    if (dailyProfile && dailyProfile.tradeRecords >= MINIMUM_DAILY_TRADES) {
      daily = { profile: dailyProfile, window: latestDaily };
    }
    if (weeklyProfile && weeklyProfile.tradeRecords >= MINIMUM_WEEKLY_TRADES) {
      weekly = { profile: weeklyProfile, window: latestWeekly };
    }
  }

  if (!daily || !weekly) {
    const [dailyFallback, weeklyFallback] = await Promise.all([
      daily ? Promise.resolve(daily) : firstCompleteProfile(symbol, tickSize, dailyWindows, MINIMUM_DAILY_TRADES),
      weekly ? Promise.resolve(weekly) : firstCompleteProfile(symbol, tickSize, weeklyWindows, MINIMUM_WEEKLY_TRADES),
    ]);
    daily = dailyFallback;
    weekly = weeklyFallback;
  }
  if (!daily || !weekly) {
    throw new Error("CME did not return a complete prior-session and prior-week trade profile.");
  }

  const fellBackFromLatestDaily = daily.window.end < latestDaily.end;
  // A delayed Databento edge must not pin yesterday's fallback until the next
  // session close. Recheck regularly and promote the newest completed session
  // as soon as the final historical trades become available.
  const nextRefreshAt = fellBackFromLatestDaily
    ? Math.min(nextCmeDailyCompletion(now) + 5_000, now + 5 * 60_000)
    : nextCmeDailyCompletion(now) + 5_000;
  return {
    symbol,
    source: "CME",
    dataset: "GLBX.MDP3",
    method: "TRADE_BY_TRADE",
    valueAreaTarget: 0.7,
    generatedAt: new Date(now).toISOString(),
    nextRefreshAt: new Date(nextRefreshAt).toISOString(),
    daily: {
      ...daily.profile,
      start: new Date(daily.window.start).toISOString(),
      end: new Date(daily.window.end).toISOString(),
      label: daily.window.label,
    },
    weekly: {
      ...weekly.profile,
      start: new Date(weekly.window.start).toISOString(),
      end: new Date(weekly.window.end).toISOString(),
      label: weekly.window.label,
    },
  };
}

export async function GET(request: Request) {
  if (!vendorMarketDataConfigured("databento")) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedSymbol = searchParams.get("symbol")?.trim();
  const instrument = requestedSymbol
    ? DATABENTO_FUTURES.find((candidate) =>
        candidate.kind === "future"
        && candidate.symbol.toUpperCase() === requestedSymbol.toUpperCase())
    : null;
  if (!instrument) {
    return NextResponse.json({ error: "A valid CME futures symbol is required." }, { status: 400 });
  }
  const symbol = instrument.symbol;

  const asOfInput = searchParams.get("asOf")?.trim();
  const parsedAsOf = asOfInput ? Date.parse(asOfInput) : Date.now();
  const now = Number.isFinite(parsedAsOf) ? Math.min(parsedAsOf, Date.now()) : Number.NaN;
  if (!Number.isFinite(now) || now < Date.parse("2010-06-06T00:00:00.000Z")) {
    return NextResponse.json({ error: "A valid replay timestamp within CME historical coverage is required." }, { status: 400 });
  }
  const daily = completedCmeDailyWindows(now)[0];
  const weekly = completedCmeWeeklyWindows(now)[0];
  if (!daily || !weekly) {
    return NextResponse.json({ error: "No completed CME profile window is available." }, { status: 409 });
  }
  const cacheKey = `${symbol}:${daily.end}:${weekly.end}`;
  const cached = valueAreaCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    try {
      return NextResponse.json(await cached.promise, {
        headers: { "Cache-Control": asOfInput ? "private, max-age=86400, stale-while-revalidate=604800" : "public, s-maxage=60, stale-while-revalidate=300" },
      });
    } catch {
      valueAreaCache.delete(cacheKey);
    }
  }

  const promise = buildValueAreaPayload(symbol, now);
  const cacheEntry: CachedProfile = {
    // The resolved payload tightens or extends this. Five minutes is the
    // correct provisional ceiling when the latest historical close is late.
    expiresAt: now + 5 * 60_000,
    promise,
  };
  valueAreaCache.set(cacheKey, cacheEntry);
  // Detach the build from this request's lifetime. A cold build streams the
  // full prior-session and prior-week tick tape (measured: NQ ~15s, ES ~118s)
  // while chart clients abort at their own timeout - and an aborted invocation
  // used to die with the client, before the durable cache was ever written.
  // Every retry then started from zero: the cache stayed cold for 11 hours
  // after a session roll until one caller waited the build out. after() keeps
  // the invocation alive to completion, so the first request - even an
  // abandoned one - warms the cache and the next poll answers instantly.
  after(promise.catch(() => {}));
  try {
    const payload = await promise;
    const payloadRefreshAt = Date.parse(payload.nextRefreshAt);
    if (valueAreaCache.get(cacheKey)?.promise === promise) {
      cacheEntry.expiresAt = Number.isFinite(payloadRefreshAt)
        ? Math.max(now + 30_000, payloadRefreshAt)
        : now + 5 * 60_000;
    }
    return NextResponse.json(payload, {
      headers: { "Cache-Control": asOfInput ? "private, max-age=86400, stale-while-revalidate=604800" : "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (valueAreaCache.get(cacheKey)?.promise === promise) valueAreaCache.delete(cacheKey);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message.replaceAll("Databento", "CME")
          : "CME value-area calculation failed.",
      },
      { status: 502 },
    );
  }
}
