"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Gauge,
  Loader2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanLine,
  SkipBack,
  SkipForward,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import {
  GEX_MAP_GREEKS,
  type GexMapPanelPayload,
} from "@/lib/gexMap";
import {
  OPTIONS_FLOW_INSTRUMENTS,
  type ExposureStrike,
  type GreekMode,
} from "@/lib/optionsFlow";
import {
  fetchWorkspaceData,
  gexMapCacheKey,
  readWorkspaceData,
} from "@/lib/workspaceDataCache";

type PanelConfig = {
  id: "left" | "centre" | "right";
  symbol: string;
  greekMode: GreekMode;
};

type GexMapMarket = "NQ" | "ES";

type GexMapWorkspaceProps = {
  market?: GexMapMarket | null;
};

const DEFAULT_PANELS: PanelConfig[] = [
  { id: "left", symbol: "SPX", greekMode: "GAMMA" },
  { id: "centre", symbol: "SPY", greekMode: "DELTA" },
  { id: "right", symbol: "QQQ", greekMode: "VANNA" },
];
const MARKET_PANELS: Record<GexMapMarket, PanelConfig[]> = {
  NQ: [
    { id: "left", symbol: "NDX", greekMode: "GAMMA" },
    { id: "centre", symbol: "QQQ", greekMode: "DELTA" },
    { id: "right", symbol: "QQQ", greekMode: "VANNA" },
  ],
  ES: [
    { id: "left", symbol: "SPX", greekMode: "GAMMA" },
    { id: "centre", symbol: "SPY", greekMode: "DELTA" },
    { id: "right", symbol: "SPY", greekMode: "VANNA" },
  ],
};
const SPEEDS = [1, 2, 5, 10] as const;
const FRAME_STEPS = [1, 2, 5, 10] as const;

type GexMapDropdownOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
};

const easternTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function formatCompact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function linkedMarketFromLocation(): GexMapMarket | null {
  if (typeof window === "undefined") return null;
  const market = new URLSearchParams(window.location.search).get("market")?.toUpperCase();
  return market === "NQ" || market === "ES" ? market : null;
}

