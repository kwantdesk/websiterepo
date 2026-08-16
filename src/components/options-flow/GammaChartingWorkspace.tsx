"use client";

import Chart from "@/components/Chart";
import ChartIndicatorsControl from "@/components/ChartIndicatorsControl";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import type { Candle } from "@/lib/backtester";
import {
  DATABENTO_LIVE_TICK_EVENT,
  LIVE_CHART_CANDLE_EVENT,
  type DatabentoLiveTick,
} from "@/lib/chartLiveEvents";
import {
  CHART_SETTINGS_CHANGE_EVENT,
  loadStoredChartSettings,
  type ChartSettings,
} from "@/lib/chartSettings";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { DATABENTO_FUTURES } from "@/lib/databento";
import {
  fetchInstitutionalSnapshot,
  type InstitutionalInstrument,
} from "@/lib/institutionalMarketData";
import {
  mergeChartHistory,
  readCompatibleChartHistoryCache,
  writeChartHistoryCache,
} from "@/lib/chartHistoryCache";
import {
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Grid2X2,
  LayoutPanelLeft,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const GAMMA_WORKSPACE_STORAGE_KEY = "kwantdesk-gamma-chart-workspace-v1";
const GAMMA_WORKSPACE_PRESETS_KEY = "kwantdesk-gamma-chart-workspace-presets-v1";
export const GAMMA_CHART_SYMBOLS_EVENT = "kwantdesk:gamma-chart-symbols-change";

const STANDARD_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"] as const;

type GammaChartPane = {
  id: string;
  symbol: string;
  timeframe: string;
  indicators: ChartIndicatorInstance[];
  locked: boolean;
};

type GammaChartWorkspaceState = {
  panes: GammaChartPane[];
  activePaneId: string;
  layoutLocked: boolean;
};

type GammaWorkspacePreset = {
  id: string;
  name: string;
  savedAt: number;
  state: GammaChartWorkspaceState;
};

const newPane = (index = 0): GammaChartPane => ({
  id: `gamma-chart-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  symbol: "NQ",
  timeframe: "5m",
  indicators: [],
  locked: false,
});

const defaultState = (): GammaChartWorkspaceState => {
  const pane = newPane();
  return { panes: [pane], activePaneId: pane.id, layoutLocked: false };
};

function normalizeRoot(value: string) {
  return value.trim().toUpperCase().replace(/\.V\.0$/i, "").replace(/[^A-Z0-9]/g, "");
}

function loadWorkspaceState(): GammaChartWorkspaceState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = JSON.parse(window.localStorage.getItem(GAMMA_WORKSPACE_STORAGE_KEY) ?? "null") as Partial<GammaChartWorkspaceState> | null;
    const panes = Array.isArray(raw?.panes)
      ? raw.panes.slice(0, 4).flatMap((candidate) => {
          if (!candidate || typeof candidate !== "object") return [];
          const pane = candidate as Partial<GammaChartPane>;
          if (typeof pane.id !== "string") return [];
          return [{
            id: pane.id,
            symbol: normalizeRoot(typeof pane.symbol === "string" ? pane.symbol : "NQ") || "NQ",
            timeframe: typeof pane.timeframe === "string" ? pane.timeframe : "5m",
            indicators: Array.isArray(pane.indicators) ? pane.indicators : [],
            locked: pane.locked === true,
          } satisfies GammaChartPane];
        })
      : [];
    if (!panes.length) return defaultState();
    return {
      panes,
      activePaneId: panes.some((pane) => pane.id === raw?.activePaneId) ? String(raw?.activePaneId) : panes[0].id,
      layoutLocked: raw?.layoutLocked === true,
    };
  } catch {
    return defaultState();
  }
}

function loadPresets(): GammaWorkspacePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(GAMMA_WORKSPACE_PRESETS_KEY) ?? "[]") as GammaWorkspacePreset[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function tickTime(value: unknown) {
  if (typeof value === "number") {
    if (value > 10_000_000_000_000_000) return Math.floor(value / 1_000_000);
    if (value > 10_000_000_000_000) return Math.floor(value / 1_000);
    if (value < 10_000_000_000) return Math.floor(value * 1_000);
    return Math.floor(value);
  }
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function timeframeMs(timeframe: string) {
  const match = timeframe.match(/^(\d+)(m|h|D)$/);
  if (!match) return 60_000;
  const count = Math.max(1, Number(match[1]));
  return count * (match[2] === "m" ? 60_000 : match[2] === "h" ? 3_600_000 : 86_400_000);
}

function mergeTick(candles: Candle[], tick: DatabentoLiveTick, timeframe: string) {
  const price = Number(tick.mid);
  if (!Number.isFinite(price) || price <= 0) return candles;
  const timestamp = tickTime(tick.timestamp);
  const duration = timeframeMs(timeframe);
  const bucket = Math.floor(timestamp / duration) * duration;
  const size = tick.isTrade ? Math.max(0, Number(tick.size ?? 0)) : 0;
  const trades = tick.isTrade ? Math.max(1, Number(tick.trades ?? 1)) : 0;
  const delta = tick.isTrade ? Number(tick.delta ?? 0) : 0;
  const last = candles.at(-1);
  if (!last || bucket > last.timestamp) {
    return [...candles, {
      timestamp: bucket,
      open: last?.close ?? price,
      high: price,
      low: price,
      close: price,
      volume: size,
      trades,
      delta,
      deltaOpen: 0,
      deltaHigh: Math.max(0, delta),
      deltaLow: Math.min(0, delta),
      deltaClose: delta,
      askVolume: delta > 0 ? size : 0,
      bidVolume: delta < 0 ? size : 0,
    }];
  }
  if (bucket < last.timestamp) return candles;
  const priorDelta = Number(last.deltaClose ?? last.delta ?? 0);
  const nextDelta = priorDelta + delta;
  const next: Candle = {
    ...last,
    high: Math.max(last.high, price),
    low: Math.min(last.low, price),
    close: price,
    volume: Math.max(0, Number(last.volume ?? 0)) + size,
    trades: Math.max(0, Number(last.trades ?? 0)) + trades,
    delta: Number(last.delta ?? 0) + delta,
    deltaOpen: Number(last.deltaOpen ?? 0),
    deltaHigh: Math.max(Number(last.deltaHigh ?? priorDelta), nextDelta),
    deltaLow: Math.min(Number(last.deltaLow ?? priorDelta), nextDelta),
    deltaClose: nextDelta,
    askVolume: Math.max(0, Number(last.askVolume ?? 0)) + (delta > 0 ? size : 0),
    bidVolume: Math.max(0, Number(last.bidVolume ?? 0)) + (delta < 0 ? size : 0),
  };
  return [...candles.slice(0, -1), next];
}

function GammaChartPaneView({
  pane,
  active,
  chartSettings,
  canClose,
  onActivate,
  onChange,
  onDuplicate,
  onClose,
  onOpenIndicatorSettings,
}: {
  pane: GammaChartPane;
  active: boolean;
  chartSettings: ChartSettings;
  canClose: boolean;
  onActivate: () => void;
  onChange: (next: GammaChartPane) => void;
  onDuplicate: () => void;
  onClose: () => void;
  onOpenIndicatorSettings: (instanceId: string) => void;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedStatus, setFeedStatus] = useState<InstitutionalInstrument["status"]>("NOT_OPEN");
  const lastStateSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setCandles([]);
    candlesRef.current = [];
    void (async () => {
      const cached = await readCompatibleChartHistoryCache(pane.symbol, pane.timeframe);
      if (!cancelled && cached?.candles.length) {
        candlesRef.current = cached.candles;
        setCandles(cached.candles);
        setLoading(false);
      }
      const snapshot = await fetchInstitutionalSnapshot({
        symbol: pane.symbol,
        timeframe: pane.timeframe,
        lookbackBars: 8_000,
        timeoutMs: 45_000,
      });
      if (cancelled || controller.signal.aborted) return;
      if (snapshot?.candles.length) {
        const merged = mergeChartHistory(candlesRef.current, snapshot.candles);
        candlesRef.current = merged;
        setCandles(merged);
        setFeedStatus(snapshot.status);
        setLoading(false);
        void writeChartHistoryCache(pane.symbol, pane.timeframe, merged);
      } else if (!candlesRef.current.length) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pane.symbol, pane.timeframe]);

  useEffect(() => {
    const receiveTick = (event: Event) => {
      const tick = (event as CustomEvent<DatabentoLiveTick>).detail;
      if (!tick || normalizeRoot(tick.instrument) !== normalizeRoot(pane.symbol)) return;
      const previous = candlesRef.current;
      const next = mergeTick(previous, tick, pane.timeframe);
      if (next === previous || !next.length) return;
      candlesRef.current = next.length > 12_000 ? next.slice(-12_000) : next;
      const live = candlesRef.current.at(-1)!;
      window.dispatchEvent(new CustomEvent(LIVE_CHART_CANDLE_EVENT, {
        detail: { key: pane.id, candle: live },
      }));
      const now = Date.now();
      const newBar = previous.at(-1)?.timestamp !== live.timestamp;
      if (newBar || now - lastStateSyncRef.current >= 250) {
        lastStateSyncRef.current = now;
        setCandles(candlesRef.current);
      }
      setFeedStatus("LIVE");
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    return () => window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
  }, [pane.id, pane.symbol, pane.timeframe]);

  return (
    <section
      onPointerDown={onActivate}
      className={`relative flex min-h-0 flex-col overflow-hidden border bg-panel transition-colors ${active ? "border-primary/60" : "border-border"}`}
    >
      <div className="kwant-workspace-pane-header flex shrink-0 items-center border-b border-border bg-panel/95 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 px-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <span>CHARTS</span>
          <span className="font-mono text-[8px] font-normal text-muted">{pane.symbol} · {pane.timeframe}</span>
        </div>
        <button type="button" onClick={() => onChange({ ...pane, locked: !pane.locked })} className={`flex h-7 w-7 items-center justify-center ${pane.locked ? "text-primary" : "text-muted hover:text-foreground"}`} aria-label={pane.locked ? "Unlock Gamma chart" : "Lock Gamma chart"}>
          {pane.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={onDuplicate} className="flex h-7 w-7 items-center justify-center text-muted hover:text-primary" aria-label="Duplicate Gamma chart"><Copy className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={onClose} disabled={!canClose || pane.locked} className="flex h-7 w-7 items-center justify-center text-muted hover:text-danger disabled:opacity-25" aria-label="Close Gamma chart"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="relative min-h-0 flex-1 bg-background">
        {candles.length ? (
          <Chart
            candles={candles}
            instrument={pane.symbol}
            chartInstanceId={pane.id}
            workspaceId="gamma-charting"
            timeframe={pane.timeframe}
            indicators={pane.indicators}
            settings={chartSettings}
            keyboardActive={active}
            marketIsActive={feedStatus === "LIVE"}
            liveCandleEventKey={pane.id}
            onOpenIndicatorSettings={onOpenIndicatorSettings}
            onUpdateIndicatorSetting={(instanceId, key, value) => onChange({
              ...pane,
              indicators: pane.indicators.map((indicator) => indicator.instanceId === instanceId
                ? { ...indicator, settings: { ...indicator.settings, [key]: value } }
                : indicator),
            })}
            onRemoveAllIndicators={() => onChange({ ...pane, indicators: [] })}
          />
        ) : loading ? (
          <KwantLoader className="h-full" icon={BarChart3} title={`Loading ${pane.symbol} chart`} detail={`Restoring ${pane.timeframe} candles`} />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted">No verified {pane.symbol} candles are available yet.</div>
        )}
      </div>
    </section>
  );
}

export default function GammaChartingWorkspace() {
  const [workspace, setWorkspace] = useState<GammaChartWorkspaceState>(loadWorkspaceState);
  const [presets, setPresets] = useState<GammaWorkspacePreset[]>(loadPresets);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState<ChartSettings>(loadStoredChartSettings);
  const [settingsOpenRequest, setSettingsOpenRequest] = useState<{ instanceId: string; requestId: number } | null>(null);
  const activePane = workspace.panes.find((pane) => pane.id === workspace.activePaneId) ?? workspace.panes[0];

  useEffect(() => {
    window.localStorage.setItem(GAMMA_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    const symbols = [...new Set(workspace.panes.map((pane) => pane.symbol))];
    window.dispatchEvent(new CustomEvent(GAMMA_CHART_SYMBOLS_EVENT, { detail: symbols }));
  }, [workspace]);

  useEffect(() => {
    window.localStorage.setItem(GAMMA_WORKSPACE_PRESETS_KEY, JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    const receiveSettings = (event: Event) => setChartSettings((event as CustomEvent<ChartSettings>).detail ?? loadStoredChartSettings());
    const receivePreferences = () => setChartSettings(loadStoredChartSettings());
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, receiveSettings);
    window.addEventListener("kwantdesk:preferences-changed", receivePreferences);
    return () => {
      window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, receiveSettings);
      window.removeEventListener("kwantdesk:preferences-changed", receivePreferences);
    };
  }, []);

  const updatePane = useCallback((next: GammaChartPane) => {
    setWorkspace((current) => ({ ...current, panes: current.panes.map((pane) => pane.id === next.id ? next : pane) }));
  }, []);

  const setPaneCount = (count: 1 | 2 | 4) => {
    if (workspace.layoutLocked) return;
    setWorkspace((current) => {
      const panes = current.panes.slice(0, count);
      while (panes.length < count) panes.push({ ...newPane(panes.length), symbol: panes[0]?.symbol ?? "NQ", timeframe: panes[0]?.timeframe ?? "5m" });
      return { ...current, panes, activePaneId: panes.some((pane) => pane.id === current.activePaneId) ? current.activePaneId : panes[0].id };
    });
  };

  const duplicatePane = (id: string) => {
    if (workspace.layoutLocked || workspace.panes.length >= 4) return;
    setWorkspace((current) => {
      const source = current.panes.find((pane) => pane.id === id) ?? current.panes[0];
      const copy = { ...source, id: newPane(current.panes.length).id, indicators: source.indicators.map((item) => ({ ...item, instanceId: `${item.instanceId}-${Date.now()}` })), locked: false };
      return { ...current, panes: [...current.panes, copy], activePaneId: copy.id };
    });
  };

  const closePane = (id: string) => {
    if (workspace.layoutLocked || workspace.panes.length <= 1) return;
    setWorkspace((current) => {
      const panes = current.panes.filter((pane) => pane.id !== id);
      return { ...current, panes, activePaneId: current.activePaneId === id ? panes[0].id : current.activePaneId };
    });
  };

  const savePreset = () => {
    const next: GammaWorkspacePreset = {
      id: `gamma-preset-${Date.now()}`,
      name: `Gamma workspace ${presets.length + 1}`,
      savedAt: Date.now(),
      state: workspace,
    };
    setPresets((current) => [next, ...current].slice(0, 12));
    setWorkspaceMenuOpen(false);
  };

  const instruments = useMemo(() => {
    const seen = new Set<string>();
    return DATABENTO_FUTURES.flatMap((item) => {
      const root = normalizeRoot(item.symbol);
      if (!root || seen.has(root)) return [];
      seen.add(root);
      return [{ root, label: item.label }];
    });
  }, []);

  const gridClass = workspace.panes.length === 1
    ? "grid-cols-1"
    : workspace.panes.length === 2
      ? "grid-cols-1 lg:grid-cols-2"
      : "grid-cols-1 md:grid-cols-2 md:grid-rows-2";

  return (
    <section data-gamma-chart-workspace className="flex h-[calc(100dvh-54px)] min-h-[620px] shrink-0 flex-col border-b border-border bg-background">
      <div className="kwant-chart-command-row relative flex shrink-0 items-center border-b border-border bg-panel px-3">
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
          <button type="button" onClick={() => setPaneCount(1)} className={`kwant-chart-row-control flex h-7 w-7 items-center justify-center border ${workspace.panes.length === 1 ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted"}`} title="One Gamma chart"><LayoutPanelLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setPaneCount(2)} className={`kwant-chart-row-control flex h-7 w-7 items-center justify-center border ${workspace.panes.length === 2 ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted"}`} title="Two Gamma charts"><span className="flex gap-0.5"><i className="h-3 w-1.5 border border-current" /><i className="h-3 w-1.5 border border-current" /></span></button>
          <button type="button" onClick={() => setPaneCount(4)} className={`kwant-chart-row-control flex h-7 w-7 items-center justify-center border ${workspace.panes.length === 4 ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted"}`} title="Four Gamma charts"><Grid2X2 className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" onClick={() => duplicatePane(activePane.id)} disabled={workspace.panes.length >= 4 || workspace.layoutLocked} className="kwant-chart-row-control flex h-7 items-center gap-1.5 border border-border px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground disabled:opacity-30"><Plus className="h-3 w-3 text-primary" /> Panel</button>
          <button type="button" onClick={() => setWorkspace((current) => ({ ...current, layoutLocked: !current.layoutLocked }))} className={`kwant-chart-row-control flex h-7 w-7 items-center justify-center border ${workspace.layoutLocked ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted"}`} title={workspace.layoutLocked ? "Unlock Gamma workspace" : "Lock Gamma workspace"}>{workspace.layoutLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</button>
          <div className="relative">
            <button type="button" onClick={() => setWorkspaceMenuOpen((open) => !open)} className="kwant-chart-row-control flex h-7 items-center gap-2 border border-border px-2.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground"><Save className="h-3 w-3" /> Workspaces <ChevronDown className="h-3 w-3 text-muted" /></button>
            {workspaceMenuOpen ? (
              <div className="absolute left-1/2 top-[calc(100%+6px)] z-[300] w-64 -translate-x-1/2 border border-border bg-panel p-2 shadow-[0_20px_70px_rgba(0,0,0,.65)]">
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Gamma-only workspaces</div>
                <button type="button" onClick={savePreset} className="mt-1 flex w-full items-center gap-2 px-2 py-2 text-left text-[10px] text-foreground hover:bg-surface"><Save className="h-3.5 w-3.5 text-primary" /> Save current workspace</button>
                <button type="button" onClick={() => { setWorkspace(defaultState()); setWorkspaceMenuOpen(false); }} className="flex w-full items-center gap-2 px-2 py-2 text-left text-[10px] text-foreground hover:bg-surface"><RotateCcw className="h-3.5 w-3.5" /> Reset Gamma workspace</button>
                {presets.length ? <div className="my-1 h-px bg-border" /> : null}
                {presets.map((preset) => (
                  <div key={preset.id} className="flex items-center hover:bg-surface">
                    <button type="button" onClick={() => { setWorkspace(preset.state); setWorkspaceMenuOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-[10px] text-foreground"><Check className="h-3 w-3 text-primary" /><span className="truncate">{preset.name}</span></button>
                    <button type="button" onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))} className="flex h-7 w-7 items-center justify-center text-muted hover:text-danger" aria-label={`Delete ${preset.name}`}><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <span className="mr-auto hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-muted xl:block">Gamma charting</span>
        <span className="ml-auto hidden text-[9px] uppercase tracking-[0.12em] text-muted xl:block">Saved separately from Charts</span>
      </div>

      <div className="kwant-chart-command-row relative flex shrink-0 items-center border-b border-border bg-panel px-3">
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
          {STANDARD_TIMEFRAMES.map((timeframe) => (
            <button key={timeframe} type="button" onClick={() => updatePane({ ...activePane, timeframe })} className={`kwant-chart-row-control h-7 min-w-8 border px-2 text-[10px] font-semibold ${activePane.timeframe === timeframe ? "border-primary/45 bg-primary/10 text-primary" : "border-transparent text-muted hover:text-foreground"}`}>{timeframe}</button>
          ))}
        </div>
        <KwantSelect value={activePane.symbol} onChange={(event) => updatePane({ ...activePane, symbol: event.target.value })} className="kwant-chart-row-control h-7 min-w-44 border border-border bg-surface px-2 text-[10px] font-semibold text-foreground">
          {instruments.map((instrument) => <option key={instrument.root} value={instrument.root}>{instrument.root} · {instrument.label}</option>)}
        </KwantSelect>
        <div className="ml-auto flex items-center gap-2">
          <ChartIndicatorsControl
            instrument={activePane.symbol}
            timeframe={activePane.timeframe}
            indicators={activePane.indicators}
            chartSettings={chartSettings}
            settingsOpenRequest={settingsOpenRequest}
            onChange={(indicators) => updatePane({ ...activePane, indicators })}
          />
          <TimeZoneSelect value={chartSettings.timezone} onChange={(timezone) => setChartSettings((current) => ({ ...current, timezone }))} compact className="w-44" menuLabel="Gamma chart timezone" />
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 gap-px bg-border ${gridClass}`}>
        {workspace.panes.map((pane) => (
          <GammaChartPaneView
            key={pane.id}
            pane={pane}
            active={pane.id === activePane.id}
            chartSettings={{ ...chartSettings, timezone: chartSettings.timezone }}
            canClose={workspace.panes.length > 1}
            onActivate={() => setWorkspace((current) => ({ ...current, activePaneId: pane.id }))}
            onChange={updatePane}
            onDuplicate={() => duplicatePane(pane.id)}
            onClose={() => closePane(pane.id)}
            onOpenIndicatorSettings={(instanceId) => {
              setWorkspace((current) => ({ ...current, activePaneId: pane.id }));
              setSettingsOpenRequest({ instanceId, requestId: Date.now() });
            }}
          />
        ))}
      </div>
    </section>
  );
}
