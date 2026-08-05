import { NextRequest, NextResponse } from "next/server";
import { searchMacroMemory } from "@/lib/macroMemory.server";
import { getRouteActor } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!(await getRouteActor(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const root = request.nextUrl.searchParams.get("root")?.toUpperCase() === "ES" ? "ES" : "NQ";
  const query = request.nextUrl.searchParams.get("q")?.trim() || "today overnight macro events";
  const memory = await searchMacroMemory({ query, root });
  return NextResponse.json(memory ?? {
    configured: false,
    error: "Macro memory is not available. Apply the Supabase macro-memory migration and confirm the service-role environment variable.",
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
