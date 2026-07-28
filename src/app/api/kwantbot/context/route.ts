import { NextRequest, NextResponse } from "next/server";
import { buildGameplanPayload } from "@/lib/gameplan";
import type { KwantBotMarketContext, KwantBotMarketRoot } from "@/lib/kwantBotInterpreter";
import {
  getConfiguredQuantDataApiKey,
  getOptionsFlowPayload,
  getQuantDataHttpError,
} from "@/lib/quantData.server";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function validRoot(value: string): value is KwantBotMarketRoot {
  return value === "NQ" || value === "ES";
}

export async function GET(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  if (!getConfiguredQuantDataApiKey()) {
    return NextResponse.json(
      { error: "The KwantBot options feed is not configured." },
      { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const rootInput = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  if (!validRoot(rootInput)) {
    return NextResponse.json(
      { error: "KwantBot currently supports NQ and ES." },
      { status: 400, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  try {
    const source = rootInput === "NQ" ? "NDX" : "SPX";
    const options = await getOptionsFlowPayload(source, "FUTURES");
    const gameplan = buildGameplanPayload(options, rootInput, "newyork");
    const tradeSide = options.positioning.tradeSidePremium;

    const payload: KwantBotMarketContext = {
      root: rootInput,
      sourceSymbol: source,
      generatedAt: gameplan.generated_at,
      sessionDate: gameplan.plan.edition.date,
      status: gameplan.status,
      refreshAfterMs: Math.max(15_000, gameplan.refresh_after_ms),
      currentPrice: gameplan.current_price,
      futuresStatus: options.marketData.status,
      oneLiner: gameplan.plan.one_liner,
      levels: gameplan.plan.ladder.map((level, index) => ({
        id: `${rootInput}:${level.name}:${level.zone[0]}:${index}`,
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

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message },
      {
        status: problem.status,
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  }
}
