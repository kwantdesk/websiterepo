"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, CalendarClock, ChevronLeft, ChevronRight, Crown, Download, ExternalLink, HelpCircle, Pause, Play, RefreshCw, Search, Settings2, SlidersHorizontal } from "lucide-react";
import GexCalendarMatrix from "@/components/gex-cal/GexCalendarMatrix";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import type { GexCalCell, GexCalMatrix } from "@/lib/gexCalendar";
import { OPTIONS_FLOW_INSTRUMENTS } from "@/lib/optionsFlow";

type Settings = {
  source: string;
  greek: "GAMMA" | "VANNA" | "DELTA" | "CHARM";
  representation: "RAW" | "PER_ONE_DOLLAR_MOVE" | "PER_ONE_PERCENT_MOVE";
  side: "NET" | "CALL" | "PUT" | "GROSS";
  expiryPreset: "ALL" | "0DTE" | "WEEKLY" | "MONTHLY" | "CUSTOM";
  minDte: number;
  maxDte: number;
  strikeRadius: number;
  minimumMagnitude: number;
  normalization: "GLOBAL" | "COLUMN" | "ROW" | "PERCENTILE";
  differenceMode: boolean;
  baselineMode: "previous-bucket" | "previous-close";
  showKings: boolean;
  showZeros: boolean;
  rightPanelOpen: boolean;
  expirationStart: string;
  expirationEnd: string;
};

const DEFAULTS: Settings = {
  source: "SPX",
  greek: "GAMMA",
  representation: "PER_ONE_PERCENT_MOVE",
  side: "NET",
  expiryPreset: "ALL",
  minDte: 0,
  maxDte: 365,
  strikeRadius: 0,
  minimumMagnitude: 0,
  normalization: "GLOBAL",
  differenceMode: false,
  baselineMode: "previous-bucket",
  showKings: true,
  showZeros: true,
  rightPanelOpen: true,
  expirationStart: "",
  expirationEnd: "",
};
const STORAGE_KEY = "kwantdesk:gex-cal:settings:v1";
const ALERTS_KEY = "kwantdesk:gex-cal:alerts:v1";

