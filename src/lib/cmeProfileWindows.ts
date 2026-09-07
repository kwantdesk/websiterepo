const CHICAGO_TIME_ZONE = "America/Chicago";

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

export type CmeProfileWindow = {
  start: number;
  end: number;
  label: string;
};

const chicagoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHICAGO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function chicagoParts(timestamp: number) {
  const parts = Object.fromEntries(
    chicagoFormatter
      .formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function localDayOfWeek(date: LocalDate) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function localDateLabel(date: LocalDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function parseLocalDateLabel(value: string): LocalDate | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return localDateLabel(date) === value ? date : null;
}

function timeZoneOffsetMinutes(timestamp: number) {
  const parts = chicagoParts(timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
  return Math.round((representedAsUtc - timestamp) / 60_000);
}

function chicagoEpoch(date: LocalDate, hour: number) {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, hour);
  const firstPass = utcGuess - timeZoneOffsetMinutes(utcGuess) * 60_000;
  return utcGuess - timeZoneOffsetMinutes(firstPass) * 60_000;
}

export function completedCmeDailyWindows(now: number) {
  const parts = chicagoParts(now);
  const localToday = { year: parts.year, month: parts.month, day: parts.day };
  const windows: CmeProfileWindow[] = [];
  for (let offset = 0; offset < 12 && windows.length < 6; offset += 1) {
    const endDate = addLocalDays(localToday, -offset);
    const dayOfWeek = localDayOfWeek(endDate);
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const end = chicagoEpoch(endDate, 16);
    if (end > now) continue;
    const startDate = addLocalDays(endDate, -1);
    windows.push({
      start: chicagoEpoch(startDate, 17),
      end,
      label: localDateLabel(endDate),
    });
  }
  return windows;
}

export function completedCmeWeeklyWindows(now: number) {
  const parts = chicagoParts(now);
  const localToday = { year: parts.year, month: parts.month, day: parts.day };
  const windows: CmeProfileWindow[] = [];
  for (let offset = 0; offset < 35 && windows.length < 3; offset += 1) {
    const endDate = addLocalDays(localToday, -offset);
    if (localDayOfWeek(endDate) !== 5) continue;
    const end = chicagoEpoch(endDate, 16);
    if (end > now) continue;
    const startDate = addLocalDays(endDate, -5);
    windows.push({
      start: chicagoEpoch(startDate, 17),
      end,
      label: `${localDateLabel(addLocalDays(endDate, -4))} / ${localDateLabel(endDate)}`,
    });
  }
  return windows;
}

export function nextCmeDailyCompletion(now: number) {
  const parts = chicagoParts(now);
  const localToday = { year: parts.year, month: parts.month, day: parts.day };
  for (let offset = 0; offset < 8; offset += 1) {
    const date = addLocalDays(localToday, offset);
    const dayOfWeek = localDayOfWeek(date);
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const close = chicagoEpoch(date, 16);
    if (close > now) return close;
  }
  return now + 24 * 60 * 60_000;
}

/**
 * The open of the trading week `now` falls in.
 *
 * A CME week runs Sunday 17:00 CT to Friday 16:00 CT, so the week's open is the
 * most recent Sunday's Globex open - and on a Sunday BEFORE 17:00 the new week
 * has not started yet, so the answer is still last Sunday.
 *
 * The weekly volume profile used to take "the last five trading dates the chart
 * happened to have loaded" instead. That is not a week: on a Tuesday it reached
 * back into the previous Thursday and Friday, and when a pane had only today's
 * candles - a short range, or history still restoring - it collapsed to exactly
 * today and the weekly profile mirrored the daily one.
 */
export type CmeWeekSelection = "rolling-five" | "current" | "previous";

/**
 * Five actual CME trading sessions, including the developing session when one
 * is open. `tradingDates` comes from the restored candle series and therefore
 * skips exchange holidays; the weekday fallback keeps the request useful while
 * chart history is still hydrating.
 */
export function rollingCmeTradingDayRange(
  now: number,
  tradingDates: readonly string[] = [],
  count = 5,
) {
  const wanted = Math.max(1, Math.min(20, Math.floor(count)));
  const parts = chicagoParts(now);
  const localToday = { year: parts.year, month: parts.month, day: parts.day };
  const byLabel = new Map<string, LocalDate>();
  for (const value of tradingDates) {
    const parsed = parseLocalDateLabel(value);
    if (parsed) byLabel.set(value, parsed);
  }
  // Include candidate sessions around the current date. A session belongs to
  // its weekday close and starts at 17:00 CT on the preceding calendar day.
  // Sunday evening therefore correctly adds Monday; Friday evening does not
  // invent a Saturday session.
  if (byLabel.size < wanted) {
    for (let offset = -24; offset <= 3; offset += 1) {
      const endDate = addLocalDays(localToday, offset);
      const day = localDayOfWeek(endDate);
      if (day === 0 || day === 6) continue;
      const start = chicagoEpoch(addLocalDays(endDate, -1), 17);
      if (start <= now) byLabel.set(localDateLabel(endDate), endDate);
    }
  }
  const selected = [...byLabel.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-wanted)
    .map(([, date]) => date);
  const earliest = selected[0] ?? localToday;
  const latest = selected.at(-1) ?? localToday;
  const latestClose = chicagoEpoch(latest, 16);
  return {
    startMs: chicagoEpoch(addLocalDays(earliest, -1), 17),
    endMs: latestClose <= now ? latestClose : null as number | null,
  };
}

/**
 * Which trading week a weekly profile covers.
 *
 * A weekly profile of the CURRENT week is only worth as much as the week has
 * run. On a Monday morning it is a few hours of tape wearing a weekly label,
 * and it stays that way until Wednesday or so - which is exactly when a trader
 * most wants last week's completed structure to lean on.
 *
 * "previous" returns the week that has actually finished, bounded at this
 * week's open so no part of the live week leaks into it. It is a complete,
 * settled profile rather than one that reshapes under you all day.
 */
export function cmeWeekRange(
  now: number,
  selection: CmeWeekSelection = "rolling-five",
  tradingDates: readonly string[] = [],
) {
  if (selection === "rolling-five") return rollingCmeTradingDayRange(now, tradingDates, 5);
  const thisWeekStart = currentCmeWeekStart(now);
  if (selection !== "previous") return { startMs: thisWeekStart, endMs: null as number | null };
  return {
    // One millisecond before this week's open lands inside the week before it.
    startMs: currentCmeWeekStart(thisWeekStart - 1),
    endMs: thisWeekStart,
  };
}

export function currentCmeWeekStart(now: number) {
  const parts = chicagoParts(now);
  let date = { year: parts.year, month: parts.month, day: parts.day };
  // Back to the most recent Sunday, today included.
  date = addLocalDays(date, -localDayOfWeek(date));
  const start = chicagoEpoch(date, 17);
  // Sunday before the open still belongs to the week that just finished.
  return start > now ? chicagoEpoch(addLocalDays(date, -7), 17) : start;
}
