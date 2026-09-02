/**
 * Session windowing for volume profiles — DeepChart's Filter/Split Time tab.
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
 * Asia, London and New York carry DeepChart's own boundaries, read on
 * 2026-08-31 out of its Sessions Marker defaults (Asian 15:00-03:00, Europe
 * 03:00-11:00, Usa 09:30-16:00 - New York time, which its 09:30 cash open
 * fixes beyond doubt) and converted to Chicago. A profile is only comparable
 * to DeepChart's if it covers the same tape, and ours previously did not: our
 * Asia opened two hours after theirs and our London and New York both closed
 * early. Two different windows over one tape give two different value areas,
 * which is why the mismatch read as a constant offset rather than drift.
 *
 * A Triple split is exactly DeepChart's three windows. It used to introduce a
 * fourth, KwantDesk-only Globex profile and shorten Asia to start at 19:00.
 * Selecting "Asia only" therefore measured a different tape from DeepChart
 * before any grouping or value-area maths even ran. Product-specific session
 * clocks may still name Globex separately; the DeepChart-compatible volume
 * profile must not.
 *
 * London and New York still overlap between 08:30 and 10:00, which is
 * DeepChart's own behaviour and is fine: their starts differ, so the chain
 * resolves them.
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
  // DeepChart "Asian", 15:00 -> 03:00 New York.
  { id: "asia", label: "Asia", settingsKey: "sessionAsiaEnabled", start: 17 * 60, end: 26 * 60 },
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

/** Exchange-local midnight at or before an instant, as epoch ms. */
export function exchangeMidnightMs(timestampMs: number): number {
  return timestampMs - exchangeMinuteOfDay(timestampMs) * 60_000
    - (new Date(timestampMs).getSeconds() * 1000 + new Date(timestampMs).getMilliseconds());
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
  const firstMidnight = exchangeMidnightMs(startMs) - 24 * 60 * 60_000;
  for (let midnight = firstMidnight; midnight <= endMs; midnight += 24 * 60 * 60_000) {
    days.push(midnight);
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
  for (const midnight of days) {
    for (const span of spans) {
      const segmentStart = midnight + span.start * 60_000;
      const segmentEnd = midnight + span.end * 60_000;
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
export function sessionTradingDate(segment: SessionSegment, useEndSessionAsStartDay: boolean): string {
  const reference = useEndSessionAsStartDay ? segment.endMs - 1 : segment.startMs;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CHICAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(reference));
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
const DESK_CLOCK_SEGMENTS: { id: SessionSegment["id"]; label: string; start: number; end: number }[] = [
  { id: "globex", label: "Globex", start: 17 * 60, end: 19 * 60 },
  { id: "asia", label: "Asia", start: 19 * 60, end: 26 * 60 },
  // Hands over at the cash open rather than at DeepChart's 10:00, because from
  // 08:30 the desk is trading New York.
  { id: "london", label: "London", start: 26 * 60, end: RTH_START_MINUTES + 24 * 60 },
  { id: "newyork", label: "New York", start: RTH_START_MINUTES + 24 * 60, end: 15 * 60 + 24 * 60 },
];

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
  const segment = DESK_CLOCK_SEGMENTS.find((entry) => offset >= entry.start && offset < entry.end);
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
