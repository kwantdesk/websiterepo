import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SocialObject } from "@/lib/socials";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-zA-Z0-9:_-]{1,180}$/;
const KINDS = new Set([
  "LIKE", "USEFUL", "CLEAR", "EVIDENCE", "SAVED",
  "FIRE", "TARGET", "BRAIN", "APPLAUSE", "POLL",
] as const);
const MAXIMUM_COUNT = 100_000_000;
const MAXIMUM_RECEIPT_BYTES = 64 * 1024;

type Supabase = ReturnType<typeof createClient>;

export type SocialsReactionKind =
  | "LIKE" | "USEFUL" | "CLEAR" | "EVIDENCE" | "SAVED"
  | "FIRE" | "TARGET" | "BRAIN" | "APPLAUSE" | "POLL";

export type SocialsReactionSummary = {
  version: 1;
  targetUserId: string;
  targetObjectId: string;
  targetObjectType: "post" | "precord";
  kind: SocialsReactionKind;
  viewerActive: boolean;
  viewerOptionIndex: number | null;
  totalCount: number;
  optionCounts: number[];
  viewerReaction: SocialObject | null;
  loadedAt: string;
};

export type SocialsReactionMutationReceipt = {
  version: 1;
  idempotencyKey: string;
  targetUserId: string;
  targetObjectId: string;
  kind: SocialsReactionKind;
  enabled: boolean;
  optionIndex: number | null;
  appliedAt: string;
  idempotent: boolean;
  summary: SocialsReactionSummary;
};

export class SocialsReactionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "SocialsReactionError";
    this.code = code;
    this.status = status;
  }
}

export class SocialsReactionService {
  private readonly supabase: Supabase;

  constructor(supabase: Supabase) {
    this.supabase = supabase;
  }

  async summary(
    actorId: string,
    input: { targetUserId: unknown; targetObjectId: unknown; kind: unknown },
  ): Promise<SocialsReactionSummary> {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const targetUserId = strictUuid(input.targetUserId, "socials_invalid_reaction_target", "Choose a SOCIALS post or Gameplan.");
    const targetObjectId = strictIdentifier(input.targetObjectId);
    const kind = strictKind(input.kind);
    const result = await this.supabase.rpc("desktop_socials_reaction_summary" as never, {
      p_actor_id: actor,
      p_target_user_id: targetUserId,
      p_target_object_id: targetObjectId,
      p_kind: kind,
    } as never);
    if (result.error) throw mapStorageFailure(result.error);
    return bounded(normalizeSummary(result.data, actor, targetUserId, targetObjectId, kind));
  }

  async mutate(
    actorId: string,
    input: {
      idempotencyKey: unknown;
      targetUserId: unknown;
      targetObjectId: unknown;
      kind: unknown;
      enabled: unknown;
      optionIndex?: unknown;
    },
  ): Promise<SocialsReactionMutationReceipt> {
    const actor = strictUuid(actorId, "socials_identity_required", "A verified SOCIALS account is required.", 401);
    const idempotencyKey = strictUuid(
      input.idempotencyKey,
      "socials_invalid_idempotency_key",
      "A valid SOCIALS idempotency key is required.",
    );
    const targetUserId = strictUuid(input.targetUserId, "socials_invalid_reaction_target", "Choose a SOCIALS post or Gameplan.");
    const targetObjectId = strictIdentifier(input.targetObjectId);
    const kind = strictKind(input.kind);
    if (typeof input.enabled !== "boolean") {
      throw new SocialsReactionError("socials_invalid_reaction_request", 400, "Choose whether the SOCIALS reaction is active.");
    }
    const optionIndex = kind === "POLL" ? strictOption(input.optionIndex) : null;
    if (kind !== "POLL" && input.optionIndex !== undefined) {
      throw new SocialsReactionError("socials_invalid_reaction_request", 400, "That SOCIALS reaction does not accept a poll option.");
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        actor,
        targetUserId,
        targetObjectId,
        kind,
        enabled: input.enabled,
        optionIndex,
      }), "utf8")
      .digest("hex");
    const result = await this.supabase.rpc("desktop_socials_apply_reaction_mutation" as never, {
      p_actor_id: actor,
      p_idempotency_key: idempotencyKey,
      p_target_user_id: targetUserId,
      p_target_object_id: targetObjectId,
      p_kind: kind,
      p_enabled: input.enabled,
      p_option_index: optionIndex,
      p_request_hash: requestHash,
    } as never);
    if (result.error) throw mapMutationFailure(result.error);
    return bounded(normalizeMutationReceipt(
      result.data,
      actor,
      idempotencyKey,
      targetUserId,
      targetObjectId,
      kind,
      input.enabled,
      optionIndex,
    ));
  }
}

