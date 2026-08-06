function chicagoParts(nowMs) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function priorBusinessDate(dateIso) {
  const value = new Date(`${dateIso}T12:00:00.000Z`);
  do value.setUTCDate(value.getUTCDate() - 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

export function chicagoWallClockToUtc(dateIso, hour = 17, minute = 15) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = chicagoParts(guess);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
    );
    guess += target - represented;
  }
  return guess;
}

export function chicagoTradingClock(nowMs) {
  const parts = chicagoParts(nowMs);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  const weekday = parts.weekday;
  const weekendClosed = weekday === "Sat"
    || (weekday === "Fri" && minutes >= 16 * 60)
    || (weekday === "Sun" && minutes < 17 * 60);
  const maintenanceClosed = !weekendClosed && minutes >= 16 * 60 && minutes < 17 * 60;
  const marketClosed = weekendClosed || maintenanceClosed;
  let expectedSettleDate = date;
  if (weekday === "Sat" || weekday === "Sun" || minutes < 17 * 60 + 15) {
    expectedSettleDate = priorBusinessDate(date);
  }
  return { date, minutes, weekday, marketClosed, expectedSettleDate };
}
