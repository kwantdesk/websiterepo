import type { Candle } from "@/lib/backtester";

export const SESSION_IMBALANCE_SETTINGS_VERSION = 1;

export const SESSION_IMBALANCE_DEFAULTS = {
  numberOfMinutes: 60,
  useCustomStartTime: false,
  customStartTime: "17:00",
  numberOfDays: 0,
  plotOnceEnded: false,
  showHigh: true,
  showLow: true,
  showMid: true,
  level50Enabled: true,
  level100Enabled: true,
  showLabels: true,
  useThemeColors: true,
  highColor: "#22C55E",
  lowColor: "#EF4444",
  midColor: "#38BDF8",
  level50Color: "#F59E0B",
  level100Color: "#A78BFA",
  lineWidth: 1,
  lineStyle: "solid",
  textSize: 10,
  textAlignment: "right",
  lineOpacity: 100,
  extendMode: "next-session",
  hhllEnableAlertPopup: false,
  hhllEnableAlertSound: false,
  level50EnableAlertPopup: false,
  level50EnableAlertSound: false,
  level100EnableAlertPopup: false,
  level100EnableAlertSound: false,
  sessionImbalanceSettingsVersion: SESSION_IMBALANCE_SETTINGS_VERSION,
} as const;

export type SessionImbalanceSettings = Record<string, number | string | boolean> & {
  numberOfMinutes: number;
  useCustomStartTime: boolean;
  customStartTime: string;
  numberOfDays: number;
  plotOnceEnded: boolean;
  showHigh: boolean;
  showLow: boolean;
  showMid: boolean;
  level50Enabled: boolean;
  level100Enabled: boolean;
  showLabels: boolean;
  useThemeColors: boolean;
  highColor: string;
  lowColor: string;
  midColor: string;
  level50Color: string;
  level100Color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  textSize: number;
  textAlignment: "left" | "right";
  lineOpacity: number;
  extendMode: "none" | "next-session";
};

export type SessionImbalanceRole = "high" | "low" | "mid" | "upper50" | "lower50" | "upper100" | "lower100";

