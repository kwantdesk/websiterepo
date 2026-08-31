import "server-only";

import { createClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z][a-z0-9_]{2,23}$/;
const IDENTIFIER = /^[a-zA-Z0-9:_-]{1,180}$/;
const OBJECT_TYPES = new Set([
  "profile", "post", "precord", "receipt", "receipt-evidence", "desk",
  "desk-member", "comment", "reaction", "follow", "card", "progress", "consensus",
]);
const MAXIMUM_PAGE_SIZE = 100;
const MAXIMUM_OFFSET = 1_000_000;
const MAXIMUM_RECEIPT_BYTES = 512 * 1024;

type Supabase = ReturnType<typeof createClient>;
type NotificationRow = {
  id?: unknown;
  source_user_id?: unknown;
  source_object_id?: unknown;
  kind?: unknown;
  payload?: unknown;
  read_at?: unknown;
  created_at?: unknown;
};
type ProfileRow = {
  user_id?: unknown;
  author_label?: unknown;
  payload?: unknown;
};

export class SocialsNotificationsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "SocialsNotificationsError";
    this.code = code;
    this.status = status;
  }
}

export class SocialsNotificationsService {
  private readonly supabase: Supabase;

  constructor(supabase: Supabase) {
    this.supabase = supabase;
  }

  async page(actorId: string, offsetValue: unknown, limitValue: unknown) {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const offset = boundedInteger(offsetValue, 0, MAXIMUM_OFFSET, "notification offset");
    const limit = boundedInteger(limitValue, 1, MAXIMUM_PAGE_SIZE, "notification limit");
    const [itemsResult, unreadResult] = await Promise.all([
      this.supabase
        .from("social_notifications")
        .select("id,source_user_id,source_object_id,kind,payload,read_at,created_at")
        .eq("recipient_user_id", actor)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      this.supabase
        .from("social_notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", actor)
        .is("read_at", null),
    ]);
    const firstError = itemsResult.error || unreadResult.error;
    if (firstError) {
      if (migrationUnavailable(firstError)) return bounded({
        version: 1, configured: false, items: [], unreadCount: 0,
        offset, nextOffset: null, code: "FOLLOW_MIGRATION_REQUIRED",
      });
      throw unavailable("load", firstError);
    }

    const rows = Array.isArray(itemsResult.data) ? itemsResult.data as NotificationRow[] : [];
    const sourceUserIds = [...new Set(rows.map((row) => uuid(row.source_user_id)).filter(Boolean))];
    const profileByUserId = new Map<string, ProfileRow>();
    if (sourceUserIds.length) {
      const profileResult = await this.supabase
        .from("social_objects")
        .select("user_id,author_label,payload")
        .eq("object_type", "profile")
        .in("user_id", sourceUserIds)
        .order("updated_at", { ascending: false })
        .limit(sourceUserIds.length * 2);
      if (profileResult.error) {
        if (migrationUnavailable(profileResult.error)) return bounded({
          version: 1, configured: false, items: [], unreadCount: 0,
          offset, nextOffset: null, code: "FOLLOW_MIGRATION_REQUIRED",
        });
        throw unavailable("profiles", profileResult.error);
      }
      for (const row of (profileResult.data ?? []) as ProfileRow[]) {
        const userId = uuid(row.user_id);
        if (userId && !profileByUserId.has(userId)) profileByUserId.set(userId, row);
      }
    }

    const items = rows.flatMap((row) => {
      const id = uuid(row.id);
      const sourceUserId = uuid(row.source_user_id);
      const createdAt = timestamp(row.created_at);
      if (!id || !sourceUserId || !createdAt) return [];
      const payload = objectValue(row.payload);
      const profile = profileByUserId.get(sourceUserId);
      const profilePayload = objectValue(profile?.payload);
      const sourceDisplayName = boundedText(
        profilePayload.displayName || profile?.author_label || payload.authorLabel,
        80,
        "Kwant Desk user",
      );
      return [{
        id,
        kind: row.kind === "new_follower" ? "new_follower" : "followed_account_update",
        sourceUserId,
        sourceObjectId: identifier(row.source_object_id),
        sourceDisplayName,
        sourceHandle: handle(profilePayload.handle),
        sourceAvatarUrl: safeUrl(profilePayload.avatarUrl),
        objectType: objectType(payload.objectType),
        readAt: timestamp(row.read_at) || null,
        createdAt,
      }];
    });
    const unreadCount = Number(unreadResult.count ?? 0);
    if (!Number.isSafeInteger(unreadCount) || unreadCount < 0 || unreadCount > 100_000_000) {
      throw new SocialsNotificationsError("socials_notifications_invalid", 502, "The SOCIALS unread count is invalid.");
    }
    return bounded({
      version: 1,
      configured: true,
      items,
      unreadCount,
      offset,
      nextOffset: rows.length === limit ? offset + rows.length : null,
      code: null,
    });
  }

