/**
 * One cached exchange clock for every engine that needs exchange-local time.
 *
 * `Intl.DateTimeFormat.formatToParts` is expensive, and indicator engines
 * reach for it per record — per trade, per candle, and in one case inside a
 * nested loop. Measured on the TPO engine, that single pattern accounted for
 * 88.6% of a nine-second build. It has now been found in five separate
 * engines, so the cache lives here once rather than being reinvented (or
 * forgotten) per file.
 *
 * The cache is keyed by timezone and MINUTE. Every timezone offset in the IANA
 * database is a whole number of minutes, so within one minute the date, hour,
 * minute and weekday are constant and only the seconds move — resolving one
 * timestamp answers for every other one in that minute. DST changes land on a
 * minute boundary, so no cached minute can straddle one.
 *
 * Deliberately free of DOM and React so workers and server code can use it.
 */

export type ExchangeClockParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, matching Date#getUTCDay. */
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const next = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  formatters.set(timeZone, next);
  return next;
}

const partsByMinute = new Map<string, ExchangeClockParts>();
/** Roughly a month of minutes across a handful of zones. */
const PARTS_CACHE_LIMIT = 50_000;

function resolve(timestampMs: number, timeZone: string): ExchangeClockParts {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // h23 still reports midnight as 24 in some engines' locales.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[String(parts.weekday)] ?? 0,
  };
}

/** Exchange-local calendar and clock parts for an instant. */
export function exchangeClockParts(timestampMs: number, timeZone: string): ExchangeClockParts {
  const minute = Math.floor(timestampMs / 60_000);
  const key = `${timeZone}:${minute}`;
  const cached = partsByMinute.get(key);
  if (cached) {
    const second = Math.floor(timestampMs / 1_000) % 60;
    return second === cached.second ? cached : { ...cached, second };
  }
  const resolved = resolve(timestampMs, timeZone);
  if (partsByMinute.size >= PARTS_CACHE_LIMIT) {
    const oldest = partsByMinute.keys().next().value;
    if (oldest !== undefined) partsByMinute.delete(oldest);
  }
  partsByMinute.set(key, resolved);
  return resolved;
}

const pad = (value: number) => (value < 10 ? `0${value}` : String(value));

/** Exchange-local calendar date as YYYY-MM-DD. */
export function exchangeDateKey(timestampMs: number, timeZone: string): string {
  const parts = exchangeClockParts(timestampMs, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Minutes since exchange-local midnight. */
export function exchangeMinuteOfDay(timestampMs: number, timeZone: string): number {
  const parts = exchangeClockParts(timestampMs, timeZone);
  return parts.hour * 60 + parts.minute;
}

/** Seconds since exchange-local midnight. */
export function exchangeSecondOfDay(timestampMs: number, timeZone: string): number {
  const parts = exchangeClockParts(timestampMs, timeZone);
  return parts.hour * 3_600 + parts.minute * 60 + parts.second;
}
