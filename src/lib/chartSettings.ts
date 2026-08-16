"use client";

import type { ThemeColors } from "@/lib/theme";
import { normalizeTimeZone } from "@/lib/timeZones";

export interface ChartSettings {
  themeLinked: boolean;
  colorBarsPreviousClose: boolean;
  upColor: string;
  downColor: string;
  borderUpColor: string;
  borderDownColor: string;
  wickUpColor: string;
  wickDownColor: string;
  backgroundColor: string;
  gridLines: boolean;
  gridColor: string;
  timezone: string;
  precision: string;
}

export const CHART_SETTINGS_STORAGE_KEY = "olisa-chart-settings";
export const CHART_SETTINGS_METADATA_KEY = "chartSettings";
export const CHART_SETTINGS_CHANGE_EVENT = "kwantdesk:chart-settings-change";

export const defaultChartSettings: ChartSettings = {
  themeLinked: true,
  colorBarsPreviousClose: false,
  upColor: "#16C7CE",
  downColor: "#FF1F78",
  borderUpColor: "#16C7CE",
  borderDownColor: "#FF1F78",
  wickUpColor: "#16C7CE",
  wickDownColor: "#FF1F78",
  backgroundColor: "#020304",
  gridLines: true,
  gridColor: "#11151A",
  timezone: "America/New_York",
  precision: "Default",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickColor(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function normalizeChartSettings(value: unknown): ChartSettings {
  const source = asRecord(value) ?? {};

  return {
    themeLinked:
      typeof source.themeLinked === "boolean"
        ? source.themeLinked
        : defaultChartSettings.themeLinked,
    colorBarsPreviousClose:
      typeof source.colorBarsPreviousClose === "boolean"
        ? source.colorBarsPreviousClose
        : defaultChartSettings.colorBarsPreviousClose,
    upColor: pickColor(source.upColor, defaultChartSettings.upColor),
    downColor: pickColor(source.downColor, defaultChartSettings.downColor),
    borderUpColor: pickColor(source.borderUpColor, defaultChartSettings.borderUpColor),
    borderDownColor: pickColor(source.borderDownColor, defaultChartSettings.borderDownColor),
    wickUpColor: pickColor(source.wickUpColor, defaultChartSettings.wickUpColor),
    wickDownColor: pickColor(source.wickDownColor, defaultChartSettings.wickDownColor),
    backgroundColor: pickColor(source.backgroundColor, defaultChartSettings.backgroundColor),
    gridLines:
      typeof source.gridLines === "boolean"
        ? source.gridLines
        : typeof source.gridVisible === "boolean"
          ? source.gridVisible
          : defaultChartSettings.gridLines,
    gridColor: pickColor(source.gridColor, defaultChartSettings.gridColor),
    timezone: normalizeTimeZone(pickColor(source.timezone, defaultChartSettings.timezone)),
    precision: pickColor(source.precision, defaultChartSettings.precision),
  };
}

const CHART_THEME_COLOR_FIELDS = [
  "upColor",
  "downColor",
  "borderUpColor",
  "borderDownColor",
  "wickUpColor",
  "wickDownColor",
  "backgroundColor",
  "gridColor",
] as const satisfies ReadonlyArray<keyof ChartSettings>;

/**
 * Theme-linked workspaces inherit the active account palette. Once a trader
 * customises chart colours, themeLinked becomes false and the workspace owns
 * its exact saved palette instead of being repainted by later theme changes.
 */
export function mergeWorkspaceChartSettingsWithActiveTheme(
  workspaceSettings: unknown,
  activeSettings: unknown,
): ChartSettings {
  const merged = normalizeChartSettings(workspaceSettings);
  if (!merged.themeLinked) return merged;
  const active = normalizeChartSettings(activeSettings);
  for (const field of CHART_THEME_COLOR_FIELDS) merged[field] = active[field];
  return merged;
}

export function loadStoredChartSettings() {
  if (typeof window === "undefined") return defaultChartSettings;

  try {
    return normalizeChartSettings(JSON.parse(window.localStorage.getItem(CHART_SETTINGS_STORAGE_KEY) ?? "{}"));
  } catch {
    return defaultChartSettings;
  }
}

export function saveStoredChartSettings(settings: ChartSettings) {
  if (typeof window === "undefined") return;
  const normalized = normalizeChartSettings(settings);
  window.localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  // CSS variables repaint the application chrome immediately, but canvas
  // charts keep their palette in React state. Give every mounted chart surface
  // the same normalized payload so a theme change cannot leave stale panes
  // behind until the next reload.
  window.dispatchEvent(new CustomEvent<ChartSettings>(CHART_SETTINGS_CHANGE_EVENT, {
    detail: normalized,
  }));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

export function chartSettingsEqual(left: ChartSettings, right: ChartSettings) {
  return left.themeLinked === right.themeLinked
    && left.colorBarsPreviousClose === right.colorBarsPreviousClose
    && left.upColor === right.upColor
    && left.downColor === right.downColor
    && left.borderUpColor === right.borderUpColor
    && left.borderDownColor === right.borderDownColor
    && left.wickUpColor === right.wickUpColor
    && left.wickDownColor === right.wickDownColor
    && left.backgroundColor === right.backgroundColor
    && left.gridLines === right.gridLines
    && left.gridColor === right.gridColor
    && left.timezone === right.timezone
    && left.precision === right.precision;
}

export function extractUserChartSettings(user: { user_metadata?: Record<string, unknown> | null } | null | undefined) {
  const metadata = user?.user_metadata ?? null;
  if (!metadata) return null;
  const raw = metadata[CHART_SETTINGS_METADATA_KEY] ?? metadata.chart_settings ?? null;
  if (!raw) return null;
  return normalizeChartSettings(raw);
}

export function mergeChartSettingsIntoTheme(theme: ThemeColors, settings: ChartSettings): ThemeColors {
  return {
    ...theme,
    chartBackground: settings.backgroundColor,
    gridColor: settings.gridColor,
    candleUp: settings.upColor,
    candleDown: settings.downColor,
  };
}
