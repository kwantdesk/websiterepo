import type {
  FootprintContentMode,
  FootprintNumberFormat,
  FootprintScaleMode,
  FootprintVisualizationMode,
} from "./footprintTypes";

export const FOOTPRINT_SETTINGS_SCHEMA_VERSION = 3;

export type FootprintSettings = {
  footprintSettingsVersion: number;
  contentMode: FootprintContentMode;
  visualizationMode: FootprintVisualizationMode;
  scaleMode: FootprintScaleMode;
  numberFormat: FootprintNumberFormat;
  groupingMode: "automatic" | "manual";
  groupMode: "fixed" | "open-close";
  manualTicks: number;
  autoGroupFactor: number;
  barWidth: number;
  candleSpacing: number;
  fontSize: number;
  fontWeight: number;
  minimumWidthToShowText: number;
  minimumRowHeightToShowText: number;
  backgroundOpacity: number;
  minimumOpacity: number;
  maximumOpacity: number;
  gradientExponent: number;
  visibleRegionPercentile: number;
  fixedMaximum: number;
  minimumTradeVolume: number;
  maximumTradeVolume: number;
  valueAreaPercent: number;
  imbalanceMode: "diagonal" | "same-row" | "delta-percent";
  minimumImbalancePercent: number;
  minimumDominantVolume: number;
  minimumDelta: number;
  includeZero: boolean;
  stackedImbalanceLevels: number;
  showStackedImbalances: boolean;
  unfinishedAuctionEnabled: boolean;
  unfinishedAuctionMinimumVolume: number;
  showWick: boolean;
  showBodyOutline: boolean;
  showBodyFill: boolean;
  showEmptyPriceRows: boolean;
  showSummary: boolean;
  showCentreDivider: boolean;
  showVolumePoc: boolean;
  showValueArea: boolean;
  showVah: boolean;
  showVal: boolean;
  showMaxBid: boolean;
  showMaxAsk: boolean;
  showMaxPositiveDelta: boolean;
  showMaxNegativeDelta: boolean;
  showMaxTrades: boolean;
  showBetweenVolume: boolean;
  showVwap: boolean;
  useThemeColors: boolean;
  askColor: string;
  bidColor: string;
  betweenColor: string;
  neutralColor: string;
  textColor: string;
  pocColor: string;
  valueAreaColor: string;
  stackedAskColor: string;
  stackedBidColor: string;
  unfinishedAuctionColor: string;
  vwapColor: string;
  fpsLimit: 30 | 60 | 120;
  maximumRetainedBars: number;
  maximumDetailedVisibleBars: number;
};

export const DEFAULT_FOOTPRINT_SETTINGS: FootprintSettings = {
  footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
  contentMode: "bid-ask",
  visualizationMode: "heatmap-histogram",
  scaleMode: "visible-region",
  numberFormat: "automatic",
  groupingMode: "automatic",
  groupMode: "fixed",
  manualTicks: 1,
  autoGroupFactor: 1,
  barWidth: 92,
  candleSpacing: 6,
  fontSize: 11,
  fontWeight: 500,
  minimumWidthToShowText: 58,
  minimumRowHeightToShowText: 13,
  backgroundOpacity: 72,
  minimumOpacity: 8,
  maximumOpacity: 72,
  gradientExponent: 0.72,
  visibleRegionPercentile: 0.95,
  fixedMaximum: 0,
  minimumTradeVolume: 0,
  maximumTradeVolume: 0,
  valueAreaPercent: 0.7,
  imbalanceMode: "diagonal",
  minimumImbalancePercent: 300,
  minimumDominantVolume: 10,
  minimumDelta: 0,
  includeZero: false,
  stackedImbalanceLevels: 3,
  showStackedImbalances: true,
  unfinishedAuctionEnabled: false,
  unfinishedAuctionMinimumVolume: 1,
  showWick: true,
  showBodyOutline: true,
  showBodyFill: false,
  showEmptyPriceRows: false,
  showSummary: true,
  showCentreDivider: true,
  showVolumePoc: true,
  showValueArea: true,
  showVah: false,
  showVal: false,
  showMaxBid: false,
  showMaxAsk: false,
  showMaxPositiveDelta: false,
  showMaxNegativeDelta: false,
  showMaxTrades: false,
  showBetweenVolume: false,
  showVwap: false,
  useThemeColors: true,
  askColor: "#B7FF38",
  bidColor: "#F06A70",
  betweenColor: "#7C8796",
  neutralColor: "#7C8796",
  textColor: "#E9EDF2",
  pocColor: "#E4BF5A",
  valueAreaColor: "#647BA8",
  stackedAskColor: "#B7FF38",
  stackedBidColor: "#F06A70",
  unfinishedAuctionColor: "#E4BF5A",
  vwapColor: "#22D3EE",
  fpsLimit: 60,
  maximumRetainedBars: 5000,
  maximumDetailedVisibleBars: 180,
};

