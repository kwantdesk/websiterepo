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
