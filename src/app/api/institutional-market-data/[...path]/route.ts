import { NextRequest, NextResponse } from "next/server";
import { buildDatabentoExecutionProfile } from "@/lib/databentoExecutionProfile.server";
import { futuresTickSize } from "@/lib/eventBars";
import {
  configuredInstitutionalProvider,
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import { cmeSessionStartMs, cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";
import { vendorMarketDataConfigured } from "@/lib/vendorMarketData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_PATHS = new Set([
  "v1/market-data/instruments",
  "v1/market-data/snapshot",
  "v1/market-data/order-flow-levels",
  "v1/market-data/volume-profile",
  "v1/market-data/trades",
  "v1/heatmap/snapshot",
  "v1/heatmap/stream",
]);

type RouteContext = { params: Promise<{ path: string[] }> };

// The Rithmic collector can only serve the tape it has observed since it
// started, so its profile is thin near a restart and holds nothing from
// before this session. Databento has the complete historical execution
// record, which is what produced real nodes in the original build — so the
// volume profile is served from executions and only falls through to the
// collector if Databento cannot answer.
async function executionProfileResponse(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbol = (params.get("symbol") || params.get("root") || "").trim().toUpperCase();
  if (!symbol || !vendorMarketDataConfigured("databento")) return null;

  const contractSymbol = (params.get("contractSymbol") || "").trim().toUpperCase();
  const period = params.get("period") === "weekly" ? "weekly" : "daily";
  const now = Date.now();
  const explicitStart = Number(params.get("startMs"));
  const explicitEnd = Number(params.get("endMs"));
  const tradingDate = params.get("tradingDate");
  const sessionStart = cmeSessionStartMs(now);

  // A daily request identifies its session by tradingDate, not by timestamps.
  // Resolving that to the session's own window is what lets PRIOR days get a
  // real profile; ignoring it silently returned today's data for every day.
  const dateWindow = period === "daily" && tradingDate
    ? cmeSessionWindowForDate(tradingDate)
    : null;

  const startMs = Number.isFinite(explicitStart) && explicitStart > 0
    ? explicitStart
    : dateWindow
      ? dateWindow.startMs
      : period === "weekly"
        ? (sessionStart ?? now) - 5 * 24 * 60 * 60_000
        : sessionStart ?? now - 24 * 60 * 60_000;
  const requestedEnd = Number.isFinite(explicitEnd) && explicitEnd > startMs
    ? explicitEnd
    : dateWindow
      ? dateWindow.endMs
      : now;
  // Databento rejects the whole request if `end` runs past the dataset's
  // available edge, which is minutes behind live. Never ask beyond it.
  const endMs = Math.min(requestedEnd, now);

  try {
    const profile = await buildDatabentoExecutionProfile({
      symbol,
      contractSymbol,
      startMs,
      endMs,
      tickSize: futuresTickSize(contractSymbol || symbol),
      groupTicks: Number(params.get("groupTicks") ?? 1),
      valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
      minTradeVolume: Number(params.get("minTradeVolume") ?? 0),
      maxTradeVolume: Number(params.get("maxTradeVolume") ?? 0),
      period,
      tradingDate: params.get("tradingDate"),
    });
    if (!profile) return null;
    return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Exact Databento volume profile failed.", {
      symbol,
      contractSymbol,
      period,
      tradingDate,
      message: error instanceof Error ? error.message : String(error),
    });
    // Fall through to the collector rather than failing the request.
    return null;
  }
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const path = pathParts.join("/");
  if (!ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: "Unsupported market-data operation." }, { status: 400 });
  }

  if (request.method === "GET" && path === "v1/market-data/volume-profile") {
    const executionProfile = await executionProfileResponse(request);
    if (executionProfile) return executionProfile;
  }

  if (!isInstitutionalMarketDataConfigured()) {
    return NextResponse.json(
      { error: `The private ${configuredInstitutionalProvider()} market-data gateway is not configured.` },
      { status: 503 },
    );
  }

  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();
  try {
    const upstream = await fetchInstitutionalMarketData(
      `${path}${request.nextUrl.search}`,
      {
        method: request.method,
        body,
        headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      },
      // Streams hold open for the request's lifetime. A full-session
      // order-flow backfill is a large payload and needs far more than the
      // 30s default — a server budget below the client's simply aborts the
      // backfill and leaves the earlier session with no executions.
      path.endsWith("/trades") || path.endsWith("/stream")
        ? 295_000
        : path.endsWith("/order-flow-levels")
          ? 150_000
          : 30_000,
    );
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    if (path.endsWith("/trades") || path.endsWith("/stream")) {
      headers.set("X-Accel-Buffering", "no");
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market-data gateway unavailable." },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
