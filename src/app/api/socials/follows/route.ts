import { NextResponse, type NextRequest } from "next/server";

import { getRouteActor } from "@/lib/serverAuth";
import type {
  SocialFollowListItem,
  SocialFollowListKind,
  SocialFollowRecommendation,
  SocialFollowSummary,
} from "@/lib/socialFollows";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FollowSummaryRow = {
  follower_count?: number | string | null;
  following_count?: number | string | null;
  viewer_follows?: boolean | null;
  follows_viewer?: boolean | null;
  notifications_enabled?: boolean | null;
  can_view_followers?: boolean | null;
  can_view_following?: boolean | null;
};

type FollowListRow = {
  user_id?: string | null;
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  viewer_follows?: boolean | null;
  follows_viewer?: boolean | null;
  notifications_enabled?: boolean | null;
  followed_at?: string | null;
};

type FollowRecommendationRow = {
  user_id?: string | null;
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  mutual_follow_count?: number | string | null;
  shared_desk_count?: number | string | null;
  market_overlap_count?: number | string | null;
  recently_viewed_at?: string | null;
  follows_viewer?: boolean | null;
  viewer_follows?: boolean | null;
  relevance_score?: number | string | null;
  reason?: string | null;
};

type FollowStorage = "dedicated" | "social-objects";

type SocialFollowFallbackRow = {
  user_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
};

type SocialProfileFallbackRow = {
  user_id?: string | null;
  author_label?: string | null;
  payload?: Record<string, unknown> | null;
};

const FALLBACK_FOLLOW_KIND = "PROFILE_FOLLOW";

function cleanUuid(value: unknown) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : "";
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
      error: "Profile follows are being connected.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function fromSummaryRow(profileUserId: string, row: FollowSummaryRow | null): SocialFollowSummary {
  return {
    configured: true,
    profileUserId,
    followerCount: numberValue(row?.follower_count),
    followingCount: numberValue(row?.following_count),
    viewerFollows: Boolean(row?.viewer_follows),
    followsViewer: Boolean(row?.follows_viewer),
    notificationsEnabled: Boolean(row?.notifications_enabled),
    canViewFollowers: row?.can_view_followers !== false,
    canViewFollowing: row?.can_view_following !== false,
  };
}

function fromListRow(row: FollowListRow): SocialFollowListItem | null {
  const userId = cleanUuid(row.user_id);
  if (!userId) return null;
  return {
    userId,
    displayName: row.display_name?.trim() || "Kwant User",
    handle: row.handle?.trim().replace(/^@/, "") || "",
    avatarUrl: row.avatar_url?.trim() || "",
    bio: row.bio?.trim() || "",
    viewerFollows: Boolean(row.viewer_follows),
    followsViewer: Boolean(row.follows_viewer),
    notificationsEnabled: Boolean(row.notifications_enabled),
    followedAt: row.followed_at || new Date(0).toISOString(),
  };
}

function fromRecommendationRow(row: FollowRecommendationRow): SocialFollowRecommendation | null {
  const userId = cleanUuid(row.user_id);
  if (!userId) return null;
  return {
    userId,
    displayName: row.display_name?.trim() || "Kwant User",
    handle: row.handle?.trim().replace(/^@/, "") || "",
    avatarUrl: row.avatar_url?.trim() || "",
    bio: row.bio?.trim() || "",
    mutualFollowCount: numberValue(row.mutual_follow_count),
    sharedDeskCount: numberValue(row.shared_desk_count),
    marketOverlapCount: numberValue(row.market_overlap_count),
    recentlyViewedAt: row.recently_viewed_at || null,
    followsViewer: Boolean(row.follows_viewer),
    viewerFollows: Boolean(row.viewer_follows),
    relevanceScore: Number(row.relevance_score ?? 0) || 0,
    reason: row.reason?.trim() || "Relevant to your Kwant Desk network",
  };
}

async function followClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor || actor.mode !== "supabase") return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

function fallbackFollowId(targetUserId: string) {
  return `profile-follow:${targetUserId}`;
}

