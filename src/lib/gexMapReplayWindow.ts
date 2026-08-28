/**
 * Which part of the day a replay covers.
 *
 * The provider records frames across the whole trading date, so a replay opened
 * on it starts in the overnight and spends most of its length before the cash
 * open. Scrubbing through hours of pre-market to reach the session is not what
 * "replay the day" means, so the New York session is the default and the rest
 * are there for when a trader wants them.
 */
export const GEX_MAP_REPLAY_WINDOWS = [
  { id: "rth", label: "NY OPEN", title: "09:30 - 16:00 ET", startMinutes: 9 * 60 + 30, endMinutes: 16 * 60 },
  { id: "power", label: "POWER", title: "15:00 - 16:00 ET", startMinutes: 15 * 60, endMinutes: 16 * 60 },
  { id: "pre", label: "PRE", title: "04:00 - 09:30 ET", startMinutes: 4 * 60, endMinutes: 9 * 60 + 30 },
  { id: "all", label: "FULL", title: "Every recorded frame", startMinutes: 0, endMinutes: 24 * 60 },
] as const;

export type GexMapReplayWindowId = typeof GEX_MAP_REPLAY_WINDOWS[number]["id"];

const easternClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Minutes since New York midnight, so a window can be compared without
 * assuming the viewer's own clock or the exchange's UTC offset on the day.
 */
export function easternMinutesOfDay(timestampMs: number): number {
  const parts = easternClock.formatToParts(timestampMs);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** The frames inside a window, or every frame when the window is the day. */
export function framesInReplayWindow(timestamps: readonly number[], windowId: GexMapReplayWindowId): number[] {
  const window = GEX_MAP_REPLAY_WINDOWS.find((entry) => entry.id === windowId);
  if (!window || window.id === "all") return [...timestamps];
  const inside = timestamps.filter((timestamp) => {
    const minutes = easternMinutesOfDay(timestamp);
    return minutes >= window.startMinutes && minutes < window.endMinutes;
  });
  /*
   * A window the recording never reached would leave the scrubber empty and
   * looking broken. Everything is better than nothing, and the control says
   * which window is selected, so the trader can see why.
   */
  return inside.length ? inside : [...timestamps];
}