  async mark(actorId: string, value: { action?: unknown; ids?: unknown }) {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const action = String(value.action ?? "").trim().toLowerCase();
    const ids = Array.isArray(value.ids)
      ? [...new Set(value.ids.map(uuid).filter(Boolean))].slice(0, MAXIMUM_PAGE_SIZE)
      : [];
    if (!(["read", "read-all"].includes(action))
        || (action === "read" && ids.length < 1)
        || (action === "read-all" && ids.length !== 0)
        || (Array.isArray(value.ids) && value.ids.length !== ids.length)) {
      throw new SocialsNotificationsError(
        "socials_invalid_notification_request", 400, "Choose valid SOCIALS notifications to mark as read.",
      );
    }
    const appliedAt = new Date().toISOString();
    let query = this.supabase
      .from("social_notifications")
      .update({ read_at: appliedAt } as never)
      .eq("recipient_user_id", actor)
      .is("read_at", null);
    if (action === "read") query = query.in("id", ids);
    const result = await query.select("id");
    if (result.error) {
      if (migrationUnavailable(result.error)) {
        throw new SocialsNotificationsError(
          "FOLLOW_MIGRATION_REQUIRED", 503, "Social notifications are being connected.",
        );
      }
      throw unavailable("mark", result.error);
    }
    return bounded({
      version: 1,
      action,
      updated: Array.isArray(result.data) ? result.data.length : 0,
      appliedAt,
    });
  }
}

export function createSocialsNotificationsServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new SocialsNotificationsError("socials_unconfigured", 503, "SOCIALS is not configured.");
  }
  return new SocialsNotificationsService(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

function strictUuid(value: unknown, code: string, message: string, status = 400) {
  const normalized = uuid(value);
  if (!normalized) throw new SocialsNotificationsError(code, status, message);
  return normalized;
}

function uuid(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return UUID.test(normalized) ? normalized : "";
}

function boundedInteger(value: unknown, minimum: number, maximum: number, label: string) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new SocialsNotificationsError("socials_invalid_notification_query", 400, `The SOCIALS ${label} is invalid.`);
  }
  return number;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedText(value: unknown, maximum: number, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) return fallback;
  return text;
}

function handle(value: unknown) {
  const result = boundedText(value, 24).replace(/^@/, "").toLowerCase();
  return HANDLE.test(result) ? result : "";
}

function identifier(value: unknown) {
  const result = boundedText(value, 180);
  return IDENTIFIER.test(result) ? result : "";
}

function objectType(value: unknown) {
  const result = boundedText(value, 40);
  return OBJECT_TYPES.has(result) ? result : "";
}

function safeUrl(value: unknown) {
  const text = boundedText(value, 2_048);
  if (!text) return "";
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : "";
  } catch {
    return "";
  }
}

function timestamp(value: unknown) {
  const text = boundedText(value, 80);
  return text && Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : "";
}

function migrationUnavailable(error: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(code);
}

function unavailable(operation: string, error: unknown) {
  const message = error instanceof Error ? error.message : "unknown storage failure";
  return new SocialsNotificationsError(
    "socials_notifications_unavailable", 502,
    `SOCIALS notifications are unavailable (${operation}: ${message.slice(0, 180)}).`,
  );
}

function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAXIMUM_RECEIPT_BYTES) {
    throw new SocialsNotificationsError(
      "socials_notifications_too_large", 502, "The SOCIALS notification receipt is too large.",
    );
  }
  return value;
}