function profileVisibility(payload: Record<string, unknown> | null | undefined, key: "followers" | "following") {
  const visibility = payload?.visibility;
  if (!visibility || typeof visibility !== "object" || Array.isArray(visibility)) return "community";
  return (visibility as Record<string, unknown>)[key] === "private" ? "private" : "community";
}

async function loadFallbackSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  profileUserId: string,
): Promise<SocialFollowSummary> {
  const [followersResult, followingResult, viewerResult, reverseResult, profileResult] = await Promise.all([
    supabase
      .from("social_objects")
      .select("id", { count: "exact", head: true })
      .eq("object_type", "reaction")
      .eq("payload->>kind", FALLBACK_FOLLOW_KIND)
      .eq("payload->>targetUserId", profileUserId),
    supabase
      .from("social_objects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profileUserId)
      .eq("object_type", "reaction")
      .eq("payload->>kind", FALLBACK_FOLLOW_KIND),
    supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actorUserId)
      .eq("id", fallbackFollowId(profileUserId))
      .eq("object_type", "reaction")
      .maybeSingle(),
    supabase
      .from("social_objects")
      .select("id")
      .eq("user_id", profileUserId)
      .eq("id", fallbackFollowId(actorUserId))
      .eq("object_type", "reaction")
      .maybeSingle(),
    supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", profileUserId)
      .eq("object_type", "profile")
      .maybeSingle(),
  ]);
  const error = followersResult.error
    || followingResult.error
    || viewerResult.error
    || reverseResult.error
    || profileResult.error;
  if (error) throw error;
  const profilePayload = profileResult.data?.payload as Record<string, unknown> | undefined;
  const viewerPayload = viewerResult.data?.payload as Record<string, unknown> | undefined;
  const viewingOwnProfile = actorUserId === profileUserId;
  return {
    configured: true,
    profileUserId,
    followerCount: numberValue(followersResult.count),
    followingCount: numberValue(followingResult.count),
    viewerFollows: Boolean(viewerResult.data),
    followsViewer: Boolean(reverseResult.data),
    notificationsEnabled: Boolean(viewerPayload?.notifyPosts),
    canViewFollowers: viewingOwnProfile || profileVisibility(profilePayload, "followers") !== "private",
    canViewFollowing: viewingOwnProfile || profileVisibility(profilePayload, "following") !== "private",
  };
}

