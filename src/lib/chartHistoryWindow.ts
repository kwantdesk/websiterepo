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

function cmeSessionDateKey(timestamp: number) {
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
  return sessionDate.toISOString().slice(0, 10);
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
