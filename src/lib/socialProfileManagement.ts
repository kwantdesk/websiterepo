import type { SocialObject, SocialScope } from "@/lib/socials";

export type ProfileCollection = "gameplans" | "posts" | "liked" | "reposts" | "saved";
export type ProfileItemAction = "delete" | "archive" | "restore" | "visibility" | "edit";
export type ProfileAudience = "private" | "friends" | "community";
export const PROFILE_AUDIENCES = [
  { value: "community", label: "Public" }, { value: "friends", label: "Friends only" }, { value: "private", label: "Only me (private)" },
] as const;
export function isProfileAudience(value: unknown): value is ProfileAudience {
  return value === "private" || value === "friends" || value === "community";
}
export function isProfileArchived(object: SocialObject) { return typeof object.payload?.profileArchivedAt === "string" && Boolean(object.payload.profileArchivedAt); }
export function resolveProfileManagedItem(object: SocialObject, collection: ProfileCollection, actorId: string, reactions: readonly SocialObject[]) {
  if (collection === "liked" || collection === "saved") return reactions.find(reaction => reaction.userId === actorId
    && reaction.parentId === object.id && reaction.payload.kind === (collection === "liked" ? "LIKE" : "SAVED"));
  return object.userId === actorId ? object : undefined;
}
export function profileItemPatch(object: SocialObject, action: ProfileItemAction, scope?: unknown, now = new Date().toISOString()) {
  if (!["post", "precord", "reaction"].includes(object.objectType)) throw new Error("This item cannot be managed from your profile.");
  if (object.objectType === "reaction" && !["LIKE", "SAVED"].includes(String(object.payload.kind))) throw new Error("This collection item cannot be managed here.");
  const payload = { ...object.payload };
  let nextScope: SocialScope = object.scope;
  if (action === "archive") {
    if (!isProfileArchived(object)) { payload.profileArchiveScope = object.scope; payload.profileArchivedAt = now; }
    nextScope = "private";
  } else if (action === "restore") {
    const previous = payload.profileArchiveScope;
    nextScope = isProfileAudience(previous) ? previous : previous === "desk" && object.deskId ? "desk" : "private";
    delete payload.profileArchivedAt; delete payload.profileArchiveScope;
  } else if (action === "visibility") {
    if (!isProfileAudience(scope)) throw new Error("Choose Public, Friends only, or Only me.");
    if (isProfileArchived(object)) payload.profileArchiveScope = scope;
    else nextScope = scope;
  } else throw new Error("Choose a supported profile action.");
  return { scope: nextScope, payload, updatedAt: now };
}
