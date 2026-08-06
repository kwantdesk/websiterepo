"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Search,
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
  defaultIndicatorSettings,
} from "@/lib/chartIndicatorConfig";
import type { ChartSettings } from "@/lib/chartSettings";
import KwantSelect from "@/components/ui/KwantSelect";

const FAVOURITES_STORAGE_KEY = "kwantdesk-chart-indicator-favourites";

// These studies are rendered by the shared Kwantify calculation engine in
// Kwant Desk today. The complete catalogue stays visible so no study or
// favourite is lost while feed-specific studies are connected and validated.
export const RENDERED_CHART_INDICATOR_IDS = new Set([
  "volume",
  "delta-bar",
  "delta-highlight",
  "cumulative-volume-delta",
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
  "big-trades",
  "depth-of-market",
  "kwant-stats",
  "deep-m-effort-nq",
  "kwant-profile",
  "daily-volume-profile",
  "weekly-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
  "classic-gex-profile",
  "tpo-levels",
  "expected-move",
  "source-code-indicator",
]);

type Props = {
  instrument: string;
  timeframe: string;
  indicators: ChartIndicatorInstance[];
  chartSettings: ChartSettings;
  levelControls?: ChartLevelControl[];
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

export default function ChartIndicatorsControl({
  instrument,
  timeframe,
  indicators,
  chartSettings,
  levelControls = [],
  onChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsInstanceId, setSettingsInstanceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"All" | ChartIndicatorCategory>("All");
  const [favourites, setFavourites] = useState<string[]>(readFavourites);
  const [rithmicStatus, setRithmicStatus] = useState<"checking" | "connected" | "fallback">("checking");

  useEffect(() => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(favourites));
    window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
  }, [favourites]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
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

  const replace = (instanceId: string, update: (current: ChartIndicatorInstance) => ChartIndicatorInstance) => {
    onChange(indicators.map((instance) => instance.instanceId === instanceId ? update(instance) : instance));
  };

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
          className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-[11px] font-medium transition-colors ${
            open
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-border bg-surface/50 text-muted hover:border-primary/25 hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Indicators</span>
          {activeLayerCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] text-primary">
              {activeLayerCount}
            </span>
          ) : null}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="absolute right-0 top-[38px] z-[180] w-[380px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <div className="text-[12px] font-semibold text-foreground">Chart indicators</div>
                <div className="mt-0.5 flex items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-muted">
                  <span>{instrument} · {timeframe} · this chart</span>
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
                          <span className="mt-1 block line-clamp-2 text-[8px] leading-3 text-muted">{control.loading ? "Loading latest levels…" : control.description}</span>
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
          </div>
        ) : null}
      </div>

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
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{instrument} · {timeframe}</div>
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
                  {category} · {filtered.length}
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
                        <div className="w-[110px] shrink-0 text-right text-[8px] uppercase tracking-[0.12em] text-muted/70">{definition.category}</div>
                        <button
                          type="button"
                          disabled={!live || added}
                          onClick={() => add(definition.id)}
                          className={`flex h-8 min-w-[76px] items-center justify-center gap-1.5 rounded-lg px-3 text-[10px] font-medium ${
                            added
                              ? "bg-primary/10 text-primary"
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
          className="fixed inset-0 z-[270] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[3px]"
          onClick={() => setSettingsInstanceId(null)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-[15px] font-semibold text-foreground">{settingsInstance.indicatorId === "source-code-indicator" ? String(settingsInstance.settings?.scriptName ?? settingsDefinition.name) : settingsDefinition.name}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted">{settingsDefinition.category} · live calculation</div>
              </div>
              <button type="button" onClick={() => setSettingsInstanceId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground">
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

              {settingsDefinition.id === "expected-move" ? (
                <div className="grid gap-3 rounded-xl border border-primary/15 bg-primary/[0.035] p-3 sm:grid-cols-2">
                  {[
                    ["Mode", "mode", [["SESSION", "Session · fixed rails"], ["LIVE", "Live · time-decaying"]]],
                    ["Options source", "mappingSource", [["QQQ", "QQQ → NQ / MNQ"], ["NDX", "NDX → NQ / MNQ"]]],
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
                        onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                          ...current,
                          settings: { ...(current.settings ?? {}), [setting.key]: Number(event.target.value) },
                        }))}
                        className="h-7 w-24 rounded-lg border border-border bg-background px-2 text-right font-mono text-[10px] text-foreground outline-none focus:border-primary/40"
                      />
                    </span>
                    <input
                      type="range"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step ?? 1}
                      value={value}
                      onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                        ...current,
                        settings: { ...(current.settings ?? {}), [setting.key]: Number(event.target.value) },
                      }))}
                      className="w-full accent-primary"
                    />
                  </label>
                );
              })}

              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(settingsInstance.settings ?? {})
                  .filter(([key, value]) =>
                    !INDICATOR_NUMERIC_SETTINGS[settingsDefinition.id]?.some((setting) => setting.key === key)
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
                          value={String(value)}
                          onChange={(event) => replace(settingsInstance.instanceId, (current) => ({
                            ...current,
                            settings: { ...(current.settings ?? {}), [key]: event.target.value },
                          }))}
                          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent"
                        />
                      </label>
                    )
                  ))}
              </div>
              <div className="rounded-xl border border-primary/15 bg-primary/6 px-4 py-3 text-[9px] leading-4 text-muted">
                Theme colours remain linked by default. Turn off <span className="text-foreground">Use Theme Colors</span> before setting custom study colours.
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
