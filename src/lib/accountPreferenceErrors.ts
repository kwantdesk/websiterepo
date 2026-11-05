/** Only schema absence permits using the legacy account store. A timeout or
 * denied request says nothing about whether a newer snapshot already exists. */
export function isMissingPreferenceStore(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(code);
}

export function accountPreferenceReadUnavailable() {
  return new Error("Account sync is unavailable; local changes have been retained.");
}
