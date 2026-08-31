import { NextResponse, type NextRequest } from "next/server";

import { getClaudeApiKey } from "@/lib/claude.server";
import type { KwantBotMarketRoot } from "@/lib/kwantBotInterpreter";
import { getZyonRouteActor } from "@/lib/serverAuth";
import { getZyonMarketContext } from "@/lib/zyonMarketContext.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function marketRoot(value: string | null): KwantBotMarketRoot {
  return value?.trim().toUpperCase() === "ES" ? "ES" : "NQ";
}

export async function GET(request: NextRequest) {
  const actor = await getZyonRouteActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const root = marketRoot(request.nextUrl.searchParams.get("root"));
  const providerConfigured = Boolean(getClaudeApiKey());
  try {
    const context = await getZyonMarketContext(root, actor.userId);
    const priceWindows = context.priceHistory.windows;
    const priceSessions = context.priceHistory.sessions;
    const marketStructure = context.priceHistory.structure;
    const sources = {
      modelProvider: providerConfigured,
      optionsAndGameplan: Boolean(context.current),
      cmeHistory: Boolean(
        priceWindows.oneHour
        && priceWindows.fourHour
        && priceWindows.oneDay
        && priceWindows.oneWeek
        && priceSessions.current
        && priceSessions.previous
        && marketStructure.oneHour
        && marketStructure.fourHour
      ),
      accountMarketMemory: Boolean(context.marketMemory),
      economicCalendar: Boolean(context.economicCalendar),
      relatedMarkets: context.relatedMarkets.length > 0,
    };
    const criticalReady = sources.modelProvider
      && sources.optionsAndGameplan
      && sources.cmeHistory;
    return NextResponse.json({
      status: criticalReady
        ? context.warnings.length ? "DEGRADED" : "READY"
        : "UNAVAILABLE",
      root,
      checkedAt: new Date().toISOString(),
      sources,
      freshness: {
        optionsAsOf: context.current?.options.asOf ?? null,
        futuresBarAsOf: context.priceHistory.latestBarAt,
        calendarAsOf: context.economicCalendar?.fetchedAt ?? null,
      },
      warnings: context.warnings,
    }, {
      status: criticalReady ? 200 : 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      status: "UNAVAILABLE",
      root,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "ZYON health check failed.",
    }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
