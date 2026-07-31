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