export type SessionImbalanceLevel = {
  id: string;
  role: SessionImbalanceRole;
  sessionKey: string;
  price: number;
  startTimestamp: number;
  endTimestamp: number;
  formationEndTimestamp: number;
  developing: boolean;
  label: string;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const chicagoPartsByMinute = new Map<number, ReturnType<typeof readChicagoParts>>();
const CHICAGO_PARTS_CACHE_LIMIT = 50_000;

function readChicagoParts(timestamp: number) {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: parts.weekday,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function chicagoParts(timestamp: number) {
  const minute = Math.floor(timestamp / 60_000);
  const cached = chicagoPartsByMinute.get(minute);
  if (cached) return cached;
  const resolved = readChicagoParts(timestamp);
  if (chicagoPartsByMinute.size >= CHICAGO_PARTS_CACHE_LIMIT) {
    const oldest = chicagoPartsByMinute.keys().next().value;
    if (oldest !== undefined) chicagoPartsByMinute.delete(oldest);
  }
  chicagoPartsByMinute.set(minute, resolved);
  return resolved;
}

function previousDateKey(date: string) {
  return new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

function parseClock(value: unknown, fallback = "17:00") {
  const candidate = typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
  const [hour, minute] = candidate.split(":").map(Number);
  return Math.min(1_439, Math.max(0, hour * 60 + minute));
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(parsed) ? parsed : fallback));
}

export function normalizeSessionImbalanceSettings(
  settings: Record<string, unknown>,
): SessionImbalanceSettings {
  const merged = { ...SESSION_IMBALANCE_DEFAULTS, ...settings } as Record<string, number | string | boolean>;
  const lineStyle = String(merged.lineStyle);
  const alignment = String(merged.textAlignment);
  const extendMode = String(merged.extendMode);
  return {
    ...merged,
    numberOfMinutes: Math.round(clamp(merged.numberOfMinutes, 1, 1_440, 60)),
    numberOfDays: Math.round(clamp(merged.numberOfDays, 0, 365, 0)),
    lineWidth: clamp(merged.lineWidth, 0.5, 4, 1),
    textSize: clamp(merged.textSize, 6, 32, 10),
    lineOpacity: clamp(merged.lineOpacity, 5, 100, 100),
    customStartTime: /^\d{2}:\d{2}$/.test(String(merged.customStartTime))
      ? String(merged.customStartTime)
      : "17:00",
    lineStyle: lineStyle === "dashed" || lineStyle === "dotted" ? lineStyle : "solid",
    textAlignment: alignment === "left" ? "left" : "right",
    extendMode: extendMode === "none" ? "none" : "next-session",
    useCustomStartTime: merged.useCustomStartTime === true,
    plotOnceEnded: merged.plotOnceEnded === true,
    showHigh: merged.showHigh !== false,
    showLow: merged.showLow !== false,
    showMid: merged.showMid !== false,
    level50Enabled: merged.level50Enabled !== false,
    level100Enabled: merged.level100Enabled !== false,
    showLabels: merged.showLabels !== false,
    useThemeColors: merged.useThemeColors !== false,
    highColor: String(merged.highColor),
    lowColor: String(merged.lowColor),
    midColor: String(merged.midColor),
    level50Color: String(merged.level50Color),
    level100Color: String(merged.level100Color),
    sessionImbalanceSettingsVersion: SESSION_IMBALANCE_SETTINGS_VERSION,
  } as SessionImbalanceSettings;
}

/**
 * Builds one no-lookahead opening-range set per CME exchange session.
 *
 * Futures sessions are keyed at the 17:00 Chicago reopen. A custom start is
 * an offset inside that same exchange session, so 09:30 still belongs to the
 * trading date that opened the prior afternoon. The current range develops
 * candle by candle; a completed range remains fixed.
 */
export function buildSessionImbalanceLevels(
  candles: readonly Candle[],
  rawSettings: Record<string, unknown>,
  intervalMs = 60_000,
): SessionImbalanceLevel[] {
  if (!candles.length) return [];
  const settings = normalizeSessionImbalanceSettings(rawSettings);
  const sessionStartMinute = 17 * 60;
  const requestedStartMinute = settings.useCustomStartTime
    ? parseClock(settings.customStartTime)
    : sessionStartMinute;
  const requestedStartOffset = (requestedStartMinute - sessionStartMinute + 1_440) % 1_440;
  const groups = new Map<string, Array<{ candle: Candle; offset: number }>>();

  for (const candle of candles) {
    const parts = chicagoParts(candle.timestamp);
    if (parts.weekday === "Sat") continue;
    const sessionKey = parts.minute >= sessionStartMinute ? parts.date : previousDateKey(parts.date);
    const offset = (parts.minute - sessionStartMinute + 1_440) % 1_440;
    const group = groups.get(sessionKey) ?? [];
    group.push({ candle, offset });
    groups.set(sessionKey, group);
  }

  const ordered = [...groups.entries()]
    .map(([sessionKey, rows]) => ({ sessionKey, rows: rows.sort((a, b) => a.candle.timestamp - b.candle.timestamp) }))
    .sort((a, b) => a.rows[0].candle.timestamp - b.rows[0].candle.timestamp);
  const selected = settings.numberOfDays > 0 ? ordered.slice(-settings.numberOfDays) : ordered;
  const lastTimestamp = candles.at(-1)!.timestamp;

  return selected.flatMap((session, sessionIndex) => {
    const first = session.rows.find((row) => row.offset >= requestedStartOffset);
    if (!first) return [];
    const formationEndTimestamp = first.candle.timestamp + settings.numberOfMinutes * 60_000;
    const formationRows = session.rows.filter((row) =>
      row.candle.timestamp >= first.candle.timestamp && row.candle.timestamp < formationEndTimestamp);
    if (!formationRows.length) return [];
    const developing = lastTimestamp < formationEndTimestamp;
    if (developing && settings.plotOnceEnded) return [];

    const high = Math.max(...formationRows.map((row) => row.candle.high));
    const low = Math.min(...formationRows.map((row) => row.candle.low));
    if (!Number.isFinite(high) || !Number.isFinite(low) || high < low) return [];
    const range = high - low;
    const next = selected[sessionIndex + 1];
    const endTimestamp = settings.extendMode === "next-session" && next
      ? next.rows[0].candle.timestamp
      : settings.extendMode === "next-session" && !next
        ? lastTimestamp
        : Math.min(lastTimestamp, Math.max(first.candle.timestamp, formationEndTimestamp - intervalMs));
    const suffix = developing ? " · BUILDING" : "";
    const level = (role: SessionImbalanceRole, price: number, label: string): SessionImbalanceLevel => ({
      id: `session-imbalance-${session.sessionKey}-${role}`,
      role,
      sessionKey: session.sessionKey,
      price,
      startTimestamp: first.candle.timestamp,
      endTimestamp: Math.max(first.candle.timestamp, endTimestamp),
      formationEndTimestamp,
      developing,
      label: `${label}${suffix}`,
    });

    return [
      ...(settings.showHigh ? [level("high", high, "IBH")] : []),
      ...(settings.showLow ? [level("low", low, "IBL")] : []),
      ...(settings.showMid ? [level("mid", low + range / 2, "IBM")] : []),
      ...(settings.level50Enabled ? [
        level("upper50", high + range * 0.5, "IB +50%"),
        level("lower50", low - range * 0.5, "IB -50%"),
      ] : []),
      ...(settings.level100Enabled ? [
        level("upper100", high + range, "IB +100%"),
        level("lower100", low - range, "IB -100%"),
      ] : []),
    ];
  });
}
