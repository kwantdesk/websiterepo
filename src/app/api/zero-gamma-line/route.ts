import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getZeroGammaLinePayload } from "@/lib/zeroGammaLine.server";
import { isZeroGammaLineSource, zeroGammaRootForInstrument, zeroGammaSourceForInstrument } from "@/lib/zeroGammaLine";
import type { ZeroGammaLinePayload } from "@/lib/zeroGammaLine";
import { conditionalJson } from "@/lib/conditionalJson";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// A cold request derives up to six provider-backed session snapshots plus
// their intraday trails. The platform default function timeout cut that chain
// off mid-flight, which is why the line could stay blank on SPX/SPY/NDX/QQQ
// charts in production.
export const maxDuration = 300;

// Several panes and machines poll the same instrument; a short instance-local
// payload cache collapses those bursts into one provider computation.
type ZeroGammaLineReceipt = ZeroGammaLinePayload & {
  schemaVersion: 1;
  id: "zero-gamma-line";
  asOfMs: number;
  receivedAtMs: number;
  revision: string;
};

const payloadCache = new Map<string, { expiresAt: number; payload: ZeroGammaLineReceipt }>();
const PAYLOAD_CACHE_TTL_MS = 10_000;

async function isAuthenticated(request: NextRequest) {
  const expectedInternalToken = String(process.env.KWANTDESK_ANALYTICS_SERVICE_TOKEN || "").trim();
  const suppliedInternalToken = String(request.headers.get("x-kwantdesk-internal-analytics-token") || "").trim();
  if (expectedInternalToken.length >= 32 && suppliedInternalToken.length === expectedInternalToken.length) {
    const supplied = Buffer.from(suppliedInternalToken, "utf8");
    const expected = Buffer.from(expectedInternalToken, "utf8");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  return Boolean((await supabase.auth.getUser()).data.user);
}

function createReceipt(payload: ZeroGammaLinePayload): ZeroGammaLineReceipt {
  const receivedAtMs = Date.now();
  const asOfMs = Date.parse(payload.asOf);
  if (!Number.isFinite(asOfMs) || asOfMs <= 0 || asOfMs > receivedAtMs + 60_000) {
    throw new Error("The Zero Gamma Line receipt clock is invalid.");
  }
  const points = payload.points.slice(-4_000);
  const revision = createHash("sha256").update(JSON.stringify([
    payload.root,
    payload.sourceSymbol,
    payload.displayInstrument,
    payload.status,
    payload.positiveAbove,
    payload.method,
    points,
  ])).digest("hex");
  return {
    ...payload,
    points,
    schemaVersion: 1,
    id: "zero-gamma-line",
    asOfMs,
    receivedAtMs,
    revision,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const instrument = request.nextUrl.searchParams.get("instrument")?.trim().toUpperCase() || "NQ";
  const root = zeroGammaRootForInstrument(instrument);
  // A pinned source lets a desk read the crossing off a specific chain
  // (NQ's own options, NDX, or QQQ) instead of the automatic pick. It is
  // honoured only within the chart's own Gamma family — anything else would
  // paint another market's dealer positioning onto this price.
  const requestedSource = request.nextUrl.searchParams.get("source")?.trim().toUpperCase();
  const source = isZeroGammaLineSource(requestedSource)
    && zeroGammaRootForInstrument(requestedSource) === zeroGammaRootForInstrument(instrument)
    ? requestedSource
    : zeroGammaSourceForInstrument(instrument);
  if (!root || !source) return NextResponse.json({ error: "Zero Gamma Line requires a supported futures or options-underlying Gamma family." }, { status: 400 });
  const sessions = Math.max(1, Math.min(5, Number(request.nextUrl.searchParams.get("sessions") ?? 5)));
  const cacheKey = `${root}:${source}:${instrument}:${sessions}`;
  const cached = payloadCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    // The entry's own expiry moves only when the trail is rebuilt, so it
    // identifies the payload without hashing it.
    return conditionalJson(request, cached.payload, {
      identity: `${cacheKey}:${cached.expiresAt}`,
      cacheControl: "private, max-age=5, stale-while-revalidate=30",
    });
  }
  try {
    const payload = createReceipt(await getZeroGammaLinePayload(root, source, instrument, sessions));
    if (payloadCache.size > 64) {
      for (const [key, entry] of payloadCache) if (entry.expiresAt <= Date.now()) payloadCache.delete(key);
    }
    const expiresAt = Date.now() + PAYLOAD_CACHE_TTL_MS;
    payloadCache.set(cacheKey, { expiresAt, payload });
    return conditionalJson(request, payload, {
      identity: `${cacheKey}:${expiresAt}`,
      cacheControl: "private, max-age=5, stale-while-revalidate=30",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Zero Gamma Line is temporarily unavailable." }, { status: 503 });
  }
}
