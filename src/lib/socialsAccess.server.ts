import "server-only";

import {
  buildSocialViewerAccess,
  type SocialVisibilityRow,
  type SocialViewerAccess,
} from "@/lib/socialsVisibility";

export const SOCIALS_ROW_SELECT = "user_id,id,author_label,object_type,scope,desk_id,parent_id,payload,created_at,updated_at";

const MAXIMUM_RELATIONSHIP_ROWS = 2_000;
const MAXIMUM_DESK_MEMBERSHIPS = 250;

export class SocialsAccessStorageError extends Error {
  readonly operation: string;
  readonly cause: unknown;

  constructor(operation: string, cause: unknown) {
    super("SOCIALS account access could not be resolved.");
    this.name = "SocialsAccessStorageError";
    this.operation = operation;
    this.cause = cause;
  }
}

/**
 * Resolves the same friendship and Desk membership inputs used by the
 * effective social_objects SELECT policy. A one-way profile follow is not a
 * friendship and therefore never expands friends-only visibility.
 */
export async function loadSocialViewerAccess(
  supabase: any,
  actorId: string,
): Promise<SocialViewerAccess> {
  const [outgoing, incoming, memberships] = await Promise.all([
    relationshipRows(
      supabase,
      (query) => query.eq("object_type", "follow").eq("user_id", actorId),
      MAXIMUM_RELATIONSHIP_ROWS / 2,
    ),
    relationshipRows(
      supabase,
      (query) => query.eq("object_type", "follow").eq("payload->>targetUserId", actorId),
      MAXIMUM_RELATIONSHIP_ROWS / 2,
    ),
    supabase
      .from("desk_members")
      .select("desk_id")
      .eq("user_id", actorId)
      .limit(MAXIMUM_DESK_MEMBERSHIPS),
  ]);
  if (memberships.error) throw new SocialsAccessStorageError("desk_memberships", memberships.error);
  const deskIds = ((memberships.data ?? []) as Array<{ desk_id?: unknown }>)
    .map((row) => typeof row.desk_id === "string" ? row.desk_id : "")
    .filter(Boolean);
  return buildSocialViewerAccess(actorId, [...outgoing, ...incoming], deskIds);
}

async function relationshipRows(
  supabase: any,
  configure: (query: any) => any,
  maximum: number,
): Promise<SocialVisibilityRow[]> {
  const { data, error } = await configure(supabase.from("social_objects").select(SOCIALS_ROW_SELECT))
    .order("created_at", { ascending: false })
    .limit(maximum);
  if (error) throw new SocialsAccessStorageError("relationships", error);
  return Array.isArray(data)
    ? data.filter((row): row is SocialVisibilityRow => Boolean(row && typeof row === "object"))
    : [];
}
