const CHICAGO_TIME_ZONE = "America/Chicago";

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

function zonedParts(timestampMs) {
  const values = Object.fromEntries(
    chicagoFormatter
      .formatToParts(new Date(timestampMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function addCalendarDays(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function chicagoLocalToUtcMs(date, hour) {
  const [year, month, day] = date.split("-").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let candidate = desiredAsUtc;

  // Resolve the Chicago UTC offset at the requested wall-clock instant. The
  // session boundary is 17:00, so it is never inside the DST overlap/gap.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(candidate);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = desiredAsUtc - actualAsUtc;
    candidate += adjustment;
    if (adjustment === 0) break;
  }
  return candidate;
}

export function chicagoTradingDate(timestampMs) {
  const parts = zonedParts(timestampMs);
  const localDate = [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
  return parts.hour < 17 ? addCalendarDays(localDate, -1) : localDate;
}

export function cmeSessionBounds(tradingDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tradingDate || ""))) return null;
  const nextDate = addCalendarDays(tradingDate, 1);
  return {
    tradingDate,
    startMs: chicagoLocalToUtcMs(tradingDate, 17),
    endMs: chicagoLocalToUtcMs(nextDate, 17),
  };
}

function positiveTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function resolveVolumeProfileRange(searchParams, nowMs = Date.now()) {
  const period = String(searchParams.get("period") || "daily").toLowerCase();
  const explicitStartMs = positiveTimestamp(searchParams.get("startMs"));
  const explicitEndMs = positiveTimestamp(searchParams.get("endMs"));
  const requestedTradingDate = String(searchParams.get("tradingDate") || "");
  const tradingDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedTradingDate)
    ? requestedTradingDate
    : period === "daily"
      ? chicagoTradingDate(nowMs)
      : null;
  const bounds = tradingDate ? cmeSessionBounds(tradingDate) : null;
  const startMs = explicitStartMs ?? bounds?.startMs ?? 0;
  const boundedNow = bounds && nowMs > bounds.startMs
    ? Math.min(nowMs, bounds.endMs)
    : bounds?.endMs;
  const endMs = explicitEndMs ?? boundedNow ?? nowMs;

  return {
    tradingDate,
    startMs,
    endMs: endMs > startMs ? endMs : nowMs,
  };
}
