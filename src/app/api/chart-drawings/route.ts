import { NextResponse, type NextRequest } from "next/server";

import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function cleanInstrument(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 40) : "";
}

function cleanDrawings(value: unknown) {
  if (!Array.isArray(value)) return null;
  const drawings = value.slice(0, 500).filter((drawing) => {
    if (!drawing || typeof drawing !== "object" || Array.isArray(drawing)) return false;
    const item = drawing as Record<string, unknown>;
    if (typeof item.id !== "string" || item.id.length < 1 || item.id.length > 160) return false;
    const nativeDrawing = typeof item.type === "string"
      && Array.isArray(item.anchors)
      && item.anchors.length <= 64;
    const legacyDrawing = typeof item.tool === "string"
      && Array.isArray(item.points)
      && item.points.length <= 64;
    return nativeDrawing || legacyDrawing;
  });
  return JSON.stringify(drawings).length <= 1_000_000 ? drawings : null;
}

async function context(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

export async function GET(request: NextRequest) {
  const instrument = cleanInstrument(request.nextUrl.searchParams.get("instrument"));
  if (!instrument) return response({ error: "Instrument is required." }, 400);
  const { actor, supabase } = await context(request);
  if (!actor) return response({ drawings: [], configured: false }, 401);
  if (!supabase) return response({ drawings: [], configured: false });

  const result = await supabase
    .from("chart_drawings")
    .select("drawings,schema_version,updated_at")
    .eq("user_id", actor.userId)
    .eq("instrument", instrument)
    .maybeSingle();

  if (result.error) return response({ drawings: [], configured: false });
  return response({
    drawings: cleanDrawings(result.data?.drawings) ?? [],
    schemaVersion: Number(result.data?.schema_version ?? 1),
    updatedAt: result.data?.updated_at ?? null,
    configured: true,
  });
}

export async function PUT(request: NextRequest) {
  const { actor, supabase } = await context(request);
  if (!actor) return response({ error: "Authentication required." }, 401);
  if (!supabase) return response({ configured: false });

  let body: { instrument?: unknown; drawings?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: "Drawing payload could not be read." }, 400);
  }
  const instrument = cleanInstrument(body.instrument);
  const drawings = cleanDrawings(body.drawings);
  if (!instrument || !drawings) return response({ error: "Drawing payload is invalid." }, 400);

  const result = await supabase.from("chart_drawings").upsert({
    user_id: actor.userId,
    instrument,
    drawings,
    schema_version: 2,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,instrument" });

  if (result.error) return response({ configured: false });
  return response({ configured: true, saved: drawings.length });
}