export function createSocialsReactionServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new SocialsReactionError("socials_unconfigured", 503, "SOCIALS is not configured.");
  return new SocialsReactionService(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

function normalizeMutationReceipt(
  value: unknown,
  actor: string,
  idempotencyKey: string,
  targetUserId: string,
  targetObjectId: string,
  kind: SocialsReactionKind,
  enabled: boolean,
  optionIndex: number | null,
): SocialsReactionMutationReceipt {
  if (!record(value)) throw invalidReceipt();
  const receipt = value;
  const summary = normalizeSummary(receipt.summary, actor, targetUserId, targetObjectId, kind);
  if (receipt.version !== 1
      || receipt.idempotencyKey !== idempotencyKey
      || receipt.targetUserId !== targetUserId
      || receipt.targetObjectId !== targetObjectId
      || receipt.kind !== kind
      || receipt.enabled !== enabled
      || receipt.optionIndex !== optionIndex
      || typeof receipt.appliedAt !== "string" || !Number.isFinite(Date.parse(receipt.appliedAt))
      || typeof receipt.idempotent !== "boolean"
      || summary.viewerActive !== enabled
      || (enabled && kind === "POLL" && summary.viewerOptionIndex !== optionIndex)
      || (!enabled && summary.viewerOptionIndex !== null)) {
    throw invalidReceipt();
  }
  return { ...receipt, summary } as SocialsReactionMutationReceipt;
}

function normalizeSummary(
  value: unknown,
  actor: string,
  targetUserId: string,
  targetObjectId: string,
  kind: SocialsReactionKind,
): SocialsReactionSummary {
  if (!record(value)) throw invalidReceipt();
  const targetObjectType = value.targetObjectType;
  const viewerOptionIndex = value.viewerOptionIndex;
  const totalCount = value.totalCount;
  const optionCounts = value.optionCounts;
  if (value.version !== 1
      || value.targetUserId !== targetUserId
      || value.targetObjectId !== targetObjectId
      || (targetObjectType !== "post" && targetObjectType !== "precord")
      || value.kind !== kind
      || typeof value.viewerActive !== "boolean"
      || !(viewerOptionIndex === null || validOption(viewerOptionIndex))
      || !Number.isSafeInteger(totalCount) || (totalCount as number) < 0 || (totalCount as number) > MAXIMUM_COUNT
      || !Array.isArray(optionCounts)
      || optionCounts.some((count) => !Number.isSafeInteger(count) || count < 0 || count > MAXIMUM_COUNT)
      || (kind === "POLL"
        ? optionCounts.length < 2 || optionCounts.length > 6
        : optionCounts.length !== 0)
      || (kind !== "POLL" && viewerOptionIndex !== null)
      || typeof value.loadedAt !== "string" || !Number.isFinite(Date.parse(value.loadedAt))) {
    throw invalidReceipt();
  }
  const viewerReaction = value.viewerReaction === null
    ? null
    : normalizeViewerReaction(value.viewerReaction, actor, targetUserId, targetObjectId, kind, viewerOptionIndex as number | null);
  if (value.viewerActive !== Boolean(viewerReaction)
      || (kind === "POLL" && optionCounts.reduce((sum, count) => sum + count, 0) !== totalCount)) {
    throw invalidReceipt();
  }
  return { ...value, viewerReaction } as SocialsReactionSummary;
}

function normalizeViewerReaction(
  value: unknown,
  actor: string,
  targetUserId: string,
  targetObjectId: string,
  kind: SocialsReactionKind,
  viewerOptionIndex: number | null,
): SocialObject {
  if (!record(value) || !record(value.payload)) throw invalidReceipt();
  if (value.userId !== actor
      || typeof value.id !== "string" || !IDENTIFIER.test(value.id)
      || typeof value.authorLabel !== "string" || value.authorLabel.length > 80
      || value.objectType !== "reaction"
      || !["private", "friends", "desk", "community"].includes(String(value.scope))
      || !(value.deskId === null || typeof value.deskId === "string")
      || value.parentId !== targetObjectId
      || value.payload.kind !== kind
      || value.payload.targetUserId !== targetUserId
      || (kind === "POLL" ? value.payload.optionIndex !== viewerOptionIndex : value.payload.optionIndex !== undefined)
      || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))
      || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))
      || value.cloudSaved !== true) {
    throw invalidReceipt();
  }
  return value as unknown as SocialObject;
}

