import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  normalizeSocialProfile,
  SOCIAL_OBJECT_TYPES,
  type SocialObject,
  type SocialObjectType,
} from "@/lib/socials";
import {
  canViewerReadSocialRow,
  type SocialVisibilityRow,
  type SocialViewerAccess,
} from "@/lib/socialsVisibility";
import {
  loadSocialViewerAccess,
  SOCIALS_ROW_SELECT,
  SocialsAccessStorageError,
} from "@/lib/socialsAccess.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE = /^[a-z][a-z0-9_]{2,23}$/;
const MAXIMUM_STATE_ROWS = 5_000;
const MAXIMUM_PROFILE_ROWS = 2_500;
const MAXIMUM_RESPONSE_BYTES = 32 * 1024 * 1024;

type Supabase = ReturnType<typeof createClient>;

export class SocialsReadError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "SocialsReadError";
    this.code = code;
    this.status = status;
  }
}

export type SocialsStateReceipt = {
  version: 1;
  objects: SocialObject[];
  cloud: true;
  loadedAt: string;
};

export type SocialsProfileReadReceipt = {
  found: boolean;
  viewerId: string;
  state: SocialsStateReceipt;
};

export class SocialsReadService {
  constructor(private readonly supabase: Supabase) {}

  async state(actorId: string, input: { mineOnly: boolean; objectTypes: readonly string[] }) {
    const actor = strictActor(actorId);
    const objectTypes = normalizeTypes(input.objectTypes);
    const access = await this.access(actor);
    const groups: SocialVisibilityRow[][] = [];

    groups.push(await this.queryRows((query) => query.eq("user_id", actor), objectTypes, MAXIMUM_STATE_ROWS));
    if (!input.mineOnly) {
      groups.push(await this.queryRows((query) => query.eq("scope", "community"), objectTypes, MAXIMUM_STATE_ROWS));
      if (access.friendIds.size) {
        groups.push(await this.queryRows(
          (query) => query.eq("scope", "friends").in("user_id", [...access.friendIds]),
          objectTypes,
          MAXIMUM_STATE_ROWS,
        ));
      }
      if (access.deskIds.size) {
        groups.push(await this.queryRows(
          (query) => query.eq("scope", "desk").in("desk_id", [...access.deskIds]),
          objectTypes,
          MAXIMUM_STATE_ROWS,
        ));
      }
    }

    return boundedReceipt(stateReceipt(visibleUnique(groups.flat(), access, MAXIMUM_STATE_ROWS)));
  }

  async profile(actorId: string, rawHandle: string): Promise<SocialsProfileReadReceipt> {
    const actor = strictActor(actorId);
    const handle = normalizeHandle(rawHandle);
    const access = await this.access(actor);
    const { data, error } = await this.supabase
      .from("social_objects")
      .select(SOCIALS_ROW_SELECT)
      .eq("object_type", "profile")
      .eq("payload->>handle", handle)
      .limit(2);
    if (error) throw unavailable("profile_lookup", error);
    const profiles = rows(data);
    if (profiles.length !== 1 || !canViewerReadSocialRow(profiles[0], access)) {
      return boundedReceipt({ found: false, viewerId: actor, state: stateReceipt([]) });
    }

    const profileRow = profiles[0];
    const own = profileRow.user_id.toLowerCase() === actor;
    const profileObjects = await this.queryRows(
      (query) => query
        .eq("user_id", profileRow.user_id)
        .in("object_type", ["profile", "precord", "receipt", "card", "post", "reaction"]),
      [],
      1_000,
    );
    const collectionVisible = filterProfileCollections(profileObjects, profileRow, own);
    const referencedIds = [...new Set(collectionVisible.flatMap((row) => [
      row.parent_id,
      identifier(row.payload?.relatedPrecordId),
      identifier(row.payload?.repostOfPostId),
    ]).filter((value): value is string => Boolean(value)))].slice(0, 500);
    const references = referencedIds.length
      ? await this.queryRows(
          (query) => query.in("id", referencedIds).in("object_type", ["post", "precord", "receipt"]),
          [],
          500,
        )
      : [];
    const contentIds = [...new Set([...collectionVisible, ...references]
      .filter((row) => row.object_type === "post" || row.object_type === "precord")
      .map((row) => row.id))].slice(0, 500);
    const interactions = contentIds.length
      ? await this.queryRows(
          (query) => query.in("parent_id", contentIds).in("object_type", ["comment", "reaction", "receipt"]),
          [],
          1_000,
        )
      : [];
    const selected = filterProfileCollections(
      visibleUnique([...collectionVisible, ...references, ...interactions], access, MAXIMUM_PROFILE_ROWS),
      profileRow,
      own,
    );
    if (!selected.some((row) => row.object_type === "profile")) selected.unshift(profileRow);
    return boundedReceipt({ found: true, viewerId: actor, state: stateReceipt(selected) });
  }

