import type { Candle } from "@/lib/backtester";

export const MINIMUM_CHART_HISTORY_SESSIONS = 5;

// Five CME sessions can span more than five calendar days because Globex is
// closed over the weekend and can also lose a weekday to an exchange holiday.
// Ten calendar days gives the normal five-session bootstrap a safe buffer.
export const DEFAULT_CHART_HISTORY_CALENDAR_DAYS = 10;

const CME_SESSION_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

export function cmeSessionDateKey(timestamp: number) {
  if (!Number.isFinite(timestamp)) return null;
  const parts = Object.fromEntries(
    CME_SESSION_CLOCK
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  if (![year, month, day, hour].every(Number.isFinite)) return null;

  // The CME Globex trading day starts at 17:00 Chicago time and is labelled
  // with the following business date.
  const sessionDate = new Date(Date.UTC(year, month - 1, day));
  if (hour >= 17) sessionDate.setUTCDate(sessionDate.getUTCDate() + 1);

  // There is no Saturday or Sunday CME trading date. Quotes can retain a
  // current timestamp while the venue is in its Friday-close maintenance
  // window; allowing that timestamp to manufacture a weekend session makes
  // every historical execution request target an empty day. Keep the last
  // completed Friday session until Globex genuinely reopens Sunday at 17:00
  // Chicago, at which point the normal rule above labels it Monday.
  const weekday = sessionDate.getUTCDay();
  if (weekday === 6) sessionDate.setUTCDate(sessionDate.getUTCDate() - 1);
  if (weekday === 0) sessionDate.setUTCDate(sessionDate.getUTCDate() - 2);
  return sessionDate.toISOString().slice(0, 10);
}

// Start of the CME Globex session that `timestamp` belongs to (17:00 Chicago,
// DST-aware). Order-flow backfill must be anchored here rather than to a fixed
// lookback: a rolling window leaves the earlier part of the session with no
// execution data, so a volume profile shows real delta only for the recent
// hours and a flat, delta-free block for everything before it.
export function cmeSessionStartMs(timestamp: number): number | null {
  if (!Number.isFinite(timestamp)) return null;
  const sessionDate = cmeSessionDateKey(timestamp);
  if (!sessionDate) return null;
  const [year, month, day] = sessionDate.split("-").map(Number);
  // The session opens at 17:00 Chicago on the day BEFORE the session label.
  const previousDay = new Date(Date.UTC(year, month - 1, day));
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);

  // Chicago is UTC-5 or UTC-6; resolve which by probing both candidates and
  // keeping the one whose Chicago wall clock actually reads 17:00.
  for (const offsetHours of [5, 6]) {
    const candidate = Date.UTC(
      previousDay.getUTCFullYear(),
      previousDay.getUTCMonth(),
      previousDay.getUTCDate(),
      17 + offsetHours,
    );
    const parts = Object.fromEntries(
      CME_SESSION_CLOCK
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    if (Number(parts.hour) === 17) return candidate;
  }
  return null;
}

/**
 * The [start, end) window of the CME session labelled `tradingDate`
 * ("YYYY-MM-DD"), i.e. 17:00 Chicago the previous day through 17:00 Chicago
 * on the date itself. Needed to build an execution-accurate profile for a
 * PAST session: without it, a request carrying only a trading date resolves
 * to the current session, gets rejected downstream as a date mismatch, and
 * the chart silently keeps the OHLCV approximation for every prior day.
 */
export function cmeSessionWindowForDate(
  tradingDate: string,
): { startMs: number; endMs: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDate)) return null;
  const [year, month, day] = tradingDate.split("-").map(Number);
  // Midday UTC on the trading date is early morning in Chicago, which always
  // falls inside the session bearing that date.
  const insideSession = Date.UTC(year, month - 1, day, 12);
  const startMs = cmeSessionStartMs(insideSession);
  const endMs = cmeSessionStartMs(insideSession + 24 * 60 * 60_000);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  return { startMs, endMs };
}

export function trimToRecentChartSessions(
  candles: Candle[],
  sessionCount = MINIMUM_CHART_HISTORY_SESSIONS,
) {
  if (!candles.length || sessionCount <= 0) return candles;
  const sorted = [...candles].sort((left, right) => left.timestamp - right.timestamp);
  const sessions = new Set<string>();
  let startIndex = 0;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const session = cmeSessionDateKey(sorted[index].timestamp);
    if (session && !sessions.has(session)) {
      if (sessions.size >= sessionCount) {
        startIndex = index + 1;
        break;
      }
      sessions.add(session);
    }
    startIndex = index;
  }

  return sorted.slice(startIndex);
}

function timeframeDurationMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match) return null;
  const value = Math.max(1, Number(match[1]));
  const unitMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 60 * 60_000,
    D: 24 * 60 * 60_000,
    W: 7 * 24 * 60 * 60_000,
    M: 30 * 24 * 60 * 60_000,
  };
  return value * unitMs[match[2]];
}

export function hasMinimumChartHistory(
  candles: Candle[],
  timeframe: string,
  minimumSessions = MINIMUM_CHART_HISTORY_SESSIONS,
) {
  if (!candles.length) return false;

  const durationMs = timeframeDurationMs(timeframe);
  const firstTimestamp = candles[0]?.timestamp ?? Number.POSITIVE_INFINITY;
  const lastTimestamp = candles.at(-1)?.timestamp ?? 0;
  const lastBucketEnd = lastTimestamp + (durationMs ?? 0);
  const hasCurrentTail = lastBucketEnd >= Date.now() - 3 * 24 * 60 * 60_000;
  if (!hasCurrentTail) return false;

  // Weekly and monthly bars naturally contain fewer than five candles while
  // still covering the requested five sessions.
  if (durationMs !== null && durationMs >= 7 * 24 * 60 * 60_000) {
    return firstTimestamp <= Date.now() - 5 * 24 * 60 * 60_000;
  }

  const sessionDates = new Set<string>();
  for (const candle of candles) {
    const sessionDate = cmeSessionDateKey(candle.timestamp);
    if (sessionDate) sessionDates.add(sessionDate);
    if (sessionDates.size >= minimumSessions) return true;
  }
  return false;
}
