import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import type { NativeGammaPayload } from "@/lib/nativeGamma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_MS = 5_000;
let cache: { value: NativeGammaPayload; updatedAt: number } | null = null;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function staleFallback(error: string): NativeGammaPayload | null {
  if (!cache) return null;
  const now = Date.now();
  const generated = cache.value.generatedAt ? Date.parse(cache.value.generatedAt) : cache.updatedAt;
  return {
    ...cache.value,
    generatedAt: cache.value.generatedAt,
    heartbeat: new Date(now).toISOString(),
    state: "STALE",
    stale: true,
    spotAge: Math.max(cache.value.spotAge ?? 0, (now - generated) / 1_000),
    gatewayError: error,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const root = (request.nextUrl.searchParams.get("root") || "NQ").toUpperCase();
  if (root !== "NQ") return NextResponse.json({ error: "The overnight native engine currently supports NQ only." }, { status: 400 });
  const origin = String(process.env.KWANTDESK_NATIVE_GAMMA_GATEWAY_URL || "").replace(/\/$/, "");
  const token = String(process.env.KWANTDESK_NATIVE_GAMMA_GATEWAY_TOKEN || "").trim();
  if (!origin || !token) return NextResponse.json({ error: "Native gamma gateway is not configured." }, { status: 503 });
  if (cache && Date.now() - cache.updatedAt <= CACHE_MS) {
    return NextResponse.json(cache.value, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=5" } });
  }
  try {
    const response = await fetch(`${origin}/v1/native-gamma/nq`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    const payload = await response.json() as NativeGammaPayload & { error?: string };
    if (!response.ok || !Array.isArray(payload.levels)) throw new Error(payload.error || `Native gateway returned ${response.status}.`);
    cache = { value: payload, updatedAt: Date.now() };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=5" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Native gamma gateway is unavailable.";
    const fallback = staleFallback(message);
    if (fallback) return NextResponse.json(fallback, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
