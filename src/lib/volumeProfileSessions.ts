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
 * DeepChart's Asian window opens at 14:00 Chicago, an hour before the cash
 * close, so on its own terms it also swallows the last hour of the previous
 * day session. We start Asia at the 17:00 bell instead: the earlier hour
 * belongs to the day that is still trading, and no desk reads it as Asia.
 *
 * Globex is ours - DeepChart has no equivalent, and no such window exists
 * anywhere in its assembly. It is the evening between the CME open and Tokyo:
 * 09:00 JST is 19:00 Chicago. It now overlaps the front of Asia the same way
 * DeepChart's own Europe and Usa overlap, which is what lets the two be read
 * against each other instead of one hiding inside the other.
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
  // 17:00 -> 19:00 Chicago. Ours; the CME open through to Tokyo's.
  { id: "globex", label: "Globex", settingsKey: "sessionGlobexEnabled", start: 17 * 60, end: 19 * 60 },
  // DeepChart "Asian", 15:00 -> 03:00 New York, started at the CME bell instead.
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