async function loadFallbackList(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  profileUserId: string,
  listKind: SocialFollowListKind,
  offset: number,
  limit: number,
): Promise<SocialFollowListItem[]> {
  let query = supabase
    .from("social_objects")
    .select("user_id,payload,created_at")
    .eq("object_type", "reaction")
    .eq("payload->>kind", FALLBACK_FOLLOW_KIND)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  query = listKind === "followers"
    ? query.eq("payload->>targetUserId", profileUserId)
    : query.eq("user_id", profileUserId);
  const relationsResult = await query;
  if (relationsResult.error) throw relationsResult.error;
  const relations = (relationsResult.data ?? []) as SocialFollowFallbackRow[];
  const relationUserIds = relations
    .map((row) => listKind === "followers"
      ? cleanUuid(row.user_id)
      : cleanUuid(row.payload?.targetUserId))
    .filter(Boolean);
  if (!relationUserIds.length) return [];

  const [profilesResult, viewerRelationsResult, reverseRelationsResult] = await Promise.all([
    supabase
      .from("social_objects")
      .select("user_id,author_label,payload")
      .eq("object_type", "profile")
      .in("user_id", relationUserIds),
    supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actorUserId)
      .eq("object_type", "reaction")
      .eq("payload->>kind", FALLBACK_FOLLOW_KIND)
      .in("payload->>targetUserId", relationUserIds),
    supabase
      .from("social_objects")
      .select("user_id")
      .eq("object_type", "reaction")
      .eq("payload->>kind", FALLBACK_FOLLOW_KIND)
      .eq("payload->>targetUserId", actorUserId)
      .in("user_id", relationUserIds),
  ]);
  const error = profilesResult.error || viewerRelationsResult.error || reverseRelationsResult.error;
  if (error) throw error;
  const profiles = new Map(
    ((profilesResult.data ?? []) as SocialProfileFallbackRow[])
      .map((row) => [cleanUuid(row.user_id), row] as const)
      .filter(([userId]) => Boolean(userId)),
  );
  const viewerRelations = new Map(
    ((viewerRelationsResult.data ?? []) as Array<{ payload?: Record<string, unknown> | null }>).map((row) => [
      cleanUuid(row.payload?.targetUserId),
      row.payload ?? {},
    ]),
  );
  const followsViewer = new Set(
    ((reverseRelationsResult.data ?? []) as Array<{ user_id?: string | null }>)
      .map((row) => cleanUuid(row.user_id))
      .filter(Boolean),
  );
  return relations.flatMap((relation): SocialFollowListItem[] => {
    const userId = listKind === "followers"
      ? cleanUuid(relation.user_id)
      : cleanUuid(relation.payload?.targetUserId);
    if (!userId) return [];
    const profile = profiles.get(userId);
    const payload = profile?.payload ?? {};
    const viewerRelation = viewerRelations.get(userId);
    return [{
      userId,
      displayName: typeof payload.displayName === "string" && payload.displayName.trim()
        ? payload.displayName.trim()
        : profile?.author_label?.trim() || "Kwant User",
      handle: typeof payload.handle === "string" ? payload.handle.trim().replace(/^@/, "") : "",
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "",
      bio: typeof payload.bio === "string" ? payload.bio.trim().slice(0, 240) : "",
      viewerFollows: Boolean(viewerRelation),
      followsViewer: followsViewer.has(userId),
      notificationsEnabled: Boolean(viewerRelation?.notifyPosts),
      followedAt: relation.created_at || new Date(0).toISOString(),
    }];
  });
}

async function saveFallbackFollow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  actorLabel: string,
  targetUserId: string,
  notifyPosts = false,
) {
  const now = new Date().toISOString();
  const result = await supabase.from("social_objects").upsert({
    user_id: actorUserId,
    id: fallbackFollowId(targetUserId),
    author_label: actorLabel,
    object_type: "reaction",
    scope: "community",
    desk_id: null,
    parent_id: `profile:${targetUserId}`,
    payload: { kind: FALLBACK_FOLLOW_KIND, targetUserId, notifyPosts },
    created_at: now,
    updated_at: now,
  }, { onConflict: "user_id,id" });
  if (result.error) throw result.error;
}

async function removeFallbackFollow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  targetUserId: string,
) {
  const result = await supabase
    .from("social_objects")
    .delete()
    .eq("user_id", actorUserId)
    .eq("id", fallbackFollowId(targetUserId))
    .eq("object_type", "reaction");
  if (result.error) throw result.error;
}

