import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getZeroGammaLinePayload } from "@/lib/zeroGammaLine.server";
import { isZeroGammaLineSource, zeroGammaRootForInstrument, zeroGammaSourceForInstrument } from "@/lib/zeroGammaLine";
import { conditionalJson } from "@/lib/conditionalJson";

// A cold request derives up to six provider-backed session snapshots plus
// their intraday trails. The platform default function timeout cut that chain
// off mid-flight, which is why the line could stay blank on SPX/SPY/NDX/QQQ
// charts in production.
export const maxDuration = 300;

// Several panes and machines poll the same instrument; a short instance-local
// payload cache collapses those bursts into one provider computation.
const payloadCache = new Map<string, { expiresAt: number; payload: unknown }>();
const PAYLOAD_CACHE_TTL_MS = 10_000;

async function isAuthenticated(request: NextRequest) {
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined } });
  return Boolean((await supabase.auth.getUser()).data.user);
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
    const payload = await getZeroGammaLinePayload(root, source, instrument, sessions);
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
