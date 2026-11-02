export const DAILY_TPO_SESSION_PRESETS = [
  {
    id: "rth",
    label: "RTH only",
    description: "09:30-16:00 New York",
    settings: {
      timezone: "America/New_York",
      dailyStartTime: "09:30:00",
      dailyEndMode: "explicit-time",
      dailyEndTime: "16:00:00",
      enabledWeekdays: "1,2,3,4,5",
    },
  },
  {
    id: "globex",
    label: "Globex open",
    description: "18:00-17:00 New York",
    settings: {
      timezone: "America/New_York",
      dailyStartTime: "18:00:00",
      dailyEndMode: "explicit-time",
      dailyEndTime: "17:00:00",
      enabledWeekdays: "0,1,2,3,4",
    },
  },
  {
    id: "new-york",
    label: "New York open",
    description: "09:30 to next NY open",
    settings: {
      timezone: "America/New_York",
      dailyStartTime: "09:30:00",
      dailyEndMode: "next-daily-start",
      dailyEndTime: "09:30:00",
      enabledWeekdays: "1,2,3,4,5",
    },
  },
  {
    id: "london",
    label: "London open",
    description: "08:00 to next London open",
    settings: {
      timezone: "Europe/London",
      dailyStartTime: "08:00:00",
      dailyEndMode: "next-daily-start",
      dailyEndTime: "08:00:00",
      enabledWeekdays: "1,2,3,4,5",
    },
  },
  {
    id: "tokyo",
    label: "Tokyo open",
    description: "09:00 to next Tokyo open",
    settings: {
      timezone: "Asia/Tokyo",
      dailyStartTime: "09:00:00",
      dailyEndMode: "next-daily-start",
      dailyEndTime: "09:00:00",
      enabledWeekdays: "1,2,3,4,5",
    },
  },
  {
    id: "sydney",
    label: "Sydney open",
    description: "10:00 to next Sydney open",
    settings: {
      timezone: "Australia/Sydney",
      dailyStartTime: "10:00:00",
      dailyEndMode: "next-daily-start",
      dailyEndTime: "10:00:00",
      enabledWeekdays: "1,2,3,4,5",
    },
  },
] as const;

export function selectedTpoQuickSessions(settings: Record<string, unknown> | undefined): string[] {
  if (typeof settings?.quickSessions === "string") {
    const selected = new Set(settings.quickSessions.split(","));
    return DAILY_TPO_SESSION_PRESETS.filter(preset => selected.has(preset.id)).map(preset => preset.id);
  }
  // Preserve legacy single-session presets when loading saved workspaces.
  return DAILY_TPO_SESSION_PRESETS.filter(preset => Object.entries(preset.settings)
    .every(([key, value]) => String(settings?.[key] ?? "") === String(value))).map(preset => preset.id);
}

export function toggleTpoQuickSession(settings: Record<string, unknown> | undefined, id: string): string {
  const selected = new Set(selectedTpoQuickSessions(settings));
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  return DAILY_TPO_SESSION_PRESETS.filter(preset => selected.has(preset.id)).map(preset => preset.id).join(",");
}
