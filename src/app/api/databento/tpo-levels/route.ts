import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { nextCmeDailyCompletion } from "@/lib/cmeProfileWindows";
import {
  DatabentoTpoAuthError,
  getDatabentoTpoSessions,
} from "@/lib/databentoTpo.server";
import {
  completedNqRthWindows,
  computeTpoLevels,
  DEFAULT_TPO_ENGINE_CONFIG,
  nextNqRthCompletion,
  staleTpoPayload,
  type TpoEngineConfig,
  type TpoLevelsPayload,
} from "@/lib/tpoLevels";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "iad1";

type CachedPayload = { expiresAt: number; promise: Promise<TpoLevelsPayload> };
const globalTpoCache = globalThis as typeof globalThis & {
  __kwantdeskTpoLevels?: Map<string, CachedPayload>;
  __kwantdeskTpoLastGood?: TpoLevelsPayload;
};
const memoryCache = globalTpoCache.__kwantdeskTpoLevels
  ?? (globalTpoCache.__kwantdeskTpoLevels = new Map<string, CachedPayload>());

export async function buildTpoLevelsPayload(
  now: number,
  requestedConfig: Partial<TpoEngineConfig> = {},
): Promise<TpoLevelsPayload> {
  const config = { ...DEFAULT_TPO_ENGINE_CONFIG, ...requestedConfig };
  const windows = completedNqRthWindows(now, 10);
  if (windows.length < 5) throw new Error("TPO Levels requires at least five completed NQ RTH sessions.");
  const sessions = await getDatabentoTpoSessions(windows);
  const result = computeTpoLevels(sessions, {
    currentPrice: sessions.at(-1)?.trades.at(-1)?.price ?? null,
    config,
  });
  const generatedAt = new Date(now).toISOString();
  const nextRefreshAt = Math.min(nextNqRthCompletion(now), nextCmeDailyCompletion(now)) + 5_000;
  return {
    generatedAt,
    nextRefreshAt: new Date(nextRefreshAt).toISOString(),
    sourceSessions: result.sourceSessions,
    excludedSessions: result.excludedSessions,
    dataAge: 0,
    stale: false,
    zones: result.zones,
    replay: result.replay,
    currentPrice: result.currentPrice,
    source: {
      dataset: "GLBX.MDP3",
      schema: "trades",
      instrument: "NQ front-month outright",
      rowSize: config.rowSize,
      session: "09:30-16:00 America/New_York",
    },
  };
}

function durablePayload(now: number, generationKey: string, config: Partial<TpoEngineConfig>) {
  return unstable_cache(
    () => buildTpoLevelsPayload(now, config),
    ["nq-tpo-levels-v1", generationKey],
    // Each completed profile is immutable. The generation key changes after
    // the next CME daily completion, while this retained copy provides a
    // durable previous-good fallback across serverless instances.
    { revalidate: 8 * 24 * 60 * 60 },
  )();
}

async function previousDurablePayload(
  windows: Array<{ date: string; start: number; end: number }>,
  configKey: string,
  config: Partial<TpoEngineConfig>,
) {
  // Vercel's incremental cache is shared across serverless instances. Probe
  // both keys a completed RTH profile can have (before and after the Chicago
  // daily completion) so a cold instance can still recover the prior good
  // generation during a data-source outage.
  for (const window of windows.slice(1, 3)) {
    const anchors = [window.end + 1_000, window.end + 2 * 60 * 60_000];
    for (const anchor of anchors) {
      const key = `${window.date}:${nextCmeDailyCompletion(anchor)}:${configKey}`;
      try {
        const payload = await durablePayload(anchor, key, config);
        if (payload?.zones && payload.sourceSessions.includes(window.date)) return payload;
      } catch {
        // A cache miss may attempt a historical rebuild and fail with the same
        // upstream outage. Continue probing the other retained generation.
      }
    }
  }
  return null;
}

