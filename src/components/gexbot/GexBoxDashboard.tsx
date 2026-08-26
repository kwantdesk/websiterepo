"use client";

import {
  Activity, BarChart3, BookOpen, Copy, Download, Expand,
  FileUp, Grip, LayoutDashboard, Maximize2,
  MoreHorizontal, Move, Plus, RefreshCw, Search, Settings2, Trash2, X,
  Save, SlidersHorizontal,
} from "lucide-react";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import ChartColorField from "@/components/ChartColorField";

// Loaded on demand: GEX BOX should not carry the flow workspace unless a panel
// actually asks for it.
const GexFlowWorkspace = dynamic(() => import("@/components/gex-flow/GexFlowWorkspace"), { ssr: false });

type ToolCategory = "Options" | "Equities" | "KwantDesk";
// `endpoint` is optional: a tool that owns its own data fetching renders a
// whole workspace and takes nothing from the shared feed.
type Tool = { id: string; label: string; category: ToolCategory; detail: string; endpoint?: ((settings: PanelSettings) => string) | null };
type PanelSettings = {
  symbol: string; date: string; aggregation: string; greek: string; expiry: string;
  strikes: number; rows: number; minimum: number; color: string; negativeColor: string;
  flowSearch: string; flowSide: string; flowSentiment: string; flowType: string; flowExchange: string;
  flowMinPremium: number; flowMinQuantity: number; flowSort: string; flowDirection: "asc" | "desc"; density: "compact" | "comfortable";
  flowColumns: "full" | "essential" | "execution" | "contract"; flowGrouping: "none" | "contract" | "expiry" | "exchange";
  flowFlags: "ALL" | "UNUSUAL" | "OPENING" | "GOLDEN" | "VOL_GT_OI" | "SIZE_GT_OI";
  tableSearch: string; tableSort: string; tableDirection: "asc" | "desc";
  intervalVisual: "bubbles" | "fixed-dots" | "heat-cells" | "horizontal-ribbons" | "hybrid";
  intervalContent: "net" | "call" | "put" | "gross" | "call-put-split";
  intervalMode: "raw" | "difference"; intervalBaseline: "previous-bucket" | "session-open" | "rolling-average";
  intervalRollingBuckets: number; intervalMaximumPoints: number; intervalMaximumDistance: number; intervalShowPrice: boolean;
  /** How the underlying is drawn over the map: a line, or real candles. */
  intervalPriceStyle: "line" | "candles";
  /** Buckets folded into one candle. One bucket carries a single price, so a
   *  candle needs several before it has an open, high, low and close to show. */
  intervalCandleBuckets: number;
};
type DashboardPanel = { id: string; toolId: string; title: string; settings: PanelSettings };
type DashboardPage = { id: string; name: string; layout: "grid" | "infinite"; panels: DashboardPanel[] };
type DashboardWorkspace = {
  schemaVersion: 2; name: string; activePageId: string; pages: DashboardPage[];
  /** Workspace-wide palette. Absent on workspaces saved before it existed. */
  paletteId?: string;
};

import {
  deleteGexBoxWorkspace,
  exportGexBoxWorkspace,
  GEX_BOX_WORKSPACES_EVENT,
  importGexBoxWorkspace,
  loadGexBoxWorkspaces,
  saveGexBoxWorkspace,
  type GexBoxWorkspacePreset,
} from "@/lib/gexBoxWorkspaces";
import {
  DEFAULT_GEX_BOX_PALETTE_ID,
  gexBoxPanelColors,
  gexBoxThemeVariables,
  resolveGexBoxRoles,
} from "@/lib/gexBoxTheme";
import { GEX_MAP_PALETTE_PRESETS } from "@/lib/gexMapPalette";
import { writeProtectedItem } from "@/lib/browserStorageQuota";

const STORAGE_KEY = "kwantdesk:gex-box:dashboard:v2";
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function latestNewYorkSession() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(`${value("year")}-${value("month")}-${value("day")}T12:00:00Z`);
  const weekday = value("weekday");
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const beforeCashOpen = minutes < 9 * 60 + 30;
  const daysBack = weekday === "Sun" ? 2 : weekday === "Sat" ? 1 : beforeCashOpen ? (weekday === "Mon" ? 3 : 1) : 0;
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

const DEFAULT_SETTINGS: PanelSettings = {
  symbol: "SPY", date: latestNewYorkSession(), aggregation: "5m", greek: "GEX",
  expiry: "ALL", strikes: 20, rows: 50, minimum: 0, color: "var(--primary)", negativeColor: "var(--danger)",
  flowSearch: "", flowSide: "ALL", flowSentiment: "ALL", flowType: "ALL", flowExchange: "ALL",
  flowMinPremium: 0, flowMinQuantity: 0, flowSort: "tradeTime", flowDirection: "desc", density: "compact",
  flowColumns: "full", flowGrouping: "none", flowFlags: "ALL",
  tableSearch: "", tableSort: "", tableDirection: "desc",
  intervalVisual: "bubbles", intervalContent: "net", intervalMode: "raw", intervalBaseline: "previous-bucket",
  intervalRollingBuckets: 5, intervalMaximumPoints: 5000, intervalMaximumDistance: 20, intervalShowPrice: true,
  intervalPriceStyle: "line", intervalCandleBuckets: 5,
};

function completeSettings(value?: Partial<PanelSettings>): PanelSettings {
  return { ...DEFAULT_SETTINGS, ...(value ?? {}) };
}

const nativeTicker = (symbol: string) => symbol === "SPX" || symbol === "SPXW" || symbol === "SPY" ? "ES_SPX" : "NQ_NDX";
const normalizedTool = (tool: string) => (s: PanelSettings) => `/api/gex-box/tool?tool=${tool}&symbol=${s.symbol}&sessionDate=${s.date}&greek=${s.greek}&expiry=${s.expiry}&size=${Math.max(10, Math.min(500, s.rows))}`;
const TOOLS: Tool[] = [
  { id: "consolidated-flow", label: "Consolidated Order Flow", category: "Options", detail: "Grouped transactions, premium, sentiment and trade side", endpoint: normalizedTool("consolidated-flow") },
  { id: "contract-side-statistics", label: "Contract Side Statistics", category: "Options", detail: "Bid, ask, mid and aggressor statistics", endpoint: normalizedTool("contract-side-statistics") },
  { id: "contract-statistics", label: "Contract Statistics", category: "Options", detail: "Volume, OI, premium, trades, price and IV", endpoint: normalizedTool("contract-statistics") },
  { id: "exposure-expiration", label: "Exposure by Expiration", category: "Options", detail: "Greek exposure grouped by expiration", endpoint: normalizedTool("exposure-expiration") },
  { id: "exposure-strike", label: "Exposure by Strike", category: "Options", detail: "Signed exposure profile across strikes", endpoint: normalizedTool("exposure-strike") },
  { id: "gainers-losers", label: "Gainers / Losers", category: "Options", detail: "Bullish and bearish premium leaderboard", endpoint: normalizedTool("gainers-losers") },
  // GEX FLOW is a whole workspace rather than one payload rendered into a
  // panel: it owns its screens, filters, columns and refresh. It therefore has
  // no endpoint here - the shared feed would fetch nothing and the panel
  // renders the workspace directly. That is also what keeps it looking
  // identical wherever it is hosted, instead of a cut-down second version.
  { id: "gex-flow", label: "GEX Flow", category: "Options", detail: "Live options tape with screens, filters and saved columns", endpoint: null },
  { id: "heat-map", label: "Heat Map", category: "Options", detail: "Exposure matrix across strikes and expirations", endpoint: (s) => `/api/gex-interval-map?source=${s.symbol}&display=${s.symbol}&sessionDate=${s.date}&aggregationPeriod=${s.aggregation}&greekMode=${s.greek}` },
  { id: "iv-rank", label: "IV Rank", category: "Options", detail: "Current IV against its historical range", endpoint: (s) => `/api/implied-volatility-rank?source=${s.symbol}&display=${s.symbol}&lookBackPeriodDays=252&targetMaturityDays=30&contractMode=combined` },
  { id: "interval-map", label: "Interval Map", category: "Options", detail: "When and where exposure builds or unwinds", endpoint: (s) => `/api/gex-interval-map?source=${s.symbol}&display=${s.symbol}&sessionDate=${s.date}&aggregationPeriod=${s.aggregation}&greekMode=${s.greek}` },
  { id: "max-pain", label: "Max Pain", category: "Options", detail: "Current max-pain distribution", endpoint: normalizedTool("max-pain") },
  { id: "net-drift", label: "Net Drift", category: "Options", detail: "Net implied-volatility drift", endpoint: normalizedTool("net-drift") },
  { id: "net-flow", label: "Net Flow", category: "Options", detail: "Net options flow through time", endpoint: normalizedTool("net-flow") },
  { id: "oi-strike", label: "OI by Strike", category: "Options", detail: "Open interest by strike", endpoint: normalizedTool("oi-strike") },
  { id: "term-structure", label: "Term Structure", category: "Options", detail: "Implied volatility across maturities", endpoint: normalizedTool("term-structure") },
  { id: "unconsolidated-flow", label: "Unconsolidated Order Flow", category: "Options", detail: "Raw exchange-level option prints", endpoint: normalizedTool("unconsolidated-flow") },
  { id: "volatility-drift", label: "Volatility Drift", category: "Options", detail: "Call and put volatility drift", endpoint: normalizedTool("volatility-drift") },
  { id: "dark-pool-levels", label: "Dark Pool Levels", category: "Equities", detail: "Ranked persistent dark-pool price concentrations", endpoint: (s) => `/api/dark-pool-map?source=${s.symbol}&display=${s.symbol}&historyDays=5&topLevels=${s.rows}` },
  { id: "equity-prints", label: "Equity Prints", category: "Equities", detail: "Ranked equity prints and notional concentration", endpoint: (s) => `/api/dark-pool-map?source=${s.symbol}&display=${s.symbol}&historyDays=1&topLevels=${s.rows}` },
  { id: "market-map", label: "Market Map", category: "Equities", detail: "Cross-symbol equity market map", endpoint: () => "/api/market-indices?snapshot=1&symbols=SPY,QQQ,IWM,DIA,SPX,NDX" },
  { id: "stock-price-time", label: "Stock Price / Time", category: "Equities", detail: "Underlying price series", endpoint: (s) => `/api/market-indices?symbol=${s.symbol}&timeframe=${s.aggregation}` },
  { id: "classic-gex", label: "Classic GEX", category: "KwantDesk", detail: "Native GEX profile and underlying path", endpoint: (s) => `/api/gex-box/snapshot?ticker=${nativeTicker(s.symbol)}&view=classic&category=gex_full` },
  { id: "state-profile", label: "State Profile", category: "KwantDesk", detail: "Native exposure state surface", endpoint: (s) => `/api/gex-box/snapshot?ticker=${nativeTicker(s.symbol)}&view=state&category=${s.greek.toLowerCase()}` },
  { id: "orderflow-profile", label: "Orderflow Profile", category: "KwantDesk", detail: "Native orderflow metrics", endpoint: (s) => `/api/gex-box/snapshot?ticker=${nativeTicker(s.symbol)}&view=orderflow&category=orderflow` },
];

const toolById = new Map(TOOLS.map((tool) => [tool.id, tool]));

/**
 * Palette picker for the whole workspace.
 *
 * Choosing one writes the call and put colours into every panel on every page,
 * so a call is the same colour wherever it appears — net flow, net drift,
 * exposure by expiration, anything added later. Headers and strike labels
 * follow through CSS variables rather than per-panel settings, because they
 * are chrome rather than data.
 */
/**
 * Picking a workspace palette.
 *
 * Choosing a colour used to APPLY it and shut the dialog, so comparing two
 * palettes meant reopening the dialog for each one and there was no way to
 * change your mind. A click now previews on the live workspace behind the
 * dialog and nothing is committed until Save; leaving with an unsaved choice
 * asks first, and discarding puts the palette back exactly as it was found.
 */
function GexBoxStyleSettings({ paletteId, onPreview, onSave, onClose }: {
  paletteId: string;
  onPreview: (id: string) => void;
  onSave: (id: string) => void;
  onClose: () => void;
}) {
  // The palette as it was on open, so Discard is exact.
  const originalRef = useRef(paletteId);
  const [draft, setDraft] = useState(paletteId);
  const [confirming, setConfirming] = useState(false);
  const dirty = draft !== originalRef.current;

  const discard = useCallback(() => {
    onPreview(originalRef.current);
    onClose();
  }, [onClose, onPreview]);

  const attemptClose = useCallback(() => {
    if (!dirty) { onClose(); return; }
    setConfirming(true);
  }, [dirty, onClose]);

  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) attemptClose(); }}>
    <div className="flex h-[min(680px,86vh)] w-[min(760px,94vw)] flex-col border border-border bg-panel shadow-2xl">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[.18em]">Workspace style</h2>
          <p className="mt-0.5 text-[8px] text-muted">Click through the palettes — the workspace previews behind this — then Save</p>
        </div>
        <button onClick={attemptClose} aria-label="Close workspace style"><X className="h-4 w-4 text-muted" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {GEX_MAP_PALETTE_PRESETS.map((preset) => {
            const roles = resolveGexBoxRoles(preset.id);
            const selected = preset.id === draft;
            return <button
              key={preset.id}
              onClick={() => { setDraft(preset.id); onPreview(preset.id); }}
              className={`flex flex-col gap-2 border p-2.5 text-left transition-colors ${selected ? "border-primary/45 bg-primary/[.07]" : "border-border bg-background hover:border-primary/30"}`}
            >
              <span className="flex items-center justify-between">
                <b className="text-[9px] font-semibold uppercase tracking-[.12em] text-foreground">{preset.label}</b>
                {selected ? <span className="text-[7px] uppercase tracking-[.14em] text-primary">Active</span> : null}
              </span>
              <span className="flex h-4 overflow-hidden">
                {roles.scale.map((stop, index) => <i key={`${preset.id}-${index}`} className="h-full flex-1" style={{ backgroundColor: stop }} />)}
              </span>
              <span className="flex items-center gap-2 text-[7px] uppercase tracking-[.12em]">
                <span className="flex items-center gap-1" style={{ color: roles.call }}><i className="h-2 w-2" style={{ backgroundColor: roles.call }} />Call</span>
                <span className="flex items-center gap-1" style={{ color: roles.put }}><i className="h-2 w-2" style={{ backgroundColor: roles.put }} />Put</span>
                <span style={{ color: roles.strike }}>Strike</span>
                <span style={{ color: roles.header }}>Header</span>
              </span>
            </button>;
          })}
        </div>
      </div>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-t border-border px-4">
        <span className="text-[8px] uppercase tracking-[.14em] text-muted">
          {dirty ? "Unsaved palette" : "Saved"}
        </span>
        <span className="flex items-center gap-2">
          <button
            onClick={discard}
            className="flex h-8 items-center border border-border px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-muted hover:text-foreground"
          >
            Discard
          </button>
          <button
            onClick={() => { originalRef.current = draft; onSave(draft); }}
            disabled={!dirty}
            className={`flex h-8 items-center border px-4 text-[9px] font-semibold uppercase tracking-[.12em] ${dirty ? "border-primary/35 bg-primary/10 text-primary" : "border-border text-muted opacity-50"}`}
          >
            Save
          </button>
        </span>
      </div>
    </div>
    {/*
      * Leaving with a palette the trader has not kept. Asked rather than
      * assumed either way: silently saving makes a browse permanent, and
      * silently discarding throws away a deliberate choice.
      */}
    {confirming ? <div className="absolute inset-0 z-[180] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirming(false); }}>
      <div className="w-[min(360px,92vw)] border border-border bg-panel p-5 shadow-2xl">
        <h3 className="text-[10px] font-semibold uppercase tracking-[.16em] text-foreground">Save this palette?</h3>
        <p className="mt-2 text-[9px] leading-4 text-muted">
          The workspace is showing a palette you have not saved. Keep it, or put the previous one back.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={() => setConfirming(false)} className="flex h-8 items-center border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Keep editing</button>
          <button onClick={discard} className="flex h-8 items-center border border-border px-3 text-[9px] uppercase tracking-[.12em] text-muted hover:text-foreground">Discard</button>
          <button onClick={() => { originalRef.current = draft; onSave(draft); }} className="flex h-8 items-center border border-primary/35 bg-primary/10 px-4 text-[9px] font-semibold uppercase tracking-[.12em] text-primary">Save</button>
        </div>
      </div>
    </div> : null}
  </div>;
}

