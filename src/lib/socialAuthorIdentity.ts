import type { SocialObject } from "@/lib/socials";
import type { CachedProfileIdentity } from "@/lib/profileIdentityCache";

export function applySocialIdentityUpdate(objects: readonly SocialObject[], userId: string, identity: CachedProfileIdentity): SocialObject[] {
  return objects.map(object => object.objectType === "profile" && object.userId === userId ? {
    ...object, authorLabel: identity.displayName || object.authorLabel,
    payload: { ...object.payload, displayName: identity.displayName || object.payload.displayName,
      handle: identity.handle || object.payload.handle, avatarUrl: identity.avatarUrl },
  } : object);
}

/** Display projection only: never rewrite locked records, hashes or author IDs. */
export function projectSocialAuthorIdentity(objects: readonly SocialObject[], profiles: readonly Pick<SocialObject, "objectType" | "userId" | "payload">[] = objects): SocialObject[] {
  const names = new Map<string, string>();
  for (const profile of profiles) {
    if (profile.objectType !== "profile") continue;
    const value = profile.payload.displayName;
    if (typeof value === "string" && value.trim()) names.set(profile.userId, value.trim());
  }
  return objects.map(object => {
    const name = names.get(object.userId);
    return name && name !== object.authorLabel ? { ...object, authorLabel: name } : object;
  });
}
