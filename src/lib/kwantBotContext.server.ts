import "server-only";

import { buildGameplanPayload } from "@/lib/gameplan";
import type { KwantBotMarketContext, KwantBotMarketRoot } from "@/lib/kwantBotInterpreter";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
} from "@/lib/quantData.server";

type ContextCacheEntry = {
  value: KwantBotMarketContext | null;
  expiresAt: number;
  staleUntil: number;
  promise: Promise<KwantBotMarketContext> | null;
};

const CACHE_MS = 15_000;
const STALE_MS = 5 * 60_000;
const contextGlobal = globalThis as typeof globalThis & {
  __kwantdeskKwantBotContext?: Map<KwantBotMarketRoot, ContextCacheEntry>;
};
const contextCache = contextGlobal.__kwantdeskKwantBotContext
  ?? (contextGlobal.__kwantdeskKwantBotContext = new Map());

async function buildContext(root: KwantBotMarketRoot): Promise<KwantBotMarketContext> {
  if (!getConfiguredQuantDataApiKey()) {
    throw new Error("The KwantBot options feed is not configured.");
  }
  const source = root === "NQ" ? "NDX" : "SPX";
  const options = await getOptionsFlowPayload(source, "FUTURES");
  const gameplan = buildGameplanPayload(options, root, "newyork");
  const tradeSide = options.positioning.tradeSidePremium;

  return {
    root,
    sourceSymbol: source,
    generatedAt: gameplan.generated_at,
    sessionDate: gameplan.plan.edition.date,
    status: gameplan.status,
    refreshAfterMs: Math.max(15_000, gameplan.refresh_after_ms),
    currentPrice: gameplan.current_price,
    futuresStatus: options.marketData.status,
    oneLiner: gameplan.plan.one_liner,
    levels: gameplan.plan.ladder.map((level, index) => ({
      id: `${root}:${level.name}:${level.zone[0]}:${index}`,
      name: level.name,
      role: level.role,
      strength: level.strength,
      zone: level.zone,
      why: level.why,
      ifVisit: level.if_visit,
      ifHold: level.if_hold,
      ifBreak: level.if_break,
    })),
    scenarios: gameplan.plan.scenarios.map((scenario) => ({
      name: scenario.name,
      trigger: scenario.trigger,
      path: scenario.path,
      kill: scenario.kill,
      weight: scenario.weight,
    })),
    options: {
      asOf: options.asOf,
      gammaRegime: options.environment.gammaRegime,
      gammaStrength: options.environment.gammaStrength,
      gammaStateLabel: options.environment.gammaStateLabel,
      volatilityState: options.environment.volatilityState,
      netPremium: options.environment.netPremium,
      bullishShare: options.environment.bullishShare,
      frontExpiration: options.levels.frontExpiration,
      zeroDteAvailable: options.levels.zeroDteAvailable,
      majorPositiveGamma: options.positioning.majorPositiveGamma,
      majorNegativeGamma: options.positioning.majorNegativeGamma,
      gammaChange: options.positioning.gammaChange.map((row) => ({
        minutes: row.minutes,
        strike: row.strike,
        change: row.change,
        state: row.state,
      })),
      tradeSidePremium: tradeSide ? {
        netLongPremium: tradeSide.netLongPremium,
        longShare: tradeSide.longShare,
        callBought: tradeSide.callBought,
        callSold: tradeSide.callSold,
        putBought: tradeSide.putBought,
        putSold: tradeSide.putSold,
      } : null,
      recentFlow: [...options.flow]
        .sort((left, right) => right.tradeTime - left.tradeTime)
        .slice(0, 30)
        .map((row) => ({
          id: row.id,
          tradeTime: row.tradeTime,
          contractType: row.contractType,
          strikePrice: row.strikePrice,
          expirationDate: row.expirationDate,
          premium: row.premium,
          size: row.size,
          sentiment: row.sentiment,
          unusual: row.unusual,
          opening: row.opening,
          side: row.side,
        })),
      errors: options.errors,
    },
  };
}

export async function getKwantBotMarketContext(root: KwantBotMarketRoot) {
  const now = Date.now();
  const cached = contextCache.get(root);
  if (cached?.value && cached.expiresAt > now) return cached.value;
  if (cached?.promise) return cached.promise;

  const entry: ContextCacheEntry = cached ?? {
    value: null,
    expiresAt: 0,
    staleUntil: 0,
    promise: null,
  };
  const request = buildContext(root)
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + CACHE_MS;
      entry.staleUntil = Date.now() + STALE_MS;
      return value;
    })
    .catch((error) => {
      if (entry.value && entry.staleUntil > Date.now()) return entry.value;
      throw error;
    })
    .finally(() => {
      entry.promise = null;
    });
  entry.promise = request;
  contextCache.set(root, entry);
  return request;
}
