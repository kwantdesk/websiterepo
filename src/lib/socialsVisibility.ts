import type { SocialObjectType, SocialScope } from "@/lib/socials";

export type SocialVisibilityRow = {
  user_id: string;
  id: string;
  author_label: string;
  object_type: SocialObjectType;
  scope: SocialScope;
  desk_id: string | null;
  parent_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SocialViewerAccess = {
  actorId: string;
  friendIds: ReadonlySet<string>;
  deskIds: ReadonlySet<string>;
};

function targetUserId(row: SocialVisibilityRow) {
  const value = row.payload?.targetUserId;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Mirrors the effective social_objects SELECT policy without relying on RLS. */
export function buildSocialViewerAccess(
  actorId: string,
  relationshipRows: readonly SocialVisibilityRow[],
  deskIds: Iterable<string>,
): SocialViewerAccess {
  const normalizedActor = actorId.trim().toLowerCase();
  const outgoing = new Set(relationshipRows
    .filter((row) => row.object_type === "follow" && row.user_id.toLowerCase() === normalizedActor)
    .map(targetUserId)
    .filter(Boolean));
  const incoming = new Set(relationshipRows
    .filter((row) => row.object_type === "follow" && targetUserId(row) === normalizedActor)
    .map((row) => row.user_id.toLowerCase()));
  return Object.freeze({
    actorId: normalizedActor,
    friendIds: new Set([...outgoing].filter((id) => incoming.has(id))),
    deskIds: new Set([...deskIds].map((id) => id.trim()).filter(Boolean)),
  });
}

export function canViewerReadSocialRow(row: SocialVisibilityRow, access: SocialViewerAccess) {
  const owner = row.user_id.toLowerCase();
  return owner === access.actorId
    || row.scope === "community"
    || (row.scope === "friends" && access.friendIds.has(owner))
    || (row.scope === "desk" && Boolean(row.desk_id) && access.deskIds.has(row.desk_id!));
}

export function selectVisibleSocialRows(
  rows: readonly SocialVisibilityRow[],
  access: SocialViewerAccess,
) {
  return rows.filter((row) => canViewerReadSocialRow(row, access));
}
