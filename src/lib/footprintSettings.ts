import type {
  FootprintContentMode,
  FootprintNumberFormat,
  FootprintScaleMode,
  FootprintVisualizationMode,
} from "./footprintTypes";

export const FOOTPRINT_SETTINGS_SCHEMA_VERSION = 5;

export type FootprintSettings = {
  footprintSettingsVersion: number;
  contentMode: FootprintContentMode;
  visualizationMode: FootprintVisualizationMode;
  scaleMode: FootprintScaleMode;
  numberFormat: FootprintNumberFormat;
  inputType: "volume" | "num-trades";
  colorMode: "none" | "fixed" | "fading";
  colorCalculation: "volume" | "delta" | "imbalance" | "dominant" | "dominant-delta";
  groupingMode: "automatic" | "manual";
  groupMode: "fixed" | "open-close";
  manualTicks: number;
  autoGroupFactor: number;
  showPerBarVolumeProfile: boolean;
  showPerBarDeltaProfile: boolean;
  perBarProfileScaleMode: "independent" | "shared";
  perBarProfileWidthPercent: number;
  perBarProfileGap: number;
  perBarProfileExtraSpacing: number;
  perBarProfileOpacity: number;
  showPerBarProfilePoc: boolean;
  perBarProfilePocSize: number;
  perBarProfileOutline: boolean;
  perBarVolumeColor: string;
  perBarPositiveDeltaColor: string;
  perBarNegativeDeltaColor: string;
  perBarProfilePocColor: string;
  barWidth: number;
  candleSpacing: number;
  fontSize: number;
  fontWeight: number;
  borderWidth: number;
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
  imbalanceMode: "diagonal" | "horizontal" | "same-row" | "delta-percent";
  minimumImbalancePercent: number;
  minimumDominantVolume: number;
  minimumDelta: number;
  includeZero: boolean;
  stackedImbalanceLevels: number;
  showStackedImbalances: boolean;
  unfinishedAuctionEnabled: boolean;
  unfinishedAuctionMinimumVolume: number;
  showImbalances: boolean;
  showWick: boolean;
  showBodyOutline: boolean;
  showBodyFill: boolean;
  showEmptyPriceRows: boolean;
  showSummary: boolean;
  showCentreDivider: boolean;
  showVolumePoc: boolean;
  showDeltaPoc: boolean;
  showValueArea: boolean;
  showVah: boolean;
  showVal: boolean;
  showSinglePrints: boolean;
  singlePrintMaximum: number;
  singlePrintExtremesOnly: boolean;
  showRatio: boolean;
  minimumRatio: number;
  maximumRatio: number;
  showVolumeClusters: boolean;
  clusterMinimumVolume: number;
  showBarDelta: boolean;
  showZeros: boolean;
  colorOnlyDominantSide: boolean;
  dynamicTextSize: boolean;
  dynamicTextIncrease: number;
  showMaxBid: boolean;
  showMaxAsk: boolean;
  showMaxPositiveDelta: boolean;
  showMaxNegativeDelta: boolean;
  showMaxTrades: boolean;
  showBetweenVolume: boolean;
  showVwap: boolean;
  outsideBarStyle: "bar" | "body";
  markerAlignment: "center" | "right";
  outerEdgeMode: boolean;
  useThemeColors: boolean;
  askColor: string;
  bidColor: string;
  betweenColor: string;
  neutralColor: string;
  textColor: string;
  pocColor: string;
  valueAreaColor: string;
  deltaPocColor: string;
  clusterColor: string;
  singlePrintColor: string;
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
  inputType: "volume",
  colorMode: "fading",
  colorCalculation: "imbalance",
  groupingMode: "automatic",
  groupMode: "fixed",
  manualTicks: 1,
  autoGroupFactor: 1,
  showPerBarVolumeProfile: false,
  showPerBarDeltaProfile: false,
  perBarProfileScaleMode: "independent",
  perBarProfileWidthPercent: 92,
  perBarProfileGap: 2,
  perBarProfileExtraSpacing: 18,
  perBarProfileOpacity: 58,
  showPerBarProfilePoc: true,
  perBarProfilePocSize: 5,
  perBarProfileOutline: false,
  perBarVolumeColor: "#B7FF38",
  perBarPositiveDeltaColor: "#B7FF38",
  perBarNegativeDeltaColor: "#F06A70",
  perBarProfilePocColor: "#E4BF5A",
  barWidth: 92,
  candleSpacing: 6,
  fontSize: 11,
  fontWeight: 500,
  borderWidth: 1,
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
  showImbalances: true,
  showWick: true,
  showBodyOutline: true,
  showBodyFill: false,
  showEmptyPriceRows: false,
  showSummary: true,
  showCentreDivider: true,
  showVolumePoc: true,
  showDeltaPoc: false,
  showValueArea: true,
  showVah: false,
  showVal: false,
  showSinglePrints: false,
  singlePrintMaximum: 1,
  singlePrintExtremesOnly: true,
  showRatio: false,
  minimumRatio: 1.5,
  maximumRatio: 100,
  showVolumeClusters: false,
  clusterMinimumVolume: 100,
  showBarDelta: true,
  showZeros: false,
  colorOnlyDominantSide: false,
  dynamicTextSize: true,
  dynamicTextIncrease: 1,
  showMaxBid: false,
  showMaxAsk: false,
  showMaxPositiveDelta: false,
  showMaxNegativeDelta: false,
  showMaxTrades: false,
  showBetweenVolume: false,
  showVwap: false,
  outsideBarStyle: "bar",
  markerAlignment: "center",
  outerEdgeMode: true,
  useThemeColors: true,
  askColor: "#B7FF38",
  bidColor: "#F06A70",
  betweenColor: "#7C8796",
  neutralColor: "#7C8796",
  textColor: "#E9EDF2",
  pocColor: "#E4BF5A",
  valueAreaColor: "#647BA8",
  deltaPocColor: "#60A5FA",
  clusterColor: "#F59E0B",
  singlePrintColor: "#F4F4F5",
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
    visualizationMode: "histogram",
    scaleMode: "visible-region",
    colorCalculation: "volume",
    showBetweenVolume: true,
    showValueArea: false,
    showStackedImbalances: true,
    showSummary: true,
    showPerBarVolumeProfile: true,
    showPerBarDeltaProfile: true,
    perBarProfileScaleMode: "independent",
    perBarProfileExtraSpacing: 18,
  },
  imbalance: {
    contentMode: "bid-ask",
    visualizationMode: "heatmap-histogram",
    colorCalculation: "imbalance",
    colorOnlyDominantSide: true,
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

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const colour = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

export function validateFootprintSettings(input: unknown): FootprintSettings {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const merged = { ...DEFAULT_FOOTPRINT_SETTINGS, ...source } as FootprintSettings;
  const minimumOpacity = clamp(source.minimumOpacity, 0, 100, 8);
  const maximumOpacity = Math.max(minimumOpacity, clamp(source.maximumOpacity, 0, 100, 72));
  const minimumRatio = clamp(source.minimumRatio, 0, 1_000, 1.5);
  const maximumRatio = Math.max(minimumRatio, clamp(source.maximumRatio, 1, 10_000, 100));
  const minimumTradeVolume = clamp(source.minimumTradeVolume, 0, 100_000, 0);
  const requestedMaximumTradeVolume = clamp(source.maximumTradeVolume, 0, 1_000_000, 0);
  const maximumTradeVolume = requestedMaximumTradeVolume > 0
    ? Math.max(minimumTradeVolume, requestedMaximumTradeVolume)
    : 0;
  return {
    ...merged,
    footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
    contentMode: option(source.contentMode ?? source.type, ["bid-ask", "delta", "volume", "volume-delta", "trades", "bid-ask-histogram", "volume-histogram", "delta-histogram", "ladder"], "bid-ask"),
    visualizationMode: option(source.visualizationMode, ["solid", "heatmap", "histogram", "heatmap-histogram", "text-only"], "heatmap-histogram"),
    scaleMode: option(source.scaleMode, ["per-bar", "all-loaded", "visible-region", "fixed-maximum"], "visible-region"),
    numberFormat: option(source.numberFormat ?? source.textFormat, ["full", "compact", "automatic"], "automatic"),
    inputType: option(source.inputType, ["volume", "num-trades"], "volume"),
    colorMode: option(source.colorMode, ["none", "fixed", "fading"], "fading"),
    colorCalculation: option(source.colorCalculation, ["volume", "delta", "imbalance", "dominant", "dominant-delta"], "imbalance"),
    groupingMode: option(source.groupingMode, ["automatic", "manual"], "automatic"),
    groupMode: option(source.groupMode, ["fixed", "open-close"], "fixed"),
    perBarProfileScaleMode: option(source.perBarProfileScaleMode, ["independent", "shared"], "independent"),
    imbalanceMode: option(source.imbalanceMode, ["diagonal", "same-row", "horizontal", "delta-percent"], "diagonal"),
    outsideBarStyle: option(source.outsideBarStyle, ["bar", "body"], "bar"),
    markerAlignment: option(source.markerAlignment, ["center", "right"], "center"),
    manualTicks: Math.round(clamp(source.manualTicks, 1, 100, 1)),
    autoGroupFactor: clamp(source.autoGroupFactor, 0.5, 4, 1),
    perBarProfileWidthPercent: clamp(source.perBarProfileWidthPercent, 10, 100, 92),
    perBarProfileGap: clamp(source.perBarProfileGap, 0, 12, 2),
    perBarProfileExtraSpacing: clamp(source.perBarProfileExtraSpacing, 0, 48, 18),
    perBarProfileOpacity: clamp(source.perBarProfileOpacity, 5, 100, 58),
    perBarProfilePocSize: clamp(source.perBarProfilePocSize, 2, 12, 5),
    barWidth: clamp(source.barWidth, 28, 180, 92),
    candleSpacing: clamp(source.candleSpacing, 1, 24, 6),
    fontSize: clamp(source.fontSize, 9, 15, 11),
    fontWeight: clamp(source.fontWeight, 400, 800, 500),
    borderWidth: clamp(source.borderWidth, 0.5, 4, 1),
    minimumWidthToShowText: clamp(source.minimumWidthToShowText, 28, 180, 58),
    minimumRowHeightToShowText: clamp(source.minimumRowHeightToShowText, 8, 34, 13),
    backgroundOpacity: clamp(source.backgroundOpacity, 0, 100, 72),
    minimumOpacity,
    maximumOpacity,
    gradientExponent: clamp(source.gradientExponent, 0.1, 3, 0.72),
    visibleRegionPercentile: clamp(source.visibleRegionPercentile, 0.5, 1, 0.95),
    fixedMaximum: clamp(source.fixedMaximum, 0, 10_000_000, 0),
    minimumTradeVolume,
    maximumTradeVolume,
    valueAreaPercent: clamp(source.valueAreaPercent, 0.5, 1, 0.7),
    minimumImbalancePercent: clamp(source.minimumImbalancePercent, 100, 10_000, 300),
    minimumDominantVolume: clamp(source.minimumDominantVolume, 0, 1_000_000, 10),
    minimumDelta: clamp(source.minimumDelta, 0, 1_000_000, 0),
    stackedImbalanceLevels: Math.round(clamp(source.stackedImbalanceLevels, 2, 10, 3)),
    unfinishedAuctionMinimumVolume: clamp(source.unfinishedAuctionMinimumVolume, 0, 1_000_000, 1),
    dynamicTextIncrease: clamp(source.dynamicTextIncrease, 0, 2, 1),
    singlePrintMaximum: clamp(source.singlePrintMaximum, 1, 1_000_000, 1),
    minimumRatio,
    maximumRatio,
    clusterMinimumVolume: clamp(source.clusterMinimumVolume, 1, 1_000_000, 100),
    includeZero: bool(source.includeZero, false),
    showPerBarVolumeProfile: bool(source.showPerBarVolumeProfile, false),
    showPerBarDeltaProfile: bool(source.showPerBarDeltaProfile, false),
    showPerBarProfilePoc: bool(source.showPerBarProfilePoc, true),
    perBarProfileOutline: bool(source.perBarProfileOutline, false),
    showImbalances: bool(source.showImbalances, true),
    showStackedImbalances: bool(source.showStackedImbalances, true),
    unfinishedAuctionEnabled: bool(source.unfinishedAuctionEnabled, false),
    showWick: bool(source.showWick, true),
    showBodyOutline: bool(source.showBodyOutline, true),
    showBodyFill: bool(source.showBodyFill, false),
    showEmptyPriceRows: bool(source.showEmptyPriceRows, false),
    showSummary: bool(source.showSummary, true),
    showCentreDivider: bool(source.showCentreDivider, true),
    showVolumePoc: bool(source.showVolumePoc, true),
    showDeltaPoc: bool(source.showDeltaPoc, false),
    showValueArea: bool(source.showValueArea, true),
    showVah: bool(source.showVah, false),
    showVal: bool(source.showVal, false),
    showSinglePrints: bool(source.showSinglePrints, false),
    singlePrintExtremesOnly: bool(source.singlePrintExtremesOnly, true),
    showRatio: bool(source.showRatio, false),
    showVolumeClusters: bool(source.showVolumeClusters, false),
    showBarDelta: bool(source.showBarDelta, true),
    showZeros: bool(source.showZeros, false),
    colorOnlyDominantSide: bool(source.colorOnlyDominantSide, false),
    dynamicTextSize: bool(source.dynamicTextSize, true),
    showMaxBid: bool(source.showMaxBid, false),
    showMaxAsk: bool(source.showMaxAsk, false),
    showMaxPositiveDelta: bool(source.showMaxPositiveDelta, false),
    showMaxNegativeDelta: bool(source.showMaxNegativeDelta, false),
    showMaxTrades: bool(source.showMaxTrades, false),
    showBetweenVolume: bool(source.showBetweenVolume, false),
    showVwap: bool(source.showVwap, false),
    outerEdgeMode: bool(source.outerEdgeMode, true),
    useThemeColors: bool(source.useThemeColors, true),
    perBarVolumeColor: colour(source.perBarVolumeColor, DEFAULT_FOOTPRINT_SETTINGS.perBarVolumeColor),
    perBarPositiveDeltaColor: colour(source.perBarPositiveDeltaColor, DEFAULT_FOOTPRINT_SETTINGS.perBarPositiveDeltaColor),
    perBarNegativeDeltaColor: colour(source.perBarNegativeDeltaColor, DEFAULT_FOOTPRINT_SETTINGS.perBarNegativeDeltaColor),
    perBarProfilePocColor: colour(source.perBarProfilePocColor, DEFAULT_FOOTPRINT_SETTINGS.perBarProfilePocColor),
    askColor: colour(source.askColor, DEFAULT_FOOTPRINT_SETTINGS.askColor),
    bidColor: colour(source.bidColor, DEFAULT_FOOTPRINT_SETTINGS.bidColor),
    betweenColor: colour(source.betweenColor, DEFAULT_FOOTPRINT_SETTINGS.betweenColor),
    neutralColor: colour(source.neutralColor, DEFAULT_FOOTPRINT_SETTINGS.neutralColor),
    textColor: colour(source.textColor, DEFAULT_FOOTPRINT_SETTINGS.textColor),
    pocColor: colour(source.pocColor, DEFAULT_FOOTPRINT_SETTINGS.pocColor),
    valueAreaColor: colour(source.valueAreaColor, DEFAULT_FOOTPRINT_SETTINGS.valueAreaColor),
    deltaPocColor: colour(source.deltaPocColor, DEFAULT_FOOTPRINT_SETTINGS.deltaPocColor),
    clusterColor: colour(source.clusterColor, DEFAULT_FOOTPRINT_SETTINGS.clusterColor),
    singlePrintColor: colour(source.singlePrintColor, DEFAULT_FOOTPRINT_SETTINGS.singlePrintColor),
    stackedAskColor: colour(source.stackedAskColor, DEFAULT_FOOTPRINT_SETTINGS.stackedAskColor),
    stackedBidColor: colour(source.stackedBidColor, DEFAULT_FOOTPRINT_SETTINGS.stackedBidColor),
    unfinishedAuctionColor: colour(source.unfinishedAuctionColor, DEFAULT_FOOTPRINT_SETTINGS.unfinishedAuctionColor),
    vwapColor: colour(source.vwapColor, DEFAULT_FOOTPRINT_SETTINGS.vwapColor),
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
  return loadSavedFootprintSettings(instanceId) ?? DEFAULT_FOOTPRINT_SETTINGS;
}

export function loadSavedFootprintSettings(instanceId: string): FootprintSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(footprintStorageKey(instanceId));
    return stored ? validateFootprintSettings(JSON.parse(stored)) : null;
  } catch {
    return null;
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
