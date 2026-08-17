"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  footprintProfileGranularityTicks,
  validateFootprintSettings,
  type FootprintPresetName,
  type FootprintTemplate,
} from "@/lib/footprintSettings";
import KwantSelect from "@/components/ui/KwantSelect";
import { PULLING_STACKING_PRESETS } from "@/lib/pullingStacking";
import { ABSORPTION_PRESETS } from "@/lib/absorptionDetector";
import { STACKED_IMBALANCE_PRESETS } from "@/lib/stackedImbalanceSuite";
import { ICEBERG_REFRESH_PRESETS } from "@/lib/icebergRefreshDetector";
import { LIQUIDITY_STOP_SWEEP_PRESETS } from "@/lib/liquidityStopSweepDetector";
import { POC_AUCTION_PRESETS } from "@/lib/pocAuctionSuite";
import { TAPE_SPEED_PRESETS } from "@/lib/tapeSpeedOrderFlowBurst";

const FAVOURITES_STORAGE_KEY = "kwantdesk-chart-indicator-favourites";
const FOOTPRINT_PROFILE_MANAGED_SETTINGS = new Set([
  "showPerBarVolumeProfile",
  "showPerBarDeltaProfile",
  "perBarProfileScaleMode",
  "perBarProfileGranularity",
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
export const RENDERED_CHART_INDICATOR_IDS = new Set([
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

function divergenceMarketPair(instrument: string) {
  const normalized = instrument.trim().toUpperCase();
  if (/^M?NQ/.test(normalized)) return { primary: "NQ", comparison: "ES" };
  if (/^M?ES/.test(normalized)) return { primary: "ES", comparison: "NQ" };
  return null;
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
    return CHART_INDICATOR_CATALOG
      .filter((definition) => definition.id !== "source-code-indicator")
      .filter((definition) => category === "All" || definition.category === category)
      .filter((definition) =>
        !needle
        || definition.name.toLowerCase().includes(needle)
        || definition.description.toLowerCase().includes(needle)
        || definition.category.toLowerCase().includes(needle))
      .sort((left, right) => {
        const favouriteDifference =
          Number(favourites.includes(right.id)) - Number(favourites.includes(left.id));
        return favouriteDifference || left.name.localeCompare(right.name);
      });
  }, [category, favourites, search]);

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

  const closeSettingsDialog = useCallback(() => {
    if (settingsInstance?.indicatorId === "deep-print-footprint") {
      const validated = validateFootprintSettings(settingsInstance.settings);
      replace(settingsInstance.instanceId, (current) => ({
        ...current,
        settings: { ...(current.settings ?? {}), ...validated },
      }));
      saveFootprintSettings(settingsInstance.instanceId, validated);
      window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
    }
    setSettingsInstanceId(null);
  }, [replace, settingsInstance]);

  useEffect(() => {
    if (!settingsInstanceId) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && settingsDialogRef.current?.contains(target)) return;
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
          className={`kwant-chart-row-control flex h-7 items-center gap-1.5 rounded-[3px] border px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] transition-colors ${
            open
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-border bg-surface/50 text-muted hover:border-primary/25 hover:text-foreground"
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
              <div>
                <div className="text-[12px] font-semibold text-foreground">Chart indicators</div>
                <div className="mt-0.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
                  <span>{instrument} Â· {timeframe} Â· this chart</span>
                  {rithmicStatus === "connected" ? (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">
                      Rithmic L3
                    </span>
                  ) : rithmicStatus === "checking" ? (
                    <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[7px] font-semibold text-muted">
                      Checking feed
                    </span>
                  ) : null}
                </div>
              </div>
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
                          {definition.category} Â· live
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
              <div>
                <div className="text-[15px] font-semibold text-foreground">Indicator library</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{instrument} Â· {timeframe}</div>
              </div>
              <div className="ml-auto flex w-[360px] items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary/40">
                <Search className="h-3.5 w-3.5 text-muted" />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search CVD, volume, VWAP..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted/55"
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
                    <span className="font-mono text-[8px] opacity-70">
                      {item === "All"
                        ? CHART_INDICATOR_CATALOG.length
                        : CHART_INDICATOR_CATALOG.filter((definition) => definition.category === item).length}
                    </span>
                  </button>
                ))}
                <div className="mt-4 rounded-xl border border-border bg-surface/35 p-3 text-[9px] leading-4 text-muted">
                  Favourites appear first. Live studies inherit the chart theme.
                </div>
              </aside>
              <section className="min-w-0 flex-1 overflow-y-auto p-3">
                <div className="mb-2 px-2 text-[9px] font-medium uppercase tracking-[0.14em] text-muted">
                  {category} Â· {filtered.length}
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
            className="pointer-events-auto flex max-h-[88vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60"
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
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{settingsDefinition.category} Â· live calculation</div>
              </div>
              <button type="button" onClick={closeSettingsDialog} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
                          ? { greekMode: "GAMMA", expirationMode: "zero-dte", maximumLevels: 5, proximityWeight: 25, accumulationWeight: 25, persistenceWeight: 5, freshnessWeight: 15, refreshSeconds: 2, showDevelopingNodes: true, showRocArrows: true }
                          : preset === "major-nodes-only"
                            ? { maximumLevels: 8, maximumMajorNodes: 0, showKing: true, showFloor: true, showCeiling: true, showGatekeepers: true, showMajorNodes: false, showClusters: false, showDevelopingNodes: false, showWeakeningNodes: false, showRetiredHistory: false, showAirPockets: false }
                            : preset === "fresh-bounce-levels"
                              ? { freshnessWeight: 30, persistenceWeight: 5, touchDecayFactor: 60, showTouchCount: true, showDevelopingNodes: true }
                              : preset === "node-momentum"
                                ? { accumulationWeight: 30, freshnessWeight: 5, showRocArrows: true, showDevelopingNodes: true, showWeakeningNodes: true, enableAlerts: true }
                                : preset === "clean-chart"
                                  ? { glowStrength: 0, showAirPockets: false, showTouchCount: false, showRocArrows: false, showRetiredHistory: false, showValues: false }
                                  : preset === "research"
                                    ? { maximumLevels: 24, minimumExposurePercentile: 0, minimumPercentOfKing: 0, minimumRelevanceScore: 0, showAirPockets: true, showTouchCount: true, showRocArrows: true, showRetiredHistory: true, showDevelopingNodes: true, showWeakeningNodes: true, showClusters: true }
                                    : { greekMode: "GAMMA", expirationMode: "zero-to-one-dte", maximumLevels: 8, minimumExposurePercentile: 90, minimumPercentOfKing: 15, minimumRelevanceScore: 55, magnitudeWeight: 45, proximityWeight: 15, accumulationWeight: 15, persistenceWeight: 10, freshnessWeight: 10, clusterWeight: 5, showDevelopingNodes: true, showClusters: true, showAirPockets: true, refreshSeconds: 5 };
                        replace(settingsInstance.instanceId, (current) => {
                          const currentSettings = current.settings ?? {};
                          const defaults = defaultIndicatorSettings("bounce-levels", chartSettings);
                          const preserved = Object.fromEntries([
                            "provider", "sourceTicker", "useThemeColors", "positiveColor", "negativeColor", "kingColor",
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
                  {[
                    ["Options source", "sourceTicker", [["AUTO", "Automatic"], ["QQQ", "QQQ"], ["NDX", "NDX"], ["SPY", "SPY"], ["SPX", "SPX"], ["SPXW", "SPXW"], ["IWM", "IWM"]]],
                    ["Exposure Greek", "greekMode", [["GAMMA", "Gamma"], ["DELTA", "Delta"], ["VANNA", "Vanna"], ["CHARM", "Charm"]]],
                    ["Expiration", "expirationMode", [["zero-dte", "0DTE"], ["zero-to-one-dte", "0–1 DTE"], ["zero-to-seven-dte", "0–7 DTE"], ["front-expiration", "Front expiration"], ["all-expirations", "All expirations"], ["custom-dte-range", "Custom DTE range"], ["specific-expirations", "Specific expirations"]]],
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
                      placeholder="2026-08-21, 2026-08-28"
                    />
                  </label>
                  <div className="border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    KING is always calculated from the full filtered strike list using the largest absolute signed exposure. Centre price and KING remain independent. Historical snapshots never read beyond replay time.
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
                              ? { displayMode: "raw", clusterEnabled: false, haloIntensity: 20, showReactionMarkers: false, precisionMode: true, showExactLine: true, showLabels: true }
                              : { displayMode: "raw-and-clusters", clusterEnabled: true, haloIntensity: 70, showReactionMarkers: true, precisionMode: true, showExactLine: true, showLabels: true }
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
                    Raw Top-N membership is always ranked by individual print notional. Exact prices are never rounded or replaced by clusters. QuantData validates off-exchange reporting; a specific ATS is claimed only when venue metadata exists. Gamma remains a separate halo and never changes the DP price or Top-N selection.
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
                    ["Mode", "mode", [["SESSION", "Session Â· fixed rails"], ["LIVE", "Live Â· time-decaying"]]],
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
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
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
                  {[
                    ["Content", "contentMode", [["bid-ask", "Bid Ã— Ask"], ["delta", "Delta"], ["volume", "Volume"], ["volume-delta", "Volume Ã— Delta"], ["trades", "Trades"], ["bid-ask-histogram", "Bid / Ask histogram"], ["volume-histogram", "Volume histogram"], ["delta-histogram", "Delta histogram"], ["ladder", "Minimal ladder"]]],
                    ["Visualization", "visualizationMode", [["solid", "Solid"], ["heatmap", "Heatmap"], ["histogram", "Histogram"], ["heatmap-histogram", "Heatmap histogram"], ["text-only", "Text only"]]],
                    ["Scale", "scaleMode", [["visible-region", "Visible region"], ["per-bar", "Per bar"], ["all-loaded", "All loaded"], ["fixed-maximum", "Fixed maximum"]]],
                    ["Input", "inputType", [["volume", "Executed volume"], ["num-trades", "Number of trades"]]],
                    ["Tick grouping", "groupingMode", [["automatic", "Automatic"], ["manual", "Manual"]]],
                    ["Grouping mode", "groupMode", [["fixed", "Fixed"], ["open-close", "Based on open / close"]]],
                    ["Imbalance", "imbalanceMode", [["diagonal", "Diagonal"], ["horizontal", "Horizontal"], ["delta-percent", "Delta percentage"]]],
                    ["Professional number format", "numberFormat", [["automatic", "Automatic"], ["full", "Full values"], ["compact", "Compact K / M"]]],
                    ["Colour mode", "colorMode", [["fading", "Fading intensity"], ["fixed", "Fixed opacity"], ["none", "No cell fill"]]],
                    ["Colour calculation", "colorCalculation", [["volume", "Volume"], ["delta", "Absolute delta"], ["imbalance", "Bid / Ask imbalance"], ["dominant", "Dominant side"], ["dominant-delta", "Dominant delta"]]],
                    ["Active candle outline", "outsideBarStyle", [["bar", "Full bar"], ["body", "Candle body"]]],
                    ["Live marker alignment", "markerAlignment", [["center", "Centre"], ["right", "Right edge"]]],
                    ["Maximum refresh rate", "fpsLimit", [["30", "30 FPS"], ["60", "60 FPS"], ["120", "120 FPS"]]],
                  ].map(([label, key, options]) => (
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
                  <div className="rounded-lg border border-border bg-background/55 px-3 py-2 text-[9px] leading-4 text-muted sm:col-span-2">
                    Bid Ã— Ask uses classified executions from the Rithmic / CME tape. Unclassified executions remain in total volume and POC, but never enter Bid, Ask, Delta or imbalance calculations.
                  </div>
                </div>
              ) : null}

              {settingsDefinition.id === "deep-print-footprint" ? (
                <section className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Volume Profile</div>
                    <p className="mt-1 text-[9px] leading-4 text-muted">
                      Builds from the same live executions as each footprint bar. Total volume faces right, signed delta faces left, and the POC square uses the footprint bar&apos;s exact POC row.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Volume profile · right", "showPerBarVolumeProfile", false],
                      ["Delta profile · left", "showPerBarDeltaProfile", false],
                      ["POC square", "showPerBarProfilePoc", true],
                      ["Profile outline", "perBarProfileOutline", false],
                    ].map(([label, key, fallback]) => (
                      <label key={String(key)} className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(settingsInstance.settings?.[String(key)] ?? fallback)}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [String(key)]: event.target.checked },
                          }))}
                          className="accent-primary"
                        />
                        <span>{String(label)}</span>
                      </label>
                    ))}
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
                    const detail = Number(settingsInstance.settings?.perBarProfileGranularity ?? 10);
                    const ticksPerRow = footprintProfileGranularityTicks(detail);
                    return (
                      <label className="block rounded-lg border border-border bg-surface/30 p-2.5">
                        <span className="mb-2 flex items-center justify-between text-[9px] text-muted">
                          <span>Profile granularity</span>
                          <span className="font-mono text-foreground">
                            {detail}/10 · {ticksPerRow} {ticksPerRow === 1 ? "tick" : "ticks"} per row
                          </span>
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={detail}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: {
                              ...(current.settings ?? {}),
                              perBarProfileGranularity: Number(event.target.value),
                            },
                          }))}
                          className="w-full accent-primary"
                        />
                        <span className="mt-1.5 flex justify-between text-[8px] text-muted">
                          <span>Combined</span>
                          <span>Fine · one tick</span>
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
                      <label key={String(key)} className="flex min-h-9 items-center justify-between rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <span>{String(label)}</span>
                        <input
                          type="color"
                          value={String(settingsInstance.settings?.[String(key)] ?? fallback)}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [String(key)]: event.target.value },
                          }))}
                          disabled={settingsInstance.settings?.useThemeColors !== false}
                          className="h-6 w-8 cursor-pointer border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-35"
                          title={settingsInstance.settings?.useThemeColors !== false ? "Turn off Use Theme Colors to set a custom colour" : undefined}
                        />
                      </label>
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
                <div className="rounded-lg border border-border bg-background/55 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">Footprint Bar</div>
                  <p className="mt-1 text-[9px] leading-4 text-muted">
                    Bar width, spacing, grouping, filters, typography and footprint-detail controls.
                  </p>
                </div>
              ) : null}

              {(settingsDefinition.id === "tpo-chart" || settingsDefinition.id === "weekly-tpo") ? (
                <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3">
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
                      ["Split TPO", "splitMode", [["none", "None"], ["last", "Last"], ["all", "All"]]],
                      ["Data fidelity", "visitSource", [["automatic", "Automatic"], ["exact-trades", "Exact trades"], ["bar-range", "Bar range"]]],
                      ["Tick grouping", "groupingMode", [["automatic", "Automatic"], ["manual", "Manual"]]],
                      ["Width mode", "widthMode", [["automatic", "Automatic"], ["period-percent", "Period percent"], ["window-percent", "Window percent"], ["fixed-bars", "Fixed bars"]]],
                      ["Session action", "filterMode", [["none", "No filter"], ["filter", "Filter"], ["split-two", "Split two"], ["split-three", "Split three"]]],
                      ["Session filter", "sessionPreset", [["eth", "ETH"], ["rth", "RTH"], ["custom", "Custom"]]],
                      ["Length unit", "lengthUnit", [["minute", "Minutes"], ["day", "Days"], ["week", "Weeks"], ["month", "Months"]]],
                      ["Daily end", "dailyEndMode", [["next-daily-start", "Next daily start"], ["explicit-time", "Explicit time"]]],
                      ["Weekly end", "weekEndMode", [["next-week-start", "Next week start"], ["explicit-day-time", "Explicit day/time"]]],
                      ["Colour calculation", "colourCalculation", [["time", "Time"], ["volume", "Volume"], ["delta", "Delta"]]],
                      ["Colour reference", "colourReference", [["fixed", "Fixed"], ["fading", "Fading"], ["multiple-ranges", "Multiple ranges"]]],
                      ["OHLC markers", "barMarkerStyle", [["body", "Body"], ["candle", "Candlestick"]]],
                      ["POC mode", "pocLineMode", [["none", "None"], ["final", "Final"], ["developing", "Developing"], ["extend-shifted", "Extend shifted"]]],
                      ["POC extension", "pocExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]]],
                      ["Value Area extension", "valueAreaExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]]],
                      ["Single Print extension", "singlePrintExtensionMode", [["none", "None"], ["to-window-end", "To window end"], ["until-first-interaction", "Until first interaction"]]],
                      ["Summary layout", "summaryLayout", [["compact", "Compact"], ["full", "Full"]]],
                      ["Summary location", "summaryLocation", [["top-left", "Top left"], ["top-right", "Top right"], ["bottom-left", "Bottom left"], ["bottom-right", "Bottom right"]]],
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

              {(INDICATOR_NUMERIC_SETTINGS[settingsDefinition.id] ?? []).map((setting) => {
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
                              ...(current.settings ?? {}),
                              [setting.key]: nextValue,
                              ...(settingsDefinition.id === "big-trades" && setting.key === "manualFilter"
                                ? { filterMode: "manual" }
                                : {}),
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
                            ...(current.settings ?? {}),
                            [setting.key]: nextValue,
                            ...(settingsDefinition.id === "big-trades" && setting.key === "manualFilter"
                              ? { filterMode: "manual" }
                              : {}),
                          },
                        }));
                      }}
                      className="w-full accent-primary"
                    />
                  </label>
                );
              })}

              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(settingsInstance.settings ?? {})
                  .filter(([key, value]) =>
                    !INDICATOR_NUMERIC_SETTINGS[settingsDefinition.id]?.some((setting) => setting.key === key)
                    && !(settingsDefinition.id === "deep-print-footprint" && FOOTPRINT_PROFILE_MANAGED_SETTINGS.has(key))
                    && (typeof value === "boolean" || isColourSetting(key, value)))
                  .map(([key, value]) => (
                    typeof value === "boolean" ? (
                      <label key={key} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: event.target.checked },
                          }))}
                          className="accent-primary"
                        />
                        <span>{titleFromKey(key)}</span>
                      </label>
                    ) : (
                      <label key={key} className="flex min-h-10 items-center justify-between rounded-lg border border-border bg-surface/30 px-3 text-[9px] text-muted">
                        <span>{titleFromKey(key)}</span>
                        <input
                          type="color"
                          value={settingsDefinition.id === "bounce-levels" && settingsInstance.settings?.useThemeColors !== false
                            ? String(bounceThemeColours(chartSettings)[key as keyof ReturnType<typeof bounceThemeColours>] ?? value)
                            : String(value)}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: {
                              ...(current.settings ?? {}),
                              ...(settingsDefinition.id === "bounce-levels" && current.settings?.useThemeColors !== false
                                ? bounceThemeColours(chartSettings)
                                : {}),
                              ...(settingsDefinition.id === "bounce-levels" ? { useThemeColors: false } : {}),
                              [key]: event.target.value,
                            },
                          }))}
                          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                        />
                      </label>
                    )
                  ))}
              </div>
              <div className="rounded-xl border border-primary/15 bg-primary/6 px-4 py-3 text-[9px] leading-4 text-muted">
                {settingsDefinition.id === "bounce-levels" ? (
                  <>Bounce colours follow the active chart theme by default. Changing any colour automatically creates a workspace-specific palette; turn <span className="text-foreground">Use Theme Colors</span> back on to relink it.</>
                ) : (
                  <>Theme colours remain linked by default. Turn off <span className="text-foreground">Use Theme Colors</span> before setting custom study colours.</>
                )}
              </div>
            </div>
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
