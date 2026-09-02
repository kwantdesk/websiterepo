const SESSION_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** The protected US options window, including ten minutes either side. */
export function optionsSessionOpen(nowMs = Date.now()) {
  const parts = Object.fromEntries(
    SESSION_CLOCK.formatToParts(new Date(nowMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  const minutes = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
  return minutes >= 9 * 60 + 20 && minutes <= 16 * 60 + 20;
}
