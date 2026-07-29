import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor, type RouteActor } from "@/lib/serverAuth";
import {
  normalizePresenceStatus,
  type FriendMessage,
  type FriendRequestSummary,
  type FriendSummary,
  type FriendsPayload,
  type PresenceStatus,
} from "@/lib/friends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SocialRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: "profile" | "follow" | "comment" | "desk" | "desk-member";
  scope: "private" | "friends" | "desk" | "community";
  desk_id: string | null;
  parent_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

const emptyPayload = (cloud = false): FriendsPayload => ({
  cloud,
  viewer: null,
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  directory: [],
  messages: [],
});

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function cleanText(value: unknown, maximum = 120) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanIdentifier(value: unknown, maximum = 180) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum)
    : "";
}

function normalizeHandle(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/^@+/, "").toLowerCase()
    : "";
}

function validHandle(value: string) {
  return /^[a-z][a-z0-9_]{2,23}$/.test(value);
}

function authorLabel(actor: RouteActor) {
  if (actor.displayName) return cleanText(actor.displayName, 48);
  const stem = actor.label.includes("@") ? actor.label.split("@")[0] : actor.label;
  return cleanText(stem.replace(/[._-]+/g, " "), 48) || "Kwant Trader";
}

function profilePayload(row: SocialRow | undefined) {
  return row?.payload && typeof row.payload === "object" ? row.payload : {};
}

function stringMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "string")
      .map(([key, entry]) => [cleanIdentifier(key, 80), String(entry)]),
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => cleanIdentifier(entry, 80)).filter(Boolean).slice(0, 250)
    : [];
}

async function socialClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

async function loadRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data, error } = await supabase
    .from("social_objects")
    .select("user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at")
    .in("object_type", ["profile", "follow", "comment", "desk", "desk-member"])
    .order("updated_at", { ascending: false })
    .limit(2_000);
  return { rows: (data ?? []) as SocialRow[], error };
}

function effectiveStatus(payload: Record<string, unknown>) {
  const status = normalizePresenceStatus(payload.presenceStatus);
  const lastSeenAt = cleanText(payload.lastSeenAt, 40) || null;
  const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : 0;
  const fresh = Boolean(lastSeen && Date.now() - lastSeen < 150_000);
  return {
    status: status === "online" && !fresh ? "offline" as const : status,
    isOnline: status === "dnd" || status === "away" || (status === "online" && fresh),
    lastSeenAt,
  };
}

