/**
 * What a trader is allowed to see when a market-data provider refuses.
 *
 * Routes were forwarding the provider's own message straight to the browser,
 * renaming the vendor and nothing else, so the chart displayed:
 *
 *   STRUCTURE · CME REQUEST FAILED (402): {"DETAIL":{"CASE":"ACCOUNT_INSUFFICIENT_FUNDS", ...
 *
 * That is a billing state and a raw JSON body on a trading surface. It tells
 * the trader nothing they can act on, and it puts the desk's account status on
 * screen where a screen-share or a screenshot carries it straight out of the
 * room.
 *
 * The full text still reaches the server log, which is where it is useful.
 * What reaches the browser is plain, honest, and free of vendor codes: the data
 * is unavailable, and where the provider named a date we can actually serve up
 * to, that date is worth saying because it explains WHICH bars are missing.
 */

const AVAILABLE_UP_TO = /(?:end (?:time|date) (?:of at most|before)\s*)(\d{4}-\d{2}-\d{2})/i;

/** Never leaked: entitlement, billing and credential states. */
const SILENT_CASES = [
  "account_insufficient_funds",
  "auth_required",
  "authentication_failed",
  "permission_denied",
  "forbidden",
  "unauthorized",
  "invalid_api_key",
  "quota",
  "rate_limit",
];

export function providerErrorMessage(error: unknown, subject = "History"): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lowered = raw.toLowerCase();

  // A named availability window is the one detail worth passing on: it says
  // which bars exist rather than merely that something failed.
  const upTo = raw.match(AVAILABLE_UP_TO);
  if (upTo && !SILENT_CASES.some((token) => lowered.includes(token))) {
    return `${subject} is only available up to ${upTo[1]}.`;
  }

  if (lowered.includes("not configured")) {
    return `${subject} is not configured.`;
  }
  if (lowered.includes("abort") || lowered.includes("timeout") || lowered.includes("timed out")) {
    return `${subject} timed out. Try again in a moment.`;
  }
  // Everything else, including every SILENT_CASE, collapses to the same line.
  // Distinguishing them on screen would be leaking the thing this exists to
  // hide.
  return `${subject} is unavailable right now.`;
}

/**
 * Log the provider's real words. Server-side only — this is the half that has
 * to survive, or an outage becomes undiagnosable from the outside.
 */
export function logProviderError(scope: string, error: unknown) {
  const raw = error instanceof Error ? `${error.message}` : String(error ?? "");
  console.warn(`[${scope}] provider request failed: ${raw.slice(0, 600)}`);
}
