export type AuctionGapCalendar = {
  timeZone: string;
  sessionOpenMinutes: number;
  rthStartMinutes: number;
  rthEndMinutes: number;
};
export type AuctionGapTimeSettings = {
  resetMode: "none" | "session-open" | "eth-and-rth-open";
  filterTime: "none" | "eth" | "rth" | "custom";
  customStartMinutes: number;
  customEndMinutes: number;
};
export type AuctionGapClockResult = { detect: boolean; resetKey: string | null };

const validMinute = (n: number) => Number.isInteger(n) && n >= 0 && n < 1440;
const inWindow = (minute: number, start: number, end: number) => start === end
  || (start < end ? minute >= start && minute < end : minute >= start || minute < end);

/** Instrument calendar is mandatory: no implicit CME mapping for cash charts.
 * Call per source execution BEFORE detection-row aggregation, not once at a
 * chart bar's open. A time/range/volume bar may span several filter boundaries.
 * Unfiltered rows must remain available separately for later retest evidence.
 */
export class AuctionGapSessionClock {
  private readonly formatter: Intl.DateTimeFormat;
  private readonly calendar: AuctionGapCalendar;
  private readonly settings: AuctionGapTimeSettings;
  private readonly cache = new Map<number, AuctionGapClockResult>();

  constructor(calendar: AuctionGapCalendar, settings: AuctionGapTimeSettings) {
    if (![calendar.sessionOpenMinutes, calendar.rthStartMinutes, calendar.rthEndMinutes,
      settings.customStartMinutes, settings.customEndMinutes].every(validMinute)
      || !["none", "session-open", "eth-and-rth-open"].includes(settings.resetMode)
      || !["none", "eth", "rth", "custom"].includes(settings.filterTime)) throw new Error("Invalid auction-gap calendar/settings");
    this.calendar = { ...calendar };
    this.settings = { ...settings };
    this.formatter = new Intl.DateTimeFormat("en-CA", { timeZone: calendar.timeZone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }

  classify(timestamp: number): AuctionGapClockResult | null {
    if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) return null;
    const key = Math.floor(timestamp / 60000);
    const cached = this.cache.get(key);
    if (cached) return { ...cached };
    const parts = Object.fromEntries(this.formatter.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    const { calendar, settings } = this;
    const rth = inWindow(minute, calendar.rthStartMinutes, calendar.rthEndMinutes);
    const detect = settings.filterTime === "none" || (settings.filterTime === "rth" && rth)
      || (settings.filterTime === "eth" && !rth)
      || (settings.filterTime === "custom" && inWindow(minute, settings.customStartMinutes, settings.customEndMinutes));
    let resetKey: string | null = null;
    if (settings.resetMode !== "none") {
      // Civil date arithmetic, NOT timestamp minus 24h across DST changes.
      const date = new Date(0);
      date.setUTCFullYear(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
      date.setUTCHours(0, 0, 0, 0);
      if (minute < calendar.sessionOpenMinutes) date.setUTCDate(date.getUTCDate() - 1);
      resetKey = date.toISOString().slice(0, 10);
      if (settings.resetMode === "eth-and-rth-open") {
        const elapsed = (minute - calendar.sessionOpenMinutes + 1440) % 1440;
        const rthOffset = (calendar.rthStartMinutes - calendar.sessionOpenMinutes + 1440) % 1440;
        resetKey += elapsed >= rthOffset ? ":rth-open" : ":session-open";
      }
    }
    const result = { detect, resetKey };
    if (this.cache.size >= 2048) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, result);
    return { ...result };
  }
}
