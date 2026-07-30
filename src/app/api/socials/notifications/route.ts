import { NextResponse, type NextRequest } from "next/server";

import { getRouteActor } from "@/lib/serverAuth";
import type {
  SocialNotificationItem,
  SocialNotificationKind,
} from "@/lib/socialNotifications";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NotificationRow = {
  id?: string | null;
  source_user_id?: string | null;
  source_object_id?: string | null;
  kind?: string | null;
  payload?: unknown;
  read_at?: string | null;
  created_at?: string | null;
};

type ProfileRow = {
  user_id?: string | null;
  author_label?: string | null;
  payload?: unknown;
  updated_at?: string | null;
};

function cleanUuid(value: unknown) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : "";
}

function cleanIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(cleanUuid).filter(Boolean))).slice(0, 100);
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function migrationUnavailable(code?: string) {
  return code === "42P01"
    || code === "42883"
    || code === "PGRST202"
    || code === "PGRST205";
}

function unavailableResponse() {
  return NextResponse.json(
    {
      configured: false,
      code: "FOLLOW_MIGRATION_REQUIRED",
      error: "Social notifications are being connected.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

async function notificationClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

function notificationKind(value: unknown): SocialNotificationKind {
  return value === "new_follower" ? "new_follower" : "followed_account_update";
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await notificationClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  const offset = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get("offset")) || 0));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(request.nextUrl.searchParams.get("limit")) || 30)));

  try {
    const [itemsResult, unreadResult] = await Promise.all([
      supabase
        .from("social_notifications")
        .select("id,source_user_id,source_object_id,kind,payload,read_at,created_at")
        .eq("recipient_user_id", actor.userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from("social_notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", actor.userId)
        .is("read_at", null),
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (unreadResult.error) throw unreadResult.error;

    const rows = Array.isArray(itemsResult.data)
      ? itemsResult.data as NotificationRow[]
      : [];
    const sourceUserIds = Array.from(new Set(
      rows.map((row) => cleanUuid(row.source_user_id)).filter(Boolean),
    ));

    const profileByUserId = new Map<string, ProfileRow>();
    if (sourceUserIds.length) {
      const profileResult = await supabase
        .from("social_objects")
        .select("user_id,author_label,payload,updated_at")
        .eq("object_type", "profile")
        .in("user_id", sourceUserIds)
        .order("updated_at", { ascending: false });
      if (profileResult.error) throw profileResult.error;
      for (const profile of (profileResult.data ?? []) as ProfileRow[]) {
        const userId = cleanUuid(profile.user_id);
        if (userId && !profileByUserId.has(userId)) profileByUserId.set(userId, profile);
      }
    }

    const items = rows.flatMap((row): SocialNotificationItem[] => {
      const id = cleanUuid(row.id);
      const sourceUserId = cleanUuid(row.source_user_id);
      if (!id || !sourceUserId) return [];

      const notificationPayload = objectValue(row.payload);
      const profile = profileByUserId.get(sourceUserId);
      const profilePayload = objectValue(profile?.payload);
      const sourceDisplayName =
        textValue(profilePayload.displayName)
        || textValue(profile?.author_label)
        || textValue(notificationPayload.authorLabel)
        || "Kwant Desk user";

      return [{
        id,
        kind: notificationKind(row.kind),
        sourceUserId,
        sourceObjectId: textValue(row.source_object_id),
        sourceDisplayName,
        sourceHandle: textValue(profilePayload.handle).replace(/^@/, ""),
        sourceAvatarUrl: textValue(profilePayload.avatarUrl),
        objectType: textValue(notificationPayload.objectType),
        readAt: textValue(row.read_at) || null,
        createdAt: textValue(row.created_at) || new Date(0).toISOString(),
      }];
    });
    const nextOffset = rows.length === limit ? offset + rows.length : null;

    return NextResponse.json(
      {
        configured: true,
        items,
        unreadCount: Math.max(0, unreadResult.count ?? 0),
        offset,
        nextOffset,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (migrationUnavailable(code)) return unavailableResponse();
    return NextResponse.json(
      { error: "Social notifications could not be loaded." },
      { status: 502 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { actor, supabase } = await notificationClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  let body: { action?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The notification request could not be read." }, { status: 400 });
  }

  const action = textValue(body.action).toLowerCase();
  const ids = cleanIds(body.ids);
  if (action !== "read" && action !== "read-all") {
    return NextResponse.json({ error: "Unsupported notification action." }, { status: 400 });
  }
  if (action === "read" && !ids.length) {
    return NextResponse.json({ error: "Choose a notification." }, { status: 400 });
  }

  try {
    let query = supabase
      .from("social_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_user_id", actor.userId)
      .is("read_at", null);
    if (action === "read") query = query.in("id", ids);
    const result = await query.select("id");
    if (result.error) throw result.error;

    return NextResponse.json(
      { updated: result.data?.length ?? 0 },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (migrationUnavailable(code)) return unavailableResponse();
    return NextResponse.json(
      { error: "The notification state could not be saved." },
      { status: 502 },
    );
  }
}
