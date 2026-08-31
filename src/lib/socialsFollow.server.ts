import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["follow", "unfollow", "notifications"] as const);
const MAXIMUM_RECEIPT_BYTES = 32 * 1024;
const MAXIMUM_FOLLOW_COUNT = 100_000_000;
const MAXIMUM_FOLLOWING_USERS = 500;

type Supabase = ReturnType<typeof createClient>;

export type SocialsFollowAction = "follow" | "unfollow" | "notifications";

export type SocialsFollowSummary = {
  version: 1;
  profileUserId: string;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  followsViewer: boolean;
  notificationsEnabled: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  loadedAt: string;
};

export type SocialsFollowMutationReceipt = {
  version: 1;
  idempotencyKey: string;
  action: SocialsFollowAction;
  targetUserId: string;
  appliedAt: string;
  idempotent: boolean;
  summary: SocialsFollowSummary;
};

export type SocialsFollowingReceipt = {
  version: 1;
  userIds: string[];
  truncated: boolean;
  loadedAt: string;
};

export class SocialsFollowError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "SocialsFollowError";
    this.code = code;
    this.status = status;
  }
}

export class SocialsFollowService {
  private readonly supabase: Supabase;

  constructor(supabase: Supabase) {
    this.supabase = supabase;
  }

  async summary(actorId: string, targetUserId: string): Promise<SocialsFollowSummary> {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const target = strictUuid(targetUserId, "socials_invalid_follow_target", "Choose a SOCIALS profile.");
    const [followers, following, viewerRelation, reverseRelation, profile] = await Promise.all([
      this.supabase
        .from("social_profile_follows")
        .select("following_id", { count: "exact", head: true })
        .eq("following_id", target),
      this.supabase
        .from("social_profile_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", target),
      this.supabase
        .from("social_profile_follows")
        .select("notify_posts")
        .eq("follower_id", actor)
        .eq("following_id", target)
        .maybeSingle(),
      this.supabase
        .from("social_profile_follows")
        .select("following_id")
        .eq("follower_id", target)
        .eq("following_id", actor)
        .maybeSingle(),
      this.supabase
        .from("social_objects")
        .select("payload")
        .eq("user_id", target)
        .eq("object_type", "profile")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const error = followers.error || following.error || viewerRelation.error || reverseRelation.error || profile.error;
    if (error) throw mapStorageFailure(error);
    const profileData = profile.data as unknown as { payload?: unknown } | null;
    const viewerData = viewerRelation.data as unknown as { notify_posts?: unknown } | null;
    if (!profileData) throw new SocialsFollowError("socials_follow_target_missing", 404, "That SOCIALS profile is unavailable.");
    const payload = profileData.payload && typeof profileData.payload === "object" && !Array.isArray(profileData.payload)
      ? profileData.payload as Record<string, unknown>
      : {};
    const visibility = payload.visibility && typeof payload.visibility === "object" && !Array.isArray(payload.visibility)
      ? payload.visibility as Record<string, unknown>
      : {};
    const receipt: SocialsFollowSummary = {
      version: 1,
      profileUserId: target,
      followerCount: boundedCount(followers.count),
      followingCount: boundedCount(following.count),
      viewerFollows: Boolean(viewerRelation.data),
      followsViewer: Boolean(reverseRelation.data),
      notificationsEnabled: Boolean(viewerData?.notify_posts),
      canViewFollowers: actor === target || visibility.followers !== "private",
      canViewFollowing: actor === target || visibility.following !== "private",
      loadedAt: new Date().toISOString(),
    };
    return bounded(receipt);
  }

  async following(actorId: string): Promise<SocialsFollowingReceipt> {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const result = await this.supabase
      .from("social_profile_follows")
      .select("following_id")
      .eq("follower_id", actor)
      .order("created_at", { ascending: false })
      .limit(MAXIMUM_FOLLOWING_USERS + 1);
    if (result.error) throw mapStorageFailure(result.error);
    const rows = Array.isArray(result.data) ? result.data : [];
    const userIds = rows.slice(0, MAXIMUM_FOLLOWING_USERS).map((row) =>
      strictUuid(
        (row as { following_id?: unknown }).following_id,
        "socials_follow_receipt_invalid",
        "The SOCIALS following list is invalid.",
        502,
      ));
    if (new Set(userIds).size !== userIds.length) {
      throw new SocialsFollowError("socials_follow_receipt_invalid", 502, "The SOCIALS following list is invalid.");
    }
    return bounded({
      version: 1,
      userIds,
      truncated: rows.length > MAXIMUM_FOLLOWING_USERS,
      loadedAt: new Date().toISOString(),
    });
  }

  async mutate(
    actorId: string,
    input: { idempotencyKey: unknown; action: unknown; targetUserId: unknown; enabled?: unknown },
  ): Promise<SocialsFollowMutationReceipt> {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const idempotencyKey = strictUuid(
      input.idempotencyKey,
      "socials_invalid_idempotency_key",
      "A valid SOCIALS idempotency key is required.",
    );
    const action = String(input.action || "").trim().toLowerCase();
    if (!ACTIONS.has(action as SocialsFollowAction)) {
      throw new SocialsFollowError("socials_invalid_follow_action", 400, "That SOCIALS follow action is unsupported.");
    }
    const target = strictTarget(actor, input.targetUserId);
    if (action === "notifications" && typeof input.enabled !== "boolean") {
      throw new SocialsFollowError(
        "socials_invalid_notification_preference",
        400,
        "Choose whether profile notifications are on or off.",
      );
    }
    if (action !== "notifications" && input.enabled !== undefined) {
      throw new SocialsFollowError("socials_invalid_follow_request", 400, "The SOCIALS follow request is invalid.");
    }
    const enabled = action === "notifications" ? input.enabled as boolean : null;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ actor, action, targetUserId: target, enabled }), "utf8")
      .digest("hex");
    const result = await this.supabase.rpc("desktop_socials_apply_follow_mutation" as never, {
      p_actor_id: actor,
      p_idempotency_key: idempotencyKey,
      p_action: action,
      p_target_user_id: target,
      p_notifications_enabled: enabled,
      p_request_hash: requestHash,
    } as never);
    if (result.error) throw mapMutationFailure(result.error);
    const receipt = normalizeMutationReceipt(
      result.data,
      idempotencyKey,
      action as SocialsFollowAction,
      target,
      enabled,
    );
    return bounded(receipt);
  }
}

