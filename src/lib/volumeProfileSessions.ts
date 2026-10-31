/**
 * Session windowing for volume profiles and the desk's session clock.
 *
 * A profile covering a whole CME trading day mixes Asia, London and New York
 * into one shape. Splitting it is what lets a desk see where each session
 * actually did business, and filtering to RTH is what makes a profile
 * comparable to a cash-session chart.
 *
 * Windows are resolved ONCE per profile from the requested range and then
 * compared numerically, because the alternative — asking Intl for the
 * exchange-local time of every execution — would run a timezone lookup
 * hundreds of thousands of times per session.
 */

const CHICAGO_TIME_ZONE = "America/Chicago";

export type SessionFilterMode = "none" | "filter" | "splitted" | "triple";
export type SessionWindowKind = "rth" | "eth" | "custom";

export type SessionFilterConfig = {
  mode: SessionFilterMode;
  window: SessionWindowKind;
  /** Minutes past exchange-local midnight. Only read when window is "custom". */
  customStartMinutes: number;
  customEndMinutes: number;
  /**
   * A window that ends after midnight belongs to the following trading date.
   * This is what puts an Asia profile on the right day instead of the one it
   * started in.
   */
  useEndSessionAsStartDay: boolean;
};

export const DEFAULT_SESSION_FILTER: SessionFilterConfig = {
  mode: "none",
  window: "rth",
  customStartMinutes: 8 * 60 + 30,
  customEndMinutes: 15 * 60 + 15,
  useEndSessionAsStartDay: false,
};

export type SessionSegment = {
  /** Stable identity used to label a split profile. */
  id: "rth" | "eth" | "globex" | "asia" | "london" | "newyork" | "custom";
  label: string;
  startMs: number;
  endMs: number;
};

/** CME equity-index regular trading hours, exchange-local minutes. */
export const RTH_START_MINUTES = 8 * 60 + 30;
export const RTH_END_MINUTES = 15 * 60 + 15;

/**
 * The sessions a futures desk actually reads, in exchange-local minutes.
 *
 * The CME electronic day opens at 17:00 Chicago, so every window here is
 * expressed from that bell and the later ones run past 1440 into the next
 * calendar day.
 *
 * Globex is the opening subdivision, not a second full-day envelope. Asia
 * starts at 09:00 Tokyo (00:00 UTC): 19:00 Chicago during US daylight time,
 * 18:00 during standard time. In Brisbane Asia stays at 10:00, while Globex
 * opens at 08:00 / 09:00 as US clocks change.
 *
 * The former three-window contract combined Globex and Asia under "Asia".
 * Keep them independently selectable and give both the correct tape window.
 * London's existing 02:00-10:00 window and New York's 08:30-15:00 window are
 * unchanged; their deliberate overlap is independent of this opening split.
 *
 * The stored filter mode is still spelled "triple" from when there were three
 * of these. Renaming it would orphan every saved workspace, so the value stays
 * and only what it resolves to has grown.
 */
const DESK_SESSION_SEGMENTS: {
  id: SessionSegment["id"];
  label: string;
  /** The per-study flag that switches this window on. */
  settingsKey: string;
  start: number;
  end: number;
}[] = [
  { id: "globex", label: "Globex", settingsKey: "sessionGlobexEnabled", start: 17 * 60, end: 19 * 60 },
  { id: "asia", label: "Asia", settingsKey: "sessionAsiaEnabled", start: 19 * 60, end: 26 * 60 },
  // DeepChart "Europe", 03:00 -> 11:00 New York.
  { id: "london", label: "London", settingsKey: "sessionLondonEnabled", start: 26 * 60, end: 34 * 60 },
  // DeepChart "Usa", 09:30 -> 16:00 New York - the cash session, not the CME close.
  { id: "newyork", label: "New York", settingsKey: "sessionNewYorkEnabled", start: RTH_START_MINUTES + 24 * 60, end: 15 * 60 + 24 * 60 },
];

/**
 * The desk sessions in draw order.
 *
 * The settings dialog, the toggle handler and the window resolver all read this
 * one list, so a session cannot exist as a button without a window behind it or
 * be drawn without a way to switch it off.
 */
export const DESK_SESSIONS: readonly { id: SessionSegment["id"]; label: string; settingsKey: string }[] =
  DESK_SESSION_SEGMENTS.map(({ id, label, settingsKey }) => ({ id, label, settingsKey }));

/** Every desk-session settings flag, in draw order. */
export const DESK_SESSION_SETTING_KEYS: readonly string[] =
  DESK_SESSION_SEGMENTS.map((segment) => segment.settingsKey);

const minuteFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Exchange-local minutes past midnight for an instant. */
export function exchangeMinuteOfDay(timestampMs: number): number {
  const parts = minuteFormatter.formatToParts(new Date(timestampMs));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_TIME_ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const DAY_MS = 86_400_000;
const civilEpochCache = new Map<number, number>();

// UTC here encodes a calendar date/clock, not an actual exchange instant.
function exchangeCivilStamp(timestampMs: number): number {
  const parts = calendarFormatter.formatToParts(timestampMs);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}

function exchangeDateStamp(timestampMs: number): number {
  return Math.floor(exchangeCivilStamp(timestampMs) / DAY_MS) * DAY_MS;
}

function exchangeCivilEpoch(dateStamp: number, minutes = 0): number {
  const wallClock = dateStamp + minutes * 60_000;
  const cached = civilEpochCache.get(wallClock);
  if (cached !== undefined) return cached;
  let instant = wallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const correction = wallClock - exchangeCivilStamp(instant);
    if (correction === 0) {
      if (civilEpochCache.size >= 1024) civilEpochCache.delete(civilEpochCache.keys().next().value!);
      civilEpochCache.set(wallClock, instant);
      return instant;
    }
    instant += correction;
  }
  // A custom clock in the skipped spring-forward hour has no real instant.
  return Number.NaN;
}

/** Exchange-local midnight, including a 23/25-hour DST transition day. */
export function exchangeMidnightMs(timestampMs: number): number {
  return exchangeCivilEpoch(exchangeDateStamp(timestampMs));
}

function clampMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(24 * 60, Math.max(0, Math.round(value)));
}

/**
 * The windows a profile should be built from.
 *
 * Returns one segment for `filter`, several for `splitted` / `triple`, and an
 * empty array for `none` — the caller reads empty as "take every execution",
 * which keeps the untouched path allocation-free.
 */
export function resolveSessionSegments(
  startMs: number,
  endMs: number,
  config: SessionFilterConfig = DEFAULT_SESSION_FILTER,
): SessionSegment[] {
  if (config.mode === "none") return [];
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

  // Walk every exchange day the range touches, one day before the start so a
  // window that began the previous evening is still produced.
  const days: number[] = [];
  const firstDate = exchangeDateStamp(startMs) - DAY_MS;
  const finalDate = exchangeDateStamp(endMs);
  // Walk calendar dates, not 24 elapsed hours from a midnight. Otherwise every
  // window after a clock change is shifted by an hour within the same request.
  for (let date = firstDate; date <= finalDate; date += DAY_MS) {
    days.push(date);
  }

  const spans: { id: SessionSegment["id"]; label: string; start: number; end: number }[] =
    config.mode === "triple"
      ? DESK_SESSION_SEGMENTS
      : config.window === "custom"
        ? [{
          id: "custom",
          label: "Custom",
          start: clampMinutes(config.customStartMinutes, RTH_START_MINUTES),
          // A window whose end is at or before its start runs past midnight.
          end: clampMinutes(config.customEndMinutes, RTH_END_MINUTES)
            <= clampMinutes(config.customStartMinutes, RTH_START_MINUTES)
            ? clampMinutes(config.customEndMinutes, RTH_END_MINUTES) + 24 * 60
            : clampMinutes(config.customEndMinutes, RTH_END_MINUTES),
        }]
        : config.window === "eth"
          // Overnight: the Globex open through to the cash open.
          ? [{ id: "eth", label: "Overnight", start: 17 * 60, end: RTH_START_MINUTES + 24 * 60 }]
          : [{ id: "rth", label: "RTH", start: RTH_START_MINUTES, end: RTH_END_MINUTES }];

  const segments: SessionSegment[] = [];
  for (const date of days) {
    // Each named split belongs to the CME day opened on this calendar date.
    // Friday/Saturday evenings do not open sessions. Emitting them lets a
    // "last trading date" fallback fold empty weekend windows onto Friday.
    const weekday = new Date(date).getUTCDay();
    if (config.mode === "triple" && (weekday === 5 || weekday === 6)) continue;
    for (const span of spans) {
      // The Asia handover is Tokyo's fixed 09:00, not a Chicago clock that
      // would drift by an hour every US winter. `date` encodes the Chicago
      // opening calendar date; next UTC midnight is that day's Tokyo open.
      const asiaOpen = date + DAY_MS;
      const segmentStart = span.id === "asia" ? asiaOpen : exchangeCivilEpoch(date, span.start);
      const segmentEnd = span.id === "globex" ? asiaOpen : exchangeCivilEpoch(date, span.end);
      if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd)) continue;
      if (segmentEnd <= startMs || segmentStart >= endMs) continue;
      segments.push({
        id: span.id,
        label: span.label,
        startMs: Math.max(segmentStart, startMs),
        endMs: Math.min(segmentEnd, endMs),
      });
    }
  }
  segments.sort((left, right) => left.startMs - right.startMs);

  // `splitted` and `triple` keep every segment separate; `filter` merges them
  // into one profile that simply excludes everything outside the window.
  return segments;
}

/** True when an execution belongs to any resolved segment. */
export function isWithinSessionSegments(timestampMs: number, segments: readonly SessionSegment[]): boolean {
  if (!segments.length) return true;
  for (const segment of segments) {
    if (timestampMs >= segment.startMs && timestampMs < segment.endMs) return true;
  }
  return false;
}

/**
 * The trading date a segment reports against.
 *
 * With `useEndSessionAsStartDay` a window that finishes after midnight is
 * attributed to the date it finished on, so an Asia profile that opened at
 * 17:00 on Monday reports as Tuesday — the convention a futures desk uses.
 */
const sessionDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export function sessionTradingDate(segment: SessionSegment, useEndSessionAsStartDay: boolean): string {
  const reference = useEndSessionAsStartDay ? segment.endMs - 1 : segment.startMs;
  return sessionDateFormatter.format(new Date(reference));
}

/**
 * The one session a moment is IN, for a readout that must name exactly one.
 *
 * Separate from the profile windows above on purpose. Those deliberately
 * overlap - London runs past the cash open to 10:00 because DeepChart's Europe
 * does, and a profile drawn over that window is correct. A clock cannot
 * overlap: at 09:00 the desk is in New York, not in both.
 *
 * The boundaries are the same ones, so the two can never drift into disagreeing
 * about when a session starts; only London's close differs, and it differs for
 * a stated reason.
 */
const DESK_CLOCK_SEGMENTS = DESK_SESSION_SEGMENTS.map(({ id, label, start, end }) => ({
  id, label, start,
  // The clock hands over to New York at its open, rather than overlapping it.
  end: id === "london" ? RTH_START_MINUTES + 24 * 60 : end,
}));

const chicagoWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CHICAGO_TIME_ZONE,
  weekday: "short",
});

export type DeskSession = {
  id: SessionSegment["id"];
  label: string;
  /** Minutes until this session ends, for a readout that counts down. */
  minutesRemaining: number;
};

/**
 * Which desk session a moment falls in, or null when the market is shut.
 *
 * Null is a real answer and has to stay one: between the 15:00 close and the
 * 17:00 open, and across the weekend, there is no session, and naming one
 * would be worse than naming none.
 */
export function currentDeskSession(timestampMs: number = Date.now()): DeskSession | null {
  if (!Number.isFinite(timestampMs)) return null;
  const minute = exchangeMinuteOfDay(timestampMs);
  const weekday = chicagoWeekdayFormatter.format(new Date(timestampMs));
  // The CME week runs Sunday 17:00 to Friday 15:00, Chicago.
  if (weekday === "Sat") return null;
  if (weekday === "Sun" && minute < 17 * 60) return null;
  if (weekday === "Fri" && minute >= 15 * 60) return null;
  /*
   * Wound onto the trading day's own frame, which opens at 17:00. Anything
   * before that belongs to the day that opened the previous evening, so it is
   * carried past midnight rather than compared against a calendar day.
   */
  const offset = minute >= 17 * 60 ? minute : minute + 24 * 60;
  // Convert Tokyo's UTC-midnight handover to the current Chicago clock. Clock
  // changes occur outside the active futures week; this also names Sunday
  // evening correctly immediately after a US daylight-saving transition.
  const utcMinute = new Date(timestampMs).getUTCHours() * 60 + new Date(timestampMs).getUTCMinutes();
  const asiaStart = (minute - utcMinute + 24 * 60) % (24 * 60);
  const clockSegments = DESK_CLOCK_SEGMENTS.map((entry) => ({
    ...entry,
    start: entry.id === "asia" ? asiaStart : entry.start,
    end: entry.id === "globex" ? asiaStart : entry.end,
  }));
  const segment = clockSegments.find((entry) => offset >= entry.start && offset < entry.end);
  if (!segment) return null;
  return { id: segment.id, label: segment.label, minutesRemaining: segment.end - offset };
}

/**
 * The session windows a study is currently asking for, or null when it wants
 * one profile over the whole day.
 *
 * A daily profile's identity includes its SESSION, not just its trading date:
 * a split day produces one profile per window, all sharing that date. Without
 * this the retention filter kept any profile matching the symbol, grouping and
 * date, so unticking a session left its profile on the chart - turning
 * everything off except Asia still drew Globex, London and New York until
 * something else happened to evict them. Switching Filter time did the same,
 * keeping the RTH profile after a move to Overnight.
 */
export function requestedSessionIds(settings: Record<string, unknown>): Set<string> | null {
  const requestedMode = String(settings.filterMode ?? "none").toLowerCase();
  const mode = (["none", "filter", "splitted", "triple"].includes(requestedMode)
    ? requestedMode
    : "none") as SessionFilterMode;
  // "none" draws one profile over the whole day and carries no session id.
  if (mode === "none") return null;
  if (mode === "triple") {
    return new Set(DESK_SESSIONS
      .filter(({ settingsKey }) => settings[settingsKey] !== false)
      .map(({ id }) => id));
  }
  const requestedWindow = String(settings.filterTime ?? "rth").toLowerCase();
  return new Set([
    (["rth", "eth", "custom"].includes(requestedWindow) ? requestedWindow : "rth"),
  ]);
}

/**
 * Whether a profile already on the chart still belongs there.
 *
 * A profile built for a window the study no longer asks for is stale however
 * well it matches everything else, and a leftover SPLIT profile is equally
 * stale once the split is turned off - the day is meant to be one profile
 * again.
 */
export function profileMatchesRequestedSessions(
  profileSessionId: string | undefined,
  requested: Set<string> | null,
): boolean {
  if (!requested) return !profileSessionId;
  return requested.has(profileSessionId ?? "");
}