function buildPayload(rows: SocialRow[], actor: RouteActor, requestedFriendId = ""): FriendsPayload {
  const profiles = new Map<string, SocialRow>();
  const follows = rows.filter((row) => row.object_type === "follow");
  const messages = rows.filter(
    (row) => row.object_type === "comment" && row.payload?.kind === "friend-message",
  );
  const deskRows = rows.filter((row) => row.object_type === "desk");
  const memberRows = rows.filter((row) => row.object_type === "desk-member");

  for (const row of rows) {
    if (row.object_type === "profile" && !profiles.has(row.user_id)) profiles.set(row.user_id, row);
  }

  const deskNames = new Map<string, string>();
  for (const row of deskRows) {
    deskNames.set(row.id, cleanText(row.payload?.name, 80) || cleanText(row.author_label, 80) || "Private Desk");
  }
  const desksByUser = new Map<string, { id: string; name: string }[]>();
  for (const row of memberRows) {
    if (!row.desk_id) continue;
    const current = desksByUser.get(row.user_id) ?? [];
    if (!current.some((desk) => desk.id === row.desk_id)) {
      current.push({ id: row.desk_id, name: deskNames.get(row.desk_id) ?? "Private Desk" });
    }
    desksByUser.set(row.user_id, current);
  }

  const ownProfile = profiles.get(actor.userId);
  const ownPayload = profilePayload(ownProfile);
  const blocked = new Set(stringArray(ownPayload.blockedUserIds));
  const dismissed = stringMap(ownPayload.dismissedFriendRequests);
  const readAt = stringMap(ownPayload.friendReadAt);

  const outgoingRows = follows.filter((row) => row.user_id === actor.userId);
  const outgoingTargets = new Map<string, SocialRow>();
  for (const row of outgoingRows) {
    const target = cleanIdentifier(row.payload?.targetUserId, 80);
    if (target) outgoingTargets.set(target, row);
  }
  const incomingRows = follows.filter(
    (row) => cleanIdentifier(row.payload?.targetUserId, 80) === actor.userId,
  );
  const incomingByUser = new Map(incomingRows.map((row) => [row.user_id, row]));
  const incomingUserIds = new Set(incomingRows.map((row) => row.user_id));
  const friendIds = new Set(
    [...outgoingTargets.keys()].filter((target) => incomingByUser.has(target) && !blocked.has(target)),
  );

  const messagesByFriend = new Map<string, FriendMessage[]>();
  for (const row of messages) {
    const recipientUserId = cleanIdentifier(row.payload?.recipientUserId, 80);
    const senderUserId = row.user_id;
    const friendId = senderUserId === actor.userId ? recipientUserId : senderUserId;
    if (!friendId || !friendIds.has(friendId)) continue;
    const body = cleanText(row.payload?.body, 2_000);
    if (!body) continue;
    const item: FriendMessage = {
      id: row.id,
      senderUserId,
      recipientUserId,
      body,
      sentAt: cleanText(row.payload?.sentAt, 40) || row.created_at,
    };
    const list = messagesByFriend.get(friendId) ?? [];
    list.push(item);
    messagesByFriend.set(friendId, list);
  }
  for (const list of messagesByFriend.values()) {
    list.sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt));
  }

  const summary = (userId: string): FriendSummary => {
    const row = profiles.get(userId);
    const payload = profilePayload(row);
    const presence = effectiveStatus(payload);
    const friendMessages = messagesByFriend.get(userId) ?? [];
    const last = friendMessages.at(-1);
    const readTimestamp = Date.parse(readAt[userId] ?? "") || 0;
    const unreadCount = friendMessages.filter(
      (message) => message.senderUserId === userId && Date.parse(message.sentAt) > readTimestamp,
    ).length;
    const fallbackName = row?.author_label || "Kwant Trader";
    const displayName = cleanText(payload.displayName, 60) || cleanText(fallbackName, 60);
    const fallbackHandle = fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
    return {
      userId,
      displayName,
      handle: cleanIdentifier(payload.handle, 32).toLowerCase() || fallbackHandle,
      avatarUrl: cleanText(payload.avatarUrl, 1_000),
      presenceStatus: presence.status,
      presenceMessage: cleanText(payload.presenceMessage, 80),
      lastSeenAt: presence.lastSeenAt,
      isOnline: presence.isOnline,
      desks: desksByUser.get(userId) ?? [],
      unreadCount,
      lastMessage: last?.body ?? "",
      lastMessageAt: last?.sentAt ?? null,
    };
  };

  const requestSummary = (row: SocialRow, userId: string): FriendRequestSummary => ({
    ...summary(userId),
    requestedAt: row.updated_at,
  });
  const incoming = incomingRows
    .filter((row) => {
      if (friendIds.has(row.user_id) || blocked.has(row.user_id)) return false;
      const dismissedAt = Date.parse(dismissed[row.user_id] ?? "") || 0;
      return Date.parse(row.updated_at) > dismissedAt;
    })
    .map((row) => requestSummary(row, row.user_id))
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  const outgoing = [...outgoingTargets.entries()]
    .filter(([target]) => !friendIds.has(target) && !blocked.has(target))
    .map(([target, row]) => requestSummary(row, target))
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  const directory = [...profiles.keys()]
    .filter(
      (userId) =>
        userId !== actor.userId
        && !friendIds.has(userId)
        && !blocked.has(userId)
        && !outgoingTargets.has(userId)
        && !incomingUserIds.has(userId),
    )
    .map(summary)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const blockedProfiles = [...blocked]
    .filter((userId) => profiles.has(userId))
    .map(summary)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const friends = [...friendIds]
    .map(summary)
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || a.displayName.localeCompare(b.displayName));

  return {
    cloud: true,
    viewer: summary(actor.userId),
    friends,
    incoming,
    outgoing,
    blocked: blockedProfiles,
    directory,
    messages: requestedFriendId && friendIds.has(requestedFriendId)
      ? messagesByFriend.get(requestedFriendId) ?? []
      : [],
  };
}