async function durableOrDirect(now: number, generationKey: string, config: Partial<TpoEngineConfig>) {
  try {
    return await durablePayload(now, generationKey, config);
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) {
      return buildTpoLevelsPayload(now, config);
    }
    throw error;
  }
}

const CONFIG_QUERY: Array<[keyof TpoEngineConfig, string, number, number]> = [
  ["rowSize", "rowSize", 0.25, 10],
  ["minimumTrades", "minimumTrades", 100, 10_000],
  ["tailMinimumRows", "tailMinimumRows", 2, 20],
  ["singlePrintMinimumRows", "singlePrintMinimumRows", 2, 30],
  ["ledgeMinimumBrackets", "ledgeMinimumBrackets", 2, 13],
  ["ledgeToleranceRows", "ledgeToleranceRows", 0, 5],
  ["failedAuctionMinimumRows", "failedAuctionMinimumRows", 2, 30],
  ["failedAuctionMaximumTpo", "failedAuctionMaximumTpo", 1, 5],
  ["edgeSmoothingRows", "edgeSmoothingRows", 3, 11],
  ["edgeMaximumWidthRows", "edgeMaximumWidthRows", 1, 10],
  ["acceptanceBrackets", "acceptanceBrackets", 1, 5],
  ["expireAfterSessions", "expireAfterSessions", 5, 30],
  ["expireStrength", "expireStrength", 0, 60],
];

function requestConfig(params: URLSearchParams) {
  const config: Partial<TpoEngineConfig> = {};
  CONFIG_QUERY.forEach(([key, query, minimum, maximum]) => {
    const parsed = Number(params.get(query));
    if (Number.isFinite(parsed)) config[key] = Math.max(minimum, Math.min(maximum, parsed));
  });
  const percent: Array<[keyof TpoEngineConfig, string]> = [
    ["edgeDropRatio", "edgeDropPercent"],
    ["acceptedBaseRatio", "acceptedBasePercent"],
    ["seamTroughRatio", "seamTroughPercent"],
    ["volumeLvnRatio", "volumeLvnPercent"],
    ["partialFillRatio", "partialFillPercent"],
  ];
  percent.forEach(([key, query]) => {
    const parsed = Number(params.get(query));
    if (Number.isFinite(parsed)) config[key] = Math.max(0.01, Math.min(0.99, parsed / 100));
  });
  return config;
}

export async function GET(request: Request) {
  if (!process.env.DATABENTO_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "TPO Levels: data source needs re-authentication" },
      { status: 401 },
    );
  }
  const now = Date.now();
  const config = requestConfig(new URL(request.url).searchParams);
  const windows = completedNqRthWindows(now, 10);
  const latest = windows[0];
  if (!latest) {
    return NextResponse.json({ error: "No completed NQ RTH session is available." }, { status: 409 });
  }
  const configKey = JSON.stringify(Object.entries(config).sort(([left], [right]) => left.localeCompare(right)));
  const completionKey = `${latest.date}:${nextCmeDailyCompletion(now)}:${configKey}`;
  const cached = memoryCache.get(completionKey);
  const promise = cached && cached.expiresAt > now
    ? cached.promise
    : durableOrDirect(now, completionKey, config);
  if (!cached || cached.expiresAt <= now) {
    memoryCache.set(completionKey, {
      expiresAt: Math.min(nextNqRthCompletion(now), nextCmeDailyCompletion(now)) + 60_000,
      promise,
    });
  }
  try {
    const payload = await promise;
    globalTpoCache.__kwantdeskTpoLastGood = payload;
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    if (memoryCache.get(completionKey)?.promise === promise) memoryCache.delete(completionKey);
    const lastGood = globalTpoCache.__kwantdeskTpoLastGood
      ?? await previousDurablePayload(windows, configKey, config);
    if (lastGood) {
      return NextResponse.json(staleTpoPayload(lastGood, now), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const authFailure = error instanceof DatabentoTpoAuthError;
    return NextResponse.json(
      { error: authFailure ? error.message : error instanceof Error ? error.message : "TPO Levels failed." },
      { status: authFailure ? 401 : 502 },
    );
  }
}