/**
 * Saved GEX BOX workspaces, in the same shape the charts menu uses.
 *
 * Same visuals and the same gestures — Quick Save, Save As, pick one to apply,
 * export, delete — over a separate store, because a GEX BOX workspace and a
 * charts workspace have no fields in common. Keeping the interaction identical
 * is the point; keeping the lists apart is what stops one emptying the other.
 */
function GexBoxWorkspacesMenu({ activeId, snapshotName, onApply, onSave, onImport, onReset, onClose }: {
  activeId: string | null;
  snapshotName: string;
  onApply: (preset: GexBoxWorkspacePreset) => void;
  onSave: (name: string) => { ok: boolean; error?: string };
  onImport: (file: File) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<GexBoxWorkspacePreset[]>([]);
  const [saveAs, setSaveAs] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const refresh = () => setPresets(loadGexBoxWorkspaces());
    refresh();
    window.addEventListener(GEX_BOX_WORKSPACES_EVENT, refresh);
    return () => window.removeEventListener(GEX_BOX_WORKSPACES_EVENT, refresh);
  }, []);

  const commit = (value: string) => {
    const result = onSave(value);
    if (!result.ok) { setStatus(result.error ?? "That could not be saved."); return; }
    setPresets(loadGexBoxWorkspaces());
    setSaveAs(false); setName(""); setStatus(null);
  };

  return <div className="absolute left-1/2 top-9 z-[220] w-[340px] -translate-x-1/2 rounded-2xl border border-border bg-panel p-2 shadow-2xl shadow-black/50">
    <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">GEX BOX workspaces</span>
      <span className="flex items-center gap-1.5 text-[9px] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Saved locally
      </span>
    </div>
    <div className="mb-2 grid grid-cols-2 gap-1.5">
      <button
        type="button"
        onClick={() => commit(activeId ? snapshotName : "GEX BOX")}
        className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-[10px] font-semibold text-background"
      >
        <Save className="h-3.5 w-3.5" />
        Quick Save
      </button>
      <button
        type="button"
        onClick={() => { setSaveAs(true); setStatus(null); }}
        className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-[10px] font-semibold text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Save As
      </button>
    </div>
    <div className="max-h-64 space-y-1 overflow-y-auto">
      {presets.length ? presets.map((preset) => (
        <div key={preset.id} className={`group flex items-center gap-1 rounded-xl ${activeId === preset.id ? "bg-primary/10 ring-1 ring-inset ring-primary/25" : "hover:bg-surface"}`}>
          <button type="button" onClick={() => { onApply(preset); onClose(); }} className="min-w-0 flex-1 px-3 py-2 text-left">
            <div className="truncate text-[12px] font-medium text-foreground">{preset.name}</div>
            <div className="mt-0.5 text-[9px] text-muted">
              {activeId === preset.id ? "Active · " : ""}
              {preset.pages.length} {preset.pages.length === 1 ? "page" : "pages"}
              {preset.updatedAt ? ` · ${new Date(preset.updatedAt).toLocaleDateString()}` : ""}
            </div>
          </button>
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(exportGexBoxWorkspace(preset)).then(() => setStatus(`${preset.name} copied as JSON`)).catch(() => setStatus("Could not copy that workspace.")); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
            aria-label={`Export ${preset.name}`}
            title="Copy this workspace as JSON"
          ><Download className="h-3.5 w-3.5" /></button>
          <button
            type="button"
            onClick={() => { if (window.confirm(`Delete workspace "${preset.name}"?`)) setPresets(deleteGexBoxWorkspace(preset.id)); }}
            className="mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            aria-label={`Delete ${preset.name}`}
          ><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )) : <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[10px] text-muted">No saved workspaces yet</div>}
    </div>
    <div className="mt-2 border-t border-border pt-2">
      {saveAs ? <div className="mb-2 flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") commit(name); if (event.key === "Escape") setSaveAs(false); }}
          placeholder="Workspace name"
          className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[10px] text-foreground outline-none focus:border-primary/40"
        />
        <button type="button" onClick={() => commit(name)} className="h-8 rounded-lg bg-primary px-3 text-[9px] font-semibold uppercase text-background">Save</button>
      </div> : null}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-[9px] font-semibold uppercase tracking-[.1em] text-muted hover:text-foreground"
      >
        <FileUp className="h-3.5 w-3.5" />
        Import workspace
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ""; }}
      />
      <button
        type="button"
        onClick={() => { if (window.confirm("Reset this workspace to the standard layout?")) { onReset(); onClose(); } }}
        className="mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-[9px] font-semibold uppercase tracking-[.1em] text-muted hover:text-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reset to standard
      </button>
      {status ? <div className="mt-2 text-[9px] text-primary" role="status">{status}</div> : null}
    </div>
  </div>;
}

function defaultWorkspace(): DashboardWorkspace {
  const panel = (toolId: string, symbol: string): DashboardPanel => ({ id: makeId("panel"), toolId, title: toolById.get(toolId)?.label ?? toolId, settings: { ...DEFAULT_SETTINGS, symbol } });
  const id = makeId("page");
  return { schemaVersion: 2, name: "GEX BOX STANDARD", activePageId: id, pages: [{ id, name: "Dashboard", layout: "grid", panels: [panel("interval-map", "SPY"), panel("exposure-strike", "SPX"), panel("consolidated-flow", "SPX"), panel("dark-pool-levels", "SPY")] }] };
}

type FeedState = { data: unknown; error: string | null; loading: boolean; updatedAt: number };
const feedCache = new Map<string, FeedState>();
const feedSubscribers = new Map<string, Set<(state: FeedState) => void>>();
const feedInflight = new Map<string, Promise<void>>();
const feedTimers = new Map<string, number>();
function refreshIntervalFor(url: string, data?: unknown) {
  const payload = record(data);
  const providerInterval = finite(payload?.refreshAfterMs);
  const mode = String(payload?.snapshotMode ?? payload?.status ?? "").toLowerCase();
  const completed = payload?.marketOpen === false || mode.includes("historical") || mode.includes("completed") || mode.includes("last_session");
  if (completed) return 5 * 60_000;
  if (providerInterval !== null) return Math.max(5_000, Math.min(60_000, providerInterval));
  if (url.includes("sessionDate=")) return 60_000;
  if (url.includes("/api/gex-box/")) return 3_000;
  if (url.includes("/api/gex-interval-map")) return 5_000;
  if (url.includes("/api/options-flow")) return 5_000;
  if (url.includes("/api/dark-pool-map")) return 5_000;
  return 15_000;
}
async function refreshFeed(url: string) {
  if (!url || feedInflight.has(url)) return feedInflight.get(url);
  const prior = feedCache.get(url) ?? { data: null, error: null, loading: true, updatedAt: 0 };
  if (!prior.data) {
    const loading = { ...prior, loading: true };
    feedCache.set(url, loading); feedSubscribers.get(url)?.forEach((fn) => fn(loading));
  }
  const request = fetch(url, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? `Request failed (${response.status})`);
    const state = { data: payload, error: null, loading: false, updatedAt: Date.now() };
    feedCache.set(url, state); feedSubscribers.get(url)?.forEach((fn) => fn(state));
  }).catch((error) => {
    const state = { data: prior.data, error: error instanceof Error ? error.message : "Request failed", loading: false, updatedAt: prior.updatedAt };
    feedCache.set(url, state); feedSubscribers.get(url)?.forEach((fn) => fn(state));
  }).finally(() => {
    feedInflight.delete(url);
    const existing = feedTimers.get(url);
    if (existing !== undefined) window.clearTimeout(existing);
    if (feedSubscribers.get(url)?.size) {
      const timer = window.setTimeout(() => void refreshFeed(url), refreshIntervalFor(url, feedCache.get(url)?.data));
      feedTimers.set(url, timer);
    }
  });
  feedInflight.set(url, request); return request;
}

