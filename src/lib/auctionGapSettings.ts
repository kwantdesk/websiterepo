import type { IndicatorNumericSetting } from "./chartIndicatorConfig";
import { DEFAULT_AUCTION_GAP_DETECTION, normalizeAuctionGapDetection } from "./auctionGapTracker.ts";
import { visibleIndicatorTheme } from "./indicatorPlotColors.ts";

// Input/location/plot/reset choices reflect inspected public DLL settings.
// Retest names and opacity/marker size are explicit KwantDesk controls, not
// assertions about protected TriggerOnlyTouch or constructor semantics.
export const AUCTION_GAP_DEFAULTS = {
  ...DEFAULT_AUCTION_GAP_DETECTION,
  plotMode: "zones", markerPlacement: "bar-direction", extendedBars: 200,
  lineWidth: 1, opacity: 100, markerSize: 6,
  resetMode: "none", filterTime: "none", customStartMinutes: 0, customEndMinutes: 0,
  retestMode: "touch", showTriggered: true, onlyTriggered: false,
  useThemeColors: true, buyColor: "#22c55e", sellColor: "#ef4444",
  buyTriggeredColor: "#22c55e", sellTriggeredColor: "#ef4444",
  alertSoundEnabled: false, messagePopupEnabled: false,
  alertName: "Auction Gap", alertMessage: "Auction gap detected",
};

export const AUCTION_GAP_NUMERIC_SETTINGS: IndicatorNumericSetting[] = [
  { key: "minimumTickVolume", label: "Minimum tick volume", defaultValue: 0, min: 0, max: 10_000_000, step: 1 },
  { key: "maximumOppositeVolume", label: "Maximum opposite volume", defaultValue: 0, min: 0, max: 10_000_000, step: 1 },
  { key: "minimumConsecutiveLevels", label: "Minimum consecutive levels", defaultValue: 3, min: 1, max: 1000, step: 1 },
  { key: "extendedBars", label: "Extend by chart bars", defaultValue: 200, min: 0, max: 10000, step: 1 },
  { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 5, step: 1 },
  { key: "opacity", label: "Opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
  { key: "markerSize", label: "Marker size", defaultValue: 6, min: 2, max: 30, step: 1 },
];
export function normalizeAuctionGapSettings(raw: Record<string, unknown> = {}): Record<string, number | string | boolean> {
  const out: Record<string, number | string | boolean> = { ...AUCTION_GAP_DEFAULTS, ...normalizeAuctionGapDetection(raw) };
  const numeric = (value: unknown, fallback: number, min: number, max: number) => {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? Math.round(Math.max(min, Math.min(max, n))) : fallback;
  };
  for (const field of AUCTION_GAP_NUMERIC_SETTINGS) out[field.key] = numeric(raw[field.key], field.defaultValue, field.min, field.max);
  for (const key of ["customStartMinutes", "customEndMinutes"]) out[key] = numeric(raw[key], 0, 0, 1439);
  for (const [key, fallback] of Object.entries(AUCTION_GAP_DEFAULTS)) {
    if (typeof fallback === "boolean") out[key] = typeof raw[key] === "boolean" ? raw[key] : fallback;
  }
  const choose = (key: string, values: string[]) => { if (typeof raw[key] === "string" && values.includes(raw[key])) out[key] = raw[key]; };
  choose("plotMode", ["zones", "marker", "marker-and-zones"]);
  choose("markerPlacement", ["bar-direction", "low", "high"]);
  choose("resetMode", ["none", "session-open", "eth-and-rth-open"]);
  choose("filterTime", ["none", "eth", "rth", "custom"]);
  choose("retestMode", ["touch", "cross"]);
  for (const key of ["buyColor", "sellColor", "buyTriggeredColor", "sellTriggeredColor"]) {
    if (typeof raw[key] === "string" && /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(raw[key])) out[key] = raw[key];
  }
  for (const [key, limit] of [["alertName", 80], ["alertMessage", 200]] as const) {
    if (typeof raw[key] === "string") out[key] = raw[key].trim().slice(0, limit) || out[key];
  }
  return out;
}

export function auctionGapSettingsSection(key: string) {
  if (["minimumTickVolume", "maximumOppositeVolume", "minimumConsecutiveLevels", "includeMode", "resetMode", "filterTime", "customStartMinutes", "customEndMinutes", "retestMode"].includes(key)) return "Inputs";
  if (["alertName", "alertMessage", "alertSoundEnabled", "messagePopupEnabled"].includes(key)) return "Alerts";
  return "Style";
}

export function auctionGapThemeColors(theme: Parameters<typeof visibleIndicatorTheme>[0]) {
  const palette = visibleIndicatorTheme(theme);
  return { buyColor: palette.positive, sellColor: palette.negative,
    buyTriggeredColor: palette.positive, sellTriggeredColor: palette.negative };
}
