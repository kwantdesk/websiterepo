import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getEconomicCalendar } from "@/lib/economicCalendar.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAXIMUM_FRIENDS = 500;
const MAXIMUM_SHARE_TARGETS = 20;

type SocialRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: "profile" | "follow";
  payload: Record<string, unknown> | null;
};

export type NewsFriendSummary = {
  userId: string;
  displayName: string;
  handle: string;
};

export type NewsShareTarget = {
  targetUserId: string;
  clientMessageId: string;
};

export type NewsShareRequest = {
  eventId: string;
  timeZone: string;
  targets: NewsShareTarget[];
};

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceRoleKey) throw problem(503, "news_sharing_unconfigured", "Friend sharing is not configured.");
  return { url, serviceRoleKey };
}

function client() {
  const config = configuration();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

function cleanIdentifier(value: unknown, maximum: number) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, maximum) : "";
}

function strictUuid(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  return UUID.test(normalized) ? normalized : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => cleanIdentifier(entry, 80)).filter(Boolean).slice(0, 250)
    : [];
}

function profilePayload(row: SocialRow | undefined) {
  return row?.payload && typeof row.payload === "object" ? row.payload : {};
}

async function socialRows(userId: string) {
  const actorId = strictUuid(userId);
  if (!actorId) throw problem(401, "news_desktop_identity_required", "A verified account is required for friend sharing.");
  const supabase = client();
  const { data, error } = await supabase
    .from("social_objects")
    .select("user_id,id,author_label,object_type,payload")
    .in("object_type", ["profile", "follow"])
    .limit(2_000);
  if (error) throw problem(502, "news_friends_unavailable", "Friends could not be loaded.");
  return { supabase, rows: (data ?? []) as SocialRow[], actorId };
}

function connectedFriendIds(rows: SocialRow[], userId: string) {
  const ownProfile = rows.find((row) => row.object_type === "profile" && row.user_id === userId);
  const blocked = new Set(stringArray(profilePayload(ownProfile).blockedUserIds));
  const outgoing = new Set(rows
    .filter((row) => row.object_type === "follow" && row.user_id === userId)
    .map((row) => strictUuid(row.payload?.targetUserId))
    .filter(Boolean));
  const incoming = new Set(rows
    .filter((row) => row.object_type === "follow" && strictUuid(row.payload?.targetUserId) === userId)
    .map((row) => strictUuid(row.user_id))
    .filter(Boolean));
  return [...outgoing].filter((target) => incoming.has(target) && !blocked.has(target));
}

export async function listNewsFriends(userId: string): Promise<NewsFriendSummary[]> {
  const { rows, actorId } = await socialRows(userId);
  const profiles = new Map(rows
    .filter((row) => row.object_type === "profile")
    .map((row) => [row.user_id, row]));
  return connectedFriendIds(rows, actorId)
    .map((friendId) => {
      const row = profiles.get(friendId);
      const payload = profilePayload(row);
      const fallback = clean(row?.author_label, 60) || "Kwant Trader";
      return {
        userId: friendId,
        displayName: clean(payload.displayName, 60) || fallback,
        handle: cleanIdentifier(payload.handle, 32).toLowerCase() || fallback.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24),
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
    .slice(0, MAXIMUM_FRIENDS);
}

export async function shareNewsCalendarEvent(userId: string, request: NewsShareRequest) {
  const eventId = clean(request?.eventId, 240);
  if (!Array.isArray(request?.targets) || request.targets.length === 0 || request.targets.length > MAXIMUM_SHARE_TARGETS) {
    throw problem(400, "news_share_invalid", "Choose one or more connected friends.");
  }
  const targets = request.targets.map((target) => ({
        targetUserId: strictUuid(target?.targetUserId),
        clientMessageId: strictUuid(target?.clientMessageId),
      }));
  if (!eventId || !targets.length || targets.some((target) => !UUID.test(target.targetUserId) || !UUID.test(target.clientMessageId))) {
    throw problem(400, "news_share_invalid", "Choose one or more connected friends.");
  }
  if (new Set(targets.map((target) => target.targetUserId)).size !== targets.length ||
      new Set(targets.map((target) => target.clientMessageId)).size !== targets.length) {
    throw problem(400, "news_share_invalid", "Friend-share targets must be unique.");
  }
  const timeZone = validTimeZone(request?.timeZone) ? request.timeZone : "UTC";
  const now = new Date();
  const from = shiftDate(now, -7);
  const to = shiftDate(now, 90);
  const [calendar, social] = await Promise.all([getEconomicCalendar(from, to), socialRows(userId)]);
  const event = calendar.events.find((item) => item.id === eventId);
  if (!event) throw problem(404, "news_event_not_found", "That calendar event is no longer available.");
  const user = social.actorId;
  const friends = new Set(connectedFriendIds(social.rows, user));
  if (targets.some((target) => target.targetUserId === user || !friends.has(target.targetUserId))) {
    throw problem(403, "news_share_friend_required", "Calendar events can be sent only to connected friends.");
  }
  const ownProfile = social.rows.find((row) => row.object_type === "profile" && row.user_id === user);
  const ownPayload = profilePayload(ownProfile);
  const author = clean(ownPayload.displayName, 48) || clean(ownProfile?.author_label, 48) || "Kwant Trader";
  const sentAt = new Date().toISOString();
  const message = calendarMessage(event, timeZone);
  const rows = targets.map((target) => ({
    user_id: user,
    id: `friend-message:${target.clientMessageId}`,
    author_label: author,
    object_type: "comment",
    scope: "friends",
    desk_id: null,
    parent_id: `friend-chat:${[user, target.targetUserId].sort().join(":")}`,
    payload: {
      kind: "friend-message",
      recipientUserId: target.targetUserId,
      body: message,
      attachments: [],
      sharedTrade: null,
      sentAt,
    },
  }));
  const { error } = await social.supabase.from("social_objects").upsert(rows, {
    onConflict: "user_id,id",
    ignoreDuplicates: true,
  });
  if (error) throw problem(502, "news_share_failed", "The calendar event could not be sent.");
  return { ok: true, eventId, sentCount: rows.length, targetUserIds: targets.map((target) => target.targetUserId) };
}

function calendarMessage(event: Awaited<ReturnType<typeof getEconomicCalendar>>["events"][number], timeZone: string) {
  const date = new Date(event.date);
  const shortDate = date.toLocaleDateString("en-AU", { timeZone, weekday: "short", day: "2-digit", month: "short" });
  const time = date.toLocaleTimeString("en-AU", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const values = [
    event.forecast && `Forecast ${event.forecast}`,
    event.previous && `Previous ${event.previous}`,
    event.actual && `Actual ${event.actual}`,
  ].filter(Boolean).join(" · ");
  return [
    `ECONOMIC CALENDAR · ${event.currency} · ${event.impact.toUpperCase()}`,
    event.name,
    `${shortDate} · ${time} ${timeZone}`,
    values,
    `https://www.kwantdesk.com/news?event=${encodeURIComponent(event.id)}`,
  ].filter(Boolean).join("\n");
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 120) return false;
  try { new Intl.DateTimeFormat("en-AU", { timeZone: value }).format(new Date()); return true; }
  catch { return false; }
}

function shiftDate(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function problem(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { newsSharingProblem: true, status, code });
}

export function newsSharingProblem(error: unknown) {
  return (error as { newsSharingProblem?: boolean })?.newsSharingProblem === true
    ? error as Error & { status: number; code: string }
    : problem(502, "news_sharing_unavailable", "Friend sharing is unavailable.");
}