export type FootprintPresetName =
  | "kwantdesk"
  | "order-flow"
  | "imbalance"
  | "delta"
  | "delta-focus"
  | "volume-heatmap"
  | "minimal"
  | "minimal-ladder";

export const FOOTPRINT_PRESETS: Record<FootprintPresetName, Partial<FootprintSettings>> = {
  kwantdesk: {},
  "order-flow": {
    contentMode: "bid-ask-histogram",
    visualizationMode: "heatmap-histogram",
    scaleMode: "visible-region",
    showBetweenVolume: true,
    showValueArea: false,
    showStackedImbalances: true,
    showSummary: true,
  },
  imbalance: {
    contentMode: "bid-ask",
    visualizationMode: "heatmap-histogram",
    minimumOpacity: 12,
    maximumOpacity: 86,
    showStackedImbalances: true,
    showSummary: true,
  },
  "delta-focus": {
    contentMode: "delta-histogram",
    visualizationMode: "heatmap-histogram",
    showMaxPositiveDelta: true,
    showMaxNegativeDelta: true,
    showBetweenVolume: false,
  },
  delta: {
    contentMode: "delta-histogram",
    visualizationMode: "heatmap-histogram",
    showMaxPositiveDelta: true,
    showMaxNegativeDelta: true,
    showBetweenVolume: false,
  },
  "volume-heatmap": {
    contentMode: "volume",
    visualizationMode: "heatmap",
    maximumOpacity: 84,
    showStackedImbalances: false,
  },
  "minimal-ladder": {
    contentMode: "ladder",
    visualizationMode: "text-only",
    showSummary: false,
    showValueArea: false,
    showStackedImbalances: false,
  },
  minimal: {
    contentMode: "ladder",
    visualizationMode: "text-only",
    showSummary: false,
    showValueArea: false,
    showStackedImbalances: false,
  },
};

export type FootprintTemplate = {
  id: string;
  name: string;
  settings: FootprintSettings;
  updatedAt: number;
};

export const FOOTPRINT_TEMPLATES_STORAGE_KEY = "kwantdesk:footprint:templates:v1";

