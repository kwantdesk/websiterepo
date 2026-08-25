export const LAB_ACCESS_COOKIE = "kwantdesk_lab_access";
export const LAB_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 12;

const DEFAULT_LAB_PASSCODE = "1234";

export function getLabAccessPasscode() {
  return process.env.KWANTDESK_LAB_PASSCODE?.trim() || DEFAULT_LAB_PASSCODE;
}

export async function createLabAccessToken(passcode: string) {
  const bytes = new TextEncoder().encode(`kwantdesk-august-v1-lab:${passcode}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function isValidLabAccessToken(token?: string | null) {
  if (!token) return false;
  const expected = await createLabAccessToken(getLabAccessPasscode());
  return constantTimeEqual(token, expected);
}
