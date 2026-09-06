import type { Candle } from "@/lib/backtester";
import {
  buildMarketSessionWindows,
  type MarketSessionWindow,
} from "@/lib/marketSessions";

export type SessionMarkerLevelRole =
  | "high"
  | "low"
  | "imbalanceHigh"
  | "imbalanceLow"
  | "open"
  | "close"
  | "mid"
  | "vwap";

export type SessionMarkerWindow = MarketSessionWindow & {
  markerKey: "asian" | "europe" | "usa";
  imbalanceHigh: number;
  imbalanceLow: number;
  mid: number;
  vwap: number;
  openingPositive: boolean;
};

export type SessionMarkerLevel = {
  id: string;
  role: SessionMarkerLevelRole;
  price: number;
  startTimestamp: number;
  endTimestamp: number;
  label: string;
  color: string;
};

type SessionMarkerSettings = Record<string, number | string | boolean>;

const SESSION_MARKER_DEFINITIONS = [
  { markerKey: "asian", marketKey: "tokyo", label: "Asian", start: "16:00", end: "03:00" },
  { markerKey: "europe", marketKey: "london", label: "Europe", start: "03:00", end: "09:30" },
  { markerKey: "usa", marketKey: "newYork", label: "USA", start: "09:30", end: "16:00" },
] as const;

export const SESSION_MARKER_DEFAULTS: SessionMarkerSettings = {
  timeReference: "exchange",
  lookbackDays: 5,
  lineWidth: 2,
  lineOpacity: 100,
  lineStyle: "solid",
  extendLine: false,
  textSize: 11,
  showLabels: true,
  textColor: "#E5E7EB",
  showSessionRange: true,
  showImbalanceRange: true,
  showOpenClose: true,
  showMidPrice: true,
  useThemeColors: true,
  asianEnabled: true,
  asianStartTime: "16:00",
  asianEndTime: "03:00",
  asianImbalanceMinutes: 60,
  asianVwapEnabled: false,
  europeEnabled: true,
  europeStartTime: "03:00",
  europeEndTime: "09:30",
  europeImbalanceMinutes: 60,
  europeVwapEnabled: false,
  usaEnabled: true,
  usaStartTime: "09:30",
  usaEndTime: "16:00",
  usaImbalanceMinutes: 60,
  usaVwapEnabled: false,
  markerEnabled: false,
  allowSessionOverlap: false,
  sessionMarkerSettingsVersion: 2,
};

const clock = (value: unknown, fallback: string) =>
  typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;

export function normalizeSessionMarkerSettings(input: SessionMarkerSettings = {}) {
  const next: SessionMarkerSettings = { ...SESSION_MARKER_DEFAULTS, ...input };
  const legacyVersion = Number(input.sessionMarkerSettingsVersion ?? 0) < 2;
  // Upgrade only the former stock values. Genuine user-entered clocks survive.
  if (legacyVersion && (input.asianStartTime === undefined || input.asianStartTime === "15:00")) {
    next.asianStartTime = "16:00";
  }
  if (legacyVersion && (input.europeEndTime === undefined || input.europeEndTime === "11:00")) {
    next.europeEndTime = "09:30";
  }
  next.timeReference = ["exchange", "local"].includes(String(next.timeReference))
    ? next.timeReference
    : "exchange";
  next.lineStyle = ["solid", "dashed", "dotted"].includes(String(next.lineStyle))
    ? next.lineStyle
    : "solid";
  next.lookbackDays = Math.min(30, Math.max(1, Math.round(Number(next.lookbackDays) || 5)));
  next.lineWidth = Math.min(4, Math.max(1, Number(next.lineWidth) || 2));
  next.lineOpacity = Math.min(100, Math.max(5, Number(next.lineOpacity) || 100));
  next.textSize = Math.min(32, Math.max(6, Number(next.textSize) || 11));
  for (const definition of SESSION_MARKER_DEFINITIONS) {
    const key = definition.markerKey;
    next[`${key}StartTime`] = clock(next[`${key}StartTime`], definition.start);
    next[`${key}EndTime`] = clock(next[`${key}EndTime`], definition.end);
    next[`${key}ImbalanceMinutes`] = Math.min(
      240,
      Math.max(1, Math.round(Number(next[`${key}ImbalanceMinutes`]) || 60)),
    );
  }
  next.allowSessionOverlap = next.allowSessionOverlap === true;
  next.sessionMarkerSettingsVersion = 2;
  return next;
}

