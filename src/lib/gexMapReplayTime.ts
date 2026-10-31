import { newYorkSessionTimestamp } from "@/lib/gexVueReplay";
import { GEX_MAP_REPLAY_WINDOWS, type GexMapReplayWindowId } from "@/lib/gexMapReplayWindow";
import { compactTimeZoneLabel, normalizeTimeZone } from "@/lib/timeZones";

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
