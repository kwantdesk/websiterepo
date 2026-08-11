import { NextResponse } from "next/server";

import { buildValueAreaPayload } from "@/app/api/databento/value-area/route";
import { buildDatabentoExecutionProfile } from "@/lib/databentoExecutionProfile.server";

import {
  marketDataGatewayEnvNames,
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataGatewayUrlCandidates,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately public (middleware allowlists it): when the charts silently
// fall back to the APPROX profile, the cause is invisible from the outside —
// this answers "what is production actually reading?" without dashboard
// access. It exposes no secrets: variable NAMES, the gateway HOST, the
// deployed commit, and an upstream reachability probe. Never the token.
export async function GET(request: Request) {
  const url = marketDataGatewayUrl();
  const names = marketDataGatewayEnvNames();

  // Optional deep probe: run the real value-area build server-side and report
  // the outcome. The route itself sits behind site access, so its failures are
  // invisible to an unauthenticated probe — this is the only way to read the
  // actual error from outside. Opt-in via query because the build downloads a
  // full prior-session/prior-week tick history and can run for minutes.
  const probeTarget = new URL(request.url).searchParams.get("probe");
  if (probeTarget === "value-area") {
    const symbol = new URL(request.url).searchParams.get("symbol")?.trim() || "NQ";
    const startedAt = Date.now();
    try {
      const payload = await buildValueAreaPayload(symbol, startedAt);
      return NextResponse.json(
        {
          probe: "value-area",
          symbol,
          ok: true,
          tookMs: Date.now() - startedAt,
          daily: {
            label: payload.daily.label,
            poc: payload.daily.poc,
            vah: payload.daily.vah,
            val: payload.daily.val,
            trades: payload.daily.tradeRecords,
          },
          weekly: {
            label: payload.weekly.label,
            poc: payload.weekly.poc,
            vah: payload.weekly.vah,
            val: payload.weekly.val,
            trades: payload.weekly.tradeRecords,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      return NextResponse.json(
        {
          probe: "value-area",
          symbol,
          ok: false,
          tookMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  // Probe every configured origin, not just the first: the incident was a
  // dead host under the highest-precedence name shadowing a live one, which
  // a single probe of "the" URL can never reveal.
  const candidates = await Promise.all(
    marketDataGatewayUrlCandidates().map(async (origin) => {
      try {
        const response = await fetch(`${origin}/health`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        const health = await response.json().catch(() => null) as Record<string, unknown> | null;
        return {
          host: new URL(origin).host,
          reachable: true,
          status: response.status,
          connected: health?.connected ?? null,
          authenticated: health?.authenticated ?? null,
          lastMessageAt: health?.lastMessageAt ?? null,
        };
      } catch (error) {
        return {
          host: new URL(origin).host,
          reachable: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  // The execution-accurate profile is what removes the APPROX watermark. It
  // silently declines when Databento is unconfigured, so report that state
  // explicitly rather than leaving it to be inferred from a blank chart.
  let executionProfile: Record<string, unknown> = {
    databentoConfigured: vendorMarketDataConfigured("databento"),
  };
  if (vendorMarketDataConfigured("databento")) {
    try {
      const probe = await buildDatabentoExecutionProfile({
        symbol: "NQ",
        contractSymbol: "NQU6",
        startMs: Date.now() - 3 * 60 * 60_000,
        endMs: Date.now(),
        tickSize: 0.25,
      });
      executionProfile = {
        ...executionProfile,
        usable: Boolean(probe && probe.levels.length > 0),
        levels: probe?.levels.length ?? 0,
        totalVolume: probe?.totalVolume ?? 0,
        provider: probe?.provider ?? null,
      };
    } catch (error) {
      executionProfile = {
        ...executionProfile,
        usable: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      onVercel: Boolean(process.env.VERCEL),
      provider: marketDataProvider(),
      executionProfile,
      resolvedFrom: {
        url: names.url,
        token: names.token,
        provider: names.provider,
      },
      gatewayHost: url ? new URL(url).host : null,
      gatewayConfigured: Boolean(url && marketDataGatewayToken()),
      candidates,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
