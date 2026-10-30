import { normalizeTimeZone } from "./timeZones";

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Calendar filtering must reuse a formatter, not construct one per event. */
export function economicCalendarDateKey(date: Date | string, timeZone: string) {
  const value = typeof date === "string" ? new Date(date) : date;
  if (!Number.isFinite(value.getTime())) return "";
  const normalized = normalizeTimeZone(timeZone);
  let formatter = dayFormatters.get(normalized);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: normalized, year: "numeric", month: "2-digit", day: "2-digit" });
    if (dayFormatters.size >= 32) dayFormatters.delete(dayFormatters.keys().next().value!);
    dayFormatters.set(normalized, formatter);
  }
  const parts = formatter.formatToParts(value);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