const compact = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  if (absolute >= 1e12) return `${sign}${(absolute / 1e12).toFixed(2)}T`;
  if (absolute >= 1e9) return `${sign}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${(absolute / 1e6).toFixed(1)}M`;
  if (absolute >= 1e3) return `${sign}${(absolute / 1e3).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const dateDte = (expiration: string, sessionDate: string) => Math.round((Date.parse(`${expiration}T12:00:00Z`) - Date.parse(`${sessionDate}T12:00:00Z`)) / 86_400_000);
const thirdFriday = (expiration: string) => {
  const date = new Date(`${expiration}T12:00:00Z`);
  return date.getUTCDay() === 5 && date.getUTCDate() >= 15 && date.getUTCDate() <= 21;
};

function savedSettings() {
  if (typeof window === "undefined") return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") } as Settings; } catch { return DEFAULTS; }
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export default function GexCalendarWorkspace() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [matrix, setMatrix] = useState<GexCalMatrix | null>(null);
  const [selected, setSelected] = useState<GexCalCell | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [asOf, setAsOf] = useState("");
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [inspectorTab, setInspectorTab] = useState<"KINGS" | "EXPIRIES" | "STRIKES" | "TERM" | "CLUSTERS" | "DETAIL">("KINGS");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; cell: GexCalCell } | null>(null);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => { setSettings(savedSettings()); setPersistenceReady(true); }, []);
  useEffect(() => { if (persistenceReady && typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [persistenceReady, settings]);

  const load = useCallback(async (quiet = false) => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    if (!quiet) setLoading(true);
    setError("");
    const query = new URLSearchParams({ source: settings.source, greek: settings.greek, side: settings.side, representation: settings.representation, baselineMode: settings.baselineMode });
    if (sessionDate) query.set("sessionDate", sessionDate);
    if (asOf) query.set("asOf", asOf);
    try {
      const response = await fetch(`/api/gex-cal?${query}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "GEX CAL data did not complete.");
      setMatrix(payload as GexCalMatrix);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "GEX CAL data did not complete.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [asOf, sessionDate, settings.baselineMode, settings.greek, settings.representation, settings.side, settings.source]);

  useEffect(() => { void load(); return () => requestRef.current?.abort(); }, [load]);
  useEffect(() => {
    if (!matrix || matrix.status !== "LIVE") return;
    const timer = window.setInterval(() => void load(true), Math.max(4_000, matrix.refreshAfterMs));
    return () => window.clearInterval(timer);
  }, [load, matrix]);
  useEffect(() => {
    if (!playing || !matrix?.availableTimestamps.length) return;
    const timer = window.setInterval(() => {
      const current = asOf ? Date.parse(asOf) : matrix.selectedTimestamp;
      const next = matrix.availableTimestamps.find((timestamp) => timestamp > current);
      if (!next) { setPlaying(false); return; }
      setAsOf(new Date(next).toISOString());
    }, Math.max(100, 1_000 / playSpeed));
    return () => window.clearInterval(timer);
  }, [asOf, matrix, playSpeed, playing]);

  const visibleMatrix = useMemo(() => {
    if (!matrix) return null;
    const spot = matrix.spot;
    const searchNumber = Number(search.replace(/,/g, ""));
    const expirationAllowed = (expiration: string) => {
      const dte = dateDte(expiration, matrix.sessionDate);
      if (dte < settings.minDte || dte > settings.maxDte) return false;
      if (settings.expiryPreset === "0DTE" && dte !== 0) return false;
      if (settings.expiryPreset === "WEEKLY" && (dte < 0 || dte > 7)) return false;
      if (settings.expiryPreset === "MONTHLY" && !thirdFriday(expiration)) return false;
      if (settings.expirationStart && expiration < settings.expirationStart) return false;
      if (settings.expirationEnd && expiration > settings.expirationEnd) return false;
      return true;
    };
    const cells = matrix.cells.filter((cell) => {
      const shownValue = settings.differenceMode ? cell.change ?? 0 : cell.value;
      if (!expirationAllowed(cell.expiration)) return false;
      if (settings.strikeRadius > 0 && spot && Math.abs(cell.strike - spot) > settings.strikeRadius) return false;
      if (settings.minimumMagnitude > 0 && Math.abs(shownValue) < settings.minimumMagnitude) return false;
      if (!settings.showZeros && shownValue === 0) return false;
      if (search && Number.isFinite(searchNumber) && Math.abs(cell.strike - searchNumber) > 0.001) return false;
      return true;
    });
    const expirations = [...new Set(cells.map((cell) => cell.expiration))].sort();
    const strikes = [...new Set(cells.map((cell) => cell.strike))].sort((a, b) => b - a);
    const currentValue = (cell: GexCalCell) => settings.differenceMode ? cell.change ?? 0 : cell.value;
    let globalCell: GexCalCell | null = null;
    const expirationKingCells = new Map<string, GexCalCell>();
    for (const cell of cells) {
      if (!globalCell || Math.abs(currentValue(cell)) > Math.abs(currentValue(globalCell))) globalCell = cell;
      const currentKing = expirationKingCells.get(cell.expiration);
      if (!currentKing || Math.abs(currentValue(cell)) > Math.abs(currentValue(currentKing))) expirationKingCells.set(cell.expiration, cell);
    }
    const king = (cell: GexCalCell) => ({ expiration: cell.expiration, strike: cell.strike, value: currentValue(cell), magnitude: Math.abs(currentValue(cell)) });
    const expirationKings = expirations.flatMap((expiration) => {
      const winner = expirationKingCells.get(expiration);
      return winner ? [king(winner)] : [];
    });
    return { ...matrix, cells, expirations, strikes, globalKing: globalCell ? king(globalCell) : null, expirationKings };
  }, [matrix, search, settings.differenceMode, settings.expirationEnd, settings.expirationStart, settings.expiryPreset, settings.maxDte, settings.minDte, settings.minimumMagnitude, settings.showZeros, settings.strikeRadius]);

  const previousTimestamp = () => {
    if (!matrix) return;
    const current = asOf ? Date.parse(asOf) : matrix.selectedTimestamp;
    const prior = [...matrix.availableTimestamps].reverse().find((timestamp) => timestamp < current);
    if (prior) setAsOf(new Date(prior).toISOString());
  };
  const nextTimestamp = () => {
    if (!matrix) return;
    const current = asOf ? Date.parse(asOf) : matrix.selectedTimestamp;
    const next = matrix.availableTimestamps.find((timestamp) => timestamp > current);
    if (next) setAsOf(new Date(next).toISOString());
  };
  const exportMatrix = (format: "csv" | "json") => {
    if (!visibleMatrix) return;
    if (format === "json") return download(`gex-cal-${visibleMatrix.source}.json`, JSON.stringify(visibleMatrix, null, 2), "application/json");
    const rows = ["expiration,strike,call,put,net,gross,value,previous,change", ...visibleMatrix.cells.map((cell) => [cell.expiration, cell.strike, cell.call, cell.put, cell.net, cell.gross, cell.value, cell.previousValue ?? "", cell.change ?? ""].join(","))];
    download(`gex-cal-${visibleMatrix.source}.csv`, rows.join("\n"), "text/csv");
  };
  const createAlert = (cell: GexCalCell) => {
    const existing = JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]") as unknown[];
    existing.push({ id: crypto.randomUUID(), source: settings.source, greek: settings.greek, expiration: cell.expiration, strike: cell.strike, threshold: cell.value, createdAt: new Date().toISOString(), active: true });
    localStorage.setItem(ALERTS_KEY, JSON.stringify(existing));
    setContext(null);
  };
  const openContext = (cell: GexCalCell) => setContext({ x: Math.min(window.innerWidth - 230, window.innerWidth / 2), y: Math.min(window.innerHeight - 180, window.innerHeight / 2), cell });

  return <div className="flex h-full min-h-0 flex-col bg-background text-foreground" onClick={() => context && setContext(null)}>
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-panel px-3">
      <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /><h1 className="text-[11px] font-semibold uppercase tracking-[0.14em]">GEX CAL</h1><span className="border border-border px-2 py-0.5 font-mono text-[9px] text-muted">EXPIRATION × STRIKE</span></div>
      <div className="flex items-center gap-1">
        <span className={`border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${matrix?.status === "LIVE" ? "border-candle-up/40 text-candle-up" : "border-border text-muted"}`}>{matrix?.status ?? "CONNECTING"}</span>
        <button className="h-7 border border-border px-2 text-muted hover:text-foreground" onClick={() => setHelpOpen((value) => !value)} title="Methodology and diagnostics"><HelpCircle className="h-3.5 w-3.5" /></button>
        <button className="h-7 border border-border px-2 text-muted hover:text-foreground" onClick={() => void load()} title="Refresh"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className={`${filtersOpen ? "w-[244px]" : "w-9"} shrink-0 overflow-hidden border-r border-border bg-panel transition-[width]`}>
        <button className="flex h-9 w-full items-center gap-2 border-b border-border px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-foreground" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal className="h-3.5 w-3.5" />{filtersOpen ? "Surface controls" : null}</button>
        {filtersOpen ? <div className="h-[calc(100%-36px)] space-y-3 overflow-y-auto p-3">
          <Control label="Series"><KwantSelect value={settings.source} onChange={(event) => setSettings((value) => ({ ...value, source: event.target.value }))} className="h-8 w-full">{OPTIONS_FLOW_INSTRUMENTS.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.label}</option>)}</KwantSelect></Control>
          <Control label="Greek"><KwantSelect value={settings.greek} onChange={(event) => setSettings((value) => ({ ...value, greek: event.target.value as Settings["greek"] }))} className="h-8 w-full"><option>GAMMA</option><option>VANNA</option><option>DELTA</option><option>CHARM</option></KwantSelect></Control>
          <Control label="Option side"><KwantSelect value={settings.side} onChange={(event) => setSettings((value) => ({ ...value, side: event.target.value as Settings["side"] }))} className="h-8 w-full"><option>NET</option><option>CALL</option><option>PUT</option><option>GROSS</option></KwantSelect></Control>
          <Control label="Units"><KwantSelect value={settings.representation} onChange={(event) => setSettings((value) => ({ ...value, representation: event.target.value as Settings["representation"] }))} className="h-8 w-full"><option value="RAW">RAW</option><option value="PER_ONE_DOLLAR_MOVE">$1 MOVE</option><option value="PER_ONE_PERCENT_MOVE">1% MOVE</option></KwantSelect></Control>
          <Control label="Expirations"><KwantSelect value={settings.expiryPreset} onChange={(event) => setSettings((value) => ({ ...value, expiryPreset: event.target.value as Settings["expiryPreset"] }))} className="h-8 w-full"><option value="ALL">ALL CURRENT + FUTURE</option><option value="0DTE">0DTE</option><option value="WEEKLY">NEXT 7 DAYS</option><option value="MONTHLY">STANDARD MONTHLIES</option><option value="CUSTOM">CUSTOM DTE</option></KwantSelect></Control>
          <div className="grid grid-cols-2 gap-2"><Control label="Expiry from"><input type="date" value={settings.expirationStart} onChange={(event) => setSettings((value) => ({ ...value, expirationStart: event.target.value }))} className="h-8 w-full border border-border bg-background px-1 font-mono text-[8px] text-foreground [color-scheme:dark]" /></Control><Control label="Expiry to"><input type="date" value={settings.expirationEnd} onChange={(event) => setSettings((value) => ({ ...value, expirationEnd: event.target.value }))} className="h-8 w-full border border-border bg-background px-1 font-mono text-[8px] text-foreground [color-scheme:dark]" /></Control></div>
          <div className="grid grid-cols-2 gap-2"><NumberControl label="Min DTE" value={settings.minDte} onChange={(minDte) => setSettings((value) => ({ ...value, minDte }))} /><NumberControl label="Max DTE" value={settings.maxDte} onChange={(maxDte) => setSettings((value) => ({ ...value, maxDte }))} /></div>
          <NumberControl label="Strike radius (0 = all)" value={settings.strikeRadius} onChange={(strikeRadius) => setSettings((value) => ({ ...value, strikeRadius }))} />
          <NumberControl label="Min absolute exposure" value={settings.minimumMagnitude} onChange={(minimumMagnitude) => setSettings((value) => ({ ...value, minimumMagnitude }))} />
          <Control label="Normalization"><KwantSelect value={settings.normalization} onChange={(event) => setSettings((value) => ({ ...value, normalization: event.target.value as Settings["normalization"] }))} className="h-8 w-full"><option value="GLOBAL">GLOBAL</option><option value="COLUMN">PER EXPIRY</option><option value="ROW">PER STRIKE</option><option value="PERCENTILE">PERCENTILE</option></KwantSelect></Control>
          <Toggle label="Difference mode" checked={settings.differenceMode} onChange={(differenceMode) => setSettings((value) => ({ ...value, differenceMode }))} />
          <Toggle label="King nodes" checked={settings.showKings} onChange={(showKings) => setSettings((value) => ({ ...value, showKings }))} />
          <Toggle label="Show zero cells" checked={settings.showZeros} onChange={(showZeros) => setSettings((value) => ({ ...value, showZeros }))} />
          <Control label="Exercise style"><KwantSelect disabled value="UNAVAILABLE" className="h-8 w-full"><option value="UNAVAILABLE">METADATA UNAVAILABLE</option></KwantSelect></Control>
          <Control label="Settlement / timing"><KwantSelect disabled value="UNAVAILABLE" className="h-8 w-full"><option value="UNAVAILABLE">METADATA UNAVAILABLE</option></KwantSelect></Control>
          <div className="border-t border-border pt-3 text-[9px] leading-4 text-muted"><div>Exercise/settlement metadata: <span className="text-foreground">provider unavailable</span></div><div>Current expirations include contracts active as of the selected timestamp. Future expirations are later listed expiries.</div></div>
        </div> : null}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel px-2 py-1">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Strike" className="h-7 w-24 border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary" />
          <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="h-7 border border-border bg-background px-2 font-mono text-[9px] text-foreground [color-scheme:dark]" />
          <button onClick={previousTimestamp} className="h-7 border border-border px-2 text-muted hover:text-foreground"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => setPlaying((value) => !value)} className="flex h-7 items-center gap-1 border border-border px-2 text-[9px] text-muted hover:text-foreground">{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />} {playing ? "PAUSE" : "PLAY"}</button>
          <button onClick={nextTimestamp} className="h-7 border border-border px-2 text-muted hover:text-foreground"><ChevronRight className="h-3.5 w-3.5" /></button>
          <KwantSelect value={playSpeed} onChange={(event) => setPlaySpeed(Number(event.target.value))} className="h-7 w-20"><option value="1">1×</option><option value="2">2×</option><option value="5">5×</option><option value="10">10×</option></KwantSelect>
          <button onClick={() => { setAsOf(""); setSessionDate(""); }} className="h-7 border border-border px-2 text-[9px] font-semibold text-primary">LIVE</button>
          <span className="ml-auto font-mono text-[9px] text-muted">{matrix ? `${matrix.source} · ${new Date(matrix.selectedTimestamp).toLocaleString()} · ${matrix.cells.length.toLocaleString()} CELLS` : ""}</span>
          <button onClick={() => exportMatrix("csv")} className="h-7 border border-border px-2 text-muted hover:text-foreground" title="Export CSV"><Download className="h-3.5 w-3.5" /></button>
          <button onClick={() => exportMatrix("json")} className="h-7 border border-border px-2 font-mono text-[9px] text-muted hover:text-foreground">JSON</button>
        </div>
        {error && matrix ? <div className="flex h-7 shrink-0 items-center gap-2 border-b border-danger/30 bg-danger/5 px-3 text-[9px] text-danger"><AlertTriangle className="h-3 w-3" />Refresh delayed · showing the latest valid surface · {error}</div> : null}
        <div className="relative flex min-h-0 flex-1">
          {visibleMatrix ? <GexCalendarMatrix matrix={visibleMatrix} differenceMode={settings.differenceMode} normalization={settings.normalization} selected={selected} onSelect={(cell) => { setSelected(cell); setInspectorTab("DETAIL"); }} onOpen={openContext} showKings={settings.showKings} /> : null}
          {loading && !matrix ? <div className="absolute inset-0 z-20 bg-background"><KwantLoader className="h-full" compact title="Loading GEX CAL" detail="Normalizing the expiration-by-strike surface." /></div> : null}
          {!loading && !matrix ? <div className="flex flex-1 items-center justify-center"><div className="max-w-sm border border-danger/40 bg-panel p-6 text-center"><AlertTriangle className="mx-auto mb-3 h-6 w-6 text-danger" /><div className="text-[12px] font-semibold">GEX CAL unavailable</div><p className="mt-2 text-[10px] leading-5 text-muted">{error || "No eligible exposure surface was returned."}</p><button onClick={() => void load()} className="mt-4 border border-primary px-4 py-2 text-[10px] font-semibold text-primary">TRY AGAIN</button></div></div> : null}
        </div>
      </main>

      {settings.rightPanelOpen ? <aside className="w-[284px] shrink-0 overflow-hidden border-l border-border bg-panel">
        <div className="flex h-9 overflow-x-auto border-b border-border">{(["KINGS", "EXPIRIES", "STRIKES", "TERM", "CLUSTERS", "DETAIL"] as const).map((tab) => <button key={tab} onClick={() => setInspectorTab(tab)} className={`shrink-0 px-2 text-[8px] font-semibold tracking-[0.1em] ${inspectorTab === tab ? "text-primary shadow-[inset_0_-1px_0_var(--primary)]" : "text-muted"}`}>{tab}</button>)}</div>
        <div className="h-[calc(100%-36px)] overflow-y-auto p-3">{matrix ? <Inspector matrix={matrix} tab={inspectorTab} selected={selected} differenceMode={settings.differenceMode} onSelect={(cell) => setSelected(cell)} /> : null}</div>
      </aside> : <button className="w-9 border-l border-border bg-panel text-muted" onClick={() => setSettings((value) => ({ ...value, rightPanelOpen: true }))}><Settings2 className="mx-auto h-4 w-4" /></button>}
    </div>

    {helpOpen ? <div className="absolute right-4 top-14 z-50 w-[380px] border border-border bg-panel p-4 shadow-2xl">
      <div className="flex items-center justify-between"><h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]">Methodology & diagnostics</h2><button onClick={() => setHelpOpen(false)} className="text-muted">×</button></div>
      <div className="mt-3 space-y-2 text-[10px] leading-5 text-muted"><p>Each cell is provider-signed call and put exposure for one exact strike and expiration. NET is CALL + PUT; GROSS is |CALL| + |PUT|.</p><p>Missing cells use a hatched state and are never converted to zero. Difference mode subtracts the selected baseline bucket. Replay selects only data at or before its timestamp.</p><p>King = maximum absolute raw cell value after the active filters. Spot is an independent reference and does not select the King.</p><p>Source: KwantData server adapter · no browser credential · {matrix?.cells.length.toLocaleString() ?? 0} current cells.</p>{matrix?.limitations.map((item) => <p key={item}>• {item}</p>)}</div>
    </div> : null}

    {context ? <div className="fixed z-[1000] w-56 border border-border bg-panel p-1 shadow-2xl" style={{ left: context.x, top: context.y }} onClick={(event) => event.stopPropagation()}>
      <ContextButton label="Inspect cell" onClick={() => { setSelected(context.cell); setInspectorTab("DETAIL"); setContext(null); }} />
      <ContextButton label="Open in GEX VUE" icon={<ExternalLink className="h-3 w-3" />} onClick={() => { window.location.href = `/gamvue?symbol=${settings.source}&strike=${context.cell.strike}&expiration=${context.cell.expiration}`; }} />
      <ContextButton label="Open in Charts" icon={<ExternalLink className="h-3 w-3" />} onClick={() => { window.location.href = `/charts?symbol=${settings.source}&strike=${context.cell.strike}`; }} />
      <ContextButton label="Create exposure alert" icon={<Bell className="h-3 w-3" />} onClick={() => createAlert(context.cell)} />
    </div> : null}
  </div>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>{children}</label>; }
function NumberControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Control label={label}><input type="number" min="0" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="h-8 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary" /></Control>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center justify-between text-[9px] text-muted"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-primary" /></label>; }
function ContextButton({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) { return <button onClick={onClick} className="flex h-8 w-full items-center gap-2 px-2 text-left text-[10px] text-muted hover:bg-surface hover:text-foreground">{icon}{label}</button>; }

function Inspector({ matrix, tab, selected, differenceMode, onSelect }: { matrix: GexCalMatrix; tab: string; selected: GexCalCell | null; differenceMode: boolean; onSelect: (cell: GexCalCell) => void }) {
  if (tab === "DETAIL") return selected ? <div className="space-y-3"><Metric label="Expiration" value={selected.expiration} /><Metric label="Strike" value={selected.strike.toLocaleString()} /><Metric label="Call" value={compact(selected.call)} /><Metric label="Put" value={compact(selected.put)} /><Metric label="Net" value={compact(selected.net)} /><Metric label="Gross" value={compact(selected.gross)} /><Metric label="Baseline" value={selected.previousValue === null ? "MISSING" : compact(selected.previousValue)} /><Metric label="Change" value={selected.change === null ? "MISSING" : compact(selected.change)} /></div> : <Empty text="Select a matrix cell." />;
  if (tab === "KINGS") return <div className="space-y-2">{matrix.globalKing ? <div className="border border-primary/50 bg-primary/5 p-3"><div className="flex items-center gap-2 text-[9px] font-semibold text-primary"><Crown className="h-3.5 w-3.5" />GLOBAL KING</div><div className="mt-2 font-mono text-[13px]">{matrix.globalKing.strike.toLocaleString()} · {compact(matrix.globalKing.value)}</div><div className="mt-1 text-[9px] text-muted">{matrix.globalKing.expiration}</div></div> : null}{matrix.expirationKings.map((king) => <button key={king.expiration} onClick={() => { const cell = matrix.cells.find((item) => item.expiration === king.expiration && item.strike === king.strike); if (cell) onSelect(cell); }} className="flex w-full items-center justify-between border border-border p-2 text-left hover:border-primary/40"><span className="text-[9px] text-muted">{king.expiration}<br /><b className="font-mono text-foreground">{king.strike.toLocaleString()}</b></span><span className="font-mono text-[9px]">{compact(king.value)}</span></button>)}</div>;
  if (tab === "EXPIRIES" || tab === "TERM") return <div className="space-y-2">{matrix.totalsByExpiration.map((row) => <div key={row.expiration} className="border-b border-border pb-2"><div className="flex justify-between font-mono text-[9px]"><span>{row.expiration}</span><span className={row.value >= 0 ? "text-candle-up" : "text-candle-down"}>{compact(row.value)}</span></div><div className="mt-1 h-1 bg-background"><div className="h-full bg-primary" style={{ width: `${Math.max(2, Math.min(100, row.magnitude / Math.max(...matrix.totalsByExpiration.map((item) => item.magnitude), 1) * 100))}%` }} /></div></div>)}</div>;
  if (tab === "STRIKES") return <div className="space-y-1">{matrix.strikeKings.slice(0, 80).map((king) => <div key={king.strike} className="flex justify-between border-b border-border py-1 font-mono text-[9px]"><span>{king.strike.toLocaleString()}</span><span>{compact(king.value)}</span></div>)}</div>;
  if (tab === "CLUSTERS") {
    const ranked = [...matrix.cells].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 12);
    return <div className="space-y-2">{ranked.map((cell, index) => <button key={`${cell.expiration}:${cell.strike}`} onClick={() => onSelect(cell)} className="w-full border border-border p-2 text-left hover:border-primary/40"><span className="text-[8px] text-muted">CLUSTER {index + 1}</span><div className="mt-1 flex justify-between font-mono text-[9px]"><span>{cell.strike.toLocaleString()} · {cell.expiration}</span><span>{compact(differenceMode ? cell.change ?? 0 : cell.value)}</span></div></button>)}</div>;
  }
  return null;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-border pb-2"><span className="text-[9px] uppercase tracking-[0.12em] text-muted">{label}</span><span className="font-mono text-[10px] text-foreground">{value}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="border border-dashed border-border p-5 text-center text-[10px] text-muted">{text}</div>; }