function markerTimeZone(settings: SessionMarkerSettings) {
  if (settings.timeReference !== "local") return "America/New_York";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function buildSessionMarkerWindows(
  candles: Candle[],
  rawSettings: SessionMarkerSettings,
  intervalMs = 60_000,
): SessionMarkerWindow[] {
  if (!candles.length) return [];
  const settings = normalizeSessionMarkerSettings(rawSettings);
  const timezone = markerTimeZone(settings);
  const mapped: SessionMarkerSettings = {
    lookbackDays: settings.lookbackDays,
    hideWeekends: true,
    showGlobex: false,
    showSydney: false,
    allowSessionOverlap: settings.allowSessionOverlap,
  };
  for (const definition of SESSION_MARKER_DEFINITIONS) {
    const key = definition.markerKey;
    const marketKey = definition.marketKey;
    mapped[`show${marketKey[0].toUpperCase()}${marketKey.slice(1)}`] = settings[`${key}Enabled`] !== false;
    mapped[`${marketKey}Label`] = definition.label;
    mapped[`${marketKey}Timezone`] = timezone;
    mapped[`${marketKey}Start`] = settings[`${key}StartTime`];
    mapped[`${marketKey}End`] = settings[`${key}EndTime`];
  }

  const definitionByMarketKey = new Map(
    SESSION_MARKER_DEFINITIONS.map((definition) => [definition.marketKey, definition]),
  );
  const firstAtOrAfter = (timestamp: number) => {
    let low = 0;
    let high = candles.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (candles[middle].timestamp < timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  return buildMarketSessionWindows(candles, mapped, intervalMs).flatMap((window) => {
    const definition = definitionByMarketKey.get(window.key as "tokyo" | "london" | "newYork");
    if (!definition) return [];
    const startIndex = firstAtOrAfter(window.startTimestamp);
    const endIndex = firstAtOrAfter(window.endTimestamp);
    const sessionCandles = candles.slice(startIndex, endIndex);
    if (!sessionCandles.length) return [];
    const imbalanceEnd = window.startTimestamp
      + Number(settings[`${definition.markerKey}ImbalanceMinutes`]) * 60_000;
    const imbalanceCandles = sessionCandles.filter((candle) => candle.timestamp < imbalanceEnd);
    const imbalanceSource = imbalanceCandles.length ? imbalanceCandles : [sessionCandles[0]];
    let weightedPrice = 0;
    let totalWeight = 0;
    for (const candle of sessionCandles) {
      const weight = Math.max(0, Number(candle.volume) || 0);
      if (!(weight > 0)) continue;
      weightedPrice += ((candle.high + candle.low + candle.close) / 3) * weight;
      totalWeight += weight;
    }
    return [{
      ...window,
      markerKey: definition.markerKey,
      imbalanceHigh: Math.max(...imbalanceSource.map((candle) => candle.high)),
      imbalanceLow: Math.min(...imbalanceSource.map((candle) => candle.low)),
      mid: (window.high + window.low) / 2,
      vwap: totalWeight > 0 ? weightedPrice / totalWeight : (window.high + window.low + window.close) / 3,
      openingPositive: window.open >= (candles[startIndex - 1]?.close ?? window.open),
    }];
  });
}

export function buildSessionMarkerLevels(
  windows: SessionMarkerWindow[],
  rawSettings: SessionMarkerSettings,
  intervalMs = 60_000,
): SessionMarkerLevel[] {
  const settings = normalizeSessionMarkerSettings(rawSettings);
  return windows.flatMap((window) => {
    const key = window.markerKey;
    const endTimestamp = Math.max(window.startTimestamp, window.endTimestamp - intervalMs);
    const rows: Array<[SessionMarkerLevelRole, number, string, boolean]> = [
      ["high", window.high, `${window.label} High`, true],
      ["low", window.low, `${window.label} Low`, true],
      ["imbalanceHigh", window.imbalanceHigh, `${window.label} Imbalance High`, settings.showImbalanceRange !== false],
      ["imbalanceLow", window.imbalanceLow, `${window.label} Imbalance Low`, settings.showImbalanceRange !== false],
      ["open", window.open, `${window.label} Open`, settings.showOpenClose !== false || settings.markerEnabled === true],
      ["close", window.close, `${window.label} Close`, settings.showOpenClose !== false],
      ["mid", window.mid, `${window.label} Mid`, settings.showMidPrice !== false],
      ["vwap", window.vwap, `${window.label} VWAP`, settings[`${key}VwapEnabled`] === true],
    ];
    return rows.flatMap(([role, price, label, enabled]) => enabled ? [{
      id: `session-marker-${key}-${window.startTimestamp}-${role}`,
      role,
      price,
      startTimestamp: window.startTimestamp,
      endTimestamp,
      label,
      color: String(settings[`${key}${role[0].toUpperCase()}${role.slice(1)}Color`] ?? ""),
    }] : []);
  });
}
