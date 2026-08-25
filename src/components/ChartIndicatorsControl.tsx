"use client";

import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  BookmarkPlus,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Search,
  Save,
  Settings2,
  Star,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  CHART_INDICATOR_BY_ID,
  CHART_INDICATOR_CATALOG,
  CHART_INDICATOR_CATEGORIES,
  type ChartIndicatorCategory,
  type ChartIndicatorInstance,
} from "@/lib/chartIndicatorCatalog";
import {
  INDICATOR_NUMERIC_SETTINGS,
  LIVE_CHART_INDICATOR_IDS,
  VOLUME_PROFILE_INDICATOR_IDS,
  defaultIndicatorSettings,
} from "@/lib/chartIndicatorConfig";
import type { ChartSettings } from "@/lib/chartSettings";
import {
  applyFootprintPreset,
  deleteFootprintTemplate,
  loadSavedFootprintSettings,
  loadFootprintSelection,
  loadFootprintTemplates,
  saveFootprintSelection,
  saveFootprintSettings,
  saveFootprintTemplate,
  FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW,
  footprintProfileGranularityTicks,
  validateFootprintSettings,
  type FootprintPresetName,
  type FootprintTemplate,
} from "@/lib/footprintSettings";
import ChartColorField, { isInsideChartColorPopover } from "@/components/ChartColorField";
import {
  VOLUME_PROFILE_GRADIENTS,
  VOLUME_PROFILE_GRADIENT_OFF,
  isVolumeProfileGradientActive,
} from "@/lib/volumeProfileGradients";
import { isInsideKwantSelectMenu } from "@/components/ui/KwantSelect";
import KwantSelect from "@/components/ui/KwantSelect";
import {
  FOOTPRINT_CHART_TYPES,
  footprintChartType,
  footprintSettingApplies,
  footprintSettingSection,
  groupFootprintSettingRows,
  footprintVariant,
  footprintVariantSettings,
} from "@/lib/footprintChartTypes";
import { PULLING_STACKING_PRESETS } from "@/lib/pullingStacking";
import { zeroGammaSourceChoices } from "@/lib/zeroGammaLine";
import { ABSORPTION_PRESETS } from "@/lib/absorptionDetector";
import { STACKED_IMBALANCE_PRESETS } from "@/lib/stackedImbalanceSuite";
import { ICEBERG_REFRESH_PRESETS } from "@/lib/icebergRefreshDetector";
import { LIQUIDITY_STOP_SWEEP_PRESETS } from "@/lib/liquidityStopSweepDetector";
import { POC_AUCTION_PRESETS } from "@/lib/pocAuctionSuite";
import { TAPE_SPEED_PRESETS } from "@/lib/tapeSpeedOrderFlowBurst";
import IndicatorTemplateBar from "@/components/IndicatorTemplateBar";
import { STATS_PALETTES, resolveStatsPalette, statsPaletteSettings } from "@/lib/statsPalettes";

const FAVOURITES_STORAGE_KEY = "kwantdesk-chart-indicator-favourites";

type VolumeProfileSettingsTab =
  | "general"
  | "data"
  | "plot"
  | "point-of-control"
  | "value-area"
  | "peak-valley"
  | "vwap"
  | "summary"
  | "sessions";

const VOLUME_PROFILE_SETTINGS_TABS: { id: VolumeProfileSettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "data", label: "Data settings" },
  { id: "plot", label: "Plot settings" },
  { id: "point-of-control", label: "Point of control" },
  { id: "value-area", label: "Value area" },
  { id: "peak-valley", label: "Peak and valley" },
  { id: "vwap", label: "VWAP" },
  { id: "summary", label: "Summary" },
  { id: "sessions", label: "Filter / split time" },
];

const FOOTPRINT_PROFILE_MANAGED_SETTINGS = new Set([
  "showPerBarVolumeProfile",
  "showPerBarDeltaProfile",
  "perBarProfileScaleMode",
  "perBarProfileTicksPerRow",
  "perBarProfileWidthPercent",
  "perBarProfileGap",
  "perBarProfileExtraSpacing",
  "perBarProfileOpacity",
  "showPerBarProfilePoc",
  "perBarProfilePocSize",
  "perBarProfileOutline",
  "perBarVolumeColor",
  "perBarPositiveDeltaColor",
  "perBarNegativeDeltaColor",
  "perBarProfilePocColor",
]);

const TPO_PRESETS = [
  {
    label: "Classic 30m",
    settings: { subperiodMinutes: 30, displayType: "blocks", splitMode: "none", groupingMode: "automatic", valueAreaPercent: 70 },
  },
  {
    label: "Letter profile",
    settings: { subperiodMinutes: 30, displayType: "letters", splitMode: "none", groupingMode: "automatic", valueAreaPercent: 70 },
  },
  {
    label: "Bid / Ask split",
    settings: { displayType: "blocks", splitMode: "all", colourCalculation: "delta", colourReference: "fading" },
  },
  {
    label: "Developing auction",
    settings: { showDevelopingPoc: true, showDevelopingValueArea: true, pocLineMode: "developing", showInitialBalance: true },
  },
] as const;
const DAILY_TPO_SESSION_PRESETS = [
  {
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
const VOLUME_PROFILE_TEMPLATES_STORAGE_KEY = "kwantdesk:volume-profile-templates:v1";

type VolumeProfileTemplate = {
  id: string;
  name: string;
  savedAt: string;
  settings: Record<string, number | string | boolean>;
};

function readVolumeProfileTemplates(): VolumeProfileTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VOLUME_PROFILE_TEMPLATES_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is VolumeProfileTemplate => Boolean(
        item && typeof item.id === "string" && typeof item.name === "string"
        && item.settings && typeof item.settings === "object",
      ))
      : [];
  } catch {
    return [];
  }
}

function persistVolumeProfileTemplates(templates: VolumeProfileTemplate[]) {
  window.localStorage.setItem(VOLUME_PROFILE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

/**
 * A template is only the profile's own settings — never its instance id or
 * pane, so importing one on another chart cannot drag the original chart's
 * identity along with it.
 */
function volumeProfileTemplatePayload(settings: Record<string, unknown> | undefined) {
  const payload: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(settings ?? {})) {
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      payload[key] = value;
    }
  }
  return payload;
}

const TPO_USER_PRESETS_STORAGE_KEY = "kwantdesk:tpo-user-presets:v1";
type TpoUserPreset = {
  id: string;
  name: string;
  indicatorId: "tpo-chart" | "weekly-tpo";
  settings: Record<string, number | string | boolean>;
};

function readTpoUserPresets() {
  if (typeof window === "undefined") return [] as TpoUserPreset[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TPO_USER_PRESETS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is TpoUserPreset => (
      item && typeof item.id === "string" && typeof item.name === "string" && item.settings && typeof item.settings === "object"
    )) : [];
  } catch {
    return [];
  }
}