function useSharedFeed(url: string | null) {
  const [state, setState] = useState<FeedState>(() => url ? feedCache.get(url) ?? { data: null, error: null, loading: true, updatedAt: 0 } : { data: null, error: null, loading: false, updatedAt: 0 });
  useEffect(() => {
    if (!url) return;
    const listeners = feedSubscribers.get(url) ?? new Set(); listeners.add(setState); feedSubscribers.set(url, listeners);
    setState(feedCache.get(url) ?? { data: null, error: null, loading: true, updatedAt: 0 }); void refreshFeed(url);
    return () => {
      listeners.delete(setState);
      if (!listeners.size) {
        feedSubscribers.delete(url);
        const timer = feedTimers.get(url);
        if (timer !== undefined) window.clearTimeout(timer);
        feedTimers.delete(url);
      }
    };
  }, [url]);
  return { ...state, refresh: () => url ? refreshFeed(url) : Promise.resolve() };
}

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function finite(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function compact(value: number) { const abs = Math.abs(value); return `${value < 0 ? "−" : ""}${abs >= 1e9 ? `${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(2)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(1)}K` : abs.toFixed(0)}`; }
function dollars(value: number) { return `${value < 0 ? "−" : ""}$${compact(Math.abs(value))}`; }
function whole(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value); }
function price(value: number) { return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
function ageLabel(timestamp: number | null) {
  if (!timestamp) return "awaiting update";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3_600)}h ago`;
}

function collectRows(value: unknown, maxRows = 200): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const visit = (entry: unknown, depth: number) => {
    if (rows.length >= maxRows || depth > 5 || entry == null) return;
    if (Array.isArray(entry)) {
      for (const child of entry) { visit(child, depth + 1); if (rows.length >= maxRows) break; }
      return;
    }
    const item = record(entry); if (!item) return;
    for (const key of ["rows", "snapshots", "candles", "trades", "board", "data"]) {
      if (Array.isArray(item[key])) { visit(item[key], depth + 1); if (rows.length) return; }
    }
    const keys = Object.keys(item).map((key) => key.toLowerCase());
    if (keys.some((key) => ["price", "strike", "contract", "premium", "notionalvalue", "netexposure"].includes(key))) { rows.push(item); return; }
    const scalarCells = Object.values(item).filter((child) => child === null || ["string", "number", "boolean"].includes(typeof child));
    if (scalarCells.length >= 2) { rows.push(item); return; }
    for (const child of Object.values(item)) { visit(child, depth + 1); if (rows.length >= maxRows) break; }
  };
  visit(value, 0);
  return rows;
}

function IntervalCanvas({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const drawStateRef = useRef({ payload, settings });
  drawStateRef.current = { payload, settings };
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const container = canvas.parentElement; if (!container) return;
    const draw = () => {
      const { payload, settings } = drawStateRef.current;
      const surface = record(payload); const buckets = Array.isArray(surface?.buckets) ? surface.buckets : [];
      const rect = container.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, rect.width, rect.height);
      const styles = getComputedStyle(container);
      const resolveColor = (value: string, fallback: string) => {
        const variable = value.match(/^var\((--[^)]+)\)$/)?.[1];
        return (variable ? styles.getPropertyValue(variable) : value).trim() || styles.getPropertyValue(fallback).trim() || "#ffffff";
      };
      const positive = resolveColor(settings.color, "--primary");
      const negative = resolveColor(settings.negativeColor, "--danger");
      const border = styles.getPropertyValue("--border").trim() || "#30343b";
      const foreground = styles.getPropertyValue("--foreground").trim() || "#ffffff";
      const muted = styles.getPropertyValue("--muted").trim() || "#8b919c";
      const rows = buckets.flatMap((raw, bucketIndex) => { const bucket = record(raw); return Array.isArray(bucket?.rows) ? bucket.rows.map((row) => ({ row: record(row), bucketIndex, price: finite(bucket?.sourcePrice) })) : []; }).filter((entry) => entry.row);
      const strikes = rows.map((entry) => finite(entry.row?.sourceStrike)).filter((v): v is number => v !== null); if (!strikes.length || !buckets.length) return;
      const min = Math.min(...strikes), max = Math.max(...strikes), span = Math.max(1, max - min); const left = 12, right = 52, top = 14, bottom = 24;
      ctx.save(); ctx.globalAlpha = .65; ctx.strokeStyle = border; ctx.lineWidth = .5;
      for (let index = 0; index <= 6; index++) { const y = top + index * (rect.height - top - bottom) / 6; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(rect.width - right, y); ctx.stroke(); }
      ctx.restore();
      const magnitudes = rows.map((entry) => Math.abs((finite(entry.row?.callExposure) ?? 0) + (finite(entry.row?.putExposure) ?? 0))); const peak = Math.max(1, ...magnitudes);
      rows.forEach((entry) => { const strike = finite(entry.row?.sourceStrike)!; const net = (finite(entry.row?.callExposure) ?? 0) + (finite(entry.row?.putExposure) ?? 0); if (Math.abs(net) < settings.minimum) return; const x = left + entry.bucketIndex * (rect.width - left - right) / Math.max(1, buckets.length - 1); const y = top + (max - strike) / span * (rect.height - top - bottom); const radius = 1.4 + Math.sqrt(Math.abs(net) / peak) * 9; const nodeColor = net >= 0 ? positive : negative; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.save(); ctx.globalAlpha = .3; ctx.fillStyle = nodeColor; ctx.fill(); ctx.restore(); ctx.strokeStyle = nodeColor; ctx.lineWidth = 1; ctx.stroke(); });
      const priceByBucket = new Map<number, number>();
      rows.forEach((entry) => { if (entry.price !== null && !priceByBucket.has(entry.bucketIndex)) priceByBucket.set(entry.bucketIndex, entry.price); });
      const prices = [...priceByBucket].map(([bucketIndex, bucketPrice]) => ({ bucketIndex, price: bucketPrice })); if (prices.length > 1) { const p = prices.map((entry) => entry.price); const pMin = Math.min(...p), pMax = Math.max(...p), pSpan = Math.max(.01, pMax - pMin); ctx.beginPath(); prices.forEach((entry, index) => { const x = left + entry.bucketIndex * (rect.width - left - right) / Math.max(1, buckets.length - 1); const y = top + (pMax - entry.price) / pSpan * (rect.height - top - bottom); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = foreground; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.fillStyle = muted; ctx.font = "10px JetBrains Mono"; ctx.fillText(max.toFixed(0), rect.width - right + 7, top + 4); ctx.fillText(min.toFixed(0), rect.width - right + 7, rect.height - bottom);
    };
    let frame = 0;
    const scheduleDraw = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(draw); };
    drawRef.current = scheduleDraw;
    scheduleDraw();
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(container);
    return () => {
      if (drawRef.current === scheduleDraw) drawRef.current = null;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => { drawRef.current?.(); }, [payload, settings.color, settings.minimum, settings.negativeColor]);
  return <canvas ref={ref} className="block h-full w-full" />;
}

type IntervalPoint = { bucketIndex: number; timestamp: number; strike: number; call: number; put: number; value: number; expiration: string; sourcePrice: number | null; exposureSide: "net" | "call" | "put" };
function intervalValue(call: number, put: number, content: PanelSettings["intervalContent"]) {
  if (content === "call") return call; if (content === "put") return put; if (content === "gross") return Math.abs(call) + Math.abs(put); return call + put;
}

function ProfessionalIntervalMap({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const pointsOnScreen = useRef<Array<IntervalPoint & { x: number; y: number; radius: number }>>([]);
  const drawRef = useRef<(() => void) | null>(null);
  // The map navigates like a chart: drag the plot to pan both ways, drag the
  // strike scale on the right to stretch it, drag the time axis along the
  // bottom to stretch that. `strikeCentre` is null until the view is moved so
  // the map keeps auto-fitting to the data until somebody takes hold of it.
  const drag = useRef<
    | { mode: "pan"; x: number; y: number; offset: number; centre: number | null; span: number }
    | { mode: "strike-scale"; y: number; zoom: number }
    | { mode: "time-scale"; x: number; zoom: number }
    | null
  >(null);
  const [viewport, setViewport] = useState<{ zoom: number; offset: number; strikeZoom: number; strikeCentre: number | null }>(
    { zoom: 1, offset: 0, strikeZoom: 1, strikeCentre: null },
  );
  const [hover, setHover] = useState<(IntervalPoint & { x: number; y: number }) | null>(null);
  const PLOT_RIGHT_GUTTER = 68, PLOT_BOTTOM_GUTTER = 27;
  const model = useMemo(() => {
    const surface = record(payload); const rawBuckets = Array.isArray(surface?.buckets) ? surface.buckets : [];
    const previous = new Map<string, number>(); const sessionOpen = new Map<string, number>(); const rolling = new Map<string, number[]>(); const points: IntervalPoint[] = []; const prices: Array<{ bucketIndex: number; timestamp: number; price: number }> = [];
    rawBuckets.forEach((entry, bucketIndex) => {
      const bucket = record(entry); if (!bucket) return; const timestamp = finite(valueAt(bucket, "timestamp", "timestampMs", "time")) ?? bucketIndex; const sourcePrice = finite(valueAt(bucket, "sourcePrice", "price", "underlyingPrice")); if (sourcePrice !== null) prices.push({ bucketIndex, timestamp, price: sourcePrice });
      const rows = (Array.isArray(bucket.rows) ? bucket.rows.map(record).filter((row): row is Record<string, unknown> => Boolean(row)) : [])
        .filter((row) => { const strike = finite(valueAt(row, "sourceStrike", "strike")); if (strike === null) return false; if (sourcePrice === null || settings.intervalMaximumDistance <= 0) return true; return Math.abs(strike - sourcePrice) / Math.max(1, sourcePrice) * 100 <= settings.intervalMaximumDistance; })
        .sort((left, right) => { const a = finite(valueAt(left, "sourceStrike", "strike")) ?? 0; const b = finite(valueAt(right, "sourceStrike", "strike")) ?? 0; return sourcePrice === null ? a - b : Math.abs(a - sourcePrice) - Math.abs(b - sourcePrice); })
        .slice(0, Math.max(1, settings.strikes) * 2 + 1);
      rows.forEach((row) => { const strike = finite(valueAt(row, "sourceStrike", "strike")); if (strike === null) return; const expiration = String(valueAt(row, "expirationDate", "expiration", "expiry") ?? "ALL"); if (settings.expiry !== "ALL" && settings.expiry !== "FRONT" && !expiration.includes(settings.expiry)) return;
        const call = finite(valueAt(row, "callExposure", "call")) ?? 0; const put = finite(valueAt(row, "putExposure", "put")) ?? 0;
        const values: Array<{ exposureSide: IntervalPoint["exposureSide"]; rawValue: number }> = settings.intervalContent === "call-put-split"
          ? [{ exposureSide: "call", rawValue: call }, { exposureSide: "put", rawValue: put }]
          : [{ exposureSide: "net", rawValue: intervalValue(call, put, settings.intervalContent) }];
        values.forEach(({ exposureSide, rawValue }) => { const key = `${exposureSide}:${expiration}:${strike}`; let value = rawValue;
          if (settings.intervalMode === "difference") { const history = rolling.get(key) ?? []; const baseline = settings.intervalBaseline === "session-open" ? sessionOpen.get(key) : settings.intervalBaseline === "rolling-average" && history.length ? history.reduce((sum, item) => sum + item, 0) / history.length : previous.get(key); value = baseline === undefined ? 0 : rawValue - baseline; history.push(rawValue); if (history.length > settings.intervalRollingBuckets) history.shift(); rolling.set(key, history); }
          if (!sessionOpen.has(key)) sessionOpen.set(key, rawValue); previous.set(key, rawValue); if (Math.abs(value) >= settings.minimum) points.push({ bucketIndex, timestamp, strike, call, put, value, expiration, sourcePrice, exposureSide });
        });
      });
    });
    const trimmed = points.length > settings.intervalMaximumPoints ? points.slice(-settings.intervalMaximumPoints) : points; const strikes = trimmed.map((point) => point.strike); const peak = Math.max(1, ...trimmed.map((point) => Math.abs(point.value)));
    return { buckets: rawBuckets.length, points: trimmed, prices, minStrike: strikes.length ? Math.min(...strikes) : 0, maxStrike: strikes.length ? Math.max(...strikes) : 1, peak };
  }, [payload, settings.expiry, settings.intervalBaseline, settings.intervalContent, settings.intervalMaximumDistance, settings.intervalMaximumPoints, settings.intervalMode, settings.intervalRollingBuckets, settings.minimum, settings.strikes]);
  const drawStateRef = useRef({ model, settings, viewport });
  drawStateRef.current = { model, settings, viewport };
  const hasRenderablePoints = model.points.length > 0;
  useEffect(() => {
    const canvas = canvasRef.current; const container = canvas?.parentElement; if (!canvas || !container) return;
    const draw = () => {
      const { model, settings, viewport } = drawStateRef.current;
      const rect = container.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
      const styles = getComputedStyle(container); const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback; const resolve = (value: string, fallback: string) => value.startsWith("var(") ? css(value.slice(4, -1), fallback) : value;
      const positive = resolve(settings.color, "#aaff00"), negative = resolve(settings.negativeColor, "#ff3366"), grid = css("--border", "#2c3138"), foreground = css("--foreground", "#fff"), muted = css("--muted", "#89909a");
      const left = 10, right = 68, top = 8, bottom = 27, plotWidth = Math.max(1, rect.width - left - right), plotHeight = Math.max(1, rect.height - top - bottom); const visibleBuckets = Math.max(8, model.buckets / viewport.zoom); const maxOffset = Math.max(0, model.buckets - visibleBuckets); const start = Math.max(0, Math.min(maxOffset, viewport.offset)); const end = start + visibleBuckets; const span = Math.max(.0001, model.maxStrike - model.minStrike);
      const xFor = (index: number) => left + (index - start) / visibleBuckets * plotWidth;
      // The strike axis is a viewport too, not a fixed fit to the data.
      const strikeSpan = Math.max(.0001, span / Math.max(.05, viewport.strikeZoom));
      const strikeCentre = viewport.strikeCentre ?? (model.maxStrike + model.minStrike) / 2;
      const viewHigh = strikeCentre + strikeSpan / 2;
      const yFor = (strike: number) => top + (viewHigh - strike) / strikeSpan * plotHeight;
      ctx.save(); ctx.strokeStyle = grid; ctx.globalAlpha = .7; ctx.lineWidth = .5; ctx.font = "9px JetBrains Mono"; ctx.fillStyle = muted;
      for (let i = 0; i <= 6; i++) { const y = top + i * plotHeight / 6; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotWidth, y); ctx.stroke(); const strike = viewHigh - i * strikeSpan / 6; ctx.fillText(strike.toFixed(strike < 1000 ? 1 : 0), left + plotWidth + 7, y + 3); }
      for (let i = 0; i <= 6; i++) { const x = left + i * plotWidth / 6; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + plotHeight); ctx.stroke(); const bucket = Math.round(start + i * visibleBuckets / 6); const point = model.points.find((item) => item.bucketIndex >= bucket); if (point) ctx.fillText(timeCell(point.timestamp), Math.max(left, x - 23), rect.height - 7); } ctx.restore();
      const visible = model.points.filter((point) => point.bucketIndex >= start && point.bucketIndex <= end); const cellWidth = Math.max(2, plotWidth / visibleBuckets); const strikeStep = span / Math.max(1, Math.min(80, new Set(visible.map((point) => point.strike)).size)); const cellHeight = Math.max(2, plotHeight * strikeStep / strikeSpan); const screen: Array<IntervalPoint & { x: number; y: number; radius: number }> = [];
      visible.forEach((point) => { const splitOffset = point.exposureSide === "call" ? -2.5 : point.exposureSide === "put" ? 2.5 : 0; const x = xFor(point.bucketIndex) + splitOffset, y = yFor(point.strike), ratio = Math.min(1, Math.sqrt(Math.abs(point.value) / model.peak)), color = point.exposureSide === "call" ? positive : point.exposureSide === "put" ? negative : point.value >= 0 ? positive : negative; const radius = settings.intervalVisual === "fixed-dots" ? 3 : 1.5 + ratio * 10; ctx.save();
        if (settings.intervalVisual === "heat-cells" || settings.intervalVisual === "hybrid") { ctx.globalAlpha = .12 + ratio * .55; ctx.fillStyle = color; ctx.fillRect(x - cellWidth / 2, y - cellHeight / 2, Math.max(1, cellWidth), Math.max(1, cellHeight)); }
        if (settings.intervalVisual === "horizontal-ribbons") { ctx.globalAlpha = .14 + ratio * .62; ctx.fillStyle = color; ctx.fillRect(x - cellWidth / 2, y - Math.max(1, ratio * 7), cellWidth * 1.3, Math.max(2, ratio * 14)); }
        if (["bubbles", "fixed-dots", "hybrid"].includes(settings.intervalVisual)) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.globalAlpha = .1 + ratio * .32; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = .5 + ratio * .5; ctx.strokeStyle = color; ctx.lineWidth = .7 + ratio; ctx.stroke(); }
        ctx.restore(); screen.push({ ...point, x, y, radius });
      }); pointsOnScreen.current = screen;
      if (settings.intervalShowPrice && model.prices.length > 1) {
        const visiblePrices = model.prices.filter((item) => item.bucketIndex >= start && item.bucketIndex <= end);
        // The underlying rides the STRIKE axis, so price and strikes read
        // against one scale. It used to be normalised to its own visible
        // min/max, which drew the line through the middle of the map wherever
        // the market actually was and made it impossible to see which strikes
        // price was sitting on.
        if (settings.intervalPriceStyle === "candles" && visiblePrices.length > 1) {
          const per = Math.max(1, Math.round(settings.intervalCandleBuckets));
          const candles: Array<{ index: number; open: number; high: number; low: number; close: number }> = [];
          for (let i = 0; i < visiblePrices.length; i += per) {
            const slice = visiblePrices.slice(i, i + per);
            if (!slice.length) continue;
            const closes = slice.map((item) => item.price);
            candles.push({
              index: slice[Math.floor(slice.length / 2)].bucketIndex,
              open: closes[0], close: closes[closes.length - 1],
              high: Math.max(...closes), low: Math.min(...closes),
            });
          }
          const bodyWidth = Math.max(1.5, plotWidth / Math.max(1, candles.length) * .6);
          candles.forEach((candle) => {
            const x = xFor(candle.index), up = candle.close >= candle.open;
            ctx.globalAlpha = .95; ctx.strokeStyle = up ? positive : negative; ctx.fillStyle = up ? positive : negative; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, yFor(candle.high)); ctx.lineTo(x, yFor(candle.low)); ctx.stroke();
            const openY = yFor(candle.open), closeY = yFor(candle.close);
            ctx.fillRect(x - bodyWidth / 2, Math.min(openY, closeY), bodyWidth, Math.max(1, Math.abs(closeY - openY)));
          });
          ctx.globalAlpha = 1;
        } else {
          ctx.beginPath();
          visiblePrices.forEach((item, index) => { const x = xFor(item.bucketIndex), y = yFor(item.price); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.strokeStyle = foreground; ctx.lineWidth = 1.35; ctx.globalAlpha = .9; ctx.stroke(); ctx.globalAlpha = 1;
        }
      }
    };
    let frame = 0;
    const scheduleDraw = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(draw);
    };
    drawRef.current = scheduleDraw;
    scheduleDraw();
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(container);
    return () => {
      if (drawRef.current === scheduleDraw) drawRef.current = null;
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  // Live interval frames repaint this mounted canvas through drawStateRef. They
  // must not recreate the ResizeObserver and animation-frame closure.
  }, [hasRenderablePoints]);
  useEffect(() => {
    drawRef.current?.();
  }, [model, settings.color, settings.intervalCandleBuckets, settings.intervalPriceStyle, settings.intervalShowPrice, settings.intervalVisual, settings.negativeColor, viewport]);
  if (!model.points.length) return <NoRows />;
  const clampOffset = (value: number, zoom: number) =>
    Math.max(0, Math.min(Math.max(0, model.buckets - Math.max(8, model.buckets / zoom)), value));
  const currentStrikeSpan = () =>
    Math.max(.0001, (model.maxStrike - model.minStrike) / Math.max(.05, viewport.strikeZoom));
  const currentStrikeCentre = () =>
    viewport.strikeCentre ?? (model.maxStrike + model.minStrike) / 2;

  return <div
    className="relative h-full min-h-0 overflow-hidden"
    onWheel={(event) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const overStrikeScale = event.clientX - rect.left > rect.width - PLOT_RIGHT_GUTTER;
      const direction = event.deltaY < 0 ? 1.22 : .82;
      // Over the strike scale, or with shift held, the wheel stretches price
      // instead of time — the two axes a chart lets you zoom separately.
      setViewport((current) => (overStrikeScale || event.shiftKey
        ? { ...current, strikeZoom: Math.max(.2, Math.min(40, current.strikeZoom * direction)) }
        : { ...current, zoom: Math.max(1, Math.min(20, current.zoom * direction)) }));
    }}
    onDoubleClick={() => setViewport({ zoom: 1, offset: 0, strikeZoom: 1, strikeCentre: null })}
    onPointerDown={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (x > rect.width - PLOT_RIGHT_GUTTER) {
        drag.current = { mode: "strike-scale", y: event.clientY, zoom: viewport.strikeZoom };
      } else if (y > rect.height - PLOT_BOTTOM_GUTTER) {
        drag.current = { mode: "time-scale", x: event.clientX, zoom: viewport.zoom };
      } else {
        drag.current = {
          mode: "pan", x: event.clientX, y: event.clientY,
          offset: viewport.offset, centre: viewport.strikeCentre, span: currentStrikeSpan(),
        };
      }
    }}
    onPointerMove={(event) => {
      const held = drag.current;
      const rect = event.currentTarget.getBoundingClientRect();
      if (held?.mode === "strike-scale") {
        // Dragging a price scale down compresses it and up stretches it, the
        // same direction a chart's own scale moves.
        const travel = (event.clientY - held.y) / Math.max(1, rect.height);
        setViewport((current) => ({ ...current, strikeZoom: Math.max(.2, Math.min(40, held.zoom * Math.exp(-travel * 2.2))) }));
        return;
      }
      if (held?.mode === "time-scale") {
        const travel = (event.clientX - held.x) / Math.max(1, rect.width);
        setViewport((current) => {
          const zoom = Math.max(1, Math.min(20, held.zoom * Math.exp(travel * 2.2)));
          return { ...current, zoom, offset: clampOffset(current.offset, zoom) };
        });
        return;
      }
      if (held?.mode === "pan") {
        const width = Math.max(1, rect.width - PLOT_RIGHT_GUTTER - 10);
        const height = Math.max(1, rect.height - PLOT_BOTTOM_GUTTER - 8);
        const visible = Math.max(8, model.buckets / viewport.zoom);
        const centre = held.centre ?? (model.maxStrike + model.minStrike) / 2;
        setViewport((current) => ({
          ...current,
          offset: clampOffset(held.offset - (event.clientX - held.x) / width * visible, current.zoom),
          // Dragging DOWN moves the view down the price axis, so the content
          // follows the hand exactly as candles do.
          strikeCentre: centre + (event.clientY - held.y) / height * held.span,
        }));
        return;
      }
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      let nearest: typeof pointsOnScreen.current[number] | null = null, distance = 18;
      pointsOnScreen.current.forEach((point) => { const next = Math.hypot(point.x - x, point.y - y); if (next < distance) { distance = next; nearest = point; } });
      setHover(nearest);
    }}
    onPointerUp={() => { drag.current = null; }}
    onPointerLeave={() => { drag.current = null; setHover(null); }}
  >
    <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" />
    <button
      onClick={(event) => { event.stopPropagation(); setViewport({ zoom: 1, offset: 0, strikeZoom: 1, strikeCentre: null }); }}
      className="absolute right-2 top-2 z-20 border border-border bg-panel/90 px-2 py-1 text-[8px] uppercase text-muted hover:text-primary"
    >Reset view</button>
    {hover ? <div className="pointer-events-none absolute z-20 min-w-44 border border-border bg-panel/95 p-2 font-mono text-[8px] shadow-xl" style={{ left: Math.min(hover.x + 12, Math.max(4, (canvasRef.current?.clientWidth ?? 240) - 190)), top: Math.max(4, hover.y - 66) }}><div className="mb-1 text-foreground">{timeCell(hover.timestamp)} · {hover.expiration}</div><div className="flex justify-between text-muted"><span>Strike</span><b className="text-foreground">{price(hover.strike)}</b></div><div className="flex justify-between text-muted"><span>Underlying</span><b className="text-foreground">{hover.sourcePrice === null ? "—" : price(hover.sourcePrice)}</b></div><div className="flex justify-between text-muted"><span>Call / Put</span><b className="text-foreground">{compact(hover.call)} / {compact(hover.put)}</b></div><div className="flex justify-between text-muted"><span>{settings.intervalMode === "difference" ? "Change" : settings.intervalContent}</span><b className={hover.value >= 0 ? "text-primary" : "text-danger"}>{compact(hover.value)}</b></div></div> : null}
  </div>;
}
function ExposureHeatMap({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const surface = record(payload); const buckets = Array.isArray(surface?.buckets) ? surface.buckets : []; const latest = record(buckets.at(-1)); const rows = Array.isArray(latest?.rows) ? latest.rows.map(record).filter((row): row is Record<string, unknown> => Boolean(row)) : [];
  const expirations = [...new Set(rows.map((row) => String(valueAt(row, "expirationDate", "expiration", "expiry") ?? "ALL")))].slice(0, 14); const strikes = [...new Set(rows.map((row) => finite(valueAt(row, "sourceStrike", "strike"))).filter((value): value is number => value !== null))].sort((a, b) => b - a).slice(0, settings.rows); const values = rows.map((row) => intervalValue(finite(valueAt(row, "callExposure", "call")) ?? 0, finite(valueAt(row, "putExposure", "put")) ?? 0, settings.intervalContent)); const peak = Math.max(1, ...values.map(Math.abs));
  if (!rows.length) return <NoRows />;
  return <div className="h-full overflow-auto"><table className="min-w-max border-collapse text-[8px] font-mono"><thead className="sticky top-0 z-10 bg-panel"><tr><th data-gexbox-role="strike" className="sticky left-0 z-20 border border-border bg-panel px-2 py-2">Strike</th>{expirations.map((expiry) => <th key={expiry} className="border border-border px-3 py-2 text-muted">{expiry}</th>)}</tr></thead><tbody>{strikes.map((strike) => <tr key={strike}><th data-gexbox-role="strike" className="sticky left-0 z-10 border border-border bg-panel px-2 py-1.5">{price(strike)}</th>{expirations.map((expiry) => { const row = rows.find((item) => finite(valueAt(item, "sourceStrike", "strike")) === strike && String(valueAt(item, "expirationDate", "expiration", "expiry") ?? "ALL") === expiry); const value = row ? intervalValue(finite(valueAt(row, "callExposure", "call")) ?? 0, finite(valueAt(row, "putExposure", "put")) ?? 0, settings.intervalContent) : 0; const ratio = Math.min(1, Math.abs(value) / peak); return <td key={expiry} title={`${expiry} · ${price(strike)} · ${compact(value)}`} className="min-w-24 border border-border px-2 py-1.5 text-right" style={{ color: value >= 0 ? settings.color : settings.negativeColor, background: `color-mix(in srgb, ${value >= 0 ? settings.color : settings.negativeColor} ${Math.round(8 + ratio * 62)}%, transparent)` }}>{compact(value)}</td>; })}</tr>)}</tbody></table></div>;
}

function ProfileBars({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const { rows, peak } = useMemo(() => {
    const root = record(payload); const frame = record(root?.frame) ?? record(record(root?.provider)?.frame); const strikesRaw = Array.isArray(frame?.strikes) ? frame.strikes : [];
    const normalizedRaw = Array.isArray(root?.rows) ? root.rows : [];
    const nativeRows = strikesRaw.map((entry) => Array.isArray(entry) ? { strike: finite(entry[0]), positive: Math.max(0, finite(entry[1]) ?? 0), negative: Math.min(0, finite(entry[2]) ?? 0) } : null);
    const normalizedRows = normalizedRaw.map((entry) => {
      const row = record(entry); if (!row) return null;
      const callOi = finite(row.callOpenInterest); const putOi = finite(row.putOpenInterest);
      if (callOi !== null || putOi !== null) return { strike: finite(row.strike), positive: Math.max(0, callOi ?? 0), negative: -Math.max(0, putOi ?? 0) };
      const call = finite(row.call) ?? 0; const put = finite(row.put) ?? 0; const net = finite(row.net) ?? call + put;
      return { strike: finite(row.strike), positive: Math.max(0, net), negative: Math.min(0, net) };
    });
    const rows = [...nativeRows, ...normalizedRows].filter((entry): entry is { strike: number; positive: number; negative: number } => entry?.strike !== null && entry?.strike !== undefined).sort((a, b) => a.strike - b.strike).slice(-90);
    return { rows, peak: Math.max(1, ...rows.flatMap((row) => [Math.abs(row.positive), Math.abs(row.negative)])) };
  }, [payload]);
  const positiveTotal = rows.reduce((sum, row) => sum + row.positive, 0), negativeTotal = rows.reduce((sum, row) => sum + row.negative, 0); const strongest = rows.reduce((best, row) => Math.max(Math.abs(row.positive), Math.abs(row.negative)) > Math.max(Math.abs(best.positive), Math.abs(best.negative)) ? row : best, rows[0] ?? { strike: 0, positive: 0, negative: 0 });
  return <div className="flex h-full min-h-0 flex-col"><div className="grid shrink-0 grid-cols-4 border-b border-border bg-panel"><Metric label="Greek" value={settings.greek} accent /><Metric label="Positive" value={compact(positiveTotal)} /><Metric label="Negative" value={compact(negativeTotal)} /><Metric label="Largest strike" value={price(strongest.strike)} /></div><div className="grid h-7 shrink-0 grid-cols-[1fr_70px_1fr] items-center gap-2 border-b border-border px-2 text-[7px] font-semibold uppercase tracking-[.13em] text-muted"><span className="text-right">Put / negative</span><span className="text-center">Strike</span><span>Call / positive</span></div><div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">{rows.length ? rows.map((row) => <div key={row.strike} className="grid h-6 grid-cols-[1fr_70px_1fr] items-center gap-2 border-b border-border/30 text-[8px] font-mono"><div className="relative flex h-3 justify-end"><span className="absolute right-0 top-0 h-full opacity-60" title={`Negative ${compact(row.negative)}`} style={{ backgroundColor: settings.negativeColor, width: `${Math.max(1, Math.abs(row.negative) / peak * 100)}%` }} /><span className="relative z-10 self-center pr-1 text-foreground/85">{row.negative ? compact(row.negative) : ""}</span></div><span data-gexbox-role="strike" className="text-center">{price(row.strike)}</span><div className="relative flex h-3"><span className="absolute left-0 top-0 h-full opacity-60" title={`Positive ${compact(row.positive)}`} style={{ backgroundColor: settings.color, width: `${Math.max(1, Math.abs(row.positive) / peak * 100)}%` }} /><span className="relative z-10 self-center pl-1 text-foreground/85">{row.positive ? compact(row.positive) : ""}</span></div></div>) : <NoRows />}</div></div>;
}

type DarkPoolLevelRow = {
  id: string;
  levelPrice: number;
  totalNotional: number;
  totalShares: number;
  tradeCount: number;
  sessionCount: number;
  strengthScore: number;
  askSideNotional: number;
  bidSideNotional: number;
  midMarketNotional: number;
  unknownSideNotional: number;
  lastPrintTimeMs: number | null;
  isZoneMember: boolean;
};

function darkPoolLevels(payload: unknown): DarkPoolLevelRow[] {
  const root = record(payload);
  const raw = Array.isArray(root?.levels) ? root.levels : [];
  return raw.flatMap((entry, index) => {
    const row = record(entry); if (!row) return [];
    const levelPrice = finite(row.mappedPrice) ?? finite(row.sourcePrice);
    const totalNotional = finite(row.totalNotional);
    if (levelPrice === null || totalNotional === null) return [];
    return [{
      id: String(row.id ?? `${levelPrice}-${index}`), levelPrice, totalNotional,
      totalShares: finite(row.totalShares) ?? 0, tradeCount: finite(row.tradeCount) ?? 0,
      sessionCount: finite(row.sessionCount) ?? 0, strengthScore: finite(row.strengthScore) ?? 0,
      askSideNotional: finite(row.askSideNotional) ?? 0, bidSideNotional: finite(row.bidSideNotional) ?? 0,
      midMarketNotional: finite(row.midMarketNotional) ?? 0, unknownSideNotional: finite(row.unknownSideNotional) ?? 0,
      lastPrintTimeMs: finite(row.lastPrintTimeMs), isZoneMember: Boolean(row.isZoneMember),
    }];
  }).sort((a, b) => b.totalNotional - a.totalNotional);
}

function DarkPoolLevelsPanel({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const root = record(payload); const baseline = record(root?.baseline);
  const latestPrice = finite(baseline?.latestStockPrice);
  const checkedAt = finite(root?.checkedAtMs); const status = String(root?.status ?? "unknown");
  const levels = useMemo(() => darkPoolLevels(payload).filter((row) => row.totalNotional >= settings.minimum).slice(0, settings.rows), [payload, settings.minimum, settings.rows]);
  const peak = Math.max(1, ...levels.map((row) => row.totalNotional));
  const total = levels.reduce((sum, row) => sum + row.totalNotional, 0);
  const nearestId = latestPrice === null || !levels.length ? null : levels.reduce((nearest, row) => Math.abs(row.levelPrice - latestPrice) < Math.abs(nearest.levelPrice - latestPrice) ? row : nearest).id;
  if (!levels.length) return <NoRows />;
  return <div className="flex h-full min-h-0 flex-col bg-background">
    <div className="grid shrink-0 grid-cols-2 border-b border-border bg-panel sm:grid-cols-4">
      <Metric label="Underlying" value={latestPrice === null ? "—" : price(latestPrice)} />
      <Metric label="Tracked notional" value={dollars(total)} />
      <Metric label="Ranked levels" value={whole(levels.length)} />
      <Metric label={status === "live" ? "Live QuantData" : status} value={ageLabel(checkedAt)} accent={status === "live"} />
    </div>
    <div className="grid h-8 shrink-0 grid-cols-[74px_minmax(110px,1fr)_70px_58px_54px] items-center border-b border-border bg-panel px-2 text-[8px] font-semibold uppercase tracking-[.14em] text-muted sm:grid-cols-[88px_minmax(160px,1fr)_90px_70px_60px]">
      <span>Price</span><span>Concentration · aggressor split</span><span className="text-right">Notional</span><span className="text-right">Shares</span><span className="text-right">Score</span>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {levels.map((row, index) => {
        const classified = row.askSideNotional + row.bidSideNotional + row.midMarketNotional + row.unknownSideNotional;
        const ask = classified ? row.askSideNotional / classified * 100 : 0;
        const bid = classified ? row.bidSideNotional / classified * 100 : 0;
        const mid = Math.max(0, 100 - ask - bid);
        const width = Math.max(1.5, row.totalNotional / peak * 100);
        const isMarket = row.id === nearestId;
        return <div key={row.id} className={`relative grid min-h-11 grid-cols-[74px_minmax(110px,1fr)_70px_58px_54px] items-center border-b px-2 font-mono text-[9px] sm:grid-cols-[88px_minmax(160px,1fr)_90px_70px_60px] ${isMarket ? "border-primary/60 bg-primary/[.055]" : "border-border/35 hover:bg-surface/55"}`}>
          {isMarket ? <span className="absolute inset-y-0 left-0 w-0.5 bg-primary shadow-[0_0_10px_var(--primary)]" /> : null}
          <div className="min-w-0"><div className={`font-semibold ${isMarket ? "text-primary" : "text-foreground"}`}>{price(row.levelPrice)}</div><div className="mt-0.5 text-[7px] uppercase tracking-[.11em] text-muted">#{index + 1}{row.isZoneMember ? " · zone" : ""}</div></div>
          <div className="min-w-0 pr-3">
            <div className="relative h-2 overflow-hidden border border-border/50 bg-surface"><span className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${width}%` }} /></div>
            <div className="mt-1 flex h-1.5 w-full overflow-hidden bg-surface" title={`Ask ${ask.toFixed(0)}% · Mid/unknown ${mid.toFixed(0)}% · Bid ${bid.toFixed(0)}%`}><span className="bg-primary" style={{ width: `${ask}%` }} /><span className="bg-muted/55" style={{ width: `${mid}%` }} /><span className="bg-danger" style={{ width: `${bid}%` }} /></div>
          </div>
          <div className="text-right"><div className="text-foreground">{dollars(row.totalNotional)}</div><div className="mt-0.5 text-[7px] text-muted">{whole(row.tradeCount)} prints</div></div>
          <div className="text-right text-foreground/80">{compact(row.totalShares)}</div>
          <div className="text-right"><span className="inline-flex min-w-9 justify-center border border-primary/20 bg-primary/[.06] px-1 py-0.5 text-primary">{row.strengthScore.toFixed(0)}</span><div className="mt-0.5 text-[7px] text-muted">{row.sessionCount}D</div></div>
        </div>;
      })}
    </div>
    <div className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-2 text-[7px] uppercase tracking-[.12em] text-muted"><span><i className="mr-1 inline-block h-1.5 w-4 bg-primary" />Ask-side <i className="ml-3 mr-1 inline-block h-1.5 w-4 bg-danger" />Bid-side</span><span>Raw notional ranking · no proxy</span></div>
  </div>;
}

