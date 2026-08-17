import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getZeroGammaLinePayload } from "@/lib/zeroGammaLine.server";
import { zeroGammaRootForInstrument } from "@/lib/zeroGammaLine";

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
  if (!root) return NextResponse.json({ error: "Zero Gamma Line currently supports native NQ, MNQ, ES and MES futures charts." }, { status: 400 });
  const sessions = Math.max(1, Math.min(5, Number(request.nextUrl.searchParams.get("sessions") ?? 5)));
  try {
    return NextResponse.json(await getZeroGammaLinePayload(root, instrument, sessions), {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=30" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Zero Gamma Line is temporarily unavailable." }, { status: 503 });
  }
}
