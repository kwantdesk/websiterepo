import { defaultTheme, type ThemeColors } from "./theme.ts";
import { defaultChartSettings, mergeChartSettingsIntoTheme, normalizeChartSettings, type ChartSettings } from "./chartSettings.ts";
import { writeProtectedItem } from "./browserStorageQuota.ts";

export const CUSTOM_THEMES_KEY = "kwantdesk:custom-themes:v1";
export const CUSTOM_THEMES_EVENT = "kwantdesk:custom-themes-changed";
const CHART_COLOURS = ["upColor", "downColor", "borderUpColor", "borderDownColor", "wickUpColor", "wickDownColor", "backgroundColor", "gridColor", "gridLines"] as const;
type ChartPalette = Pick<ChartSettings, (typeof CHART_COLOURS)[number]>;
export type CustomTheme = { id: string; name: string; colors: ThemeColors; chartColors: ChartPalette };
const isColour = (value: unknown): value is string => typeof value === "string"
  && /^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(value);

function normalizeCustomTheme(raw: unknown): CustomTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<CustomTheme>;
  if (typeof row.id !== "string" || !row.id || typeof row.name !== "string" || !row.name.trim() || !row.colors || !row.chartColors) return null;
  const colors = Object.fromEntries(Object.entries(defaultTheme).map(([key, fallback]) => [key,
    isColour(row.colors?.[key as keyof ThemeColors]) ? row.colors[key as keyof ThemeColors] : fallback,
  ])) as ThemeColors;
  const normalized = normalizeChartSettings(Object.fromEntries(CHART_COLOURS.map(key => [key,
    key === "gridLines" ? row.chartColors?.gridLines
      : isColour(row.chartColors?.[key]) ? row.chartColors[key] : defaultChartSettings[key],
  ])));
  return { id: row.id, name: row.name.trim().slice(0, 60), colors,
    chartColors: Object.fromEntries(CHART_COLOURS.map(key => [key, normalized[key]])) as ChartPalette };
}

export function readCustomThemes(): { ok: boolean; themes: CustomTheme[] } {
  if (typeof window === "undefined") return { ok: false, themes: [] };
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_KEY);
    if (raw === null) return { ok: true, themes: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, themes: [] };
    const themes = parsed.map(normalizeCustomTheme).filter((row): row is CustomTheme => row !== null);
    return { ok: themes.length === parsed.length, themes };
  } catch { return { ok: false, themes: [] }; }
}

export function customThemeAppearance(theme: CustomTheme, current: ChartSettings) {
  const chartSettings = { ...current, ...theme.chartColors, themeLinked: true };
  return { colors: mergeChartSettingsIntoTheme(theme.colors, chartSettings), chartSettings };
}

export function saveCustomTheme(name: string, colors: ThemeColors, chartSettings: ChartSettings):
  { ok: true; theme: CustomTheme; themes: CustomTheme[] } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) return { ok: false, error: "Enter a theme name between 1 and 60 characters." };
  const saved = readCustomThemes();
  if (!saved.ok) return { ok: false, error: "Your saved themes could not be read. Nothing has been overwritten." };
  if (saved.themes.some(row => row.name.toLowerCase() === trimmed.toLowerCase())) return { ok: false, error: "You already have a theme with that name. Choose a new name." };
  const id = `theme-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const theme = normalizeCustomTheme({ id, name: trimmed, colors: mergeChartSettingsIntoTheme(colors, chartSettings), chartColors: chartSettings })!;
  const themes = [...saved.themes, theme];
  const result = writeProtectedItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  if (!result.ok) return { ok: false, error: "Browser storage is full. The theme was not saved; your existing themes are unchanged." };
  window.dispatchEvent(new CustomEvent(CUSTOM_THEMES_EVENT));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  return { ok: true, theme, themes };
}
