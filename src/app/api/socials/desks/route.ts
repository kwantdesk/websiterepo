import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getRouteActor } from "@/lib/serverAuth";
import {
  EMPTY_DESK_NETWORK,
  type DeskChannel,
  type DeskJoinRequest,
  type DeskMember,
  type DeskMemberProfile,
  type DeskMessage,
  type DeskMessageAttachment,
  type DeskNetworkPayload,
  type DeskPrivacy,
  type DeskReaction,
  type DeskRole,
  type DeskWorkspace,
} from "@/lib/desks";
import { normalizeSocialProfile, profileScoreAverage } from "@/lib/socials";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WorkspaceRow = {
  desk_id: string;
  owner_id: string;
  name: string;
  description: string;
  objective: string;
  weekly_mission: string;
  markets: string[];
  session: string;
  timezone: string;
  privacy: DeskPrivacy;
  capacity: number;
  allow_member_invites: boolean;
  inactivity_days: number | null;
  avatar_url: string;
  accent_color: string;
  rules: string;
  created_at: string;
  updated_at: string;
};

type MemberRow = {
  desk_id: string;
  user_id: string;
  role: DeskRole;
  joined_at: string;
  last_active_at: string;
};

type RequestRow = {
  id: string;
  desk_id: string;
  user_id: string;
  request_type: "request" | "invite";
  requested_by: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
};

type ChannelRow = {
  id: string;
  desk_id: string;
  name: string;
  description: string;
  channel_type: "text" | "voice";
  position: number;
  is_private: boolean;
  read_only: boolean;
  reaction_only: boolean;
  show_history: boolean;
  allowed_user_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  desk_id: string;
  channel_id: string;
  sender_user_id: string;
  body: string;
  attachments: unknown;
  created_at: string;
  updated_at: string;
};

type ReactionRow = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  author_label: string;
  payload: Record<string, unknown>;
};

function tableUnavailable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

function cleanText(value: unknown, maximum = 120) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanMultiline(value: unknown, maximum = 4_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

function cleanIdentifier(value: unknown, maximum = 180) {
  return typeof value === "string"
    ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum)
    : "";
}

function cleanUuid(value: unknown) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : "";
}

function cleanHandle(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24)
    : "";
}

function stringArray(value: unknown, maximum = 30) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 40)).filter(Boolean).slice(0, maximum)
    : [];
}

function uuidArray(value: unknown, maximum = 50) {
  return Array.isArray(value)
    ? value.map(cleanUuid).filter(Boolean).slice(0, maximum)
    : [];
}

function messageAttachments(value: unknown): DeskMessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl.trim() : "";
    const prefix = /^data:image\/(png|jpe?g|webp|gif);base64,/i.exec(dataUrl);
    if (!prefix || dataUrl.length > 1_350_000) return [];
    const approximateSize = Math.floor(dataUrl.slice(prefix[0].length).length * 0.75);
    if (approximateSize > 950_000) return [];
    return [{
      id: cleanIdentifier(item.id, 80) || `image:${randomUUID()}`,
      name: cleanText(item.name, 120) || "Desk image",
      type: cleanText(item.type, 80) || `image/${prefix[1].toLowerCase().replace("jpg", "jpeg")}`,
      size: approximateSize,
      dataUrl,
    }];
  });
}

