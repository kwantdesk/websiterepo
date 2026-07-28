import { NextRequest, NextResponse } from "next/server";
import {
  configuredInstitutionalProvider,
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COMPATIBILITY_PATHS = new Set([
  "v1/market-data/instruments",
  "v1/market-data/snapshot",
  "v1/market-data/order-flow-levels",
  "v1/market-data/volume-profile",
  "v1/market-data/trades",
  "v1/heatmap/snapshot",
  "v1/heatmap/stream",
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  if (!isInstitutionalMarketDataConfigured()) {
    return NextResponse.json(
      { error: `The private ${configuredInstitutionalProvider()} market-data worker is not configured.` },
      { status: 503 },
    );
  }
  const { path: pathParts } = await context.params;
  const path = pathParts.join("/");
  if (!COMPATIBILITY_PATHS.has(path)) {
    return NextResponse.json({ error: "Unsupported market-data operation." }, { status: 400 });
  }
  const target = `${path}${request.nextUrl.search}`;
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();
  try {
    const upstream = await fetchInstitutionalMarketData(
      target,
      {
        method: request.method,
        body,
        headers: {
          "Content-Type": request.headers.get("content-type") || "application/json",
        },
      },
      path.endsWith("/trades") || path.endsWith("/stream") ? 295_000 : 180_000,
    );
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    const tradingDate = request.nextUrl.searchParams.get("tradingDate");
    const endMs = Number(request.nextUrl.searchParams.get("endMs"));
    const toMs = Number(request.nextUrl.searchParams.get("toMs"));
    const chicagoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const completedVolumeProfile = upstream.ok && path.endsWith("/volume-profile") && (
      Boolean(tradingDate && tradingDate < chicagoDate)
      || (Number.isFinite(endMs) && endMs < Date.now() - 5 * 60_000)
    );
    const completedOrderFlow = upstream.ok
      && path.endsWith("/order-flow-levels")
      && Number.isFinite(toMs)
      && toMs < Date.now() - 5 * 60_000;
    headers.set(
      "Cache-Control",
      completedVolumeProfile || completedOrderFlow
        ? "public, max-age=0, s-maxage=604800, stale-while-revalidate=2592000"
        : "no-store",
    );
    if (path.endsWith("/trades") || path.endsWith("/stream")) {
      headers.set("X-Accel-Buffering", "no");
      headers.set("Connection", "keep-alive");
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Market-data worker unavailable." },
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
