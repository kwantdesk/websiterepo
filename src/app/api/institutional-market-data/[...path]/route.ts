import { NextRequest, NextResponse } from "next/server";
import {
  configuredInstitutionalProvider,
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";

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

async function proxy(request: NextRequest, context: RouteContext) {
  if (!isInstitutionalMarketDataConfigured()) {
    return NextResponse.json(
      { error: `The private ${configuredInstitutionalProvider()} market-data gateway is not configured.` },
      { status: 503 },
    );
  }

  const { path: pathParts } = await context.params;
  const path = pathParts.join("/");
  if (!ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: "Unsupported market-data operation." }, { status: 400 });
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
