import { MINIMUM_CHART_HISTORY_SESSIONS, cmeSessionDateKey } from "@/lib/chartHistoryWindow";

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
  /**
   * A session that finished before the cursor. The gateway resolves the whole
   * CME window itself, which is both complete and safely in the past.
   */
  completed: boolean;
  /** Set only while a session is still developing under the replay cursor. */
  endMs?: number;
};

const DAY_MS = 24 * 60 * 60_000;

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
): ReplayProfileJob[] {
  const cursorDate = Number.isFinite(replayClock) ? tradingDate(replayClock) : null;
  if (!cursorDate) return [];
  return replayProfileTradingDates(candles, replayClock, maxSessions)
    .filter((date) => date <= cursorDate)
    .map((date) => (date === cursorDate
      ? { tradingDate: date, completed: false, endMs: replayClock }
      : { tradingDate: date, completed: true }));
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
  const dates = replayProfileTradingDates(candles, replayClock, maxSessions);
  if (!dates.length) return null;
  const covered = new Set(dates);
  let startMs = Infinity;
  for (const candle of candles) {
    const timestamp = Number(candle.timestamp);
    if (!Number.isFinite(timestamp) || timestamp > replayClock) continue;
    if (covered.has(tradingDate(timestamp)) && timestamp < startMs) startMs = timestamp;
  }
  // Globex opens the evening before the trading date, so a session with no
  // committed bar yet still needs a start earlier than the cursor.
  if (!Number.isFinite(startMs)) startMs = replayClock - DAY_MS;
  return { startMs, endMs: replayClock };
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
  // An hour of slack absorbs the gateway's own session-boundary rounding on a
  // COMPLETED session, whose data is wholly in the past regardless.
  return coverage <= replayClock + 60 * 60_000;
}
