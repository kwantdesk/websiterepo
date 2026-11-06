import { RTH_START_MINUTES, RTH_END_MINUTES, requestedSessionIds, resolveSessionSegments, sessionTradingDate, type SessionFilterMode, type SessionWindowKind } from "@/lib/volumeProfileSessions";
import { MINIMUM_CHART_HISTORY_SESSIONS, cmeSessionDateKey, cmeSessionWindowForDate } from "@/lib/chartHistoryWindow";

/**
 * Which volume profiles a replay may legitimately show at a given clock.
 *
 * A backtest profile is not the same object as a live one. Live, the session
 * in progress simply stops at "now" and there is no later data to leak. In
 * replay the whole session already exists in the archive, so asking the
 * gateway for a trading date returns the COMPLETE session — including the
 * hours the trader has not replayed yet. A profile built that way shows the
 * afternoon's point of control while the trader is still deciding what to do
 * at the open, which is the one thing a backtester must never do.
 *
 * Every job therefore carries its own clock bound, and the session containing
 * the cursor is explicitly clipped to it.
 */
export type ReplayProfileJob = {
  tradingDate: string;
  startMs: number;
  endMs: number;
  completed: boolean;
  sessionId?: string;
  sessionLabel?: string;
};

// Archive rows are minute aggregates. A cutoff inside a minute would
// include later executions even if the response echoes the requested end.
export function replayProfileCheckpoint(clock: number): number {
  return Math.floor(clock / 60_000) * 60_000;
}

function tradingDate(timestamp: number) {
  return cmeSessionDateKey(timestamp) ?? new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * The CME trading dates a replay window covers, oldest first, capped at the
 * five sessions a volume-profile trader reads back over.
 *
 * Driven by the candles the pane actually holds rather than by counting
 * calendar days, so exchange holidays and the weekend break cannot silently
 * turn "five sessions" into three.
 */
export function replayProfileTradingDates(
  candles: readonly { timestamp: number }[],
  replayClock: number,
  maxSessions: number = MINIMUM_CHART_HISTORY_SESSIONS,
): string[] {
  if (!Number.isFinite(replayClock) || !candles.length) return [];
  const limit = Math.max(1, Math.floor(maxSessions));
  const dates = new Set<string>();
  for (const candle of candles) {
    const timestamp = Number(candle.timestamp);
    // A bar at or before the cursor is legitimate history; anything after it
    // has not happened yet in the replay and cannot contribute a session.
    if (!Number.isFinite(timestamp) || timestamp > replayClock) continue;
    dates.add(tradingDate(timestamp));
  }
  // The cursor's own session counts even before its first bar is committed —
  // at the open the trader is watching a profile that has no completed bar.
  dates.add(tradingDate(replayClock));
  return [...dates].sort().slice(-limit);
}

/**
 * One request description per session, each already bounded by the clock.
 *
 * The developing session is the one whose date matches the cursor. Sessions
 * after the cursor are dropped outright rather than clipped to nothing, so a
 * stale candle array cannot smuggle tomorrow onto the chart.
 */
export function replayProfileJobs(
  candles: readonly { timestamp: number }[],
  replayClock: number,
  maxSessions: number = MINIMUM_CHART_HISTORY_SESSIONS,
  settings: Record<string, unknown> = {},
): ReplayProfileJob[] {
  const cutoff = replayProfileCheckpoint(replayClock);
  const mode = String(settings.filterMode ?? "none").toLowerCase() as SessionFilterMode;
  const ids = requestedSessionIds(settings);
  const useEndSessionAsStartDay = settings.useEndSessionAsStartDay === true;
  return replayProfileTradingDates(candles, replayClock, maxSessions).flatMap((date) => {
    const session = cmeSessionWindowForDate(date);
    if (!session) return [];
    const midnight = Date.parse(date + "T00:00:00Z");
    const windows = ids?.size
      ? resolveSessionSegments(midnight - 12 * 3_600_000, midnight + 36 * 3_600_000, {
          mode,
          window: [...ids][0] as SessionWindowKind,
          customStartMinutes: Number(settings.sessionStartMinutes ?? RTH_START_MINUTES),
          customEndMinutes: Number(settings.sessionEndMinutes ?? RTH_END_MINUTES),
          useEndSessionAsStartDay,
        }).filter((segment) => ids.has(segment.id) && (
          mode === "triple"
            ? tradingDate(segment.startMs) === date
            : sessionTradingDate(segment, useEndSessionAsStartDay) === date
        )).map(({ startMs, endMs, id, label }) => ({ startMs, endMs, sessionId: id, sessionLabel: label }))
      : [session];
    return windows.flatMap((window) => {
      const endMs = Math.min(window.endMs, cutoff);
      return endMs > window.startMs
        ? [{ ...window, tradingDate: date, endMs, completed: endMs === window.endMs }]
        : [];
    });
  });
}

/**
 * The weekly profile's span: the first of the covered sessions through the
 * cursor. Bounded by the same clock as the daily jobs for the same reason.
 */
export function replayWeeklyProfileWindow(
  candles: readonly { timestamp: number }[],
  replayClock: number,
  maxSessions: number = MINIMUM_CHART_HISTORY_SESSIONS,
): { startMs: number; endMs: number } | null {
  const jobs = replayProfileJobs(candles, replayClock, maxSessions);
  if (!jobs.length) return null;
  return { startMs: jobs[0].startMs, endMs: jobs[jobs.length - 1].endMs };
}

/**
 * Whether a profile the gateway returned is safe to paint at this clock.
 *
 * The cache is keyed by request, and a replay can be restarted at an earlier
 * time against the same symbol, so a profile fetched for a later cursor can
 * still be sitting in memory. Painting it would show the trader their own
 * future.
 */
export function replayProfileWithinClock(
  profile: {
    startMs?: number | null;
    endMs?: number | null;
    coverageEndMs?: number | null;
  } | null,
  replayClock: number,
): boolean {
  if (!profile || !Number.isFinite(replayClock)) return false;
  const coverage = Number(profile.coverageEndMs ?? profile.endMs ?? NaN);
  if (!Number.isFinite(coverage)) return false;
  // No tolerance may admit a later developing profile. Boundary discrepancies
  // must be repaired at the source, never by revealing an hour of future flow.
  return coverage <= replayClock;
}
