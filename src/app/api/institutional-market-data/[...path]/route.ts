import { providerErrorMessage, logProviderError } from "@/lib/providerErrorMessage";
import { NextRequest, NextResponse } from "next/server";
import {
  RTH_END_MINUTES,
  RTH_START_MINUTES,
  resolveSessionSegments,
  type SessionSegment,
  type SessionFilterMode,
  type SessionWindowKind,
} from "@/lib/volumeProfileSessions";
import {
  configuredInstitutionalProvider,
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED_PATHS = new Set([
  "v1/market-data/catalog",
  "v1/market-data/resolve",
  "v1/market-data/instruments",
  "v1/market-data/snapshot",
  "v1/market-data/order-flow-levels",
  "v1/market-data/volume-profile",
  "v1/market-data/trades",
  "v1/market-data/index-stream",
  "v1/market-data/index-snapshot",
  "v1/market-data/index-history",
  "v1/heatmap/snapshot",
  "v1/heatmap/stream",
  // Session replay packs distilled from the collector's own raw L3 archive.
  "v1/heatmap/replay",
  "v1/heatmap/replay/chunk",
]);

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * The one session window a proxied request can be narrowed to, or null.
 *
 * Null covers both "no filtering asked for" and "asked for something a single
 * window cannot express", because the caller does the same thing with each:
 * forward the request untouched.
 */
function sessionWindowForForwarding(request: NextRequest): SessionSegment | null {
  const params = request.nextUrl.searchParams;
  const mode = String(params.get("filterMode") ?? "none").toLowerCase();
  if (!["filter", "splitted", "triple"].includes(mode)) return null;
  const startMs = Number(params.get("startMs"));
  const endMs = Number(params.get("endMs"));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const requestedWindow = String(params.get("filterTime") ?? "rth").toLowerCase();
  const segments = resolveSessionSegments(startMs, endMs, {
    mode: mode as SessionFilterMode,
    window: (["rth", "eth", "custom"].includes(requestedWindow) ? requestedWindow : "rth") as SessionWindowKind,
    customStartMinutes: Number(params.get("sessionStartMinutes") ?? RTH_START_MINUTES),
    customEndMinutes: Number(params.get("sessionEndMinutes") ?? RTH_END_MINUTES),
    useEndSessionAsStartDay: params.get("useEndSessionAsStartDay") === "true",
  });
  return segments.length === 1 ? segments[0] : null;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path: pathParts } = await context.params;
  const path = pathParts.join("/");
  if (!ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: "Unsupported market-data operation." }, { status: 400 });
  }

  /*
   * Filter/Split Time has to survive the fall-through.
   *
   * The execution-profile builder above applies the session windows itself,
   * but it only answers while Databento is usable. When it is not - which is
   * the normal state here, the equities datasets 402 - the request falls
   * through to the collector, and the collector knows nothing about session
   * filtering. So the control appeared to work and did nothing: measured on
   * NQ, filtering to RTH returned the whole trading date's profile, identical
   * volume included, while the same request against an RTH-shaped window moved
   * POC 65 points.
   *
   * A single session window IS a narrower request, so it is expressed as one.
   * Several windows are not - a weekly RTH profile is five separate spans with
   * the overnights cut out of the middle, and no single start/end can say that
   * - so those are left alone for the collector to learn, rather than silently
   * narrowed to something that would quietly include what it was asked to drop.
   */
  const forwarded = new URL(request.url);
  if (request.method === "GET" && path === "v1/market-data/volume-profile") {
    const only = sessionWindowForForwarding(request);
    if (only) {
      forwarded.searchParams.set("startMs", String(only.startMs));
      forwarded.searchParams.set("endMs", String(only.endMs));
    }
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
  // Stream endpoints are not consistently named `/stream`: the cash-index
  // feed is `/index-stream`. Treat every stream path as long-lived before the
  // upstream request starts, otherwise the default 30s abort makes quotes
  // disappear and reconnect in a loop at precisely the busiest time of day.
  const isLongLivedStream = path.endsWith("/trades") || path.includes("stream");
  try {
    const upstream = await fetchInstitutionalMarketData(
      `${path}${forwarded.search}`,
      {
        method: request.method,
        body,
        headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
      },
      // Streams hold open for the request's lifetime. A full-session
      // order-flow backfill is a large payload and needs far more than the
      // 30s default — a server budget below the client's simply aborts the
      // backfill and leaves the earlier session with no executions.
      isLongLivedStream
        ? 295_000
        : path.endsWith("/order-flow-levels")
          ? 150_000
          : 30_000,
    );
    /*
     * A refusal never reaches the browser in the provider's own words.
     *
     * Everything below forwards `upstream.body` untouched, which is right for
     * data and wrong for an error: the vendor's body carries its account state
     * - usage limits, billing cases, entitlement names - and a trading surface
     * rendered it verbatim. That tells a trader nothing they can act on while
     * putting the desk's account status on screen, where a screenshot or a
     * screen-share carries it out of the room.
     *
     * Checked before the stream branches, because an error status must not be
     * streamed either. The provider's real words still reach the server log,
     * which is the half that has to survive for an outage to be diagnosable.
     */
    if (!upstream.ok) {
      const raw = await upstream.text().catch(() => "");
      logProviderError(`market-data:${path}:${upstream.status}`, new Error(raw));
      return NextResponse.json(
        { error: providerErrorMessage(new Error(raw), "Market data") },
        { status: upstream.status, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    if (isLongLivedStream) {
      headers.set("X-Accel-Buffering", "no");
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    // Bulk JSON (order-flow backfills reach tens of MB) was streamed to the
    // browser UNCOMPRESSED. Those transfers monopolised the one shared HTTP/2
    // connection to this origin for a minute-plus and every other request on
    // the site queued behind them. JSON tapes compress ~10x; gzip everything
    // that is not a live stream. Streams are decided by CONTENT TYPE, not the
    // path suffix: `index-stream` does not end in "/stream", and compressing
    // an SSE feed buffers its events inside the gzip window indefinitely —
    // quotes freeze and pages hang waiting on them.
    const upstreamType = upstream.headers.get("content-type") || "";
    const isEventStream = upstreamType.includes("text/event-stream") || path.includes("stream");
    if (isEventStream) {
      headers.set("X-Accel-Buffering", "no");
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    const acceptsGzip = (request.headers.get("accept-encoding") || "").includes("gzip");
    if (acceptsGzip && upstream.body && !upstream.headers.get("content-encoding") && typeof CompressionStream !== "undefined") {
      headers.set("Content-Encoding", "gzip");
      headers.set("Vary", "Accept-Encoding");
      return new Response(
        upstream.body.pipeThrough(new CompressionStream("gzip")),
        { status: upstream.status, headers },
      );
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