async function upsertProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actor: RouteActor,
  changes: Record<string, unknown>,
) {
  const { data: existing } = await supabase
    .from("social_objects")
    .select("payload")
    .eq("user_id", actor.userId)
    .eq("id", "profile")
    .maybeSingle();
  const payload = existing?.payload && typeof existing.payload === "object"
    ? existing.payload as Record<string, unknown>
    : {};
  const fallbackHandle = (actor.username || actor.label.split("@")[0] || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  const identityDefaults = {
    displayName: cleanText(payload.displayName, 60) || authorLabel(actor),
    handle: cleanIdentifier(payload.handle, 32).toLowerCase() || fallbackHandle,
    avatarUrl: cleanText(payload.avatarUrl, 1_000) || cleanText(actor.avatarUrl, 1_000),
  };
  return supabase.from("social_objects").upsert({
    user_id: actor.userId,
    id: "profile",
    author_label: authorLabel(actor),
    object_type: "profile",
    scope: "community",
    desk_id: null,
    parent_id: null,
    payload: { ...identityDefaults, ...payload, ...changes },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,id" });
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await socialClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json(emptyPayload(false));
  const requestedHandle = request.nextUrl.searchParams.get("handle");
  if (requestedHandle !== null) {
    const handle = normalizeHandle(requestedHandle);
    if (!validHandle(handle)) {
      return NextResponse.json({
        handle,
        available: false,
        reason: "Use 3–24 characters, start with a letter, and only use letters, numbers or underscores.",
      });
    }
    const { data, error } = await supabase
      .from("social_objects")
      .select("user_id")
      .eq("object_type", "profile")
      .ilike("payload->>handle", handle)
      .neq("user_id", actor.userId)
      .limit(1);
    if (error) {
      if (tableUnavailable(error.code)) {
        return NextResponse.json({
          handle,
          available: false,
          reason: "Profile storage is not connected yet.",
        });
      }
      return NextResponse.json({ error: "Handle availability could not be checked." }, { status: 502 });
    }
    return NextResponse.json({ handle, available: (data ?? []).length === 0 });
  }
  const { rows, error } = await loadRows(supabase);
  if (error) {
    if (tableUnavailable(error.code)) return NextResponse.json(emptyPayload(false));
    console.error("Friends load failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Friends could not be loaded." }, { status: 502 });
  }
  const friendId = cleanIdentifier(request.nextUrl.searchParams.get("friendId"), 80);
  return NextResponse.json(buildPayload(rows, actor, friendId), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await socialClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ cloud: false, error: "Account storage is unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request could not be read." }, { status: 400 });
  }
  const action = cleanIdentifier(body.action, 32);
  const targetUserId = cleanIdentifier(body.targetUserId, 80);
  const now = new Date().toISOString();

  if (action === "presence" || action === "identity" || action === "heartbeat") {
    const changes: Record<string, unknown> = { lastSeenAt: now };
    if (action === "presence" || action === "identity") {
      const handle = normalizeHandle(body.handle);
      if (!validHandle(handle)) {
        return NextResponse.json({
          code: "INVALID_HANDLE",
          error: "Your handle must be 3–24 characters, start with a letter, and only use letters, numbers or underscores.",
        }, { status: 400 });
      }
      const { data: duplicateHandle, error: handleError } = await supabase
        .from("social_objects")
        .select("user_id")
        .eq("object_type", "profile")
        .ilike("payload->>handle", handle)
        .neq("user_id", actor.userId)
        .limit(1);
      if (handleError && !tableUnavailable(handleError.code)) {
        return NextResponse.json({ error: "Your handle could not be verified." }, { status: 502 });
      }
      if ((duplicateHandle ?? []).length > 0) {
        return NextResponse.json({
          code: "HANDLE_TAKEN",
          error: `@${handle} is already in use. Choose another handle.`,
        }, { status: 409 });
      }
      if (action === "presence") {
        changes.presenceStatus = normalizePresenceStatus(body.presenceStatus);
        changes.presenceMessage = cleanText(body.presenceMessage, 80);
      }
      const displayName = cleanText(body.displayName, 60);
      if (displayName) changes.displayName = displayName;
      changes.handle = handle;
    }
    const { error } = await upsertProfile(supabase, actor, changes);
    if (error?.code === "23505") {
      return NextResponse.json({
        code: "HANDLE_TAKEN",
        error: `@${normalizeHandle(body.handle)} is already in use. Choose another handle.`,
      }, { status: 409 });
    }
    if (error) return NextResponse.json({ error: "Your identity could not be saved." }, { status: 502 });
    if ((action === "presence" || action === "identity") && actor.mode === "supabase") {
      const displayName = cleanText(body.displayName, 60) || authorLabel(actor);
      const handle = normalizeHandle(body.handle);
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          username: handle,
        },
      });
      if (metadataError) {
        console.warn("Identity metadata sync failed", { message: metadataError.message });
      }
    }
    if (action === "heartbeat" && body.lightweight === true) {
      return NextResponse.json({ ok: true });
    }
  } else if (action === "request" || action === "accept") {
    if (!targetUserId || targetUserId === actor.userId) {
      return NextResponse.json({ error: "Choose another trader." }, { status: 400 });
    }
    const { data: targetProfile } = await supabase
      .from("social_objects")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("id", "profile")
      .eq("object_type", "profile")
      .maybeSingle();
    if (!targetProfile) {
      return NextResponse.json({ error: "That Kwant Desk account is not available." }, { status: 404 });
    }
    const { data: ownProfile } = await supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("id", "profile")
      .maybeSingle();
    const ownProfilePayload = ownProfile?.payload && typeof ownProfile.payload === "object"
      ? ownProfile.payload as Record<string, unknown>
      : {};
    if (stringArray(ownProfilePayload.blockedUserIds).includes(targetUserId)) {
      return NextResponse.json({ error: "Unblock this trader before sending a request." }, { status: 409 });
    }
    if (action === "accept") {
      const { data: incoming } = await supabase
        .from("social_objects")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("object_type", "follow")
        .eq("payload->>targetUserId", actor.userId)
        .maybeSingle();
      if (!incoming) return NextResponse.json({ error: "That friend request is no longer active." }, { status: 409 });
    }
    const { error } = await supabase.from("social_objects").upsert({
      user_id: actor.userId,
      id: `follow:${targetUserId}`,
      author_label: authorLabel(actor),
      object_type: "follow",
      scope: "community",
      desk_id: null,
      parent_id: null,
      payload: { targetUserId, kind: "friend-request" },
      updated_at: now,
    }, { onConflict: "user_id,id" });
    if (error) return NextResponse.json({ error: "The friend request could not be saved." }, { status: 502 });
  } else if (action === "cancel") {
    if (!targetUserId || targetUserId === actor.userId) {
      return NextResponse.json({ error: "Choose another trader." }, { status: 400 });
    }
    const { error } = await supabase
      .from("social_objects")
      .delete()
      .eq("user_id", actor.userId)
      .eq("id", `follow:${targetUserId}`);
    if (error) return NextResponse.json({ error: "The request could not be cancelled." }, { status: 502 });
  } else if (action === "decline" || action === "remove" || action === "block" || action === "unblock") {
    if (!targetUserId || targetUserId === actor.userId) {
      return NextResponse.json({ error: "Choose another trader." }, { status: 400 });
    }
    const { data: profile } = await supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("id", "profile")
      .maybeSingle();
    const payload = profile?.payload && typeof profile.payload === "object"
      ? profile.payload as Record<string, unknown>
      : {};
    const dismissed = stringMap(payload.dismissedFriendRequests);
    const blocked = new Set(stringArray(payload.blockedUserIds));
    if (action !== "unblock") dismissed[targetUserId] = now;
    if (action === "block") blocked.add(targetUserId);
    if (action === "unblock") blocked.delete(targetUserId);
    const { error } = await upsertProfile(supabase, actor, {
      dismissedFriendRequests: dismissed,
      blockedUserIds: [...blocked],
    });
    if (error) return NextResponse.json({ error: "That account setting could not be saved." }, { status: 502 });
    if (action === "remove" || action === "block") {
      await supabase
        .from("social_objects")
        .delete()
        .eq("user_id", actor.userId)
        .eq("id", `follow:${targetUserId}`);
    }
  } else if (action === "message") {
    const bodyText = cleanText(body.body, 2_000);
    if (!targetUserId || !bodyText) {
      return NextResponse.json({ error: "Write a message first." }, { status: 400 });
    }
    const { rows, error: rowsError } = await loadRows(supabase);
    if (rowsError) return NextResponse.json({ error: "Friendship could not be verified." }, { status: 502 });
    const hasOutgoing = rows.some(
      (row) => row.object_type === "follow"
        && row.user_id === actor.userId
        && cleanIdentifier(row.payload?.targetUserId, 80) === targetUserId,
    );
    const hasIncoming = rows.some(
      (row) => row.object_type === "follow"
        && row.user_id === targetUserId
        && cleanIdentifier(row.payload?.targetUserId, 80) === actor.userId,
    );
    if (!hasOutgoing || !hasIncoming) {
      return NextResponse.json({ error: "Messages are available after both traders connect." }, { status: 403 });
    }
    const conversationId = [actor.userId, targetUserId].sort().join(":");
    const { error } = await supabase.from("social_objects").insert({
      user_id: actor.userId,
      id: `friend-message:${randomUUID()}`,
      author_label: authorLabel(actor),
      object_type: "comment",
      scope: "friends",
      desk_id: null,
      parent_id: `friend-chat:${conversationId}`,
      payload: {
        kind: "friend-message",
        recipientUserId: targetUserId,
        body: bodyText,
        sentAt: now,
      },
    });
    if (error) return NextResponse.json({ error: "The message could not be sent." }, { status: 502 });
  } else if (action === "mark-read") {
    if (!targetUserId) return NextResponse.json({ error: "Choose a conversation." }, { status: 400 });
    const { data: profile } = await supabase
      .from("social_objects")
      .select("payload")
      .eq("user_id", actor.userId)
      .eq("id", "profile")
      .maybeSingle();
    const payload = profile?.payload && typeof profile.payload === "object"
      ? profile.payload as Record<string, unknown>
      : {};
    const friendReadAt = stringMap(payload.friendReadAt);
    friendReadAt[targetUserId] = now;
    const { error } = await upsertProfile(supabase, actor, { friendReadAt });
    if (error) return NextResponse.json({ error: "Read state could not be saved." }, { status: 502 });
  } else {
    return NextResponse.json({ error: "Unsupported friends action." }, { status: 400 });
  }

  const { rows, error } = await loadRows(supabase);
  if (error) return NextResponse.json({ ok: true });
  return NextResponse.json(buildPayload(rows, actor, targetUserId));
}
