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
import { quantDataSchedulerState } from "@/lib/quantData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately public (middleware allowlists it): when the charts silently
// fall back to the APPROX profile, the cause is invisible from the outside —
// this answers "what is production actually reading?" without dashboard
// access. It exposes no secrets: variable NAMES, the gateway HOST, the
// deployed commit, and an upstream reachability probe. Never the token.
/**
 * Ask the gateway for a completed session it should already hold.
 *
 * A hit means the archive is doing its job. A miss carries the archiver's own
 * status, which says whether it is enabled at all and which tickers it covers -
 * far more useful than the absence of a chart.
 */
async function cashIndexArchiveStatus() {
  const probeSymbol = "SPX";
  try {
    const { fetchInstitutionalMarketData, isInstitutionalMarketDataConfigured } =
      await import("@/lib/institutionalMarketData.server");
    if (!isInstitutionalMarketDataConfigured()) return { configured: false };
    // The most recent weekday before today: today's session is not archived
    // until after the close, so probing it would report a miss that is correct.
    const cursor = new Date();
    do { cursor.setUTCDate(cursor.getUTCDate() - 1); }
    while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6);
    const sessionDate = cursor.toISOString().slice(0, 10);
    const response = await fetchInstitutionalMarketData(
      `v1/market-data/cash-index-history?symbol=${probeSymbol}&sessionDate=${sessionDate}`,
      { method: "GET" },
      8_000,
    );
    if (response?.ok) {
      const payload = await response.json().catch(() => null);
      const bars = Array.isArray(payload?.candles) ? payload.candles.length : null;
      return { configured: true, probeSymbol, sessionDate, archived: true, bars };
    }
    const detail = await response?.json().catch(() => null);
    return {
      configured: true,
      probeSymbol,
      sessionDate,
      archived: false,
      status: response?.status ?? null,
      archiver: detail?.archiver ?? null,
    };
  } catch (error) {
    return { configured: true, probeSymbol, archived: false, error: String(error).slice(0, 160) };
  }
}

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
      /*
       * Whether completed cash-index sessions are being served from the VPS
       * archive or restored from the provider every time.
       *
       * This is the difference between a chart drawing in milliseconds and one
       * spending a 30-40s provider restore PER SESSION - five of those for a
       * five-day minute chart, against an allowance of roughly twenty provider
       * requests per window. When the archive is empty every pane pays that
       * again on every cache expiry, and whichever symbol's request lands on a
       * drained bucket is the one that appears to hang. Measured on the same
       * cold run: NDX 37s while SPX took 2s, then the reverse.
       *
       * The gateway has always reported this, but only inside a 404 body that
       * nothing surfaced - so the one thing that would explain a hanging chart
       * was invisible.
       */
      cashIndexArchive: await cashIndexArchiveStatus(),
      // The options scheduler's own state. Its background lane yields to the
      // foreground, so a foreground count stuck above zero stops every warm-up
      // on the desk with no error and no log line to find.
      optionsScheduler: quantDataSchedulerState(),
      candidates,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
