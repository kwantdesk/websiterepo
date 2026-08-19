"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Gauge,
  ListOrdered,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  ScanLine,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import {
  GEX_MAP_GREEKS,
  hasRenderableGexMapSurface,
  latestGexMapStrikesFromFrames,
  selectGexMapStarNode,
  type GexMapPanelPayload,
} from "@/lib/gexMap";
import {
  DEFAULT_GEX_MAP_PALETTE,
  GEX_MAP_DRAG_BAR_TRACK,
  GEX_MAP_PALETTE_CHANGE_EVENT,
  GEX_MAP_PALETTE_PRESETS,
  GEX_MAP_STOP_COUNT,
  buildGexMapSignedScale,
  gexMapDragBarColor,
  gexMapPaletteTones,
  gexMapSignedScale,
  gexMapPalettesEqual,
  loadGexMapPalette,
  normalizeGexMapPalette,
  saveGexMapPalette,
  type GexMapHeatTones,
  type GexMapPalette,
} from "@/lib/gexMapPalette";
import {
  RECOMMENDED_GEX_MAP_STAR_SETTINGS,
  deriveGexMapStarModel,
  formatMagnitudeVelocity,
  formatMapControl,
  type GexMapStarSettings,
  type GexMapViewMode,
} from "@/lib/gexMapStar";
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
  id: string;
  symbol: string;
  greekMode: GreekMode;
};

type GexMapMarket = "NQ" | "ES";

/** Serializable snapshot of an embedded map's user configuration, owned by
 * the host workspace pane so it saves and restores with the workspace. */
export type GexMapEmbedState = {
  panels: PanelConfig[];
  viewMode: GexMapViewMode;
  stepMinutes: number;
};

type GexMapWorkspaceProps = {
  market?: GexMapMarket | null;
  externalReplay?: {
    active: boolean;
    sessionDate: string;
    timestampMs: number;
  } | null;
  /** Saved configuration from the host workspace pane; wins over market defaults. */
  persistedState?: GexMapEmbedState | null;
  /** Reports configuration changes so the host can persist them with the workspace. */
  onStateChange?: (state: GexMapEmbedState) => void;
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
const GEX_MAP_ZOOM_STORAGE_KEY = "kwantdesk:gex-map-zoom:v1";
const GEX_MAP_ZOOM_MIN = 0.5;
const GEX_MAP_ZOOM_MAX = 1.5;
const GEX_MAP_ZOOM_STEP = 0.1;
const MAX_GEX_MAP_PANELS = 4;
const GEX_MAP_STAR_PREFERENCES_KEY = "kwantdesk:gex-map:star-preferences:v1";

function readGexMapStarPreferences() {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(GEX_MAP_STAR_PREFERENCES_KEY) ?? "null") as {
      viewMode?: GexMapViewMode;
      settings?: Partial<GexMapStarSettings>;
    } | null;
    if (!stored) return null;
    return {
      viewMode: stored.viewMode === "star" ? "star" as const : "raw" as const,
      settings: { ...RECOMMENDED_GEX_MAP_STAR_SETTINGS, ...stored.settings },
    };
  } catch {
    return null;
  }
}

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

function normalizeGexMapEmbedState(value: unknown): GexMapEmbedState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<GexMapEmbedState>;
  const validModes = new Set(GEX_MAP_GREEKS.map((greek) => greek.mode));
  const panels = Array.isArray(parsed.panels)
    ? parsed.panels
      .filter((panel): panel is PanelConfig => Boolean(
        panel
        && typeof panel === "object"
        && typeof (panel as PanelConfig).id === "string"
        && typeof (panel as PanelConfig).symbol === "string"
        && (panel as PanelConfig).symbol.length > 0
        && validModes.has((panel as PanelConfig).greekMode),
      ))
      .slice(0, MAX_GEX_MAP_PANELS)
      .map((panel) => ({ id: panel.id, symbol: panel.symbol.toUpperCase(), greekMode: panel.greekMode }))
    : [];
  if (!panels.length) return null;
  return {
    panels,
    viewMode: parsed.viewMode === "star" ? "star" : "raw",
    stepMinutes: (FRAME_STEPS as readonly number[]).includes(Number(parsed.stepMinutes))
      ? Number(parsed.stepMinutes) as (typeof FRAME_STEPS)[number]
      : 1,
  };
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
    // Older browser snapshots may have been saved during the provider's
    // post-close window with an empty latestStrikes array. Recover directly
    // from their retained interval frames so the map repairs itself before
    // the network refresh completes.
    const latestStrikes = payload.latestStrikes.length
      ? payload.latestStrikes
      : latestGexMapStrikesFromFrames(payload.frames);
    const current = new Map(latestStrikes.map((row) => [row.strike, row]));
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

const THEME_HEAT_TONES: GexMapHeatTones = {
  positive: "var(--primary)",
  positiveSoft: "color-mix(in srgb, var(--primary) 34%, black)",
  negative: "var(--danger)",
  negativeSoft: "color-mix(in srgb, var(--danger) 34%, black)",
};

const THEME_SIGNED_SCALE = gexMapSignedScale({ ...DEFAULT_GEX_MAP_PALETTE, useThemeColors: true });

function heatColor(
  value: number,
  strength: number,
  scale: string[] = THEME_SIGNED_SCALE,
) {
  // The ten user-set colours are anchors on one continuous scale with zero
  // pinned to its middle. `strength` is the row's per-side linear position;
  // the colour interpolates smoothly between the two neighbouring anchors and
  // paints SOLID — the reference-map look where the noise floor (zero rows
  // included: zero is average, never the dark extreme) shares the quiet
  // middle colours and only the extremes climb to the end colours.
  const bounded = Math.min(1, Math.max(0, strength));
  const position = bounded * (scale.length - 1);
  const lower = Math.min(scale.length - 1, Math.floor(position));
  const upper = Math.min(scale.length - 1, lower + 1);
  const fraction = Math.round((position - lower) * 100);
  if (lower === upper || fraction === 0) return scale[lower];
  return `color-mix(in srgb, ${scale[upper]} ${fraction}%, ${scale[lower]})`;
}

type RgbColor = { r: number; g: number; b: number };
type StarPalette = { accent: string; text: string; outline: string };

const DEFAULT_STAR_PALETTE: StarPalette = {
  accent: "#ffffff",
  text: "#000000",
  outline: "#000000",
};

function parseResolvedColor(value: string): RgbColor | null {
  const normalized = value.trim();
  const hex = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join("") : hex;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  const rgb = normalized.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };

  const srgb = normalized.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (srgb) {
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
    };
  }
  return null;
}

function colorLuminance(color: RgbColor) {
  const channel = (value: number) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(color.r) * 0.2126 + channel(color.g) * 0.7152 + channel(color.b) * 0.0722;
}

function contrastRatio(left: RgbColor, right: RgbColor) {
  const leftLuminance = colorLuminance(left);
  const rightLuminance = colorLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05)
    / (Math.min(leftLuminance, rightLuminance) + 0.05);
}