const clamp = (value: unknown, minimum: number, maximum: number, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const option = <T extends string>(value: unknown, values: readonly T[], fallback: T) =>
  values.includes(String(value) as T) ? String(value) as T : fallback;

export function validateFootprintSettings(input: unknown): FootprintSettings {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const merged = { ...DEFAULT_FOOTPRINT_SETTINGS, ...source } as FootprintSettings;
  return {
    ...merged,
    footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
    contentMode: option(source.contentMode ?? source.type, ["bid-ask", "delta", "volume", "volume-delta", "trades", "bid-ask-histogram", "volume-histogram", "delta-histogram", "ladder"], "bid-ask"),
    visualizationMode: option(source.visualizationMode, ["solid", "heatmap", "histogram", "heatmap-histogram", "text-only"], "heatmap-histogram"),
    scaleMode: option(source.scaleMode, ["per-bar", "all-loaded", "visible-region", "fixed-maximum"], "visible-region"),
    numberFormat: option(source.numberFormat ?? source.textFormat, ["full", "compact", "automatic"], "automatic"),
    barWidth: clamp(source.barWidth, 28, 180, 92),
    candleSpacing: clamp(source.candleSpacing, 1, 24, 6),
    fontSize: clamp(source.fontSize, 9, 15, 11),
    fontWeight: clamp(source.fontWeight, 400, 800, 500),
    valueAreaPercent: clamp(source.valueAreaPercent, 0.5, 1, 0.7),
    minimumImbalancePercent: clamp(source.minimumImbalancePercent, 100, 10_000, 300),
    minimumDominantVolume: clamp(source.minimumDominantVolume, 0, 1_000_000, 10),
    stackedImbalanceLevels: Math.round(clamp(source.stackedImbalanceLevels, 2, 10, 3)),
    maximumRetainedBars: Math.round(clamp(source.maximumRetainedBars, 100, 5000, 5000)),
    maximumDetailedVisibleBars: Math.round(clamp(source.maximumDetailedVisibleBars, 20, 350, 180)),
    fpsLimit: [30, 60, 120].includes(Number(source.fpsLimit)) ? Number(source.fpsLimit) as 30 | 60 | 120 : 60,
  };
}

export function applyFootprintPreset(
  current: FootprintSettings,
  preset: FootprintPresetName,
): FootprintSettings {
  return validateFootprintSettings({
    ...current,
    ...(preset === "kwantdesk" ? DEFAULT_FOOTPRINT_SETTINGS : FOOTPRINT_PRESETS[preset]),
  });
}

export function footprintStorageKey(instanceId: string) {
  return `kwantdesk:workspace:footprint:v${FOOTPRINT_SETTINGS_SCHEMA_VERSION}:${instanceId}`;
}

export function loadFootprintSettings(instanceId: string): FootprintSettings {
  if (typeof window === "undefined") return DEFAULT_FOOTPRINT_SETTINGS;
  try {
    const stored = window.localStorage.getItem(footprintStorageKey(instanceId));
    return stored ? validateFootprintSettings(JSON.parse(stored)) : DEFAULT_FOOTPRINT_SETTINGS;
  } catch {
    return DEFAULT_FOOTPRINT_SETTINGS;
  }
}

export function saveFootprintSettings(instanceId: string, settings: FootprintSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(footprintStorageKey(instanceId), JSON.stringify(validateFootprintSettings(settings)));
  } catch {
    // Workspace persistence remains authoritative when browser storage is unavailable.
  }
}

export function validateFootprintTemplates(input: unknown): FootprintTemplate[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const source = candidate as Record<string, unknown>;
    const name = String(source.name ?? "").trim().slice(0, 48);
    if (!name) return [];
    return [{
      id: String(source.id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 80),
      name,
      settings: validateFootprintSettings(source.settings),
      updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0,
    }];
  }).slice(0, 24);
}

export function loadFootprintTemplates(): FootprintTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    return validateFootprintTemplates(JSON.parse(window.localStorage.getItem(FOOTPRINT_TEMPLATES_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveFootprintTemplate(name: string, settings: unknown): FootprintTemplate[] {
  if (typeof window === "undefined") return [];
  const normalizedName = name.trim().slice(0, 48);
  if (!normalizedName) return loadFootprintTemplates();
  const current = loadFootprintTemplates();
  const existing = current.find((template) => template.name.toLowerCase() === normalizedName.toLowerCase());
  const nextTemplate: FootprintTemplate = {
    id: existing?.id ?? `footprint-${Date.now().toString(36)}`,
    name: normalizedName,
    settings: validateFootprintSettings(settings),
    updatedAt: Date.now(),
  };
  const next = [nextTemplate, ...current.filter((template) => template.id !== nextTemplate.id)].slice(0, 24);
  window.localStorage.setItem(FOOTPRINT_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteFootprintTemplate(templateId: string): FootprintTemplate[] {
  if (typeof window === "undefined") return [];
  const next = loadFootprintTemplates().filter((template) => template.id !== templateId);
  window.localStorage.setItem(FOOTPRINT_TEMPLATES_STORAGE_KEY, JSON.stringify(next));
  return next;
}
