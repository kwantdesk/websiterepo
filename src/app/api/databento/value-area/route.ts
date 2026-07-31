import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  completedCmeDailyWindows,
  completedCmeWeeklyWindows,
  nextCmeDailyCompletion,
  type CmeProfileWindow,
} from "@/lib/cmeProfileWindows";
import { DATABENTO_FUTURES, getDatabentoValueAreaProfile } from "@/lib/databento";
import { futuresTickSize } from "@/lib/eventBars";
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
      throw error;
    }
    if (profile && profile.tradeRecords >= minimumTrades) {
      return { profile, window };
    }
  }
  return null;
}

async function buildValueAreaPayload(symbol: string, now: number): Promise<ValueAreaPayload> {
  const tickSize = futuresTickSize(symbol);
  const dailyWindows = completedCmeDailyWindows(now);
  const weeklyWindows = completedCmeWeeklyWindows(now);
  if (!dailyWindows.length || !weeklyWindows.length) {
    throw new Error("No completed CME profile window is available.");
  }

  const [daily, weekly] = await Promise.all([
    firstCompleteProfile(symbol, tickSize, dailyWindows, MINIMUM_DAILY_TRADES),
    firstCompleteProfile(symbol, tickSize, weeklyWindows, MINIMUM_WEEKLY_TRADES),
  ]);
  if (!daily || !weekly) {
    throw new Error("CME did not return a complete prior-session and prior-week trade profile.");
  }

  const nextRefreshAt = nextCmeDailyCompletion(now) + 5_000;
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
  if (!process.env.DATABENTO_API_KEY) {
    return NextResponse.json({ error: "CME market data is not configured." }, { status: 503 });
  }

  const requestedSymbol = new URL(request.url).searchParams.get("symbol")?.trim();
  const instrument = requestedSymbol
    ? DATABENTO_FUTURES.find((candidate) =>
        candidate.kind === "future"
        && candidate.symbol.toUpperCase() === requestedSymbol.toUpperCase())
    : null;
  if (!instrument) {
    return NextResponse.json({ error: "A valid CME futures symbol is required." }, { status: 400 });
  }
  const symbol = instrument.symbol;

  const now = Date.now();
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
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      });
    } catch {
      valueAreaCache.delete(cacheKey);
    }
  }

  const promise = buildValueAreaPayload(symbol, now);
  valueAreaCache.set(cacheKey, {
    expiresAt: nextCmeDailyCompletion(now) + 60_000,
    promise,
  });
  try {
    const payload = await promise;
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
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
