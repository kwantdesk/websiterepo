import { DEFAULT_CHART_HISTORY_CALENDAR_DAYS } from "@/lib/chartHistoryWindow";

/**
 * Choosing the loaded history range a session replay needs.
 *
 * Replay reveals the pane's OWN loaded candles against the clock; it cannot
 * invent bars that were never fetched. A session outside the loaded window
 * therefore replays an empty chart however far the slider is dragged, which is
 * what stepping back more than a few days used to do.
 *
 * Ordered shortest first: a replay of last Tuesday must not drag four years of
 * bars onto a chart that only needed a week.
 */
export const REPLAY_PERIOD_LADDER: readonly { period: string; days: number }[] = [
  { period: "5D", days: DEFAULT_CHART_HISTORY_CALENDAR_DAYS },
  { period: "1M", days: 30 },
  { period: "3M", days: 90 },
  { period: "6M", days: 180 },
  { period: "1Y", days: 365 },
  { period: "All", days: 4 * 365 },
] as const;

const DAY_MS = 24 * 60 * 60_000;
export const GEX_VUE_REPLAY_HISTORY_DAYS = 90;

/**
 * Three days of headroom so the replayed session is never the very first rows
 * of the window — the profiles and levels behind it need something to build on.
 */
const REPLAY_HISTORY_HEADROOM_DAYS = 3;

/** The oldest session the deepest range can reach, for the picker's bound. */
export function earliestReplaySessionDate(nowMs = Date.now()) {
  const oldest = REPLAY_PERIOD_LADDER[REPLAY_PERIOD_LADDER.length - 1].days;
  return new Date(nowMs - oldest * DAY_MS).toISOString().slice(0, 10);
}

/**
 * GEX VUE's synchronized archive is intentionally bounded to the three-month
 * options-history contract.  Keeping this separate from the deeper price-only
 * ladder prevents the picker offering dates for which the exposure archive is
 * not guaranteed to exist.
 */
export function earliestGexVueReplaySessionDate(nowMs = Date.now()) {
  return new Date(nowMs - GEX_VUE_REPLAY_HISTORY_DAYS * DAY_MS).toISOString().slice(0, 10);
}

/** The shortest load range that reaches back to `sessionDate`. */
export function replayPeriodForSession(sessionDate: string, nowMs = Date.now()) {
  const sessionMs = Date.parse(`${sessionDate}T00:00:00.000Z`);
  if (!Number.isFinite(sessionMs)) return null;
  const daysBack = (nowMs - sessionMs) / DAY_MS + REPLAY_HISTORY_HEADROOM_DAYS;
  return REPLAY_PERIOD_LADDER.find((step) => step.days >= daysBack)?.period
    ?? REPLAY_PERIOD_LADDER[REPLAY_PERIOD_LADDER.length - 1].period;
}

/**
 * Whether `period` already reaches back at least as far as `candidate`, so a
 * pane loaded with more history than the replay needs is left alone.
 */
export function periodReaches(period: string, candidate: string) {
  const have = REPLAY_PERIOD_LADDER.findIndex((step) => step.period === period);
  const need = REPLAY_PERIOD_LADDER.findIndex((step) => step.period === candidate);
  // An unknown range makes no claim about its depth, so it is never treated as
  // deep enough — widening a pane costs a fetch, leaving it short costs the
  // trader an empty replay.
  return have >= 0 && need >= 0 && have >= need;
}
