"use client";

import type { ThemeColors } from "@/lib/theme";
import { normalizeTimeZone } from "@/lib/timeZones";

export interface ChartSettings {
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

export const defaultChartSettings: ChartSettings = {
  colorBarsPreviousClose: true,
  upColor: "#D6B45F",
  downColor: "#D96C5F",
  borderUpColor: "#D6B45F",
  borderDownColor: "#D96C5F",
  wickUpColor: "#D6B45F",
  wickDownColor: "#D96C5F99",
  backgroundColor: "#0C0D0F",
  gridLines: true,
  gridColor: "#1D1D1B",
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
  window.localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeChartSettings(settings)));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
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
