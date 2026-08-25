/**
 * The New York calendar date for a timestamp, cheap enough for a per-candle loop.
 *
 * `Intl.DateTimeFormat.format` is not a cheap call: it allocates, and building
 * a formatter is far more expensive still. Grouping a session's candles by
 * trading date was doing one `format` per candle - thousands per pass, on an
 * effect that re-ran every time the live candle array was committed. That is
 * both main-thread time and garbage, and a Chrome trace of a real session
 * spent 52% of its time in GC.
 *
 * New York is a whole number of hours behind UTC (-4 or -5, never a fraction),
 * so every timestamp inside one UTC hour maps to the same New York date. That
 * makes the UTC hour an exact memo key rather than an approximation: a full
 * trading day needs at most 24 formatter calls no matter how many candles it
 * holds, and the answers are identical to formatting each one.
 */

const NEW_YORK_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const MS_PER_HOUR = 3_600_000;

/**
 * Bounded so a long-lived workspace cannot grow this without limit; a year of
 * hours is roughly 8,760 entries, which is far more than any chart window.
 */
const CACHE_LIMIT = 20_000;
const cache = new Map<number, string>();

/** The New York calendar date (YYYY-MM-DD) that a timestamp falls on. */
export function newYorkDateKey(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return "";
  const hour = Math.floor(timestampMs / MS_PER_HOUR);
  const cached = cache.get(hour);
  if (cached !== undefined) return cached;
  const formatted = NEW_YORK_DATE.format(hour * MS_PER_HOUR);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(hour, formatted);
  return formatted;
}

/**
 * Group items by their New York calendar date, preserving input order within
 * each date. Returns a Map so callers can keep insertion order or sort keys.
 */
export function groupByNewYorkDate<T>(
  items: readonly T[],
  timestampOf: (item: T) => number,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = newYorkDateKey(timestampOf(item));
    if (!key) continue;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(item);
    else grouped.set(key, [item]);
  }
  return grouped;
}