function EquityPrintsPanel({ payload, settings }: { payload: unknown; settings: PanelSettings }) {
  const rows = useMemo(() => {
    const root = record(payload); const raw = Array.isArray(root?.prints) ? root.prints : [];
    return raw.flatMap((entry, index) => { const row = record(entry); if (!row) return []; const notional = finite(row.notionalValue) ?? 0; const mappedPrice = finite(row.mappedPrice) ?? finite(row.sourcePrice); if (mappedPrice === null || notional < settings.minimum) return []; return [{ id: String(row.id ?? index), mappedPrice, notional, size: finite(row.size) ?? 0, side: String(row.tradeSide ?? "UNKNOWN"), venue: String(row.venue ?? "—"), time: finite(row.tradeTimeMs) }]; }).sort((a, b) => (b.time ?? 0) - (a.time ?? 0)).slice(0, settings.rows);
  }, [payload, settings.minimum, settings.rows]);
  if (!rows.length) return <NoRows />;
  return <div className="h-full overflow-auto"><table className="w-full border-collapse text-left text-[9px]"><thead className="sticky top-0 z-10 bg-panel"><tr>{["Time", "Price", "Size", "Notional", "Side", "Venue"].map((column) => <th key={column} className="border-b border-border px-2 py-2 font-semibold uppercase tracking-[.11em] text-muted">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/35 font-mono hover:bg-surface"><td className="px-2 py-1.5 text-muted">{row.time ? new Date(row.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}</td><td className="px-2 py-1.5 text-foreground">{price(row.mappedPrice)}</td><td className="px-2 py-1.5 text-foreground/80">{whole(row.size)}</td><td className="px-2 py-1.5 text-foreground">{dollars(row.notional)}</td><td className={`px-2 py-1.5 ${row.side.toLowerCase().includes("ask") ? "text-primary" : row.side.toLowerCase().includes("bid") ? "text-danger" : "text-muted"}`}>{row.side}</td><td className="px-2 py-1.5 text-muted">{row.venue}</td></tr>)}</tbody></table></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="min-w-0 border-r border-border px-3 py-2 last:border-r-0"><div className="truncate text-[7px] font-semibold uppercase tracking-[.14em] text-muted">{label}</div><div className={`mt-1 truncate font-mono text-[11px] ${accent ? "text-primary" : "text-foreground"}`}>{value}</div></div>; }

function valueAt(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  return null;
}

function timeCell(value: unknown) {
  if (value == null) return "—";
  const numeric = finite(value);
  const date = numeric !== null ? new Date(numeric < 10_000_000_000 ? numeric * 1_000 : numeric) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function flowTone(value: unknown) {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("BULL") || text.includes("ASK") || text.includes("CALL")) return "text-primary";
  if (text.includes("BEAR") || text.includes("BID") || text.includes("PUT")) return "text-danger";
  return "text-muted";
}

function OrderFlowPanel({ payload, settings, onSettings }: { payload: unknown; settings: PanelSettings; onSettings: (patch: Partial<PanelSettings>) => void }) {
  const root = record(payload); const summary = record(root?.summary);
  const sourceRows = useMemo(() => (Array.isArray(root?.rows) ? root.rows.map(record).filter((row): row is Record<string, unknown> => Boolean(row)) : []), [root?.rows]);
  const exchanges = useMemo(() => [...new Set(sourceRows.map((row) => String(valueAt(row, "exchange") ?? "").toUpperCase()).filter(Boolean))].sort(), [sourceRows]);
  const frontExpiry = useMemo(() => sourceRows.map((item) => String(valueAt(item, "expirationDate") ?? "")).filter(Boolean).sort()[0] ?? "", [sourceRows]);
  const rows = useMemo(() => {
    const search = settings.flowSearch.trim().toUpperCase();
    const filtered = sourceRows.filter((row) => {
      const premium = finite(valueAt(row, "premium")) ?? 0; const quantity = finite(valueAt(row, "size", "quantity")) ?? 0;
      const side = String(valueAt(row, "side") ?? "UNKNOWN").toUpperCase(); const sentiment = String(valueAt(row, "sentiment") ?? "NEUTRAL").toUpperCase();
      const type = String(valueAt(row, "tradeType", "consolidationType", "fillKind") ?? "").toUpperCase(); const exchange = String(valueAt(row, "exchange") ?? "").toUpperCase();
      const expiration = String(valueAt(row, "expirationDate") ?? ""); const dte = finite(valueAt(row, "dte"));
      const searchable = [valueAt(row, "ticker"), valueAt(row, "osi"), valueAt(row, "expirationDate"), valueAt(row, "strikePrice"), type, exchange].join(" ").toUpperCase();
      const flagMatch = settings.flowFlags === "ALL" || (settings.flowFlags === "UNUSUAL" && Boolean(valueAt(row, "unusual"))) || (settings.flowFlags === "OPENING" && Boolean(valueAt(row, "opening"))) || (settings.flowFlags === "GOLDEN" && Boolean(valueAt(row, "goldenSweep"))) || (settings.flowFlags === "VOL_GT_OI" && Boolean(valueAt(row, "volumeGreaterThanOi"))) || (settings.flowFlags === "SIZE_GT_OI" && Boolean(valueAt(row, "sizeGreaterThanOi")));
      return (!search || searchable.includes(search)) && (settings.flowSide === "ALL" || side === settings.flowSide)
        && (settings.flowSentiment === "ALL" || sentiment === settings.flowSentiment)
        && (settings.flowType === "ALL" || type.includes(settings.flowType))
        && (settings.flowExchange === "ALL" || exchange === settings.flowExchange)
        && (settings.expiry === "ALL" || (settings.expiry === "0DTE" && dte === 0) || (settings.expiry === "FRONT" && expiration === frontExpiry) || (settings.expiry === "0-7DTE" && dte !== null && dte >= 0 && dte <= 7))
        && premium >= settings.flowMinPremium && quantity >= settings.flowMinQuantity && flagMatch;
    });
    const direction = settings.flowDirection === "asc" ? 1 : -1;
    return filtered.sort((left, right) => {
      const key = settings.flowSort; const a = valueAt(left, key); const b = valueAt(right, key);
      const an = finite(a), bn = finite(b); return direction * (an !== null && bn !== null ? an - bn : String(a ?? "").localeCompare(String(b ?? "")));
    }).slice(0, settings.rows);
  }, [frontExpiry, settings, sourceRows]);
  const stats = useMemo(() => {
    let bullish = 0, bearish = 0, callPremium = 0, putPremium = 0, callContracts = 0, putContracts = 0, unusual = 0, opening = 0;
    sourceRows.forEach((row) => { const type = String(valueAt(row, "contractType") ?? "").toUpperCase(), premium = finite(valueAt(row, "premium")) ?? 0, quantity = finite(valueAt(row, "size", "quantity")) ?? 0, sentiment = String(valueAt(row, "sentiment") ?? "").toUpperCase(); if (type.includes("CALL")) { callPremium += premium; callContracts += quantity; } else if (type.includes("PUT")) { putPremium += premium; putContracts += quantity; } if (sentiment === "BULLISH") bullish += 1; if (sentiment === "BEARISH") bearish += 1; if (Boolean(valueAt(row, "unusual"))) unusual += 1; if (Boolean(valueAt(row, "opening"))) opening += 1; });
    return { bullish, bearish, callPremium, putPremium, callContracts, putContracts, unusual, opening };
  }, [sourceRows]);
  const dense = settings.density === "compact";
  const sideCode = (value: unknown) => ({ ABOVE_ASK: "AA", ASK: "A", MID: "M", BID: "B", BELOW_BID: "BB", UNKNOWN: "?" }[String(value ?? "UNKNOWN").toUpperCase()] ?? String(value ?? "?"));
  const flags = (row: Record<string, unknown>) => [Boolean(valueAt(row, "unusual")) ? "U" : "", Boolean(valueAt(row, "opening")) ? "O" : "", Boolean(valueAt(row, "goldenSweep")) ? "G" : "", Boolean(valueAt(row, "volumeGreaterThanOi")) ? "V>OI" : "", Boolean(valueAt(row, "sizeGreaterThanOi")) ? "S>OI" : ""].filter(Boolean).join(" · ") || "—";
  type FlowColumn = { id: string; label: string; modes: PanelSettings["flowColumns"][]; cell: (row: Record<string, unknown>) => ReactNode; className?: string };
  const allModes: PanelSettings["flowColumns"][] = ["full", "essential", "execution", "contract"];
  const columns: FlowColumn[] = [
    { id: "time", label: "Time", modes: ["full", "essential", "execution"], cell: (row) => timeCell(valueAt(row, "tradeTime")), className: "text-muted" },
    { id: "contract", label: "Contract", modes: allModes, cell: (row) => <span title={String(valueAt(row, "osi") ?? valueAt(row, "ticker") ?? "—")}>{String(valueAt(row, "osi") ?? valueAt(row, "ticker") ?? "—")}</span> },
    { id: "cp", label: "C/P", modes: allModes, cell: (row) => String(valueAt(row, "contractType") ?? "—").replace("OPTION", "") },
    { id: "expiry", label: "Expiry · DTE", modes: ["full", "contract"], cell: (row) => `${String(valueAt(row, "expirationDate") ?? "—")} · ${tableCell(valueAt(row, "dte"))}` },
    { id: "strike", label: "Strike", modes: ["full", "contract"], cell: (row) => tableCell(valueAt(row, "strikePrice")) },
    { id: "spot", label: "Spot", modes: ["full", "contract"], cell: (row) => tableCell(valueAt(row, "stockPrice")) },
    { id: "qty", label: "Qty", modes: allModes, cell: (row) => whole(finite(valueAt(row, "size", "quantity")) ?? 0) },
    { id: "fill", label: "Fill", modes: ["full", "essential", "execution"], cell: (row) => tableCell(valueAt(row, "fill")) },
    { id: "bid", label: "Bid", modes: ["full", "execution"], cell: (row) => tableCell(valueAt(row, "bid")), className: "text-danger" },
    { id: "mid", label: "Mid", modes: ["full", "execution"], cell: (row) => tableCell(valueAt(row, "mid")), className: "text-muted" },
    { id: "ask", label: "Ask", modes: ["full", "execution"], cell: (row) => tableCell(valueAt(row, "ask")), className: "text-primary" },
    { id: "spread", label: "Spread", modes: ["full", "execution"], cell: (row) => `${tableCell(valueAt(row, "spreadWidth"))} · ${finite(valueAt(row, "spreadPercent"))?.toFixed(1) ?? "—"}%` },
    { id: "premium", label: "Premium", modes: allModes, cell: (row) => dollars(finite(valueAt(row, "premium")) ?? 0), className: "font-semibold" },
    { id: "side", label: "Side", modes: ["full", "essential", "execution"], cell: (row) => <span title={String(valueAt(row, "side") ?? "UNKNOWN")}>{sideCode(valueAt(row, "side"))}</span> },
    { id: "sentiment", label: "Sentiment", modes: ["full", "essential"], cell: (row) => String(valueAt(row, "sentiment") ?? "NEUTRAL") },
    { id: "exchange", label: "Exchange", modes: ["full", "execution"], cell: (row) => String(valueAt(row, "exchange") ?? "—") },
    { id: "tradeType", label: "Trade type", modes: ["full", "essential"], cell: (row) => String(valueAt(row, "tradeType", "consolidationType", "fillKind") ?? "—") },
    { id: "volumeOi", label: "Vol / OI", modes: ["full", "contract"], cell: (row) => `${compact(finite(valueAt(row, "volume")) ?? 0)} / ${compact(finite(valueAt(row, "openInterest")) ?? 0)}` },
    { id: "moneyness", label: "Moneyness", modes: ["full", "contract"], cell: (row) => `${String(valueAt(row, "moneynessType") ?? "—")} · ${finite(valueAt(row, "moneynessPercent"))?.toFixed(2) ?? "—"}%` },
    { id: "iv", label: "IV", modes: ["full", "contract"], cell: (row) => finite(valueAt(row, "impliedVolatility"))?.toFixed(3) ?? "—" },
    { id: "greeks", label: "Δ / Γ / Θ / V", modes: ["full", "contract"], cell: (row) => ["delta", "gamma", "theta", "vega"].map((key) => finite(valueAt(row, key))?.toFixed(3) ?? "—").join(" / ") },
    { id: "flags", label: "Flags", modes: ["full", "essential"], cell: flags, className: "text-primary" },
    { id: "score", label: "Score", modes: ["full"], cell: (row) => finite(valueAt(row, "flowScore"))?.toFixed(0) ?? "—", className: "text-primary" },
  ];
  const activeColumns = columns.filter((column) => column.modes.includes(settings.flowColumns));
  const groupKey = (row: Record<string, unknown>) => settings.flowGrouping === "contract" ? String(valueAt(row, "osi", "ticker") ?? "Unknown contract") : settings.flowGrouping === "expiry" ? String(valueAt(row, "expirationDate") ?? "Unknown expiry") : settings.flowGrouping === "exchange" ? String(valueAt(row, "exchange") ?? "Unknown exchange") : "";
  let lastGroup = "";
  const renderedRows: ReactNode[] = [];
  rows.forEach((row, index) => { const rowKey = String(valueAt(row, "id") ?? index), nextGroup = groupKey(row), showGroup = settings.flowGrouping !== "none" && nextGroup !== lastGroup; lastGroup = nextGroup;
    if (showGroup) renderedRows.push(<tr key={`${rowKey}-group`}><td colSpan={activeColumns.length} className="sticky left-0 border-b border-primary/20 bg-primary/[.06] px-2 py-1 text-[7px] font-semibold uppercase tracking-[.14em] text-primary">{settings.flowGrouping} · {nextGroup}</td></tr>);
    renderedRows.push(<tr key={rowKey} className={`border-b border-border/35 font-mono hover:bg-primary/[.045] ${dense ? "h-7" : "h-9"}`}>{activeColumns.map((column) => { const toneValue = column.id === "side" ? valueAt(row, "side") : column.id === "sentiment" ? valueAt(row, "sentiment") : column.id === "cp" ? valueAt(row, "contractType") : null; return <td key={column.id} className={`max-w-56 whitespace-nowrap px-2 text-foreground/85 ${column.className ?? ""} ${toneValue ? flowTone(toneValue) : ""}`}>{column.cell(row)}</td>; })}</tr>);
  });
  return <div className="flex h-full min-h-0 flex-col bg-background">
    <div className="grid shrink-0 grid-cols-4 border-b border-border bg-panel xl:grid-cols-8">
      <Metric label="Sentiment" value={String(valueAt(summary ?? {}, "bias") ?? "—")} accent />
      <Metric label="Net premium" value={dollars(finite(valueAt(summary ?? {}, "netFlow")) ?? 0)} />
      <Metric label="Call premium" value={dollars(finite(valueAt(summary ?? {}, "callPremium")) ?? stats.callPremium)} />
      <Metric label="Put premium" value={dollars(finite(valueAt(summary ?? {}, "putPremium")) ?? stats.putPremium)} />
      <Metric label="Call contracts" value={whole(finite(valueAt(summary ?? {}, "callContracts")) ?? stats.callContracts)} />
      <Metric label="Put contracts" value={whole(finite(valueAt(summary ?? {}, "putContracts")) ?? stats.putContracts)} />
      <Metric label="Bull / Bear" value={`${whole(stats.bullish)} / ${whole(stats.bearish)}`} />
      <Metric label="Visible prints" value={`${whole(rows.length)} / ${whole(sourceRows.length)}`} />
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel px-2 py-1.5">
      <label className="relative min-w-36 flex-1"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" /><input value={settings.flowSearch} onChange={(event) => onSettings({ flowSearch: event.target.value })} placeholder="Contract, strike, exchange" className="h-7 w-full border border-border bg-background pl-7 pr-2 text-[9px] text-foreground outline-none focus:border-primary/45" /></label>
      <MiniSelect label="Sentiment" value={settings.flowSentiment} values={["ALL", "BULLISH", "BEARISH", "NEUTRAL"]} onChange={(value) => onSettings({ flowSentiment: value })} />
      <MiniSelect label="Side" value={settings.flowSide} values={["ALL", "ABOVE_ASK", "ASK", "MID", "BID", "BELOW_BID", "UNKNOWN"]} onChange={(value) => onSettings({ flowSide: value })} />
      <MiniSelect label="Type" value={settings.flowType} values={["ALL", "SWEEP", "BLOCK", "SPLIT", "MULTI_LEG", "EXTENDED", "CANCEL"]} onChange={(value) => onSettings({ flowType: value })} />
      <MiniSelect label="Exchange" value={settings.flowExchange} values={["ALL", ...exchanges]} onChange={(value) => onSettings({ flowExchange: value })} />
      <MiniSelect label="Expiry" value={settings.expiry} values={["ALL", "0DTE", "FRONT", "0-7DTE"]} onChange={(value) => onSettings({ expiry: value })} />
      <MiniSelect label="Flags" value={settings.flowFlags} values={["ALL", "UNUSUAL", "OPENING", "GOLDEN", "VOL_GT_OI", "SIZE_GT_OI"]} onChange={(value) => onSettings({ flowFlags: value as PanelSettings["flowFlags"] })} />
      <MiniSelect label="Columns" value={settings.flowColumns} values={["full", "essential", "execution", "contract"]} onChange={(value) => onSettings({ flowColumns: value as PanelSettings["flowColumns"] })} />
      <MiniSelect label="Group" value={settings.flowGrouping} values={["none", "contract", "expiry", "exchange"]} onChange={(value) => onSettings({ flowGrouping: value as PanelSettings["flowGrouping"] })} />
      <label className="flex h-7 items-center border border-border bg-background"><span className="px-2 text-[7px] uppercase text-muted">Min $</span><input type="number" min="0" step="1000" value={settings.flowMinPremium} onChange={(event) => onSettings({ flowMinPremium: Number(event.target.value) })} className="h-full w-24 border-l border-border bg-background px-2 font-mono text-[8px] outline-none" /></label>
      <label className="flex h-7 items-center border border-border bg-background"><span className="px-2 text-[7px] uppercase text-muted">Min qty</span><input type="number" min="0" value={settings.flowMinQuantity} onChange={(event) => onSettings({ flowMinQuantity: Number(event.target.value) })} className="h-full w-16 border-l border-border bg-background px-2 font-mono text-[8px] outline-none" /></label>
      <MiniSelect label="Sort" value={settings.flowSort} values={["tradeTime", "premium", "size", "flowScore", "strikePrice"]} onChange={(value) => onSettings({ flowSort: value })} />
      <MiniSelect label="Order" value={settings.flowDirection} values={["desc", "asc"]} onChange={(value) => onSettings({ flowDirection: value as "asc" | "desc" })} />
      <button type="button" onClick={() => onSettings({ flowSearch: "", flowSide: "ALL", flowSentiment: "ALL", flowType: "ALL", flowExchange: "ALL", flowFlags: "ALL", flowMinPremium: 0, flowMinQuantity: 0, flowSort: "tradeTime", flowDirection: "desc", flowGrouping: "none", expiry: "ALL" })} className="h-7 border border-border px-2 text-[7px] font-semibold uppercase tracking-[.11em] text-muted hover:border-primary/40 hover:text-primary">Reset</button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-max w-full border-collapse text-left text-[9px]"><thead className="sticky top-0 z-10 bg-panel"><tr>{activeColumns.map((column) => <th key={column.id} className="whitespace-nowrap border-b border-border px-2 py-2 font-semibold uppercase tracking-[.1em] text-muted">{column.label}</th>)}</tr></thead><tbody>{renderedRows}</tbody></table>{!rows.length ? <div className="h-48"><NoRows /></div> : null}</div>
  </div>;
}

function MiniSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="flex h-7 items-center border border-border bg-background"><span className="px-2 text-[7px] uppercase tracking-[.11em] text-muted">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-20 border-l border-border bg-background px-1 font-mono text-[8px] text-foreground outline-none">{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}

type ColumnSpec = { label: string; keys: string[]; kind?: "money" | "number" | "price" | "time" | "tone" };
const TOOL_COLUMNS: Record<string, ColumnSpec[]> = {
  "contract-side-statistics": [
    { label: "Side", keys: ["side", "tradeSide", "label"], kind: "tone" }, { label: "Premium", keys: ["premium", "value", "notional"], kind: "money" }, { label: "Contracts", keys: ["contracts", "quantity", "volume"], kind: "number" }, { label: "Trades", keys: ["tradeCount", "count"], kind: "number" }, { label: "% total", keys: ["percent", "percentage", "share"] },
  ],
  "contract-statistics": [
    { label: "Metric", keys: ["label", "metric", "name"] }, { label: "Calls", keys: ["calls", "call", "callVolume"], kind: "number" }, { label: "Puts", keys: ["puts", "put", "putVolume"], kind: "number" }, { label: "Total", keys: ["total", "volume"], kind: "number" }, { label: "Put / call", keys: ["putCallRatio", "ratio"] }, { label: "Premium", keys: ["premium", "totalPremium"], kind: "money" },
  ],
  "exposure-expiration": [
    { label: "Expiration", keys: ["expiration", "expirationDate", "expiry"] }, { label: "DTE", keys: ["dte", "daysToExpiration"], kind: "number" }, { label: "Calls", keys: ["call", "callExposure", "calls"], kind: "money" }, { label: "Puts", keys: ["put", "putExposure", "puts"], kind: "money" }, { label: "Net exposure", keys: ["net", "netExposure"], kind: "money" }, { label: "Gross", keys: ["gross", "grossExposure"], kind: "money" },
  ],
  "gainers-losers": [
    { label: "Ticker", keys: ["ticker", "symbol"] }, { label: "Sentiment", keys: ["sentiment", "bias", "direction"], kind: "tone" }, { label: "Bullish premium", keys: ["bullishPremium"], kind: "money" }, { label: "Bearish premium", keys: ["bearishPremium"], kind: "money" }, { label: "Net premium", keys: ["netPremium"], kind: "money" }, { label: "Total premium", keys: ["totalPremium"], kind: "money" }, { label: "Bullish share", keys: ["bullishShare"] }, { label: "Trades", keys: ["tradeCount"], kind: "number" }, { label: "Volume", keys: ["volume"], kind: "number" },
  ],
  "max-pain": [{ label: "Expiration", keys: ["expiration", "expirationDate"] }, { label: "Max pain", keys: ["strike", "maxPain"], kind: "price" }],
  "net-drift": [{ label: "Time", keys: ["timestamp", "time"], kind: "time" }, { label: "Underlying", keys: ["stockPrice", "price"], kind: "price" }, { label: "Call premium", keys: ["callPremium", "call", "callDrift"], kind: "money" }, { label: "Put premium", keys: ["putPremium", "put", "putDrift"], kind: "money" }, { label: "Cumulative calls", keys: ["cumulativeCallPremium"], kind: "money" }, { label: "Cumulative puts", keys: ["cumulativePutPremium"], kind: "money" }, { label: "Net", keys: ["netFlow", "net", "netDrift"], kind: "money" }],
  "net-flow": [{ label: "Time", keys: ["timestamp", "time"], kind: "time" }, { label: "Underlying", keys: ["stockPrice", "price"], kind: "price" }, { label: "Call flow", keys: ["callPremium", "call"], kind: "money" }, { label: "Put flow", keys: ["putPremium", "put"], kind: "money" }, { label: "Cumulative calls", keys: ["cumulativeCallPremium"], kind: "money" }, { label: "Cumulative puts", keys: ["cumulativePutPremium"], kind: "money" }, { label: "Net flow", keys: ["netFlow", "net"], kind: "money" }],
  "term-structure": [{ label: "Expiration", keys: ["expiration", "expirationDate", "expiry"] }, { label: "DTE", keys: ["dte", "daysToExpiration"], kind: "number" }, { label: "IV", keys: ["iv", "impliedVolatility"] }, { label: "Call IV", keys: ["callIv", "callIV"] }, { label: "Put IV", keys: ["putIv", "putIV"] }, { label: "Skew", keys: ["skew"] }],
  "volatility-drift": [{ label: "Time", keys: ["timestamp", "time"], kind: "time" }, { label: "Call drift", keys: ["callDrift", "call"] }, { label: "Put drift", keys: ["putDrift", "put"] }, { label: "Net", keys: ["netDrift", "net"] }, { label: "Underlying", keys: ["stockPrice", "price"], kind: "price" }],
  "market-map": [{ label: "Ticker", keys: ["symbol", "ticker"] }, { label: "Price", keys: ["price", "last"], kind: "price" }, { label: "Change", keys: ["change"] }, { label: "Change %", keys: ["changePercent", "percentChange"] }, { label: "Volume", keys: ["volume"], kind: "number" }],
  "stock-price-time": [{ label: "Time", keys: ["timestamp", "time"], kind: "time" }, { label: "Open", keys: ["open"], kind: "price" }, { label: "High", keys: ["high"], kind: "price" }, { label: "Low", keys: ["low"], kind: "price" }, { label: "Close", keys: ["close", "price"], kind: "price" }, { label: "Volume", keys: ["volume"], kind: "number" }],
};

function StructuredToolPanel({ toolId, payload, limit, settings, onSettings }: { toolId: string; payload: unknown; limit: number; settings: PanelSettings; onSettings: (patch: Partial<PanelSettings>) => void }) {
  const sourceRows = useMemo(() => collectRows(payload, 500), [payload]); const columns = TOOL_COLUMNS[toolId] ?? [];
  const rows = useMemo(() => {
    const query = settings.tableSearch.trim().toLowerCase();
    const filtered = query ? sourceRows.filter((row) => columns.some((column) => String(valueAt(row, ...column.keys) ?? "").toLowerCase().includes(query))) : sourceRows;
    const selected = columns.find((column) => column.label === settings.tableSort) ?? columns[0];
    const direction = settings.tableDirection === "asc" ? 1 : -1;
    return [...filtered].sort((left, right) => {
      if (!selected) return 0;
      const a = valueAt(left, ...selected.keys), b = valueAt(right, ...selected.keys), an = finite(a), bn = finite(b);
      return direction * (an !== null && bn !== null ? an - bn : String(a ?? "").localeCompare(String(b ?? "")));
    }).slice(0, limit);
  }, [columns, limit, settings.tableDirection, settings.tableSearch, settings.tableSort, sourceRows]);
  if (!sourceRows.length) return <NoRows />;
  const render = (row: Record<string, unknown>, column: ColumnSpec) => {
    const value = valueAt(row, ...column.keys); const number = finite(value);
    const rowFormat = toolId === "contract-statistics" && ["Calls", "Puts", "Total"].includes(column.label) ? String(row.format ?? "") : "";
    if ((column.kind === "money" || rowFormat === "money") && number !== null) return dollars(number);
    if (rowFormat === "percent" && number !== null) return `${(Math.abs(number) <= 1 ? number * 100 : number).toFixed(2)}%`;
    if (column.kind === "number" && number !== null) return whole(number);
    if (column.kind === "price" && number !== null) return price(number);
    if (column.kind === "time") return timeCell(value);
    return tableCell(value);
  };
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel p-1.5">
      <label className="relative min-w-36 flex-1"><Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" /><input value={settings.tableSearch} onChange={(event) => onSettings({ tableSearch: event.target.value })} placeholder="Filter every displayed field" className="h-7 w-full border border-border bg-background pl-7 pr-2 text-[9px] text-foreground outline-none focus:border-primary/45" /></label>
      <MiniSelect label="Sort" value={settings.tableSort || columns[0]?.label || ""} values={columns.map((column) => column.label)} onChange={(value) => onSettings({ tableSort: value })} />
      <MiniSelect label="Order" value={settings.tableDirection} values={["desc", "asc"]} onChange={(value) => onSettings({ tableDirection: value as "asc" | "desc" })} />
      <button type="button" onClick={() => onSettings({ tableSearch: "", tableSort: "", tableDirection: "desc" })} className="h-7 border border-border px-2 text-[7px] font-semibold uppercase tracking-[.11em] text-muted hover:border-primary/40 hover:text-primary">Reset</button>
      <span className="px-1 font-mono text-[8px] text-muted">{rows.length}/{sourceRows.length}</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-full border-collapse text-left text-[9px]"><thead className="sticky top-0 z-10 bg-panel"><tr>{columns.map((column) => <th key={column.label} className="whitespace-nowrap border-b border-border px-2 py-2 font-semibold uppercase tracking-[.11em] text-muted">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="h-8 border-b border-border/35 font-mono hover:bg-primary/[.04]">{columns.map((column) => <td key={column.label} className={`whitespace-nowrap px-2 text-foreground/85 ${column.kind === "tone" ? flowTone(valueAt(row, ...column.keys)) : ""}`}>{render(row, column)}</td>)}</tr>)}</tbody></table>{!rows.length ? <div className="h-40"><NoRows /></div> : null}</div>
  </div>;
}

type SeriesSpec = { label: string; keys: string[]; color: "positive" | "negative" | "foreground" | "muted" };
const TOOL_SERIES: Record<string, SeriesSpec[]> = {
  "exposure-expiration": [{ label: "Call", keys: ["call", "callExposure", "calls"], color: "positive" }, { label: "Put", keys: ["put", "putExposure", "puts"], color: "negative" }, { label: "Net", keys: ["net", "netExposure"], color: "foreground" }],
  "net-drift": [{ label: "Call drift", keys: ["cumulativeCallPremium", "callPremium", "call", "callDrift"], color: "positive" }, { label: "Put drift", keys: ["cumulativePutPremium", "putPremium", "put", "putDrift"], color: "negative" }, { label: "Net drift", keys: ["netFlow", "net", "netDrift"], color: "foreground" }],
  "net-flow": [{ label: "Call flow", keys: ["cumulativeCallPremium", "callPremium", "call"], color: "positive" }, { label: "Put flow", keys: ["cumulativePutPremium", "putPremium", "put"], color: "negative" }, { label: "Net flow", keys: ["netFlow", "net"], color: "foreground" }],
  "term-structure": [{ label: "Call IV", keys: ["callIv", "callIV", "iv"], color: "positive" }, { label: "Put IV", keys: ["putIv", "putIV"], color: "negative" }, { label: "IV", keys: ["impliedVolatility", "iv"], color: "foreground" }],
  "volatility-drift": [{ label: "Call drift", keys: ["callDrift", "call"], color: "positive" }, { label: "Put drift", keys: ["putDrift", "put"], color: "negative" }, { label: "Net drift", keys: ["netDrift", "net"], color: "foreground" }],
  "stock-price-time": [{ label: "Underlying", keys: ["close", "price", "last"], color: "foreground" }],
};

function SeriesPanel({ toolId, payload, settings, onSettings }: { toolId: string; payload: unknown; settings: PanelSettings; onSettings: (patch: Partial<PanelSettings>) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null); const drawRef = useRef<(() => void) | null>(null); const rows = useMemo(() => collectRows(payload, 500), [payload]); const specs = TOOL_SERIES[toolId] ?? [];
  const series = useMemo(() => specs.map((spec) => ({ ...spec, values: rows.map((row, index) => ({ index, value: finite(valueAt(row, ...spec.keys)) })).filter((item): item is { index: number; value: number } => item.value !== null) })).filter((item) => item.values.length), [rows, specs]);
  const drawStateRef = useRef({ rows, series, settings });
  drawStateRef.current = { rows, series, settings };
  const hasSeries = series.length > 0;
  useEffect(() => {
    const canvas = ref.current;
    const container = canvas?.parentElement;
    if (!canvas || !container || !hasSeries) return;
    const draw = () => {
      const { rows, series, settings } = drawStateRef.current;
      const rect = container.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d"); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
      const styles = getComputedStyle(container); const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
      const palette = { positive: settings.color.startsWith("var(") ? color("--primary", "#aaff00") : settings.color, negative: settings.negativeColor.startsWith("var(") ? color("--danger", "#ff3366") : settings.negativeColor, foreground: color("--foreground", "#fff"), muted: color("--muted", "#888") };
      const border = color("--border", "#333"), left = 12, right = 56, top = 16, bottom = 28, width = Math.max(1, rect.width - left - right), height = Math.max(1, rect.height - top - bottom);
      const all = series.flatMap((item) => item.values.map((value) => value.value)); const min = Math.min(...all, 0), max = Math.max(...all, 0), span = Math.max(1e-9, max - min), maxIndex = Math.max(1, rows.length - 1);
      ctx.strokeStyle = border; ctx.globalAlpha = .7; ctx.lineWidth = .5;
      for (let i = 0; i <= 5; i++) { const y = top + i * height / 5; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke(); ctx.fillStyle = palette.muted; ctx.font = "9px JetBrains Mono"; ctx.fillText(compact(max - i * span / 5), left + width + 6, y + 3); }
      const zero = top + (max / span) * height; ctx.strokeStyle = palette.muted; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(left, zero); ctx.lineTo(left + width, zero); ctx.stroke(); ctx.setLineDash([]);
      series.forEach((item) => { ctx.beginPath(); item.values.forEach((point, index) => { const x = left + point.index / maxIndex * width, y = top + (max - point.value) / span * height; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = palette[item.color]; ctx.globalAlpha = .9; ctx.lineWidth = item.color === "foreground" ? 1.5 : 1.15; ctx.stroke(); });
    };
    let frame = 0;
    const scheduleDraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    drawRef.current = scheduleDraw;
    scheduleDraw();
    const observer = new ResizeObserver(scheduleDraw);
    observer.observe(container);
    return () => {
      if (drawRef.current === scheduleDraw) drawRef.current = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [hasSeries]);
  useEffect(() => { drawRef.current?.(); }, [rows.length, series, settings.color, settings.negativeColor]);
  if (!series.length || rows.length < 2) return <StructuredToolPanel toolId={toolId} payload={payload} limit={settings.rows} settings={settings} onSettings={onSettings} />;
  return <div className="flex h-full min-h-0 flex-col"><div className="flex h-8 shrink-0 items-center gap-4 overflow-x-auto border-b border-border bg-panel px-3">{series.map((item) => <span key={item.label} className={`flex shrink-0 items-center gap-1.5 text-[8px] uppercase tracking-[.11em] ${item.color === "positive" ? "text-primary" : item.color === "negative" ? "text-danger" : "text-foreground"}`}><i className="h-0.5 w-4 bg-current" />{item.label}<b className="font-mono text-foreground">{compact(item.values.at(-1)?.value ?? 0)}</b></span>)}</div><div className="min-h-0 flex-1"><canvas ref={ref} className="block h-full w-full" /></div></div>;
}

function MarketMapPanel({ payload }: { payload: unknown }) {
  const rows = useMemo(() => collectRows(payload, 40), [payload]); if (!rows.length) return <NoRows />;
  return <div className="grid h-full auto-rows-fr grid-cols-2 gap-px overflow-auto bg-border p-px sm:grid-cols-3">{rows.map((row, index) => { const symbol = String(valueAt(row, "symbol", "ticker", "name") ?? `#${index + 1}`); const last = finite(valueAt(row, "price", "last", "close")); const change = finite(valueAt(row, "changePercent", "percentChange", "change")) ?? 0; return <div key={`${symbol}-${index}`} className={`flex min-h-24 flex-col justify-between bg-background p-3 ${change > 0 ? "shadow-[inset_0_2px_0_var(--primary)]" : change < 0 ? "shadow-[inset_0_2px_0_var(--danger)]" : ""}`}><b className="text-[11px] uppercase tracking-[.12em] text-foreground">{symbol}</b><strong className="font-mono text-xl text-foreground">{last === null ? "—" : price(last)}</strong><span className={`font-mono text-[10px] ${change > 0 ? "text-primary" : change < 0 ? "text-danger" : "text-muted"}`}>{change > 0 ? "+" : ""}{change.toFixed(2)}%</span></div>; })}</div>;
}

function tableCell(value: unknown) {
  if (typeof value === "number") return compact(value);
  if (typeof value === "string") return value;
  if (value == null) return "—";
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return `${Object.keys(value).length} fields`;
  return String(value);
}

function DataTable({ payload, limit = 80 }: { payload: unknown; limit?: number }) {
  const rows = useMemo(() => collectRows(payload, limit), [payload, limit]); const columns = useMemo(() => { const scores = new Map<string, number>(); rows.forEach((row) => Object.keys(row).forEach((key) => scores.set(key, (scores.get(key) ?? 0) + 1))); return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([key]) => key); }, [rows]);
  if (!rows.length) return <NoRows />;
  return <div className="h-full overflow-auto"><table className="w-full border-collapse text-left text-[9px]"><thead className="sticky top-0 z-10 bg-panel"><tr>{columns.map((column) => <th key={column} className="border-b border-border px-2 py-2 font-semibold uppercase tracking-[.11em] text-muted">{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-border/35 hover:bg-primary/[.04]">{columns.map((column) => <td key={column} className="max-w-48 truncate px-2 py-1.5 font-mono text-foreground/85">{tableCell(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function IvRank({ payload }: { payload: unknown }) {
  const root = record(payload); const current = record(root?.current); const historical = record(root?.latestHistorical); const combined = record(historical?.combined); const call = record(historical?.call); const put = record(historical?.put);
  const value = finite(current?.ivRank) ?? finite(combined?.ivRank); const currentIv = finite(current?.currentIv) ?? finite(combined?.lastIv); const percentile = finite(historical?.ivPercentile); const low = finite(combined?.windowMinimumIv); const high = finite(combined?.windowMaximumIv); const spot = finite(current?.displayInstrumentPrice) ?? finite(current?.stockPrice) ?? finite(historical?.stockPrice); const quality = finite(record(historical?.dataQuality)?.score); const expiration = String(historical?.expirationDate ?? "—"); const status = String(root?.overallStatus ?? current?.status ?? historical?.status ?? "unavailable").replaceAll("-", " ");
  if (value === null) return <NoRows />;
  const iv = (number: number | null) => number === null ? "—" : `${(Math.abs(number) <= 2 ? number * 100 : number).toFixed(2)}%`;
  return <div className="grid h-full min-h-0 grid-cols-1 overflow-auto bg-border p-px lg:grid-cols-[minmax(230px,.8fr)_minmax(360px,1.4fr)]">
    <div className="flex min-h-64 items-center justify-center bg-background p-5"><div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${Math.max(0, Math.min(100, value))}%, color-mix(in srgb, var(--border) 65%, transparent) 0)` }}><div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-background"><strong className="font-mono text-4xl text-foreground">{value.toFixed(1)}</strong><span className="mt-1 text-[9px] uppercase tracking-[.18em] text-muted">IV Rank</span><span className="mt-3 border border-primary/25 px-2 py-1 text-[7px] font-semibold uppercase tracking-[.14em] text-primary">{status}</span></div></div></div>
    <div className="grid auto-rows-fr grid-cols-2 gap-px bg-border sm:grid-cols-3">
      <Metric label="Current IV" value={iv(currentIv)} accent />
      <Metric label="IV percentile" value={percentile === null ? "—" : `${percentile.toFixed(1)}%`} />
      <Metric label="Window low" value={iv(low)} />
      <Metric label="Window high" value={iv(high)} />
      <Metric label="Call IV" value={iv(finite(call?.lastIv))} />
      <Metric label="Put IV" value={iv(finite(put?.lastIv))} />
      <Metric label="Underlying" value={spot === null ? "—" : price(spot)} />
      <Metric label="Expiration" value={expiration} />
      <Metric label="Data quality" value={quality === null ? "—" : `${(Math.abs(quality) <= 1 ? quality * 100 : quality).toFixed(0)}%`} />
    </div>
  </div>;
}

function NoRows() { return <div className="flex h-full items-center justify-center text-center"><div><BarChart3 className="mx-auto h-5 w-5 text-muted" /><p className="mt-2 text-[9px] uppercase tracking-[.15em] text-muted">No rows in this verified frame</p></div></div>; }

const ToolSurface = memo(function ToolSurface({ panel, onChange }: { panel: DashboardPanel; onChange: (panel: DashboardPanel) => void }) {
  const tool = toolById.get(panel.toolId); const url = tool?.endpoint?.(panel.settings) ?? null; const feed = useSharedFeed(url);
  const patchSettings = useCallback((patch: Partial<PanelSettings>) => onChange({ ...panel, settings: { ...panel.settings, ...patch } }), [onChange, panel]);
  if (!tool?.endpoint) return <div className="flex h-full items-center justify-center px-8 text-center"><div><BookOpen className="mx-auto h-5 w-5 text-primary" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.16em]">Tool unavailable</p><p className="mt-2 max-w-md text-[9px] leading-5 text-muted">This saved panel no longer has an authoritative licensed source. Remove it and choose a verified tool.</p></div></div>;
  if (!feed.data && feed.loading) return <div className="flex h-full items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /><span className="ml-3 text-[9px] uppercase tracking-[.15em] text-muted">Restoring verified session</span></div>;
  if (!feed.data && feed.error) return <div className="flex h-full items-center justify-center px-8 text-center"><div><p className="text-[10px] font-semibold uppercase text-danger">Data unavailable</p><p className="mt-2 max-w-md text-[9px] text-muted">{feed.error}</p><button onClick={() => void feed.refresh()} className="mt-4 border border-primary/30 px-3 py-2 text-[9px] uppercase text-primary">Try again</button></div></div>;
  if (panel.toolId === "consolidated-flow" || panel.toolId === "unconsolidated-flow") return <OrderFlowPanel payload={feed.data} settings={panel.settings} onSettings={patchSettings} />;
  if (panel.toolId === "interval-map") return <ProfessionalIntervalMap payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "heat-map") return <ExposureHeatMap payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "dark-pool-levels") return <DarkPoolLevelsPanel payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "equity-prints") return <EquityPrintsPanel payload={feed.data} settings={panel.settings} />;
  if (["exposure-strike", "oi-strike", "classic-gex", "state-profile"].includes(panel.toolId)) return <ProfileBars payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "iv-rank") return <IvRank payload={feed.data} />;
  if (TOOL_SERIES[panel.toolId]) return <SeriesPanel toolId={panel.toolId} payload={feed.data} settings={panel.settings} onSettings={patchSettings} />;
  if (panel.toolId === "gex-flow") return <GexFlowWorkspace />;
  if (panel.toolId === "market-map") return <MarketMapPanel payload={feed.data} />;
  if (TOOL_COLUMNS[panel.toolId]) return <StructuredToolPanel toolId={panel.toolId} payload={feed.data} limit={panel.settings.rows} settings={panel.settings} onSettings={patchSettings} />;
  if (panel.toolId === "orderflow-profile") return <DataTable payload={feed.data} limit={panel.settings.rows} />;
  return <div className="flex h-full items-center justify-center px-8 text-center"><div><BookOpen className="mx-auto h-5 w-5 text-primary" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.16em]">Verified renderer unavailable</p><p className="mt-2 max-w-md text-[9px] leading-5 text-muted">This tool is not being flattened into a misleading generic table. Its licensed response needs a dedicated renderer.</p></div></div>;
});

function PanelSettingsDialog({ panel, onChange, onClose }: { panel: DashboardPanel; onChange: (panel: DashboardPanel) => void; onClose: () => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 }); const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const update = (key: keyof PanelSettings, value: string | number) => onChange({ ...panel, settings: { ...panel.settings, [key]: value } });
  const flowTool = panel.toolId === "consolidated-flow" || panel.toolId === "unconsolidated-flow";
  const intervalTool = panel.toolId === "interval-map" || panel.toolId === "heat-map";
  // Which controls this tool actually reads, asked of the tool itself.
  //
  // Every panel was offered a timeframe whether or not its request carries
  // one, so changing it on most tools did nothing and the dialog quietly lied
  // about what it controlled. Probing the tool's own endpoint with a sentinel
  // keeps this honest as tools are added, instead of a hand-kept list that
  // drifts the first time someone writes a new one.
  const uses = useMemo(() => {
    const tool = TOOLS.find((entry) => entry.id === panel.toolId);
    if (!tool?.endpoint) return { symbol: true, aggregation: false, date: false, greek: false, expiry: false };
    const probe = { ...panel.settings, symbol: "__SYM__", aggregation: "__AGG__", date: "__DATE__", greek: "__GREEK__", expiry: "__EXP__" };
    let url = "";
    try { url = tool.endpoint(probe); } catch { url = ""; }
    return {
      symbol: url.includes("__SYM__"),
      aggregation: url.includes("__AGG__"),
      date: url.includes("__DATE__"),
      greek: url.includes("__GREEK__"),
      expiry: url.includes("__EXP__"),
    };
  }, [panel.settings, panel.toolId]);
  return <div className="fixed inset-0 z-[180] pointer-events-none"><div className="pointer-events-auto absolute left-1/2 top-1/2 w-[430px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 border border-border bg-panel shadow-2xl" style={{ marginLeft: position.x, marginTop: position.y }}>
    <div className="flex h-10 cursor-move items-center justify-between border-b border-border px-3" onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, px: position.x, py: position.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current) return; setPosition({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }}><span className="text-[10px] font-semibold uppercase tracking-[.16em]">{panel.title} settings</span><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div>
    <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto p-4 text-[9px]">
      {uses.symbol ? <Field label="Symbol"><select value={panel.settings.symbol} onChange={(e) => update("symbol", e.target.value)}>{["SPX", "SPXW", "SPY", "NDX", "QQQ"].map((v) => <option key={v}>{v}</option>)}</select></Field> : null}
      {uses.date ? <Field label="Session date"><input type="date" value={panel.settings.date} onChange={(e) => update("date", e.target.value)} /></Field> : null}
      {uses.aggregation ? <Field label="Aggregation"><select value={panel.settings.aggregation} onChange={(e) => update("aggregation", e.target.value)}>{["1m", "2m", "3m", "4m", "5m", "10m", "15m", "20m", "30m", "1h", "2h", "4h"].map((v) => <option key={v}>{v}</option>)}</select></Field> : null}
      {uses.greek ? <Field label="Greek"><select value={panel.settings.greek} onChange={(e) => update("greek", e.target.value)}>{["GEX", "DEX", "VEX", "CHEX"].map((v) => <option key={v}>{v}</option>)}</select></Field> : null}
      {uses.expiry ? <Field label="Expiration"><select value={panel.settings.expiry} onChange={(e) => update("expiry", e.target.value)}>{["0DTE", "FRONT", "0-7DTE", "ALL"].map((v) => <option key={v}>{v}</option>)}</select></Field> : null}
      <Field label={`Strike padding · ${panel.settings.strikes}`}><input type="range" min="5" max="100" value={panel.settings.strikes} onChange={(e) => update("strikes", Number(e.target.value))} /></Field>
      <Field label={`Table rows · ${panel.settings.rows}`}><input type="range" min="10" max="200" step="10" value={panel.settings.rows} onChange={(e) => update("rows", Number(e.target.value))} /></Field>
      <Field label="Minimum magnitude"><input type="number" min="0" value={panel.settings.minimum} onChange={(e) => update("minimum", Number(e.target.value))} /></Field>
      <Field label="Positive color"><ChartColorField ariaLabel="Positive colour" value={panel.settings.color.startsWith("#") ? panel.settings.color : "#aaff00"} onChange={(hex) => update("color", hex)} /></Field>
      <Field label="Negative color"><ChartColorField ariaLabel="Negative colour" value={panel.settings.negativeColor.startsWith("#") ? panel.settings.negativeColor : "#ff3366"} onChange={(hex) => update("negativeColor", hex)} /></Field>
      {flowTool ? <>
        <div className="col-span-2 mt-1 border-t border-border pt-3 text-[8px] font-semibold uppercase tracking-[.16em] text-foreground">Order-flow filters & display</div>
        <Field label="Sentiment"><select value={panel.settings.flowSentiment} onChange={(e) => update("flowSentiment", e.target.value)}>{["ALL", "BULLISH", "BEARISH", "NEUTRAL"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Aggressor side"><select value={panel.settings.flowSide} onChange={(e) => update("flowSide", e.target.value)}>{["ALL", "ABOVE_ASK", "ASK", "MID", "BID", "BELOW_BID", "UNKNOWN"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Trade type"><select value={panel.settings.flowType} onChange={(e) => update("flowType", e.target.value)}>{["ALL", "SWEEP", "BLOCK", "SPLIT", "MULTI_LEG", "EXTENDED", "CANCEL"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Exchange"><input value={panel.settings.flowExchange} onChange={(e) => update("flowExchange", e.target.value.toUpperCase())} placeholder="ALL or venue" /></Field>
        <Field label="Classification"><select value={panel.settings.flowFlags} onChange={(e) => update("flowFlags", e.target.value)}>{["ALL", "UNUSUAL", "OPENING", "GOLDEN", "VOL_GT_OI", "SIZE_GT_OI"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Column preset"><select value={panel.settings.flowColumns} onChange={(e) => update("flowColumns", e.target.value)}>{["full", "essential", "execution", "contract"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Group rows"><select value={panel.settings.flowGrouping} onChange={(e) => update("flowGrouping", e.target.value)}>{["none", "contract", "expiry", "exchange"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Minimum premium"><input type="number" min="0" step="1000" value={panel.settings.flowMinPremium} onChange={(e) => update("flowMinPremium", Number(e.target.value))} /></Field>
        <Field label="Minimum quantity"><input type="number" min="0" value={panel.settings.flowMinQuantity} onChange={(e) => update("flowMinQuantity", Number(e.target.value))} /></Field>
        <Field label="Sort by"><select value={panel.settings.flowSort} onChange={(e) => update("flowSort", e.target.value)}>{[["tradeTime", "Time"], ["premium", "Premium"], ["size", "Quantity"], ["flowScore", "Flow score"], ["strikePrice", "Strike"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Direction"><select value={panel.settings.flowDirection} onChange={(e) => update("flowDirection", e.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></Field>
        <Field label="Row density"><select value={panel.settings.density} onChange={(e) => update("density", e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></Field>
      </> : null}
      {intervalTool ? <>
        <div className="col-span-2 mt-1 border-t border-border pt-3 text-[8px] font-semibold uppercase tracking-[.16em] text-foreground">Interval exposure surface</div>
        <Field label="Visual mode"><select value={panel.settings.intervalVisual} onChange={(e) => update("intervalVisual", e.target.value)}>{["bubbles", "fixed-dots", "heat-cells", "horizontal-ribbons", "hybrid"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Underlying style"><select value={panel.settings.intervalPriceStyle} onChange={(e) => update("intervalPriceStyle", e.target.value)}><option value="line">Line</option><option value="candles">Candlesticks</option></select></Field>
        <Field label={`Buckets per candle · ${panel.settings.intervalCandleBuckets}`}><input type="range" min="1" max="30" value={panel.settings.intervalCandleBuckets} onChange={(e) => update("intervalCandleBuckets", Number(e.target.value))} /></Field>
        <Field label="Exposure content"><select value={panel.settings.intervalContent} onChange={(e) => update("intervalContent", e.target.value)}>{["net", "call", "put", "gross", "call-put-split"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Value mode"><select value={panel.settings.intervalMode} onChange={(e) => update("intervalMode", e.target.value)}><option value="raw">Raw exposure</option><option value="difference">Build / unwind change</option></select></Field>
        <Field label="Difference baseline"><select value={panel.settings.intervalBaseline} onChange={(e) => update("intervalBaseline", e.target.value)}><option value="previous-bucket">Previous interval</option><option value="session-open">Session open</option><option value="rolling-average">Rolling average</option></select></Field>
        <Field label={`Rolling buckets · ${panel.settings.intervalRollingBuckets}`}><input type="range" min="2" max="30" value={panel.settings.intervalRollingBuckets} onChange={(e) => update("intervalRollingBuckets", Number(e.target.value))} /></Field>
        <Field label={`Maximum points · ${panel.settings.intervalMaximumPoints}`}><input type="range" min="500" max="20000" step="500" value={panel.settings.intervalMaximumPoints} onChange={(e) => update("intervalMaximumPoints", Number(e.target.value))} /></Field>
        <Field label={`Maximum strike distance · ${panel.settings.intervalMaximumDistance}%`}><input type="range" min="1" max="100" value={panel.settings.intervalMaximumDistance} onChange={(e) => update("intervalMaximumDistance", Number(e.target.value))} /></Field>
        <Field label="Price path"><select value={panel.settings.intervalShowPrice ? "ON" : "OFF"} onChange={(e) => onChange({ ...panel, settings: { ...panel.settings, intervalShowPrice: e.target.value === "ON" } })}><option>ON</option><option>OFF</option></select></Field>
      </> : null}
    </div>
    <div className="flex justify-end border-t border-border p-3"><button onClick={onClose} className="border border-primary/30 bg-primary/10 px-4 py-2 text-[9px] font-semibold uppercase tracking-[.14em] text-primary">Save</button></div>
  </div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="flex flex-col gap-1.5 uppercase tracking-[.12em] text-muted">{label}<span className="[&>*]:h-9 [&>*]:w-full [&>*]:border [&>*]:border-border [&>*]:bg-background [&>*]:px-2 [&>*]:font-mono [&>*]:text-[10px] [&>*]:text-foreground">{children}</span></label>; }

function AddToolDialog({ onAdd, onClose }: { onAdd: (tool: Tool) => void; onClose: () => void }) {
  const [category, setCategory] = useState<ToolCategory>("Options"); const [query, setQuery] = useState("");
  const tools = TOOLS.filter((tool) => tool.category === category && tool.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/35 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="flex h-[min(760px,88vh)] w-[min(980px,96vw)] flex-col border border-border bg-panel shadow-2xl"><div className="flex h-12 items-center justify-between border-b border-border px-4"><div><h2 className="text-[11px] font-semibold uppercase tracking-[.18em]">Add Tool</h2><p className="mt-0.5 text-[8px] text-muted">Authoritative server-backed tools · settings remain panel-local</p></div><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div><div className="flex min-h-0 flex-1"><aside className="w-44 shrink-0 border-r border-border p-2">{(["Options", "Equities", "KwantDesk"] as ToolCategory[]).map((item) => <button key={item} onClick={() => setCategory(item)} className={`mb-1 flex h-9 w-full items-center px-3 text-left text-[9px] font-semibold uppercase tracking-[.13em] ${category === item ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}>{item}</button>)}</aside><main className="min-w-0 flex-1 overflow-y-auto p-4"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tools" className="mb-4 h-10 w-full border border-border bg-background px-3 text-[10px] outline-none focus:border-primary/40" /><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{tools.map((tool) => <button key={tool.id} onClick={() => onAdd(tool)} className="group flex min-h-20 items-center gap-3 border border-border bg-background p-3 text-left hover:border-primary/35 hover:bg-primary/[.035]"><div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-panel text-primary"><Activity className="h-4 w-4" /></div><span><b className="block text-[10px] font-semibold text-foreground">{tool.label}</b><small className="mt-1 block text-[8px] leading-4 text-muted">{tool.detail}</small></span><Plus className="ml-auto h-4 w-4 text-muted group-hover:text-primary" /></button>)}</div></main></div></div></div>;
}

const DashboardPanelView = memo(function DashboardPanelView({ panel, index, onChange, onDuplicate, onDelete, onGrab, dragging, dropTarget }: { panel: DashboardPanel; index: number; onChange: (panel: DashboardPanel) => void; onDuplicate: (panel: DashboardPanel) => void; onDelete: (panelId: string) => void; onGrab: (panelId: string, index: number) => void; dragging: boolean; dropTarget: boolean }) {
  const [settings, setSettings] = useState(false); const [menu, setMenu] = useState(false); const [maximized, setMaximized] = useState(false);
  return <article
    data-panel-index={index}
    className={`${maximized ? "fixed inset-3 z-[150]" : "relative min-h-[310px]"} flex min-w-0 flex-col overflow-hidden border bg-background shadow-[inset_2px_0_0_color-mix(in_srgb,var(--primary)_65%,transparent)] ${
      dragging ? "border-primary/50 opacity-40" : dropTarget ? "border-primary" : "border-border"
    }`}
  >
    {/* Where the panel being carried would land. */}
    {dropTarget && !dragging ? <span className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-primary/70 bg-primary/[.06]" /> : null}
    <header
      className="flex h-10 shrink-0 cursor-grab items-center justify-between border-b border-border bg-panel px-3 active:cursor-grabbing"
      onPointerDown={(event) => {
        // The header's own controls are not a handle; a drag that started on
        // Settings or Delete would swallow the click that was intended.
        if ((event.target as HTMLElement).closest("button")) return;
        if (event.button !== 0 || maximized) return;
        onGrab(panel.id, index);
      }}
    ><div className="flex min-w-0 items-center gap-2"><Grip className="h-3.5 w-3.5 text-primary" /><span className="truncate text-[10px] font-semibold uppercase tracking-[.14em]">{panel.title}</span><span className="font-mono text-[8px] text-muted">{panel.settings.symbol} · {panel.settings.aggregation}</span></div><div className="relative flex items-center gap-1"><button onClick={() => setSettings(true)} className="p-1.5 text-muted hover:text-primary" aria-label="Panel settings"><Settings2 className="h-3.5 w-3.5" /></button><button onClick={() => setMaximized((v) => !v)} className="p-1.5 text-muted hover:text-primary" aria-label="Maximize panel"><Maximize2 className="h-3.5 w-3.5" /></button><button onClick={() => setMenu((v) => !v)} className="p-1.5 text-muted hover:text-primary"><MoreHorizontal className="h-4 w-4" /></button>{menu ? <div className="absolute right-0 top-8 z-30 w-40 border border-border bg-panel p-1 shadow-xl"><MenuButton icon={Copy} label="Duplicate Tab" onClick={() => { setMenu(false); onDuplicate(panel); }} /><MenuButton icon={Expand} label="Maximize" onClick={() => { setMenu(false); setMaximized(true); }} /><MenuButton icon={Move} label="Pop Out Tool" onClick={() => { setMenu(false); setMaximized(true); }} /><MenuButton icon={Trash2} label="Delete Tab" danger onClick={() => { setMenu(false); onDelete(panel.id); }} /></div> : null}</div></header>
    <div className="relative min-h-0 flex-1"><ToolSurface panel={panel} onChange={onChange} /></div>
    {settings ? <PanelSettingsDialog panel={panel} onChange={onChange} onClose={() => setSettings(false)} /> : null}
  </article>;
});

function MenuButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[9px] ${danger ? "text-danger" : "text-muted hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }

export default function GexBoxDashboard() {
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(() => defaultWorkspace()); const [hydrated, setHydrated] = useState(false); const [showTools, setShowTools] = useState(false); const [showStyle, setShowStyle] = useState(false); const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState("GEX BOX");
  useEffect(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw) as DashboardWorkspace; if (parsed.schemaVersion === 2 && parsed.pages?.length) setWorkspace({ ...parsed, pages: parsed.pages.map((page) => ({ ...page, panels: page.panels.map((panel) => ({ ...panel, settings: completeSettings(panel.settings) })) })) }); } } catch {} setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => writeProtectedItem(STORAGE_KEY, JSON.stringify(workspace)), 250);
    return () => window.clearTimeout(timer);
  }, [hydrated, workspace]);
  const active = workspace.pages.find((page) => page.id === workspace.activePageId) ?? workspace.pages[0];
  const updatePage = useCallback((updater: (page: DashboardPage) => DashboardPage) => setWorkspace((current) => ({ ...current, pages: current.pages.map((page) => page.id === current.activePageId ? updater(page) : page) })), []);
  const changePanel = useCallback((next: DashboardPanel) => updatePage((page) => ({ ...page, panels: page.panels.map((item) => item.id === next.id ? next : item) })), [updatePage]);
  const duplicatePanel = useCallback((panel: DashboardPanel) => updatePage((page) => ({ ...page, panels: [...page.panels, { ...panel, id: makeId("panel"), title: `${panel.title} Copy`, settings: { ...panel.settings } }] })), [updatePage]);
  const deletePanel = useCallback((panelId: string) => updatePage((page) => ({ ...page, panels: page.panels.filter((item) => item.id !== panelId) })), [updatePage]);
  const addTool = (tool: Tool) => {
    setShowTools(false);
    startTransition(() => updatePage((page) => ({ ...page, panels: [...page.panels, { id: makeId("panel"), toolId: tool.id, title: tool.label, settings: { ...DEFAULT_SETTINGS } }] })));
  };
  /**
   * Dragging a panel to a new slot.
   *
   * Held in refs as well as state: the window listeners below are installed
   * once per drag, so reading the drop slot from state inside them would read
   * whatever it was when the drag began.
   */
  const panelDragRef = useRef<{ id: string; from: number } | null>(null);
  const panelDropRef = useRef<number | null>(null);
  const [panelDrag, setPanelDrag] = useState<{ id: string; from: number } | null>(null);
  const [panelDrop, setPanelDrop] = useState<number | null>(null);

  const grabPanel = useCallback((panelId: string, index: number) => {
    panelDragRef.current = { id: panelId, from: index };
    panelDropRef.current = index;
    setPanelDrag({ id: panelId, from: index });
    setPanelDrop(index);
  }, []);

  useEffect(() => {
    if (!panelDrag) return;
    // The slot under the pointer, found from the document rather than from
    // per-panel handlers: the panel being carried is semi-transparent and
    // still under the cursor, so its own events would answer every move.
    const move = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const slot = element instanceof Element ? element.closest("[data-panel-index]") : null;
      const raw = slot?.getAttribute("data-panel-index");
      const index = raw === null || raw === undefined ? null : Number(raw);
      const next = index !== null && Number.isFinite(index) ? index : null;
      if (next !== panelDropRef.current) {
        panelDropRef.current = next;
        setPanelDrop(next);
      }
    };
    const finish = () => {
      const held = panelDragRef.current;
      const to = panelDropRef.current;
      panelDragRef.current = null;
      panelDropRef.current = null;
      setPanelDrag(null);
      setPanelDrop(null);
      if (!held || to === null || to === held.from) return;
      updatePage((page) => {
        const panels = [...page.panels];
        if (held.from < 0 || held.from >= panels.length) return page;
        const [moved] = panels.splice(held.from, 1);
        // Splicing out first means the target index already accounts for the
        // gap the panel left behind, so the rest close up exactly as they look
        // like they will while the drag is in flight.
        panels.splice(Math.max(0, Math.min(panels.length, to)), 0, moved);
        return { ...page, panels };
      });
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      panelDragRef.current = null;
      panelDropRef.current = null;
      setPanelDrag(null);
      setPanelDrop(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", cancel);
    };
  }, [panelDrag, updatePage]);

  const saveNamedWorkspace = useCallback((name: string) => {
    const result = saveGexBoxWorkspace(name, {
      pages: workspace.pages,
      activePageId: workspace.activePageId,
      paletteId: workspace.paletteId,
    });
    if (!result.ok) return { ok: false, error: result.error };
    setActiveWorkspaceId(result.preset.id);
    setActiveWorkspaceName(result.preset.name);
    return { ok: true };
  }, [workspace]);

  const applySavedWorkspace = useCallback((preset: GexBoxWorkspacePreset) => {
    const pages = preset.pages as DashboardPage[];
    if (!Array.isArray(pages) || !pages.length) return;
    setWorkspace({
      schemaVersion: 2,
      name: preset.name,
      // A saved workspace names its own active page; if that page is missing
      // the first one is used rather than leaving the dashboard on a page id
      // that matches nothing and rendering blank.
      activePageId: pages.some((page) => page.id === preset.activePageId) ? preset.activePageId : pages[0].id,
      paletteId: preset.paletteId,
      pages: pages.map((page) => ({ ...page, panels: (page.panels ?? []).map((panel) => ({ ...panel, settings: completeSettings(panel.settings) })) })),
    });
    setActiveWorkspaceId(preset.id);
    setActiveWorkspaceName(preset.name);
  }, []);

  const importSavedWorkspace = useCallback((file: File) => {
    void file.text().then((raw) => {
      const result = importGexBoxWorkspace(raw);
      if (!result.ok) { window.alert(result.error); return; }
      applySavedWorkspace(result.preset);
    }).catch(() => window.alert("That file could not be read."));
  }, [applySavedWorkspace]);

  const applyPalette = useCallback((paletteId: string) => {
    const colors = gexBoxPanelColors(resolveGexBoxRoles(paletteId));
    // Written into every panel rather than read at render time, so a panel
    // whose colours are later tuned by hand keeps that tuning instead of being
    // silently re-themed on the next render.
    setWorkspace((current) => ({
      ...current,
      paletteId,
      pages: current.pages.map((page) => ({
        ...page,
        panels: page.panels.map((panel) => ({ ...panel, settings: { ...panel.settings, ...colors } })),
      })),
    }));
  }, []);

  const addPage = (layout: "grid" | "infinite") => { const id = makeId("page"); setWorkspace((current) => ({ ...current, activePageId: id, pages: [...current.pages, { id, name: layout === "grid" ? `Page ${current.pages.length + 1}` : `Infinite ${current.pages.length + 1}`, layout, panels: [] }] })); };
  // The palette reaches chrome — table headers, strike labels — through CSS
  // variables rather than per-panel settings, since those are the frame around
  // the data rather than the data itself.
  const themeRoles = resolveGexBoxRoles(workspace.paletteId ?? DEFAULT_GEX_BOX_PALETTE_ID);
  return <div
    data-gexbox-themed
    style={gexBoxThemeVariables(themeRoles) as CSSProperties}
    className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground"
  >
    <header className="shrink-0 border-b border-border bg-panel"><div className="flex h-11 items-center justify-between gap-3 px-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center border border-primary/25 bg-primary/10"><LayoutDashboard className="h-4 w-4 text-primary" /></div><div><h1 className="text-[11px] font-semibold uppercase tracking-[.18em]">GEX BOX</h1><p className="text-[8px] text-muted">QuantData tools · KwantDesk workspace engine</p></div></div><div className="relative flex flex-1 justify-center"><button onClick={() => setWorkspaceMenu((v) => !v)} className={`flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-[10px] font-semibold uppercase tracking-[.075em] transition-colors ${workspaceMenu ? "border-primary/35 bg-primary/[0.08] text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`} title="Saved GEX BOX workspaces"><Save className="h-3.5 w-3.5" strokeWidth={1.55} /><span>WORKSPACES</span></button>{workspaceMenu ? <GexBoxWorkspacesMenu activeId={activeWorkspaceId} snapshotName={activeWorkspaceName} onApply={applySavedWorkspace} onSave={saveNamedWorkspace} onImport={importSavedWorkspace} onReset={() => { setWorkspace(defaultWorkspace()); setActiveWorkspaceId(null); setActiveWorkspaceName("GEX BOX"); }} onClose={() => setWorkspaceMenu(false)} /> : null}</div><div className="flex items-center gap-1"><button onClick={() => setShowTools(true)} className="flex h-8 items-center gap-2 border border-primary/30 bg-primary/10 px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-primary"><Plus className="h-3.5 w-3.5" />Add Tool</button><button onClick={() => setShowStyle(true)} className="flex h-8 items-center gap-2 border border-border px-3 text-[9px] uppercase text-muted hover:text-foreground" title="Workspace style and palette"><SlidersHorizontal className="h-3.5 w-3.5" />Settings</button></div></div>
      {showStyle ? <GexBoxStyleSettings
        paletteId={workspace.paletteId ?? DEFAULT_GEX_BOX_PALETTE_ID}
        onPreview={applyPalette}
        onSave={(id) => { applyPalette(id); setShowStyle(false); }}
        onClose={() => setShowStyle(false)}
      /> : null}
      <div className="flex h-10 items-end gap-1 overflow-x-auto px-3">{workspace.pages.map((page) => <div key={page.id} className={`group flex h-9 shrink-0 items-center border-b-2 px-3 ${page.id === active.id ? "border-primary bg-primary/[.035] text-primary" : "border-transparent text-muted"}`}><button onClick={() => setWorkspace((current) => ({ ...current, activePageId: page.id }))} className="text-[9px] font-semibold uppercase tracking-[.13em]">{page.name}</button>{workspace.pages.length > 1 ? <button onClick={() => setWorkspace((current) => { const pages = current.pages.filter((item) => item.id !== page.id); return { ...current, pages, activePageId: current.activePageId === page.id ? pages[0].id : current.activePageId }; })} className="ml-2 opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button> : null}</div>)}<button onClick={() => addPage("grid")} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-primary"><Plus className="h-3.5 w-3.5" /></button></div></header>
    {/* One grid, always three across. The layout is no longer a choice, so a
        workspace saved on one machine lands the same way on another. */}
    <main data-gexbox-dragging={panelDrag ? "true" : undefined} className={`grid min-h-0 flex-1 auto-rows-[minmax(310px,1fr)] grid-cols-1 gap-2 overflow-auto p-2 md:grid-cols-2 xl:grid-cols-3 ${panelDrag ? "select-none" : ""}`}>
      {active.panels.length ? active.panels.map((panel, index) => <DashboardPanelView key={panel.id} panel={panel} index={index} onChange={changePanel} onDuplicate={duplicatePanel} onDelete={deletePanel} onGrab={grabPanel} dragging={panelDrag?.id === panel.id} dropTarget={panelDrag !== null && panelDrop === index} />) : <button onClick={() => setShowTools(true)} className="col-span-full flex min-h-[420px] items-center justify-center border border-dashed border-border text-muted hover:border-primary/40 hover:text-primary"><Plus className="mr-2 h-4 w-4" /><span className="text-[10px] uppercase tracking-[.15em]">Add the first tool</span></button>}
    </main>
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-3 text-[8px] uppercase tracking-[.12em] text-muted"><span>{active.layout} page · {active.panels.length} panels · shared VPS feeds</span><span>Prior completed New York RTH · live during session</span></footer>
    {showTools ? <AddToolDialog onAdd={addTool} onClose={() => setShowTools(false)} /> : null}
  </div>;
}