  private async access(actorId: string): Promise<SocialViewerAccess> {
    try {
      return await loadSocialViewerAccess(this.supabase, actorId);
    } catch (error) {
      if (error instanceof SocialsAccessStorageError) throw unavailable(error.operation, error.cause);
      throw error;
    }
  }

  private async queryRows(
    configure: (query: any) => any,
    objectTypes: readonly SocialObjectType[],
    maximum: number,
  ) {
    let query = configure(this.supabase.from("social_objects").select(SOCIALS_ROW_SELECT));
    if (objectTypes.length) query = query.in("object_type", objectTypes);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(maximum);
    if (error) throw unavailable("objects", error);
    return rows(data);
  }
}

export function createSocialsReadServiceFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new SocialsReadError("socials_unconfigured", 503, "SOCIALS is not configured.");
  return new SocialsReadService(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

function strictActor(value: string) {
  const actor = String(value || "").trim().toLowerCase();
  if (!UUID.test(actor)) throw new SocialsReadError("socials_identity_required", 401, "A verified SOCIALS account is required.");
  return actor;
}

function normalizeHandle(value: string) {
  const handle = String(value || "").trim().toLowerCase();
  if (!HANDLE.test(handle) || (handle.match(/[a-z]/g) ?? []).length < 3) {
    throw new SocialsReadError("socials_invalid_handle", 400, "The SOCIALS profile handle is invalid.");
  }
  return handle;
}

function normalizeTypes(values: readonly string[]) {
  const allowed = new Set<string>(SOCIAL_OBJECT_TYPES);
  return [...new Set((values ?? []).map((value) => String(value).trim()).filter((value) => allowed.has(value)))]
    .slice(0, SOCIAL_OBJECT_TYPES.length) as SocialObjectType[];
}

function rows(value: unknown): SocialVisibilityRow[] {
  return Array.isArray(value)
    ? value.filter((row): row is SocialVisibilityRow => Boolean(row && typeof row === "object"))
    : [];
}

function identifier(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 180) : "";
}

function filterProfileCollections(rows: SocialVisibilityRow[], profileRow: SocialVisibilityRow, own: boolean) {
  if (own) return rows;
  const profile = normalizeSocialProfile(profileRow.payload, profileRow.author_label);
  return rows.filter((row) => {
    if (row.user_id !== profileRow.user_id) return true;
    if (row.object_type === "reaction") {
      const kind = identifier(row.payload?.kind);
      if (kind === "LIKE" && profile.visibility.likes === "private") return false;
      if (kind === "SAVED" && profile.visibility.saves === "private") return false;
    }
    return !(row.object_type === "post"
      && row.payload?.isRepost === true
      && profile.visibility.reposts === "private");
  });
}

function visibleUnique(rows: SocialVisibilityRow[], access: SocialViewerAccess, maximum: number) {
  const byKey = new Map<string, SocialVisibilityRow>();
  for (const row of rows) {
    if (!canViewerReadSocialRow(row, access)) continue;
    const key = `${row.user_id}:${row.id}`;
    const current = byKey.get(key);
    if (!current || row.updated_at > current.updated_at) byKey.set(key, row);
  }
  return [...byKey.values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at)
      || left.user_id.localeCompare(right.user_id)
      || left.id.localeCompare(right.id))
    .slice(0, maximum);
}

function fromRow(row: SocialVisibilityRow): SocialObject {
  const payload = row.object_type === "profile"
    && (typeof row.payload.activeSince !== "string" || !Number.isFinite(Date.parse(row.payload.activeSince)))
    ? { ...row.payload, activeSince: row.created_at }
    : row.payload;
  return {
    id: row.id,
    userId: row.user_id,
    authorLabel: row.author_label,
    objectType: row.object_type,
    scope: row.scope,
    deskId: row.desk_id,
    parentId: row.parent_id,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cloudSaved: true,
  };
}

function stateReceipt(rows: SocialVisibilityRow[]): SocialsStateReceipt {
  return { version: 1, objects: rows.map(fromRow), cloud: true, loadedAt: new Date().toISOString() };
}

function boundedReceipt<T>(value: T): T {
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAXIMUM_RESPONSE_BYTES) {
    throw new SocialsReadError("socials_payload_too_large", 502, "The SOCIALS state exceeded its bounded payload contract.");
  }
  return value;
}

function unavailable(operation: string, cause: unknown) {
  console.error("SOCIALS privileged read failed", { operation, cause });
  return new SocialsReadError("socials_unavailable", 502, "SOCIALS is unavailable.");
}
