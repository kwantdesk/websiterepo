import { NextResponse, type NextRequest } from "next/server";

import { getRouteActor } from "@/lib/serverAuth";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SocialSection = "feed" | "desks";

type ReadRow = {
  section?: string | null;
  last_read_at?: string | null;
};

function isSection(value: unknown): value is SocialSection {
  return value === "feed" || value === "desks";
}

function migrationUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

async function activityClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await activityClient(request);
  if (!actor) return response({ error: "Authentication required." }, 401);
  if (!supabase) return response({ configured: false, feed: 0, desks: 0 });

  try {
    const readsResult = await supabase
      .from("social_section_reads")
      .select("section,last_read_at")
      .eq("user_id", actor.userId);
    if (readsResult.error) throw readsResult.error;

    const reads = new Map<SocialSection, string>();
    for (const row of (readsResult.data ?? []) as ReadRow[]) {
      if (isSection(row.section) && typeof row.last_read_at === "string") {
        reads.set(row.section, row.last_read_at);
      }
    }

    const missing = (["feed", "desks"] as SocialSection[]).filter((section) => !reads.has(section));
    if (missing.length) {
      const baseline = new Date().toISOString();
      const insertResult = await supabase.from("social_section_reads").upsert(
        missing.map((section) => ({
          user_id: actor.userId,
          section,
          last_read_at: baseline,
          updated_at: baseline,
        })),
        { onConflict: "user_id,section", ignoreDuplicates: true },
      );
      if (insertResult.error) throw insertResult.error;
      for (const section of missing) reads.set(section, baseline);
    }

    const [followsResult, membershipsResult] = await Promise.all([
      supabase
        .from("social_profile_follows")
        .select("following_id")
        .eq("follower_id", actor.userId),
      supabase
        .from("desk_members")
        .select("desk_id")
        .eq("user_id", actor.userId),
    ]);
    if (followsResult.error && !migrationUnavailable(followsResult.error.code)) throw followsResult.error;
    if (membershipsResult.error && !migrationUnavailable(membershipsResult.error.code)) throw membershipsResult.error;

    const followingIds = Array.from(new Set(
      (followsResult.data ?? []).map((row) => String(row.following_id ?? "")).filter(Boolean),
    )).slice(0, 500);
    const deskIds = Array.from(new Set(
      (membershipsResult.data ?? []).map((row) => String(row.desk_id ?? "")).filter(Boolean),
    )).slice(0, 200);

    const feedCountQuery = followingIds.length
      ? supabase
          .from("social_objects")
          .select("id", { count: "exact", head: true })
          .in("user_id", followingIds)
          .in("object_type", ["post", "precord", "receipt"])
          .gt("created_at", reads.get("feed") ?? new Date().toISOString())
      : null;
    const deskCountQuery = deskIds.length
      ? supabase
          .from("desk_messages")
          .select("id", { count: "exact", head: true })
          .in("desk_id", deskIds)
          .neq("sender_user_id", actor.userId)
          .gt("created_at", reads.get("desks") ?? new Date().toISOString())
      : null;

    const [feedResult, deskResult] = await Promise.all([
      feedCountQuery ?? Promise.resolve({ count: 0, error: null }),
      deskCountQuery ?? Promise.resolve({ count: 0, error: null }),
    ]);
    if (feedResult.error) throw feedResult.error;
    if (deskResult.error) throw deskResult.error;

    return response({
      configured: true,
      feed: Math.max(0, feedResult.count ?? 0),
      desks: Math.max(0, deskResult.count ?? 0),
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (migrationUnavailable(code)) return response({ configured: false, feed: 0, desks: 0 });
    return response({ error: "Social activity could not be loaded." }, 502);
  }
}

export async function PATCH(request: NextRequest) {
  const { actor, supabase } = await activityClient(request);
  if (!actor) return response({ error: "Authentication required." }, 401);
  if (!supabase) return response({ configured: false });

  let body: { section?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: "The activity request could not be read." }, 400);
  }
  if (!isSection(body.section)) return response({ error: "Choose Feed or Desks." }, 400);

  const now = new Date().toISOString();
  const result = await supabase.from("social_section_reads").upsert({
    user_id: actor.userId,
    section: body.section,
    last_read_at: now,
    updated_at: now,
  }, { onConflict: "user_id,section" });
  if (result.error) {
    if (migrationUnavailable(result.error.code)) return response({ configured: false });
    return response({ error: "Social activity could not be marked as read." }, 502);
  }
  return response({ configured: true, section: body.section, readAt: now });
}

