"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowDown, ArrowUp, Braces, Check, ChevronDown, ChevronUp, Download, Expand, GripHorizontal, Info, Play, Search, Settings2, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import KwantSelect from "@/components/ui/KwantSelect";
import KwantDatePicker from "@/components/ui/KwantDatePicker";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import AlgoEquityChart, { algoMoney } from "./AlgoEquityChart";
import {
  ALGO_INSTRUMENTS, ALGO_STORAGE_KEY, ALGO_TEMPLATES, bootstrapAlgoTrades, buildAlgoPreview, defaultAlgoConfig, validateAlgoConfig,
  type AlgoConfig, type AlgoDraft, type AlgoFill, type AlgoInputs, type AlgoInstrument, type AlgoInterval,
} from "@/lib/algoWorkspace";
import "./algo.css";
import { legibleOn } from "@/lib/readableContrast";

const AlgoChart = dynamic(() => import("./AlgoChart"), { ssr: false });
const AlgoMonteCarlo = dynamic(() => import("./AlgoMonteCarlo"), { ssr: false });
// A fixed, explicitly illustrative fixture keeps static HTML and hydration identical.
const INITIAL_CONFIG = defaultAlgoConfig(new Date("2026-10-31T00:00:00Z"));
const INITIAL_RUN = buildAlgoPreview(INITIAL_CONFIG);
const TABS = [["overview", "Overview"], ["trades", "List of trades"], ["risk", "Risk & Monte Carlo"], ["inputs", "Algo settings"]] as const;
type Tab = typeof TABS[number][0];
const ratio = (n: number | null) => n !== null && Number.isFinite(n) ? n.toFixed(2) : "—";
const percent = (n: number) => n.toFixed(2) + "%";
const HOURS = Array.from({ length: 48 }, (_, i) => String(Math.floor(i / 2)).padStart(2, "0") + (i % 2 ? ":30" : ":00"));
const metricAssumptions = "Daily closed-equity returns, weekdays including no-trade days; 252 sessions/year; 0% risk-free and target return. Preview data only.";

function Metric({ label, value, detail, help, tone }: { label: string; value: string; detail?: string; help?: string; tone?: "profit" | "loss" }) {
  return <div className="algo-metric" title={help}><span>{label}{help && <Info size={11} />}</span>
    <strong className={tone ? "algo-" + tone : ""}>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function Numeric({ label, value, onChange, min = 0, max, step = 1 }: {
  label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number;
}) {
  return <label className="algo-field"><span>{label}</span><input aria-label={label} type="number" min={min} max={max} step={step}
    value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} /></label>;
}

