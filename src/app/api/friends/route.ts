import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor, type RouteActor } from "@/lib/serverAuth";
import {
  normalizePresenceStatus,
  type FriendGroupMember,
  type FriendGroupSummary,
  type FriendMessage,
  type FriendMessageAttachment,
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

type FriendChatRow = {
  id: string;
  name: string;
  description: string;
  created_by: string;
  allow_member_invites: boolean;
  created_at: string;
  updated_at: string;
};

type FriendChatMemberRow = {
  chat_id: string;
  user_id: string;
  role: "owner" | "member";
  muted: boolean;
  last_read_at: string;
  joined_at: string;
};

type FriendChatMessageRow = {
  id: string;
  chat_id: string;
  sender_user_id: string;
  body: string;
  attachments: unknown;
  created_at: string;
};

type FriendChatRows = {
  ready: boolean;
  chats: FriendChatRow[];
  members: FriendChatMemberRow[];
  messages: FriendChatMessageRow[];
};

const emptyPayload = (cloud = false): FriendsPayload => ({
  cloud,
  groupsReady: false,
  viewer: null,
  friends: [],
  groups: [],
  incoming: [],
  outgoing: [],
  blocked: [],
  directory: [],
  messages: [],
  groupMessages: [],
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

function clientMessageId(value: unknown) {
  const candidate = cleanIdentifier(value, 40);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : randomUUID();
}

function cleanAvatarUrl(value: unknown) {
  if (typeof value !== "string") return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value)) return value.slice(0, 1_600_000);
  if (/^https:\/\//i.test(value)) return value.slice(0, 2_000);
  return "";
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

function messageAttachments(value: unknown): FriendMessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const attachment = entry as Record<string, unknown>;
    const id = cleanIdentifier(attachment.id, 80) || `image:${randomUUID()}`;
    const type = cleanText(attachment.type, 80).toLowerCase();
    const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl.trim() : "";
    const name = cleanText(attachment.name, 120) || "Chart image";
    const declaredSize = Math.max(0, Math.floor(Number(attachment.size) || 0));
    const prefix = /^data:image\/(png|jpe?g|webp|gif);base64,/i.exec(dataUrl);
    if (!prefix || dataUrl.length > 1_350_000 || declaredSize > 950_000) return [];
    const encoded = dataUrl.slice(prefix[0].length);
    const approximateSize = Math.floor(encoded.length * 0.75);
    if (!encoded || approximateSize > 950_000) return [];
    return [{
      id,
      name,
      type: type.startsWith("image/") ? type : `image/${prefix[1].toLowerCase().replace("jpg", "jpeg")}`,
      size: approximateSize,
      dataUrl,
    }];
  });
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

async function loadFriendChatRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  actorUserId: string,
): Promise<FriendChatRows> {
  const membershipResult = await supabase
    .from("friend_chat_members")
    .select("chat_id,user_id,role,muted,last_read_at,joined_at")
    .eq("user_id", actorUserId)
    .order("joined_at", { ascending: false });
  if (membershipResult.error) {
    if (tableUnavailable(membershipResult.error.code)) {
      return { ready: false, chats: [], members: [], messages: [] };
    }
    console.warn("Friend group membership load failed", {
      code: membershipResult.error.code,
      message: membershipResult.error.message,
    });
    return { ready: false, chats: [], members: [], messages: [] };
  }
  const ownMemberships = (membershipResult.data ?? []) as FriendChatMemberRow[];
  const chatIds = ownMemberships.map((row) => row.chat_id);
  if (!chatIds.length) return { ready: true, chats: [], members: [], messages: [] };

  const [chatResult, memberResult, messageResult] = await Promise.all([
    supabase
      .from("friend_chats")
      .select("id,name,description,created_by,allow_member_invites,created_at,updated_at")
      .in("id", chatIds),
    supabase
      .from("friend_chat_members")
      .select("chat_id,user_id,role,muted,last_read_at,joined_at")
      .in("chat_id", chatIds),
    supabase
      .from("friend_chat_messages")
      .select("id,chat_id,sender_user_id,body,attachments,created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: true })
      .limit(2_000),
  ]);
  const error = chatResult.error ?? memberResult.error ?? messageResult.error;
  if (error) {
    if (tableUnavailable(error.code)) {
      return { ready: false, chats: [], members: [], messages: [] };
    }
    console.warn("Friend group chat load failed", { code: error.code, message: error.message });
    return { ready: false, chats: [], members: [], messages: [] };
  }
  return {
    ready: true,
    chats: (chatResult.data ?? []) as FriendChatRow[],
    members: (memberResult.data ?? []) as FriendChatMemberRow[],
    messages: (messageResult.data ?? []) as FriendChatMessageRow[],
  };
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

function connectedFriendIds(rows: SocialRow[], userId: string) {
  const outgoing = new Set(
    rows
      .filter((row) => row.object_type === "follow" && row.user_id === userId)
      .map((row) => cleanIdentifier(row.payload?.targetUserId, 80))
      .filter(Boolean),
  );
  const incoming = new Set(
    rows
      .filter(
        (row) =>
          row.object_type === "follow"
          && cleanIdentifier(row.payload?.targetUserId, 80) === userId,
      )
      .map((row) => row.user_id),
  );
  return new Set([...outgoing].filter((target) => incoming.has(target)));
}

function buildPayload(
  rows: SocialRow[],
  actor: RouteActor,
  requestedFriendId = "",
  friendChatRows: FriendChatRows = { ready: false, chats: [], members: [], messages: [] },
  requestedGroupId = "",
): FriendsPayload {
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
    const attachments = messageAttachments(row.payload?.attachments);
    if (!body && !attachments.length) continue;
    const item: FriendMessage = {
      id: row.id,
      senderUserId,
      recipientUserId,
      body,
      sentAt: cleanText(row.payload?.sentAt, 40) || row.created_at,
      attachments: attachments.length ? attachments : undefined,
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
      avatarUrl: cleanAvatarUrl(payload.avatarUrl),
      presenceStatus: presence.status,
      presenceMessage: cleanText(payload.presenceMessage, 80),
      lastSeenAt: presence.lastSeenAt,
      isOnline: presence.isOnline,
      desks: desksByUser.get(userId) ?? [],
      unreadCount,
      lastMessage: last?.body || (last?.attachments?.length ? "Image" : ""),
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

  const chatMembers = new Map<string, FriendChatMemberRow[]>();
  for (const member of friendChatRows.members) {
    const members = chatMembers.get(member.chat_id) ?? [];
    members.push(member);
    chatMembers.set(member.chat_id, members);
  }
  const chatMessages = new Map<string, FriendMessage[]>();
  for (const row of friendChatRows.messages) {
    const attachments = messageAttachments(row.attachments);
    const body = cleanText(row.body, 2_000);
    if (!body && !attachments.length) continue;
    const messages = chatMessages.get(row.chat_id) ?? [];
    messages.push({
      id: row.id,
      groupId: row.chat_id,
      senderUserId: row.sender_user_id,
      recipientUserId: "",
      body,
      sentAt: row.created_at,
      attachments: attachments.length ? attachments : undefined,
    });
    chatMessages.set(row.chat_id, messages);
  }

  const groups: FriendGroupSummary[] = friendChatRows.chats.map((chat) => {
    const memberships = chatMembers.get(chat.id) ?? [];
    const ownMembership = memberships.find((member) => member.user_id === actor.userId);
    const messages = chatMessages.get(chat.id) ?? [];
    const last = messages.at(-1);
    const readTimestamp = Date.parse(ownMembership?.last_read_at ?? "") || 0;
    const members: FriendGroupMember[] = memberships
      .map((member) => ({ ...summary(member.user_id), role: member.role }))
      .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner") || a.displayName.localeCompare(b.displayName));
    return {
      id: chat.id,
      name: cleanText(chat.name, 60) || "Group chat",
      description: cleanText(chat.description, 240),
      createdBy: chat.created_by,
      isOwner: chat.created_by === actor.userId || ownMembership?.role === "owner",
      allowMemberInvites: Boolean(chat.allow_member_invites),
      muted: Boolean(ownMembership?.muted),
      members,
      unreadCount: messages.filter(
        (message) => message.senderUserId !== actor.userId && Date.parse(message.sentAt) > readTimestamp,
      ).length,
      lastMessage: last?.body || (last?.attachments?.length ? "Image" : ""),
      lastMessageAt: last?.sentAt ?? null,
    };
  }).sort((a, b) => {
    const newest = (Date.parse(b.lastMessageAt ?? "") || 0) - (Date.parse(a.lastMessageAt ?? "") || 0);
    return newest || a.name.localeCompare(b.name);
  });

  return {
    cloud: true,
    groupsReady: friendChatRows.ready,
    viewer: summary(actor.userId),
    friends,
    groups,
    incoming,
    outgoing,
    blocked: blockedProfiles,
    directory,
    messages: requestedFriendId && friendIds.has(requestedFriendId)
      ? messagesByFriend.get(requestedFriendId) ?? []
      : [],
    groupMessages: requestedGroupId && groups.some((group) => group.id === requestedGroupId)
      ? chatMessages.get(requestedGroupId) ?? []
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
    avatarUrl: cleanAvatarUrl(payload.avatarUrl) || cleanAvatarUrl(actor.avatarUrl),
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
  const [{ rows, error }, friendChatRows] = await Promise.all([
    loadRows(supabase),
    loadFriendChatRows(supabase, actor.userId),
  ]);
  if (error) {
    if (tableUnavailable(error.code)) return NextResponse.json(emptyPayload(false));
    console.error("Friends load failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Friends could not be loaded." }, { status: 502 });
  }
  const friendId = cleanIdentifier(request.nextUrl.searchParams.get("friendId"), 80);
  const groupId = cleanIdentifier(request.nextUrl.searchParams.get("groupId"), 80);
  return NextResponse.json(buildPayload(rows, actor, friendId, friendChatRows, groupId), {
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
  const groupId = cleanIdentifier(body.groupId, 80);
  const now = new Date().toISOString();
  let responseGroupId = groupId;

  if (action === "presence" || action === "identity" || action === "status" || action === "heartbeat") {
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
      const displayName = cleanText(body.displayName, 60);
      if (displayName) changes.displayName = displayName;
      changes.handle = handle;
      if (body.avatarUrl !== undefined) changes.avatarUrl = cleanAvatarUrl(body.avatarUrl);
    }
    if (action === "presence" || action === "status") {
      changes.presenceStatus = normalizePresenceStatus(body.presenceStatus);
      changes.presenceMessage = cleanText(body.presenceMessage, 80);
    }
    const { error } = await upsertProfile(supabase, actor, changes);
    if (error?.code === "23505" && (action === "presence" || action === "identity")) {
      return NextResponse.json({
        code: "HANDLE_TAKEN",
        error: `@${normalizeHandle(body.handle)} is already in use. Choose another handle.`,
      }, { status: 409 });
    }
    if (error) {
      return NextResponse.json({
        error: action === "status" ? "Your presence could not be saved." : "Your identity could not be saved.",
      }, { status: 502 });
    }
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
  } else if (action === "create-group") {
    const name = cleanText(body.name, 60);
    const description = cleanText(body.description, 240);
    const requestedMembers = [...new Set(stringArray(body.memberUserIds))]
      .filter((userId) => userId !== actor.userId)
      .slice(0, 19);
    if (!name) {
      return NextResponse.json({ error: "Give the group chat a name." }, { status: 400 });
    }
    if (requestedMembers.length < 1) {
      return NextResponse.json({ error: "Choose at least one friend for the group." }, { status: 400 });
    }
    const { rows, error: rowsError } = await loadRows(supabase);
    if (rowsError) return NextResponse.json({ error: "Friends could not be verified." }, { status: 502 });
    const friends = connectedFriendIds(rows, actor.userId);
    if (requestedMembers.some((userId) => !friends.has(userId))) {
      return NextResponse.json({ error: "Only connected friends can be added to a group." }, { status: 403 });
    }
    const newGroupId = randomUUID();
    responseGroupId = newGroupId;
    const { error: chatError } = await supabase.from("friend_chats").insert({
      id: newGroupId,
      name,
      description,
      created_by: actor.userId,
      allow_member_invites: Boolean(body.allowMemberInvites),
      created_at: now,
      updated_at: now,
    });
    if (chatError) {
      return NextResponse.json({
        error: tableUnavailable(chatError.code)
          ? "Group chat storage is not connected yet."
          : "The group chat could not be created.",
      }, { status: tableUnavailable(chatError.code) ? 503 : 502 });
    }
    const { error: ownerError } = await supabase.from("friend_chat_members").insert({
      chat_id: newGroupId,
      user_id: actor.userId,
      role: "owner",
      muted: false,
      last_read_at: now,
      joined_at: now,
    });
    if (ownerError) {
      await supabase.from("friend_chats").delete().eq("id", newGroupId);
      return NextResponse.json({ error: "The group owner could not be saved." }, { status: 502 });
    }
    const { error: membersError } = await supabase.from("friend_chat_members").insert(
      requestedMembers.map((userId) => ({
        chat_id: newGroupId,
        user_id: userId,
        role: "member",
        muted: false,
        last_read_at: now,
        joined_at: now,
      })),
    );
    if (membersError) {
      await supabase.from("friend_chats").delete().eq("id", newGroupId);
      return NextResponse.json({ error: "The selected friends could not be added." }, { status: 502 });
    }
  } else if (action === "group-settings") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const changes: Record<string, unknown> = { updated_at: now };
    if (body.name !== undefined) {
      const name = cleanText(body.name, 60);
      if (!name) return NextResponse.json({ error: "The group name cannot be empty." }, { status: 400 });
      changes.name = name;
    }
    if (body.description !== undefined) changes.description = cleanText(body.description, 240);
    if (body.allowMemberInvites !== undefined) changes.allow_member_invites = Boolean(body.allowMemberInvites);
    const { error } = await supabase.from("friend_chats").update(changes).eq("id", groupId);
    if (error) return NextResponse.json({ error: "Only the group owner can change these settings." }, { status: 403 });
  } else if (action === "group-add-members") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const requestedMembers = [...new Set(stringArray(body.memberUserIds))]
      .filter((userId) => userId !== actor.userId)
      .slice(0, 20);
    if (!requestedMembers.length) {
      return NextResponse.json({ error: "Choose at least one friend to add." }, { status: 400 });
    }
    const [{ rows, error: rowsError }, existingMembers] = await Promise.all([
      loadRows(supabase),
      supabase.from("friend_chat_members").select("user_id").eq("chat_id", groupId),
    ]);
    if (rowsError || existingMembers.error) {
      return NextResponse.json({ error: "Group membership could not be checked." }, { status: 502 });
    }
    const friends = connectedFriendIds(rows, actor.userId);
    const existing = new Set((existingMembers.data ?? []).map((row) => String(row.user_id)));
    const additions = requestedMembers.filter((userId) => friends.has(userId) && !existing.has(userId));
    if (!additions.length) {
      return NextResponse.json({ error: "Those friends are already in the group." }, { status: 409 });
    }
    const { error } = await supabase.from("friend_chat_members").insert(
      additions.map((userId) => ({
        chat_id: groupId,
        user_id: userId,
        role: "member",
        muted: false,
        last_read_at: now,
        joined_at: now,
      })),
    );
    if (error) return NextResponse.json({ error: "You do not have permission to add members." }, { status: 403 });
  } else if (action === "group-remove-member" || action === "group-leave") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const memberUserId = action === "group-leave" ? actor.userId : targetUserId;
    if (!memberUserId) return NextResponse.json({ error: "Choose a group member." }, { status: 400 });
    const { data: chat } = await supabase
      .from("friend_chats")
      .select("created_by")
      .eq("id", groupId)
      .maybeSingle();
    if (chat?.created_by === memberUserId) {
      return NextResponse.json({
        error: memberUserId === actor.userId
          ? "Owners must delete the group instead of leaving it."
          : "The group owner cannot be removed.",
      }, { status: 409 });
    }
    const { error } = await supabase
      .from("friend_chat_members")
      .delete()
      .eq("chat_id", groupId)
      .eq("user_id", memberUserId);
    if (error) return NextResponse.json({ error: "That member could not be removed." }, { status: 403 });
  } else if (action === "group-delete") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const { error } = await supabase.from("friend_chats").delete().eq("id", groupId);
    if (error) return NextResponse.json({ error: "Only the owner can delete this group." }, { status: 403 });
  } else if (action === "group-mute") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const { error } = await supabase
      .from("friend_chat_members")
      .update({ muted: Boolean(body.muted) })
      .eq("chat_id", groupId)
      .eq("user_id", actor.userId);
    if (error) return NextResponse.json({ error: "Notification settings could not be saved." }, { status: 502 });
  } else if (action === "group-message") {
    const bodyText = cleanText(body.body, 2_000);
    const attachments = messageAttachments(body.attachments);
    const messageId = clientMessageId(body.clientMessageId);
    if (!groupId || (!bodyText && !attachments.length)) {
      return NextResponse.json({ error: "Write a message or attach an image first." }, { status: 400 });
    }
    const { data: membership, error: membershipError } = await supabase
      .from("friend_chat_members")
      .select("chat_id")
      .eq("chat_id", groupId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (membershipError || !membership) {
      return NextResponse.json({ error: "You are no longer a member of this group." }, { status: 403 });
    }
    const { error } = await supabase.from("friend_chat_messages").upsert({
      id: messageId,
      chat_id: groupId,
      sender_user_id: actor.userId,
      body: bodyText,
      attachments,
      created_at: now,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "The group message could not be sent." }, { status: 502 });
  } else if (action === "group-mark-read") {
    if (!groupId) return NextResponse.json({ error: "Choose a group chat." }, { status: 400 });
    const { error } = await supabase
      .from("friend_chat_members")
      .update({ last_read_at: now })
      .eq("chat_id", groupId)
      .eq("user_id", actor.userId);
    if (error) return NextResponse.json({ error: "Read state could not be saved." }, { status: 502 });
  } else if (action === "message") {
    const bodyText = cleanText(body.body, 2_000);
    const attachments = messageAttachments(body.attachments);
    const messageId = clientMessageId(body.clientMessageId);
    if (!targetUserId || (!bodyText && !attachments.length)) {
      return NextResponse.json({ error: "Write a message or attach an image first." }, { status: 400 });
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
    const { error } = await supabase.from("social_objects").upsert({
      user_id: actor.userId,
      id: `friend-message:${messageId}`,
      author_label: authorLabel(actor),
      object_type: "comment",
      scope: "friends",
      desk_id: null,
      parent_id: `friend-chat:${conversationId}`,
      payload: {
        kind: "friend-message",
        recipientUserId: targetUserId,
        body: bodyText,
        attachments,
        sentAt: now,
      },
    }, { onConflict: "user_id,id", ignoreDuplicates: true });
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

  const [{ rows, error }, friendChatRows] = await Promise.all([
    loadRows(supabase),
    loadFriendChatRows(supabase, actor.userId),
  ]);
  if (error) return NextResponse.json({ ok: true });
  return NextResponse.json(buildPayload(rows, actor, targetUserId, friendChatRows, responseGroupId));
}
