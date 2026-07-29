export function isAllowedEmail(email?: string | null) {
  return Boolean(email?.trim());
}