export default function AlgoWorkspace() {
  const [config, setConfig] = useState<AlgoConfig>(INITIAL_CONFIG);
  const [run, setRun] = useState(INITIAL_RUN);
  const [interval, setInterval] = useState<AlgoInterval>(1);
  const [chartType, setChartType] = useState<"candles" | "line">("candles");
  const [showTrades, setShowTrades] = useState(true);
  const [fitRevision, setFitRevision] = useState(0);
  const [tab, setTab] = useState<Tab>("overview");
  const [trayHeight, setTrayHeight] = useState(400);
  const [collapsed, setCollapsed] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [drafts, setDrafts] = useState<AlgoDraft[]>([]);
  const [draft, setDraft] = useState<AlgoDraft>({ id: "", name: "", language: "Pine Script", source: "" });
  const [draftSaved, setDraftSaved] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "profit">("recent");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [ready, setReady] = useState(false);
  const [simulations, setSimulations] = useState(120);
  const [seed, setSeed] = useState(42);
  const runTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ pointer: number; y: number; height: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const pending = JSON.stringify(config) !== JSON.stringify(run.config);
  const enabled = ALGO_TEMPLATES.filter((a) => config.algorithms[a.id]?.enabled);
  const m = run.metrics;
  const selected = run.trades.find((t) => t.id === selectedTrade);
  const filteredTrades = useMemo(() => run.trades.filter((t) =>
    tradeFilter === "all" || (tradeFilter === "wins" ? t.net > 0 : tradeFilter === "losses" ? t.net < 0 : t.direction.toLowerCase() === tradeFilter)
  ).sort((a, b) => sort === "profit" ? b.net - a.net : b.entryTime - a.entryTime), [run.trades, tradeFilter, sort]);
  const monteCarlo = useMemo(() => tab === "risk" ? bootstrapAlgoTrades(run.trades, run.config.capital, simulations, seed) : null, [tab, run, simulations, seed]);
  const balances = useMemo(() => new Map(run.trades.map((t, i) => [t.id, run.equity[i + 1].equity])), [run]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ALGO_STORAGE_KEY) ?? "null");
      if (stored?.config && !validateAlgoConfig(stored.config, false)) setConfig(stored.config);
      if (stored?.lastRunConfig && !validateAlgoConfig(stored.lastRunConfig)) setRun(buildAlgoPreview(stored.lastRunConfig));
      if (Array.isArray(stored?.drafts)) setDrafts(stored.drafts.filter((d: AlgoDraft) =>
        typeof d.id === "string" && typeof d.name === "string" && d.name.length <= 80 &&
        ["Pine Script", "NinjaScript"].includes(d.language) && typeof d.source === "string" && d.source.length <= 100000).slice(0, 12));
      if ([1, 5, 15, 60].includes(stored?.interval)) setInterval(stored.interval);
      if (stored?.chartType === "line") setChartType("line");
    } catch { /* A damaged local draft never prevents the workspace opening. */ }
    setReady(true);
    return () => { if (runTimer.current) clearTimeout(runTimer.current); };
  }, []);
  useEffect(() => {
    const sync = () => {
      if (!workspace.current) return;
      const background = getComputedStyle(workspace.current).getPropertyValue("--background").trim() || "#000000";
      workspace.current.style.setProperty("--algo-profit", legibleOn("#22c55e", background, 4.5));
      workspace.current.style.setProperty("--algo-loss", legibleOn("#ef4444", background, 4.5));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    window.addEventListener("kwantdesk:theme-change", sync);
    return () => { observer.disconnect(); window.removeEventListener("kwantdesk:theme-change", sync); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(ALGO_STORAGE_KEY, JSON.stringify({ config, lastRunConfig: run.config, drafts, interval, chartType }));
      setStorageError("");
    } catch { setStorageError("Browser storage is full. Changes are available until this tab closes."); }
  }, [ready, config, run.config, drafts, interval, chartType]);

  function updateConfig<K extends keyof AlgoConfig>(key: K, value: AlgoConfig[K]) {
    if (running && runTimer.current) { clearTimeout(runTimer.current); runTimer.current = null; setRunning(false); }
    setError(""); setConfig((current) => ({ ...current, [key]: value }));
  }
  function updateAlgo(id: string, key: keyof AlgoInputs, value: number | boolean) {
    updateConfig("algorithms", { ...config.algorithms, [id]: { ...config.algorithms[id], [key]: value } });
  }
  function runPreview() {
    if (runTimer.current) return;
    const invalid = validateAlgoConfig(config);
    if (invalid) { setError(invalid); setCollapsed(false); return; }
    setRunning(true); setError("");
    const snapshot = structuredClone(config);
    runTimer.current = setTimeout(() => {
      try { setRun(buildAlgoPreview(snapshot)); setSelectedTrade(null); setCollapsed(false); }
      catch (e) { setError(e instanceof Error ? e.message : "The preview could not be prepared."); }
      finally { setRunning(false); runTimer.current = null; }
    }, 300);
  }
  function beginResize(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setCollapsed(false);
    drag.current = { pointer: e.pointerId, y: e.clientY, height: collapsed ? 200 : trayHeight };
  }
  function resizeTray(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    setTrayHeight(Math.max(180, Math.min(window.innerHeight - 300, drag.current.height + drag.current.y - e.clientY)));
  }
  function exportTrades() {
    const rows = [["Dataset", "Algo", "Instrument", "Side", "Entry UTC", "Exit UTC", "Entry", "Exit", "SL", "TP", "Contracts", "Exit reason", "Gross USD", "Costs USD", "Net USD", "R"],
      ...filteredTrades.map((t) => ["ILLUSTRATIVE PREVIEW", t.algo, run.config.instrument, t.direction, new Date(t.entryTime).toISOString(), new Date(t.exitTime).toISOString(),
        t.entryPrice, t.exitPrice, t.stopPrice, t.targetPrice, t.quantity, t.reason, t.gross, t.costs, t.net, t.r])];
    const csv = rows.map((row) => row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "kwantdesk-algo-PREVIEW-" + run.config.instrument + ".csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function saveDraft() {
    if (!draft.name.trim() || !draft.source.trim()) { setImportError("Give the import a name and paste or choose a script."); return; }
    if (draft.source.length > 100000) { setImportError("Keep this placeholder script below 100,000 characters."); return; }
    if (!draft.id && drafts.length >= 12) { setImportError("Keep up to 12 local script drafts."); return; }
    const saved = { ...draft, name: draft.name.trim().slice(0, 80), id: draft.id || crypto.randomUUID() };
    setDrafts((current) => [...current.filter((d) => d.id !== saved.id), saved]); setDraft(saved); setDraftSaved(true); setImportError("");
  }
  const tradeTime = (timestamp: number) => new Date(timestamp).toLocaleString("en-GB", {
    timeZone: run.config.timeZone, month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const revealTrade = (trade: AlgoFill) => { setSelectedTrade(trade.id); if (collapsed) setCollapsed(false); };

  const library = <div className="algo-library">
    <div className="algo-section-title"><Braces size={14} /> Algorithms <span>{enabled.length} enabled</span></div>
    <label className="algo-search"><Search size={13} /><input aria-label="Search algos" placeholder="Search algos…" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} /></label>
    {ALGO_TEMPLATES.filter((a) => a.name.toLowerCase().includes(librarySearch.toLowerCase())).map((algo) => <div className={"algo-library-item " + (config.algorithms[algo.id].enabled ? "is-enabled" : "")} key={algo.id}>
      <div><button type="button" role="switch" aria-checked={config.algorithms[algo.id].enabled} aria-label={"Enable " + algo.name}
        className="algo-toggle" onClick={() => updateAlgo(algo.id, "enabled", !config.algorithms[algo.id].enabled)}><span /></button>
        <button type="button" className="algo-template-name" onClick={() => { setTab("inputs"); setCollapsed(false); }}>{algo.name}</button></div>
      <small>Preview template</small>
    </div>)}
    {drafts.filter((a) => a.name.toLowerCase().includes(librarySearch.toLowerCase())).map((d) => <button type="button" key={d.id} className="algo-draft-row"
      onClick={() => { setDraft(d); setDraftSaved(false); setImportOpen(true); }}><Braces size={13} /><span>{d.name}<small>{d.language} · draft</small></span></button>)}
    <button type="button" className="algo-library-import" onClick={() => { setImportOpen(true); setDraft({ id: "", name: "", language: "Pine Script", source: "" }); setDraftSaved(false); }}><Upload size={13} /> Import an algo</button>
    <p className="algo-library-note">Templates and results are an interface preview. Your strategy engine will connect here.</p>
  </div>;

  return <div ref={workspace} className="algo-workspace" data-testid="algo-workspace">
    <AppSidebar activeItem="algo" orientation="horizontal" />
    <header className="algo-toolbar">
      <div className="algo-toolbar-group">
        <span className="algo-title"><Braces size={16} /> ALGO</span><span className="algo-divider" />
        <KwantSelect aria-label="Algo instrument" value={config.instrument} onChange={(e) => updateConfig("instrument", e.target.value as AlgoInstrument)}>
          {Object.entries(ALGO_INSTRUMENTS).map(([key, v]) => <option key={key} value={key}>{key} · {v.name}</option>)}
        </KwantSelect>
        <div className="algo-intervals" aria-label="Chart timeframe">{([1, 5, 15, 60] as const).map((n) => <button type="button" key={n} aria-pressed={interval === n} onClick={() => setInterval(n)}>{n === 60 ? "1 h" : n + " m"}</button>)}</div>
        <KwantSelect aria-label="Price chart type" value={chartType} onChange={(e) => setChartType(e.target.value as "candles" | "line")}><option value="candles">Candles</option><option value="line">Line</option></KwantSelect>
      </div>
      <div className="algo-toolbar-group">
        <button type="button" aria-pressed={showTrades} onClick={() => setShowTrades(!showTrades)}><ArrowUp size={13} /> Fills</button>
        <button type="button" title="Fit entire test window" aria-label="Fit chart" onClick={() => setFitRevision((n) => n + 1)}><Expand size={14} /></button>
        <button type="button" onClick={() => { setCollapsed(false); setTab("inputs"); }}><SlidersHorizontal size={13} /> Algos</button>
        <button type="button" aria-expanded={importOpen} onClick={() => setImportOpen(!importOpen)}><Upload size={13} /> Import algo</button>
      </div>
    </header>

    <div className="algo-main">
      <section className="algo-chart-panel">
        <div className="algo-chart-caption"><strong>{run.config.instrument}</strong><span>· {ALGO_INSTRUMENTS[run.config.instrument].name}</span>
          <span className="algo-preview-badge">Interface preview · not live data</span>
          {pending && <button type="button" className="algo-pending" onClick={runPreview}>Inputs changed · run preview</button>}
        </div>
        <AlgoChart run={run} interval={interval} chartType={chartType} showTrades={showTrades} selectedTrade={selectedTrade} fitRevision={fitRevision} />
        <div className="algo-chart-foot">
          <span>{run.config.from} — {run.config.to} · {run.config.timeZone}</span>
          <span><i className="algo-long-dot" /> Long <i className="algo-short-dot" /> Short · TP / SL / Exit</span>
        </div>
        {selected && <div className="algo-selected-trade"><span>{selected.algo} · {selected.direction} · {selected.reason}</span>
          <strong className={selected.net >= 0 ? "algo-profit" : "algo-loss"}>{algoMoney(selected.net)}</strong>
          <button type="button" aria-label="Deselect trade" onClick={() => setSelectedTrade(null)}><X size={12} /></button></div>}
      </section>
      {importOpen && <aside className="algo-import-panel" aria-label="Import algorithm">
        <div className="algo-import-title"><strong>Import an algo</strong><button type="button" aria-label="Close import" onClick={() => setImportOpen(false)}><X size={15} /></button></div>
        <p>Add your script now. Compilation and execution will be connected to the backend later.</p>
        {(importError || storageError) && <p role="alert">{importError || storageError}</p>}
        <label className="algo-field"><span>Name</span><input aria-label="Algorithm name" placeholder="My strategy" maxLength={80} value={draft.name} onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setDraftSaved(false); }} /></label>
        <label className="algo-field"><span>Script format</span><KwantSelect aria-label="Script format" value={draft.language}
          onChange={(e) => { setDraft({ ...draft, language: e.target.value as AlgoDraft["language"] }); setDraftSaved(false); }}><option>Pine Script</option><option>NinjaScript</option></KwantSelect></label>
        <button type="button" className="algo-file-button" onClick={() => fileInput.current?.click()}><Upload size={14} /> Choose script file</button>
        <input ref={fileInput} type="file" accept=".pine,.cs,.txt" className="algo-file-input" aria-label="Choose algorithm script file" onChange={async (e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          if (file.size > 200000) { setImportError("Choose a script smaller than 200 KB."); return; }
          try { const source = await file.text(); setDraft((d) => ({ ...d, source, name: d.name || file.name.replace(/\.[^.]+$/, "").slice(0, 80), language: file.name.endsWith(".cs") ? "NinjaScript" : d.language })); setDraftSaved(false); }
          catch { setImportError("That script could not be read."); }
        }} />
        <label className="algo-field algo-source-field"><span>Source code</span><textarea spellCheck={false} aria-label="Algorithm source code" maxLength={100000}
          placeholder={draft.language === "Pine Script" ? "// Paste your Pine Script here\n// Saved as a draft; no script is executed." : "// Paste your NinjaScript here\n// Saved as a draft; no script is executed."}
          value={draft.source} onChange={(e) => { setDraft({ ...draft, source: e.target.value }); setDraftSaved(false); }} /></label>
        <div className="algo-import-actions"><button type="button" className="algo-primary-button" onClick={saveDraft}>{draftSaved && !storageError ? <Check size={14} /> : <Braces size={14} />}{draftSaved && !storageError ? "Draft saved" : "Save draft"}</button>
          {draft.id && <button type="button" aria-label="Remove script draft" onClick={() => { setDrafts((d) => d.filter((a) => a.id !== draft.id)); setDraft({ id: "", name: "", language: "Pine Script", source: "" }); setDraftSaved(false); }}><Trash2 size={14} /></button>}</div>
        <small>Drafts stay in this browser. Imports are placeholders and cannot place trades.</small>
      </aside>}
    </div>

    <section className="algo-tester" style={{ height: collapsed ? 39 : "min(" + trayHeight + "px, calc(100dvh - 300px))" }} aria-label="Strategy tester">
      <div className="algo-resizer" role="separator" aria-label="Resize strategy tester" aria-orientation="horizontal" aria-valuemin={180} aria-valuemax={1200}
        aria-valuenow={trayHeight} tabIndex={0} onPointerDown={beginResize} onPointerMove={resizeTray}
        onPointerUp={(e) => { drag.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setCollapsed(false); setTrayHeight((h) => Math.max(180, Math.min(window.innerHeight - 300, h + (e.key === "ArrowUp" ? 32 : -32)))); } }}>
        <GripHorizontal size={17} />
      </div>
      <div className="algo-tester-heading">
        <button type="button" className="algo-tester-title" onClick={() => setCollapsed(!collapsed)}><Braces size={14} /> Strategy tester {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
        <nav className="algo-tabs" aria-label="Strategy results">{TABS.map(([id, label]) => <button type="button" key={id} aria-current={tab === id ? "page" : undefined}
          onClick={() => { setTab(id); setCollapsed(false); }}>{label}</button>)}</nav>
        <div className="algo-tester-actions"><span className="algo-preview-label">PREVIEW</span>
          <button type="button" title="Export visible preview trades" aria-label="Export trades CSV" onClick={exportTrades}><Download size={14} /></button>
          <button type="button" aria-label="Expand strategy tester" onClick={() => { setCollapsed(false); const max = window.innerHeight - 300; setTrayHeight(trayHeight >= max - 20 ? Math.min(400, max * .6) : max); }}><Expand size={13} /></button>
          <button type="button" className="algo-primary-button" disabled={running || enabled.length === 0} onClick={runPreview}><Play size={12} fill="currentColor" />{running ? "Preparing…" : "Run preview"}</button>
        </div>
      </div>
      {!collapsed && <>
        <div className="algo-test-range">
          <span>Test window</span><KwantDatePicker label="Test start date" value={config.from} max={config.to} onChange={(v) => updateConfig("from", v)} />
          <span className="algo-range-dash">—</span><KwantDatePicker label="Test end date" value={config.to} min={config.from} onChange={(v) => updateConfig("to", v)} />
          <span className="algo-divider" /><span>Session</span>
          <KwantSelect aria-label="Session start" value={config.sessionStart} onChange={(e) => updateConfig("sessionStart", e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</KwantSelect>
          <span>—</span><KwantSelect aria-label="Session end" value={config.sessionEnd} onChange={(e) => updateConfig("sessionEnd", e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</KwantSelect>
          <TimeZoneSelect value={config.timeZone} onChange={(v) => updateConfig("timeZone", v)} referenceTimestampMs={Date.parse(config.from + "T12:00:00Z")} compact />
        </div>
        {(error || storageError) && <div className="algo-inline-error" role="status">{error || storageError}<button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setStorageError(""); }}><X size={12} /></button></div>}
        <div className="algo-tester-body">
          <aside className="algo-library-aside">{library}</aside>
          <div className="algo-results">
            {tab === "overview" && <>
              <div className="algo-hero-metrics">
                <Metric label="Net profit" value={algoMoney(m.net)} detail={percent(m.returnPercent) + " return · after costs"} tone={m.net >= 0 ? "profit" : "loss"} />
                <Metric label="Win rate" value={percent(m.winRate)} detail={m.wins + " wins / " + m.losses + " losses"} />
                <Metric label="Profit factor" value={ratio(m.profitFactor)} detail={m.trades + " closed trades"} help="Sum of positive net trade P&L divided by absolute negative net trade P&L. — means no losses." />
                <Metric label="Max drawdown" value={algoMoney(m.maxDrawdown)} detail={percent(m.maxDrawdownPercent) + " peak-to-trough"} tone="loss" />
              </div>
              <AlgoEquityChart points={run.equity} timeZone={run.config.timeZone} onSelect={(t) => { const trade = run.trades.find((a) => a.exitTime === t); if (trade) revealTrade(trade); }} />
              <AlgoEquityChart points={run.equity} timeZone={run.config.timeZone} drawdown />
              <div className="algo-section-title algo-quant-heading">Quantitative performance <span>Illustrative results</span></div>
              <div className="algo-quant-grid">
                <Metric label="Sharpe ratio" value={ratio(m.sharpe)} help={metricAssumptions + " Sample standard deviation."} />
                <Metric label="Sortino ratio" value={ratio(m.sortino)} help={metricAssumptions + " Downside deviation includes all sampled days."} />
                <Metric label="Calmar ratio" value={ratio(m.calmar)} help="Annualized geometric closed-equity return / maximum drawdown percentage. 252 sessions/year." />
                <Metric label="Recovery factor" value={ratio(m.recovery)} help="Net profit / maximum monetary drawdown." />
                <Metric label="Expectancy" value={algoMoney(m.expectancy)} help="Average net P&L per closed trade, after commission and slippage." />
                <Metric label="Average R" value={ratio(m.averageR) + " R"} help="Net P&L / initial stop risk, averaged over closed trades." />
                <Metric label="Average winner" value={algoMoney(m.averageWin)} />
                <Metric label="Average loser" value={algoMoney(m.averageLoss)} />
                <Metric label="Payoff ratio" value={ratio(m.payoff)} help="Average net winner / average absolute net loser." />
                <Metric label="Average hold" value={m.averageMinutes.toFixed(1) + " min"} />
                <Metric label="Longest loss streak" value={String(m.consecutiveLosses)} />
                <Metric label="Total costs" value={algoMoney(run.trades.reduce((sum, t) => sum + t.costs, 0))} detail="Commission + slippage" />
              </div>
              <button type="button" className="algo-risk-link" onClick={() => setTab("risk")}>Explore 3D Monte Carlo & risk <ArrowUp size={13} /></button>
            </>}
            {tab === "trades" && <>
              <div className="algo-trade-filters"><span>{filteredTrades.length} / {run.trades.length} preview trades · click a row to locate it on the chart</span>
                <KwantSelect aria-label="Filter trades" value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}><option value="all">All trades</option><option value="long">Long</option><option value="short">Short</option><option value="wins">Winners</option><option value="losses">Losers</option></KwantSelect>
                <KwantSelect aria-label="Sort trades" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "profit")}><option value="recent">Newest first</option><option value="profit">Highest P&L</option></KwantSelect>
              </div>
              <div className="algo-trades-scroll"><table className="algo-trades"><thead><tr>{["Algo / side", "Entry", "Exit", "Entry price", "Exit price", "SL / TP", "Qty", "Hold", "Reason", "Net P&L", "R", "Balance"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{filteredTrades.map((t) => <tr key={t.id} className={selectedTrade === t.id ? "is-selected" : ""} tabIndex={0}
                  onClick={() => revealTrade(t)} onKeyDown={(e) => { if (e.key === "Enter") revealTrade(t); }}>
                  <td><strong>{ALGO_TEMPLATES.find((a) => a.id === t.algoId)?.short}</strong><span className={t.direction === "Long" ? "algo-profit" : "algo-loss"}>{t.direction === "Long" ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{t.direction}</span></td>
                  <td>{tradeTime(t.entryTime)}</td><td>{tradeTime(t.exitTime)}</td><td>{t.entryPrice.toFixed(2)}</td><td>{t.exitPrice.toFixed(2)}</td>
                  <td>{t.stopPrice.toFixed(2)} / {t.targetPrice.toFixed(2)}</td><td>{t.quantity}</td><td>{((t.exitTime - t.entryTime) / 60000).toFixed(0)}m</td><td>{t.reason}</td>
                  <td className={t.net >= 0 ? "algo-profit" : "algo-loss"}>{algoMoney(t.net)}</td><td>{t.r.toFixed(2)}</td><td>{algoMoney(balances.get(t.id) ?? 0)}</td>
                </tr>)}</tbody></table>
                {!filteredTrades.length && <p className="algo-empty">No trades match this filter.</p>}
              </div>
            </>}
            {tab === "risk" && monteCarlo && <>
              <div className="algo-risk-controls"><div><strong>Robustness lab</strong><span>Bootstrap resampling of preview trade P&L · not a forecast</span></div>
                <KwantSelect aria-label="Monte Carlo paths" value={simulations} onChange={(e) => setSimulations(Number(e.target.value))}><option value={120}>120 paths</option><option value={240}>240 paths</option></KwantSelect>
                <button type="button" onClick={() => setSeed((s) => s + 1)}>Resample</button>
              </div>
              <div className="algo-hero-metrics">
                <Metric label="5th percentile" value={algoMoney(monteCarlo.p5)} detail="Terminal equity" />
                <Metric label="Median outcome" value={algoMoney(monteCarlo.p50)} detail="Terminal equity" />
                <Metric label="95th percentile" value={algoMoney(monteCarlo.p95)} detail="Terminal equity" />
                <Metric label="Loss probability" value={percent(monteCarlo.lossProbability)} detail="Finishing below starting equity" />
              </div>
              <AlgoMonteCarlo result={monteCarlo} capital={run.config.capital} />
              <div className="algo-risk-foot"><span>{simulations} paths × {monteCarlo.paths[0]?.length ? monteCarlo.paths[0].length - 1 : 0} trades · sampled with replacement · seed {seed}</span>
                <span>50% capital-loss threshold: {percent(monteCarlo.ruinProbability)} of paths</span></div>
              <p className="algo-method-note">Paths use fixed-size trade P&L after costs, without compounding. They illustrate sequence risk only; independent resampling does not reproduce market regimes or establish a strategy’s edge.</p>
            </>}
            {tab === "inputs" && <div className="algo-inputs">
              <div className="algo-mobile-library">{library}</div>
              <div className="algo-section-title"><Settings2 size={14} /> Run settings <span>Changes apply on Run preview</span></div>
              <div className="algo-settings-grid">
                <Numeric label="Starting capital · USD" value={config.capital} min={100} max={1e9} step={1000} onChange={(v) => updateConfig("capital", v)} />
                <Numeric label="Contracts per trade" value={config.contracts} min={1} max={100} onChange={(v) => updateConfig("contracts", v)} />
                <Numeric label="Commission · per side / contract" value={config.commission} max={1000} step={.25} onChange={(v) => updateConfig("commission", v)} />
                <Numeric label="Slippage · ticks per side" value={config.slippageTicks} max={100} step={.25} onChange={(v) => updateConfig("slippageTicks", v)} />
              </div>
              {ALGO_TEMPLATES.map((algo) => <section className="algo-parameter-card" key={algo.id}>
                <div className="algo-parameter-heading"><div><strong>{algo.name}</strong><span>{algo.detail}</span></div>
                  <button type="button" role="switch" className="algo-toggle" aria-label={"Run " + algo.name} aria-checked={config.algorithms[algo.id].enabled}
                    onClick={() => updateAlgo(algo.id, "enabled", !config.algorithms[algo.id].enabled)}><span /></button></div>
                <div className="algo-settings-grid algo-three-columns">
                  <Numeric label={algo.short + " · lookback minutes"} value={config.algorithms[algo.id].lookback} min={1} max={300} onChange={(v) => updateAlgo(algo.id, "lookback", v)} />
                  <Numeric label={algo.short + " · stop ticks"} value={config.algorithms[algo.id].stopTicks} min={1} max={2000} onChange={(v) => updateAlgo(algo.id, "stopTicks", v)} />
                  <Numeric label={algo.short + " · target ticks"} value={config.algorithms[algo.id].targetTicks} min={1} max={4000} onChange={(v) => updateAlgo(algo.id, "targetTicks", v)} />
                </div>
              </section>)}
              <p className="algo-method-note">These templates demonstrate the controls and report layout. They do not implement or validate the named trading strategies. Preview bars are generated examples; bracket touches use 1-minute bars with stop-first handling when both prices are touched. Display timeframe does not change preview fills.</p>
            </div>}
          </div>
        </div>
      </>}
    </section>
  </div>;
}
