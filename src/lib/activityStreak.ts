export type ActivityStreakState = "active" | "weekend" | "recovery" | "expired" | "inactive";

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
  const zone = safeTimeZone(timeZone);
  const currentParts = zonedParts(now, zone);
  const weekend = currentParts.weekday === 6 || currentParts.weekday === 7;
  if (!storedStreak || !Number.isFinite(lastSeen)) {
    return { state: "inactive", effectiveStreak: storedStreak, weekdayElapsedSeconds: 0, secondsUntilRisk: 0, secondsUntilReset: 0, weekend };
  }
  const elapsed = weekdayElapsedSeconds(lastSeen, now, zone);
  if (elapsed >= 172_800) {
    return { state: "expired", effectiveStreak: 0, weekdayElapsedSeconds: elapsed, secondsUntilRisk: 0, secondsUntilReset: 0, weekend };
  }
  if (elapsed >= 86_400) {
    return { state: "recovery", effectiveStreak: 0, weekdayElapsedSeconds: elapsed, secondsUntilRisk: 0, secondsUntilReset: Math.max(0, 172_800 - elapsed), weekend };
  }
  return {
    state: weekend ? "weekend" : "active",
    effectiveStreak: storedStreak,
    weekdayElapsedSeconds: elapsed,
    secondsUntilRisk: Math.max(0, 86_400 - elapsed),
    secondsUntilReset: Math.max(0, 172_800 - elapsed),
    weekend,
  };
}
