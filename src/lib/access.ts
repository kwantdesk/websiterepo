export function isAllowedEmail(email?: string | null) {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(email && allowed.includes(email.toLowerCase()));
}
