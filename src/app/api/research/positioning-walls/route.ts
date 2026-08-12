import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { runHistoricalPositioningWallStudy } from "@/lib/positioningWallResearch.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const root = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  const sessionDate = (request.nextUrl.searchParams.get("sessionDate") || "").trim();
  const source = request.nextUrl.searchParams.get("source")?.trim();
  const ranks = Number(request.nextUrl.searchParams.get("ranks") || 5);
  const reactionWindowMinutes = Number(request.nextUrl.searchParams.get("reactionWindowMinutes") || 30);
  if (root !== "NQ" && root !== "ES") {
    return NextResponse.json({ error: "The research root must be NQ or ES." }, { status: 400 });
  }
  try {
    const study = await runHistoricalPositioningWallStudy({
      root,
      sessionDate,
      source,
      ranks: Number.isFinite(ranks) ? ranks : 5,
      reactionWindowMinutes: Number.isFinite(reactionWindowMinutes)
        ? Math.max(5, Math.min(120, reactionWindowMinutes))
        : 30,
    });
    return NextResponse.json(study, {
      headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The Positioning Wall study could not be completed.",
    }, { status: 422 });
  }
}
