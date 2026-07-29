export const SITE_ACCESS_COOKIE = "kwantdesk_access";
export const SITE_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function getSiteAccessPassword() {
  return process.env.KWANTDESK_ACCESS_PASSWORD?.trim() ?? "";
}

export function isSiteAccessConfigured() {
  return getSiteAccessPassword().length > 0;
}

export async function createSiteAccessToken(password: string) {
  const bytes = new TextEncoder().encode(`kwantdesk-site-access-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function isValidSiteAccessToken(token?: string | null) {
  const password = getSiteAccessPassword();
  if (!password || !token) return false;
  const expected = await createSiteAccessToken(password);
  return constantTimeEqual(token, expected);
}