function initialPanelsForMarket(market: GexMapMarket | null) {
  return (market ? MARKET_PANELS[market] : DEFAULT_PANELS).map((panel) => ({ ...panel }));
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSessionDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function buildSnapshots(payload: GexMapPanelPayload, timestamp: number | null, stepMinutes: number) {
  if (timestamp === null) {
    const current = new Map(payload.latestStrikes.map((row) => [row.strike, row]));
    const previousTarget = Date.parse(payload.asOf) - stepMinutes * 60_000;
    const previous = new Map<number, ExposureStrike>();
    for (const frame of payload.frames) {
      if (frame.timestamp > previousTarget) break;
      for (const update of frame.updates) previous.set(update.strike, update);
    }
    return { current, previous };
  }

  const previousTarget = timestamp - stepMinutes * 60_000;
  const current = new Map<number, ExposureStrike>();
  const previous = new Map<number, ExposureStrike>();
  for (const frame of payload.frames) {
    if (frame.timestamp > timestamp) break;
    for (const update of frame.updates) {
      current.set(update.strike, update);
      if (frame.timestamp <= previousTarget) previous.set(update.strike, update);
    }
  }
  return { current, previous };
}

function priceAt(payload: GexMapPanelPayload, timestamp: number | null) {
  if (timestamp === null) return payload.stockPrice;
  let value: number | null = null;
  for (const candle of payload.candles) {
    if (candle.timestamp > timestamp) break;
    value = candle.close;
  }
  return value ?? payload.stockPrice;
}

function heatColor(value: number, strength: number) {
  if (Math.abs(value) < Number.EPSILON) return "var(--surface)";
  const tone = value > 0 ? "var(--primary)" : "var(--danger)";
  const intensity = Math.round(14 + Math.min(1, strength) * 78);
  return `color-mix(in srgb, ${tone} ${intensity}%, var(--chart-background))`;
}

function GexMapDropdown<T extends string>({
  ariaLabel,
  value,
  options,
  menuLabel,
  menuWidth,
  onChange,
}: {
  ariaLabel: string;
  value: T;
  options: GexMapDropdownOption<T>[];
  menuLabel: string;
  menuWidth: number;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8)),
      top: rect.bottom + 7,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => setOpen(false);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
        className={`gex-map-dropdown group flex h-8 min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border px-2 text-left transition-all duration-200 ${
          open
            ? "border-primary/40 bg-primary/[0.08] text-primary shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
            : "border-border bg-surface text-foreground hover:border-primary/25 hover:bg-card"
        }`}
      >
        <span className="font-mono text-[10px] font-semibold tracking-[0.04em]">{selected?.label ?? value}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : "group-hover:text-foreground"}`} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[260] overflow-hidden rounded-2xl border border-border bg-panel/95 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
            style={{ left: position.left, top: position.top, width: menuWidth }}
          >
            <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted">
              <span>{menuLabel}</span>
              <span>{options.length}</span>
            </div>
            <div className="max-h-[300px] space-y-0.5 overflow-y-auto">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                      triggerRef.current?.focus();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className={`flex h-7 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[10px] font-semibold ${
                      active
                        ? "bg-primary text-background shadow-[0_0_14px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]"
                        : "border border-border bg-card text-foreground"
                    }`}>
                      {option.label}
                    </span>
                    {option.detail ? (
                      <span className="min-w-0 flex-1 truncate text-[9px] text-muted">{option.detail}</span>
                    ) : null}
                    {active ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" /> : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}

function ExposurePanel({
  config,
  payload,
  loading,
  error,
  selectedTimestamp,
  stepMinutes,
  onChange,
}: {
  config: PanelConfig;
  payload: GexMapPanelPayload | null;
  loading: boolean;
  error: string | null;
  selectedTimestamp: number | null;
  stepMinutes: number;
  onChange: (patch: Partial<Pick<PanelConfig, "symbol" | "greekMode">>) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [strikeViewportHeight, setStrikeViewportHeight] = useState(0);
  const { current, previous } = useMemo(
    () => payload ? buildSnapshots(payload, selectedTimestamp, stepMinutes) : { current: new Map(), previous: new Map() },
    [payload, selectedTimestamp, stepMinutes],
  );
  const spot = payload ? priceAt(payload, selectedTimestamp) : null;
  const rows = useMemo(
    () => [...current.values()].sort((a, b) => b.strike - a.strike),
    [current],
  );
  const spotStrike = spot === null || !rows.length
    ? null
    : rows.reduce((best, row) => Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best).strike;
  const magnitudeCap = useMemo(() => {
    const magnitudes = rows.map((row) => Math.abs(row.net)).sort((a, b) => a - b);
    return Math.max(1, magnitudes[Math.floor((magnitudes.length - 1) * 0.95)] ?? 1);
  }, [rows]);
  const net = rows.reduce((sum, row) => sum + row.net, 0);
  const greek = GEX_MAP_GREEKS.find((item) => item.mode === config.greekMode) ?? GEX_MAP_GREEKS[0];
  const viewIdentity = `${config.symbol}:${config.greekMode}:${payload?.sessionDate ?? "pending"}`;
  const centeringIdentity = `${viewIdentity}:${selectedTimestamp ?? "live"}:${spot ?? "pending"}`;
  const strikeEdgeSpace = Math.max(0, strikeViewportHeight / 2 - 24);

  const centerLiveStrike = useCallback(() => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>("[data-near-spot='true']");
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetCentre = targetRect.top + targetRect.height / 2;
    const viewportCentre = containerRect.top + containerRect.height / 2;
    const maximumScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextScroll = Math.max(0, Math.min(maximumScroll, container.scrollTop + targetCentre - viewportCentre));

    if (Math.abs(nextScroll - container.scrollTop) > 0.5) container.scrollTop = nextScroll;
  }, []);

  useLayoutEffect(() => {
    if (spotStrike === null) return;
    const frame = window.requestAnimationFrame(centerLiveStrike);
    return () => window.cancelAnimationFrame(frame);
  }, [centerLiveStrike, centeringIdentity, spotStrike, strikeViewportHeight]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const measureAndCenter = () => {
      const nextHeight = container.clientHeight;
      setStrikeViewportHeight((current) => Math.abs(current - nextHeight) > 0.5 ? nextHeight : current);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(centerLiveStrike);
    };
    const observer = new ResizeObserver(measureAndCenter);
    observer.observe(container);
    measureAndCenter();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [centerLiveStrike]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const routeExposureWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;

      const maximumScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      if (maximumScroll <= 0) return;

      const rawDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (!rawDelta) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 18
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? container.clientHeight * 0.82
          : 1;
      const nextScroll = Math.max(0, Math.min(maximumScroll, container.scrollTop + rawDelta * unit));

      // At an edge, leave the event available to the outer workspace. While
      // rows can move, this strike viewport exclusively owns the wheel so a
      // chart node or label cannot accidentally swallow it.
      if (Math.abs(nextScroll - container.scrollTop) < 0.5) return;
      event.preventDefault();
      event.stopPropagation();
      container.scrollTop = nextScroll;
    };

    container.addEventListener("wheel", routeExposureWheel, { capture: true, passive: false });
    return () => container.removeEventListener("wheel", routeExposureWheel, { capture: true });
  }, []);

  return (
    <section className="gex-map-exposure-panel flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-panel">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-panel/95 px-3 py-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <GexMapDropdown
            ariaLabel={`${config.id} panel instrument`}
            value={config.symbol}
            options={OPTIONS_FLOW_INSTRUMENTS.map((instrument) => ({
              value: instrument.symbol,
              label: instrument.symbol,
              detail: instrument.label,
            }))}
            menuLabel="Underlying"
            menuWidth={224}
            onChange={(symbol) => onChange({ symbol })}
          />
          <GexMapDropdown
            ariaLabel={`${config.id} panel exposure metric`}
            value={config.greekMode}
            options={GEX_MAP_GREEKS.map((item) => ({
              value: item.mode,
              label: item.short,
              detail: item.label,
            }))}
            menuLabel="Exposure"
            menuWidth={210}
            onChange={(greekMode) => onChange({ greekMode })}
          />
          <div className="gex-map-panel-spot ml-auto shrink-0 text-right">
            <div className="font-mono text-[11px] font-semibold text-foreground">{formatPrice(spot)}</div>
            <div className={`font-mono text-[9px] ${payload && (payload.sessionChangePercent ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>
              {payload?.sessionChangePercent === null || payload?.sessionChangePercent === undefined
                ? "—"
                : `${payload.sessionChangePercent >= 0 ? "+" : ""}${(payload.sessionChangePercent * 100).toFixed(2)}%`}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[9px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${payload?.status === "LIVE" ? "animate-pulse bg-primary" : "bg-muted"}`} />
          <span>{greek.label}</span>
          <span className="text-border">•</span>
          <span>{payload ? `Exp ${payload.expiration}` : "Loading expiry"}</span>
          <span className={`ml-auto font-mono ${net >= 0 ? "text-primary" : "text-danger"}`}>Net {formatCompact(net)}</span>
        </div>
      </div>

      <div className="gex-map-strike-row grid h-7 grid-cols-[64px_minmax(0,1fr)_86px] items-center border-b border-border bg-surface/60 px-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span>Strike</span>
        <span>Signed exposure</span>
        <span className="gex-map-change-column text-right">{stepMinutes}m change</span>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto bg-chart-background"
      >
        {loading && !payload ? (
          <KwantLoader
            className="h-full"
            compact
            icon={ScanLine}
            title={`Loading ${greek.short}`}
            detail="Restoring the latest exposure frames"
          />
        ) : error && !payload ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <CircleStop className="mb-3 h-5 w-5 text-danger" />
            <div className="text-[11px] font-semibold text-foreground">Panel unavailable</div>
            <div className="mt-1 text-[10px] leading-4 text-muted">{error}</div>
          </div>
        ) : !rows.length ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[11px] text-muted">
            No recorded strike frames for this session.
          </div>
        ) : (
          <div className="py-1">
            <div aria-hidden="true" style={{ height: strikeEdgeSpace }} />
            {rows.map((row) => {
              const prior = previous.get(row.strike);
              const change = prior ? row.net - prior.net : null;
              const changeRatio = prior && Math.abs(prior.net) > 0
                ? (row.net - prior.net) / Math.abs(prior.net)
                : null;
              const nearSpot = row.strike === spotStrike;
              const strength = Math.min(1, Math.abs(row.net) / magnitudeCap);
              return (
                <div
                  key={row.strike}
                  data-near-spot={nearSpot ? "true" : undefined}
                  className={`gex-map-strike-row relative grid grid-cols-[64px_minmax(0,1fr)_86px] items-center border-b border-black/10 px-2 font-mono text-[9px] transition-[height,margin,background-color] ${nearSpot ? "gex-current-price-marker z-[2] mx-1 my-1 h-[35px]" : "h-[25px]"}`}
                  style={{ backgroundColor: heatColor(row.net, strength) }}
                  title={`${greek.short} ${formatCompact(row.net)} · Call ${formatCompact(row.call)} · Put ${formatCompact(row.put)}`}
                >
                  <span className={`relative flex items-center font-semibold ${nearSpot ? "text-foreground" : "text-foreground/90"}`}>
                    {nearSpot ? <span className="gex-current-price-dash absolute -left-2 h-6 w-1.5" /> : null}
                    <span className={nearSpot ? "gex-current-price-pill" : undefined}>
                      {row.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="truncate text-right font-semibold text-foreground drop-shadow-sm">{formatCompact(row.net)}</span>
                  <span className="gex-map-change-column flex items-center justify-end gap-1">
                    {changeRatio !== null ? (
                      <span className={`rounded px-1 py-0.5 text-[8px] font-semibold ${changeRatio >= 0 ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                        {changeRatio >= 0 ? "+" : ""}{Math.round(changeRatio * 100)}%
                      </span>
                    ) : null}
                    <span className={change === null ? "text-muted" : change >= 0 ? "text-primary" : "text-danger"}>
                      {change === null ? "—" : formatCompact(change)}
                    </span>
                  </span>
                </div>
              );
            })}
            <div aria-hidden="true" style={{ height: strikeEdgeSpace }} />
          </div>
        )}
        {loading && payload ? (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-panel/90 px-2 py-1 text-[8px] text-muted">
            <Loader2 className="h-3 w-3 animate-spin text-primary" /> Syncing
          </div>
        ) : null}
      </div>

      <div className="border-t border-border bg-panel px-3 py-2">
        <div className="h-1.5 rounded-full" style={{ background: "linear-gradient(90deg, var(--danger), var(--surface), var(--primary))" }} />
        <div className="mt-1 flex justify-between font-mono text-[8px] text-muted">
          <span>Negative</span><span>Neutral</span><span>Positive</span>
        </div>
      </div>
    </section>
  );
}

