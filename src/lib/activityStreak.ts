export type ActivityStreakState = "active" | "weekend" | "recovery" | "expired" | "inactive";

export const ACTIVITY_STREAK_TIME_ZONE = "America/New_York";
export const ACTIVITY_STREAK_RESET_SECONDS = 48 * 60 * 60;

export type ActivityStreakLifecycle = {
  state: ActivityStreakState;
  effectiveStreak: number;
  weekdayElapsedSeconds: number;
  secondsUntilRisk: number;
  secondsUntilReset: number;
  weekend: boolean;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function safeTimeZone(value: string | null | undefined) {
  const candidate = value?.trim() || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return "UTC";
  }
}

function formatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const next = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  formatterCache.set(timeZone, next);
  return next;
}

function zonedParts(timestamp: number, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(timestamp);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(values.weekday) + 1;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekday || 1,
  };
}

function localMidnightUtc(year: number, month: number, day: number, timeZone: string) {
  const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(guess, timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const difference = desired - represented;
    guess += difference;
    if (Math.abs(difference) < 1_000) break;
  }
  return guess;
}

function addLocalDays(year: number, month: number, day: number, amount: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function activityDateKey(
  timestamp: string | number | Date = Date.now(),
  requestedTimeZone = ACTIVITY_STREAK_TIME_ZONE,
) {
  const value = timestamp instanceof Date
    ? timestamp.getTime()
    : typeof timestamp === "number"
      ? timestamp
      : Date.parse(timestamp);
  const parts = zonedParts(Number.isFinite(value) ? value : Date.now(), safeTimeZone(requestedTimeZone));
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function calculateActivityStreakUpdate({
  currentStreak,
  longestStreak,
  lastActivityDate,
  lastSeenAt,
  now = Date.now(),
}: {
  currentStreak: number | null | undefined;
  longestStreak: number | null | undefined;
  lastActivityDate: string | null | undefined;
  lastSeenAt: string | null | undefined;
  now?: number;
}) {
  const storedCurrent = Number.isFinite(Number(currentStreak)) ? Math.max(0, Math.floor(Number(currentStreak))) : 0;
  const storedLongest = Number.isFinite(Number(longestStreak)) ? Math.max(0, Math.floor(Number(longestStreak))) : 0;
  const activityDate = activityDateKey(now);
  const previousDate = /^\d{4}-\d{2}-\d{2}$/.test(lastActivityDate ?? "") ? String(lastActivityDate) : "";
  const alreadyCounted = previousDate === activityDate && storedCurrent > 0;
  const parsedLastSeen = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
  const elapsedWeekdaySeconds = Number.isFinite(parsedLastSeen)
    ? weekdayElapsedSeconds(parsedLastSeen, now, ACTIVITY_STREAK_TIME_ZONE)
    : 0;
  const reset = Boolean(previousDate && !alreadyCounted && elapsedWeekdaySeconds > ACTIVITY_STREAK_RESET_SECONDS);
  const nextCurrent = alreadyCounted
    ? storedCurrent
    : reset || storedCurrent === 0
      ? 1
      : storedCurrent + 1;

  return {
    currentStreak: nextCurrent,
    longestStreak: Math.max(storedLongest, nextCurrent),
    lastActivityDate: activityDate,
    activityDate,
    counted: !alreadyCounted,
    reset,
    weekend: [6, 7].includes(zonedParts(now, ACTIVITY_STREAK_TIME_ZONE).weekday),
    weekdayElapsedSeconds: elapsedWeekdaySeconds,
    lastSeenAt: new Date(now).toISOString(),
    timeZone: ACTIVITY_STREAK_TIME_ZONE,
  };
}

export function weekdayElapsedSeconds(
  startedAt: string | number | Date,
  endedAt: string | number | Date = Date.now(),
  requestedTimeZone = "UTC",
) {
  const start = startedAt instanceof Date ? startedAt.getTime() : typeof startedAt === "number" ? startedAt : Date.parse(startedAt);
  const end = endedAt instanceof Date ? endedAt.getTime() : typeof endedAt === "number" ? endedAt : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const timeZone = safeTimeZone(requestedTimeZone);
  let cursor = zonedParts(start, timeZone);
  let total = 0;
  for (let index = 0; index < 16 && total <= 172_801; index += 1) {
    const nextDate = addLocalDays(cursor.year, cursor.month, cursor.day, 1);
    const dayStart = localMidnightUtc(cursor.year, cursor.month, cursor.day, timeZone);
    const dayEnd = localMidnightUtc(nextDate.year, nextDate.month, nextDate.day, timeZone);
    const segmentStart = Math.max(start, dayStart);
    const segmentEnd = Math.min(end, dayEnd);
    if (cursor.weekday >= 1 && cursor.weekday <= 5 && segmentEnd > segmentStart) {
      total += Math.floor((segmentEnd - segmentStart) / 1_000);
    }
    if (dayEnd >= end) break;
    cursor = zonedParts(dayEnd + 1_000, timeZone);
  }
  return Math.max(0, total);
}

export function activityStreakLifecycle({
  streak,
  lastSeenAt,
  timeZone,
  now = Date.now(),
}: {
  streak: number | null | undefined;
  lastSeenAt: string | null | undefined;
  timeZone?: string | null;
  now?: number;
}): ActivityStreakLifecycle {
  const storedStreak = Number.isFinite(Number(streak)) ? Math.max(0, Math.floor(Number(streak))) : 0;
  const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : Number.NaN;
  // Streaks use one platform-wide trading day. A profile or chart timezone
  // must never change when a user's activity day rolls over.
  const zone = ACTIVITY_STREAK_TIME_ZONE;
  const currentParts = zonedParts(now, zone);
  const weekend = currentParts.weekday === 6 || currentParts.weekday === 7;
  if (!storedStreak || !Number.isFinite(lastSeen)) {
    return { state: "inactive", effectiveStreak: storedStreak, weekdayElapsedSeconds: 0, secondsUntilRisk: 0, secondsUntilReset: 0, weekend };
  }
  const elapsed = weekdayElapsedSeconds(lastSeen, now, zone);
  if (elapsed > ACTIVITY_STREAK_RESET_SECONDS) {
    return { state: "expired", effectiveStreak: 0, weekdayElapsedSeconds: elapsed, secondsUntilRisk: 0, secondsUntilReset: 0, weekend };
  }
  if (elapsed >= 86_400) {
    return { state: "recovery", effectiveStreak: storedStreak, weekdayElapsedSeconds: elapsed, secondsUntilRisk: 0, secondsUntilReset: Math.max(0, ACTIVITY_STREAK_RESET_SECONDS - elapsed), weekend };
  }
  return {
    state: weekend ? "weekend" : "active",
    effectiveStreak: storedStreak,
    weekdayElapsedSeconds: elapsed,
    secondsUntilRisk: Math.max(0, 86_400 - elapsed),
    secondsUntilReset: Math.max(0, ACTIVITY_STREAK_RESET_SECONDS - elapsed),
    weekend,
  };
}