function strictUuid(value: unknown, code: string, message: string, status = 400) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!UUID.test(normalized)) throw new SocialsReactionError(code, status, message);
  return normalized;
}

function strictIdentifier(value: unknown) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!IDENTIFIER.test(id)) {
    throw new SocialsReactionError("socials_invalid_reaction_target", 400, "Choose a valid SOCIALS post or Gameplan.");
  }
  return id;
}

function strictKind(value: unknown): SocialsReactionKind {
  const kind = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!KINDS.has(kind as SocialsReactionKind)) {
    throw new SocialsReactionError("socials_invalid_reaction_kind", 400, "That SOCIALS reaction is unsupported.");
  }
  return kind as SocialsReactionKind;
}

function strictOption(value: unknown) {
  if (!validOption(value)) {
    throw new SocialsReactionError("socials_invalid_poll_option", 400, "Choose a valid poll option.");
  }
  return value as number;
}

function validOption(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 5;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function bounded<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAXIMUM_RECEIPT_BYTES) {
    throw new SocialsReactionError("socials_reaction_receipt_too_large", 502, "The SOCIALS reaction receipt is invalid.");
  }
  return value;
}

function invalidReceipt() {
  return new SocialsReactionError("socials_reaction_receipt_invalid", 502, "The SOCIALS reaction receipt is incomplete.");
}

function mapStorageFailure(error: { code?: string; message?: string }) {
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(String(error.code || ""))) {
    return new SocialsReactionError("socials_reaction_migration_required", 503, "SOCIALS reactions are not connected yet.");
  }
  const message = String(error.message || "");
  if (message.includes("socials_reaction_target_missing")) {
    return new SocialsReactionError("socials_reaction_target_missing", 404, "That SOCIALS post or Gameplan is unavailable.");
  }
  if (message.includes("socials_reaction_target_forbidden")) {
    return new SocialsReactionError("socials_reaction_target_forbidden", 403, "That SOCIALS post or Gameplan is not visible to this account.");
  }
  if (message.includes("socials_reaction_kind_not_allowed")) {
    return new SocialsReactionError("socials_reaction_kind_not_allowed", 400, "That reaction is not available for this SOCIALS item.");
  }
  return new SocialsReactionError("socials_reaction_unavailable", 502, "SOCIALS reaction information is unavailable.");
}

function mapMutationFailure(error: { code?: string; message?: string }) {
  const storage = mapStorageFailure(error);
  const message = String(error.message || "");
  if (message.includes("socials_idempotency_conflict")) {
    return new SocialsReactionError("socials_idempotency_conflict", 409, "That SOCIALS reaction conflicts with an earlier request.");
  }
  if (message.includes("socials_poll_closed")) {
    return new SocialsReactionError("socials_poll_closed", 409, "That SOCIALS poll has ended.");
  }
  if (message.includes("socials_invalid_poll_option")) {
    return new SocialsReactionError("socials_invalid_poll_option", 400, "Choose a valid poll option.");
  }
  return storage.code === "socials_reaction_unavailable"
    ? new SocialsReactionError("socials_reaction_unavailable", 502, "The SOCIALS reaction could not be saved.")
    : storage;
}
