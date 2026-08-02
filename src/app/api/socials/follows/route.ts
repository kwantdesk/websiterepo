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

async function loadSummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileUserId: string,
) {
  const result = await supabase.rpc("social_profile_follow_summary", {
    target_user_id: profileUserId,
  });
  if (result.error) throw result.error;
  const rows = Array.isArray(result.data) ? result.data as FollowSummaryRow[] : [];
  return fromSummaryRow(profileUserId, rows[0] ?? null);
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await followClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailableResponse();

  const wantsRecommendations = request.nextUrl.searchParams.get("recommendations") === "1";
  if (wantsRecommendations) {
    try {
      const limit = Math.max(1, Math.min(20, Math.floor(Number(request.nextUrl.searchParams.get("limit")) || 8)));
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
      if (migrationUnavailable(code)) return unavailableResponse();
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
    const summary = await loadSummary(supabase, profileUserId);
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

    const result = await supabase.rpc("social_profile_follow_list", {
      target_user_id: profileUserId,
      list_kind: listKind,
      result_limit: limit,
      result_offset: offset,
    });
    if (result.error) throw result.error;
    const items = (Array.isArray(result.data) ? result.data as FollowListRow[] : [])
      .map(fromListRow)
      .filter((item): item is SocialFollowListItem => item !== null);
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
      if (result.error) throw result.error;
      return NextResponse.json(
        { recorded: true },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
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
    } else if (action === "unfollow") {
      const result = await supabase
        .from("social_profile_follows")
        .delete()
        .eq("follower_id", actor.userId)
        .eq("following_id", targetUserId);
      if (result.error) throw result.error;
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

    const summary = await loadSummary(supabase, targetUserId);
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
