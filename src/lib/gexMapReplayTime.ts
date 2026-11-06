import { GEX_VUE_REPLAY_OPEN_MINUTE, newYorkSessionTimestamp } from "@/lib/gexVueReplay";
import { GEX_MAP_REPLAY_WINDOWS, type GexMapReplayWindowId } from "@/lib/gexMapReplayWindow";
import { compactTimeZoneLabel, normalizeTimeZone } from "@/lib/timeZones";

/** A date in the replay calendar is the local date of the US cash open. */
export function gexReplayCalendar(timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeTimeZone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
  });
  function localOpenDate(sessionDate: string) {
    if (!sessionDate) return "";
    const parts = formatter.formatToParts(newYorkSessionTimestamp(sessionDate, GEX_VUE_REPLAY_OPEN_MINUTE));
    const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
    return `${read("year")}-${read("month")}-${read("day")}`;
  }
  function exchangeDate(localDate: string) {
    const midnight = Date.parse(`${localDate}T00:00:00Z`);
    if (!Number.isFinite(midnight)) return null;
    for (const offset of [0, -1, 1]) {
      const day = new Date(midnight + offset * 86_400_000);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      const candidate = day.toISOString().slice(0, 10);
      if (localOpenDate(candidate) === localDate) return candidate;
    }
    return null;
  }
  return { localOpenDate, exchangeDate };
}

/** Display-only conversion. Session keys, frame instants and filters stay in exchange time. */
export function gexMapReplayDisplay(timeZone: string) {
  const zone = normalizeTimeZone(timeZone);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const date = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "2-digit", year: "numeric" });
  const range = new Intl.DateTimeFormat("en-GB", { timeZone: zone, month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    clock: (timestamp: number) => `${clock.format(timestamp)} · ${compactTimeZoneLabel(zone, new Date(timestamp))}`,
    date: (timestamp: number) => date.format(timestamp),
    window: (id: GexMapReplayWindowId, sessionDate: string) => {
      const entry = GEX_MAP_REPLAY_WINDOWS.find(window => window.id === id)!;
      if (id === "all") return entry.title;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return `${entry.label} · New York session`;
      const start = newYorkSessionTimestamp(sessionDate, entry.startMinutes);
      const end = newYorkSessionTimestamp(sessionDate, entry.endMinutes);
      return `${range.format(start)} – ${range.format(end)} · ${compactTimeZoneLabel(zone, new Date(start))}`;
    },
  };
}