function rgbHex(color: RgbColor) {
  const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** Pick the accent with the strongest worst-case contrast against this theme. */
function resolveStarPalette(host: HTMLElement): StarPalette {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;pointer-events:none;visibility:hidden;color:transparent";
  host.appendChild(probe);
  const resolve = (value: string) => {
    probe.style.color = value;
    return parseResolvedColor(window.getComputedStyle(probe).color);
  };

  const references = [
    resolve("var(--chart-background)"),
    resolve("var(--primary)"),
    resolve("var(--danger)"),
    resolve("color-mix(in srgb, var(--primary) 84%, white 16%)"),
  ].filter((color): color is RgbColor => color !== null);

  const candidateValues = [
    "var(--accent)",
    "var(--secondary)",
    "var(--foreground)",
    "var(--candle-up)",
    "var(--candle-down)",
    "#ffffff",
    "#000000",
    "#fff200",
    "#00e5ff",
    "#ff00ff",
    "#ff8a00",
    "#7dff00",
  ];
  const candidates = candidateValues
    .map((value) => resolve(value))
    .filter((color): color is RgbColor => color !== null)
    .filter((color, index, all) => all.findIndex((item) => rgbHex(item) === rgbHex(color)) === index);
  probe.remove();

  if (!references.length || !candidates.length) return DEFAULT_STAR_PALETTE;
  const accent = candidates.reduce((best, candidate) => {
    const score = Math.min(...references.map((reference) => contrastRatio(candidate, reference)));
    const bestScore = Math.min(...references.map((reference) => contrastRatio(best, reference)));
    return score > bestScore ? candidate : best;
  });
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const text = contrastRatio(accent, black) >= contrastRatio(accent, white) ? black : white;
  const outline = contrastRatio(accent, black) >= contrastRatio(accent, white) ? black : white;
  return { accent: rgbHex(accent), text: rgbHex(text), outline: rgbHex(outline) };
}

/** A saved custom Star colour keeps readable text via the same contrast math. */
function starPaletteFromAccent(accentHex: string): StarPalette {
  const accent = parseResolvedColor(accentHex);
  if (!accent) return DEFAULT_STAR_PALETTE;
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const text = contrastRatio(accent, black) >= contrastRatio(accent, white) ? black : white;
  return { accent: rgbHex(accent), text: rgbHex(text), outline: rgbHex(text) };
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
  viewMode,
  starSettings,
  palette,
  ladderZoom = 1,
  unavailableReason = null,
  onChange,
  onRemove,
}: {
  config: PanelConfig;
  payload: GexMapPanelPayload | null;
  loading: boolean;
  error: string | null;
  selectedTimestamp: number | null;
  stepMinutes: number;
  viewMode: GexMapViewMode;
  starSettings: GexMapStarSettings;
  palette: GexMapPalette;
  ladderZoom?: number;
  unavailableReason?: string | null;
  onChange: (patch: Partial<Pick<PanelConfig, "symbol" | "greekMode">>) => void;
  onRemove?: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ladderRef = useRef<HTMLDivElement>(null);
  const [followingSpot, setFollowingSpot] = useState(true);
  const [surfacePainted, setSurfacePainted] = useState(false);
  const [starPalette, setStarPalette] = useState<StarPalette>(DEFAULT_STAR_PALETTE);
  const { current, previous } = useMemo(
    () => payload ? buildSnapshots(payload, selectedTimestamp, stepMinutes) : { current: new Map(), previous: new Map() },
    [payload, selectedTimestamp, stepMinutes],
  );
  const spot = payload ? priceAt(payload, selectedTimestamp) : null;
  const tones = gexMapPaletteTones(palette);
  const signedScale = useMemo(() => gexMapSignedScale(palette), [palette]);
  const rows = useMemo(
    () => [...current.values()].sort((a, b) => b.strike - a.strike),
    [current],
  );
  // `rows` is the complete reconstructed/filtered strike surface, not the
  // visible scroll window. Keep Star selection independent from presentation.
  const starNode = useMemo(() => selectGexMapStarNode(rows), [rows]);
  const starModel = useMemo(() => deriveGexMapStarModel({ rows, previous, spot, settings: starSettings }), [previous, rows, spot, starSettings]);
  const starRows = useMemo(() => new Map(starModel.rows.map((row) => [row.strike, row])), [starModel.rows]);
  const focusedStar = starModel.starStrike === null ? null : starRows.get(starModel.starStrike) ?? null;
  const maxHighlightedControl = Math.max(0.001, ...starModel.rows.filter((row) => row.isHighlighted).map((row) => row.mapControlPct));
  const airPocketStarts = useMemo(() => new Set(starModel.airPockets.map((pocket) => pocket.fromStrike)), [starModel.airPockets]);
  const spotStrike = spot === null || !rows.length
    ? null
    : rows.reduce((best, row) => Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best).strike;
  // Every node's colour is its signed exposure as a PERCENTAGE OF THE STAR
  // NODE — the panel's largest absolute exposure, the same yardstick on both
  // sides. Zero is neutral and pinned to the scale's middle; the Star alone
  // reaches its end of the scale (lightest when positive, darkest when
  // negative); a node at 30% of the Star sits 30% of the way toward its end
  // regardless of sign. Noise stays in the quiet middle, structure jumps
  // bands, and the Star is unmistakable.
  const starMagnitude = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      const magnitude = Math.abs(row.net);
      if (magnitude > max) max = magnitude;
    }
    return Math.max(1, max);
  }, [rows]);
  const heatStrength = useCallback(
    (net: number) => 0.5 + 0.5 * Math.max(-1, Math.min(1, net / starMagnitude)),
    [starMagnitude],
  );
  // The growth ticker stays readable by marking only the movers that matter:
  // the eight fastest-growing and eight fastest-shrinking nodes by percentage
  // change of exposure magnitude since the previous frame.
  const growthTickStrikes = useMemo(() => {
    const entries: Array<{ strike: number; pct: number }> = [];
    for (const row of rows) {
      const prior = previous.get(row.strike);
      if (!prior || Math.abs(prior.net) <= 0) continue;
      const pct = ((Math.abs(row.net) - Math.abs(prior.net)) / Math.abs(prior.net)) * 100;
      if (!Number.isFinite(pct) || pct === 0) continue;
      entries.push({ strike: row.strike, pct });
    }
    const growing = entries.filter((entry) => entry.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8);
    const shrinking = entries.filter((entry) => entry.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 8);
    return new Set([...growing, ...shrinking].map((entry) => entry.strike));
  }, [previous, rows]);
  const net = rows.reduce((sum, row) => sum + row.net, 0);
  const greek = GEX_MAP_GREEKS.find((item) => item.mode === config.greekMode) ?? GEX_MAP_GREEKS[0];
  const viewIdentity = `${config.symbol}:${config.greekMode}:${payload?.expiration ?? "pending"}:${payload?.sessionDate ?? "pending"}`;
  const centeringIdentity = `${viewIdentity}:${selectedTimestamp ?? "live"}:${spotStrike ?? "pending"}`;

  const centerLiveStrike = useCallback(() => {
    const container = scrollRef.current;
    const ladder = ladderRef.current;
    const target = ladder?.querySelector<HTMLElement>("[data-near-spot='true']");
    if (!container || !ladder || container.clientHeight <= 0) return false;

    // Only reset when the next surface has no marked price row. Resetting to
    // zero before every live re-centre caused a visible black/empty flash.
    if (!target) {
      container.scrollTop = 0;
      return false;
    }

    // offsetTop is measured in the scroll content itself. Do not add dynamic
    // top/bottom gutters here: this viewport lives in an auto-sized grid row,
    // so padding based on clientHeight feeds back through ResizeObserver and
    // can grow the row indefinitely, parking every strike below the screen.
    const maximumScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetCenterInContent = targetRect.top - containerRect.top
      + container.scrollTop
      + targetRect.height / 2;
    const nextScroll = Math.max(0, Math.min(
      maximumScroll,
      targetCenterInContent - container.clientHeight / 2,
    ));

    container.scrollTop = nextScroll;

    const paintedTargetRect = target.getBoundingClientRect();
    const paintedContainerRect = container.getBoundingClientRect();
    return paintedTargetRect.bottom > paintedContainerRect.top
      && paintedTargetRect.top < paintedContainerRect.bottom;
  }, []);

  const centerStarStrike = useCallback(() => {
    const container = scrollRef.current;
    const ladder = ladderRef.current;
    const target = ladder?.querySelector<HTMLElement>("[data-star-node='true']");
    if (!container || !target || container.clientHeight <= 0) return;

    const maximumScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetCenterInContent = targetRect.top - containerRect.top
      + container.scrollTop
      + targetRect.height / 2;
    const nextScroll = Math.max(0, Math.min(
      maximumScroll,
      targetCenterInContent - container.clientHeight / 2,
    ));
    container.scrollTo({ top: nextScroll, behavior: "smooth" });
  }, []);

  useLayoutEffect(() => {
    const host = panelRef.current;
    if (!host) return;
    // A saved custom Star colour replaces the automatic contrast search
    // entirely; theme changes stop repainting it until the palette relinks.
    if (!palette.useThemeColors) {
      setStarPalette(starPaletteFromAccent(palette.star));
      return;
    }

    let frame = 0;
    const updatePalette = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setStarPalette(resolveStarPalette(host)));
    };
    updatePalette();
    const observer = new MutationObserver(updatePalette);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme", "data-theme-updating"],
    });
    window.addEventListener("kwantdesk:theme-change", updatePalette);
    return () => {
      observer.disconnect();
      window.removeEventListener("kwantdesk:theme-change", updatePalette);
      window.cancelAnimationFrame(frame);
    };
  }, [palette.star, palette.useThemeColors, viewIdentity]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !rows.length) return;

    // Centre synchronously for the first paint, then repeat once after the
    // browser commits any surrounding workspace resize.
    if (followingSpot && spotStrike !== null) centerLiveStrike();
    let settleFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      settleFrame = window.requestAnimationFrame(() => {
        const visible = followingSpot && spotStrike !== null
          ? centerLiveStrike()
          : Boolean(container.querySelector("[data-gex-strike-node='true']"));
        setSurfacePainted(visible);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
    };
  }, [centerLiveStrike, centeringIdentity, followingSpot, rows.length, spotStrike, viewIdentity]);

  useEffect(() => {
    setFollowingSpot(true);
  }, [viewIdentity]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const resizeAndCenter = () => {
      window.cancelAnimationFrame(frame);
      if (followingSpot) frame = window.requestAnimationFrame(() => centerLiveStrike());
    };
    const observer = new ResizeObserver(resizeAndCenter);
    observer.observe(container);
    resizeAndCenter();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [centerLiveStrike, followingSpot]);

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
      setFollowingSpot(false);
      container.scrollTop = nextScroll;
    };

    container.addEventListener("wheel", routeExposureWheel, { capture: true, passive: false });
    return () => container.removeEventListener("wheel", routeExposureWheel, { capture: true });
  }, []);

  return (
    <section ref={panelRef} className="gex-map-exposure-panel flex min-h-[250px] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-panel">
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
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-border bg-surface text-muted transition hover:border-danger/35 hover:text-danger"
              title="Remove this GEX column"
              aria-label={`Remove ${config.symbol} ${greek.short} column`}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[9px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${payload?.status === "LIVE" ? "animate-pulse bg-primary" : "bg-muted"}`} />
          <span>{greek.label}</span>
          <span className="text-border">•</span>
          <span>{payload ? `Exp ${payload.expiration}` : "Loading expiry"}</span>
          {starNode ? (
            <button
              type="button"
              onClick={() => {
                setFollowingSpot(false);
                window.requestAnimationFrame(centerStarStrike);
              }}
              className="gex-star-header ml-auto flex min-w-0 items-center gap-1 border px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.06em] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-1"
              style={{
                "--gex-star-accent": starPalette.accent,
                "--gex-star-text": starPalette.text,
                "--gex-star-outline": starPalette.outline,
              } as CSSProperties}
              title={viewMode === "star" && focusedStar
                ? `Raw ${formatCompact(focusedStar.net)} · ${focusedStar.polarity} exposure · click to centre the Star node`
                : "Scroll to the Star Node"}
            >
              <Star className="h-2.5 w-2.5 shrink-0" fill="currentColor" />
              <span className="truncate">
                {viewMode === "star" && focusedStar
                  ? `STAR ${focusedStar.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })} · ${formatMapControl(focusedStar.mapControlPct)} · ${formatMagnitudeVelocity(focusedStar, stepMinutes)}`
                  : `STAR ${starNode.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })} · ${formatCompact(starNode.net)}`}
              </span>
            </button>
          ) : null}
          <span className={`font-mono ${starNode ? "" : "ml-auto"} ${net >= 0 ? "text-primary" : "text-danger"}`}>Net {formatCompact(net)}</span>
        </div>
      </div>

      <div className="gex-map-strike-row grid h-7 grid-cols-[96px_minmax(0,1fr)_86px] items-center border-b border-border bg-surface/60 px-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">
        <span>Strike</span>
        <span>{viewMode === "star" ? "Structural node" : "Signed exposure"}</span>
        <span className="gex-map-change-column text-right">{viewMode === "star" ? "Control · velocity" : `${stepMinutes}m change`}</span>
      </div>

      <div className="relative flex min-h-0 flex-1 bg-chart-background">
        <div
          key={viewIdentity}
          ref={scrollRef}
          onPointerDown={() => setFollowingSpot(false)}
          onTouchStart={() => setFollowingSpot(false)}
          className="gex-map-strike-viewport relative min-h-px min-w-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto bg-chart-background"
          style={{ overflowAnchor: "none" }}
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
          <div className="flex h-full items-center justify-center px-6 text-center text-[11px] leading-4 text-muted">
            {(() => {
              // The empty state must say exactly why the ladder is empty —
              // a blanket "no frames" hides whether the replay clock simply
              // sits before the first recorded frame, the recorded session
              // does not match the requested one, or frames truly are absent.
              if (unavailableReason) return unavailableReason;
              const firstFrameMs = payload?.frames[0]?.timestamp ?? null;
              if (
                payload
                && selectedTimestamp !== null
                && firstFrameMs !== null
                && selectedTimestamp < firstFrameMs
              ) {
                return `Replay is before the first recorded frame — exposure starts at ${easternTime.format(firstFrameMs)} ET.`;
              }
              return "No recorded strike frames for this session.";
            })()}
          </div>
        ) : (
          <div
            ref={ladderRef}
            className="py-1"
            data-gex-strike-ladder="true"
            // CSS zoom reflows heights and typography together, so the +/-
            // clicker genuinely fits more strike nodes on screen when zoomed
            // out and fewer, larger nodes when zoomed in.
            style={ladderZoom !== 1 ? ({ zoom: ladderZoom } as CSSProperties) : undefined}
          >
            {rows.map((row) => {
              const prior = previous.get(row.strike);
              const change = prior ? row.net - prior.net : null;
              const changeRatio = prior && Math.abs(prior.net) > 0
                ? (row.net - prior.net) / Math.abs(prior.net)
                : null;
              // Live growth ticker beside the strike: percentage change of the
              // node's exposure magnitude since the previous frame. Green ▲ =
              // the node is growing, red ▼ = shrinking; re-ticks on every data
              // refresh. Fixed semantic colours by design, on any theme.
              const growthPct = prior && Math.abs(prior.net) > 0
                ? ((Math.abs(row.net) - Math.abs(prior.net)) / Math.abs(prior.net)) * 100
                : null;
              const growthTick = growthPct === null || !Number.isFinite(growthPct) || !growthTickStrikes.has(row.strike)
                ? null
                : (
                  <span
                    className="shrink-0 font-mono text-[7px] font-bold tracking-tight"
                    style={{ color: growthPct > 0 ? "#22C55E" : growthPct < 0 ? "#EF4444" : "#71717A" }}
                    title={`Exposure magnitude ${growthPct >= 0 ? "grew" : "shrank"} ${Math.abs(growthPct).toFixed(1)}% over the last ${stepMinutes}m step`}
                  >
                    {growthPct > 0 ? "▲" : growthPct < 0 ? "▼" : "•"}
                    {Math.min(999, Math.abs(growthPct)).toFixed(1)}%
                  </span>
                );
              const nearSpot = row.strike === spotStrike;
              const isStar = row.strike === starNode?.strike;
              const strength = heatStrength(row.net);
              const derived = starRows.get(row.strike);
              if (viewMode === "star" && derived) {
                const isFocusedStar = derived.roles.includes("star");
                const highlighted = derived.isHighlighted;
                const barWidth = Math.sqrt(derived.mapControlPct / maxHighlightedControl) * 100;
                // "Gatekeeper" is displayed as SPARKY; the internal role id
                // stays stable so derivations and saved state are untouched.
                const roleText = derived.roles.filter((role) => role !== "normal").map((role) => role === "gatekeeper" ? "SPARKY" : role.toUpperCase());
                const distanceLabel = Math.abs(derived.distanceFromSpotPct) < 0.0001
                  ? "AT SPOT"
                  : `${Math.abs(derived.distanceFromSpotPct).toFixed(2)}% ${derived.distanceFromSpotPct > 0 ? "ABOVE" : "BELOW"}`;
                const tooltip = [
                  `${config.symbol} · ${greek.label}`,
                  `Strike ${derived.strike} · Spot ${spot === null ? "—" : formatPrice(spot)} · ${distanceLabel}`,
                  `Raw signed exposure ${formatCompact(derived.net)} · absolute ${formatCompact(derived.absValue)}`,
                  `${formatMapControl(derived.mapControlPct)} · share of total absolute exposure in this active map`,
                  `${stepMinutes}m magnitude velocity ${formatMagnitudeVelocity(derived, stepMinutes)}`,
                  `Baseline ${derived.previousValue === null ? "—" : formatCompact(derived.previousValue)} · signed delta ${derived.signedDelta === null ? "—" : formatCompact(derived.signedDelta)}`,
                  `Absolute rank ${derived.absoluteRank} · local peak ratio ${derived.localPeakRatio.toFixed(2)}`,
                  `Roles ${roleText.join(", ") || "NORMAL"}`,
                  highlighted ? derived.highlightReason.join(" · ") : `Normal node · rank ${derived.absoluteRank} · below structural threshold`,
                  payload ? `Snapshot ${payload.asOf} · ${payload.status}` : "Snapshot unavailable",
                ].join("\n");
                return (
                  <div
                    key={row.strike}
                    data-near-spot={nearSpot ? "true" : undefined}
                    data-star-node={isFocusedStar ? "true" : undefined}
                    data-gex-strike-node="true"
                    data-star-highlighted={highlighted ? "true" : "false"}
                    className={`gex-map-strike-row relative grid grid-cols-[96px_minmax(0,1fr)_86px] items-center overflow-hidden border-b border-border/30 px-2 font-mono text-[9px] ${nearSpot ? "mx-1 my-1 h-[35px]" : highlighted ? "mx-1 my-0.5 h-[30px]" : "h-[25px]"} ${isFocusedStar ? `gex-star-node z-[3] ${nearSpot ? "gex-star-is-current" : ""}` : nearSpot ? "gex-current-price-marker z-[2]" : ""} ${starSettings.animateChanges ? "transition-[height,margin,background-color,opacity] duration-200" : ""}`}
                    style={{
                      opacity: highlighted || nearSpot ? 1 : Math.max(0.02, starSettings.dimOpacity),
                      textShadow: "0 1px 2px rgba(0,0,0,0.72)",
                      backgroundColor: highlighted
                        ? heatColor(derived.net, heatStrength(derived.net), signedScale)
                        : "var(--chart-background)",
                      ...(isFocusedStar ? {
                        "--gex-star-accent": starPalette.accent,
                        "--gex-star-text": starPalette.text,
                        "--gex-star-outline": starPalette.outline,
                      } : {}),
                    } as CSSProperties}
                    title={tooltip}
                  >
                    {highlighted ? (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-y-1 left-0 rounded-r-sm ${starSettings.animateChanges ? "transition-[width,opacity] duration-200" : ""}`}
                        style={{
                          width: `${Math.max(4, Math.min(100, barWidth))}%`,
                          opacity: isFocusedStar ? 0.34 : 0.2,
                          background: derived.net >= 0
                            ? `linear-gradient(90deg,${tones.positive},transparent)`
                            : `linear-gradient(90deg,${tones.negative},transparent)`,
                        }}
                      />
                    ) : null}
                    <span className={`relative z-[1] flex min-w-0 items-center gap-1 font-semibold ${nearSpot ? "text-foreground" : "text-foreground/90"}`}>
                      {nearSpot ? <span className="gex-current-price-dash absolute -left-2 h-6 w-1.5" /> : null}
                      <span className={`${nearSpot ? "gex-current-price-pill" : ""} shrink-0`}>
                        {row.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </span>
                      {growthTick}
                      {isFocusedStar ? (
                        <span className="gex-star-badge inline-flex min-w-0 items-center gap-0.5 border px-1 py-0.5 font-sans text-[7px] font-black tracking-[0.08em]">
                          <Star className="h-2.5 w-2.5 shrink-0" fill="currentColor" />
                          <span className="gex-star-badge-label">STAR</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="relative z-[1] flex min-w-0 items-center justify-end gap-1 overflow-hidden">
                      {starSettings.showRoleLabels ? roleText.filter((role) => role !== "STAR").slice(0, 2).map((role) => (
                        <span key={role} className="truncate border border-current/25 bg-panel/50 px-1 py-0.5 font-sans text-[7px] font-bold tracking-[0.06em] text-foreground">{role}</span>
                      )) : null}
                      {starSettings.showRawValues ? <span className="truncate text-[8px] text-muted">{formatCompact(derived.net)}</span> : null}
                      {starSettings.showAirPocketLabels && airPocketStarts.has(row.strike) ? <span className="text-[7px] text-muted">AIR POCKET</span> : null}
                    </span>
                    <span className="gex-map-change-column relative z-[1] flex min-w-0 flex-col items-end justify-center leading-tight">
                      <span className="font-semibold text-foreground">{formatMapControl(derived.mapControlPct)}</span>
                      <span className={derived.magnitudeVelocityPct === null ? "text-muted" : derived.magnitudeVelocityPct >= 0 ? "text-primary" : "text-danger"}>
                        {formatMagnitudeVelocity(derived, stepMinutes)}
                      </span>
                    </span>
                  </div>
                );
              }
              return (
                <div
                  key={row.strike}
                  data-near-spot={nearSpot ? "true" : undefined}
                  data-star-node={isStar ? "true" : undefined}
                  data-gex-strike-node="true"
                  className={`gex-map-strike-row relative grid grid-cols-[96px_minmax(0,1fr)_86px] items-center border-b border-black/10 px-2 font-mono text-[9px] transition-[height,margin,background-color] ${nearSpot ? "mx-1 my-1 h-[35px]" : isStar ? "mx-1 my-0.5 h-[29px]" : "h-[25px]"} ${isStar ? `gex-star-node z-[3] ${nearSpot ? "gex-star-is-current" : ""}` : nearSpot ? "gex-current-price-marker z-[2]" : ""}`}
                  style={{
                    textShadow: "0 1px 2px rgba(0,0,0,0.72)",
                    backgroundColor: heatColor(row.net, strength, signedScale),
                    ...(isStar ? {
                      "--gex-star-accent": starPalette.accent,
                      "--gex-star-text": starPalette.text,
                      "--gex-star-outline": starPalette.outline,
                    } : {}),
                  } as CSSProperties}
                  title={`${greek.short} ${formatCompact(row.net)} · Call ${formatCompact(row.call)} · Put ${formatCompact(row.put)}`}
                >
                  <span className={`relative flex min-w-0 items-center gap-1 font-semibold ${nearSpot ? "text-foreground" : "text-foreground/90"}`}>
                    {nearSpot ? <span className="gex-current-price-dash absolute -left-2 h-6 w-1.5" /> : null}
                    <span className={`${nearSpot ? "gex-current-price-pill" : ""} shrink-0`}>
                      {row.strike.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </span>
                    {growthTick}
                    {isStar ? (
                      <span className="gex-star-badge inline-flex min-w-0 items-center gap-0.5 border px-1 py-0.5 font-sans text-[7px] font-black tracking-[0.08em]">
                        <Star className="h-2.5 w-2.5 shrink-0" fill="currentColor" />
                        <span className="gex-star-badge-label">STAR</span>
                      </span>
                    ) : null}
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
          </div>
        )}
        </div>
        {rows.length > 0 && !surfacePainted ? (
          <div className="pointer-events-none absolute inset-0 z-10">
            <KwantLoader
              className="h-full w-full"
              compact
              icon={ScanLine}
              title={`Loading ${greek.short}`}
              detail="Painting the latest strike ladder"
            />
          </div>
        ) : null}
        {!followingSpot && spotStrike !== null ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFollowingSpot(true);
              window.requestAnimationFrame(() => centerLiveStrike());
            }}
            className="absolute bottom-2 right-2 z-10 flex h-7 items-center gap-1.5 rounded-[3px] border border-primary/30 bg-panel/95 px-2 text-[8px] font-semibold text-primary shadow-lg backdrop-blur hover:bg-primary/10"
            title="Centre the live strike and resume following price"
          >
            <ScanLine className="h-3 w-3" /> Centre price
          </button>
        ) : null}
      </div>

      <div className="border-t border-border bg-panel px-3 py-2">
        <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${signedScale.join(", ")})` }} />
        <div className="mt-1 flex justify-between font-mono text-[8px] text-muted">
          <span>{rows.length ? `-${formatCompact(starMagnitude)}` : "Negative"}</span>
          <span>0</span>
          <span>{rows.length ? formatCompact(starMagnitude) : "Positive"}</span>
        </div>
      </div>
    </section>
  );
}

function StarViewSettings({
  open,
  settings,
  palette,
  paletteDirty,
  onChange,
  onPaletteChange,
  onPaletteSave,
  onClose,
}: {
  open: boolean;
  settings: GexMapStarSettings;
  palette: GexMapPalette;
  paletteDirty: boolean;
  onChange: (next: GexMapStarSettings) => void;
  onPaletteChange: (next: GexMapPalette) => void;
  onPaletteSave: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);
  const [editSlot, setEditSlot] = useState<{ side: "scale" | "star"; index: number }>({
    side: "scale",
    index: GEX_MAP_STOP_COUNT - 1,
  });
  if (!open || typeof document === "undefined") return null;

  const update = <K extends keyof GexMapStarSettings>(key: K, value: GexMapStarSettings[K]) => onChange({ ...settings, [key]: value });
  const paletteScale = gexMapSignedScale(palette);
  const applySlotColor = (hex: string) => {
    if (editSlot.side === "star") {
      onPaletteChange({ ...palette, useThemeColors: false, star: hex });
      return;
    }
    const ramp = [...paletteScale];
    ramp[editSlot.index] = hex;
    // Keep the legacy strong tones in sync so preview bars and preset
    // detection stay coherent with the edited scale.
    onPaletteChange({
      ...palette,
      useThemeColors: false,
      scaleStops: ramp,
    });
  };
  const handleDragBar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    applySlotColor(gexMapDragBarColor((event.clientX - rect.left) / rect.width));
  };
  const selectedSlotColor = editSlot.side === "star" ? palette.star : paletteScale[editSlot.index];
  const scaleSlotLabel = (index: number) => (index < 5 ? `-${(5 - index) * 20}` : `+${(index - 4) * 20}`);
  const rowClass = "grid grid-cols-[minmax(0,1fr)_160px] items-center gap-4 border-b border-border/60 py-3";
  return createPortal(
    <div className="fixed inset-0 z-[270] flex items-start justify-center bg-black/20 px-4 pt-[10vh]" onPointerDown={onClose}>
      <section className="max-h-[80vh] w-full max-w-[620px] overflow-y-auto border border-border bg-panel shadow-[0_24px_90px_rgba(0,0,0,0.65)]" onPointerDown={(event) => event.stopPropagation()}>
        <header className="sticky top-0 z-10 flex h-11 items-center border-b border-border bg-panel px-4">
          <div>
            <div className="text-[11px] font-semibold text-foreground">STAR VIEW SETTINGS</div>
            <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Applied to every GEX Map panel</div>
          </div>
          <button type="button" onClick={onClose} className="ml-auto flex h-7 w-7 items-center justify-center border border-border text-muted hover:text-foreground" aria-label="Close Star view settings"><X className="h-3.5 w-3.5" /></button>
        </header>
        <div className="px-4 pb-4">
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Highlighted nodes</span><span className="text-[8px] text-muted">Unique structural strikes per panel</span></span>
            <input type="range" min="2" max="8" step="1" value={settings.highlightedNodes} onChange={(event) => update("highlightedNodes", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Selection strategy</span><span className="text-[8px] text-muted">Changes the deterministic node ranking</span></span>
            <select value={settings.selectionStrategy} onChange={(event) => update("selectionStrategy", event.target.value as GexMapStarSettings["selectionStrategy"])} className="h-8 border border-border bg-surface px-2 text-[9px] text-foreground outline-none">
              <option value="structural">Structural</option><option value="magnitude">Magnitude</option><option value="velocity">Velocity</option>
            </select>
          </label>
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Dimmed-row intensity</span><span className="text-[8px] text-muted">{Math.round(settings.dimOpacity * 100)}%</span></span>
            <input type="range" min="0.02" max="0.3" step="0.01" value={settings.dimOpacity} onChange={(event) => update("dimOpacity", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          {([
            ["showRawValues", "Show raw exposure values"],
            ["showRoleLabels", "Show role labels"],
            ["showAirPocketLabels", "Show air-pocket labels"],
            ["animateChanges", "Animate live changes"],
          ] as const).map(([key, label]) => (
            <label key={key} className={rowClass}>
              <span className="text-[10px] text-foreground">{label}</span>
              <input type="checkbox" checked={settings[key]} onChange={(event) => update(key, event.target.checked)} className="ml-auto h-4 w-4 accent-[var(--primary)]" />
            </label>
          ))}
          <div className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Minimum map control</span><span className="text-[8px] text-muted">Auto adapts to strike density</span></span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => update("minimumControlPct", settings.minimumControlPct === null ? 0.5 : null)} className={`h-7 border px-2 text-[8px] ${settings.minimumControlPct === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}>{settings.minimumControlPct === null ? "AUTO" : "MANUAL"}</button>
              {settings.minimumControlPct !== null ? <input type="number" min="0" max="25" step="0.1" value={settings.minimumControlPct} onChange={(event) => update("minimumControlPct", Number(event.target.value))} className="h-7 min-w-0 flex-1 border border-border bg-surface px-2 text-[9px] text-foreground" /> : null}
            </div>
          </div>
          <div className="pt-4 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Air-pocket calculation</div>
          <label className={rowClass}>
            <span className="text-[10px] text-foreground">Row control threshold</span>
            <input type="number" min="0" max="20" step="0.05" value={settings.airPocketRowThresholdPct} onChange={(event) => update("airPocketRowThresholdPct", Number(event.target.value))} className="h-8 border border-border bg-surface px-2 text-[9px] text-foreground" />
          </label>
          <label className={rowClass}>
            <span className="text-[10px] text-foreground">Combined pocket threshold</span>
            <input type="number" min="0" max="50" step="0.1" value={settings.airPocketCombinedThresholdPct} onChange={(event) => update("airPocketCombinedThresholdPct", Number(event.target.value))} className="h-8 border border-border bg-surface px-2 text-[9px] text-foreground" />
          </label>
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Spot-proximity weighting</span><span className="text-[8px] text-muted">{Math.round(settings.proximityWeight * 100)}%</span></span>
            <input type="range" min="0" max="0.3" step="0.01" value={settings.proximityWeight} onChange={(event) => update("proximityWeight", Number(event.target.value))} className="w-full accent-[var(--primary)]" />
          </label>
          <div className="pt-4 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Colours</div>
          <div className="border-b border-border/60 py-3">
            <span><span className="block text-[10px] text-foreground">Gradient palettes</span><span className="text-[8px] text-muted">One click recolours the whole map</span></span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {GEX_MAP_PALETTE_PRESETS.map((preset) => {
                const presetScale = preset.scale ?? buildGexMapSignedScale(preset.negative, preset.positive);
                const presetPalette: GexMapPalette = {
                  useThemeColors: false,
                  positive: preset.positive,
                  positiveSoft: preset.positiveSoft,
                  negative: preset.negative,
                  negativeSoft: preset.negativeSoft,
                  star: preset.star,
                  scaleStops: [...presetScale],
                };
                const active = gexMapPalettesEqual(palette, presetPalette);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    aria-label={`${preset.label} palette`}
                    aria-pressed={active}
                    onClick={() => onPaletteChange(presetPalette)}
                    className={`relative h-7 w-9 overflow-hidden rounded-[4px] border transition-transform hover:scale-110 ${
                      active ? "border-primary shadow-[0_0_10px_color-mix(in_srgb,var(--primary)_45%,transparent)]" : "border-border"
                    }`}
                    style={{ background: `linear-gradient(90deg, ${presetScale.join(", ")})` }}
                  >
                    <span
                      className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full border border-black/30"
                      style={{ background: preset.star }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <label className={rowClass}>
            <span><span className="block text-[10px] text-foreground">Use theme colours</span><span className="text-[8px] text-muted">Follow the overall KwantDesk theme</span></span>
            <input
              type="checkbox"
              checked={palette.useThemeColors}
              onChange={(event) => onPaletteChange({ ...palette, useThemeColors: event.target.checked })}
              className="ml-auto h-4 w-4 accent-[var(--primary)]"
            />
          </label>
          {!palette.useThemeColors ? (
            <div className="border-b border-border/60 py-3">
              <span className="block text-[10px] text-foreground">Signed-exposure scale · extreme negative → extreme positive</span>
              <span className="text-[8px] text-muted">One ten-colour gradient: slot one paints the biggest negative (darkest), the middle is average noise, slot ten the biggest positive (lightest). Tap a slot, then drag the bar — the map recolours live.</span>
              <div className="mt-2.5">
                <div className="grid grid-cols-10 gap-1">
                  {paletteScale.map((color, index) => {
                    const selected = editSlot.side === "scale" && editSlot.index === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        title={`${scaleSlotLabel(index)}% signed-exposure slot`}
                        aria-label={`Signed exposure ${scaleSlotLabel(index)}% colour`}
                        aria-pressed={selected}
                        onClick={() => setEditSlot({ side: "scale", index })}
                        className={`relative h-7 rounded-[3px] border transition-transform hover:scale-110 ${
                          selected
                            ? "border-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                            : "border-border/70"
                        }`}
                        style={{ background: color }}
                      >
                        <span
                          className="absolute inset-x-0 bottom-0 text-center font-mono text-[6px] leading-[9px]"
                          style={{ color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                        >
                          {scaleSlotLabel(index)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2.5">
                <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Star node</span>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Star node colour"
                    aria-pressed={editSlot.side === "star"}
                    onClick={() => setEditSlot({ side: "star", index: 0 })}
                    className={`h-7 w-10 rounded-[3px] border transition-transform hover:scale-110 ${
                      editSlot.side === "star"
                        ? "border-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                        : "border-border/70"
                    }`}
                    style={{ background: palette.star }}
                  />
                  <span className="font-mono text-[8px] uppercase text-muted">{palette.star}</span>
                </div>
              </div>
              <div className="mt-3">
                <div
                  role="slider"
                  aria-label="Colour drag bar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="relative h-6 w-full cursor-ew-resize touch-none rounded-[4px] border border-border"
                  style={{ background: GEX_MAP_DRAG_BAR_TRACK }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    handleDragBar(event);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) handleDragBar(event);
                  }}
                />
                <div className="mt-1 flex items-center justify-between text-[8px] text-muted">
                  <span>Drag left–right to recolour the selected slot</span>
                  <span className="flex items-center gap-1.5 font-mono uppercase">
                    <span className="inline-block h-3 w-3 rounded-[2px] border border-border/70" style={{ background: selectedSlotColor }} />
                    {selectedSlotColor}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={() => onChange({ ...RECOMMENDED_GEX_MAP_STAR_SETTINGS })} className="mt-4 h-8 border border-primary/40 px-3 text-[9px] font-semibold text-primary hover:bg-primary/10">RESET RECOMMENDED DEFAULTS</button>
        </div>
        <footer className="sticky bottom-0 z-10 flex h-12 items-center justify-between gap-3 border-t border-border bg-panel px-4">
          <span className="text-[8px] text-muted">
            {paletteDirty ? "Colour changes preview live — Save to keep them." : "Saved colours stay until you relink the theme."}
          </span>
          <button
            type="button"
            onClick={onPaletteSave}
            disabled={!paletteDirty}
            className={`h-8 border px-4 text-[9px] font-semibold transition ${
              paletteDirty
                ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                : "border-border text-muted"
            }`}
          >
            SAVE
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function GexMapWorkspace({ market = null, externalReplay = null, persistedState = null, onStateChange }: GexMapWorkspaceProps = {}) {
  // Keep the server and first browser render identical. Reading window.location or
  // sessionStorage in a state initializer can make React discard the hydrated GEX
  // tree, which previously left an otherwise healthy map blank on some page loads.
  const [locationMarket, setLocationMarket] = useState<GexMapMarket | null>(null);
  const linkedMarket = market ?? locationMarket;
  // A host-workspace pane owns this embed's saved configuration: it must win
  // over market defaults on mount and survive the pane being switched away
  // and back. Only the value present at mount matters.
  const initialEmbedStateRef = useRef<GexMapEmbedState | null | undefined>(undefined);
  if (initialEmbedStateRef.current === undefined) {
    initialEmbedStateRef.current = normalizeGexMapEmbedState(persistedState);
  }
  const onStateChangeRef = useRef(onStateChange);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  const [panels, setPanels] = useState<PanelConfig[]>(() =>
    initialEmbedStateRef.current?.panels.map((panel) => ({ ...panel })) ?? initialPanelsForMarket(market));
  const panelsRef = useRef(panels);
  const [panelData, setPanelData] = useState<Record<string, GexMapPanelPayload | null>>({
    left: null,
    centre: null,
    right: null,
  });
  const [panelErrors, setPanelErrors] = useState<Record<string, string | null>>({
    left: null,
    centre: null,
    right: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    left: true,
    centre: true,
    right: true,
  });
  const [internalReplayMode, setReplayMode] = useState(false);
  const [replayDate, setReplayDate] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [stepMinutes, setStepMinutes] = useState<(typeof FRAME_STEPS)[number]>(
    // normalizeGexMapEmbedState only admits FRAME_STEPS members.
    () => (initialEmbedStateRef.current?.stepMinutes ?? 1) as (typeof FRAME_STEPS)[number],
  );
  // Node zoom: SSR-safe default first, stored value applied after hydration.
  const [ladderZoom, setLadderZoom] = useState(1);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(GEX_MAP_ZOOM_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= GEX_MAP_ZOOM_MIN && stored <= GEX_MAP_ZOOM_MAX) {
        setLadderZoom(Math.round(stored * 10) / 10);
      }
    } catch {
      // Zoom stays at 100% when browser storage is unavailable.
    }
  }, []);
  const adjustLadderZoom = useCallback((direction: 1 | -1) => {
    setLadderZoom((current) => {
      const next = Math.round(
        Math.min(GEX_MAP_ZOOM_MAX, Math.max(GEX_MAP_ZOOM_MIN, current + direction * GEX_MAP_ZOOM_STEP)) * 10,
      ) / 10;
      try {
        window.localStorage.setItem(GEX_MAP_ZOOM_STORAGE_KEY, String(next));
        window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
      } catch {
        // Zoom still applies for this session without storage.
      }
      return next;
    });
  }, []);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [latestSessionDate, setLatestSessionDate] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [viewMode, setViewMode] = useState<GexMapViewMode>(
    () => initialEmbedStateRef.current?.viewMode ?? "raw",
  );
  const [starSettings, setStarSettings] = useState<GexMapStarSettings>({ ...RECOMMENDED_GEX_MAP_STAR_SETTINGS });
  const [starSettingsOpen, setStarSettingsOpen] = useState(false);
  // The saved palette is the committed truth; edits inside the settings
  // dialog preview live and either commit on Save or revert on close.
  const [savedPalette, setSavedPalette] = useState<GexMapPalette>(() => loadGexMapPalette());
  const [palettePreview, setPalettePreview] = useState<GexMapPalette | null>(null);
  const activePalette = palettePreview ?? savedPalette;
  useEffect(() => {
    const applyExternalPalette = (event: Event) => {
      const next = normalizeGexMapPalette((event as CustomEvent).detail);
      setSavedPalette((currentSaved) => gexMapPalettesEqual(currentSaved, next) ? currentSaved : next);
    };
    window.addEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, applyExternalPalette);
    return () => window.removeEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, applyExternalPalette);
  }, []);
  const starPreferencesHydratedRef = useRef(false);
  const forceRefreshRef = useRef(false);
  const replayMode = externalReplay?.active ?? internalReplayMode;
  const requestedReplayDate = replayMode ? (externalReplay?.sessionDate || replayDate) : "";

  useEffect(() => {
    setLocationMarket(market ?? linkedMarketFromLocation());
  }, [market]);

  useEffect(() => {
    const stored = readGexMapStarPreferences();
    if (stored) {
      // A pane-saved view mode outranks the global preference.
      if (!initialEmbedStateRef.current) setViewMode(stored.viewMode);
      setStarSettings(stored.settings);
    }
    starPreferencesHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!starPreferencesHydratedRef.current) return;
    window.localStorage.setItem(GEX_MAP_STAR_PREFERENCES_KEY, JSON.stringify({ viewMode, settings: starSettings }));
  }, [starSettings, viewMode]);

  useEffect(() => {
    const toggleView = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== "v" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setViewMode((current) => current === "raw" ? "star" : "raw");
    };
    window.addEventListener("keydown", toggleView);
    return () => window.removeEventListener("keydown", toggleView);
  }, []);

  useEffect(() => {
    // A pane-saved configuration owns the panel set; the market link only
    // provides defaults for embeds without one.
    const nextPanels = initialEmbedStateRef.current
      ? panelsRef.current.map((panel) => ({ ...panel }))
      : initialPanelsForMarket(linkedMarket);
    const cachedData = Object.fromEntries(nextPanels.map((panel) => [
      panel.id,
      (() => {
        const cached = readWorkspaceData<GexMapPanelPayload>(gexMapCacheKey(panel.symbol, panel.greekMode));
        return hasRenderableGexMapSurface(cached) ? cached : null;
      })(),
    ]));

    setPanels((current) => current.every((panel, index) => (
      panel.id === nextPanels[index]?.id
      && panel.symbol === nextPanels[index]?.symbol
      && panel.greekMode === nextPanels[index]?.greekMode
    )) && current.length === nextPanels.length ? current : nextPanels);
    setPanelData(cachedData);
    setPanelErrors({ left: null, centre: null, right: null });
    setLoading(Object.fromEntries(nextPanels.map((panel) => [panel.id, !cachedData[panel.id]])));
  }, [linkedMarket]);
  // Report configuration changes to the host workspace so quick-save and
  // presets capture exactly what the user configured on this pane.
  useEffect(() => {
    panelsRef.current = panels;
    onStateChangeRef.current?.({
      panels: panels.map((panel) => ({ ...panel })),
      viewMode,
      stepMinutes,
    });
  }, [panels, stepMinutes, viewMode]);

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
        return [panel.id, hasRenderableGexMapSurface(cached) ? cached : null];
      }));
      setPanelData((current) => {
        const next = { ...current };
        for (const panel of panels) {
          const cached = cachedPanels[panel.id];
          if (cached && !hasRenderableGexMapSurface(next[panel.id])) next[panel.id] = cached;
        }
        return next;
      });
      setLoading(Object.fromEntries(panels.map((panel) => [panel.id, true])));
      try {
        const loadPanel = async (panel: PanelConfig) => {
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
              // The VPS serialises KwantData request starts to respect its
              // entitlement. A cold three-panel load can outlive the generic
              // workspace timeout even though every provider response is
              // healthy, so do not abort the final QQQ panel prematurely.
              timeoutMs: 45_000,
              validate: (value) => hasRenderableGexMapSurface(value as GexMapPanelPayload),
              invalidMessage: "The GEX surface did not contain a strike ladder.",
            },
          );
          return { id: panel.id, payload };
        };
        const results = await Promise.allSettled(panels.map(loadPanel));
        // Once the initial concurrent load has settled, retry only failed
        // surfaces in isolation. This prevents a brief VPS/serverless reset
        // from permanently leaving the final QQQ panel blank while NDX is
        // already healthy, without re-requesting successful panels.
        const failedIndexes = results.flatMap((result, index) =>
          result.status === "rejected" ? [index] : []);
        for (const index of failedIndexes) {
          if (cancelled) return;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
          const retried = await Promise.allSettled([loadPanel(panels[index])]);
          results[index] = retried[0];
        }
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
  }, [panels, refreshToken, replayMode, requestedReplayDate]);

  const timeline = useMemo(() => {
    const timestamps = new Set<number>();
    for (const panel of panels) {
      const payload = panelData[panel.id];
      if (!payload || (replayMode && requestedReplayDate && payload.sessionDate !== requestedReplayDate)) continue;
      for (const frame of payload.frames) timestamps.add(frame.timestamp);
    }
    const ordered = [...timestamps].sort((a, b) => a - b);
    if (stepMinutes === 1 || !ordered.length) return ordered;
    const anchor = ordered[0];
    return ordered.filter((timestamp) => Math.round((timestamp - anchor) / 60_000) % stepMinutes === 0);
  }, [panelData, panels, replayMode, requestedReplayDate, stepMinutes]);

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

  const selectedTimestamp = replayMode
    ? externalReplay?.timestampMs ?? timeline[Math.min(cursor, Math.max(0, timeline.length - 1))] ?? null
    : null;
  const live = !replayMode && panels.every((panel) => panelData[panel.id]?.status === "LIVE");
  const dataAsOf = panels.reduce<number | null>((oldest, panel) => {
    const timestamp = Date.parse(panelData[panel.id]?.asOf ?? "");
    if (!Number.isFinite(timestamp)) return oldest;
    return oldest === null ? timestamp : Math.min(oldest, timestamp);
  }, null);
  const currentSessionDate = latestSessionDate
    || panels.map((panel) => panelData[panel.id]?.sessionDate).find(Boolean)
    || "";
  const initialSurfacePending = panels.length > 0 && panels.every((panel) => (
    loading[panel.id] && !hasRenderableGexMapSurface(panelData[panel.id])
  ));

  function updatePanel(id: PanelConfig["id"], patch: Partial<Pick<PanelConfig, "symbol" | "greekMode">>) {
    setPanels((current) => current.map((panel) => panel.id === id ? { ...panel, ...patch } : panel));
  }

  function addPanel() {
    if (panels.length >= MAX_GEX_MAP_PANELS) return;
    const id = `extra-${Date.now()}`;
    const symbol = linkedMarket === "ES" ? "SPY" : "QQQ";
    const greekMode: GreekMode = "CHARM";
    setPanelData((current) => ({ ...current, [id]: null }));
    setPanelErrors((current) => ({ ...current, [id]: null }));
    setLoading((current) => ({ ...current, [id]: true }));
    setPanels((current) => [...current, { id, symbol, greekMode }]);
  }

  function removePanel(id: PanelConfig["id"]) {
    setPanels((current) => current.filter((panel) => panel.id !== id));
    setPanelData((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setPanelErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLoading((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
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
    <div className="gex-map-workspace relative flex h-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="gex-map-header sticky top-0 z-40 flex h-9 min-h-9 shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden border-b border-border bg-panel px-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-primary/10 text-primary">
            <ScanLine className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[11px] font-semibold tracking-tight">GEXMAP</h1>
              <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">{linkedMarket ? `${linkedMarket} context` : `${panels.length} panels`}</span>
            </div>
            <p className="hidden">Signed front-expiry exposure by strike</p>
          </div>

          <div className="ml-1 flex h-7 shrink-0 items-center border border-border bg-surface p-0.5" role="group" aria-label="GEX Map view mode">
            <button
              type="button"
              aria-label="Raw exposure view"
              aria-pressed={viewMode === "raw"}
              title="Show every strike, raw exposure and raw change."
              onClick={() => setViewMode("raw")}
              className={`flex h-5 items-center gap-1 px-1.5 text-[8px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${viewMode === "raw" ? "bg-panel text-primary" : "text-muted hover:text-foreground"}`}
            >
              <ListOrdered className="h-3 w-3" /><span>(123)</span>
            </button>
            <button
              type="button"
              aria-label="Star focus view"
              aria-pressed={viewMode === "star"}
              title="Focus on Star, structural nodes, map control and live growth."
              onClick={() => setViewMode("star")}
              className={`flex h-5 items-center gap-1 px-1.5 text-[8px] font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${viewMode === "star" ? "bg-panel text-primary" : "text-muted hover:text-foreground"}`}
            >
              <Star className="h-3 w-3" fill={viewMode === "star" ? "currentColor" : "none"} /><span>(★)</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStarSettingsOpen(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-border bg-surface text-muted hover:border-primary/30 hover:text-primary"
            title="STAR view settings"
            aria-label="Open Star view settings"
          >
            <SlidersHorizontal className="h-3 w-3" />
          </button>

          <div className="gex-map-frame-steps ml-1 flex h-7 shrink-0 items-center gap-0.5 rounded-[3px] border border-border bg-surface p-0.5">
            {FRAME_STEPS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStepMinutes(value);
                  setCursor(0);
                  setPlaying(false);
                }}
                className={`h-5 rounded-[2px] px-1.5 text-[8px] font-semibold ${stepMinutes === value ? "bg-panel text-primary shadow-sm" : "text-muted hover:text-foreground"}`}
              >
                {value}m
              </button>
            ))}
          </div>

          <div className="ml-1 flex h-7 shrink-0 items-center gap-0.5 rounded-[3px] border border-border bg-surface p-0.5" title={`Node zoom ${Math.round(ladderZoom * 100)}% — zoom in for fewer, larger nodes; out for more, smaller ones`}>
            <button
              type="button"
              onClick={() => adjustLadderZoom(-1)}
              disabled={ladderZoom <= GEX_MAP_ZOOM_MIN}
              className="flex h-5 w-5 items-center justify-center rounded-[2px] text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Zoom strike nodes out (show more)"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[26px] text-center font-mono text-[8px] font-semibold text-foreground">{Math.round(ladderZoom * 100)}%</span>
            <button
              type="button"
              onClick={() => adjustLadderZoom(1)}
              disabled={ladderZoom >= GEX_MAP_ZOOM_MAX}
              className="flex h-5 w-5 items-center justify-center rounded-[2px] text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Zoom strike nodes in (show fewer)"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="gex-map-header-actions ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={addPanel}
              disabled={panels.length >= MAX_GEX_MAP_PANELS}
              className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-border bg-surface text-foreground transition hover:border-primary/35 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
              title={panels.length >= MAX_GEX_MAP_PANELS ? "Four GEX columns are already open" : "Add another GEX column"}
              aria-label="Add another GEX column"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className={`flex h-7 items-center gap-1.5 rounded-[3px] border px-2 text-[8px] font-semibold ${replayMode ? "border-accent/25 bg-accent/10 text-accent" : live ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>
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
              className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-border bg-surface text-muted transition hover:text-foreground"
              title="Sync now"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
            {!externalReplay ? <button
              type="button"
              onClick={replayMode ? exitReplay : enterReplay}
              className={`flex h-7 items-center gap-1.5 rounded-[3px] border px-2 text-[8px] font-semibold transition ${replayMode ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-foreground hover:border-primary/30"}`}
            >
              {replayMode ? <Radio className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
              {replayMode ? "Exit Replay" : "Replay"}
            </button> : null}
          </div>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-1.5 pt-0">
          <div
            className="gex-map-panel-grid grid h-full min-w-0 gap-2"
            style={{ "--gex-map-panel-count": panels.length } as CSSProperties}
          >
            {panels.map((panel, panelIndex) => {
              const payload = panelData[panel.id];
              const matchesPanel = payload
                && payload.symbol === panel.symbol
                && payload.greekMode === panel.greekMode;
              const replaySessionMismatch = Boolean(
                matchesPanel
                && replayMode
                && requestedReplayDate
                && payload.sessionDate !== requestedReplayDate,
              );
              const validPayload = matchesPanel && !replaySessionMismatch ? payload : null;
              return (
                <ExposurePanel
                  key={panel.id}
                  config={panel}
                  payload={validPayload}
                  loading={loading[panel.id]}
                  error={panelErrors[panel.id]}
                  selectedTimestamp={selectedTimestamp}
                  stepMinutes={stepMinutes}
                  viewMode={viewMode}
                  starSettings={starSettings}
                  palette={activePalette}
                  ladderZoom={ladderZoom}
                  unavailableReason={replaySessionMismatch
                    ? `Recorded frames are for ${payload?.sessionDate}, but the replay session is ${requestedReplayDate}. Exposure frames are only retained for the latest completed session.`
                    : null}
                  onChange={(patch) => updatePanel(panel.id, patch)}
                  onRemove={panelIndex >= DEFAULT_PANELS.length ? () => removePanel(panel.id) : undefined}
                />
              );
            })}
          </div>
        </div>

        {replayMode && !externalReplay ? (
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
            <span className="ml-auto">Every node is coloured by its percentage of the Star node’s exposure — zero at the scale’s middle, the Star alone at its end: darkest when negative, lightest when positive.</span>
          </footer>
        )}
      </main>
      {initialSurfacePending ? (
        <div className="pointer-events-none absolute inset-0 z-50">
          <KwantLoader
            title="Loading GEX MAP"
            detail="Restoring the latest exposure surfaces."
            className="h-full w-full bg-chart-background"
          />
        </div>
      ) : null}
      <StarViewSettings
        open={starSettingsOpen}
        settings={starSettings}
        palette={activePalette}
        paletteDirty={palettePreview !== null && !gexMapPalettesEqual(palettePreview, savedPalette)}
        onChange={setStarSettings}
        onPaletteChange={setPalettePreview}
        onPaletteSave={() => {
          const next = palettePreview ?? savedPalette;
          saveGexMapPalette(next);
          setSavedPalette(next);
          setPalettePreview(null);
        }}
        onClose={() => {
          // Closing without saving discards the colour preview.
          setPalettePreview(null);
          setStarSettingsOpen(false);
        }}
      />
    </div>
  );
}

export default memo(GexMapWorkspace);
