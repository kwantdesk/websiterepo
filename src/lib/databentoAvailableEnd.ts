/**
 * The furthest point in time this licence actually covers, read out of
 * Databento's own rejection.
 *
 * Databento says this in more than one way. `data_end_after_available_end`
 * carries the timestamp in `payload.available_end`. But a subscription whose
 * coverage stops before the requested window is refused as
 * `dataset_unavailable_range`, which was NOT handled — so the clamp below
 * never engaged and every chart-history request failed outright rather than
 * retrying against the window the licence does cover. Measured on production:
 * every symbol and every timeframe returned 502 for exactly this reason.
 *
 * That case does not always carry a structured payload, so the date is taken
 * from the message text when the field is absent. Returning null means "no
 * usable end was named" and the caller reports the failure honestly rather
 * than retrying against a guess.
 */
const AVAILABLE_END_CASES = new Set([
  "data_end_after_available_end",
  "dataset_unavailable_range",
]);

export function availableEndFromError(detail: string) {
  let messageText = detail;
  try {
    const payload = JSON.parse(detail) as {
      detail?: {
        case?: string;
        message?: unknown;
        payload?: { available_end?: unknown };
      };
    };
    const problem = payload.detail;
    if (!problem || !AVAILABLE_END_CASES.has(String(problem.case))) return null;
    const structured = Date.parse(String(problem.payload?.available_end ?? ""));
    if (Number.isFinite(structured)) return structured;
    messageText = String(problem.message ?? detail);
  } catch {
    // Not JSON: fall through and read the raw text below.
  }
  // "...Try again with an end date of at most 2026-08-19T21:00:00Z" and the
  // several shapes of that sentence Databento uses.
  const match = messageText.match(/(\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?)/);
  if (!match) return null;
  const timestamp = Date.parse(match[1].includes("T") || match[1].includes(" ") ? match[1] : `${match[1]}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

// The licence's own reported end, remembered across requests.
//
// This account's CME entitlement is DELAYED rather than expired: it trails real
// time by hours and the boundary creeps forward. Every request reaching past it
// is refused with a 422 naming the end it would accept.
//
// Retrying rescues the call that hit the wall, but it teaches only that one
// call. Measured on a single production pane load: fifteen /api/cme-history
// requests, THIRTEEN of them 502s at one to four seconds each — roughly twenty
// seconds of a chart's startup spent rediscovering the same fact thirteen
// times. That is a large part of "charts take ages to populate".
//
// Remembering it makes the first refusal the only one. It lives here rather
// than beside the fetch so it can be tested without the server-only vendor
// client — the same reason availableEndFromError was extracted.
let rememberedAvailableEndMs: number | null = null;

/** A fresh process, or a test, must not inherit a stale boundary. */
export function resetRememberedAvailableEnd() {
  rememberedAvailableEndMs = null;
}

export function rememberedAvailableEnd() {
  return rememberedAvailableEndMs;
}

/** Only ever moves forward: the provider extends this window as time passes. */
export function rememberAvailableEnd(timestampMs: number | null) {
  if (timestampMs == null || !Number.isFinite(timestampMs)) return;
  if (rememberedAvailableEndMs == null || timestampMs > rememberedAvailableEndMs) {
    rememberedAvailableEndMs = timestampMs;
  }
}

/**
 * Narrow a request's end to the licence boundary. Never widens a window, and
 * never rescues one that starts beyond the boundary — there is genuinely no
 * data there, and that failure has to reach the trader rather than becoming a
 * silently empty chart.
 */
export function clampEndToLicence<T extends Record<string, string>>(params: T): T {
  if (rememberedAvailableEndMs == null) return params;
  const requestedEnd = Date.parse(params.end ?? "");
  const requestedStart = Date.parse(params.start ?? "");
  if (Number.isFinite(requestedEnd) && requestedEnd <= rememberedAvailableEndMs) return params;
  if (Number.isFinite(requestedStart) && requestedStart >= rememberedAvailableEndMs) return params;
  return { ...params, end: new Date(rememberedAvailableEndMs - 1).toISOString() };
}