export default function GexMapWorkspace({ market = null }: GexMapWorkspaceProps = {}) {
  const linkedMarket = useMemo(() => market ?? linkedMarketFromLocation(), [market]);
  const initialPanels = useMemo(() => initialPanelsForMarket(linkedMarket), [linkedMarket]);
  const [panels, setPanels] = useState<PanelConfig[]>(initialPanels);
  const [panelData, setPanelData] = useState<Record<string, GexMapPanelPayload | null>>(() =>
    Object.fromEntries(initialPanels.map((panel) => [
      panel.id,
      readWorkspaceData<GexMapPanelPayload>(gexMapCacheKey(panel.symbol, panel.greekMode)),
    ])),
  );
  const [panelErrors, setPanelErrors] = useState<Record<string, string | null>>({
    left: null,
    centre: null,
    right: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialPanels.map((panel) => [
      panel.id,
      !readWorkspaceData<GexMapPanelPayload>(gexMapCacheKey(panel.symbol, panel.greekMode)),
    ])),
  );
  const [replayMode, setReplayMode] = useState(false);
  const [replayDate, setReplayDate] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [stepMinutes, setStepMinutes] = useState<(typeof FRAME_STEPS)[number]>(1);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [latestSessionDate, setLatestSessionDate] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const forceRefreshRef = useRef(false);
  const requestedReplayDate = replayMode ? replayDate : "";

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let requestInFlight = false;

    const load = async () => {
      if (requestInFlight || cancelled) return;
      requestInFlight = true;
      const forceRefresh = forceRefreshRef.current;
      forceRefreshRef.current = false;
      let nextRefreshDelay = 60_000;
      const cachedPanels = Object.fromEntries(panels.map((panel) => {
        const cached = readWorkspaceData<GexMapPanelPayload>(
          gexMapCacheKey(panel.symbol, panel.greekMode, requestedReplayDate),
        );
        return [panel.id, cached];
      }));
      setPanelData((current) => {
        const next = { ...current };
        for (const panel of panels) {
          const cached = cachedPanels[panel.id];
          if (cached) next[panel.id] = cached;
        }
        return next;
      });
      setLoading(Object.fromEntries(panels.map((panel) => [panel.id, true])));
      try {
        const results = await Promise.allSettled(panels.map(async (panel) => {
          const query = new URLSearchParams({
            symbol: panel.symbol,
            greekMode: panel.greekMode,
            ...(requestedReplayDate ? { sessionDate: requestedReplayDate } : {}),
          });
          const payload = await fetchWorkspaceData<GexMapPanelPayload>(
            gexMapCacheKey(panel.symbol, panel.greekMode, requestedReplayDate),
            `/api/gex-map?${query}`,
            {
              force: forceRefresh,
              maxAgeMs: replayMode ? 6 * 60 * 60_000 : 5_000,
            },
          );
          return { id: panel.id, payload };
        }));
        if (cancelled) return;

        const nextErrors: Record<string, string | null> = {};
        setPanelData((current) => {
          const next = { ...current };
          results.forEach((result, index) => {
            const id = panels[index].id;
            if (result.status === "fulfilled") {
              next[id] = result.value.payload;
              nextErrors[id] = null;
              const refreshAfterMs = result.value.payload.refreshAfterMs;
              if (Number.isFinite(refreshAfterMs) && refreshAfterMs > 0) {
                nextRefreshDelay = Math.min(nextRefreshDelay, refreshAfterMs);
              }
            } else {
              nextErrors[id] = result.reason instanceof Error ? result.reason.message : "Panel data is unavailable.";
            }
          });
          return next;
        });
        setPanelErrors((current) => ({ ...current, ...nextErrors }));
        setLoading(Object.fromEntries(panels.map((panel) => [panel.id, false])));
        setLastSync(Date.now());

        const firstSuccess = results.find((result) => result.status === "fulfilled");
        if (!replayDate && firstSuccess?.status === "fulfilled") {
          setReplayDate(firstSuccess.value.payload.sessionDate);
        }
        if (!replayMode && firstSuccess?.status === "fulfilled") {
          setLatestSessionDate(firstSuccess.value.payload.sessionDate);
        }
      } finally {
        requestInFlight = false;
        if (!cancelled && !replayMode) {
          timer = window.setTimeout(() => void load(), Math.max(5_000, nextRefreshDelay));
        }
      }
    };

    const syncWhenVisible = () => {
      if (document.visibilityState !== "visible" || replayMode) return;
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      void load();
    };

    void load();
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
  }, [panels, refreshToken, replayDate, replayMode, requestedReplayDate]);

  const timeline = useMemo(() => {
    const timestamps = new Set<number>();
    for (const panel of panels) {
      const payload = panelData[panel.id];
      if (!payload || (replayMode && replayDate && payload.sessionDate !== replayDate)) continue;
      for (const frame of payload.frames) timestamps.add(frame.timestamp);
    }
    const ordered = [...timestamps].sort((a, b) => a - b);
    if (stepMinutes === 1 || !ordered.length) return ordered;
    const anchor = ordered[0];
    return ordered.filter((timestamp) => Math.round((timestamp - anchor) / 60_000) % stepMinutes === 0);
  }, [panelData, panels, replayDate, replayMode, stepMinutes]);

  useEffect(() => {
    if (!replayMode || !playing || timeline.length < 2) return;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current >= timeline.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, Math.max(80, 1_000 / speed));
    return () => window.clearInterval(timer);
  }, [playing, replayMode, speed, timeline.length]);

  const selectedTimestamp = replayMode ? timeline[Math.min(cursor, Math.max(0, timeline.length - 1))] ?? null : null;
  const live = !replayMode && panels.every((panel) => panelData[panel.id]?.status === "LIVE");
  const dataAsOf = panels.reduce<number | null>((oldest, panel) => {
    const timestamp = Date.parse(panelData[panel.id]?.asOf ?? "");
    if (!Number.isFinite(timestamp)) return oldest;
    return oldest === null ? timestamp : Math.min(oldest, timestamp);
  }, null);
  const currentSessionDate = latestSessionDate
    || panels.map((panel) => panelData[panel.id]?.sessionDate).find(Boolean)
    || "";

  function updatePanel(id: PanelConfig["id"], patch: Partial<Pick<PanelConfig, "symbol" | "greekMode">>) {
    setPanels((current) => current.map((panel) => panel.id === id ? { ...panel, ...patch } : panel));
  }

  function enterReplay() {
    setReplayDate(currentSessionDate || replayDate);
    setReplayMode(true);
    setPlaying(false);
    setCursor(0);
  }

  function exitReplay() {
    setReplayMode(false);
    setPlaying(false);
    setCursor(0);
  }

  return (
    <div className="gex-map-workspace flex h-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="gex-map-header sticky top-0 z-40 flex min-h-[48px] shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ScanLine className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-semibold tracking-tight">GEXMAP</h1>
              <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">{linkedMarket ? `${linkedMarket} context` : "3 panels"}</span>
            </div>
            <p className="text-[9px] text-muted">Signed front-expiry exposure by strike</p>
          </div>

          <div className="gex-map-frame-steps ml-2 flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            {FRAME_STEPS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStepMinutes(value);
                  setCursor(0);
                  setPlaying(false);
                }}
                className={`h-6 rounded-md px-2 text-[9px] font-semibold ${stepMinutes === value ? "bg-panel text-primary shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {value}m
              </button>
            ))}
          </div>

          <div className="gex-map-header-actions ml-auto flex items-center gap-1.5">
            <div className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[9px] font-semibold ${replayMode ? "border-accent/25 bg-accent/10 text-accent" : live ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${replayMode ? "bg-accent" : live ? "animate-pulse bg-primary" : "bg-muted"}`} />
              {replayMode ? "REPLAY" : live ? "LIVE" : "LAST SESSION"}
            </div>
            <div className="hidden text-right text-[8px] text-muted xl:block">
              <div>Provider data</div>
              <div className="font-mono text-foreground">{dataAsOf ? easternTime.format(dataAsOf) : lastSync ? easternTime.format(lastSync) : "—"} ET</div>
            </div>
            <button
              type="button"
              onClick={() => {
                forceRefreshRef.current = true;
                setRefreshToken((value) => value + 1);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:text-foreground"
              title="Sync now"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={replayMode ? exitReplay : enterReplay}
              className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-[9px] font-semibold transition ${replayMode ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-foreground hover:border-primary/30"}`}
            >
              {replayMode ? <Radio className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {replayMode ? "Exit Replay" : "Replay"}
            </button>
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-1.5 pt-0">
          <div className="gex-map-panel-grid grid min-h-full min-w-0 gap-2">
            {panels.map((panel) => {
              const payload = panelData[panel.id];
              const validPayload = payload
                && payload.symbol === panel.symbol
                && payload.greekMode === panel.greekMode
                && (!replayMode || !replayDate || payload.sessionDate === replayDate)
                ? payload
                : null;
              return (
                <ExposurePanel
                  key={panel.id}
                  config={panel}
                  payload={validPayload}
                  loading={loading[panel.id]}
                  error={panelErrors[panel.id]}
                  selectedTimestamp={selectedTimestamp}
                  stepMinutes={stepMinutes}
                  onChange={(patch) => updatePanel(panel.id, patch)}
                />
              );
            })}
          </div>
        </div>

        {replayMode ? (
          <footer className="shrink-0 overflow-x-auto border-t border-border bg-panel px-3 py-2">
            <div className="flex min-w-max items-center gap-2">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[9px] text-muted">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                <input
                  aria-label="Replay date"
                  type="date"
                  value={replayDate}
                  max={currentSessionDate || undefined}
                  onChange={(event) => {
                    setReplayDate(event.target.value);
                    setCursor(0);
                    setPlaying(false);
                  }}
                  className="bg-transparent font-mono text-[10px] text-foreground outline-none"
                />
              </label>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                <button type="button" onClick={() => setCursor(0)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-foreground" title="Session open"><SkipBack className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setCursor((value) => Math.max(0, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-foreground" title="Previous frame"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setPlaying((value) => !value)} disabled={timeline.length < 2} className="flex h-7 w-8 items-center justify-center rounded-md bg-primary text-background disabled:opacity-40" title={playing ? "Pause" : "Play"}>
                  {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                </button>
                <button type="button" onClick={() => setCursor((value) => Math.min(timeline.length - 1, value + 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-foreground" title="Next frame"><ChevronRight className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setCursor(Math.max(0, timeline.length - 1))} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-foreground" title="Latest frame"><SkipForward className="h-3.5 w-3.5" /></button>
              </div>

              <div className="min-w-[110px]">
                <div className="font-mono text-[11px] font-semibold text-foreground">
                  {selectedTimestamp ? `${easternTime.format(selectedTimestamp)} ET` : "No replay frames"}
                </div>
                <div className="text-[8px] text-muted">{replayDate ? formatSessionDate(replayDate) : "Select a session"}</div>
              </div>

              <input
                aria-label="Replay timeline"
                type="range"
                min={0}
                max={Math.max(0, timeline.length - 1)}
                value={Math.min(cursor, Math.max(0, timeline.length - 1))}
                onChange={(event) => {
                  setCursor(Number(event.target.value));
                  setPlaying(false);
                }}
                className="min-w-[180px] flex-1 accent-[var(--primary)]"
              />

              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpeed(value)}
                    className={`h-7 rounded-md px-2 text-[9px] font-semibold ${speed === value ? "bg-panel text-primary" : "text-muted hover:text-foreground"}`}
                  >
                    {value}×
                  </button>
                ))}
              </div>

              <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[8px] text-muted 2xl:flex">
                <Gauge className="h-3.5 w-3.5 text-accent" />
                <span>{timeline.length} provider frames</span>
              </div>
            </div>
          </footer>
        ) : (
          <footer className="gex-map-live-footer flex h-7 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-t border-border bg-panel px-3 text-[8px] text-muted">
            <Radio className={`h-3 w-3 ${live ? "text-primary" : "text-muted"}`} />
            <span>KwantData Interval Map · front expiry · per 1% underlying move</span>
            <span className="ml-auto">Positive and negative colours follow the active Kwantify theme. Intensity is normalized to each panel’s 95th-percentile absolute exposure.</span>
          </footer>
        )}
      </main>
    </div>
  );
}
