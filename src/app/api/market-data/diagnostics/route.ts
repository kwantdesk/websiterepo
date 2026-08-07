import { NextResponse } from "next/server";

import { buildDatabentoExecutionProfile } from "@/lib/databentoExecutionProfile.server";

import {
  marketDataGatewayEnvNames,
  marketDataGatewayToken,
  marketDataGatewayUrl,
  marketDataGatewayUrlCandidates,
  marketDataProvider,
} from "@/lib/marketDataGatewayEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately public (middleware allowlists it): when the charts silently
// fall back to the APPROX profile, the cause is invisible from the outside —
// this answers "what is production actually reading?" without dashboard
// access. It exposes no secrets: variable NAMES, the gateway HOST, the
// deployed commit, and an upstream reachability probe. Never the token.
export async function GET() {
  const url = marketDataGatewayUrl();
  const names = marketDataGatewayEnvNames();

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
    databentoConfigured: Boolean(process.env.DATABENTO_API_KEY?.trim()),
  };
  if (process.env.DATABENTO_API_KEY?.trim()) {
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
