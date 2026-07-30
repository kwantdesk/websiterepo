export type SocialProfilePreview = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  isOnline: boolean;
  storedAt: number;
};

const PROFILE_PREVIEW_PREFIX = "kwantdesk:social-profile-preview:";
const PROFILE_PREVIEW_MAX_AGE_MS = 10 * 60 * 1000;

function normalizedHandle(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function storeSocialProfilePreview(
  preview: Omit<SocialProfilePreview, "storedAt">,
) {
  if (typeof window === "undefined") return;
  const handle = normalizedHandle(preview.handle);
  if (!handle) return;
  try {
    window.sessionStorage.setItem(
      `${PROFILE_PREVIEW_PREFIX}${handle}`,
      JSON.stringify({ ...preview, handle, storedAt: Date.now() }),
    );
  } catch {
    // The profile route still has its normal loading state when storage is unavailable.
  }
}

export function loadSocialProfilePreview(handleValue: string) {
  if (typeof window === "undefined") return null;
  const handle = normalizedHandle(handleValue);
  if (!handle) return null;
  try {
    const raw = window.sessionStorage.getItem(`${PROFILE_PREVIEW_PREFIX}${handle}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SocialProfilePreview>;
    if (
      typeof parsed.userId !== "string"
      || typeof parsed.displayName !== "string"
      || typeof parsed.handle !== "string"
      || typeof parsed.avatarUrl !== "string"
      || typeof parsed.isOnline !== "boolean"
      || typeof parsed.storedAt !== "number"
      || Date.now() - parsed.storedAt > PROFILE_PREVIEW_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(`${PROFILE_PREVIEW_PREFIX}${handle}`);
      return null;
    }
    return parsed as SocialProfilePreview;
  } catch {
    return null;
  }
}