function fromWorkspace(row: WorkspaceRow): DeskWorkspace {
  return {
    deskId: row.desk_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    objective: row.objective,
    weeklyMission: row.weekly_mission,
    markets: row.markets ?? [],
    session: row.session,
    timezone: row.timezone,
    privacy: row.privacy,
    capacity: row.capacity,
    allowMemberInvites: row.allow_member_invites,
    inactivityDays: row.inactivity_days,
    avatarUrl: row.avatar_url,
    accentColor: row.accent_color,
    rules: row.rules,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromMember(row: MemberRow): DeskMember {
  return {
    deskId: row.desk_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
  };
}

function fromRequest(row: RequestRow): DeskJoinRequest {
  return {
    id: row.id,
    deskId: row.desk_id,
    userId: row.user_id,
    requestType: row.request_type,
    requestedBy: row.requested_by,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromChannel(row: ChannelRow): DeskChannel {
  return {
    id: row.id,
    deskId: row.desk_id,
    name: row.name,
    description: row.description,
    channelType: row.channel_type,
    position: row.position,
    isPrivate: row.is_private,
    readOnly: row.read_only,
    reactionOnly: row.reaction_only,
    showHistory: row.show_history,
    allowedUserIds: row.allowed_user_ids ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromMessage(row: MessageRow): DeskMessage {
  return {
    id: row.id,
    deskId: row.desk_id,
    channelId: row.channel_id,
    senderUserId: row.sender_user_id,
    body: row.body,
    attachments: messageAttachments(row.attachments),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromReaction(row: ReactionRow): DeskReaction {
  return {
    messageId: row.message_id,
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

async function deskClient(request: NextRequest) {
  const actor = await getRouteActor(request);
  if (!actor) return { actor: null, supabase: null };
  try {
    return { actor, supabase: await createSupabaseServerClient() };
  } catch {
    return { actor, supabase: null };
  }
}

function unavailable(viewerId: string | null = null) {
  return NextResponse.json(
    { ...EMPTY_DESK_NETWORK, viewerId },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function GET(request: NextRequest) {
  const { actor, supabase } = await deskClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return unavailable(actor.userId);

  const selectedDeskId = cleanIdentifier(request.nextUrl.searchParams.get("deskId"));
  const [workspaceResult, memberResult, requestResult] = await Promise.all([
    supabase
      .from("desk_workspaces")
      .select("desk_id,owner_id,name,description,objective,weekly_mission,markets,session,timezone,privacy,capacity,allow_member_invites,inactivity_days,avatar_url,accent_color,rules,created_at,updated_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("desk_members")
      .select("desk_id,user_id,role,joined_at,last_active_at")
      .order("joined_at", { ascending: true }),
    supabase
      .from("desk_join_requests")
      .select("id,desk_id,user_id,request_type,requested_by,status,created_at,updated_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);
  const baseError = workspaceResult.error ?? memberResult.error ?? requestResult.error;
  if (baseError) {
    if (tableUnavailable(baseError.code)) return unavailable(actor.userId);
    console.error("Desk network load failed", { code: baseError.code, message: baseError.message });
    return NextResponse.json({ error: "Desks could not be loaded." }, { status: 502 });
  }

  let channels: ChannelRow[] = [];
  let messages: MessageRow[] = [];
  let reactions: ReactionRow[] = [];
  if (selectedDeskId) {
    const channelResult = await supabase
      .from("desk_channels")
      .select("id,desk_id,name,description,channel_type,position,is_private,read_only,reaction_only,show_history,allowed_user_ids,created_by,created_at,updated_at")
      .eq("desk_id", selectedDeskId)
      .order("position", { ascending: true });
    if (channelResult.error && !tableUnavailable(channelResult.error.code)) {
      return NextResponse.json({ error: "Desk channels could not be loaded." }, { status: 502 });
    }
    channels = (channelResult.data ?? []) as ChannelRow[];

    const messageResult = await supabase
      .from("desk_messages")
      .select("id,desk_id,channel_id,sender_user_id,body,attachments,created_at,updated_at")
      .eq("desk_id", selectedDeskId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (messageResult.error && !tableUnavailable(messageResult.error.code)) {
      return NextResponse.json({ error: "Desk messages could not be loaded." }, { status: 502 });
    }
    messages = ((messageResult.data ?? []) as MessageRow[]).reverse();
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length) {
      const reactionResult = await supabase
        .from("desk_message_reactions")
        .select("message_id,user_id,emoji,created_at")
        .in("message_id", messageIds);
      if (!reactionResult.error) reactions = (reactionResult.data ?? []) as ReactionRow[];
    }
  }

  const members = (memberResult.data ?? []) as MemberRow[];
  const requests = (requestResult.data ?? []) as RequestRow[];
  const profileIds = [...new Set([
    actor.userId,
    ...members.map((member) => member.user_id),
    ...requests.map((entry) => entry.user_id),
    ...requests.map((entry) => entry.requested_by),
  ])];
  let profileRows: ProfileRow[] = [];
  if (profileIds.length) {
    const profileResult = await supabase
      .from("social_objects")
      .select("user_id,author_label,payload")
      .eq("object_type", "profile")
      .in("user_id", profileIds);
    if (!profileResult.error) profileRows = (profileResult.data ?? []) as ProfileRow[];
  }
  const profileById = new Map(profileRows.map((row) => [row.user_id, row]));
  const profiles: DeskMemberProfile[] = profileIds.map((userId) => {
    const row = profileById.get(userId);
    const normalized = normalizeSocialProfile(row?.payload, row?.author_label || (userId === actor.userId ? actor.label : "Kwant Trader"));
    return {
      userId,
      displayName: normalized.displayName,
      handle: normalized.handle,
      avatarUrl: normalized.avatarUrl || "",
      processStatus: normalized.processStatus,
      score: profileScoreAverage(normalized),
      lastSeenAt: typeof row?.payload?.lastSeenAt === "string" ? row.payload.lastSeenAt : null,
    };
  });

  const payload: DeskNetworkPayload = {
    ready: true,
    viewerId: actor.userId,
    workspaces: ((workspaceResult.data ?? []) as WorkspaceRow[]).map(fromWorkspace),
    members: members.map(fromMember),
    requests: requests.map(fromRequest),
    channels: channels.map(fromChannel),
    messages: messages.map(fromMessage),
    reactions: reactions.map(fromReaction),
    profiles,
  };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: NextRequest) {
  const { actor, supabase } = await deskClient(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: "Desk storage is unavailable." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "The Desk action could not be read." }, { status: 400 });
  }
  const action = cleanIdentifier(body.action, 50);
  const deskId = cleanIdentifier(body.deskId);

  if (action === "initialize") {
    if (!deskId) return NextResponse.json({ error: "Choose a Desk." }, { status: 400 });
    const { data: sourceDesk } = await supabase
      .from("social_objects")
      .select("id,payload")
      .eq("user_id", actor.userId)
      .eq("id", deskId)
      .eq("object_type", "desk")
      .maybeSingle();
    if (!sourceDesk) return NextResponse.json({ error: "Only the Desk owner can initialize this workspace." }, { status: 403 });
    const source = (sourceDesk.payload ?? {}) as Record<string, unknown>;
    const privacyCandidate = cleanText(source.privacy, 16).toUpperCase();
    const privacy: DeskPrivacy = ["PUBLIC", "REQUEST", "PRIVATE"].includes(privacyCandidate)
      ? privacyCandidate as DeskPrivacy
      : "REQUEST";
    const workspaceRow = {
      desk_id: deskId,
      owner_id: actor.userId,
      name: cleanText(source.name, 60) || "Kwant Desk",
      description: cleanText(source.description, 600),
      objective: cleanText(source.objective, 500),
      weekly_mission: cleanText(source.weeklyMission, 500),
      markets: stringArray(source.markets, 12),
      session: cleanText(source.session, 40) || "New York",
      timezone: cleanText(source.timezone, 80) || "UTC",
      privacy,
      capacity: Math.max(2, Math.min(50, Math.floor(Number(source.capacity) || 12))),
    };
    const { error: workspaceError } = await supabase
      .from("desk_workspaces")
      .upsert(workspaceRow, { onConflict: "desk_id" });
    if (workspaceError) {
      if (tableUnavailable(workspaceError.code)) return NextResponse.json({ error: "Apply the multi-Desk Supabase migration first." }, { status: 503 });
      return NextResponse.json({ error: workspaceError.message }, { status: 502 });
    }
    const { error: ownerError } = await supabase.rpc("desk_request_access", { requested_desk_id: deskId });
    if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 502 });
    // The migration's backfill creates defaults for existing Desks. New Desks receive the same set here.
    const defaults = [
      ["general", "The Desk floor for structured discussion.", "text", 10, false],
      ["trade-floor", "Live observations and session coordination.", "text", 20, false],
      ["desk-rules", "The shared standard and owner announcements.", "text", 30, true],
      ["voice-lounge", "Voice rooms are reserved for a later release.", "voice", 40, false],
    ] as const;
    await supabase.from("desk_channels").upsert(defaults.map(([name, description, channelType, position, readOnly]) => ({
      desk_id: deskId,
      name,
      description,
      channel_type: channelType,
      position,
      read_only: readOnly,
      created_by: actor.userId,
    })), { onConflict: "desk_id,name" });
    return NextResponse.json({ ok: true, deskId });
  }

  if (!deskId) return NextResponse.json({ error: "Choose a Desk." }, { status: 400 });

  if (action === "update-settings") {
    const privacyCandidate = cleanText(body.privacy, 16).toUpperCase();
    const privacy: DeskPrivacy = ["PUBLIC", "REQUEST", "PRIVATE"].includes(privacyCandidate)
      ? privacyCandidate as DeskPrivacy
      : "REQUEST";
    const avatarUrl = typeof body.avatarUrl === "string" && (
      body.avatarUrl === "" || /^data:image\/(png|jpe?g|webp);base64,/i.test(body.avatarUrl)
    ) && body.avatarUrl.length <= 1_350_000
      ? body.avatarUrl
      : "";
    const inactivityValue = body.inactivityDays === null || body.inactivityDays === ""
      ? null
      : Math.max(7, Math.min(365, Math.floor(Number(body.inactivityDays) || 30)));
    const row = {
      name: cleanText(body.name, 60) || "Kwant Desk",
      description: cleanText(body.description, 600),
      objective: cleanText(body.objective, 500),
      weekly_mission: cleanText(body.weeklyMission, 500),
      markets: stringArray(body.markets, 12),
      session: cleanText(body.session, 40) || "New York",
      timezone: cleanText(body.timezone, 80) || "UTC",
      privacy,
      capacity: Math.max(2, Math.min(50, Math.floor(Number(body.capacity) || 12))),
      allow_member_invites: body.allowMemberInvites !== false,
      inactivity_days: inactivityValue,
      avatar_url: avatarUrl,
      accent_color: /^#[0-9a-fA-F]{6}$/.test(String(body.accentColor ?? "")) ? String(body.accentColor) : "#d8b45c",
      rules: cleanMultiline(body.rules, 4_000) || "Preparation can be shared. The next decision remains individual.",
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("desk_workspaces").update(row).eq("desk_id", deskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "request-access") {
    const { data, error } = await supabase.rpc("desk_request_access", { requested_desk_id: deskId });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "invite") {
    const handle = cleanHandle(body.handle);
    if (!handle) return NextResponse.json({ error: "Enter a trader handle." }, { status: 400 });
    const { data: profile } = await supabase
      .from("social_objects")
      .select("user_id")
      .eq("object_type", "profile")
      .eq("payload->>handle", handle)
      .maybeSingle();
    if (!profile?.user_id) return NextResponse.json({ error: `@${handle} was not found.` }, { status: 404 });
    const { data, error } = await supabase.rpc("desk_send_invite", {
      requested_desk_id: deskId,
      target_user_id: profile.user_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, requestId: data });
  }

  if (action === "resolve-request") {
    const requestId = cleanUuid(body.requestId);
    const resolution = cleanText(body.resolution, 20).toLowerCase();
    if (!requestId || !["accepted", "declined", "cancelled"].includes(resolution)) {
      return NextResponse.json({ error: "Choose a valid request decision." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("desk_resolve_request", {
      request_id: requestId,
      resolution,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "remove-member") {
    const targetUserId = cleanUuid(body.userId);
    if (!targetUserId) return NextResponse.json({ error: "Choose a Desk member." }, { status: 400 });
    const { data, error } = await supabase.rpc("desk_remove_member", {
      requested_desk_id: deskId,
      target_user_id: targetUserId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "change-role") {
    const targetUserId = cleanUuid(body.userId);
    const nextRole = cleanText(body.role, 20).toLowerCase();
    if (!targetUserId || !["moderator", "member"].includes(nextRole)) {
      return NextResponse.json({ error: "Choose a valid member role." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("desk_change_member_role", {
      requested_desk_id: deskId,
      target_user_id: targetUserId,
      next_role: nextRole,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (action === "touch") {
    const { error } = await supabase.rpc("desk_touch_membership", { requested_desk_id: deskId });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    await supabase.rpc("desk_enforce_inactivity", { requested_desk_id: deskId });
    return NextResponse.json({ ok: true });
  }

  if (action === "create-channel" || action === "update-channel") {
    const channelId = cleanUuid(body.channelId);
    const name = cleanText(body.name, 40).toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/\s+/g, "-");
    if (!name) return NextResponse.json({ error: "Give the channel a name." }, { status: 400 });
    const channelType = cleanText(body.channelType, 16) === "voice" ? "voice" : "text";
    const row = {
      desk_id: deskId,
      name,
      description: cleanText(body.description, 240),
      channel_type: channelType,
      position: Math.max(0, Math.min(1_000, Math.floor(Number(body.position) || 100))),
      is_private: Boolean(body.isPrivate),
      read_only: Boolean(body.readOnly),
      reaction_only: Boolean(body.reactionOnly),
      show_history: body.showHistory !== false,
      allowed_user_ids: uuidArray(body.allowedUserIds),
      created_by: actor.userId,
      updated_at: new Date().toISOString(),
    };
    const query = action === "create-channel"
      ? supabase.from("desk_channels").insert(row)
      : supabase.from("desk_channels").update({
          name: row.name,
          description: row.description,
          channel_type: row.channel_type,
          position: row.position,
          is_private: row.is_private,
          read_only: row.read_only,
          reaction_only: row.reaction_only,
          show_history: row.show_history,
          allowed_user_ids: row.allowed_user_ids,
          updated_at: row.updated_at,
        }).eq("id", channelId).eq("desk_id", deskId);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete-channel") {
    const channelId = cleanUuid(body.channelId);
    if (!channelId) return NextResponse.json({ error: "Choose a channel." }, { status: 400 });
    const { error } = await supabase.from("desk_channels").delete().eq("id", channelId).eq("desk_id", deskId);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  if (action === "send-message") {
    const channelId = cleanUuid(body.channelId);
    const messageBody = cleanMultiline(body.message, 4_000);
    const attachments = messageAttachments(body.attachments);
    if (!channelId || (!messageBody && !attachments.length)) {
      return NextResponse.json({ error: "Write a message or attach an image." }, { status: 400 });
    }
    const row = {
      id: randomUUID(),
      desk_id: deskId,
      channel_id: channelId,
      sender_user_id: actor.userId,
      body: messageBody,
      attachments,
    };
    const { error } = await supabase.from("desk_messages").insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, messageId: row.id });
  }

  if (action === "react") {
    const messageId = cleanUuid(body.messageId);
    const emoji = cleanText(body.emoji, 16);
    if (!messageId || !emoji) return NextResponse.json({ error: "Choose a reaction." }, { status: 400 });
    const { data: existing } = await supabase
      .from("desk_message_reactions")
      .select("message_id")
      .eq("message_id", messageId)
      .eq("user_id", actor.userId)
      .eq("emoji", emoji)
      .maybeSingle();
    const query = existing
      ? supabase.from("desk_message_reactions").delete().eq("message_id", messageId).eq("user_id", actor.userId).eq("emoji", emoji)
      : supabase.from("desk_message_reactions").insert({ message_id: messageId, user_id: actor.userId, emoji });
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true, active: !existing });
  }

  return NextResponse.json({ error: "Unsupported Desk action." }, { status: 400 });
}