export function createSocialsFollowServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new SocialsFollowError("socials_unconfigured", 503, "SOCIALS is not configured.");
  return new SocialsFollowService(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

function strictUuid(value: unknown, code: string, message: string, status = 400) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!UUID.test(normalized)) throw new SocialsFollowError(code, status, message);
  return normalized;
}

function strictTarget(actor: string, value: unknown) {
  const target = strictUuid(value, "socials_invalid_follow_target", "Choose another SOCIALS profile.");
  if (target === actor) throw new SocialsFollowError("socials_invalid_follow_target", 400, "Choose another SOCIALS profile.");
  return target;
}

function boundedCount(value: number | null) {
  const count = Number(value ?? 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > MAXIMUM_FOLLOW_COUNT) {
    throw new SocialsFollowError("socials_follow_receipt_invalid", 502, "The SOCIALS follow count is invalid.");
  }
  return count;
}

function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAXIMUM_RECEIPT_BYTES) {
    throw new SocialsFollowError("socials_follow_receipt_too_large", 502, "The SOCIALS follow receipt is invalid.");
  }
  return value;
}

function normalizeMutationReceipt(
  value: unknown,
  idempotencyKey: string,
  action: SocialsFollowAction,
  target: string,
  enabled: boolean | null,
): SocialsFollowMutationReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SocialsFollowError("socials_follow_receipt_invalid", 502, "The SOCIALS follow receipt is incomplete.");
  }
  const receipt = value as Record<string, unknown>;
  if (receipt.version !== 1
      || receipt.idempotencyKey !== idempotencyKey
      || receipt.action !== action
      || receipt.targetUserId !== target
      || typeof receipt.appliedAt !== "string"
      || !Number.isFinite(Date.parse(receipt.appliedAt))
      || typeof receipt.idempotent !== "boolean"
      || !receipt.summary || typeof receipt.summary !== "object" || Array.isArray(receipt.summary)) {
    throw new SocialsFollowError("socials_follow_receipt_invalid", 502, "The SOCIALS follow receipt is incomplete.");
  }
  const summary = receipt.summary as Record<string, unknown>;
  if (summary.version !== 1 || summary.profileUserId !== target
      || typeof summary.followerCount !== "number" || !Number.isSafeInteger(summary.followerCount)
      || summary.followerCount < 0 || summary.followerCount > MAXIMUM_FOLLOW_COUNT
      || typeof summary.followingCount !== "number" || !Number.isSafeInteger(summary.followingCount)
      || summary.followingCount < 0 || summary.followingCount > MAXIMUM_FOLLOW_COUNT
      || typeof summary.viewerFollows !== "boolean" || typeof summary.followsViewer !== "boolean"
      || typeof summary.notificationsEnabled !== "boolean"
      || typeof summary.canViewFollowers !== "boolean" || typeof summary.canViewFollowing !== "boolean"
      || typeof summary.loadedAt !== "string" || !Number.isFinite(Date.parse(summary.loadedAt))
      || (!summary.viewerFollows && summary.notificationsEnabled)
      || (action === "follow" && !summary.viewerFollows)
      || (action === "unfollow" && (summary.viewerFollows || summary.notificationsEnabled))
      || (action === "notifications"
        && (!summary.viewerFollows || summary.notificationsEnabled !== enabled))) {
    throw new SocialsFollowError("socials_follow_receipt_invalid", 502, "The SOCIALS follow receipt is incomplete.");
  }
  return receipt as SocialsFollowMutationReceipt;
}

function mapStorageFailure(error: { code?: string; message?: string }) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(String(error.code || ""))) {
    return new SocialsFollowError("socials_follow_migration_required", 503, "SOCIALS profile follows are not connected yet.");
  }
  return new SocialsFollowError("socials_follow_unavailable", 502, "SOCIALS follow information is unavailable.");
}

function mapMutationFailure(error: { code?: string; message?: string }) {
  const message = String(error.message || "");
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(String(error.code || ""))) {
    return new SocialsFollowError("socials_follow_migration_required", 503, "SOCIALS profile follows are not connected yet.");
  }
  if (message.includes("socials_idempotency_conflict")) {
    return new SocialsFollowError("socials_idempotency_conflict", 409, "That SOCIALS action conflicts with an earlier request.");
  }
  if (message.includes("socials_follow_target_missing")) {
    return new SocialsFollowError("socials_follow_target_missing", 404, "That SOCIALS profile is unavailable.");
  }
  if (message.includes("socials_follow_required")) {
    return new SocialsFollowError("socials_follow_required", 409, "Follow this profile before changing notifications.");
  }
  return new SocialsFollowError("socials_follow_unavailable", 502, "The SOCIALS follow setting could not be saved.");
}