function persistTpoUserPresets(presets: TpoUserPreset[]) {
  window.localStorage.setItem(TPO_USER_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

const GEX_INTERVAL_PRESETS_STORAGE_KEY = "kwantdesk:gex-interval-map-presets:v1";
type GexIntervalUserPreset = {
  id: string;
  name: string;
  settings: Record<string, number | string | boolean>;
};

function readGexIntervalUserPresets() {
  if (typeof window === "undefined") return [] as GexIntervalUserPreset[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GEX_INTERVAL_PRESETS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is GexIntervalUserPreset => (
      item && typeof item.id === "string" && typeof item.name === "string" && item.settings && typeof item.settings === "object"
    )) : [];
  } catch {
    return [];
  }
}

function persistGexIntervalUserPresets(presets: GexIntervalUserPreset[]) {
  window.localStorage.setItem(GEX_INTERVAL_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

// These studies are rendered by the shared Kwantify calculation engine in
// Kwant Desk today. The complete catalogue stays visible so no study or
// favourite is lost while feed-specific studies are connected and validated.
// Which settings page each TPO field belongs on, mirroring the desktop
// reference's left rail. Without this every TPO number landed on one "Inputs"
// page and every colour/toggle on one "Style" page — hundreds of controls in
// two undifferentiated dumps. Keys not listed fall back to General.
const TPO_SETTING_SECTIONS: Record<string, string> = {};
const assignTpoSections = (section: string, keys: readonly string[]) => {
  for (const key of keys) TPO_SETTING_SECTIONS[key] = section;
};
assignTpoSections("General", [
  "scheduleKind", "periodMode", "lengthValue", "lengthUnit", "displayType", "visualStyle", "splitMode",
  "subperiodMinutes", "profileCount", "visitSource", "groupingMode", "ticksPerRow",
  "autoTargetRows", "autoGroupFactor", "freezeActiveGrouping", "allowDevelopingComposite",
  "maximumMergeMembers", "maximumRenderedBlocks", "fpsCap",
  "showInitialBalance", "initialBalanceSubperiods", "initialBalanceStartSubperiod",
  "initialBalanceShowHigh", "initialBalanceShowLow", "initialBalanceShowRangeLabel",
  "initialBalanceShowExtensions", "initialBalanceExtensionMultiples",
  "initialBalanceLineColor", "initialBalanceLineWidth",
]);
assignTpoSections("Background/Text", [
  "colourCalculation", "colourReference", "minimumTextSize", "maximumTextSize",
  "fixedVolumeColor", "fixedBidColor", "fixedAskColor",
  "range1Enabled", "range1Minimum", "range1VolumeColor", "range1BidColor", "range1AskColor",
  "range2Enabled", "range2Minimum", "range2VolumeColor", "range2BidColor", "range2AskColor",
  "range3Enabled", "range3Minimum", "range3VolumeColor", "range3BidColor", "range3AskColor",
  "range4Enabled", "range4Minimum", "range4VolumeColor", "range4BidColor", "range4AskColor",
  "initialAColorEnabled", "initialAColor", "initialBColorEnabled", "initialBColor",
  "initialCColorEnabled", "initialCColor", "initialDColorEnabled", "initialDColor",
  "colorOpenEnabled", "openColor", "colorCloseEnabled", "closeColor",
  "inheritThemeColours", "profileColor", "opacityPercent", "borderWidth", "blockSize", "blockGap",
]);
assignTpoSections("Plot settings", [
  "barMarkerEnabled", "barMarkerStyle", "barMarkerWidth", "barMarkerUpColor",
  "barMarkerDownColor", "barMarkerShowOpenClose",
  "widthMode", "currentWidth", "currentOffset", "previousWidth", "previousOffset",
  "showOnRight", "mirror", "lockPosition", "showAboveBars",
]);
assignTpoSections("Point of control", [
  "showPoc", "showDevelopingPoc", "pocLineMode", "pocHighlight", "pocHighlightColor",
  "pocLineColor", "pocLineWidth", "pocExtensionMode", "developingPocStartOffset",
  "shiftedPocTicks", "pocGroupingOpacity", "showPocPriceLabel", "pocColor",
]);
assignTpoSections("Value area", [
  "showValueArea", "showDevelopingValueArea", "valueAreaPercent", "valueAreaHighlight",
  "valueAreaHighlightInside", "valueAreaOutsideColor", "valueAreaShowLines",
  "valueAreaShowBackground", "valueAreaBackgroundOpacity", "valueAreaExtensionMode",
  "valueAreaLineColor", "valueAreaLineWidth", "valueAreaShowLabels", "valueAreaColor",
  "recentLevelsOnly",
]);
assignTpoSections("Peak and valley", [
  "showPeaks", "showValleys", "peakValleyRadius", "peakMinimumProminence",
  "peakValleySensitivity", "peakValleyExcludeExtremes", "peakColor", "valleyColor",
]);
assignTpoSections("Single prints", [
  "showSinglePrints", "minimumSinglePrintTicks", "singlePrintMaxTpoCount", "singlePrintQuality",
  "singlePrintVolumeSensitivity", "includeExtremesInSinglePrints", "singlePrintLineWidth",
  "singlePrintExtensionMode", "singlePrintFillZone", "singlePrintFillOpacity",
  "singlePrintShowLabel", "singlePrintShowTestedState", "singlePrintColor",
]);
assignTpoSections("Summary", [
  "showSummary", "summaryLayout", "summaryLocation", "summaryShowVolume", "summaryShowTrades",
  "summaryShowBidAsk", "summaryTextColor", "summaryBackgroundColor",
  "summaryBackgroundOpacity", "summaryFontSize",
]);
assignTpoSections("Filter/split time", [
  "filterMode", "sessionPreset", "customSessionStart", "customSessionEnd",
  "useEndSessionAsStartDay", "timezone", "dailyStartTime", "dailyEndMode", "dailyEndTime",
  "enabledWeekdays", "weekStartDay", "weekStartTime", "weekEndMode", "weekEndDay",
  "weekEndTime", "weekLength", "customStartMs", "customEndMs", "customEndFollowsLatest",
]);

const isTpoIndicator = (id: string) => id === "tpo-chart" || id === "weekly-tpo";
const sectionForSetting = (indicatorId: string, key: string, fallback: string) =>
  (isTpoIndicator(indicatorId) ? TPO_SETTING_SECTIONS[key] ?? "General" : fallback);

export const RENDERED_CHART_INDICATOR_IDS = new Set([
  "gamma-environment",
  "vix-environment",
  "zero-gamma-line",
  "options-delta",
  "zero-gamma-bars",
  "gamma-heatmap",
  "net-gamma-exposure-by-strike",
  "gex-interval-map",
  "bounce-levels",
  "dark-pool-map",
  "dark-pool-gex",
  "implied-volatility-rank",
  "volume",
  "delta-bar",
  "delta-highlight",
  "cumulative-volume-delta",
  "cvd-divergence",
  "pulling-stacking",
  "absorption-detector",
  "stacked-imbalance-suite",
  "iceberg-refresh-detector",
  "liquidity-stop-sweep-detector",
  "poc-auction-suite",
  "tape-speed-order-flow-burst",
  "delta-cumulative-candlestick",
  "delta-cumulative-histogram",
  "imbalance-tracker",
  "imbalance-rejector",
  "moving-average",
  "vwap",
  "vwap-envelopes",
  "rolling-vwap",
  "relative-strength-index-rsi",
  "rate-of-change-roc",
  "macd-indicator",
  "momentum-indicator",
  "commodity-channel-index-cci",
  "aroon-up-down",
  "aroon-oscillator",
  "awesome-oscillator",
  "stochastic-oscillator",
  "williams-r",
  "chaikin-accumulation-distribution",
  "standard-deviation",
  "average-true-range-atr",
  "bollinger-bands",
  "donchian-channel",
  "keltner-channel",
  "sessions",
  "session-highs-lows",
  "ib-levels",
  "divergence-detector",
  "big-trades",
  "depth-of-market",
  "mini-dom",
  "deep-print-footprint",
  "kwant-stats",
  "deep-m-effort-nq",
  "kwant-profile",
  "tpo-chart",
  "weekly-tpo",
  "weekly-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
  "classic-gex-profile",
  "tpo-levels",
  "expected-move",
  "hedge-levels",
  "source-code-indicator",
]);

type Props = {
  instrument: string;
  timeframe: string;
  indicators: ChartIndicatorInstance[];
  chartSettings: ChartSettings;
  levelControls?: ChartLevelControl[];
  settingsOpenRequest?: { instanceId: string; requestId: number } | null;
  onChange: (next: ChartIndicatorInstance[]) => void;
};

export type ChartLevelControl = {
  id: "gamma" | "kwant" | "structure" | "value-area";
  label: string;
  description: string;
  badge: string;
  enabled: boolean;
  available: boolean;
  loading?: boolean;
  onToggle: () => void;
};

function readFavourites() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(FAVOURITES_STORAGE_KEY)
      ?? window.localStorage.getItem("olisa-chart-indicator-favourites")
      ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Selecting a Big Contracts mode by using its control.
 *
 * The panel has no mode dropdowns; a slider IS the choice, which is how the
 * manual minimum has always worked. Extending that to the RTH minimum and the
 * cap keeps every recovered setting reachable without a second control the
 * trader has to find first. A cap of zero returns to no capping rather than
 * leaving the mode set with nothing to act on.
 */
function bigTradeModeFor(
  indicatorId: string,
  key: string,
  value: number,
): Record<string, string> {
  if (indicatorId !== "big-trades") return {};
  if (key === "manualFilter") return { filterMode: "manual" };
  if (key === "rthManualFilter") return { rthFilterMode: "manual" };
  if (key === "cappingMaxVolume") return { cappingMode: value > 0 ? "size" : "off" };
  return {};
}

function titleFromKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isColourSetting(key: string, value: unknown) {
  return /color$/i.test(key) && typeof value === "string";
}

const bounceThemeColours = (chartSettings: ChartSettings) => ({
  positiveColor: chartSettings.upColor,
  negativeColor: chartSettings.downColor,
  kingColor: chartSettings.borderUpColor,
  developingColor: chartSettings.upColor,
  weakeningColor: chartSettings.downColor,
  airPocketColor: chartSettings.gridColor,
});

/**
 * The colours a volume profile actually paints with while it is following the
 * theme. Mirrors the renderer's own mapping, so the pickers show what is on
 * the chart rather than a stale stored value.
 */
const volumeProfileThemeColours = (chartSettings: ChartSettings) => ({
  askColor: chartSettings.upColor,
  bidColor: chartSettings.downColor,
  volumeColor: chartSettings.borderDownColor,
  valueAreaColor: chartSettings.borderUpColor,
  pocColor: chartSettings.upColor,
  peakColor: chartSettings.upColor,
  valleyColor: chartSettings.downColor,
  businessZoneColor: chartSettings.borderUpColor,
  vwapColor: chartSettings.borderUpColor,
  summaryTextColor: chartSettings.upColor,
});

/**
 * Indicators whose renderer honours `useThemeColors`.
 *
 * While that flag is on, the renderer substitutes theme colours and every
 * stored colour is ignored — so picking one appeared to do nothing at all.
 * Picking a colour is an unambiguous request for THAT colour, so it drops the
 * instance out of theme mode, seeding the other keys with the theme values
 * already on screen so nothing else visibly jumps.
 */
const themeColourMapFor = (indicatorId: string, chartSettings: ChartSettings) => {
  if (indicatorId === "bounce-levels") return bounceThemeColours(chartSettings) as Record<string, string>;
  // Big Contracts and Big Blocks paint their two sides from the theme's up and
  // down colours (see the primitive updates in Chart.tsx), so the swatches must
  // show those while theme mode is on rather than the values stored when the
  // indicator was added.
  if (indicatorId === "big-trades" || indicatorId === "deep-m-effort-nq") {
    return {
      askColor: chartSettings.upColor,
      bidColor: chartSettings.downColor,
    } as Record<string, string>;
  }
  if (VOLUME_PROFILE_INDICATOR_IDS.has(indicatorId)) {
    return volumeProfileThemeColours(chartSettings) as Record<string, string>;
  }
  return null;
};

function applyNumericIndicatorSetting(
  indicatorId: string,
  currentSettings: ChartIndicatorInstance["settings"],
  key: string,
  value: number,
) {
  const next: NonNullable<ChartIndicatorInstance["settings"]> = {
    ...(currentSettings ?? {}),
    [key]: value,
  };
  if (indicatorId !== "bounce-levels") return next;

  // Bounce Levels has paired controls. Keep them valid while the user drags a
  // slider rather than waiting for a workspace reload to normalise them. An
  // inverted pair can otherwise ask the API for an empty surface.
  if (key === "minimumDte" && value > Number(next.maximumDte ?? 7)) next.maximumDte = value;
  if (key === "maximumDte" && value < Number(next.minimumDte ?? 0)) next.minimumDte = value;
  if (key === "minimumNodeThickness" && value > Number(next.maximumNodeThickness ?? 18)) next.maximumNodeThickness = value;
  if (key === "maximumNodeThickness" && value < Number(next.minimumNodeThickness ?? 2)) next.minimumNodeThickness = value;
  if (key === "activeEnterThreshold" && value < Number(next.activeExitThreshold ?? 8)) next.activeExitThreshold = value;
  if (key === "activeExitThreshold" && value > Number(next.activeEnterThreshold ?? 15)) next.activeEnterThreshold = value;
  return next;
}

function divergenceMarketPair(instrument: string) {
  const normalized = instrument.trim().toUpperCase();
  if (/^M?NQ/.test(normalized)) return { primary: "NQ", comparison: "ES" };
  if (/^M?ES/.test(normalized)) return { primary: "ES", comparison: "NQ" };
  return null;
}

/**
 * Groups a settings dialog's blocks into clickable pages instead of one long
 * dump. Each child declares `data-settings-section`; children without one fall
 * into "General", so blocks that have not been categorised yet still render.
 * The strip only appears when a dialog actually has more than one section.
 */
function IndicatorSettingsSections({ children }: { children: ReactNode }) {
  const entries = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const props = child.props as { "data-settings-section"?: string };
    return [{ section: props["data-settings-section"] ?? "General", node: child }];
  });
  const sections: string[] = [];
  for (const entry of entries) if (!sections.includes(entry.section)) sections.push(entry.section);
  const [active, setActive] = useState(sections[0] ?? "General");
  // A dialog opened on a different indicator can have entirely different
  // sections; fall back to the first rather than rendering an empty page.
  const current = sections.includes(active) ? active : sections[0] ?? "General";
  if (sections.length <= 1) {
    return <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>;
  }
  return (
    <>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            aria-pressed={section === current}
            onClick={() => setActive(section)}
            className={`shrink-0 whitespace-nowrap px-3 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
              section === current
                ? "text-primary shadow-[inset_0_-2px_0_var(--primary)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {section}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {entries.filter((entry) => entry.section === current).map((entry) => entry.node)}
      </div>
    </>
  );
}

export default function ChartIndicatorsControl({
  instrument,
  timeframe,
  indicators,
  chartSettings,
  levelControls = [],
  settingsOpenRequest = null,
  onChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const settingsDialogOffsetRef = useRef({ x: 0, y: 0 });
  const settingsDialogDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    bodyCursor: string;
    bodyUserSelect: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"All" | ChartIndicatorCategory>("All");
  const [favourites, setFavourites] = useState<string[]>(readFavourites);
  const [rithmicStatus, setRithmicStatus] = useState<"checking" | "connected" | "fallback">("checking");
  const [footprintTemplates, setFootprintTemplates] = useState<FootprintTemplate[]>([]);
  const [footprintTemplateName, setFootprintTemplateName] = useState("");
  const [selectedFootprintPreset, setSelectedFootprintPreset] = useState<FootprintPresetName | "">("");
  const [selectedFootprintTemplateId, setSelectedFootprintTemplateId] = useState("");
  const [footprintSaveStatus, setFootprintSaveStatus] = useState("");
  const [tpoUserPresets, setTpoUserPresets] = useState<TpoUserPreset[]>([]);
  const [volumeProfileTemplates, setVolumeProfileTemplates] = useState<VolumeProfileTemplate[]>([]);
  const [volumeProfileTemplateName, setVolumeProfileTemplateName] = useState("");
  const volumeProfileImportRef = useRef<HTMLInputElement | null>(null);
  const [selectedTpoPresetId, setSelectedTpoPresetId] = useState("");
  const [tpoPresetName, setTpoPresetName] = useState("");
  const [gexIntervalUserPresets, setGexIntervalUserPresets] = useState<GexIntervalUserPreset[]>([]);
  const [selectedGexIntervalPresetId, setSelectedGexIntervalPresetId] = useState("");
  const [gexIntervalPresetName, setGexIntervalPresetName] = useState("");
  const [clientHydrated, setClientHydrated] = useState(false);
  const restoredFootprintIdsRef = useRef(new Set<string>());
  const handledSettingsOpenRequestRef = useRef<number | null>(null);

  useEffect(() => {
    setClientHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsOpenRequest) return;
    if (handledSettingsOpenRequestRef.current === settingsOpenRequest.requestId) return;
    if (!indicators.some((instance) => instance.instanceId === settingsOpenRequest.instanceId)) return;
    handledSettingsOpenRequestRef.current = settingsOpenRequest.requestId;
    setOpen(false);
    setLibraryOpen(false);
    setSettingsInstanceId(settingsOpenRequest.instanceId);
  }, [indicators, settingsOpenRequest]);

  useEffect(() => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favourites));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [favourites]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      if (target && menuRef.current?.contains(target)) return;
      if (isInsideChartColorPopover(target) || isInsideKwantSelectMenu(target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportPadding = 8;
      const width = Math.min(380, window.innerWidth - viewportPadding * 2);
      setMenuPosition({
        left: Math.max(
          viewportPadding,
          Math.min(trigger.right - width, window.innerWidth - width - viewportPadding),
        ),
        top: trigger.bottom + 6,
        width,
      });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open && !libraryOpen) return;
    let cancelled = false;
    const check = async () => {
      setRithmicStatus("checking");
      try {
        const response = await fetch("/api/institutional-market-data?path=health", {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
        if (!cancelled) setRithmicStatus(response.ok ? "connected" : "fallback");
      } catch {
        if (!cancelled) setRithmicStatus("fallback");
      }
    };
    void check();
    return () => { cancelled = true; };
  }, [libraryOpen, open]);

  useEffect(() => {
    if (!settingsInstanceId?.startsWith("deep-print-footprint-")) return;
    if (!restoredFootprintIdsRef.current.has(settingsInstanceId)) {
      restoredFootprintIdsRef.current.add(settingsInstanceId);
      const savedSettings = loadSavedFootprintSettings(settingsInstanceId);
      if (savedSettings) {
        onChange(indicators.map((instance) => instance.instanceId === settingsInstanceId
          ? { ...instance, settings: { ...(instance.settings ?? {}), ...savedSettings } }
          : instance));
      }
    }
    const templates = loadFootprintTemplates();
    const selection = loadFootprintSelection(settingsInstanceId);
    setFootprintTemplates(templates);
    setFootprintTemplateName("");
    setSelectedFootprintPreset(selection.preset);
    setSelectedFootprintTemplateId(
      templates.some((template) => template.id === selection.templateId)
        ? selection.templateId
        : "",
    );
    setFootprintSaveStatus("");
  // A locally saved footprint is restored once when this instance's settings
  // panel opens. Normal live edits continue through workspace persistence.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsInstanceId]);

  useEffect(() => {
    if (!settingsInstanceId?.startsWith("tpo-chart-") && !settingsInstanceId?.startsWith("weekly-tpo-")) return;
    setTpoUserPresets(readTpoUserPresets());
    setVolumeProfileTemplates(readVolumeProfileTemplates());
    setSelectedTpoPresetId("");
    setTpoPresetName("");
  }, [settingsInstanceId]);

  useEffect(() => {
    if (!settingsInstanceId?.startsWith("gex-interval-map-")) return;
    setGexIntervalUserPresets(readGexIntervalUserPresets());
    setSelectedGexIntervalPresetId("");
    setGexIntervalPresetName("");
  }, [settingsInstanceId]);

  useEffect(() => {
    settingsDialogOffsetRef.current = { x: 0, y: 0 };
    if (settingsDialogRef.current) {
      settingsDialogRef.current.style.transform = "translate3d(0px, 0px, 0)";
    }

    if (!settingsInstanceId && settingsDialogDragRef.current) {
      document.body.style.cursor = settingsDialogDragRef.current.bodyCursor;
      document.body.style.userSelect = settingsDialogDragRef.current.bodyUserSelect;
      settingsDialogDragRef.current = null;
    }
  }, [settingsInstanceId]);

  useEffect(() => () => {
    const drag = settingsDialogDragRef.current;
    if (!drag) return;
    document.body.style.cursor = drag.bodyCursor;
    document.body.style.userSelect = drag.bodyUserSelect;
    settingsDialogDragRef.current = null;
  }, []);

  const clampSettingsDialogOffset = (nextX: number, nextY: number) => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return { x: nextX, y: nextY };

    const current = settingsDialogOffsetRef.current;
    const rect = dialog.getBoundingClientRect();
    const baseLeft = rect.left - current.x;
    const baseTop = rect.top - current.y;
    const viewportPadding = 8;

    return {
      x: Math.max(
        viewportPadding - baseLeft,
        Math.min(nextX, window.innerWidth - viewportPadding - (baseLeft + rect.width)),
      ),
      y: Math.max(
        viewportPadding - baseTop,
        Math.min(nextY, window.innerHeight - viewportPadding - (baseTop + rect.height)),
      ),
    };
  };

  const beginSettingsDialogDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, [role='button']")) return;

    const origin = settingsDialogOffsetRef.current;
    settingsDialogDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      bodyCursor: document.body.style.cursor,
      bodyUserSelect: document.body.style.userSelect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    event.preventDefault();
  };

  const moveSettingsDialog = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = settingsDialogDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const next = clampSettingsDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY,
    );
    settingsDialogOffsetRef.current = next;
    if (settingsDialogRef.current) {
      settingsDialogRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    }
  };

  const endSettingsDialogDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = settingsDialogDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = drag.bodyCursor;
    document.body.style.userSelect = drag.bodyUserSelect;
    settingsDialogDragRef.current = null;
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // Typing in the search box always browses the ENTIRE library. The
    // category selection only scopes the browse view when no search is
    // active — searching "volume" from the Trend tab must still surface
    // every volume study.
    const pool = CHART_INDICATOR_CATALOG
      .filter((definition) => definition.id !== "source-code-indicator")
      .filter((definition) => Boolean(needle) || category === "All" || definition.category === category);
    if (!needle) {
      return pool.sort((left, right) => {
        const favouriteDifference =
          Number(favourites.includes(right.id)) - Number(favourites.includes(left.id));
        return favouriteDifference || left.name.localeCompare(right.name);
      });
    }
    // Relevance-ranked search: the closest name matches surface FIRST, and
    // trader abbreviations (CVD, VP, TPO, DOM, IB...) resolve to their
    // studies — both from a curated alias table and from each name's own
    // initials, so "cvd" beats a description that merely mentions volume.
    const aliasesFor = (definition: typeof pool[number]) => {
      const curated: Record<string, string[]> = {
        "cumulative-volume-delta": ["cvd"],
        "cvd-divergence": ["cvd", "cvd div"],
        "delta-cumulative-candlestick": ["cvd", "cdc"],
        "delta-cumulative-histogram": ["cvd", "cdh"],
        "kwant-profile": ["vp", "volume profile", "profile"],
        "weekly-volume-profile": ["vp", "wvp", "volume profile"],
        "ask-bid-volume-profile": ["vp", "volume profile"],
        "delta-profile": ["vp", "volume profile"],
        "tpo-chart": ["tpo", "market profile"],
        "weekly-tpo": ["tpo", "wtpo", "market profile"],
        "tpo-levels": ["tpo"],
        "depth-of-market": ["dom", "ladder"],
        "mini-dom": ["dom", "ladder", "book", "depth", "mini"],
        "ib-levels": ["ib", "initial balance"],
        "vwap": ["vwap"],
        "rolling-vwap": ["vwap", "rvwap"],
        "vwap-envelopes": ["vwap"],
        "relative-strength-index-rsi": ["rsi"],
        "macd-indicator": ["macd"],
        "average-true-range-atr": ["atr"],
        "commodity-channel-index-cci": ["cci"],
        "poc-auction-suite": ["poc"],
        "big-trades": ["big prints", "blocks"],
        "deep-print-footprint": ["fp", "footprint"],
        "gamma-heatmap": ["heat", "gex heat"],
        "net-gamma-exposure-by-strike": ["gex", "net gamma"],
        "zero-gamma-bars": ["zgb", "gamma bars", "zero gamma"],
        "zero-gamma-line": ["zg", "zero gamma"],
        "options-delta": ["dex", "delta bars"],
        "dark-pool-map": ["dp", "dark pool"],
        "dark-pool-gex": ["dp", "dpg"],
        "session-highs-lows": ["hod", "lod"],
        "williams-r": ["%r", "wpr"],
      };
      const initials = definition.name
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join("")
        .toLowerCase();
      return [...(curated[definition.id] ?? []), ...(initials.length >= 2 ? [initials] : [])];
    };
    const scored = pool.flatMap((definition) => {
      const name = definition.name.toLowerCase();
      const aliases = aliasesFor(definition);
      let score = 0;
      if (name === needle) score = 120;
      else if (aliases.includes(needle)) score = 110;
      else if (name.startsWith(needle)) score = 100;
      else if (aliases.some((alias) => alias.startsWith(needle))) score = 90;
      else if (name.split(/[^a-z0-9%]+/).some((word) => word.startsWith(needle))) score = 80;
      else if (name.includes(needle)) score = 60;
      else if (definition.category.toLowerCase().includes(needle)) score = 30;
      else if (definition.description.toLowerCase().includes(needle)) score = 20;
      return score > 0 ? [{ definition, score }] : [];
    });
    return scored
      .sort((left, right) => right.score - left.score
        || Number(favourites.includes(right.definition.id)) - Number(favourites.includes(left.definition.id))
        || left.definition.name.localeCompare(right.definition.name))
      .map((entry) => entry.definition);
  }, [category, favourites, search]);

  // Volume profiles carry far too many settings for one scrolling page, so the
  // dialog splits them the way the reference platform does: a row of section
  // tabs, one panel at a time. Resets to the first tab whenever a different
  // indicator's settings are opened.
  const [volumeProfileTab, setVolumeProfileTab] = useState<VolumeProfileSettingsTab>("data");
  useEffect(() => { setVolumeProfileTab("data"); }, [settingsInstanceId]);

  const settingsInstance = settingsInstanceId
    ? indicators.find((instance) => instance.instanceId === settingsInstanceId) ?? null
    : null;
  const settingsDefinition = settingsInstance
    ? CHART_INDICATOR_BY_ID.get(settingsInstance.indicatorId) ?? null
    : null;
  const activeLayerCount = indicators.length + levelControls.filter((control) => control.enabled).length;

  const indicatorsRef = useRef(indicators);
  useEffect(() => {
    indicatorsRef.current = indicators;
  }, [indicators]);

  const replace = useCallback((instanceId: string, update: (current: ChartIndicatorInstance) => ChartIndicatorInstance) => {
    const next = indicatorsRef.current.map((instance) => instance.instanceId === instanceId ? update(instance) : instance);
    indicatorsRef.current = next;
    onChange(next);
  }, [onChange]);

  /**
   * What the settings looked like when the dialog opened.
   *
   * Edits apply to the chart immediately so the trader can see them, which
   * also means there is nothing to compare against at close time unless the
   * original is kept. Discard restores exactly this.
   */
  const settingsOpenSnapshotRef = useRef<Record<string, string | number | boolean> | null>(null);
  const [unsavedSettingsPrompt, setUnsavedSettingsPrompt] = useState(false);

  useEffect(() => {
    if (!settingsInstanceId) {
      settingsOpenSnapshotRef.current = null;
      setUnsavedSettingsPrompt(false);
      return;
    }
    // Only on OPEN. Re-capturing as the instance object changes would make
    // every edit its own baseline and nothing would ever look modified.
    if (!settingsOpenSnapshotRef.current) {
      settingsOpenSnapshotRef.current = { ...(settingsInstance?.settings ?? {}) };
    }
  }, [settingsInstance, settingsInstanceId]);

  const settingsAreDirty = useCallback(() => {
    const opened = settingsOpenSnapshotRef.current;
    if (!opened || !settingsInstance) return false;
    try {
      return JSON.stringify(opened) !== JSON.stringify(settingsInstance.settings ?? {});
    } catch {
      return false;
    }
  }, [settingsInstance]);

  /** Persist and close. The footprint keeps its own local store as well. */
  const commitSettingsAndClose = useCallback(() => {
    if (settingsInstance?.indicatorId === "deep-print-footprint") {
      const validated = validateFootprintSettings(settingsInstance.settings);
      replace(settingsInstance.instanceId, (current) => ({
        ...current,
        settings: { ...(current.settings ?? {}), ...validated },
      }));
      saveFootprintSettings(settingsInstance.instanceId, validated);
    }
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
    settingsOpenSnapshotRef.current = null;
    setUnsavedSettingsPrompt(false);
    setSettingsInstanceId(null);
  }, [replace, settingsInstance]);

  const discardSettingsAndClose = useCallback(() => {
    const opened = settingsOpenSnapshotRef.current;
    if (opened && settingsInstance) {
      replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...opened } }));
    }
    settingsOpenSnapshotRef.current = null;
    setUnsavedSettingsPrompt(false);
    setSettingsInstanceId(null);
  }, [replace, settingsInstance]);

  const closeSettingsDialog = useCallback(() => {
    // Clicking away used to save silently, which is fine until it is not: a
    // slider nudged by accident on the way past became the new setting with
    // nothing said. Ask when anything actually changed.
    if (settingsAreDirty()) {
      setUnsavedSettingsPrompt(true);
      return;
    }
    commitSettingsAndClose();
  }, [commitSettingsAndClose, settingsAreDirty]);

  useEffect(() => {
    if (!settingsInstanceId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && settingsDialogRef.current?.contains(target)) return;
      // The colour picker popover and KwantSelect menus are portaled outside
      // the dialog DOM but belong to it — interacting with them must not
      // close the settings (this silently swallowed dropdown choices like
      // the Gamma Environment position).
      if (isInsideChartColorPopover(target)) return;
      if (isInsideKwantSelectMenu(target)) return;
      closeSettingsDialog();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSettingsDialog();
    };

    // Keep the transparent overlay non-blocking so traders can still inspect
    // and manipulate the chart. A capture listener closes the floating window
    // on the same outside interaction without swallowing that chart input.
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeSettingsDialog, settingsInstanceId]);

  const add = (indicatorId: string) => {
    if (!RENDERED_CHART_INDICATOR_IDS.has(indicatorId)) return;
    const existing = indicators.find((instance) => instance.indicatorId === indicatorId);
    if (existing) {
      replace(existing.instanceId, (instance) => ({ ...instance, enabled: true }));
      return;
    }
    onChange([
      ...indicators,
      {
        instanceId: `${indicatorId}-${crypto.randomUUID()}`,
        indicatorId,
        enabled: true,
        settings: defaultIndicatorSettings(indicatorId, chartSettings),
      },
    ]);
  };

  const toggleLibraryIndicator = (indicatorId: string) => {
    const matchingInstances = indicators.filter((instance) => instance.indicatorId === indicatorId);
    if (matchingInstances.length === 0) {
      add(indicatorId);
      return;
    }

    const matchingInstanceIds = new Set(matchingInstances.map((instance) => instance.instanceId));
    if (settingsInstanceId && matchingInstanceIds.has(settingsInstanceId)) {
      setSettingsInstanceId(null);
    }
    onChange(indicators.filter((instance) => !matchingInstanceIds.has(instance.instanceId)));
  };

  const toggleFavourite = (indicatorId: string) => {
    setFavourites((current) =>
      current.includes(indicatorId)
        ? current.filter((candidate) => candidate !== indicatorId)
        : [...current, indicatorId]);
  };

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-label="Chart indicators"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={`kwant-chart-row-control flex h-7 items-center gap-1.5 rounded-[3px] border border-transparent px-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.075em] transition-colors ${
            open
              ? "text-primary"
              : "text-muted hover:bg-surface hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Indicators</span>
          {clientHydrated && activeLayerCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] text-primary">
              {activeLayerCount}
            </span>
          ) : null}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

      </div>

      {open && menuPosition && typeof document !== "undefined" ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[10000] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60"
            style={{ left: menuPosition.left, top: menuPosition.top, width: menuPosition.width }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-[12px] font-semibold text-foreground">Chart indicators</div>
              <button
                type="button"
                onClick={() => {
                  setLibraryOpen(true);
                  setOpen(false);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-semibold text-background"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {levelControls.length ? (
                <section className="border-b border-border p-3">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-muted">KwantDesk levels</span>
                    <span className="text-[8px] text-muted">{levelControls.filter((control) => control.enabled).length} active</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {levelControls.map((control) => (
                      <button
                        key={control.id}
                        type="button"
                        disabled={!control.available}
                        aria-pressed={control.enabled}
                        onClick={control.onToggle}
                        className={`flex min-h-[68px] items-start gap-2 rounded-xl border p-2.5 text-left transition-colors ${
                          !control.available
                            ? "cursor-not-allowed border-border bg-background/35 opacity-40"
                            : control.enabled
                              ? "border-primary/35 bg-primary/[0.09] text-foreground"
                              : "border-border bg-surface/35 text-muted hover:border-primary/25 hover:text-foreground"
                        }`}
                      >
                        <span className={`flex h-7 min-w-7 items-center justify-center rounded-lg border font-mono text-[9px] font-black ${
                          control.enabled
                            ? "border-primary/35 bg-primary/15 text-primary"
                            : "border-border bg-background text-muted"
                        } ${control.loading ? "animate-pulse" : ""}`}>
                          {control.badge}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold">{control.label}</span>
                          <span className="mt-1 block line-clamp-2 text-[8px] leading-3 text-muted">{control.loading ? "Loading latest levelsâ€¦" : control.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {indicators.length ? (
              <div className="p-2">
                {indicators.map((instance) => {
                  const definition = CHART_INDICATOR_BY_ID.get(instance.indicatorId);
                  if (!definition) return null;
                  const displayName = instance.indicatorId === "source-code-indicator"
                    ? String(instance.settings?.scriptName ?? definition.name)
                    : definition.name;
                  return (
                    <div key={instance.instanceId} className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface/60">
                      <button
                        type="button"
                        onClick={() => replace(instance.instanceId, (current) => ({ ...current, enabled: !current.enabled }))}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                          instance.enabled
                            ? "border-primary/25 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted"
                        }`}
                        title={instance.enabled ? "Indicator on" : "Indicator off"}
                      >
                        {instance.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate text-[11px] font-medium ${instance.enabled ? "text-foreground" : "text-muted"}`}>
                          {displayName}
                        </div>
                        <div className="mt-0.5 truncate text-[8px] uppercase tracking-[0.12em] text-muted/70">
                          {definition.category} · live
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavourite(definition.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-primary"
                        title="Favourite"
                      >
                        <Star className={`h-3.5 w-3.5 ${favourites.includes(definition.id) ? "fill-current text-primary" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsInstanceId(instance.instanceId);
                          setOpen(false);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground"
                        title="Settings"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(indicators.filter((candidate) => candidate.instanceId !== instance.instanceId))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3">
                <button
                  type="button"
                  onClick={() => {
                    setLibraryOpen(true);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 px-4 py-5 text-[11px] font-medium text-muted hover:border-primary/30 hover:text-foreground"
                >
                  <Plus className="h-4 w-4 text-primary" />
                  Add an indicator
                </button>
              </div>
              )}
            </div>
          </div>,
          document.body,
        ) : null}

      {libraryOpen && typeof document !== "undefined" ? createPortal(
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]"
          onClick={() => setLibraryOpen(false)}
        >
          <div
            className="flex h-[min(760px,88vh)] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="h-4 w-4" />
              </span>
              <div className="text-[15px] font-semibold text-foreground">Indicator library</div>
              <div className="ml-auto flex h-8 w-[360px] items-center gap-2 border border-border bg-surface px-2.5 transition-colors focus-within:border-primary/50">
                <Search className="h-3.5 w-3.5 text-muted" />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search CVD, volume, VWAP..."
                  spellCheck={false}
                  // Chrome ignores autoComplete="off" on a plain text input and
                  // still offers its own suggestion list; an unknown token and
                  // the manager opt-outs keep that overlay off a search field.
                  autoComplete="one-time-code"
                  autoCorrect="off"
                  autoCapitalize="off"
                  name="kwantdesk-indicator-search"
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-form-type="other"
                  className="h-full min-w-0 flex-1 appearance-none border-0 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted/55"
                />
              </div>
              <button type="button" onClick={() => setLibraryOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1">
              <aside className="w-[190px] shrink-0 border-r border-border p-3">
                {(["All", ...CHART_INDICATOR_CATEGORIES] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] ${
                      category === item ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <span>{item}</span>
                  </button>
                ))}
                <div className="mt-4 rounded-xl border border-border bg-surface/35 p-3 text-[9px] leading-4 text-muted">
                  Favourites appear first. Live studies inherit the chart theme.
                </div>
              </aside>
              <section className="min-w-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 px-2 text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
                  {search.trim() ? "Search" : category}
                </div>
                <div className="space-y-1">
                  {filtered.map((definition) => {
                    const added = indicators.some((instance) => instance.indicatorId === definition.id);
                    const favourite = favourites.includes(definition.id);
                    const live = LIVE_CHART_INDICATOR_IDS.has(definition.id) && RENDERED_CHART_INDICATOR_IDS.has(definition.id);
                    return (
                      <div key={definition.id} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 hover:border-border hover:bg-surface/55">
                        <button
                          type="button"
                          onClick={() => toggleFavourite(definition.id)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            favourite ? "bg-primary/10 text-primary" : "text-muted hover:bg-background hover:text-primary"
                          }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${favourite ? "fill-current" : ""}`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[11px] font-medium text-foreground">{definition.name}</span>
                            {definition.requiresOrderFlow ? (
                              <span className="rounded-md border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[7px] font-medium uppercase tracking-[0.12em] text-primary">Order flow</span>
                            ) : null}
                            {!live ? (
                              <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-1.5 py-0.5 text-[7px] font-medium uppercase tracking-[0.12em] text-amber-300">In development</span>
                            ) : null}
                          </div>
                          <div className="mt-1 truncate text-[9px] text-muted">{definition.description}</div>
                        </div>
                        <div className="w-[150px] shrink-0 text-right text-[8px] uppercase tracking-[0.12em] text-muted/70">{definition.category}{definition.subcategory ? ` / ${definition.subcategory}` : ""}</div>
                        <button
                          type="button"
                          disabled={!live}
                          aria-pressed={added}
                          aria-label={`${added ? "Remove" : "Add"} ${definition.name}`}
                          onClick={() => toggleLibraryIndicator(definition.id)}
                          className={`flex h-8 min-w-[76px] items-center justify-center gap-1.5 rounded-lg px-3 text-[10px] font-medium ${
                            added
                              ? "bg-primary/10 text-primary hover:bg-primary/15"
                              : live
                                ? "border border-border bg-background text-foreground hover:border-primary/30"
                                : "cursor-not-allowed border border-border bg-background text-muted opacity-45"
                          }`}
                        >
                          {added ? <Check className="h-3.5 w-3.5" /> : live ? <Plus className="h-3.5 w-3.5" /> : null}
                          {added ? "Added" : live ? "Add" : "Pending"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <span className="text-[9px] text-muted">{indicators.length} saved to this chart</span>
              <button type="button" onClick={() => setLibraryOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-[10px] font-semibold text-background">Done</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {settingsInstance && settingsDefinition && typeof document !== "undefined" ? createPortal(
        <div
          data-indicator-settings-overlay
          className="pointer-events-none fixed inset-0 z-[2800] flex items-center justify-center bg-transparent p-4"
        >
          <div
            ref={settingsDialogRef}
            data-indicator-settings-dialog
            className="pointer-events-auto relative flex max-h-[88vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60"
          >
            <div
              className="flex touch-none select-none items-center justify-between border-b border-border px-5 py-4 cursor-move active:cursor-grabbing"
              title="Drag settings window"
              onPointerDown={beginSettingsDialogDrag}
              onPointerMove={moveSettingsDialog}
              onPointerUp={endSettingsDialogDrag}
              onPointerCancel={endSettingsDialogDrag}
            >
              <div>
                <div className="text-[15px] font-semibold text-foreground">{settingsInstance.indicatorId === "source-code-indicator" ? String(settingsInstance.settings?.scriptName ?? settingsDefinition.name) : settingsDefinition.name}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{settingsDefinition.category} · live calculation</div>
              </div>
              {unsavedSettingsPrompt ? (
                <div className="absolute inset-0 z-[60] flex items-center justify-center rounded-xl bg-background/85 p-4 backdrop-blur-sm">
                  <div className="w-full max-w-[300px] rounded-xl border border-border bg-panel p-4 shadow-2xl">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">Unsaved changes</span>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-muted">
                      Keep the changes to {settingsDefinition?.name ?? "this indicator"}?
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUnsavedSettingsPrompt(false)}
                        className="h-8 rounded-lg border border-border text-[9px] font-semibold uppercase tracking-[0.08em] text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={discardSettingsAndClose}
                        className="h-8 rounded-lg border border-border text-[9px] font-semibold uppercase tracking-[0.08em] text-danger hover:bg-danger/10"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={commitSettingsAndClose}
                        className="h-8 rounded-lg bg-primary text-[9px] font-semibold uppercase tracking-[0.08em] text-background"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <button type="button" onClick={closeSettingsDialog} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <IndicatorSettingsSections>
              <label className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3">
                <span>
                  <span className="block text-[11px] font-medium text-foreground">Visible</span>
                  <span className="mt-0.5 block text-[9px] text-muted">Show this indicator on the active chart</span>
                </span>
                <button
                  type="button"
                  onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, enabled: !current.enabled }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${settingsInstance.enabled ? "bg-primary" : "bg-surface"}`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${settingsInstance.enabled ? "left-6" : "left-1"}`} />
                </button>
              </label>

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id)
                || isTpoIndicator(settingsDefinition.id) ? (
                <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <span className="block text-[11px] font-medium text-foreground">Gradient scheme</span>
                    <span className="mt-0.5 block text-[9px] leading-4 text-muted">
                      Fades the whole profile from one colour to the other across its own range. While a
                      scheme is on it owns every profile colour, so the individual pickers are locked.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    <button
                      type="button"
                      aria-pressed={!isVolumeProfileGradientActive(settingsInstance.settings?.gradientPreset)}
                      onClick={() => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), gradientPreset: VOLUME_PROFILE_GRADIENT_OFF },
                      }))}
                      className={`h-9 border px-2 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                        isVolumeProfileGradientActive(settingsInstance.settings?.gradientPreset)
                          ? "border-border bg-background text-muted hover:border-primary/25 hover:text-foreground"
                          : "border-primary/55 bg-primary/10 text-primary"
                      }`}
                    >
                      Off
                    </button>
                    {VOLUME_PROFILE_GRADIENTS.map((gradient) => {
                      const active = String(settingsInstance.settings?.gradientPreset ?? "") === gradient.id;
                      return (
                        <button
                          key={gradient.id}
                          type="button"
                          aria-pressed={active}
                          title={gradient.label}
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), gradientPreset: gradient.id },
                          }))}
                          className={`relative h-9 overflow-hidden border text-[9px] font-semibold transition-colors ${
                            active ? "border-primary" : "border-border hover:border-primary/35"
                          }`}
                        >
                          <span
                            aria-hidden
                            className="absolute inset-0"
                            style={{ background: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})` }}
                          />
                          <span className="relative z-10 px-1 text-[8px] uppercase tracking-[0.08em] text-white mix-blend-difference">
                            {gradient.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) ? (
                <div className="flex gap-1 overflow-x-auto border-b border-border pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {VOLUME_PROFILE_SETTINGS_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setVolumeProfileTab(tab.id)}
                      aria-pressed={volumeProfileTab === tab.id}
                      className={`h-8 shrink-0 whitespace-nowrap border px-3 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                        volumeProfileTab === tab.id
                          ? "border-primary/55 bg-primary/10 text-primary"
                          : "border-transparent bg-background text-muted hover:border-border hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "general" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Typology</div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Profile type</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.profileMode ?? "volume")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), profileMode: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Profile type"
                    >
                      <option value="volume">Volume</option>
                      <option value="bid-ask">Ask / bid volume</option>
                      <option value="delta">Delta</option>
                      <option value="delta-volume">Delta and total volume</option>
                      <option value="delta-percentage">Delta percentage</option>
                    </KwantSelect>
                  </label>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Volume is the plain traded-volume profile. Delta and total volume adds the signed delta bar beside it; delta percentage scales that delta by the row&apos;s own volume, so a thin one-sided row reads as strongly as a heavy balanced one.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "general" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Templates</div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Apply a saved template</span>
                    <KwantSelect
                      value=""
                      onChange={(event) => {
                        const template = volumeProfileTemplates.find((candidate) => candidate.id === event.target.value);
                        if (!template) return;
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), ...template.settings },
                        }));
                        setVolumeProfileTemplateName(template.name);
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Saved templates"
                    >
                      <option value="">
                        {volumeProfileTemplates.length ? "Choose a template" : "No saved templates"}
                      </option>
                      {volumeProfileTemplates.map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Template name</span>
                    <input
                      value={volumeProfileTemplateName}
                      onChange={(event) => setVolumeProfileTemplateName(event.target.value)}
                      placeholder="Daily volume · my setup"
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const name = volumeProfileTemplateName.trim();
                      if (!name) return;
                      const payload = volumeProfileTemplatePayload(settingsInstance.settings);
                      // Saving under an existing name overwrites it, so a
                      // trader refining a setup does not accumulate duplicates.
                      const existing = volumeProfileTemplates.find(
                        (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
                      );
                      const next = existing
                        ? volumeProfileTemplates.map((candidate) => (candidate.id === existing.id
                          ? { ...candidate, settings: payload, savedAt: new Date().toISOString() }
                          : candidate))
                        : [
                          ...volumeProfileTemplates,
                          { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), settings: payload },
                        ];
                      setVolumeProfileTemplates(next);
                      persistVolumeProfileTemplates(next);
                    }}
                    disabled={!volumeProfileTemplateName.trim()}
                    className={`h-9 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                      volumeProfileTemplateName.trim()
                        ? "border-primary/55 bg-primary/10 text-primary"
                        : "cursor-not-allowed border-border bg-background text-muted/40"
                    }`}
                  >
                    Save template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = volumeProfileTemplateName.trim().toLowerCase();
                      const target = volumeProfileTemplates.find(
                        (candidate) => candidate.name.toLowerCase() === name,
                      );
                      if (!target) return;
                      const next = volumeProfileTemplates.filter((candidate) => candidate.id !== target.id);
                      setVolumeProfileTemplates(next);
                      persistVolumeProfileTemplates(next);
                      setVolumeProfileTemplateName("");
                    }}
                    className="h-9 border border-border bg-background px-2 text-[8px] uppercase tracking-[0.1em] text-muted hover:text-foreground"
                  >
                    Delete template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const payload = {
                        kind: "kwantdesk-volume-profile-template",
                        version: 1,
                        name: volumeProfileTemplateName.trim() || settingsDefinition.name,
                        savedAt: new Date().toISOString(),
                        settings: volumeProfileTemplatePayload(settingsInstance.settings),
                      };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `${payload.name.replace(/[^\w.-]+/g, "-").toLowerCase()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="h-9 border border-border bg-background px-2 text-[8px] uppercase tracking-[0.1em] text-muted hover:text-foreground"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={() => volumeProfileImportRef.current?.click()}
                    className="h-9 border border-border bg-background px-2 text-[8px] uppercase tracking-[0.1em] text-muted hover:text-foreground"
                  >
                    Import
                  </button>
                  <input
                    ref={volumeProfileImportRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      try {
                        const parsed = JSON.parse(await file.text());
                        const settings = volumeProfileTemplatePayload(parsed?.settings);
                        // An empty or foreign file leaves the profile alone
                        // rather than clearing it to defaults.
                        if (!Object.keys(settings).length) return;
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), ...settings },
                        }));
                        const name = typeof parsed?.name === "string" ? parsed.name : file.name.replace(/\.json$/i, "");
                        setVolumeProfileTemplateName(name);
                        const next = [
                          ...volumeProfileTemplates.filter((candidate) => candidate.name.toLowerCase() !== name.toLowerCase()),
                          { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), settings },
                        ];
                        setVolumeProfileTemplates(next);
                        persistVolumeProfileTemplates(next);
                      } catch {
                        // A malformed file is ignored; the profile keeps its settings.
                      }
                    }}
                  />
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    A template stores this profile&apos;s settings only — never its chart or pane — so it can be applied to any profile on any chart. Saving under an existing name overwrites it. Templates sync with your account; export writes a JSON file you can share.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id)
                && volumeProfileTab === "general"
                && settingsDefinition.id !== "custom-draw-on-volume-profile" ? (
                <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block text-[11px] font-medium text-foreground">Fix profile to chart edge</span>
                      <span className="mt-0.5 block text-[9px] leading-4 text-muted">
                        Keep the active profile visible after its session anchor leaves the viewport.
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Fix volume profile to chart edge"
                      aria-pressed={String(settingsInstance.settings?.snapMode ?? "left") !== "off"}
                      onClick={() => replace(settingsInstance.instanceId, (current) => {
                        const snapMode = String(current.settings?.snapMode ?? "left");
                        return {
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            snapMode: snapMode === "off" ? "left" : "off",
                          },
                        };
                      })}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        String(settingsInstance.settings?.snapMode ?? "left") !== "off"
                          ? "bg-primary"
                          : "bg-surface"
                      }`}
                    >
                      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${
                        String(settingsInstance.settings?.snapMode ?? "left") !== "off" ? "left-6" : "left-1"
                      }`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Volume profile edge">
                    {(["left", "right"] as const).map((side) => {
                      const snapMode = String(settingsInstance.settings?.snapMode ?? "left");
                      const enabled = snapMode !== "off";
                      const selected = snapMode === side;
                      return (
                        <button
                          key={side}
                          type="button"
                          disabled={!enabled}
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), snapMode: side },
                          }))}
                          className={`h-9 rounded-lg border text-[10px] font-medium transition-colors ${
                            selected
                              ? "border-primary/45 bg-primary/12 text-primary"
                              : "border-border bg-background text-muted hover:border-primary/25 hover:text-foreground"
                          } ${enabled ? "" : "cursor-not-allowed opacity-35"}`}
                        >
                          {side === "left" ? "Left edge" : "Right edge"}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[8px] leading-4 text-muted">
                    Off leaves every profile at its true historical session position. Left keeps the latest profile on the left once you scroll beyond it; Right docks the latest profile to the right.
                  </p>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "data" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Data settings</div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Input data</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.inputData ?? "volume")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), inputData: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Input data"
                    >
                      <option value="volume">Volume</option>
                      <option value="trades">Number of trades</option>
                      <option value="aggregate-trades" disabled>Aggregate trades — needs MBO</option>
                      <option value="order" disabled>Order — needs MBO</option>
                      <option value="number-orders" disabled>Number of orders — needs MBO</option>
                    </KwantSelect>
                  </label>
                  {([
                    ["Filter min", "minTradeVolume", 0],
                    ["Filter max", "maxTradeVolume", 0],
                  ] as const).map(([label, key, fallback]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={Number(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => {
                          const next = Math.max(0, Math.round(Number(event.target.value) || 0));
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: next },
                          }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  ))}
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Tick grouping</div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Auto grouping</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.groupingMode ?? "automatic")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), groupingMode: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Auto grouping"
                    >
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </KwantSelect>
                  </label>
                  {([
                    ["Auto group factory", "autoGroupFactor", 1, "automatic"],
                    ["Manual ticks", "groupTicks", 4, "manual"],
                  ] as const).map(([label, key, fallback, mode]) => {
                    const activeMode = String(settingsInstance.settings?.groupingMode ?? "automatic");
                    const applies = activeMode === mode;
                    return (
                      <label key={key} className={`space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted ${applies ? "" : "opacity-40"}`}>
                        <span>{label}</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          disabled={!applies}
                          value={Number(settingsInstance.settings?.[key] ?? fallback)}
                          onChange={(event) => {
                            const next = Math.max(1, Math.round(Number(event.target.value) || fallback));
                            replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: { ...(current.settings ?? {}), [key]: next },
                            }));
                          }}
                          className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40 disabled:cursor-not-allowed"
                        />
                      </label>
                    );
                  })}
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Order-based inputs need order-by-order (MBO) data, which this feed does not carry — they stay disabled rather than silently counting trades instead. Filter min and max bound the trade sizes that reach the profile; max 0 means no upper bound. Automatic sizes each row from the range the profile covers and multiplies it by the group factory. Manual pins every row to a fixed number of ticks.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "peak-valley" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Peak and valley</div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {([
                      ["showPeaks", "Peaks"],
                      ["showValleys", "Valleys"],
                      ["showBusinessZone", "Business zone"],
                      ["pvExcludeHighLow", "Exclude high/low"],
                    ] as const).map(([key, label]) => {
                      const defaultOn = key === "pvExcludeHighLow";
                      const enabled = defaultOn
                        ? settingsInstance.settings?.[key] !== false
                        : settingsInstance.settings?.[key] === true;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: !enabled },
                          }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                  {([
                    ["Sensitivity", "pvSensitivity", 40, 0, 100],
                    ["Peak min volume %", "peakMinVolumePercent", 0, 0, 100],
                    ["Valley max volume %", "valleyMaxVolumePercent", 100, 0, 100],
                    ["Business zone opacity", "businessZoneOpacity", 18, 2, 100],
                  ] as const).map(([label, key, fallback, min, max]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={1}
                        value={Number(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => {
                          const next = Math.min(max, Math.max(min, Math.round(Number(event.target.value) || 0)));
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: next },
                          }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  ))}
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {([
                      ["peakOnlyOutsideValueArea", "Peaks outside VA only"],
                      ["valleyOnlyOutsideValueArea", "Valleys outside VA only"],
                    ] as const).map(([key, label]) => {
                      const enabled = settingsInstance.settings?.[key] === true;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: !enabled },
                          }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>

                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "vwap" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">VWAP</div>
                  {([
                    ["VWAP band 1 (σ)", "vwapBand1", 1],
                    ["VWAP band 2 (σ)", "vwapBand2", 2],
                    ["VWAP band 3 (σ)", "vwapBand3", 0],
                    ["Line width", "vwapLineWidth", 1],
                  ] as const).map(([label, key, fallback]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={key === "vwapLineWidth" ? 1 : 0.5}
                        value={Number(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => {
                          const raw = Number(event.target.value);
                          const next = Math.min(10, Math.max(0, Number.isFinite(raw) ? raw : fallback));
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: next },
                          }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "summary" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Summary</div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {([
                      ["showSummary", "Summary block", false],
                      ["showSummaryVolume", "Summary volume", true],
                      ["showSummaryTrades", "Summary trades", false],
                    ] as const).map(([key, label, defaultOn]) => {
                      const enabled = defaultOn
                        ? settingsInstance.settings?.[key] !== false
                        : settingsInstance.settings?.[key] === true;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: !enabled },
                          }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Peaks are high-volume nodes and valleys are low-volume ones; sensitivity raises how fine a feature counts. The business zone is the band between the outermost peaks. VWAP is this profile&apos;s own volume-weighted average price — set a band to 0 to hide it, and enable Show Vwap Bands to draw them. Summary needs Show Summary switched on.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "sessions" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Filter / split time</div>
                  {([
                    ["Filter mode", "filterMode", "none", [
                      ["none", "None · whole session"],
                      ["filter", "Filter · keep the window"],
                      ["splitted", "Splitted · per session"],
                      ["triple", "Triple · Asia / London / NY"],
                    ]],
                    ["Filter time", "filterTime", "rth", [
                      ["rth", "RTH · cash session"],
                      ["eth", "Overnight"],
                      ["custom", "Custom window"],
                    ]],
                  ] as const).map(([label, key, fallback, options]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [key]: event.target.value },
                        }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={label}
                      >
                        {options.map(([value, optionLabel]) => (
                          <option key={value} value={value}>{optionLabel}</option>
                        ))}
                      </KwantSelect>
                    </label>
                  ))}
                  {/*
                    * Sessions are picked directly, not unlocked by a dropdown.
                    *
                    * These ticks used to be hidden until Filter mode was set to
                    * "triple", so the only way to reach "just draw me Asia and
                    * New York" was to already know that a control named Filter
                    * mode governed it. Clicking a session now arms the split
                    * itself, and clearing the last one returns the study to a
                    * single whole-session profile.
                    */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <span className="block text-[9px] uppercase tracking-[0.12em] text-muted">Sessions drawn</span>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        ["Asia", "sessionAsiaEnabled"],
                        ["London", "sessionLondonEnabled"],
                        ["New York", "sessionNewYorkEnabled"],
                      ] as const).map(([label, key]) => {
                        const splitting = String(settingsInstance.settings?.filterMode ?? "none") === "triple";
                        // Off the split there is one profile covering everything,
                        // so no single session reads as selected.
                        const on = splitting && settingsInstance.settings?.[key] !== false;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => replace(settingsInstance.instanceId, (current) => {
                              const settings = { ...(current.settings ?? {}) };
                              const wasSplitting = String(settings.filterMode ?? "none") === "triple";
                              if (!wasSplitting) {
                                // First pick: arm the split and start from this
                                // session alone, which is what clicking one asks
                                // for. Turning on the split with everything still
                                // enabled would draw all three.
                                settings.filterMode = "triple";
                                settings.sessionAsiaEnabled = key === "sessionAsiaEnabled";
                                settings.sessionLondonEnabled = key === "sessionLondonEnabled";
                                settings.sessionNewYorkEnabled = key === "sessionNewYorkEnabled";
                                return { ...current, settings };
                              }
                              settings[key] = settings[key] === false;
                              const noneLeft = settings.sessionAsiaEnabled === false
                                && settings.sessionLondonEnabled === false
                                && settings.sessionNewYorkEnabled === false;
                              if (noneLeft) {
                                // An empty selection would draw nothing at all,
                                // which reads as a broken study rather than a
                                // choice. Fall back to the whole session.
                                settings.filterMode = "none";
                                settings.sessionAsiaEnabled = true;
                                settings.sessionLondonEnabled = true;
                                settings.sessionNewYorkEnabled = true;
                              }
                              return { ...current, settings };
                            })}
                            aria-pressed={on}
                            className={`flex min-h-9 items-center justify-center border px-3 text-[9px] uppercase tracking-[0.12em] transition-colors ${
                              on
                                ? "border-primary/40 bg-primary/[0.10] text-primary"
                                : "border-border bg-background/55 text-muted hover:bg-surface hover:text-foreground"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="block text-[8px] leading-4 text-muted">
                      Picking a session splits the day and draws only what is selected; the rest keep their own
                      boundaries rather than absorbing the ones left out. Asia opens at the 17:00 Globex bell.
                      Clearing every session returns to one profile for the whole session.
                    </span>
                  </div>
                  {([
                    ["Session start", "sessionStartMinutes", 8 * 60 + 30],
                    ["Session end", "sessionEndMinutes", 15 * 60 + 15],
                  ] as const).map(([label, key, fallback]) => {
                    const minutes = Number(settingsInstance.settings?.[key] ?? fallback);
                    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
                    const custom = String(settingsInstance.settings?.filterTime ?? "rth") === "custom";
                    return (
                      <label key={key} className={`space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted ${custom ? "" : "opacity-40"}`}>
                        <span>{label} · exchange time</span>
                        <input
                          type="time"
                          disabled={!custom}
                          value={value}
                          onChange={(event) => {
                            const [hours, mins] = event.target.value.split(":").map(Number);
                            if (!Number.isFinite(hours) || !Number.isFinite(mins)) return;
                            replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: { ...(current.settings ?? {}), [key]: hours * 60 + mins },
                            }));
                          }}
                          className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] text-foreground outline-none focus:border-primary/40 disabled:cursor-not-allowed"
                        />
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => replace(settingsInstance.instanceId, (current) => ({
                      ...current,
                      settings: {
                        ...(current.settings ?? {}),
                        useEndSessionAsStartDay: current.settings?.useEndSessionAsStartDay !== true,
                      },
                    }))}
                    className={`h-9 border px-2 text-[8px] uppercase tracking-[0.1em] sm:col-span-2 ${
                      settingsInstance.settings?.useEndSessionAsStartDay === true
                        ? "border-primary/55 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted"
                    }`}
                  >
                    Use end session as start day · {settingsInstance.settings?.useEndSessionAsStartDay === true ? "ON" : "OFF"}
                  </button>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "point-of-control" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Point of control</div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {([
                      ["showPocLine", "POC line", true],
                      ["showPocHighlight", "Highlight row", true],
                      ["showDevelopingPoc", "Developing POC", false],
                    ] as const).map(([key, label, defaultOn]) => {
                      const enabled = defaultOn
                        ? settingsInstance.settings?.[key] !== false
                        : settingsInstance.settings?.[key] === true;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: !enabled },
                          }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                  {([
                    ["Line width", "pocLineWidth", 1, 0.5, 6, 0.5],
                    ["Highlight opacity", "pocHighlightOpacity", 55, 2, 100, 1],
                    ["Developing start · minutes into session", "developingPocStartMinutes", 0, 0, 1440, 1],
                    ["Shifted POC tick grouping", "shiftedPocTicks", 4, 1, 100, 1],
                    ["Shifted POC opacity", "shiftedPocOpacity", 35, 2, 100, 1],
                  ] as const).map(([label, key, fallback, min, max, step]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={Number(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => {
                          const raw = Number(event.target.value);
                          const next = Math.min(max, Math.max(min, Number.isFinite(raw) ? raw : fallback));
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: next },
                          }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  ))}
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Developing POC traces where control sat through the session; a start offset skips the first minutes, which are usually noise. Shifted POC grouping is the tick bucket the migration study uses.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "value-area" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Value area</div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                    {([
                      ["showValueArea", "Value area fill", true],
                      ["showValueAreaLines", "VAH / VAL lines", true],
                    ] as const).map(([key, label]) => {
                      const enabled = settingsInstance.settings?.[key] !== false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: !enabled },
                          }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                  {/*
                    * Its own toggle rather than a member of the grid above:
                    * those default ON and this defaults OFF, so it cannot
                    * share their `!== false` reading.
                    */}
                  <div className="sm:col-span-2">
                    {(() => {
                      const recentOnly = settingsInstance.settings?.recentLevelsOnly === true;
                      return (
                        <button
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), recentLevelsOnly: !recentOnly },
                          }))}
                          className={`h-8 w-full border px-2 text-[8px] uppercase tracking-[0.1em] ${
                            recentOnly ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"
                          }`}
                        >
                          Recent lines only · {recentOnly ? "ON" : "OFF"}
                        </button>
                      );
                    })()}
                    <span className="mt-1 block text-[8px] leading-4 text-muted">
                      Keeps POC, VAH and VAL on the newest profile — the one still forming — and silences the
                      older ones. Their bodies stay drawn; only the extensions stop.
                    </span>
                  </div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Developing</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.valueAreaDeveloping ?? "no")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), valueAreaDeveloping: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Developing"
                    >
                      <option value="no">No</option>
                      <option value="dash">Dash</option>
                      <option value="solid">Solid</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Line width</span>
                    <input
                      type="number"
                      min={0.5}
                      max={6}
                      step={0.5}
                      value={Number(settingsInstance.settings?.valueAreaLineWidth ?? 1)}
                      onChange={(event) => {
                        const next = Math.min(6, Math.max(0.5, Number(event.target.value) || 1));
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), valueAreaLineWidth: next },
                        }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>% value area</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={Number(settingsInstance.settings?.valueAreaPercent ?? 68)}
                      onChange={(event) => {
                        const next = Math.min(100, Math.max(1, Math.round(Number(event.target.value) || 68)));
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), valueAreaPercent: next },
                        }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "sessions" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Filter keeps only the executions inside the chosen window. Triple splits the day into Asia, London and New York. A custom window may run past midnight — set an end earlier than the start. Use end session as start day attributes an overnight window to the date it finished on, which is what puts an Asia profile on the right trading day.
                  </div>
                </div>
              ) : null}

              {VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id) && volumeProfileTab === "plot" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-foreground sm:col-span-2">Plot settings</div>
                  {([
                    ["Extend line", "extendMode", "none", [
                      ["none", "To the next session"],
                      ["till-interaction", "Till interaction"],
                    ]],
                    ["Line style", "levelLineStyle", "dash", [
                      ["solid", "Solid"],
                      ["dash", "Dash"],
                      ["dot", "Dot"],
                      ["dash-dot", "Dash dot"],
                      ["dash-dot-dot", "Dash dot dot"],
                    ]],
                    ["Visual style", "visualStyle", "automatic", [
                      ["automatic", "Automatic"],
                      ["solid", "Solid"],
                      ["hollow", "Hollow"],
                      ["line", "Line"],
                      ["combined", "Combined"],
                    ]],
                  ] as const).map(([label, key, fallback, options]) => (
                    <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{label}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[key] ?? fallback)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [key]: event.target.value },
                        }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={label}
                      >
                        {options.map(([value, optionLabel]) => (
                          <option key={value} value={value}>{optionLabel}</option>
                        ))}
                      </KwantSelect>
                    </label>
                  ))}
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Level labels</span>
                    <KwantSelect
                      value={
                        settingsInstance.settings?.showLevelLabels === false
                          ? "off"
                          : String(settingsInstance.settings?.levelLabelSide) === "left" ? "left" : "right"
                      }
                      onChange={(event) => {
                        const choice = event.target.value;
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            showLevelLabels: choice !== "off",
                            ...(choice === "off" ? {} : { levelLabelSide: choice }),
                          },
                        }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Level labels"
                    >
                      <option value="right">Right of the line</option>
                      <option value="left">Left, beside the profile</option>
                      <option value="off">Hidden</option>
                    </KwantSelect>
                  </label>
                  <button
                    type="button"
                    onClick={() => replace(settingsInstance.instanceId, (current) => ({
                      ...current,
                      settings: {
                        ...(current.settings ?? {}),
                        showLevelLabelPrice: current.settings?.showLevelLabelPrice === false,
                      },
                    }))}
                    className={`mt-auto h-9 border px-2 text-[8px] uppercase tracking-[0.1em] ${
                      settingsInstance.settings?.showLevelLabelPrice === false
                        ? "border-border bg-background text-muted"
                        : "border-primary/55 bg-primary/10 text-primary"
                    }`}
                  >
                    Label price · {settingsInstance.settings?.showLevelLabelPrice === false ? "OFF" : "ON"}
                  </button>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Border width</span>
                    <input
                      type="number"
                      min={0.5}
                      max={6}
                      step={0.5}
                      value={Number(settingsInstance.settings?.borderWidth ?? 1)}
                      onChange={(event) => {
                        const next = Math.min(6, Math.max(0.5, Number(event.target.value) || 1));
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), borderWidth: next },
                        }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    VAH, POC and VAL are named on the plot like IB levels — set Level labels to move them beside the profile or hide them. POC, value area, peak, valley and VWAP lines carry on to the back of the profile in front — the live edge for the newest one — and are never drawn underneath it, whatever the split settings. Till interaction stops a level earlier, at the first later bar that traded back through it. Visual style paints the histogram filled, outlined, as an edge line, or both.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "implied-volatility-rank" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "balanced-30d")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings: Record<string, string | number | boolean> = preset === "zero-dte-context"
                          ? { targetMaturityDays: 1, lookBackPeriodDays: 60, showIvPercentile: false, showRawIv: true, showPriceOverlay: true, contractMode: "average-call-put", refreshSeconds: 5 }
                          : preset === "front-expiration"
                            ? { targetMaturityDays: 1, lookBackPeriodDays: 126, showIvPercentile: true, showRawIv: false, showPriceOverlay: true, contractMode: "average-call-put" }
                            : preset === "iv-rank-percentile"
                              ? { targetMaturityDays: 30, lookBackPeriodDays: 252, showIvRank: true, showIvPercentile: true }
                              : preset === "calls-vs-puts"
                                ? { targetMaturityDays: 30, lookBackPeriodDays: 252, contractMode: "call-put-split", showIvPercentile: false }
                                : preset === "minimal"
                                  ? { targetMaturityDays: 30, lookBackPeriodDays: 252, contractMode: "average-call-put", showIvRank: true, showIvPercentile: false, showRawIv: false, showPriceOverlay: false, showRegimeBands: false, showLegend: false }
                                  : preset === "event-watch"
                                    ? { targetMaturityDays: 7, lookBackPeriodDays: 90, showIvRank: true, showIvPercentile: true, showRawIv: true, showPriceOverlay: true, showRegimeBands: true, showLegend: true, refreshSeconds: 5 }
                                    : { targetMaturityDays: 30, lookBackPeriodDays: 252, contractMode: "average-call-put", showIvRank: true, showIvPercentile: false, showRawIv: false, showPriceOverlay: true, showRegimeBands: true, showLegend: true };
                        replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), preset, ...presetSettings } }));
                      }}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="IV Rank preset"
                    >
                      <option value="balanced-30d">Balanced 30D</option>
                      <option value="zero-dte-context">0DTE Context</option>
                      <option value="front-expiration">Front Expiration</option>
                      <option value="iv-rank-percentile">IV Rank + Percentile</option>
                      <option value="calls-vs-puts">Calls vs Puts</option>
                      <option value="minimal">Minimal</option>
                      <option value="event-watch">Event Watch</option>
                    </KwantSelect>
                  </label>
                  {[
                    ["Options source", "sourceTicker", [["AUTO", "Automatic (NQ → QQQ · ES → SPY)"], ["QQQ", "QQQ"], ["SPY", "SPY"], ["NDX", "NDX"], ["SPX", "SPX"], ["SPXW", "SPXW"], ["IWM", "IWM"], ["DIA", "DIA"]]],
                    ["Contract mode", "contractMode", [["average-call-put", "Average Call + Put"], ["combined", "Combined"], ["call", "Calls"], ["put", "Puts"], ["call-put-split", "Calls vs Puts"]]],
                    ["Placement", "placement", [["separate-pane", "Separate pane"], ["main-chart-overlay", "Main-chart overlay"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                    {[
                      ["IV Rank", "showIvRank", true],
                      ["True IV Percentile", "showIvPercentile", true],
                      ["Raw IV", "showRawIv", false],
                      ["Source price overlay", "showPriceOverlay", true],
                      ["Live intraday IV", "useLiveIntradayIv", true],
                      ["Carry last valid value", "carryLastValid", true],
                      ["Break at missing data", "breakAtMissingData", true],
                      ["Regime bands", "showRegimeBands", true],
                      ["Compact header", "showHeader", true],
                      ["Legend", "showLegend", true],
                      ["Current badge", "showCurrentBadge", true],
                      ["Theme colours", "useThemeColors", true],
                    ].map(([label, key, fallback]) => (
                      <label key={String(key)} className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background/55 px-3 text-[9px] text-muted">
                        <input type="checkbox" className="accent-primary" checked={Boolean(settingsInstance.settings?.[String(key)] ?? fallback)} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.checked } }))} />
                        <span>{String(label)}</span>
                      </label>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    IV Rank uses the exact current/min/max formula. IV Percentile is calculated independently from historical observations and is never approximated from rank. QuantData credentials remain server-side.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "ib-levels" ? (
                <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-medium text-foreground">Initial balance formation window</div>
                    <div className="mt-1 text-[8px] leading-4 text-muted">
                      IBH and IBL move with price during this opening window, then freeze for the remainder of that session.
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2" role="group" aria-label="Initial balance duration">
                    {([15, 30, 45, 60] as const).map((minutes) => {
                      const selected = Number(settingsInstance.settings?.durationMinutes ?? 60) === minutes;
                      return (
                        <button
                          key={minutes}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), durationMinutes: minutes },
                          }))}
                          className={`h-9 rounded-lg border font-mono text-[9px] transition-colors ${
                            selected
                              ? "border-primary/50 bg-primary/15 text-primary"
                              : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                          }`}
                        >
                          {minutes}m
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-border/60 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium text-foreground">Fibonacci on the latest IB</div>
                        <div className="mt-1 text-[8px] leading-4 text-muted">
                          Draws the 50%, 61.8% and 78.6% retracements across the most recent IB high/low. Flip Long/Short to mirror the fib.
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settingsInstance.settings?.showFib === true}
                        onClick={() => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), showFib: current.settings?.showFib !== true },
                        }))}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${settingsInstance.settings?.showFib === true ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}
                        aria-label="Toggle IB Fibonacci levels"
                      >
                        <span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${settingsInstance.settings?.showFib === true ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    {settingsInstance.settings?.showFib === true ? (
                      <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="IB Fibonacci direction">
                        {(["long", "short"] as const).map((direction) => {
                          const selected = String(settingsInstance.settings?.fibDirection ?? "long") === direction;
                          return (
                            <button
                              key={direction}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => replace(settingsInstance.instanceId, (current) => ({
                                ...current,
                                settings: { ...(current.settings ?? {}), fibDirection: direction },
                              }))}
                              className={`h-9 rounded-lg border font-mono text-[9px] uppercase transition-colors ${
                                selected
                                  ? "border-primary/50 bg-primary/15 text-primary"
                                  : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                              }`}
                            >
                              {direction}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "gamma-heatmap" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "intraday")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings = preset === "positioning"
                          ? { viewMode: "absolute", historyHours: 24, opacity: 62, intensity: 1.15, showHistorical: true, showLevels: true }
                          : preset === "flow-change"
                            ? { viewMode: "change", historyHours: 8, opacity: 76, intensity: 1.3, showHistorical: true, showLevels: true }
                            : preset === "levels"
                              ? { viewMode: "levels-only", historyHours: 24, opacity: 50, intensity: 1, showHistorical: false, showLevels: true }
                              : { viewMode: "net", historyHours: 12, opacity: 68, intensity: 1, showHistorical: true, showLevels: true };
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), preset, ...presetSettings },
                        }));
                      }}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Gamma Heatmap preset"
                    >
                      <option value="intraday">Intraday structure</option>
                      <option value="positioning">Absolute positioning</option>
                      <option value="flow-change">Exposure change</option>
                      <option value="levels">Clean levels</option>
                    </KwantSelect>
                  </label>
                  {[
                    ["Exposure", "metric", [["GAMMA", "Gamma · GEX"], ["DELTA", "Delta · DEX"], ["VANNA", "Vanna · VEX"], ["CHARM", "Charm · CHEX"]]],
                    ["View", "viewMode", [["net", "Net exposure"], ["call-put", "Call / put split"], ["absolute", "Absolute concentration"], ["change", "Exposure change"], ["hedge-pressure", "Modeled hedge pressure"], ["levels-only", "Levels only"]]],
                    ["Options source", "optionsSource", [["AUTO", "Automatic"], ["QQQ", "QQQ"], ["NDX", "NDX"], ["SPY", "SPY"], ["SPX", "SPX"], ["SPXW", "SPXW"]]],
                    ["Data source", "sourceMode", [["hybrid", "Hybrid"], ["quantdata", "QuantData"], ["databento-raw", "Databento raw"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [String(key)]: event.target.value },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Historical mapping coefficients are frozen into each snapshot. “Local GEX Sign Transition” is intentionally not labelled as a true gamma flip.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "gex-interval-map" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "balanced-intraday")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings: Record<string, string | number | boolean> = preset === "zero-dte-scalper"
                          ? { mode: "raw", baseline: "previous-bucket", expirationMode: "zero-dte", contentMode: "net", visualMode: "bubbles", aggregationPeriod: "1m", maximumPoints: 40000, maximumStrikesPerBucket: 60, currentBucketScaleMultiplier: 135, currentBucketOpacityMultiplier: 135, showLevels: true, showLevelTracks: true, showMaxPositive: true, showMaxNegative: true, showCallWall: true, showPutWall: true }
                          : preset === "build-unwind"
                            ? { mode: "difference", baseline: "previous-bucket", expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "fixed-dots", aggregationPeriod: "1m", showLevels: false, showMaxPositive: false, showMaxNegative: false, showCallWall: false, showPutWall: false }
                            : preset === "heat-ribbon"
                              ? { mode: "raw", historyMode: "current-session", expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "heat-cells", aggregationPeriod: "1m", opacity: 42, showLevels: false }
                              : preset === "full-chain-structure"
                                ? { mode: "raw", expirationMode: "all-expirations", contentMode: "net", visualMode: "bubbles", aggregationPeriod: "5m", minimumOpacity: 5, maximumDistancePoints: 0, maximumPoints: 15000, showLevels: true }
                                : preset === "minimal-nodes"
                                  ? { mode: "raw", expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "bubbles", aggregationPeriod: "1m", maximumPoints: 20000, maximumStrikesPerBucket: 20, opacity: 58, showLevels: true, showLevelTracks: true, showValues: false, showMaxPositive: true, showMaxNegative: true, showDominantAbsolute: false, showCallWall: false, showPutWall: false }
                                  : preset === "historical-replay"
                                    ? { mode: "raw", baseline: "previous-bucket", historyMode: "session-date", expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "bubbles", aggregationPeriod: "5m", highlightCurrentBucket: false, showCurrentBucketOutline: false, showLevels: true }
                                    : { mode: "raw", baseline: "previous-bucket", historyMode: "current-session", expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "bubbles", aggregationPeriod: "1m", maximumPoints: 40000, scaleMode: "visible-percentile", scalePercentile: 98, scaleTransform: "square-root", showLevels: true, showMaxPositive: true, showMaxNegative: true, showCallWall: false, showPutWall: false };
                        replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), preset, ...presetSettings } }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="GEX Interval Map preset"
                    >
                      <option value="balanced-intraday">Balanced Intraday</option>
                      <option value="zero-dte-scalper">0DTE Scalper</option>
                      <option value="build-unwind">Build / Unwind</option>
                      <option value="heat-ribbon">Heat Ribbon</option>
                      <option value="full-chain-structure">Full Chain Structure</option>
                      <option value="minimal-nodes">Minimal Nodes</option>
                      <option value="historical-replay">Historical Replay</option>
                    </KwantSelect>
                  </label>
                  {[
                    ["Options source", "sourceTicker", [["AUTO", "Automatic"], ["QQQ", "QQQ"], ["NDX", "NDX"], ["NQ", "NQ options"], ["SPY", "SPY"], ["SPX", "SPX"], ["SPXW", "SPXW"]]],
                    ["Provider interval", "aggregationPeriod", [["1m", "1 minute"], ["2m", "2 minutes"], ["3m", "3 minutes"], ["4m", "4 minutes"], ["5m", "5 minutes"], ["10m", "10 minutes"], ["15m", "15 minutes"], ["30m", "30 minutes"], ["1h", "1 hour"]]],
                    ["History", "historyMode", [["current-session", "Current / last session"], ["session-date", "Historical session date"], ["custom-range", "Custom ISO range"]]],
                    ["Mode", "mode", [["raw", "Raw exposure"], ["difference", "Exposure difference"]]],
                    ["Difference baseline", "baseline", [["previous-bucket", "Previous bucket"], ["session-open", "Session open"], ["rolling-average", "Rolling average"]]],
                    ["Expiration", "expirationMode", [["zero-dte", "0DTE"], ["zero-to-one-dte", "0–1 DTE"], ["zero-to-seven-dte", "0–7 DTE"], ["front-expiration", "Front expiration"], ["all-expirations", "All expirations"], ["custom-dte-range", "Custom DTE range"], ["specific-expirations", "Specific expirations"]]],
                    ["Visual strength basis", "visualStrengthBasis", [["percent-of-king", "Percent of King"], ["absolute-exposure", "Absolute Exposure"], ["hybrid", "Hybrid · sqrt(absolute × King %)" ]]],
                    ["Content", "contentMode", [["net", "Net"], ["call", "Calls"], ["put", "Puts"], ["gross", "Gross absolute"], ["call-put-split", "Call / put split"]]],
                    ["Mapped bins", "aggregationMode", [["exact-display-tick", "Exact display tick"], ["auto-bin", "Automatic"], ["custom-bin", "Custom bin"]]],
                    ["Visual", "visualMode", [["bubbles", "Magnitude bubbles"], ["fixed-dots", "Fixed dots"], ["heat-cells", "Heat cells"], ["horizontal-ribbons", "Horizontal ribbons"], ["hybrid", "Hybrid"]]],
                    ["Scale", "scaleMode", [["visible-maximum", "Visible maximum"], ["visible-percentile", "Visible percentile"], ["session-maximum", "Session maximum"], ["fixed-maximum", "Fixed maximum"]]],
                    ["Scale transform", "scaleTransform", [["linear", "Linear"], ["square-root", "Square root"], ["logarithmic", "Logarithmic"]]],
                    ["Negative exposure", "negativeExposurePalette", [["neutral", "Neutral / silver"], ["bearish", "Bearish chart colour"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  {String(settingsInstance.settings?.historyMode ?? "current-session") === "session-date" ? (
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                      <span>Historical session date</span>
                      <input
                        type="date"
                        value={String(settingsInstance.settings?.sessionDate ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), sessionDate: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  ) : null}
                  {String(settingsInstance.settings?.historyMode ?? "current-session") === "custom-range" ? (
                    <>
                      <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <span>Start time</span>
                        <input
                          type="datetime-local"
                          value={String(settingsInstance.settings?.startTime ?? "")}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), startTime: event.target.value } }))}
                          className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                        />
                      </label>
                      <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <span>End time</span>
                        <input
                          type="datetime-local"
                          value={String(settingsInstance.settings?.endTime ?? "")}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), endTime: event.target.value } }))}
                          className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Specific expirations · comma separated YYYY-MM-DD</span>
                    <input
                      value={String(settingsInstance.settings?.expirationDates ?? "")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), expirationDates: event.target.value } }))}
                      className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      placeholder="2026-08-15, 2026-08-21"
                    />
                  </label>
                  <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                    {[
                      ["enableAlerts", "Enable live alerts"],
                      ["alertNewLargePoint", "New large GEX point"],
                      ["alertLevelApproach", "Price approaching level"],
                      ["alertLevelTouch", "Price touching level"],
                      ["browserNotifications", "Browser notifications"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex h-9 items-center justify-between border border-border bg-background px-3 text-[9px] uppercase tracking-[0.08em] text-muted">
                        <span>{label}</span>
                        <input
                          type="checkbox"
                          checked={settingsInstance.settings?.[key] === true}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [key]: event.target.checked } }))}
                          className="accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="space-y-2 border border-border bg-background/65 p-2.5 sm:col-span-2">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground">Custom presets</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <KwantSelect
                        value={selectedGexIntervalPresetId}
                        onChange={(event) => {
                          const presetId = event.target.value;
                          setSelectedGexIntervalPresetId(presetId);
                          const preset = gexIntervalUserPresets.find((candidate) => candidate.id === presetId);
                          if (!preset) return;
                          setGexIntervalPresetName(preset.name);
                          replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...preset.settings } }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] text-foreground"
                        menuLabel="Custom GEX Interval Map preset"
                      >
                        <option value="">{gexIntervalUserPresets.length ? "Choose saved preset" : "No saved presets"}</option>
                        {gexIntervalUserPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                      </KwantSelect>
                      <input
                        value={gexIntervalPresetName}
                        onChange={(event) => setGexIntervalPresetName(event.target.value)}
                        placeholder="Preset name"
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button type="button" onClick={() => {
                        const name = gexIntervalPresetName.trim();
                        if (!name) return;
                        const preset = { id: crypto.randomUUID(), name, settings: { ...(settingsInstance.settings ?? {}) } };
                        const next = [...gexIntervalUserPresets, preset];
                        setGexIntervalUserPresets(next);
                        setSelectedGexIntervalPresetId(preset.id);
                        persistGexIntervalUserPresets(next);
                      }} className="h-8 border border-primary/35 bg-primary/10 text-[8px] font-semibold uppercase tracking-[0.08em] text-primary">Save new</button>
                      <button type="button" disabled={!selectedGexIntervalPresetId} onClick={() => {
                        const next = gexIntervalUserPresets.map((preset) => preset.id === selectedGexIntervalPresetId
                          ? { ...preset, name: gexIntervalPresetName.trim() || preset.name, settings: { ...(settingsInstance.settings ?? {}) } }
                          : preset);
                        setGexIntervalUserPresets(next);
                        persistGexIntervalUserPresets(next);
                      }} className="h-8 border border-border text-[8px] font-semibold uppercase tracking-[0.08em] text-muted disabled:opacity-35">Rename / save</button>
                      <button type="button" disabled={!selectedGexIntervalPresetId} onClick={() => {
                        const source = gexIntervalUserPresets.find((preset) => preset.id === selectedGexIntervalPresetId);
                        if (!source) return;
                        const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copy` };
                        const next = [...gexIntervalUserPresets, copy];
                        setGexIntervalUserPresets(next);
                        setSelectedGexIntervalPresetId(copy.id);
                        setGexIntervalPresetName(copy.name);
                        persistGexIntervalUserPresets(next);
                      }} className="h-8 border border-border text-[8px] font-semibold uppercase tracking-[0.08em] text-muted disabled:opacity-35">Duplicate</button>
                      <button type="button" disabled={!selectedGexIntervalPresetId} onClick={() => {
                        const next = gexIntervalUserPresets.filter((preset) => preset.id !== selectedGexIntervalPresetId);
                        setGexIntervalUserPresets(next);
                        setSelectedGexIntervalPresetId("");
                        setGexIntervalPresetName("");
                        persistGexIntervalUserPresets(next);
                      }} className="h-8 border border-danger/35 text-[8px] font-semibold uppercase tracking-[0.08em] text-danger disabled:opacity-35">Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <button type="button" onClick={() => replace(settingsInstance.instanceId, (current) => {
                      const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings(settingsDefinition.id, chartSettings);
                      const dataKeys = ["provider", "sourceTicker", "aggregationPeriod", "historyMode", "sessionDate", "startTime", "endTime", "mode", "baseline", "expirationMode", "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies", "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte", "refreshSeconds", "rollingBuckets"];
                      const next = { ...(current.settings ?? {}) };
                      for (const key of dataKeys) next[key] = defaults[key];
                      return { ...current, settings: next };
                    })} className="h-9 border border-border bg-background text-[8px] uppercase tracking-[0.08em] text-muted hover:border-primary/40 hover:text-foreground">Reset data</button>
                    <button type="button" onClick={() => replace(settingsInstance.instanceId, (current) => {
                      const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings(settingsDefinition.id, chartSettings);
                      const dataKeys = new Set(["provider", "sourceTicker", "aggregationPeriod", "historyMode", "sessionDate", "startTime", "endTime", "mode", "baseline", "expirationMode", "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies", "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte", "refreshSeconds", "rollingBuckets"]);
                      const next = { ...(current.settings ?? {}) };
                      for (const [key, value] of Object.entries(defaults)) if (!dataKeys.has(key)) next[key] = value;
                      return { ...current, settings: next };
                    })} className="h-9 border border-border bg-background text-[8px] uppercase tracking-[0.08em] text-muted hover:border-primary/40 hover:text-foreground">Reset visuals</button>
                    <button type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: defaultIndicatorSettings(settingsDefinition.id, chartSettings) }))} className="h-9 border border-primary/35 bg-primary/10 text-[8px] uppercase tracking-[0.08em] text-primary hover:bg-primary/15">Restore defaults</button>
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Every historical point keeps its contemporaneous options-to-chart mapping. Missing mapping inputs are skipped and disclosed; no fake values or Gamma Flip label is produced.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "net-gamma-exposure-by-strike" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "balanced-net-gex")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings: Record<string, string | number | boolean> = preset === "zero-dte-scalper"
                          ? { expirationMode: "zero-dte", maximumDisplayedRows: 30, barOpacity: 68, showCallWall: true, showPutWall: true, contentMode: "net" }
                          : preset === "full-chain"
                            ? { expirationMode: "all-expirations", maximumDisplayedRows: 80, barOpacity: 42, contentMode: "net" }
                            : preset === "call-put-breakdown"
                              ? { contentMode: "call-put-split", showCallWall: true, showPutWall: true }
                              : preset === "absolute-gamma"
                                ? { contentMode: "absolute-concentration", showDominantAbsolute: true, showMaxPositive: false, showMaxNegative: false }
                                : preset === "minimal-levels"
                                  ? { visualMode: "compact-line", showValues: false, showMaxPositive: true, showMaxNegative: true, showCallWall: true, showPutWall: true }
                                  : { expirationMode: "zero-to-one-dte", contentMode: "net", visualMode: "gradient", laneWidthPercent: 24, scaleTransform: "square-root", showMaxPositive: true, showMaxNegative: true };
                        replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), preset, ...presetSettings } }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Net Gamma preset"
                    >
                      <option value="balanced-net-gex">Balanced Net GEX</option>
                      <option value="zero-dte-scalper">0DTE Scalper</option>
                      <option value="full-chain">Full Chain Structure</option>
                      <option value="call-put-breakdown">Call / Put Breakdown</option>
                      <option value="absolute-gamma">Absolute Gamma</option>
                      <option value="minimal-levels">Minimal Levels</option>
                    </KwantSelect>
                  </label>
                  {[
                    ["Source ticker", "sourceTicker", [["AUTO", "Automatic"], ["QQQ", "QQQ"], ["NDX", "NDX"], ["NQ", "NQ options"], ["SPY", "SPY"], ["SPX", "SPX"], ["SPXW", "SPXW"]]],
                    ["Expiration", "expirationMode", [["zero-dte", "0DTE"], ["zero-to-one-dte", "0–1 DTE"], ["zero-to-seven-dte", "0–7 DTE"], ["front-expiration", "Front expiration"], ["all-expirations", "All expirations"], ["custom-dte-range", "Custom DTE range"], ["specific-expirations", "Specific expirations"]]],
                    ["Content", "contentMode", [["net", "Net"], ["net-with-call-put-detail", "Net + Call / Put detail"], ["call-put-split", "Call / Put split"], ["absolute-concentration", "Absolute concentration"], ["net-change", "Net change"]]],
                    ["Mapped bins", "aggregationMode", [["auto-bin", "Automatic"], ["exact-display-tick", "Exact display tick"], ["custom-bin", "Custom bin"]]],
                    ["Scaling", "scaleMode", [["visible-percentile", "Visible percentile"], ["visible-maximum", "Visible maximum"], ["all-loaded-maximum", "All loaded maximum"], ["fixed-maximum", "Fixed maximum"]]],
                    ["Scale transform", "scaleTransform", [["linear", "Linear"], ["square-root", "Square root"], ["logarithmic", "Logarithmic"]]],
                    ["Visual", "visualMode", [["gradient", "Gradient"], ["solid", "Solid"], ["outline", "Outline"], ["heat", "Heat"], ["compact-line", "Compact line"]]],
                    ["Bar height", "barHeightMode", [["automatic", "Automatic"], ["fixed-pixels", "Fixed pixels"], ["mapped-price-bin", "Mapped price bin"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Specific expirations · comma separated YYYY-MM-DD</span>
                    <input
                      value={String(settingsInstance.settings?.expirationDates ?? "")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), expirationDates: event.target.value } }))}
                      className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      placeholder="2026-08-15, 2026-08-21"
                    />
                  </label>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Uses the shared signed KwantData Gamma surface and shared strike mapper. Puts are not signed twice. Databento custom and hybrid validation stay disabled until their option-definition, IV and open-interest inputs are complete.
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => replace(settingsInstance.instanceId, (current) => {
                        const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings(settingsDefinition.id, chartSettings);
                        const next: Record<string, number | string | boolean> = { ...(current.settings ?? {}) };
                        for (const key of ["provider", "sourceTicker", "representation", "expirationMode", "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies", "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte", "refreshSeconds"]) next[key] = defaults[key];
                        return { ...current, settings: next };
                      })}
                      className="h-9 border border-border bg-background text-[8px] uppercase tracking-[0.08em] text-muted hover:border-primary/40 hover:text-foreground"
                    >
                      Reset data
                    </button>
                    <button
                      type="button"
                      onClick={() => replace(settingsInstance.instanceId, (current) => {
                        const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings(settingsDefinition.id, chartSettings);
                        const dataKeys = new Set(["provider", "sourceTicker", "representation", "expirationMode", "expirationDates", "includeWeeklies", "includeMonthlies", "includeQuarterlies", "aggregationMode", "customBinSizePoints", "minimumDte", "maximumDte", "refreshSeconds"]);
                        const next = { ...(current.settings ?? {}) };
                        for (const [key, value] of Object.entries(defaults)) if (!dataKeys.has(key)) next[key] = value;
                        return { ...current, settings: next };
                      })}
                      className="h-9 border border-border bg-background text-[8px] uppercase tracking-[0.08em] text-muted hover:border-primary/40 hover:text-foreground"
                    >
                      Reset visuals
                    </button>
                    <button
                      type="button"
                      onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: defaultIndicatorSettings(settingsDefinition.id, chartSettings) }))}
                      className="h-9 border border-primary/35 bg-primary/10 text-[8px] uppercase tracking-[0.08em] text-primary hover:bg-primary/15"
                    >
                      Restore defaults
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "bounce-levels" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "balanced-intraday")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings: Record<string, string | number | boolean> = preset === "zero-dte-scalper"
                          ? { greekMode: "GAMMA", expirationMode: "zero-dte", maximumLevels: 5, proximityWeight: 25, accumulationWeight: 25, persistenceWeight: 5, freshnessWeight: 15, refreshSeconds: 2, showDevelopingNodes: true }
                          : preset === "major-nodes-only"
                            ? { maximumLevels: 8, maximumMajorNodes: 0, showKing: true, showFloor: true, showCeiling: true, showGatekeepers: true, showMajorNodes: false, showClusters: false, showDevelopingNodes: false, showWeakeningNodes: false, showRetiredHistory: false, showAirPockets: false }
                            : preset === "fresh-bounce-levels"
                              ? { freshnessWeight: 30, persistenceWeight: 5, touchDecayFactor: 60, showTouchCount: true, showDevelopingNodes: true }
                              : preset === "node-momentum"
                                ? { accumulationWeight: 30, freshnessWeight: 5, showDevelopingNodes: true, showWeakeningNodes: true, enableAlerts: true }
                                : preset === "clean-chart"
                                  ? { glowStrength: 0, showAirPockets: false, showTouchCount: false, showRetiredHistory: false, showValues: false }
                                  : preset === "research"
                                    ? { maximumLevels: 24, topExposurePercent: 100, minimumPercentOfKing: 0, minimumRelevanceScore: 0, showAirPockets: true, showTouchCount: true, showRetiredHistory: true, showDevelopingNodes: true, showWeakeningNodes: true, showClusters: true }
                                    : { greekMode: "GAMMA", expirationMode: "zero-to-one-dte", maximumLevels: 8, topExposurePercent: 10, minimumPercentOfKing: 15, minimumRelevanceScore: 55, magnitudeWeight: 45, proximityWeight: 15, accumulationWeight: 15, persistenceWeight: 10, freshnessWeight: 10, clusterWeight: 5, showDevelopingNodes: true, showClusters: true, showAirPockets: true, refreshSeconds: 5 };
                        replace(settingsInstance.instanceId, (current) => {
                          const currentSettings = current.settings ?? {};
                          const defaults = defaultIndicatorSettings("bounce-levels", chartSettings);
                          const preserved = Object.fromEntries([
                            "provider", "sourceTicker", "useThemeColors", "syncGexMapColors", "positiveColor", "negativeColor", "kingColor",
                            "developingColor", "weakeningColor", "airPocketColor", "browserNotifications", "inAppSound",
                          ].map((key) => [key, currentSettings[key]]).filter(([, value]) => value !== undefined));
                          return { ...current, settings: { ...defaults, ...preserved, preset, ...presetSettings } };
                        });
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Bounce Levels preset"
                    >
                      <option value="balanced-intraday">Balanced Intraday</option>
                      <option value="zero-dte-scalper">0DTE Scalper</option>
                      <option value="major-nodes-only">Major Nodes Only</option>
                      <option value="fresh-bounce-levels">Fresh Bounce Levels</option>
                      <option value="node-momentum">Node Momentum</option>
                      <option value="clean-chart">Clean Chart</option>
                      <option value="research">Research</option>
                    </KwantSelect>
                  </label>
                  {([
                    ["Options source", "sourceTicker", "AUTO", [["AUTO", "Automatic for chart"], ["QQQ", "QQQ"], ["NDX", "NDX"], ["SPY", "SPY"], ["SPX", "SPX"], ["SPXW", "SPXW"], ["IWM", "IWM"]]],
                    ["Level mode", "priceMode", "live", [["live", "Live · current session"], ["eod", "EOD · previous session close"]]],
                    ["Exposure Greek", "greekMode", "GAMMA", [["GAMMA", "Gamma"], ["DELTA", "Delta"], ["VANNA", "Vanna"], ["CHARM", "Charm"]]],
                    ["Expiration window", "expirationMode", "zero-to-one-dte", [["zero-dte", "0DTE"], ["zero-to-one-dte", "0–1 DTE"], ["zero-to-seven-dte", "0–7 DTE"], ["front-expiration", "Front expiration"], ["all-expirations", "All expirations"], ["custom-dte-range", "Custom DTE range"], ["specific-expirations", "Specific expirations"]]],
                    ["Exposure sizing", "visualStrengthBasis", "percent-of-king", [["percent-of-king", "Relative to strongest node"], ["absolute-exposure", "Absolute exposure"], ["hybrid", "Hybrid · absolute + relative"]]],
                  ] as const).map(([label, key, fallback, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? fallback)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Contract universe</span>
                    <KwantSelect
                      value={settingsInstance.settings?.includeWeeklies === false
                        ? settingsInstance.settings?.includeMonthlies === false
                          ? "quarterlies-only"
                          : settingsInstance.settings?.includeQuarterlies === false ? "monthlies-only" : "monthly-quarterly"
                        : settingsInstance.settings?.includeMonthlies === false && settingsInstance.settings?.includeQuarterlies === false
                          ? "weeklies-only"
                          : "all-contracts"}
                      onChange={(event) => {
                        const universe = event.target.value;
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            includeWeeklies: universe === "all-contracts" || universe === "weeklies-only",
                            includeMonthlies: universe === "all-contracts" || universe === "monthlies-only" || universe === "monthly-quarterly",
                            includeQuarterlies: universe === "all-contracts" || universe === "quarterlies-only" || universe === "monthly-quarterly",
                          },
                        }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Contract universe"
                    >
                      <option value="all-contracts">Weeklies + monthlies + quarterlies</option>
                      <option value="weeklies-only">Weeklies only</option>
                      <option value="monthlies-only">Monthlies only</option>
                      <option value="quarterlies-only">Quarterlies only</option>
                      <option value="monthly-quarterly">Monthlies + quarterlies</option>
                    </KwantSelect>
                  </label>
                  {settingsInstance.settings?.expirationMode === "specific-expirations" ? (
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                      <span>Specific expirations · comma separated YYYY-MM-DD</span>
                      <input
                        value={String(settingsInstance.settings?.expirationDates ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), expirationDates: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                        placeholder="2026-08-21, 2026-08-28"
                      />
                    </label>
                  ) : null}
                  <div className="flex items-center justify-between gap-3 border border-border bg-background/55 px-3 py-2 sm:col-span-2">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-[0.14em] text-foreground">Link GEX Map colours</div>
                      <div className="mt-0.5 text-[9px] leading-4 text-muted">
                        Every level paints the exact colour its strike shows on the GEX Map — same palette, same signed-exposure heat scale, Star yardstick included.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), syncGexMapColors: current.settings?.syncGexMapColors !== true },
                      }))}
                      className={`h-9 shrink-0 border px-3 text-[8px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                        settingsInstance.settings?.syncGexMapColors === true
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border bg-background text-muted hover:text-foreground"
                      }`}
                    >
                      {settingsInstance.settings?.syncGexMapColors === true ? "Linked" : "Link"}
                    </button>
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    KING is always calculated from the full filtered strike list using the largest absolute signed exposure. Centre price and KING remain independent. Historical snapshots never read beyond replay time.
                  </div>
                  <div className="space-y-3 border border-primary/20 bg-background/70 p-3 sm:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.14em] text-foreground">Exposure population</div>
                        <div className="mt-1 text-[9px] leading-4 text-muted">Only populate the strongest gamma nodes by absolute signed exposure. Positive and negative exposure are ranked equally.</div>
                      </div>
                      <span className="shrink-0 border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[9px] text-primary">
                        Top {Math.round(Number(settingsInstance.settings?.topExposurePercent ?? 10))}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={Number(settingsInstance.settings?.topExposurePercent ?? 10)}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), topExposurePercent: Number(event.target.value) } }))}
                      className="w-full accent-primary"
                    />
                    <div className="grid grid-cols-5 gap-1.5">
                      {[5, 10, 25, 50, 100].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), topExposurePercent: percent } }))}
                          className={`h-8 border text-[8px] uppercase tracking-[0.08em] ${Number(settingsInstance.settings?.topExposurePercent ?? 10) === percent ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}
                        >
                          {percent === 100 ? "All" : `Top ${percent}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "dark-pool-map" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.preset ?? "balanced")}
                      onChange={(event) => {
                        const preset = event.target.value;
                        const presetSettings = (preset === "institutional"
                          ? { minimumPrintNotional: 1_000_000, minimumLevelNotional: 25_000_000, topLevels: 20, maximumRadius: 24, visualMode: "circles-and-zones" }
                          : preset === "live"
                            ? { historyDays: 1, minimumPrintNotional: 250_000, minimumLevelNotional: 0, pollSeconds: 2, visualMode: "heat-circles" }
                            : preset === "persistent"
                              ? { historyDays: 20, topLevels: 15, minimumStrengthScore: 45, visualMode: "lines" }
                              : preset === "nq-qqq"
                                ? { sourceTicker: "QQQ", mappingMode: "rolling-affine", historyDays: 2, visualMode: "circles-and-zones" }
                                : preset === "minimal"
                                  ? { visualMode: "lines", topLevels: 5, showLevelTable: false, opacity: 45 }
                                  : { historyDays: 2, minimumPrintNotional: 100_000, minimumLevelNotional: 5_000_000, topLevels: 50, visualMode: "circles-and-zones" }) as Record<string, string | number | boolean>;
                        replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), preset, ...presetSettings } }));
                      }}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Dark Pool Map preset"
                    >
                      <option value="balanced">Balanced</option>
                      <option value="institutional">Institutional Blocks</option>
                      <option value="live">Live Prints</option>
                      <option value="persistent">Persistent Levels</option>
                      <option value="nq-qqq">NQ QQQ Map</option>
                      <option value="minimal">Minimal</option>
                    </KwantSelect>
                  </label>
                  {[
                    ["Source ticker", "sourceTicker", [["AUTO", "Automatic for chart"], ["QQQ", "QQQ"], ["SPY", "SPY"], ["IWM", "IWM"], ["AAPL", "AAPL"], ["NVDA", "NVDA"], ["TSLA", "TSLA"], ["MSFT", "MSFT"], ["AMZN", "AMZN"], ["META", "META"], ["AMD", "AMD"], ["DIA", "DIA"]]],
                    ["Mapping", "mappingMode", [["rolling-affine", "Rolling affine"], ["live-ratio", "Live ratio"], ["direct", "Direct"], ["manual", "Manual alpha / beta"]]],
                    ["Visual mode", "visualMode", [["circles-and-zones", "Circles + zones"], ["heat-circles", "Heat circles"], ["zones", "Zones"], ["lines", "Lines"], ["historical-ribbons", "Historical ribbons"]]],
                    ["Price bins", "priceBinMode", [["mapped-points", "Mapped points"], ["display-ticks", "Display ticks"], ["source-cents", "Source cents"], ["exact-source-price", "Exact source price"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [String(key)]: event.target.value } }))}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                    {([
                      ["precisionMode", "Precision"], ["showLabels", "Labels"], ["clusterEnabled", "Clusters"], ["reactionAnalytics", "Reaction analytics"],
                      ["showInspector", "Inspector"], ["showReactionResearch", "Reaction research"], ["firstTouchOnly", "First touch only"], ["includeLateReports", "Late reports"], ["includeCorrectedPrints", "Corrected prints"],
                    ] as const).map(([key, label]) => {
                      const defaultOff = key === "clusterEnabled" || key === "showInspector" || key === "showReactionResearch" || key === "firstTouchOnly";
                      const enabled = defaultOff ? settingsInstance.settings?.[key] === true : settingsInstance.settings?.[key] !== false;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), [key]: !enabled } }))}
                          className={`h-8 border px-2 text-[8px] uppercase tracking-[0.1em] ${enabled ? "border-primary/55 bg-primary/10 text-primary" : "border-border bg-background text-muted"}`}
                        >
                          {label} · {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Dark Pool Map supports every options-flow underlying. QQQ, SPY, IWM and single stocks use native off-exchange prints. NDX, SPX and SPXW are non-traded index surfaces, so they use QQQ→NDX and SPY→SPX/SPXW price mapping. Futures remain explicitly mapped rather than presented as direct dark-pool feeds.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "dark-pool-gex" ? (
                <div className="grid gap-3 border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  {[
                    ["View preset", "viewPreset", [["raw-dp-levels", "Raw DP Levels"], ["dp-gex-intelligence", "DP + GEX Intelligence"]]],
                    ["Lookback semantics", "lookbackMode", [["calendar-days", "Calendar Days"], ["trading-sessions", "Trading Sessions"]]],
                    ["Inspector sort", "sortMode", [["notional", "Notional"], ["distance", "Current Distance"], ["freshness", "Freshness"], ["reaction-quality", "Reaction Quality"]]],
                    ["GEX context", "contextMode", [["current", "Current Structure"], ["event-time", "Event-Time Structure"], ["historical-and-current", "Historical + Current"]]],
                    ["GEX confluence", "confluenceMode", [["off", "Off"], ["nearest", "Nearest Node"], ["major", "Major Nodes Only"], ["king", "KING Only"], ["king-and-major", "KING + Major"], ["all-qualified", "All Qualified"]]],
                    ["Tolerance", "toleranceMode", [["percentage", "Percentage Distance"], ["absolute", "Absolute Price Distance"], ["ticks", "Tick Distance"]]],
                    ["Touch zone", "interactionToleranceMode", [["ticks", "Ticks"], ["absolute", "Absolute Price"], ["percentage", "Percentage"], ["basis-points", "Basis Points"], ["atr", "ATR Fraction"]]],
                    ["Reset / departure zone", "resetDistanceMode", [["ticks", "Ticks"], ["absolute", "Absolute Price"], ["percentage", "Percentage"], ["basis-points", "Basis Points"], ["atr", "ATR Fraction"]]],
                    ["Hold reaction", "reactionThresholdMode", [["ticks", "Ticks"], ["absolute", "Absolute Move"], ["percentage", "Percentage Move"], ["basis-points", "Basis Points"], ["atr", "ATR Multiple"]]],
                    ["Break distance", "breakDistanceMode", [["ticks", "Ticks"], ["absolute", "Absolute Price"], ["percentage", "Percentage"], ["basis-points", "Basis Points"], ["atr", "ATR Fraction"]]],
                    ["Break confirmation", "breakConfirmation", [["intrabar", "Intrabar Penetration"], ["1-close", "1 Close"], ["2-closes", "2 Consecutive Closes"], ["3-closes", "3 Consecutive Closes"], ["time-beyond", "Time Beyond Level"]]],
                    ["Interaction session", "interactionSession", [["regular-hours", "Regular Hours"], ["extended-hours", "Extended Hours"], ["all", "All Available"]]],
                    ["Display", "displayMode", [["raw", "Raw Prints Only"], ["clusters", "Clusters Only"], ["raw-and-clusters", "Raw + Clusters"]]],
                    ["Cluster distance", "clusterDistanceMode", [["percentage", "Percentage"], ["absolute", "Absolute Price"], ["ticks", "Ticks"]]],
                    ["Performance", "performanceQuality", [["auto", "Auto"], ["ultra", "Ultra"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => {
                          const value = event.target.value;
                          const preset: Record<string, string | number | boolean> = String(key) === "viewPreset"
                            ? value === "raw-dp-levels"
                              ? { displayMode: "raw", clusterEnabled: false, haloIntensity: 18, showReactionMarkers: false, precisionMode: true, showExactLine: true, showLabels: true }
                              : { displayMode: "raw-and-clusters", clusterEnabled: true, haloIntensity: 22, showReactionMarkers: true, precisionMode: true, showExactLine: true, showLabels: true }
                            : {};
                          return { ...current, settings: { ...(current.settings ?? {}), ...preset, [String(key)]: value } };
                        })}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                      </KwantSelect>
                    </label>
                  ))}
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Raw Top-N membership is always ranked by individual print notional. Exact prices are never rounded or replaced by clusters. QuantData validates off-exchange reporting; a specific ATS is claimed only when venue metadata exists. GEX confluence selects the theme colour without moving the Dark Pool price. Levels render as dotted lines only: active levels stay bright, while confirmed breaks fade until reclaimed.
                    <span className="mt-1 block">This tool flags measured order-book and price-interaction patterns. It does not determine trader identity or legally establish intent, and it does not represent a dark-pool level as guaranteed support or resistance.</span>
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "classic-gex-profile" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  {[
                    ["Mapping", "mappingSource", [["QQQ", "NQ / QQQ"], ["NDX", "NQ / NDX"]]],
                    ["Expiry", "expiry", [["ZERO_DTE", "0DTE"], ["NEXT_EXPIRY", "Next expiry"], ["ALL", "All expiries"]]],
                    ["Classic source", "profileSource", [["VOLUME", "Session volume"], ["OPEN_INTEREST", "Open interest"]]],
                    ["Position", "panelPosition", [["RIGHT", "Right edge"], ["LEFT", "Left edge"]]],
                    ["Price mapping", "mappingMode", [["AUTO", "Automatic"], ["MANUAL", "Manual"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [String(key)]: event.target.value },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => (
                          <option key={value} value={value}>{optionLabel}</option>
                        ))}
                      </KwantSelect>
                    </label>
                  ))}
                  <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Classic GEX stays independent from Estimated Flow Convexity. Calls extend inward in green; puts extend inward in red from the chart edge.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "imbalance-tracker" ? (() => {
                const trackerSettings = settingsInstance.settings ?? {};
                const patch = (next: Record<string, number | string | boolean>) =>
                  replace(settingsInstance.instanceId, (current) => ({
                    ...current,
                    settings: { ...(current.settings ?? {}), ...next },
                  }));
                const toggleRow = (label: string, settingKey: string, hint?: string, defaultOn = false) => {
                  const on = trackerSettings[settingKey] === undefined
                    ? defaultOn
                    : trackerSettings[settingKey] === true;
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium text-foreground">{label}</div>
                        {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        onClick={() => patch({ [settingKey]: !on })}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  );
                };
                const choiceRow = (
                  label: string,
                  settingKey: string,
                  fallback: string,
                  options: ReadonlyArray<readonly [string, string]>,
                  hint?: string,
                ) => (
                  <div>
                    <div className="text-[10px] font-medium text-foreground">{label}</div>
                    {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                    <div
                      className="mt-1.5 grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.min(3, options.length)}, minmax(0, 1fr))` }}
                      role="group"
                      aria-label={label}
                    >
                      {options.map(([value, optionLabel]) => {
                        const selected = String(trackerSettings[settingKey] ?? fallback) === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => patch({ [settingKey]: value })}
                            className={`h-9 rounded-lg border px-2 text-[9px] transition-colors ${
                              selected
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                            }`}
                          >
                            {optionLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
                return (
                  <div data-settings-section="Data settings" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                    {choiceRow(
                      "Calculation mode",
                      "calculationMode",
                      "diagonal",
                      [
                        ["diagonal", "Imbalance diagonal"],
                        ["horizontal", "Imbalance horizontal"],
                        ["delta-percentage-horizontal", "Delta % horizontal"],
                      ] as const,
                      "Diagonal compares each ask against the bid one tick below (and the reverse); horizontal compares the two sides of the same level.",
                    )}
                    {toggleRow(
                      "Include zero on imbalance",
                      "includeZero",
                      "Count a level whose opposing side traded nothing at all.",
                    )}

                  </div>
                );
              })() : null}

              {settingsDefinition.id === "imbalance-tracker" ? (() => {
                const trackerSettings = settingsInstance.settings ?? {};
                const patch = (next: Record<string, number | string | boolean>) =>
                  replace(settingsInstance.instanceId, (current) => ({
                    ...current,
                    settings: { ...(current.settings ?? {}), ...next },
                  }));
                const toggleRow = (label: string, settingKey: string, hint?: string, defaultOn = false) => {
                  const on = trackerSettings[settingKey] === undefined
                    ? defaultOn
                    : trackerSettings[settingKey] === true;
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium text-foreground">{label}</div>
                        {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        onClick={() => patch({ [settingKey]: !on })}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  );
                };
                const choiceRow = (
                  label: string,
                  settingKey: string,
                  fallback: string,
                  options: ReadonlyArray<readonly [string, string]>,
                  hint?: string,
                ) => (
                  <div>
                    <div className="text-[10px] font-medium text-foreground">{label}</div>
                    {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                    <div
                      className="mt-1.5 grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.min(3, options.length)}, minmax(0, 1fr))` }}
                      role="group"
                      aria-label={label}
                    >
                      {options.map(([value, optionLabel]) => {
                        const selected = String(trackerSettings[settingKey] ?? fallback) === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => patch({ [settingKey]: value })}
                            className={`h-9 rounded-lg border px-2 text-[9px] transition-colors ${
                              selected
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                            }`}
                          >
                            {optionLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
                return (
                  <div data-settings-section="Plot settings" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                    {choiceRow(
                      "Reset mode",
                      "resetMode",
                      "none",
                      [["none", "None"], ["session", "Session"], ["week", "Week"]] as const,
                      "Ends every zone at this boundary instead of running the full extension.",
                    )}
                    {toggleRow(
                      "Enable triggered zone",
                      "showTriggered",
                      "Keep zones on the chart after price trades through them.",
                      true,
                    )}
                    {toggleRow(
                      "Trigger only touch",
                      "triggerOnlyTouch",
                      "A touch triggers the zone; otherwise a close beyond it is required.",
                    )}

                  </div>
                );
              })() : null}

              {settingsDefinition.id === "imbalance-tracker" ? (() => {
                const trackerSettings = settingsInstance.settings ?? {};
                const patch = (next: Record<string, number | string | boolean>) =>
                  replace(settingsInstance.instanceId, (current) => ({
                    ...current,
                    settings: { ...(current.settings ?? {}), ...next },
                  }));
                const toggleRow = (label: string, settingKey: string, hint?: string, defaultOn = false) => {
                  const on = trackerSettings[settingKey] === undefined
                    ? defaultOn
                    : trackerSettings[settingKey] === true;
                  return (
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium text-foreground">{label}</div>
                        {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        onClick={() => patch({ [settingKey]: !on })}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  );
                };
                return (
                  <div data-settings-section="Alerts" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                    {toggleRow("Enable sound", "enableAlertSound")}
                    <label className="block">
                      <span className="text-[10px] font-medium text-foreground">Alert name</span>
                      <input
                        value={String(trackerSettings.alertName ?? "Imbalance detected")}
                        onChange={(event) => patch({ alertName: event.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    {toggleRow("Enable popup", "enablePopup")}
                    <label className="block">
                      <span className="text-[10px] font-medium text-foreground">Message text</span>
                      <input
                        value={String(trackerSettings.popupMessage ?? "Imbalance tracker")}
                        onChange={(event) => patch({ popupMessage: event.target.value })}
                        className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary/40"
                      />
                    </label>

                  </div>
                );
              })() : null}

              {settingsDefinition.id === "imbalance-tracker" ? (() => {
                const trackerSettings = settingsInstance.settings ?? {};
                const patch = (next: Record<string, number | string | boolean>) =>
                  replace(settingsInstance.instanceId, (current) => ({
                    ...current,
                    settings: { ...(current.settings ?? {}), ...next },
                  }));
                const choiceRow = (
                  label: string,
                  settingKey: string,
                  fallback: string,
                  options: ReadonlyArray<readonly [string, string]>,
                  hint?: string,
                ) => (
                  <div>
                    <div className="text-[10px] font-medium text-foreground">{label}</div>
                    {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                    <div
                      className="mt-1.5 grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${Math.min(3, options.length)}, minmax(0, 1fr))` }}
                      role="group"
                      aria-label={label}
                    >
                      {options.map(([value, optionLabel]) => {
                        const selected = String(trackerSettings[settingKey] ?? fallback) === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => patch({ [settingKey]: value })}
                            className={`h-9 rounded-lg border px-2 text-[9px] transition-colors ${
                              selected
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : "border-border bg-background text-muted hover:border-primary/30 hover:text-foreground"
                            }`}
                          >
                            {optionLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
                return (
                  <div data-settings-section="Filter time" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                    {choiceRow(
                      "Filter time",
                      "filterTime",
                      "none",
                      [["none", "None"], ["custom", "Custom time"]] as const,
                      "Restrict detection to a window of the exchange session.",
                    )}
                    {String(trackerSettings.filterTime ?? "none") === "custom" ? (
                      <div className="grid grid-cols-2 gap-2">
                        {([["sessionStart", "Start", "09:30"], ["sessionEnd", "End", "16:00"]] as const).map(([key, label, fallback]) => (
                          <label key={key} className="block">
                            <span className="text-[9px] uppercase tracking-[0.1em] text-muted">{label} · exchange time</span>
                            <input
                              type="time"
                              value={String(trackerSettings[key] ?? fallback)}
                              onChange={(event) => patch({ [key]: event.target.value })}
                              className="mt-1 h-8 w-full rounded-lg border border-border bg-background px-2 font-mono text-[11px] text-foreground outline-none focus:border-primary/40"
                            />
                          </label>
                        ))}
                        <div className="col-span-2 text-[8px] leading-4 text-muted">
                          Times are America/Chicago (CME exchange time). An end before the start wraps midnight for overnight windows.
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })() : null}

              {settingsDefinition.id === "divergence-detector" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">ES / NQ SMT comparison</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      {divergenceMarketPair(instrument)
                        ? `${divergenceMarketPair(instrument)!.primary} is automatically compared with ${divergenceMarketPair(instrument)!.comparison} on ${timeframe}. Changing chart timeframe recalculates both markets together.`
                        : "This detector is available on ES, MES, NQ and MNQ charts. Select one of those instruments to calculate SMT divergence."}
                    </p>
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2">
                    <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Chart market</div>
                    <div className="mt-1 font-mono text-[11px] text-foreground">{divergenceMarketPair(instrument)?.primary ?? "Unsupported"}</div>
                  </div>
                  <div className="border border-border bg-background/55 px-3 py-2">
                    <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Cross-check market</div>
                    <div className="mt-1 font-mono text-[11px] text-primary">{divergenceMarketPair(instrument)?.comparison ?? "ES / NQ only"}</div>
                  </div>
                  <div className="text-[8px] leading-4 text-muted sm:col-span-2">
                    Signals use confirmed swing pivots only. Bullish SMT compares failed lower lows; bearish SMT compares failed higher highs. No future candle is used before a line is confirmed.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "expected-move" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  {[
                    ["Mode", "mode", [["SESSION", "Session · fixed rails"], ["LIVE", "Live · time-decaying"]]],
                    ["Options source", "mappingSource", [["QQQ", "QQQ â†’ NQ / MNQ"], ["NDX", "NDX â†’ NQ / MNQ"]]],
                  ].map(([label, key, options]) => (
                    <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{String(label)}</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.[String(key)] ?? "")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [String(key)]: event.target.value },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel={String(label)}
                      >
                        {(options as string[][]).map(([value, optionLabel]) => (
                          <option key={value} value={value}>{optionLabel}</option>
                        ))}
                      </KwantSelect>
                    </label>
                  ))}
                </div>
              ) : null}

              {settingsDefinition.id === "deep-print-footprint" ? (
                <div data-settings-section="View" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Footprint Settings</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      Presets, templates, footprint content, grouping, scaling and execution presentation.
                    </p>
                  </div>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Preset</span>
                    <KwantSelect
                      value={selectedFootprintPreset}
                      onChange={(event) => {
                        const preset = event.target.value as FootprintPresetName;
                        if (!preset) return;
                        setSelectedFootprintPreset(preset);
                        setSelectedFootprintTemplateId("");
                        saveFootprintSelection(settingsInstance.instanceId, {
                          preset,
                          templateId: "",
                        });
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            ...applyFootprintPreset(validateFootprintSettings(current.settings), preset),
                          },
                        }));
                      }}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Footprint preset"
                    >
                      <option value="">Choose a preset</option>
                      <option value="kwantdesk">KwantDesk default</option>
                      <option value="order-flow">Order flow</option>
                      <option value="imbalance">Imbalance</option>
                      <option value="delta">Delta</option>
                      <option value="minimal">Minimal ladder</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Local template</span>
                    <div className="flex gap-2">
                      <KwantSelect
                        value={selectedFootprintTemplateId}
                        onChange={(event) => {
                          const templateId = event.target.value;
                          setSelectedFootprintTemplateId(templateId);
                          setSelectedFootprintPreset("");
                          saveFootprintSelection(settingsInstance.instanceId, {
                            preset: "",
                            templateId,
                          });
                          const template = footprintTemplates.find((candidate) => candidate.id === templateId);
                          if (!template) return;
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), ...template.settings },
                          }));
                          setFootprintSaveStatus(`Loaded ${template.name}`);
                        }}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel="Saved footprint templates"
                      >
                        <option value="">{footprintTemplates.length ? "Choose a saved template" : "No saved templates"}</option>
                        {footprintTemplates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </KwantSelect>
                      {footprintTemplates.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            const selected = footprintTemplates.find((template) => template.id === selectedFootprintTemplateId);
                            if (!selected) return;
                            setFootprintTemplates(deleteFootprintTemplate(selected.id));
                            setSelectedFootprintTemplateId("");
                            saveFootprintSelection(settingsInstance.instanceId, {
                              preset: selectedFootprintPreset,
                              templateId: "",
                            });
                            setFootprintSaveStatus(`Deleted ${selected.name}`);
                          }}
                          disabled={!selectedFootprintTemplateId}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted hover:border-danger/35 hover:text-danger"
                          title="Delete selected template"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </label>
                  {/* The chart, then the variant. These four engine switches —
                      content, visualisation, colour calculation and input type —
                      were four independent dropdowns, so reaching a named view
                      meant knowing which combination produced it. */}
                  <div className="space-y-2 border border-primary/20 bg-primary/[0.035] p-2.5">
                    <div className="flex flex-wrap gap-1">
                      {FOOTPRINT_CHART_TYPES.map((type) => {
                        const active = footprintChartType(settingsInstance.settings?.chartType).id === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            title={type.description}
                            onClick={() => replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: {
                                ...(current.settings ?? {}),
                                chartType: type.id,
                                chartVariant: type.variants[0].id,
                                ...footprintVariantSettings(type.id, type.variants[0].id),
                              },
                            }))}
                            className={`h-7 shrink-0 border px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                              active
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border text-muted hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            {type.label}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const type = footprintChartType(settingsInstance.settings?.chartType);
                      const variant = footprintVariant(type.id, settingsInstance.settings?.chartVariant);
                      return (
                        <>
                          <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                            <span>{type.label} view</span>
                            <KwantSelect
                              value={variant.id}
                              onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                                ...current,
                                settings: {
                                  ...(current.settings ?? {}),
                                  chartVariant: event.target.value,
                                  ...footprintVariantSettings(type.id, event.target.value),
                                },
                              }))}
                              className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                              menuLabel={`${type.label} footprint view`}
                            >
                              {type.variants.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </KwantSelect>
                          </label>
                          <p className="text-[8px] leading-4 text-muted">{variant.description}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "deep-print-footprint" ? (
                /* One block PER SECTION, so each becomes its own tab. A
                   data-settings-section on a nested element does nothing:
                   IndicatorSettingsSections reads only its direct children, and
                   a Fragment would collapse the lot into a single child. */
                groupFootprintSettingRows([
                    ["Scale", "scaleMode", [["visible-region", "Visible region"], ["per-bar", "Per bar"], ["all-loaded", "All loaded"], ["fixed-maximum", "Fixed maximum"]]],
                    ["Tick grouping", "groupingMode", [["automatic", "Automatic"], ["manual", "Manual"]]],
                    ["Grouping mode", "groupMode", [["fixed", "Fixed"], ["open-close", "Based on open / close"]]],
                    ["Imbalance", "imbalanceMode", [["diagonal", "Diagonal"], ["horizontal", "Horizontal"], ["delta-percent", "Delta percentage"]]],
                    ["Professional number format", "numberFormat", [["automatic", "Automatic"], ["full", "Full values"], ["compact", "Compact K / M"]]],
                    ["Colour mode", "colorMode", [["fading", "Fading intensity"], ["fixed", "Fixed opacity"], ["none", "No cell fill"]]],
                    ["Active candle outline", "outsideBarStyle", [["bar", "Full bar"], ["body", "Candle body"]]],
                    ["Live marker alignment", "markerAlignment", [["center", "Centre"], ["right", "Right edge"]]],
                    ["Maximum refresh rate", "fpsLimit", [["30", "30 FPS"], ["60", "60 FPS"], ["120", "120 FPS"]]],
                  ], settingsInstance.settings?.chartType).map(([section, rows]) => (
                    <div
                      key={section}
                      data-settings-section={section}
                      className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2"
                    >
                      {rows.map(([label, key, options]) => (
                        <label key={String(key)} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                          <span>{String(label)}</span>
                          <KwantSelect
                            value={String(settingsInstance.settings?.[String(key)] ?? "")}
                            onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: {
                                ...(current.settings ?? {}),
                                [String(key)]: String(key) === "fpsLimit" ? Number(event.target.value) : event.target.value,
                              },
                            }))}
                            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                            menuLabel={String(label)}
                          >
                            {(options as string[][]).map(([value, optionLabel]) => (
                              <option key={value} value={value}>{optionLabel}</option>
                            ))}
                          </KwantSelect>
                        </label>
                      ))}
                      {section === "Imbalance" ? (
                        <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                          Bid × Ask uses classified executions from the Rithmic / CME tape. Unclassified executions remain in total volume and POC, but never enter Bid, Ask, Delta or imbalance calculations.
                        </div>
                      ) : null}
                    </div>
                ))
              ) : null}

              {settingsDefinition.id === "deep-print-footprint" ? (
                <section data-settings-section="Profile" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Volume Profile</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      Builds from the same live executions as each footprint bar. Total volume faces right, signed delta faces left, and the POC square uses the footprint bar&apos;s exact POC row.
                    </p>
                  </div>
                  {/*
                    * The POC square and the outline are drawn INSIDE a profile
                    * wing, so with both wings off they are dead switches: the
                    * box ticks and nothing appears. They now disable themselves
                    * and say why, rather than letting a trader conclude the
                    * feature is broken.
                    */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(() => {
                      const wingsOn = Boolean(settingsInstance.settings?.showPerBarVolumeProfile ?? false)
                        || Boolean(settingsInstance.settings?.showPerBarDeltaProfile ?? false);
                      return [
                        ["Volume profile · right", "showPerBarVolumeProfile", false, true],
                        ["Delta profile · left", "showPerBarDeltaProfile", false, true],
                        ["POC square", "showPerBarProfilePoc", true, wingsOn],
                        ["Profile outline", "perBarProfileOutline", false, wingsOn],
                      ].map(([label, key, fallback, available]) => (
                        <label
                          key={String(key)}
                          title={available ? undefined : "Turn on a volume or delta profile first — this draws inside one"}
                          className={`flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted ${available ? "" : "opacity-40"}`}
                        >
                          <input
                            type="checkbox"
                            disabled={!available}
                            checked={Boolean(settingsInstance.settings?.[String(key)] ?? fallback)}
                            onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: { ...(current.settings ?? {}), [String(key)]: event.target.checked },
                            }))}
                            className="accent-primary"
                          />
                          <span>{String(label)}</span>
                        </label>
                      ));
                    })()}
                  </div>
                  <label className="block space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Profile normalization</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.perBarProfileScaleMode ?? "independent")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), perBarProfileScaleMode: event.target.value },
                      }))}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Per-bar profile normalization"
                    >
                      <option value="independent">Independent volume and delta scales</option>
                      <option value="shared">Shared volume and delta scale</option>
                    </KwantSelect>
                  </label>
                  {(() => {
                    const ticksPerRow = footprintProfileGranularityTicks(
                      settingsInstance.settings?.perBarProfileTicksPerRow,
                    );
                    return (
                      <label className="block rounded-lg border border-border bg-surface/30 p-2.5">
                        <span className="mb-2 flex items-center justify-between text-[9px] text-muted">
                          <span>Profile row size</span>
                          <span className="font-mono text-foreground">
                            {ticksPerRow} {ticksPerRow === 1 ? "tick" : "ticks"} per row
                          </span>
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW}
                          step={1}
                          value={ticksPerRow}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: {
                              ...(current.settings ?? {}),
                              perBarProfileTicksPerRow: Number(event.target.value),
                            },
                          }))}
                          className="w-full accent-primary"
                        />
                        <span className="mt-1.5 flex justify-between text-[8px] text-muted">
                          <span>Fine · one tick</span>
                          <span>Coarse · {FOOTPRINT_PROFILE_MAX_TICKS_PER_ROW} ticks</span>
                        </span>
                      </label>
                    );
                  })()}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Profile width", "perBarProfileWidthPercent", 92, 10, 100, 1, "%"],
                      ["Centre gap", "perBarProfileGap", 2, 0, 12, 1, "px"],
                      ["Extra candle spacing", "perBarProfileExtraSpacing", 18, 0, 48, 1, "px"],
                      ["Profile opacity", "perBarProfileOpacity", 58, 5, 100, 1, "%"],
                      ["POC square size", "perBarProfilePocSize", 5, 2, 12, 1, "px"],
                    ].map(([label, key, fallback, minimum, maximum, step, suffix]) => {
                      const value = Number(settingsInstance.settings?.[String(key)] ?? fallback);
                      return (
                        <label key={String(key)} className="block rounded-lg border border-border bg-surface/30 p-2.5">
                          <span className="mb-2 flex items-center justify-between text-[9px] text-muted">
                            <span>{String(label)}</span>
                            <span className="font-mono text-foreground">{value}{String(suffix)}</span>
                          </span>
                          <input
                            type="range"
                            min={Number(minimum)}
                            max={Number(maximum)}
                            step={Number(step)}
                            value={value}
                            onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: { ...(current.settings ?? {}), [String(key)]: Number(event.target.value) },
                            }))}
                            className="w-full accent-primary"
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Volume", "perBarVolumeColor", "#B7FF38"],
                      ["Positive delta", "perBarPositiveDeltaColor", "#B7FF38"],
                      ["Negative delta", "perBarNegativeDeltaColor", "#F06A70"],
                      ["POC", "perBarProfilePocColor", "#E4BF5A"],
                    ].map(([label, key, fallback]) => (
                      <div key={String(key)} className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <span className="truncate">{String(label)}</span>
                        <ChartColorField
                          ariaLabel={`${String(label)} colour`}
                          value={String(settingsInstance.settings?.[String(key)] ?? fallback)}
                          onChange={(hex) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [String(key)]: hex },
                          }))}
                          disabled={settingsInstance.settings?.useThemeColors !== false}
                          title={settingsInstance.settings?.useThemeColors !== false ? "Turn off Use Theme Colors to set a custom colour" : undefined}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {settingsDefinition.id === "depth-of-market" ? (
                <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">DOM Pro · Rithmic MBO</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      One shared high-DPI ladder for chart and workspace use. Drag its left edge to resize, inspect nearby prices with wheel or drag, and use LIVE or End to recenter.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ["MBO / L2", "Exact order capability when supplied; honest full-depth fallback otherwise."],
                      ["BUY / SELL", "Recent buyer- and seller-initiated executions at each price."],
                      ["BID / ASK", "Current resting contracts at one-tick price resolution."],
                    ].map(([title, description]) => (
                      <div key={title} className="rounded-lg border border-border bg-background/55 px-3 py-2">
                        <div className="text-[9px] font-semibold text-foreground">{title}</div>
                        <div className="mt-1 text-[8px] leading-3 text-muted">{description}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[8px] leading-3 text-muted">
                    Trading remains read-only unless the authenticated KwantDesk order service explicitly grants capability. No browser Rithmic login or duplicate market-data session is created.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "deep-print-footprint" ? (
                <div data-settings-section="Bar" className="rounded-lg border border-border bg-background/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Footprint Bar</div>
                  <p className="mt-1 text-[9px] leading-4 text-muted">
                    Bar width, spacing, grouping, filters, typography and footprint-detail controls.
                  </p>
                </div>
              ) : null}

              {(settingsDefinition.id === "tpo-chart" || settingsDefinition.id === "weekly-tpo") ? (
                <div data-settings-section="General" className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Profile &amp; Auction Market Theory</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      One square is one distinct subperiod visit at one grouped price row. Exact executions are preferred; range-derived occupancy is labelled on-chart.
                    </p>
                  </div>
                  {settingsDefinition.id === "tpo-chart" ? (
                    <div className="space-y-2 border border-border bg-background/65 p-2.5">
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground">Quick session</div>
                        <div className="mt-0.5 text-[8px] leading-3 text-muted">Select the market open that owns each Daily TPO calculation.</div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {DAILY_TPO_SESSION_PRESETS.map((preset) => {
                          const active = Object.entries(preset.settings).every(([key, value]) =>
                            String(settingsInstance.settings?.[key] ?? "") === String(value));
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => replace(settingsInstance.instanceId, (current) => ({
                                ...current,
                                settings: {
                                  ...(current.settings ?? {}),
                                  scheduleKind: "daily",
                                  periodMode: "multiple-profiles",
                                  filterMode: "none",
                                  customStartMs: 0,
                                  customEndMs: 0,
                                  customEndFollowsLatest: false,
                                  ...preset.settings,
                                },
                              }))}
                              className={`min-h-12 border px-2 py-1.5 text-left transition-colors ${active
                                ? "border-primary/60 bg-primary/12 text-primary"
                                : "border-border bg-background text-muted hover:border-primary/40 hover:text-foreground"}`}
                            >
                              <span className="block text-[8px] font-semibold uppercase tracking-[0.08em]">{preset.label}</span>
                              <span className="mt-0.5 block text-[7px] leading-3 opacity-75">{preset.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TPO_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), ...preset.settings },
                        }))}
                        className="border border-border bg-background px-2 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-primary/45 hover:text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 border border-border bg-background/65 p-2.5">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-foreground">Custom presets</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <KwantSelect
                        value={selectedTpoPresetId}
                        onChange={(event) => {
                          const presetId = event.target.value;
                          setSelectedTpoPresetId(presetId);
                          const preset = tpoUserPresets.find((candidate) => candidate.id === presetId);
                          if (!preset) return;
                          setTpoPresetName(preset.name);
                          replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...preset.settings } }));
                        }}
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] text-foreground"
                        menuLabel="Custom TPO preset"
                      >
                        <option value="">{tpoUserPresets.length ? "Choose saved preset" : "No saved presets"}</option>
                        {tpoUserPresets.filter((preset) => preset.indicatorId === settingsDefinition.id).map((preset) => (
                          <option key={preset.id} value={preset.id}>{preset.name}</option>
                        ))}
                      </KwantSelect>
                      <input
                        value={tpoPresetName}
                        onChange={(event) => setTpoPresetName(event.target.value)}
                        placeholder="Preset name"
                        className="h-9 w-full border border-border bg-background px-3 text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => {
                          const name = tpoPresetName.trim();
                          if (!name) return;
                          const preset: TpoUserPreset = {
                            id: crypto.randomUUID(),
                            name,
                            indicatorId: settingsDefinition.id as TpoUserPreset["indicatorId"],
                            settings: { ...(settingsInstance.settings ?? {}) },
                          };
                          const next = [...tpoUserPresets, preset];
                          setTpoUserPresets(next);
                          setSelectedTpoPresetId(preset.id);
                          persistTpoUserPresets(next);
                        }}
                        className="h-8 border border-primary/35 bg-primary/10 text-[8px] font-semibold uppercase tracking-[0.08em] text-primary"
                      >Save new</button>
                      <button
                        type="button"
                        disabled={!selectedTpoPresetId}
                        onClick={() => {
                          const next = tpoUserPresets.map((preset) => preset.id === selectedTpoPresetId
                            ? { ...preset, name: tpoPresetName.trim() || preset.name, settings: { ...(settingsInstance.settings ?? {}) } }
                            : preset);
                          setTpoUserPresets(next);
                          persistTpoUserPresets(next);
                        }}
                        className="h-8 border border-border text-[8px] font-semibold uppercase tracking-[0.08em] text-muted disabled:opacity-35"
                      >Update</button>
                      <button
                        type="button"
                        disabled={!selectedTpoPresetId}
                        onClick={() => {
                          const source = tpoUserPresets.find((preset) => preset.id === selectedTpoPresetId);
                          if (!source) return;
                          const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} copy` };
                          const next = [...tpoUserPresets, copy];
                          setTpoUserPresets(next);
                          setSelectedTpoPresetId(copy.id);
                          setTpoPresetName(copy.name);
                          persistTpoUserPresets(next);
                        }}
                        className="h-8 border border-border text-[8px] font-semibold uppercase tracking-[0.08em] text-muted disabled:opacity-35"
                      >Duplicate</button>
                      <button
                        type="button"
                        disabled={!selectedTpoPresetId}
                        onClick={() => {
                          const next = tpoUserPresets.filter((preset) => preset.id !== selectedTpoPresetId);
                          setTpoUserPresets(next);
                          setSelectedTpoPresetId("");
                          setTpoPresetName("");
                          persistTpoUserPresets(next);
                        }}
                        className="h-8 border border-danger/35 text-[8px] font-semibold uppercase tracking-[0.08em] text-danger disabled:opacity-35"
                      >Delete</button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["Schedule", "scheduleKind", [["daily", "Daily"], ["weekly", "Weekly"], ["generic-period", "Generic period"], ["custom-range", "Custom range"]]],
                      ["Period mode", "periodMode", [["multiple-profiles", "Multiple profiles"], ["all-loaded-bars", "All loaded bars"], ["custom-range", "Custom range"]]],
                      ["Display", "displayType", [["blocks", "Blocks"], ["letters", "Letters"], ["automatic", "Automatic"]]],
                      ["Appearance", "visualStyle", [["solid", "Solid"], ["hollow", "Hollow"], ["line", "Line"]]],
                      ["Split TPO", "splitMode", [["none", "None"], ["last", "Last"], ["all", "All"]]],
                      ["Data fidelity", "visitSource", [["automatic", "Automatic"], ["exact-trades", "Exact trades"], ["bar-range", "Bar range"]]],
                      ["Tick grouping", "groupingMode", [["automatic", "Automatic"], ["manual", "Manual"]]],
                      ["Width mode", "widthMode", [["automatic", "Automatic"], ["period-percent", "Period percent"], ["window-percent", "Window percent"], ["fixed-bars", "Fixed bars"]]],
                      ["Session action", "filterMode", [["none", "No filter"], ["filter", "Filter"], ["split-two", "Split two"], ["split-three", "Split three"]]],
                      ["Session filter", "sessionPreset", [["eth", "ETH"], ["rth", "RTH"], ["custom", "Custom"]]],
                      ["Length unit", "lengthUnit", [["minute", "Minutes"], ["day", "Days"], ["week", "Weeks"], ["month", "Months"]]],
                      ["Daily end", "dailyEndMode", [["next-daily-start", "Next daily start"], ["explicit-time", "Explicit time"]]],
                      ["Weekly end", "weekEndMode", [["next-week-start", "Next week start"], ["explicit-day-time", "Explicit day/time"]]],
                    ] as const).map(([label, key, options]) => (
                      <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <span>{label}</span>
                        <KwantSelect
                          value={String(settingsInstance.settings?.[key] ?? options[0][0])}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: event.target.value },
                          }))}
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                          menuLabel={label}
                        >
                          {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                        </KwantSelect>
                      </label>
                    ))}
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Exchange timezone</span>
                      <input
                        value={String(settingsInstance.settings?.timezone ?? "America/Chicago")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), timezone: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Explicit daily end</span>
                      <input
                        type="time"
                        step="1"
                        value={String(settingsInstance.settings?.dailyEndTime ?? "16:00:00")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), dailyEndTime: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Week start day</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.weekStartDay ?? 0)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), weekStartDay: Number(event.target.value) } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel="Week start day"
                      >
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Explicit week end day</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.weekEndDay ?? 5)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), weekEndDay: Number(event.target.value) } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                        menuLabel="Explicit week end day"
                      >
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Explicit week end time</span>
                      <input
                        type="time"
                        step="1"
                        value={String(settingsInstance.settings?.weekEndTime ?? "16:00:00")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), weekEndTime: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="text-[9px] uppercase tracking-[0.12em] text-muted">Enabled weekdays</span>
                      <div className="grid grid-cols-7 gap-1">
                        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => {
                          const raw = settingsInstance.settings?.enabledWeekdays;
                          const enabled = (Array.isArray(raw) ? raw.map(Number) : String(raw ?? "0,1,2,3,4").split(",").map(Number)).includes(index);
                          return (
                            <button
                              key={`${day}-${index}`}
                              type="button"
                              onClick={() => replace(settingsInstance.instanceId, (current) => {
                                const currentRaw = current.settings?.enabledWeekdays;
                                const currentDays = Array.isArray(currentRaw)
                                  ? currentRaw.map(Number)
                                  : String(currentRaw ?? "0,1,2,3,4").split(",").map(Number);
                                const next = currentDays.includes(index)
                                  ? currentDays.filter((value) => value !== index)
                                  : [...currentDays, index].sort((left, right) => left - right);
                                return { ...current, settings: { ...(current.settings ?? {}), enabledWeekdays: next.join(",") } };
                              })}
                              className={`h-8 border text-[9px] font-semibold ${enabled ? "border-primary/60 bg-primary/12 text-primary" : "border-border bg-background text-muted"}`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Custom range start (UTC)</span>
                      <input
                        type="datetime-local"
                        value={settingsInstance.settings?.customStartMs ? new Date(Number(settingsInstance.settings.customStartMs)).toISOString().slice(0, 16) : ""}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            scheduleKind: "custom-range",
                            periodMode: "custom-range",
                            customStartMs: event.target.value ? Date.parse(`${event.target.value}:00Z`) : 0,
                          },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Custom range end (UTC)</span>
                      <input
                        type="datetime-local"
                        value={settingsInstance.settings?.customEndMs ? new Date(Number(settingsInstance.settings.customEndMs)).toISOString().slice(0, 16) : ""}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...(current.settings ?? {}),
                            scheduleKind: "custom-range",
                            periodMode: "custom-range",
                            customEndFollowsLatest: false,
                            customEndMs: event.target.value ? Date.parse(`${event.target.value}:00Z`) : 0,
                          },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Custom session start</span>
                      <input
                        type="time"
                        step="1"
                        value={String(settingsInstance.settings?.customSessionStart ?? "17:00:00")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), customSessionStart: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>Custom session end</span>
                      <input
                        type="time"
                        step="1"
                        value={String(settingsInstance.settings?.customSessionEnd ?? "16:00:00")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), customSessionEnd: event.target.value } }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                    <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <span>{settingsDefinition.id === "weekly-tpo" ? "Week start time" : "Daily start time"}</span>
                      <input
                        type="time"
                        step="1"
                        value={String(settingsInstance.settings?.[settingsDefinition.id === "weekly-tpo" ? "weekStartTime" : "dailyStartTime"] ?? "17:00:00")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [settingsDefinition.id === "weekly-tpo" ? "weekStartTime" : "dailyStartTime"]: event.target.value },
                        }))}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-primary/40"
                      />
                    </label>
                  </div>
                  <div className="text-[8px] leading-4 text-muted">
                    This tool flags auction structure from observed price visits. It does not fabricate missing trade data.
                  </div>
                  <button
                    type="button"
                    onClick={() => replace(settingsInstance.instanceId, (current) => ({
                      ...current,
                      settings: defaultIndicatorSettings(settingsDefinition.id, chartSettings),
                    }))}
                    className="h-9 w-full border border-border bg-background text-[9px] font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:border-primary/45 hover:text-foreground"
                  >
                    Reset TPO defaults
                  </button>
                </div>
              ) : null}

              {(settingsDefinition.id === "tpo-chart" || settingsDefinition.id === "weekly-tpo") ? (() => {
                const pick = (key: string, fallback: string) => String(settingsInstance.settings?.[key] ?? fallback);
                const setValue = (key: string, value: string | number | boolean) =>
                  replace(settingsInstance.instanceId, (current) => ({
                    ...current,
                    settings: { ...(current.settings ?? {}), [key]: value },
                  }));
                const dropdown = (label: string, key: string, options: ReadonlyArray<readonly [string, string]>) => (
                  <label key={key} className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>{label}</span>
                    <KwantSelect
                      value={pick(key, options[0][0])}
                      onChange={(event) => setValue(key, event.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel={label}
                    >
                      {options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                    </KwantSelect>
                  </label>
                );
                const slider = (label: string, key: string, fallback: number, min: number, max: number, step = 1) => (
                  <label key={key} className="block space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-mono text-foreground">{Number(settingsInstance.settings?.[key] ?? fallback)}</span>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={Number(settingsInstance.settings?.[key] ?? fallback)}
                      onChange={(event) => setValue(key, Number(event.target.value))}
                      className="w-full accent-primary"
                    />
                  </label>
                );
                const toggle = (label: string, key: string, defaultOn: boolean, hint?: string) => {
                  const on = settingsInstance.settings?.[key] === undefined
                    ? defaultOn
                    : settingsInstance.settings?.[key] === true;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-medium text-foreground">{label}</div>
                        {hint ? <div className="mt-0.5 text-[8px] leading-4 text-muted">{hint}</div> : null}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={label}
                        onClick={() => setValue(key, !on)}
                        className={`h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-primary/50 bg-primary/25" : "border-border bg-background"}`}
                      >
                        <span className={`block h-4 w-4 rounded-full bg-foreground transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  );
                };
                const page = (section: string, children: React.ReactNode) => (
                  <div data-settings-section={section} className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                    {children}
                  </div>
                );
                return (
                  <>
                    {page("Background/Text", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Color mode", "colourCalculation", [["time", "Time"], ["volume", "Volume"], ["delta", "Delta"]] as const)}
                        {dropdown("Color reference", "colourReference", [["fixed", "Fixed"], ["fading", "Fading color"], ["multiple-ranges", "Multiple ranges"]] as const)}
                      </div>
                    ))}
                    {page("Plot settings", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Bar market style", "barMarkerStyle", [["body", "Body"], ["candle", "Candle"]] as const)}
                        {dropdown("Width mode", "widthMode", [["automatic", "Automatic"], ["period-percent", "Period percent"], ["window-percent", "Window percent"], ["fixed-bars", "Fixed bars"]] as const)}
                      </div>
                    ))}
                    {page("Point of control", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Show line", "pocLineMode", [["none", "None"], ["final", "Final"], ["developing", "Developing"], ["extend-shifted", "Extend shifted"]] as const)}
                        {dropdown("Extend line", "pocExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]] as const)}
                      </div>
                    ))}
                    {page("Value area", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Extend line", "valueAreaExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]] as const)}
                      </div>
                    ))}
                    {page("Peak and valley", (
                      <>
                        {slider("Sensitivity", "peakValleySensitivity", 40, 0, 100)}
                        {toggle(
                          "Exclude High/Low",
                          "peakValleyExcludeExtremes",
                          true,
                          "Never mark the profile's own high or low row as a peak or valley — those are the auction's edges, not structure inside it.",
                        )}
                        <p className="text-[8px] leading-4 text-muted">
                          Lower sensitivity marks only the most pronounced structures; higher marks subtler ones. The threshold scales with the profile's own tallest row, so one setting behaves the same on a thin overnight profile and a heavy RTH one.
                        </p>
                      </>
                    ))}
                    {page("Single prints", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Extended", "singlePrintExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]] as const)}
                      </div>
                    ))}
                    {page("Summary", (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dropdown("Summary layout", "summaryLayout", [["compact", "Compact"], ["full", "Full"]] as const)}
                        {dropdown("Summary location", "summaryLocation", [["top-left", "Top left"], ["top-right", "Top right"], ["bottom-left", "Bottom left"], ["bottom-right", "Bottom right"]] as const)}
                      </div>
                    ))}
                    {page("Filter/split time", (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {dropdown("Filter mode", "filterMode", [["none", "None"], ["filter", "Filter"], ["split-two", "Split two"], ["split-three", "Split three"]] as const)}
                          {dropdown("Filter time", "sessionPreset", [["eth", "ETH"], ["rth", "RTH"], ["custom", "Custom"]] as const)}
                        </div>
                        {toggle(
                          "Use end session as start day",
                          "useEndSessionAsStartDay",
                          false,
                          "Opens each profile at the custom session's END time, so an overnight market's day is bounded by its own close. Applies with Filter mode on a Custom session.",
                        )}
                      </>
                    ))}
                  </>
                );
              })() : null}

              {settingsDefinition.id === "pulling-stacking" ? (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(Object.keys(PULLING_STACKING_PRESETS) as Array<keyof typeof PULLING_STACKING_PRESETS>).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), ...PULLING_STACKING_PRESETS[preset] },
                          }))}
                          className={`h-8 border text-[8px] font-semibold uppercase tracking-[0.1em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}
                        >
                          {preset.replaceAll("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Classification</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.classificationMode ?? "price-level")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), classificationMode: event.target.value, preset: "custom" } }))}
                        className="h-9 w-full"
                      ><option value="price-level">Price level</option><option value="individual-order">Individual order</option></KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Price-changing modify</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.moveHandling ?? "separate-move")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), moveHandling: event.target.value, preset: "custom" } }))}
                        className="h-9 w-full"
                      ><option value="separate-move">Separate move</option><option value="pull-and-stack">Pull + stack</option><option value="ignore-correlated-move">Ignore correlated</option></KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Aggregation</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.aggregationMode ?? "fixed-window")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), aggregationMode: event.target.value, preset: "custom" } }))}
                        className="h-9 w-full"
                      ><option value="fixed-window">Fixed window</option><option value="rolling-window">Rolling window</option><option value="chart-bar">Chart bar</option></KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Render mode</span>
                      <KwantSelect
                        value={String(settingsInstance.settings?.renderMode ?? "hybrid")}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), renderMode: event.target.value, preset: "custom" } }))}
                        className="h-9 w-full"
                      ><option value="hybrid">Hybrid</option><option value="heat-cells">Heat cells</option><option value="ribbons">Ribbons</option><option value="event-markers">Events</option><option value="current-profile">Current profile</option><option value="lower-pane">Lower pane</option></KwantSelect>
                    </label>
                  </div>
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Layers and detection</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {([
                        ["bidEnabled", "Bid side"], ["askEnabled", "Ask side"],
                        ["showHeatCells", "Heat cells"], ["showRibbons", "Ribbons"], ["showEventMarkers", "Event markers"],
                        ["showCurrentProfile", "Current profile"], ["showLiveDepth", "Live depth"], ["showLowerPane", "Lower pane"],
                        ["showWallBuild", "Wall build"], ["showWallCollapse", "Wall collapse"], ["showLiquidityVacuum", "Liquidity vacuum"],
                        ["pullRepostEnabled", "Pull / repost"], ["showLabels", "Labels"], ["showHeader", "Compact header"],
                        ["showTooltips", "Tooltips"], ["enableAlerts", "Alerts"], ["useThemeColors", "Website colours"],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={settingsInstance.settings?.[key] === true}
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: current.settings?.[key] !== true, preset: "custom" },
                          }))}
                          className={`flex h-8 items-center justify-between border px-2 text-left text-[8px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.[key] === true ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}
                        >
                          <span>{label}</span><span>{settingsInstance.settings?.[key] === true ? "ON" : "OFF"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                    <span>Lower pane metric</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.lowerPaneMode ?? "directional-pressure")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), lowerPaneMode: event.target.value, preset: "custom" } }))}
                      className="h-9 w-full"
                    >
                      <option value="four-series">Bid/ask stack and pull</option><option value="directional-pressure">Directional pressure</option>
                      <option value="net-book-change">Net displayed change</option><option value="churn">Churn</option>
                      <option value="velocity">Velocity</option><option value="stack-pull-ratio">Stack / pull ratio</option>
                    </KwantSelect>
                  </label>
                  <p className="text-[8px] leading-4 text-muted">
                    Executions are reconciled before removals become pulls. Snapshot and sequence-gap updates are suppressed until the shared book is valid. The feed cannot identify participant intent, implied orders, or hidden liquidity.
                  </p>
                </div>
              ) : null}

              {settingsDefinition.id === "absorption-detector" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Detection preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(Object.keys(ABSORPTION_PRESETS) as Array<keyof typeof ABSORPTION_PRESETS>).map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), ...ABSORPTION_PRESETS[preset] },
                          }))}
                          className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}
                        >
                          {preset.replaceAll("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Aggregation</span>
                      <KwantSelect value={String(settingsInstance.settings?.aggregationMode ?? "rolling")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), aggregationMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="rolling">Rolling window</option><option value="fixed">Fixed window</option><option value="chart-bar">Chart bar</option><option value="footprint-bar">Footprint bar</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Confirmation</span>
                      <KwantSelect value={String(settingsInstance.settings?.confirmationMode ?? "combined-score")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), confirmationMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="combined-score">Combined score</option><option value="price-response">Price response</option><option value="persistence">Persistence</option><option value="replenishment">Replenishment</option><option value="immediate">Immediate low progress</option><option value="any-enabled">Any enabled</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Visual mode</span>
                      <KwantSelect value={String(settingsInstance.settings?.renderMode ?? "hybrid")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), renderMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="hybrid">Hybrid</option><option value="cells">Price-time cells</option><option value="zones">Zones</option><option value="markers">Event markers</option><option value="candle-highlights">Candle highlights</option><option value="active-profile">Active profile</option><option value="lower-pane">Lower pane</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Zone extension</span>
                      <KwantSelect value={String(settingsInstance.settings?.zoneExtensionMode ?? "until-broken")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), zoneExtensionMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="until-broken">Until broken</option><option value="right-edge">Right edge</option><option value="fixed-time">Fixed time</option><option value="session-end">Session end</option><option value="manual">Manual</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Break logic</span>
                      <KwantSelect value={String(settingsInstance.settings?.breakMode ?? "combined")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), breakMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="combined">Combined</option><option value="first-trade">First trade through</option><option value="minimum-volume">Minimum volume</option><option value="minimum-time">Minimum time</option><option value="bar-close">Bar close</option>
                      </KwantSelect>
                    </label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">
                    Uses the shared Footprint execution stream and DOM Level 3 book. It flags suspicious absorption and replenishment patterns; it does not identify a trader or legally establish intent.
                  </p>
                </div>
              ) : null}

              {settingsDefinition.id === "stacked-imbalance-suite" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Imbalance preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Object.entries(STACKED_IMBALANCE_PRESETS).map(([preset, presetSettings]) => (
                        <button key={preset} type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...presetSettings, preset } }))} className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Comparison</span><KwantSelect value={String(settingsInstance.settings?.comparisonMode ?? "diagonal")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), comparisonMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="diagonal">Diagonal</option><option value="horizontal">Horizontal</option><option value="custom-offset">Custom offset</option><option value="both">Both</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Qualification</span><KwantSelect value={String(settingsInstance.settings?.qualificationMode ?? "ratio")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), qualificationMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="ratio">Ratio</option><option value="difference">Difference</option><option value="dominance">Dominance</option><option value="ratio-and-difference">Ratio + difference</option><option value="ratio-or-difference">Ratio or difference</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Scope</span><KwantSelect value={String(settingsInstance.settings?.scopeMode ?? "bar")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), scopeMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="bar">Bar</option><option value="session">Session</option><option value="rolling-bars">Rolling bars</option><option value="custom-anchor">Custom anchor</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Sides</span><KwantSelect value={String(settingsInstance.settings?.enabledSides ?? "both")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), enabledSides: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="both">Ask + Bid</option><option value="ask">Ask only</option><option value="bid">Bid only</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Live bar</span><KwantSelect value={String(settingsInstance.settings?.liveBarMode ?? "live")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), liveBarMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="live">Update live</option><option value="closed">Closed bars only</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Zone extension</span><KwantSelect value={String(settingsInstance.settings?.zoneExtensionMode ?? "until-broken")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), zoneExtensionMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="until-broken">Until broken</option><option value="fixed-bars">Fixed bars</option><option value="session-end">Session end</option></KwantSelect></label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">Uses the exact price cells from the shared Footprint execution stream. Unknown-side volume is excluded; zero-side cells are explicitly labelled instead of represented as infinite ratios.</p>
                </div>
              ) : null}

              {settingsDefinition.id === "iceberg-refresh-detector" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Detection preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(ICEBERG_REFRESH_PRESETS).map(([preset, presetSettings]) => (
                        <button key={preset} type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...presetSettings, preset } }))} className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Visualisation</span><KwantSelect value={String(settingsInstance.settings?.visualizationMode ?? "hybrid")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), visualizationMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="hybrid">Hybrid</option><option value="price-time-cells">Price-time cells</option><option value="refresh-markers">Refresh markers</option><option value="zones">Zones</option><option value="active-profile">Active profile</option><option value="footprint-cells">Footprint cells</option><option value="dom-highlights">DOM highlights</option><option value="lower-pane">Lower pane</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Excess replenishment</span><KwantSelect value={String(settingsInstance.settings?.excessReplenishmentTreatment ?? "ordinary-stack")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), excessReplenishmentTreatment: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="ordinary-stack">Ordinary stack</option><option value="candidate-replenishment">Candidate refresh</option><option value="ignore">Ignore</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Move into level</span><KwantSelect value={String(settingsInstance.settings?.moveIntoLevelTreatment ?? "exclude")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), moveIntoLevelTreatment: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="exclude">Exclude</option><option value="include-low-confidence">Low confidence</option><option value="include-normal">Include normally</option></KwantSelect></label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">This tool detects repeated passive-liquidity replenishment. “Suspected Iceberg” is an inference unless the feed explicitly supplies a native iceberg flag. The current normalized feed provides price-level evidence, not trader identity, reserve quantity, or legal intent.</p>
                </div>
              ) : null}

              {settingsDefinition.id === "liquidity-stop-sweep-detector" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Sweep preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(LIQUIDITY_STOP_SWEEP_PRESETS).map(([preset, presetSettings]) => (
                        <button key={preset} type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...presetSettings, preset } }))} className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}>
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Visualisation</span>
                      <KwantSelect value={String(settingsInstance.settings?.visualizationMode ?? "hybrid")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), visualizationMode: event.target.value, preset: "custom" } }))} className="h-9 w-full">
                        <option value="hybrid">Hybrid</option><option value="range-brackets">Range brackets</option><option value="price-time-bands">Price-time bands</option><option value="event-markers">Event markers</option><option value="stop-sweep-zones">Stop-sweep zones</option><option value="active-event-lane">Active event lane</option><option value="lower-pane">Lower pane</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Stop-sweep inference</span>
                      <KwantSelect value={settingsInstance.settings?.stopSweepInferenceEnabled === false ? "off" : "on"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), stopSweepInferenceEnabled: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full">
                        <option value="on">On — frozen references</option><option value="off">Off — direct sweeps only</option>
                      </KwantSelect>
                    </label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted">
                      <span>Dynamic baseline</span>
                      <KwantSelect value={settingsInstance.settings?.dynamicBaselineEnabled === false ? "off" : "on"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), dynamicBaselineEnabled: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full">
                        <option value="on">On</option><option value="off">Off</option>
                      </KwantSelect>
                    </label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">Direct sweeps are observed aggressive executions across price levels. Stop-sweep labels are inferred only when that execution crosses a frozen reference. The tool does not identify a trader or legally establish intent.</p>
                </div>
              ) : null}

              {settingsDefinition.id === "poc-auction-suite" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">POC & auction preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(POC_AUCTION_PRESETS).map(([preset, presetSettings]) => (
                        <button key={preset} type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...presetSettings, preset } }))} className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}>
                          {preset.replaceAll("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>POC metric</span><KwantSelect value={String(settingsInstance.settings?.metric ?? "total-volume")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), metric: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="total-volume">Total volume</option><option value="bid-volume">Bid volume</option><option value="ask-volume">Ask volume</option><option value="absolute-delta">Absolute delta</option><option value="trade-count">Trade count</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Grouping</span><KwantSelect value={String(settingsInstance.settings?.groupingMode ?? "follow-footprint")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), groupingMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="follow-footprint">Follow Footprint</option><option value="raw-exchange-tick">Raw exchange tick</option><option value="custom-ticks">Custom ticks</option><option value="automatic">Automatic</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Tie break</span><KwantSelect value={String(settingsInstance.settings?.tieBreakMode ?? "follow-shared-profile-engine")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), tieBreakMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="follow-shared-profile-engine">Shared profile engine</option><option value="closest-to-volume-weighted-price">Closest to VWAP</option><option value="closest-to-close">Closest to close</option><option value="highest-price">Highest price</option><option value="lowest-price">Lowest price</option><option value="first-achieved">First achieved</option><option value="last-achieved">Last achieved</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>POC band</span><KwantSelect value={String(settingsInstance.settings?.pocBandMode ?? "single-price-group")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), pocBandMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="single-price-group">Single price group</option><option value="percentage-of-maximum">Percentage of maximum</option><option value="top-n-contiguous-groups">Top contiguous groups</option><option value="custom-ticks">Custom ticks</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Auction source</span><KwantSelect value={String(settingsInstance.settings?.auctionExtremeSource ?? "raw-exchange-tick")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), auctionExtremeSource: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="raw-exchange-tick">Raw one-tick executions</option><option value="displayed-group">Displayed group approximation</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Resolution</span><KwantSelect value={String(settingsInstance.settings?.auctionResolutionMode ?? "first-touch")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), auctionResolutionMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="first-touch">First touch</option><option value="trade-through">Trade through</option><option value="minimum-volume-at-level">Minimum volume at level</option><option value="new-finished-extreme">New finished extreme</option><option value="combined">Combined</option></KwantSelect></label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">Uses the shared Footprint execution stream. Auction extremes use exact one-tick rows when available and never fabricate bid/ask behaviour from OHLC bars.</p>
                </div>
              ) : null}

              {settingsDefinition.id === "tape-speed-order-flow-burst" ? (
                <div className="space-y-3 border border-primary/20 bg-primary/[0.035] p-3">
                  <div>
                    <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted">Tape-speed preset</div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(TAPE_SPEED_PRESETS).map(([preset, presetSettings]) => (
                        <button key={preset} type="button" onClick={() => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), ...presetSettings, preset } }))} className={`min-h-8 border px-2 text-[7px] font-semibold uppercase tracking-[0.08em] ${settingsInstance.settings?.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}>
                          {preset.replaceAll("-", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Window</span><KwantSelect value={String(settingsInstance.settings?.windowMode ?? "rolling")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), windowMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="rolling">Rolling</option><option value="fixed">Fixed buckets</option><option value="chart-bar">Chart bars</option><option value="event-burst">Event bursts</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Pane metric</span><KwantSelect value={String(settingsInstance.settings?.paneMode ?? "contracts-per-second")} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), paneMode: event.target.value, preset: "custom" } }))} className="h-9 w-full"><option value="contracts-per-second">Contracts / second</option><option value="trades-per-second">Trades / second</option><option value="delta-per-second">Delta / second</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Dynamic baseline</span><KwantSelect value={settingsInstance.settings?.dynamicBaselineEnabled === false ? "off" : "on"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), dynamicBaselineEnabled: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full"><option value="on">On</option><option value="off">Off</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Delta line</span><KwantSelect value={settingsInstance.settings?.showDeltaSpeed === true ? "on" : "off"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), showDeltaSpeed: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full"><option value="off">Off</option><option value="on">On</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Main-chart bands</span><KwantSelect value={settingsInstance.settings?.showPriceTimeBands === false ? "off" : "on"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), showPriceTimeBands: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full"><option value="on">On</option><option value="off">Off</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Major markers</span><KwantSelect value={settingsInstance.settings?.showMarkers === false ? "off" : "on"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), showMarkers: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full"><option value="on">On</option><option value="off">Off</option></KwantSelect></label>
                    <label className="space-y-1.5 text-[8px] uppercase tracking-[0.1em] text-muted"><span>Confirmed alerts</span><KwantSelect value={settingsInstance.settings?.alertsEnabled === true ? "on" : "off"} onChange={(event) => replace(settingsInstance.instanceId, (current) => ({ ...current, settings: { ...(current.settings ?? {}), alertsEnabled: event.target.value === "on", preset: "custom" } }))} className="h-9 w-full"><option value="off">Off</option><option value="on">On</option></KwantSelect></label>
                  </div>
                  <p className="text-[8px] leading-4 text-muted">Uses the shared direct Rithmic execution tape. Unknown-side contracts remain in total speed but are excluded from directional speed and delta; OHLCV is never substituted for missing executions.</p>
                </div>
              ) : null}

              {settingsDefinition.id === "gamma-environment" ? (
                <div className="grid gap-3 border border-primary/20 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span>Box position</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.position ?? "top-right")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), position: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Gamma Environment position"
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-middle">Top middle</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-middle">Bottom middle</option>
                      <option value="bottom-right">Bottom right</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span className="flex items-center justify-between">
                      <span>Box size</span>
                      <span className="font-mono normal-case text-foreground">{Math.round(Number(settingsInstance.settings?.badgeScale ?? 1) * 100)}%</span>
                    </span>
                    <input
                      type="range"
                      min={0.6}
                      max={2}
                      step={0.05}
                      value={Number(settingsInstance.settings?.badgeScale ?? 1)}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), badgeScale: Number(event.target.value) },
                      }))}
                      className="w-full accent-primary"
                      aria-label="Gamma Environment box size"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={settingsInstance.settings?.useThemeColors !== false}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), useThemeColors: event.target.checked },
                      }))}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Use theme colours
                  </label>
                  {settingsInstance.settings?.useThemeColors === false ? (
                    <>
                      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <span>Positive gamma</span>
                        <ChartColorField
                          ariaLabel="Positive gamma colour"
                          value={String(settingsInstance.settings?.positiveColor ?? "#22C55E")}
                          onChange={(hex) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), positiveColor: hex },
                          }))}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <span>Negative gamma</span>
                        <ChartColorField
                          ariaLabel="Negative gamma colour"
                          value={String(settingsInstance.settings?.negativeColor ?? "#EF4444")}
                          onChange={(hex) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), negativeColor: hex },
                          }))}
                        />
                      </div>
                    </>
                  ) : null}
                  <p className="text-[8px] leading-4 text-muted sm:col-span-2">
                    Uses the same authoritative gamma-environment frame as Kwant Levels and keeps the latest good snapshot visible between refreshes.
                  </p>
                </div>
              ) : null}

              {settingsDefinition.id === "vix-environment" ? (
                <div className="grid gap-3 border border-primary/20 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Box position</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.position ?? "top-left")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), position: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="VIX Environment position"
                    >
                      <option value="top-left">Top left</option>
                      <option value="top-middle">Top middle</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-middle">Bottom middle</option>
                      <option value="bottom-right">Bottom right</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Volatility source</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.sourceSymbol ?? "VIX")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), sourceSymbol: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="VIX Environment source"
                    >
                      <option value="VIX">VIX · S&amp;P 500 volatility</option>
                      <option value="VXN">VXN · Nasdaq-100 volatility</option>
                      <option value="AUTO">Auto · match instrument family</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <span className="flex items-center justify-between">
                      <span>Box size</span>
                      <span className="font-mono normal-case text-foreground">{Math.round(Number(settingsInstance.settings?.badgeScale ?? 1) * 100)}%</span>
                    </span>
                    <input
                      type="range"
                      min={0.6}
                      max={2}
                      step={0.05}
                      value={Number(settingsInstance.settings?.badgeScale ?? 1)}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), badgeScale: Number(event.target.value) },
                      }))}
                      className="w-full accent-primary"
                      aria-label="VIX Environment box size"
                    />
                  </label>
                  {[
                    ["showChange", "Daily change"],
                    ["showRange", "Session range"],
                    ["showRank", "52-week rank"],
                    ["showPercentile", "52-week percentile"],
                    ["showFreshness", "Freshness"],
                    ["showSource", "Data source"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
                      <input
                        type="checkbox"
                        checked={settingsInstance.settings?.[key] !== false && (key !== "showSource" || settingsInstance.settings?.showSource === true)}
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [key]: event.target.checked },
                        }))}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={settingsInstance.settings?.useThemeColors === true}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), useThemeColors: event.target.checked },
                      }))}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    Use theme colours
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-4">
                    {[
                      ["normalThreshold", "Normal from", 15],
                      ["elevatedThreshold", "Elevated from", 20],
                      ["highThreshold", "High from", 25],
                      ["extremeThreshold", "Extreme from", 30],
                    ].map(([key, label, fallback]) => (
                      <label key={String(key)} className="space-y-1 text-[8px] uppercase tracking-[0.1em] text-muted">
                        <span>{String(label)}</span>
                        <input
                          type="number"
                          min={5}
                          max={100}
                          step={1}
                          value={Number(settingsInstance.settings?.[String(key)] ?? fallback)}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [String(key)]: Number(event.target.value) },
                          }))}
                          className="h-8 w-full border border-border bg-background px-2 font-mono text-[10px] text-foreground"
                        />
                      </label>
                    ))}
                  </div>
                  {settingsInstance.settings?.useThemeColors !== true ? (
                    <div className="grid gap-2 sm:col-span-2 sm:grid-cols-5">
                      {[
                        ["calmColor", "Calm", "#22C55E"],
                        ["normalColor", "Normal", "#38BDF8"],
                        ["elevatedColor", "Elevated", "#F59E0B"],
                        ["highColor", "High", "#F97316"],
                        ["extremeColor", "Extreme", "#EF4444"],
                      ].map(([key, label, fallback]) => (
                        <div key={key} className="flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.1em] text-muted sm:block sm:space-y-1">
                          <span>{label}</span>
                          <ChartColorField
                            ariaLabel={`${label} VIX regime colour`}
                            value={String(settingsInstance.settings?.[key] ?? fallback)}
                            onChange={(hex) => replace(settingsInstance.instanceId, (current) => ({
                              ...current,
                              settings: { ...(current.settings ?? {}), [key]: hex },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[8px] leading-4 text-muted sm:col-span-2">
                    VIX is the market&apos;s 30-day implied-volatility index. The 52-week rank places today inside its trailing range; percentile is the share of trailing closes at or below today. Replay never reads beyond its selected clock.
                  </p>
                </div>
              ) : null}

              {settingsDefinition.id === "zero-gamma-line" ? (
                <div className="grid gap-3 border border-primary/20 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Line type</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.lineStyle ?? "solid")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), lineStyle: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Zero Gamma line type"
                    >
                      <option value="dotted">Dotted</option>
                      <option value="dashed">Dashed</option>
                      <option value="solid">Solid</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Options chain</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.sourceTicker ?? "AUTO")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), sourceTicker: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="Zero Gamma options chain"
                    >
                      <option value="AUTO">Automatic (this chart&apos;s family)</option>
                      {zeroGammaSourceChoices(instrument).map((source) => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </KwantSelect>
                  </label>
                  <div className="text-[8px] leading-4 text-muted sm:col-span-2">
                    Paints the verified zero-Gamma crossing forward beside price like a running VWAP. Automatic uses the chart&apos;s own options family; pinning a chain reads the crossing off that chain instead. Only chains in this chart&apos;s Gamma family are offered, so the line never plots another market&apos;s dealer positioning on this price.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "cumulative-volume-delta" ? (
                <div className="grid gap-3 border border-primary/20 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Display style</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.displayStyle ?? "candles")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), displayStyle: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="CVD display style"
                    >
                      <option value="candles">CVD candles</option>
                      <option value="line">CVD line</option>
                      <option value="bars">CVD bars</option>
                    </KwantSelect>
                  </label>
                  <label className="space-y-1.5 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <span>Input data</span>
                    <KwantSelect
                      value={String(settingsInstance.settings?.inputData ?? "Volumes")}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), inputData: event.target.value },
                      }))}
                      className="h-9 w-full border border-border bg-background px-3 text-[10px] normal-case tracking-normal text-foreground"
                      menuLabel="CVD input data"
                    >
                      <option value="Volumes">Volumes</option>
                      <option value="Aggregate Trades">Aggregate trades</option>
                    </KwantSelect>
                  </label>
                  <p className="text-[8px] leading-4 text-muted sm:col-span-2">
                    CVD resets at the 17:00 Chicago futures-session boundary and accumulates real aggressor-side executions. Display and colour choices moved here from the chart pane.
                  </p>
                </div>
              ) : null}

              {settingsDefinition.id === "kwant-stats" ? (
                <div className="space-y-2 rounded-lg border border-border bg-surface/30 p-2.5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Colour scheme</div>
                  <select
                    value={String(settingsInstance.settings?.statsPaletteId ?? "")}
                    onChange={(event) => {
                      const palette = resolveStatsPalette(event.target.value);
                      replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: {
                          ...(current.settings ?? {}),
                          // Choosing Custom leaves the colours exactly where
                          // they are and only forgets which scheme they came
                          // from. It must not undo work already done.
                          ...(palette ? statsPaletteSettings(palette) : { statsPaletteId: "" }),
                        },
                      }));
                    }}
                    aria-label="Kwant Stats colour scheme"
                    className="h-9 w-full rounded-lg border border-border bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary/40"
                  >
                    <option value="">Custom · set each colour below</option>
                    {STATS_PALETTES.map((palette) => (
                      <option key={palette.id} value={palette.id}>{palette.label}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-1">
                    {STATS_PALETTES.map((palette) => {
                      const active = settingsInstance.settings?.statsPaletteId === palette.id;
                      return (
                        <button
                          key={palette.id}
                          type="button"
                          title={palette.label}
                          aria-label={palette.label}
                          onClick={() => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), ...statsPaletteSettings(palette) },
                          }))}
                          className={`flex h-5 w-9 overflow-hidden rounded-[3px] border ${active ? "border-primary" : "border-border hover:border-primary/40"}`}
                        >
                          <i className="h-full flex-1" style={{ backgroundColor: palette.positiveColor }} />
                          <i className="h-full flex-1" style={{ backgroundColor: palette.neutralColor }} />
                          <i className="h-full flex-1" style={{ backgroundColor: palette.negativeColor }} />
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[8px] leading-4 text-muted">
                    A scheme sets all five colours and switches this study off the chart theme, which would otherwise
                    stay in charge and leave the choice doing nothing.
                  </p>
                </div>
              ) : null}

              {/*
                * Save, open and import — on every indicator, not just the
                * footprint. Rendered before the settings themselves so a
                * template is reachable without scrolling past everything it
                * would change.
                */}
              <IndicatorTemplateBar
                indicatorId={settingsDefinition.id}
                settings={settingsInstance.settings ?? {}}
                onApply={(next) => replace(settingsInstance.instanceId, (current) => ({
                  ...current,
                  settings: next,
                }))}
              />

              {(() => {
                const numericSettings = (INDICATOR_NUMERIC_SETTINGS[settingsDefinition.id] ?? [])
                  .filter((setting) => !(settingsDefinition.id === "bounce-levels" && setting.key === "topExposurePercent"));
                const bySection = new Map<string, typeof numericSettings>();
                for (const setting of numericSettings) {
                  const section = sectionForSetting(settingsDefinition.id, setting.key, "Inputs");
                  bySection.set(section, [...(bySection.get(section) ?? []), setting]);
                }
                return [...bySection.entries()].map(([section, group]) => (
                  <div key={section} data-settings-section={section} className="space-y-4">
                    {group.map((setting) => {
                const value = Number(settingsInstance.settings?.[setting.key] ?? setting.defaultValue);
                return (
                  <label key={setting.key} className="block rounded-xl border border-border bg-surface/30 p-3">
                    <span className="mb-2 flex items-center justify-between text-[10px] text-muted">
                      <span>{setting.label}</span>
                      <input
                        type="number"
                        min={setting.min}
                        max={setting.max}
                        step={setting.step ?? 1}
                        value={value}
                        onChange={(event) => {
                          const requested = Number(event.target.value);
                          const nextValue = Math.min(setting.max, Math.max(setting.min, Number.isFinite(requested) ? requested : setting.defaultValue));
                          replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: {
                              ...applyNumericIndicatorSetting(settingsDefinition.id, current.settings, setting.key, nextValue),
                              ...bigTradeModeFor(settingsDefinition.id, setting.key, nextValue),
                            },
                          }));
                        }}
                        className="h-7 w-24 rounded-lg border border-border bg-background px-2 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </span>
                    <input
                      type="range"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step ?? 1}
                      value={value}
                      onChange={(event) => {
                        const requested = Number(event.target.value);
                        const nextValue = Math.min(setting.max, Math.max(setting.min, Number.isFinite(requested) ? requested : setting.defaultValue));
                        replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: {
                            ...applyNumericIndicatorSetting(settingsDefinition.id, current.settings, setting.key, nextValue),
                            ...bigTradeModeFor(settingsDefinition.id, setting.key, nextValue),
                          },
                        }));
                      }}
                      className="w-full accent-primary"
                    />
                  </label>
                );
                    })}
                  </div>
                ));
              })()}

              {(() => {
                const entries = Object.entries(settingsInstance.settings ?? {})
                  .filter(([key, value]) =>
                    !INDICATOR_NUMERIC_SETTINGS[settingsDefinition.id]?.some((setting) => setting.key === key)
                    && !(settingsDefinition.id === "deep-print-footprint" && FOOTPRINT_PROFILE_MANAGED_SETTINGS.has(key))
                    && !(settingsDefinition.id === "bounce-levels" && key === "syncGexMapColors")
                    && (typeof value === "boolean" || isColourSetting(key, value)))
                  .map(([key, value]) => [key, value, sectionForSetting(settingsDefinition.id, key, "Style")] as const);
                const bySection = new Map<string, Array<readonly [string, unknown, string]>>();
                for (const entry of entries) {
                  bySection.set(entry[2], [...(bySection.get(entry[2]) ?? []), entry]);
                }
                const themeColours = themeColourMapFor(settingsDefinition.id, chartSettings);
                // A gradient scheme replaces every profile body colour, so the
                // pickers would silently do nothing while one is selected.
                const gradientLocked = (
                  VOLUME_PROFILE_INDICATOR_IDS.has(settingsDefinition.id)
                  || isTpoIndicator(settingsDefinition.id)
                ) && isVolumeProfileGradientActive(settingsInstance.settings?.gradientPreset);
                const control = ([key, value]: readonly [string, unknown, string]) => (
                    typeof value === "boolean" ? (
                      <label key={key} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <input
                          type="checkbox"
                          checked={value === true}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: event.target.checked },
                          }))}
                          className="accent-primary"
                        />
                        <span>{titleFromKey(key)}</span>
                      </label>
                    ) : (
                      <div key={key} className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <span className="truncate">{titleFromKey(key)}</span>
                        <ChartColorField
                          ariaLabel={`${titleFromKey(key)} colour`}
                          disabled={gradientLocked}
                          title={gradientLocked
                            ? "The gradient scheme owns this colour. Set the scheme to Off to pick colours individually."
                            : undefined}
                          value={themeColours && settingsInstance.settings?.useThemeColors !== false
                            ? String(themeColours[key] ?? value)
                            : String(value)}
                          onChange={(hex) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: {
                              ...(current.settings ?? {}),
                              // Seed the sibling theme colours first, where a
                              // map exists, so the ones NOT being picked do not
                              // jump to whatever the theme was when the
                              // indicator was added.
                              ...(themeColours && current.settings?.useThemeColors !== false ? themeColours : {}),
                              // Picking a colour IS the override. This used to
                              // be gated on having a theme map, which only
                              // bounce levels and the volume profiles have — so
                              // on every other indicator the chosen colour was
                              // saved and then ignored, because the renderer
                              // reads the theme while useThemeColors is true.
                              useThemeColors: false,
                              [key]: hex,
                            },
                          }))}
                        />
                      </div>
                    )
                );
                return [...bySection.entries()].map(([section, group]) => (
                  <div key={section} data-settings-section={section} className="grid gap-2 sm:grid-cols-2">
                    {group.map(control)}
                  </div>
                ));
              })()}
              <div data-settings-section="Style" className="rounded-xl border border-primary/15 bg-primary/6 px-4 py-3 text-[9px] leading-4 text-muted">
                {settingsDefinition.id === "bounce-levels" ? (
                  <>Bounce colours follow the active chart theme by default. Changing any colour automatically creates a workspace-specific palette; turn <span className="text-foreground">Use Theme Colors</span> back on to relink it.</>
                ) : (
                  <>Theme colours remain linked by default. Turn off <span className="text-foreground">Use Theme Colors</span> before setting custom study colours.</>
                )}
              </div>
            </IndicatorSettingsSections>
            {settingsDefinition.id === "deep-print-footprint" ? (
              <div className="border-t border-border bg-panel px-5 py-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    maxLength={48}
                    value={footprintTemplateName}
                    onChange={(event) => setFootprintTemplateName(event.target.value)}
                    placeholder="Template name"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[10px] text-foreground outline-none placeholder:text-muted focus:border-primary/40"
                  />
                  <button
                    type="button"
                    disabled={!footprintTemplateName.trim()}
                    onClick={() => {
                      const next = saveFootprintTemplate(footprintTemplateName, settingsInstance.settings);
                      const saved = next.find((template) => template.name.toLowerCase() === footprintTemplateName.trim().toLowerCase());
                      setFootprintTemplates(next);
                      setSelectedFootprintTemplateId(saved?.id ?? "");
                      if (saved) {
                        saveFootprintSelection(settingsInstance.instanceId, {
                          preset: selectedFootprintPreset,
                          templateId: saved.id,
                        });
                      }
                      setFootprintSaveStatus(saved ? `Saved template ${saved.name}` : "Template name required");
                      if (saved) setFootprintTemplateName("");
                    }}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[9px] font-semibold uppercase tracking-[0.08em] text-foreground hover:border-primary/35 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const validated = validateFootprintSettings(settingsInstance.settings);
                      replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), ...validated },
                      }));
                      saveFootprintSettings(settingsInstance.instanceId, validated);
                      window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
                      setFootprintSaveStatus("Footprint settings saved locally");
                    }}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-[9px] font-semibold uppercase tracking-[0.08em] text-background"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save settings
                  </button>
                </div>
                {footprintSaveStatus ? (
                  <div className="mt-2 text-[8px] text-primary" role="status">{footprintSaveStatus}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
