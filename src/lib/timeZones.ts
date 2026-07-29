const LEGACY_TIME_ZONES: Record<string, string> = {
  "(UTC-5) New York": "America/New_York",
  "(UTC+0) London": "Europe/London",
  "(UTC+3) Dubai": "Asia/Dubai",
  "(UTC+8) Singapore": "Asia/Singapore",
  "(UTC+10) Sydney": "Australia/Sydney",
};

const FALLBACK_TIME_ZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Halifax",
  "America/Sao_Paulo",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export type TimeZoneOption = {
  value: string;
  label: string;
  offsetMinutes: number;
  searchText: string;
};

function supportedTimeZones() {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    }
  ).supportedValuesOf;

  try {
    const zones = supportedValuesOf?.("timeZone") ?? [];
    return Array.from(new Set(["UTC", ...zones, ...FALLBACK_TIME_ZONES]));
  } catch {
    return FALLBACK_TIME_ZONES;
  }
}

export function normalizeTimeZone(value?: string | null) {
  const candidate = LEGACY_TIME_ZONES[value ?? ""] ?? value ?? "";
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "UTC";
  }
}

export function browserTimeZone() {
  if (typeof window === "undefined") return "UTC";
  return normalizeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function timeZoneOffsetMinutes(timeZone: string, date = new Date()) {
  const normalized = normalizeTimeZone(timeZone);
  if (normalized === "UTC") return 0;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalized,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((representedAsUtc - date.getTime()) / 60_000);
}

export function formatUtcOffset(offsetMinutes: number) {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes >= 0 ? "+" : "−";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

export function timeZoneCity(timeZone: string) {
  const normalized = normalizeTimeZone(timeZone);
  if (normalized === "UTC") return "UTC";
  return normalized.split("/").at(-1)?.replaceAll("_", " ") ?? normalized;
}

export function compactTimeZoneLabel(timeZone: string, date = new Date()) {
  const normalized = normalizeTimeZone(timeZone);
  return `${formatUtcOffset(timeZoneOffsetMinutes(normalized, date))} · ${timeZoneCity(normalized)}`;
}

export function timeZoneOptions(date = new Date()): TimeZoneOption[] {
  return supportedTimeZones()
    .map((value) => {
      const normalized = normalizeTimeZone(value);
      const offsetMinutes = timeZoneOffsetMinutes(normalized, date);
      const city = timeZoneCity(normalized);
      const region = normalized === "UTC" ? "Universal Time" : normalized.replaceAll("_", " ");
      const label = `${formatUtcOffset(offsetMinutes)} · ${city}`;
      return {
        value: normalized,
        label,
        offsetMinutes,
        searchText: `${label} ${region}`.toLowerCase(),
      };
    })
    .filter((option, index, rows) =>
      rows.findIndex((candidate) => candidate.value === option.value) === index)
    .sort((left, right) =>
      left.offsetMinutes - right.offsetMinutes
      || left.label.localeCompare(right.label));
}