async function updateFallbackNotifications(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  targetUserId: string,
  notifyPosts: boolean,
) {
  const result = await supabase
    .from("social_objects")
    .update({
      payload: { kind: FALLBACK_FOLLOW_KIND, targetUserId, notifyPosts },
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", actorUserId)
    .eq("id", fallbackFollowId(targetUserId))
    .eq("object_type", "reaction")
    .select("id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Follow this profile before turning on notifications.");
}

async function loadSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
  profileUserId: string,
): Promise<{ summary: SocialFollowSummary; storage: FollowStorage }> {
  const result = await supabase.rpc("social_profile_follow_summary", {
    target_user_id: profileUserId,
  });
  if (result.error) {
    if (!migrationUnavailable(result.error.code)) throw result.error;
    return {
      summary: await loadFallbackSummary(supabase, actorUserId, profileUserId),
      storage: "social-objects",
    };
  }
  const rows = Array.isArray(result.data) ? result.data as FollowSummaryRow[] : [];
  return { summary: fromSummaryRow(profileUserId, rows[0] ?? null), storage: "dedicated" };
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await followClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  const wantsRecommendations = request.nextUrl.searchParams.get("recommendations") === "1";
  if (wantsRecommendations) {
    const limit = Math.max(1, Math.min(20, Math.floor(Number(request.nextUrl.searchParams.get("limit")) || 8)));
    try {
      const result = await supabase.rpc("social_profile_recommendations", { result_limit: limit });
      if (result.error) throw result.error;
      const recommendations = (Array.isArray(result.data) ? result.data as FollowRecommendationRow[] : [])
        .map(fromRecommendationRow)
        .filter((item): item is SocialFollowRecommendation => item !== null);
      return NextResponse.json(
        { recommendations },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
      if (migrationUnavailable(code)) {
        const profilesResult = await supabase
          .from("social_objects")
          .select("user_id,author_label,payload")
          .eq("object_type", "profile")
          .neq("user_id", actor.userId)
          .order("updated_at", { ascending: false })
          .limit(Math.max(20, limit * 4));
        if (profilesResult.error) return unavailableResponse();
        const followingResult = await supabase
          .from("social_objects")
          .select("payload")
          .eq("user_id", actor.userId)
          .eq("object_type", "reaction")
          .eq("payload->>kind", FALLBACK_FOLLOW_KIND);
        const incomingResult = await supabase
          .from("social_objects")
          .select("user_id")
          .eq("object_type", "reaction")
          .eq("payload->>kind", FALLBACK_FOLLOW_KIND)
          .eq("payload->>targetUserId", actor.userId);
        if (followingResult.error || incomingResult.error) return unavailableResponse();
        const alreadyFollowing = new Set(
          ((followingResult.data ?? []) as Array<{ payload?: Record<string, unknown> | null }>)
            .map((row) => cleanUuid(row.payload?.targetUserId))
            .filter(Boolean),
        );
        const followsViewer = new Set(
          ((incomingResult.data ?? []) as Array<{ user_id?: string | null }>)
            .map((row) => cleanUuid(row.user_id))
            .filter(Boolean),
        );
        const recommendations = ((profilesResult.data ?? []) as SocialProfileFallbackRow[])
          .flatMap((row, index): SocialFollowRecommendation[] => {
            const userId = cleanUuid(row.user_id);
            if (!userId || alreadyFollowing.has(userId)) return [];
            const payload = row.payload ?? {};
            return [{
              userId,
              displayName: typeof payload.displayName === "string" && payload.displayName.trim()
                ? payload.displayName.trim()
                : row.author_label?.trim() || "Kwant User",
              handle: typeof payload.handle === "string" ? payload.handle.trim().replace(/^@/, "") : "",
              avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl.trim() : "",
              bio: typeof payload.bio === "string" ? payload.bio.trim().slice(0, 240) : "",
              mutualFollowCount: 0,
              sharedDeskCount: 0,
              marketOverlapCount: 0,
              recentlyViewedAt: null,
              followsViewer: followsViewer.has(userId),
              viewerFollows: false,
              relevanceScore: Math.max(1, 100 - index),
              reason: followsViewer.has(userId) ? "Follows you" : "Active in the Kwant Desk network",
            }];
          })
          .slice(0, limit);
        return NextResponse.json(
          { recommendations },
          { headers: { "Cache-Control": "private, no-store, max-age=0" } },
        );
      }
      return NextResponse.json({ error: "Relevant connections could not be calculated." }, { status: 502 });
    }
  }

  const profileUserId = cleanUuid(request.nextUrl.searchParams.get("profileUserId"));
  if (!profileUserId) {
    return NextResponse.json({ error: "Choose a Kwant Desk profile." }, { status: 400 });
  }

  const requestedList = request.nextUrl.searchParams.get("list");
  const listKind: SocialFollowListKind | null =
    requestedList === "followers" || requestedList === "following"
      ? requestedList
      : null;
  const offset = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get("offset")) || 0));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(request.nextUrl.searchParams.get("limit")) || 50)));

  try {
    const loaded = await loadSummary(supabase, actor.userId, profileUserId);
    const summary = loaded.summary;
    if (!listKind) {
      return NextResponse.json(
        { summary },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const canView = listKind === "followers"
      ? summary.canViewFollowers
      : summary.canViewFollowing;
    if (!canView) {
      return NextResponse.json(
        {
          summary,
          list: { kind: listKind, items: [], offset, nextOffset: null },
        },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    let items: SocialFollowListItem[];
    if (loaded.storage === "social-objects") {
      items = await loadFallbackList(supabase, actor.userId, profileUserId, listKind, offset, limit);
    } else {
      const result = await supabase.rpc("social_profile_follow_list", {
        target_user_id: profileUserId,
        list_kind: listKind,
        result_limit: limit,
        result_offset: offset,
      });
      if (result.error) throw result.error;
      items = (Array.isArray(result.data) ? result.data as FollowListRow[] : [])
        .map(fromListRow)
        .filter((item): item is SocialFollowListItem => item !== null);
    }
    const total = listKind === "followers" ? summary.followerCount : summary.followingCount;
    const nextOffset = offset + items.length < total ? offset + items.length : null;

    return NextResponse.json(
      {
        summary,
        list: { kind: listKind, items, offset, nextOffset },
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (migrationUnavailable(code)) return unavailableResponse();
    return NextResponse.json({ error: "Follow information could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await followClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  let body: {
    action?: unknown;
    targetUserId?: unknown;
    enabled?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The follow request could not be read." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  const targetUserId = cleanUuid(body.targetUserId);
  if (!targetUserId || targetUserId === actor.userId) {
    return NextResponse.json({ error: "Choose another Kwant Desk profile." }, { status: 400 });
  }

  try {
    if (action === "profile_view") {
      const result = await supabase.rpc("record_social_profile_view", { target_user_id: targetUserId });
      if (result.error && !migrationUnavailable(result.error.code)) throw result.error;
      return NextResponse.json(
        { recorded: true },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const loaded = await loadSummary(supabase, actor.userId, targetUserId);
    if (action === "follow" && loaded.storage === "social-objects") {
      await saveFallbackFollow(supabase, actor.userId, actor.label, targetUserId);
    } else if (action === "follow") {
      const result = await supabase
        .from("social_profile_follows")
        .upsert(
          {
            follower_id: actor.userId,
            following_id: targetUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "follower_id,following_id" },
        );
      if (result.error) throw result.error;
    } else if (action === "unfollow" && loaded.storage === "social-objects") {
      await removeFallbackFollow(supabase, actor.userId, targetUserId);
    } else if (action === "unfollow") {
      const result = await supabase
        .from("social_profile_follows")
        .delete()
        .eq("follower_id", actor.userId)
        .eq("following_id", targetUserId);
      if (result.error) throw result.error;
    } else if (action === "notifications" && loaded.storage === "social-objects") {
      if (!loaded.summary.viewerFollows) {
        return NextResponse.json(
          { error: "Follow this profile before turning on notifications." },
          { status: 409 },
        );
      }
      await updateFallbackNotifications(supabase, actor.userId, targetUserId, Boolean(body.enabled));
    } else if (action === "notifications") {
      const result = await supabase
        .from("social_profile_follows")
        .update({
          notify_posts: Boolean(body.enabled),
          updated_at: new Date().toISOString(),
        })
        .eq("follower_id", actor.userId)
        .eq("following_id", targetUserId)
        .select("following_id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) {
        return NextResponse.json(
          { error: "Follow this profile before turning on notifications." },
          { status: 409 },
        );
      }
    } else {
      return NextResponse.json({ error: "Unsupported follow action." }, { status: 400 });
    }

    const summary = loaded.storage === "social-objects"
      ? await loadFallbackSummary(supabase, actor.userId, targetUserId)
      : (await loadSummary(supabase, actor.userId, targetUserId)).summary;
    return NextResponse.json(
      { summary },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
    if (migrationUnavailable(code)) return unavailableResponse();
    return NextResponse.json({ error: "The follow setting could not be saved." }, { status: 502 });
  }
}
