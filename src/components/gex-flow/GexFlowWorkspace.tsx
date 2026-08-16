"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bell, Blocks, ChevronDown, ChevronRight, Columns3, Download,
  ExternalLink, Filter, Layers3, Pause, Play, Plus, RefreshCw, Search, Settings2,
  Sparkles, X,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import { OPTIONS_FLOW_INSTRUMENTS } from "@/lib/optionsFlow";
import {
  gexFlowContractKey,
  scoreGexFlowRows,
  summarizeGexFlow,
  type GexFlowContractRatio,
  type GexFlowMode,
  type GexFlowPayload,
  type GexFlowRow,
  type GexFlowSide,
} from "@/lib/gexFlow";

const STORAGE_KEY = "kwantdesk:gex-flow:workspace:v1";
const ALERTS_KEY = "kwantdesk:gex-flow:alerts:v1";
const ROW_HEIGHT = 34;

type Filters = {
  query: string;
  contract: "BOTH" | "CALL" | "PUT";
  side: "ALL" | "ASK_SIDE" | "BID_SIDE" | GexFlowSide;
  assetType: "ALL" | "STOCK" | "ETF" | "INDEX";
  minPremium: number;
  minSize: number;
  maxDte: number;
  minOtm: number;
  minFlow: number;
  minAskRatio: number;
  minBidRatio: number;
  sweepOnly: boolean;
  blockOnly: boolean;
  multiLegOnly: boolean;
  openingOnly: boolean;
  unusualOnly: boolean;
  sizeOiOnly: boolean;
  volumeOiOnly: boolean;
};

type SavedScreen = { id: string; name: string; filters: Filters };
type ColumnKey = "time" | "ticker" | "contract" | "otm" | "expiration" | "fill" | "spread" | "side" | "score" | "ratio" | "size" | "premium" | "volume" | "oi" | "deltaOi" | "spot" | "iv" | "voi" | "strategy";

const DEFAULT_FILTERS: Filters = {
  query: "", contract: "BOTH", side: "ALL", assetType: "ALL", minPremium: 0, minSize: 0,
  maxDte: 9999, minOtm: -999, minFlow: -100, minAskRatio: 0, minBidRatio: 0,
  sweepOnly: false, blockOnly: false, multiLegOnly: false, openingOnly: false,
  unusualOnly: false, sizeOiOnly: false, volumeOiOnly: false,
};

const BUILT_INS: SavedScreen[] = [
  { id: "main", name: "MAIN", filters: DEFAULT_FILTERS },
  { id: "large-unusual", name: "LARGE UNUSUAL ORDERS", filters: { ...DEFAULT_FILTERS, minPremium: 250_000, unusualOnly: true } },
  { id: "high-bet", name: "HIGH BET OPENING", filters: { ...DEFAULT_FILTERS, minFlow: 65, openingOnly: true } },
  { id: "0dte", name: "0DTE SWEEPS", filters: { ...DEFAULT_FILTERS, maxDte: 0, sweepOnly: true } },
  { id: "mega", name: "MEGA PREMIUM", filters: { ...DEFAULT_FILTERS, minPremium: 1_000_000 } },
  { id: "volume-oi", name: "VOLUME > OI", filters: { ...DEFAULT_FILTERS, volumeOiOnly: true } },
  { id: "size-oi", name: "SIZE > OI", filters: { ...DEFAULT_FILTERS, sizeOiOnly: true } },
  { id: "far-otm", name: "FAR OTM", filters: { ...DEFAULT_FILTERS, minOtm: 10 } },
  { id: "leaps", name: "LEAPS FLOW", filters: { ...DEFAULT_FILTERS, maxDte: 9999, minPremium: 100_000 } },
  { id: "ask-heavy", name: "ASK-HEAVY", filters: { ...DEFAULT_FILTERS, minAskRatio: 0.8 } },
  { id: "bid-heavy", name: "BID-HEAVY", filters: { ...DEFAULT_FILTERS, minBidRatio: 0.8 } },
  { id: "multi-leg", name: "MULTI-LEG", filters: { ...DEFAULT_FILTERS, multiLegOnly: true } },
  { id: "golden", name: "GOLDEN SWEEPS", filters: { ...DEFAULT_FILTERS, sweepOnly: true, minPremium: 500_000 } },
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  time: "DATE / TIME", ticker: "TICKER", contract: "STRIKE · C/P", otm: "OTM", expiration: "EXP · DTE",
  fill: "FILL", spread: "SPREAD", side: "SIDE", score: "FLOW SCORE", ratio: "CONTRACT RATIO", size: "SIZE",
  premium: "PREM", volume: "VOL", oi: "OI", deltaOi: "ΔOI", spot: "SPOT", iv: "IV", voi: "V/OI", strategy: "STRATEGY",
};
const DEFAULT_COLUMNS: ColumnKey[] = Object.keys(COLUMN_LABELS) as ColumnKey[];
const WIDTHS: Record<ColumnKey, number> = { time: 132, ticker: 82, contract: 118, otm: 66, expiration: 104, fill: 74, spread: 142, side: 68, score: 90, ratio: 132, size: 72, premium: 88, volume: 70, oi: 70, deltaOi: 68, spot: 76, iv: 62, voi: 68, strategy: 130 };

function compact(value: number | null, currency = false) {
  if (value === null || !Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? "∞" : "—";
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const prefix = currency ? "$" : "";
  if (absolute >= 1e9) return `${sign}${prefix}${(absolute / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${sign}${prefix}${(absolute / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${sign}${prefix}${(absolute / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${absolute.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function percentage(value: number | null, digits = 0) { return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`; }
function sideAsk(side: GexFlowSide) { return side === "ASK" || side === "ABOVE_ASK"; }
function sideBid(side: GexFlowSide) { return side === "BID" || side === "BELOW_BID"; }

function filterRows(rows: GexFlowRow[], filters: Filters) {
  const query = filters.query.trim().toUpperCase();
  return rows.filter((row) => {
    if (query && !`${row.ticker} ${row.osi ?? ""} ${row.strikePrice ?? ""} ${row.strategy ?? ""}`.toUpperCase().includes(query)) return false;
    if (filters.contract !== "BOTH" && row.contractType !== filters.contract) return false;
    if (filters.assetType !== "ALL" && row.underlyingType !== filters.assetType) return false;
    if (filters.side === "ASK_SIDE" && !sideAsk(row.side)) return false;
    if (filters.side === "BID_SIDE" && !sideBid(row.side)) return false;
    if (!(["ALL", "ASK_SIDE", "BID_SIDE"] as string[]).includes(filters.side) && row.side !== filters.side) return false;
    if (row.premium < filters.minPremium || row.size < filters.minSize) return false;
    if ((row.dte ?? Number.POSITIVE_INFINITY) > filters.maxDte) return false;
    if ((row.moneynessPercent ?? Number.NEGATIVE_INFINITY) < filters.minOtm) return false;
    if (row.flowScore < filters.minFlow) return false;
    if (row.contractRatio.askRatio < filters.minAskRatio || row.contractRatio.bidRatio < filters.minBidRatio) return false;
    if (filters.sweepOnly && !row.sweep) return false;
    if (filters.blockOnly && !row.block) return false;
    if (filters.multiLegOnly && !row.multiLeg) return false;
    if (filters.openingOnly && !row.opening) return false;
    if (filters.unusualOnly && !row.unusual) return false;
    if (filters.sizeOiOnly && !row.sizeGreaterThanOi) return false;
    if (filters.volumeOiOnly && !row.volumeGreaterThanOi) return false;
    return true;
  });
}

function download(name: string, content: string, mime: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type: mime }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export default function GexFlowWorkspace() {
  const [symbol, setSymbol] = useState("SPX");
  const [mode, setMode] = useState<GexFlowMode>("HYBRID");
  const [payload, setPayload] = useState<GexFlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [refreshMode, setRefreshMode] = useState("AUTO");
  const [sessionDate, setSessionDate] = useState("");
  const [replayTime, setReplayTime] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState("main");
  const [screens, setScreens] = useState<SavedScreen[]>(BUILT_INS);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [selected, setSelected] = useState<GexFlowRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [resultLimit, setResultLimit] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortField, setSortField] = useState<"TIME" | "PREMIUM" | "SIZE" | "SCORE" | "VOI">("TIME");
  const pendingPayload = useRef<GexFlowPayload | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const ratioFetchInFlight = useRef(false);
  const lastRatioFetch = useRef({ signature: "", at: 0 });

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!stored) return;
      if (typeof stored.symbol === "string") setSymbol(stored.symbol);
      if (["CONSOLIDATED", "RAW", "HYBRID"].includes(stored.mode)) setMode(stored.mode);
      if (Array.isArray(stored.screens)) setScreens(stored.screens);
      if (Array.isArray(stored.columns)) setColumns(stored.columns);
      if (stored.filters) setFilters({ ...DEFAULT_FILTERS, ...stored.filters });
      if (typeof stored.activeScreen === "string") setActiveScreen(stored.activeScreen);
    } catch { /* Account/local state is optional. */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ symbol, mode, screens, columns, filters, activeScreen }));
  }, [symbol, mode, screens, columns, filters, activeScreen]);

  const load = useCallback(async (silent = false) => {
    if (!silent && !payload) setLoading(true);
    const params = new URLSearchParams({ symbol, mode, size: String(resultLimit) });
    if (sessionDate) params.set("sessionDate", sessionDate);
    if (sessionDate && replayTime) params.set("replayAt", new Date(`${sessionDate}T${replayTime}:00`).toISOString());
    try {
      const response = await fetch(`/api/gex-flow?${params}`, { cache: "no-store" });
      const next = await response.json() as GexFlowPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "GEX FLOW request failed.");
      if (paused) pendingPayload.current = next;
      else setPayload(next);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "GEX FLOW request failed.");
    } finally { setLoading(false); }
  }, [symbol, mode, resultLimit, sessionDate, replayTime, paused, payload]);

  useEffect(() => { void load(); }, [symbol, mode, resultLimit, sessionDate, replayTime]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const intervalMs = refreshMode === "MANUAL" ? 0 : refreshMode === "AUTO" ? payload?.refreshAfterMs ?? 5_000 : Number(refreshMode) * 1_000;
    if (!intervalMs || sessionDate) return;
    const id = window.setInterval(() => void load(true), Math.max(2_000, intervalMs));
    return () => window.clearInterval(id);
  }, [refreshMode, payload?.refreshAfterMs, sessionDate, load]);

  useEffect(() => {
    if (!payload || ratioFetchInFlight.current) return;
    const contracts = [...new Map([...payload.rows, ...payload.children].map((row) => [gexFlowContractKey(row), {
      osi: row.osi,
      ticker: row.ticker,
      expirationDate: row.expirationDate,
      strikePrice: row.strikePrice,
      contractType: row.contractType,
    }])).values()].filter((contract) => contract.contractType !== "UNKNOWN" && contract.expirationDate && contract.strikePrice !== null);
    if (!contracts.length) return;
    const signature = `${payload.sessionDate}:${payload.replayAt ?? "LIVE"}:${contracts.map((contract) => `${contract.osi ?? contract.ticker}:${contract.expirationDate}:${contract.strikePrice}:${contract.contractType}`).sort().join("|")}`;
    const now = Date.now();
    if (lastRatioFetch.current.signature === signature && now - lastRatioFetch.current.at < 60_000) return;
    lastRatioFetch.current = { signature, at: now };
    ratioFetchInFlight.current = true;
    const targetSession = payload.sessionDate;
    const targetReplay = payload.replayAt;
    void (async () => {
      let resolved = 0;
      let unavailable = 0;
      for (let index = 0; index < contracts.length; index += 25) {
        const response = await fetch("/api/gex-flow/ratios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            contracts: contracts.slice(index, index + 25),
            sessionDate: targetSession,
            replayAt: targetReplay,
          }),
        });
        const result = await response.json() as {
          ratios?: Record<string, GexFlowContractRatio>;
          unavailable?: number;
          requested?: number;
          source?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "Contract ratios could not be enriched.");
        const ratioMap = result.ratios ?? {};
        resolved += Object.keys(ratioMap).length;
        unavailable += result.unavailable ?? 0;
        setPayload((current) => {
          if (!current || current.sessionDate !== targetSession || current.replayAt !== targetReplay) return current;
          const enrich = (rows: GexFlowRow[]) => scoreGexFlowRows(rows.map((row) => ({
            ...row,
            contractRatio: ratioMap[gexFlowContractKey(row)] ?? row.contractRatio,
          })));
          const rows = enrich(current.rows);
          const children = enrich(current.children);
          return {
            ...current,
            rows,
            children,
            summary: summarizeGexFlow(rows, current.summary.relativeVolume),
            diagnostics: {
              ...current.diagnostics,
              contractRatioSource: `${result.source ?? "QuantData exact-contract trade-side VOLUME statistics"} (${resolved}/${contracts.length} contracts)`,
              limitations: unavailable > 0
                ? [...current.diagnostics.limitations.filter((item) => !item.includes("exact-contract ratios")), `${unavailable} exact-contract ratios are unavailable; no parent-row ratio was fabricated.`]
                : current.diagnostics.limitations.filter((item) => !item.includes("exact-contract ratios")),
            },
          };
        });
      }
    })().catch(() => {
      // Ratios are progressive enrichment. The primary tape remains usable and
      // explicitly displays UNAVAILABLE instead of inventing a row-level ratio.
    }).finally(() => { ratioFetchInFlight.current = false; });
  }, [payload]);

  const togglePaused = () => {
    setPaused((value) => {
      if (value && pendingPayload.current) { setPayload(pendingPayload.current); pendingPayload.current = null; }
      return !value;
    });
  };
  const visibleRows = useMemo(() => {
    const next = filterRows(payload?.rows ?? [], filters);
    return [...next].sort((left, right) => sortField === "PREMIUM" ? right.premium - left.premium : sortField === "SIZE" ? right.size - left.size : sortField === "SCORE" ? right.flowScore - left.flowScore : sortField === "VOI" ? (right.volumeToOi ?? -1) - (left.volumeToOi ?? -1) : right.tradeTime - left.tradeTime);
  }, [payload?.rows, filters, sortField]);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== "query" && value !== DEFAULT_FILTERS[key as keyof Filters]).length + (filters.query ? 1 : 0);
  const viewportHeight = tableRef.current?.clientHeight ?? 560;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 8);
  const endIndex = Math.min(visibleRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + 8);
  const renderedRows = visibleRows.slice(startIndex, endIndex);
  const totalWidth = columns.reduce((sum, column) => sum + WIDTHS[column], 0) + 28;

  const chooseScreen = (screen: SavedScreen) => { setActiveScreen(screen.id); setFilters({ ...screen.filters }); setScrollTop(0); };
  const addScreen = () => {
    const next = { id: crypto.randomUUID(), name: `SCREEN ${screens.length + 1}`, filters: { ...filters } };
    setScreens((value) => [...value, next]); setActiveScreen(next.id);
  };
  const createAlert = () => {
    const current = JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]") as unknown[];
    current.push({ id: crypto.randomUUID(), screenId: activeScreen, symbol, filters, createdAt: new Date().toISOString(), active: true });
    localStorage.setItem(ALERTS_KEY, JSON.stringify(current));
  };
  const exportRows = (format: "CSV" | "JSON") => {
    if (format === "JSON") return download(`gex-flow-${symbol}.json`, JSON.stringify(visibleRows, null, 2), "application/json");
    const header = ["time", "ticker", "contract", "expiration", "fill", "side", "score", "size", "premium", "volume", "oi", "vOi", "strategy"];
    const lines = visibleRows.map((row) => [new Date(row.tradeTime).toISOString(), row.ticker, `${row.strikePrice ?? ""}${row.contractType[0] ?? ""}`, row.expirationDate ?? "", row.fill ?? "", row.side, row.flowScore, row.size, row.premium, row.volume ?? "", row.openInterest ?? "", row.volumeToOi ?? "", row.strategy ?? ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    download(`gex-flow-${symbol}.csv`, [header.join(","), ...lines].join("\n"), "text/csv");
  };
  const loadMore = async () => {
    if (!payload?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams({ symbol, mode, size: String(resultLimit), cursor: payload.nextCursor.join("|") });
    if (sessionDate) params.set("sessionDate", sessionDate);
    if (sessionDate && replayTime) params.set("replayAt", new Date(`${sessionDate}T${replayTime}:00`).toISOString());
    try {
      const response = await fetch(`/api/gex-flow?${params}`, { cache: "no-store" });
      const next = await response.json() as GexFlowPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "The next GEX FLOW page could not be loaded.");
      setPayload((current) => current ? {
        ...next,
        rows: [...current.rows, ...next.rows.filter((row) => !current.rows.some((existing) => existing.id === row.id))],
        children: [...current.children, ...next.children.filter((row) => !current.children.some((existing) => existing.id === row.id))],
      } : next);
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The next GEX FLOW page could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

  const activeSavedScreen = screens.find((screen) => screen.id === activeScreen) ?? null;
  const isBuiltInScreen = BUILT_INS.some((screen) => screen.id === activeScreen);
  const duplicateScreen = () => {
    if (!activeSavedScreen) return;
    const next = { ...activeSavedScreen, id: crypto.randomUUID(), name: `${activeSavedScreen.name} COPY`, filters: { ...filters } };
    setScreens((current) => [...current, next]);
    setActiveScreen(next.id);
  };
  const renameScreen = () => {
    if (!activeSavedScreen || isBuiltInScreen) return;
    const name = window.prompt("Rename saved GEX FLOW screen", activeSavedScreen.name)?.trim();
    if (!name) return;
    setScreens((current) => current.map((screen) => screen.id === activeScreen ? { ...screen, name } : screen));
  };
  const deleteScreen = () => {
    if (isBuiltInScreen) return;
    setScreens((current) => current.filter((screen) => screen.id !== activeScreen));
    chooseScreen(BUILT_INS[0]);
  };
  const moveScreen = (direction: -1 | 1) => {
    if (isBuiltInScreen) return;
    setScreens((current) => {
      const index = current.findIndex((screen) => screen.id === activeScreen);
      const target = Math.max(BUILT_INS.length, Math.min(current.length - 1, index + direction));
      if (index < BUILT_INS.length || target === index) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col bg-background text-foreground">
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-panel px-2">
      <Layers3 className="h-4 w-4 text-primary" /><h1 className="text-[11px] font-semibold uppercase tracking-[0.14em]">GEX FLOW</h1><span className="border border-border px-2 py-0.5 font-mono text-[8px] text-muted">OPTIONS FLOW SEEKER</span>
      <div className="ml-auto flex items-center gap-1"><StatusBadge payload={payload} paused={paused} /><button onClick={() => setDiagnosticsOpen((value) => !value)} className="h-7 border border-border px-2 text-muted hover:text-foreground" title="Diagnostics"><Settings2 className="h-3.5 w-3.5" /></button></div>
    </header>

    <div className="flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-panel px-2">
      {screens.map((screen) => <button key={screen.id} onClick={() => chooseScreen(screen)} className={`h-7 shrink-0 border px-2 text-[8px] font-semibold uppercase tracking-[0.1em] ${activeScreen === screen.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"}`}>{screen.name}</button>)}
      <button onClick={addScreen} className="flex h-7 shrink-0 items-center gap-1 border border-border px-2 text-[8px] text-muted"><Plus className="h-3 w-3" /> NEW SCREEN</button>
      <button onClick={duplicateScreen} className="h-7 shrink-0 border border-border px-2 text-[8px] text-muted">DUPLICATE</button>
      {!isBuiltInScreen ? <><button onClick={renameScreen} className="h-7 shrink-0 border border-border px-2 text-[8px] text-muted">RENAME</button><button onClick={() => moveScreen(-1)} className="h-7 w-7 shrink-0 border border-border text-[9px] text-muted">←</button><button onClick={() => moveScreen(1)} className="h-7 w-7 shrink-0 border border-border text-[9px] text-muted">→</button><button onClick={deleteScreen} className="h-7 shrink-0 border border-danger/40 px-2 text-[8px] text-danger">DELETE</button></> : null}
    </div>

    <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-1 border-b border-border bg-panel px-2 py-1">
      <div className="relative"><Search className="pointer-events-none absolute left-2 top-2 h-3 w-3 text-muted" /><input value={filters.query} onChange={(event) => setFilters((value) => ({ ...value, query: event.target.value }))} placeholder="SEARCH CONTRACT" className="h-7 w-40 border border-border bg-background pl-7 pr-2 font-mono text-[9px] outline-none focus:border-primary" /></div>
      <KwantSelect value={symbol} onChange={(event) => setSymbol(event.target.value)} className="h-7 w-36">{OPTIONS_FLOW_INSTRUMENTS.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.label}</option>)}</KwantSelect>
      <KwantSelect value={mode} onChange={(event) => setMode(event.target.value as GexFlowMode)} className="h-7 w-32"><option value="HYBRID">HYBRID</option><option value="CONSOLIDATED">CONSOLIDATED</option><option value="RAW">RAW TAPE</option></KwantSelect>
      <button onClick={togglePaused} className={`flex h-7 items-center gap-1 border px-2 text-[8px] font-semibold ${paused ? "border-warning/50 text-warning" : "border-primary/40 text-primary"}`}>{paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}{paused ? "RESUME" : "PAUSE LIVE FEED"}</button>
      <KwantSelect value={refreshMode} onChange={(event) => setRefreshMode(event.target.value)} className="h-7 w-20"><option>AUTO</option><option value="2">2s</option><option value="5">5s</option><option value="10">10s</option><option value="30">30s</option><option>MANUAL</option></KwantSelect>
      <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="h-7 border border-border bg-background px-2 font-mono text-[8px] [color-scheme:dark]" />
      {sessionDate ? <input type="time" step="60" value={replayTime} onChange={(event) => setReplayTime(event.target.value)} className="h-7 border border-border bg-background px-2 font-mono text-[8px] [color-scheme:dark]" title="Replay clock" /> : null}
      {sessionDate ? <button onClick={() => { setSessionDate(""); setReplayTime(""); }} className="h-7 border border-primary/40 px-2 text-[8px] text-primary">LIVE</button> : null}
      <span className="ml-auto font-mono text-[8px] text-muted">{visibleRows.length.toLocaleString()} RESULTS</span>
      <KwantSelect value={resultLimit} onChange={(event) => setResultLimit(Number(event.target.value))} className="h-7 w-20">{[25, 50, 100].map((value) => <option key={value}>{value}</option>)}</KwantSelect>
      <KwantSelect value={sortField} onChange={(event) => setSortField(event.target.value as typeof sortField)} className="h-7 w-28"><option value="TIME">TIME ↓</option><option value="PREMIUM">PREMIUM ↓</option><option value="SIZE">SIZE ↓</option><option value="SCORE">SCORE ↓</option><option value="VOI">V/OI ↓</option></KwantSelect>
      <button onClick={() => setFiltersOpen((value) => !value)} className="flex h-7 items-center gap-1 border border-border px-2 text-[8px] text-muted"><Filter className="h-3 w-3" />FILTERS {activeFilterCount ? <b className="text-primary">{activeFilterCount}</b> : null}</button>
      <button onClick={() => setColumnsOpen((value) => !value)} className="flex h-7 items-center gap-1 border border-border px-2 text-[8px] text-muted"><Columns3 className="h-3 w-3" />COLUMNS</button>
      <button onClick={createAlert} className="h-7 border border-border px-2 text-muted" title="Alert on this saved screen"><Bell className="h-3.5 w-3.5" /></button>
      <button onClick={() => exportRows("CSV")} className="h-7 border border-border px-2 text-muted" title="Export CSV"><Download className="h-3.5 w-3.5" /></button>
      <button onClick={() => exportRows("JSON")} className="h-7 border border-border px-2 font-mono text-[8px] text-muted">JSON</button>
      <button onClick={() => void load()} className="h-7 border border-border px-2 text-muted"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
    </div>

    {payload ? <SummaryBar payload={payload} /> : null}
    <QuickFilters filters={filters} setFilters={setFilters} />
    {error && payload ? <div className="flex h-7 shrink-0 items-center gap-2 border-b border-warning/30 bg-warning/5 px-3 text-[9px] text-warning"><AlertTriangle className="h-3 w-3" />REFRESH DELAYED · SHOWING LAST VALID TAPE · {error}</div> : null}

    <div className="relative flex min-h-0 flex-1">
      {filtersOpen ? <FilterDrawer filters={filters} setFilters={setFilters} onClose={() => setFiltersOpen(false)} /> : null}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto" ref={tableRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
          <div className="sticky top-0 z-20 flex h-8 w-full border-b border-border bg-panel" style={{ minWidth: totalWidth }}><div className="w-7 shrink-0" />{columns.map((column) => <div key={column} className="flex shrink-0 grow items-center border-r border-border px-2 text-[7px] font-semibold uppercase tracking-[0.12em] text-muted" style={{ width: WIDTHS[column], minWidth: WIDTHS[column] }}>{COLUMN_LABELS[column]}</div>)}</div>
          <div className="relative w-full" style={{ height: visibleRows.length * ROW_HEIGHT, minWidth: totalWidth }}>
            {renderedRows.map((row, offset) => <FlowRow key={row.id} row={row} columns={columns} top={(startIndex + offset) * ROW_HEIGHT} selected={selected?.id === row.id} expanded={expanded === row.id} onSelect={() => setSelected(row)} onExpand={() => setExpanded((value) => value === row.id ? null : row.id)} />)}
          </div>
        </div>
        {payload?.nextCursor ? <button onClick={() => void loadMore()} disabled={loadingMore} className="h-8 shrink-0 border-t border-border bg-panel text-[8px] font-semibold text-primary disabled:opacity-50">{loadingMore ? "LOADING NEXT PAGE…" : "LOAD MORE"}</button> : null}
      </main>
      {selected ? <FlowDrilldown row={selected} payload={payload} onClose={() => setSelected(null)} /> : null}
    </div>

    {loading && !payload ? <div className="absolute inset-0 z-40 bg-background"><KwantLoader className="h-full" compact title="Loading GEX FLOW" detail="Normalizing consolidated flow, raw tape and contract context." /></div> : null}
    {!loading && !payload ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-background"><div className="border border-danger/40 bg-panel p-6 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-danger" /><div className="mt-3 text-[11px] font-semibold">GEX FLOW UNAVAILABLE</div><p className="mt-2 max-w-sm text-[9px] leading-4 text-muted">{error || "No real provider rows were returned."}</p><button onClick={() => void load()} className="mt-4 border border-primary px-4 py-2 text-[9px] text-primary">TRY AGAIN</button></div></div> : null}
    {columnsOpen ? <ColumnsPopover columns={columns} setColumns={setColumns} onClose={() => setColumnsOpen(false)} /> : null}
    {diagnosticsOpen && payload ? <Diagnostics payload={payload} onClose={() => setDiagnosticsOpen(false)} /> : null}
  </div>;
}

function StatusBadge({ payload, paused }: { payload: GexFlowPayload | null; paused: boolean }) {
  const status = paused ? "PAUSED" : payload?.status ?? "CONNECTING";
  const active = status === "LIVE";
  return <span className={`border px-2 py-1 font-mono text-[8px] font-semibold ${active ? "border-candle-up/40 text-candle-up" : status === "STALE" ? "border-warning/40 text-warning" : "border-border text-muted"}`}>{status}{payload ? ` · ${new Date(payload.asOf).toLocaleTimeString()}` : ""}</span>;
}

function SummaryBar({ payload }: { payload: GexFlowPayload }) {
  const summary = payload.summary;
  const metrics = [
    ["BIAS", summary.bias], ["NET FLOW", compact(summary.netFlow, true)], ["CALLS", `${compact(summary.callContracts)} · ${compact(summary.callPremium, true)}`],
    ["PUTS", `${compact(summary.putContracts)} · ${compact(summary.putPremium, true)}`], ["P/C", summary.putCallRatio?.toFixed(2) ?? "—"],
    ["RVOL", summary.relativeVolume === null ? "UNAVAILABLE" : `${summary.relativeVolume.toFixed(2)}×`], ["SWEEP / BLOCK", `${summary.sweepCount} / ${summary.blockCount}`],
    ["UNUSUAL", String(summary.unusualCount)], ["OPENING", String(summary.openingCount)], ["SIZE>OI / VOL>OI", `${summary.sizeOiCount} / ${summary.volumeOiCount}`],
  ];
  return <div className="grid shrink-0 grid-cols-5 border-b border-border bg-panel xl:grid-cols-10">{metrics.map(([label, value]) => <div key={label} className="border-r border-border px-2 py-1.5"><div className="text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div><div className={`mt-0.5 truncate font-mono text-[9px] ${label === "BIAS" ? value === "BULLISH" ? "text-candle-up" : value === "BEARISH" ? "text-candle-down" : "text-muted" : "text-foreground"}`}>{value}</div></div>)}</div>;
}

function QuickFilters({ filters, setFilters }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>> }) {
  const chips: Array<[string, keyof Filters, unknown]> = [["CALLS", "contract", "CALL"], ["PUTS", "contract", "PUT"], ["ASK+", "side", "ASK_SIDE"], ["BID-", "side", "BID_SIDE"], ["SWEEPS", "sweepOnly", true], ["BLOCKS", "blockOnly", true], ["OPENING", "openingOnly", true], ["UNUSUAL", "unusualOnly", true], ["SIZE>OI", "sizeOiOnly", true], ["VOL>OI", "volumeOiOnly", true]];
  return <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-panel px-2">{chips.map(([label, key, value]) => { const active = filters[key] === value; return <button key={label} onClick={() => setFilters((current) => ({ ...current, [key]: active ? DEFAULT_FILTERS[key] : value }))} className={`h-6 shrink-0 border px-2 text-[7px] font-semibold ${active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted"}`}>{label}</button>; })}<button onClick={() => setFilters(DEFAULT_FILTERS)} className="ml-auto h-6 shrink-0 px-2 text-[7px] text-muted hover:text-foreground">RESET</button></div>;
}

function FlowRow({ row, columns, top, selected, expanded, onSelect, onExpand }: { row: GexFlowRow; columns: ColumnKey[]; top: number; selected: boolean; expanded: boolean; onSelect: () => void; onExpand: () => void }) {
  const strong = row.sizeGreaterThanOi && row.volumeGreaterThanOi ? "bg-primary/[0.09] shadow-[inset_3px_0_0_var(--primary)]" : row.sizeGreaterThanOi ? "bg-warning/[0.06] shadow-[inset_2px_0_0_var(--warning)]" : row.volumeGreaterThanOi ? "bg-candle-up/[0.05] shadow-[inset_2px_0_0_var(--candle-up)]" : "";
  return <div className={`absolute left-0 flex h-[34px] cursor-pointer border-b border-border/65 text-[8px] hover:bg-surface ${selected ? "bg-primary/[0.08]" : strong}`} style={{ top, right: 0 }} onClick={onSelect}>
    <button onClick={(event) => { event.stopPropagation(); onExpand(); }} className="flex w-7 shrink-0 items-center justify-center text-muted">{row.childCount > 1 ? expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" /> : null}</button>
    {columns.map((column) => <FlowCell key={column} column={column} row={row} />)}
  </div>;
}

function FlowCell({ column, row }: { column: ColumnKey; row: GexFlowRow }) {
  let content: React.ReactNode = "—";
  if (column === "time") content = <span title={new Date(row.tradeTime).toISOString()}>{new Date(row.tradeTime).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 })}</span>;
  if (column === "ticker") content = <span className="flex items-center gap-1 font-semibold text-foreground">{row.multiLeg ? <Layers3 className="h-3 w-3 text-violet-400" /> : row.sweep ? <Sparkles className="h-3 w-3 text-warning" /> : null}{row.ticker}{row.childCount > 1 ? <b className="text-primary">×{row.childCount}</b> : null}</span>;
  if (column === "contract") content = <span className={row.contractType === "CALL" ? "text-candle-up" : row.contractType === "PUT" ? "text-candle-down" : "text-muted"}>{row.strikePrice?.toLocaleString() ?? "—"} {row.contractType[0]}</span>;
  if (column === "otm") content = <span>{row.moneynessType} {percentage(row.moneynessPercent, 1)}</span>;
  if (column === "expiration") content = <span>{row.expirationDate ?? "—"} · {row.dte ?? "—"}</span>;
  if (column === "fill") content = <span title={row.fillKind === "WEIGHTED_AVERAGE" ? "Weighted Average Fill" : "Provider fill"}>{compact(row.fill)}</span>;
  if (column === "spread") content = <SpreadCell row={row} />;
  if (column === "side") content = <span title={`${row.sideSource === "ESTIMATED" ? "Estimated Side · " : ""}${row.side}`}>{row.side === "ABOVE_ASK" ? "AA" : row.side === "BELOW_BID" ? "BB" : row.side}</span>;
  if (column === "score") content = <span className={row.flowScore > 0 ? "text-candle-up" : row.flowScore < 0 ? "text-candle-down" : "text-muted"} title={`KwantDesk Flow Score · ${row.flowScore} · ${row.flowScoreBreakdown.directionSource} direction`}>{row.flowScore > 0 ? "+" : ""}{row.flowScore}</span>;
  if (column === "ratio") content = <RatioCell row={row} />;
  if (column === "size") content = compact(row.size);
  if (column === "premium") content = <b>{compact(row.premium, true)}</b>;
  if (column === "volume") content = compact(row.volume);
  if (column === "oi") content = <span title="Official/reference OI, not a live open-position count.">{compact(row.openInterest)}</span>;
  if (column === "deltaOi") content = row.deltaOpenInterest === null ? "—" : `${row.deltaOpenInterest > 0 ? "↑" : row.deltaOpenInterest < 0 ? "↓" : "—"} ${compact(Math.abs(row.deltaOpenInterest))}`;
  if (column === "spot") content = compact(row.stockPrice);
  if (column === "iv") content = percentage(row.impliedVolatility === null ? null : row.impliedVolatility * 100, 1);
  if (column === "voi") content = row.volumeToOi === null ? "—" : row.volumeToOi === Number.POSITIVE_INFINITY ? "NEW / ∞" : `${row.volumeToOi.toFixed(2)}×`;
  if (column === "strategy") content = <span>{row.strategy ?? row.consolidationType}{row.strategyConfidence !== "UNAVAILABLE" ? ` · ${row.strategyConfidence}` : ""}</span>;
  return <div className="flex shrink-0 grow items-center overflow-hidden border-r border-border/45 px-2 font-mono" style={{ width: WIDTHS[column], minWidth: WIDTHS[column] }}><span className="truncate">{content}</span></div>;
}

function SpreadCell({ row }: { row: GexFlowRow }) {
  const position = row.spreadPosition === null ? null : Math.max(0, Math.min(1, row.spreadPosition));
  return <div className="w-full" title={`Bid ${row.bid ?? "—"} · Mid ${row.mid ?? "—"} · Ask ${row.ask ?? "—"} · Fill ${row.fill ?? "—"} · Spread ${row.spreadWidth ?? "—"}`}><div className="relative h-px w-full bg-muted/45">{position !== null ? <span className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 border border-background bg-primary" style={{ left: `${position * 100}%` }} /> : null}</div><div className="mt-1 flex justify-between text-[6px] text-muted"><span>B</span><span>A</span></div></div>;
}

function RatioCell({ row }: { row: GexFlowRow }) {
  const ratio = row.contractRatio;
  if (ratio.source === "UNAVAILABLE") return <span className="text-muted">UNAVAILABLE</span>;
  return <div className="w-full" title={`Bid ${(ratio.bidRatio * 100).toFixed(0)}% · Mid ${(ratio.midRatio * 100).toFixed(0)}% · Ask ${(ratio.askRatio * 100).toFixed(0)}% · ${ratio.totalContracts.toLocaleString()} classified contracts`}><div className="mb-1 flex justify-between"><b>{ratio.dominant}</b><span>{(Math.max(ratio.askRatio, ratio.midRatio, ratio.bidRatio) * 100).toFixed(0)}%</span></div><div className="flex h-1 overflow-hidden bg-surface"><i className="bg-candle-down" style={{ width: `${ratio.bidRatio * 100}%` }} /><i className="bg-muted" style={{ width: `${ratio.midRatio * 100}%` }} /><i className="bg-candle-up" style={{ width: `${ratio.askRatio * 100}%` }} /></div></div>;
}

function FilterDrawer({ filters, setFilters, onClose }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>>; onClose: () => void }) {
  const updateNumber = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: Number(value) || 0 }));
  return <aside className="w-[260px] shrink-0 overflow-y-auto border-r border-border bg-panel p-3"><div className="mb-3 flex items-center justify-between"><b className="text-[9px] uppercase tracking-[0.14em]">FILTER BUILDER</b><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div>
    <div className="space-y-3"><Control label="Calls / Puts"><KwantSelect value={filters.contract} onChange={(event) => setFilters((value) => ({ ...value, contract: event.target.value as Filters["contract"] }))} className="h-8 w-full"><option>BOTH</option><option>CALL</option><option>PUT</option></KwantSelect></Control><Control label="Execution side"><KwantSelect value={filters.side} onChange={(event) => setFilters((value) => ({ ...value, side: event.target.value as Filters["side"] }))} className="h-8 w-full"><option>ALL</option><option value="ASK_SIDE">AGGRESSIVE ASK SIDE</option><option value="BID_SIDE">AGGRESSIVE BID SIDE</option><option>ABOVE_ASK</option><option>ASK</option><option>MID</option><option>BID</option><option>BELOW_BID</option></KwantSelect></Control><Control label="Asset type"><KwantSelect value={filters.assetType} onChange={(event) => setFilters((value) => ({ ...value, assetType: event.target.value as Filters["assetType"] }))} className="h-8 w-full"><option>ALL</option><option>STOCK</option><option>ETF</option><option>INDEX</option></KwantSelect></Control>
      <NumberField label="Minimum premium" value={filters.minPremium} onChange={(value) => updateNumber("minPremium", value)} /><NumberField label="Minimum size" value={filters.minSize} onChange={(value) => updateNumber("minSize", value)} /><NumberField label="Maximum DTE" value={filters.maxDte} onChange={(value) => updateNumber("maxDte", value)} /><NumberField label="Minimum OTM %" value={filters.minOtm} onChange={(value) => updateNumber("minOtm", value)} /><NumberField label="Minimum Flow Score" value={filters.minFlow} onChange={(value) => updateNumber("minFlow", value)} /><NumberField label="Minimum Ask Ratio (0..1)" value={filters.minAskRatio} onChange={(value) => updateNumber("minAskRatio", value)} /><NumberField label="Minimum Bid Ratio (0..1)" value={filters.minBidRatio} onChange={(value) => updateNumber("minBidRatio", value)} />
      {(["sweepOnly", "blockOnly", "multiLegOnly", "openingOnly", "unusualOnly", "sizeOiOnly", "volumeOiOnly"] as const).map((key) => <label key={key} className="flex items-center justify-between text-[8px] uppercase tracking-[0.1em] text-muted"><span>{key.replace(/([A-Z])/g, " $1")}</span><input type="checkbox" checked={filters[key]} onChange={(event) => setFilters((value) => ({ ...value, [key]: event.target.checked }))} className="accent-primary" /></label>)}
      <button onClick={() => setFilters(DEFAULT_FILTERS)} className="h-8 w-full border border-primary/40 text-[8px] font-semibold text-primary">RESET FILTERS</button>
    </div></aside>;
}

function ColumnsPopover({ columns, setColumns, onClose }: { columns: ColumnKey[]; setColumns: React.Dispatch<React.SetStateAction<ColumnKey[]>>; onClose: () => void }) {
  return <div className="absolute right-3 top-[118px] z-50 w-60 border border-border bg-panel p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><b className="text-[9px]">COLUMNS</b><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div><div className="max-h-[420px] space-y-1 overflow-y-auto">{DEFAULT_COLUMNS.map((column) => <label key={column} className="flex h-7 items-center justify-between border-b border-border/60 text-[8px] text-muted"><span>{COLUMN_LABELS[column]}</span><input type="checkbox" checked={columns.includes(column)} onChange={(event) => setColumns((current) => event.target.checked ? [...current, column] : current.filter((item) => item !== column))} className="accent-primary" /></label>)}</div><button onClick={() => setColumns(DEFAULT_COLUMNS)} className="mt-2 h-7 w-full border border-border text-[8px] text-primary">RESET DEFAULT</button></div>;
}

function FlowDrilldown({ row, payload, onClose }: { row: GexFlowRow; payload: GexFlowPayload | null; onClose: () => void }) {
  const contractRows = (payload?.children.length ? payload.children : payload?.rows ?? []).filter((item) => (item.osi && row.osi ? item.osi === row.osi : item.ticker === row.ticker && item.strikePrice === row.strikePrice && item.expirationDate === row.expirationDate && item.contractType === row.contractType)).sort((a, b) => a.tradeTime - b.tradeTime);
  const maxSize = Math.max(1, ...contractRows.map((item) => item.size));
  return <aside className="w-[520px] shrink-0 overflow-y-auto border-l border-border bg-panel"><div className="sticky top-0 z-10 flex h-9 items-center border-b border-border bg-panel px-3"><Blocks className="mr-2 h-4 w-4 text-primary" /><b className="text-[9px] uppercase tracking-[0.12em]">FLOW DRILLDOWN · {row.ticker} {row.strikePrice}{row.contractType[0]} · {row.expirationDate}</b><button onClick={onClose} className="ml-auto"><X className="h-4 w-4 text-muted" /></button></div>
    <div className="grid grid-cols-2 gap-px bg-border"><section className="bg-background p-3"><div className="text-[8px] text-muted">CONTRACT FLOW · VOLUME HEIGHT · SIDE COMPOSITION</div><div className="mt-3 flex h-36 items-end gap-1 border-b border-border">{contractRows.slice(-60).map((item) => <button key={item.id} className="group relative min-w-[3px] flex-1 bg-surface" style={{ height: `${Math.max(3, item.size / maxSize * 100)}%` }} title={`${new Date(item.tradeTime).toLocaleTimeString()} · ${item.size} · ${item.side}`}><span className="absolute inset-x-0 bottom-0 bg-candle-down" style={{ height: `${item.contractRatio.bidRatio * 100}%` }} /><span className="absolute inset-x-0 top-0 bg-candle-up" style={{ height: `${item.contractRatio.askRatio * 100}%` }} /></button>)}</div></section><section className="bg-background p-3"><div className="text-[8px] text-muted">UNDERLYING CONTEXT</div><svg className="mt-3 h-36 w-full" viewBox="0 0 240 120" preserveAspectRatio="none"><polyline fill="none" stroke="var(--primary)" strokeWidth="1.5" points={contractRows.filter((item) => item.stockPrice !== null).map((item, index, all) => { const prices = all.map((entry) => entry.stockPrice!); const min = Math.min(...prices); const max = Math.max(...prices); return `${index / Math.max(1, all.length - 1) * 240},${110 - ((item.stockPrice! - min) / Math.max(0.0001, max - min)) * 100}`; }).join(" ")} /></svg></section></div>
    <div className="grid grid-cols-3 gap-px border-y border-border bg-border">{[["SIDE", `${row.side}${row.sideSource === "ESTIMATED" ? " · ESTIMATED" : ""}`], ["FLOW SCORE", `${row.flowScore} · KWANT DERIVED`], ["CONTRACT RATIO", `${row.contractRatio.dominant} ${(Math.max(row.contractRatio.askRatio, row.contractRatio.bidRatio, row.contractRatio.midRatio) * 100).toFixed(0)}%`], ["SIZE / OI", `${compact(row.size)} / ${compact(row.openInterest)}`], ["VOLUME / OI", row.volumeToOi === Number.POSITIVE_INFINITY ? "NEW / ∞" : row.volumeToOi === null ? "—" : `${row.volumeToOi.toFixed(2)}×`], ["IV REACTION", row.ivReaction]].map(([label, value]) => <div key={label} className="bg-panel p-3"><div className="text-[7px] text-muted">{label}</div><div className="mt-1 font-mono text-[9px]">{value}</div></div>)}</div>
    <div className="p-3"><div className="mb-2 flex items-center gap-2 text-[8px] font-semibold text-muted">RELATED CONTRACT ACTIVITY <span className="font-normal">CANDIDATES ONLY</span></div><div className="max-h-56 overflow-y-auto border border-border">{contractRows.map((item) => <div key={item.id} className="grid grid-cols-5 border-b border-border px-2 py-1.5 font-mono text-[8px]"><span>{new Date(item.tradeTime).toLocaleTimeString()}</span><span>{compact(item.size)}</span><span>{item.side}</span><span>{compact(item.premium, true)}</span><span>{percentage(item.impliedVolatility === null ? null : item.impliedVolatility * 100, 1)}</span></div>)}</div></div>
    <div className="flex gap-1 p-3"><a href={`/gamvue?symbol=${row.ticker}&strike=${row.strikePrice ?? ""}&expiration=${row.expirationDate ?? ""}`} className="flex h-7 items-center gap-1 border border-border px-2 text-[8px] text-primary">OPEN GEX VUE <ExternalLink className="h-3 w-3" /></a><a href={`/gex-cal?symbol=${row.ticker}&strike=${row.strikePrice ?? ""}&expiration=${row.expirationDate ?? ""}`} className="flex h-7 items-center gap-1 border border-border px-2 text-[8px] text-primary">OPEN GEX CAL <ExternalLink className="h-3 w-3" /></a><a href={`/charts?symbol=${row.ticker}&time=${row.tradeTime}`} className="flex h-7 items-center gap-1 border border-border px-2 text-[8px] text-primary">OPEN CHARTS <ExternalLink className="h-3 w-3" /></a></div>
  </aside>;
}

function Diagnostics({ payload, onClose }: { payload: GexFlowPayload; onClose: () => void }) { return <div className="absolute right-3 top-12 z-50 w-[390px] border border-border bg-panel p-4 shadow-2xl"><div className="flex items-center justify-between"><b className="text-[9px] uppercase tracking-[0.12em]">GEX FLOW DIAGNOSTICS</b><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div><div className="mt-3 space-y-1.5 font-mono text-[8px] text-muted">{Object.entries(payload.diagnostics).filter(([key]) => key !== "limitations").map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-border/60 pb-1"><span>{key}</span><span className="text-right text-foreground">{String(value ?? "—")}</span></div>)}{payload.diagnostics.limitations.map((item) => <p key={item} className="border-l border-warning pl-2 leading-4 text-warning">{item}</p>)}</div><p className="mt-3 text-[8px] leading-4 text-muted">Intent, opening/closing status and strategy are shown as provider classifications where present or clearly labelled estimates. Public prints do not establish participant identity or legal intent.</p></div>; }
function Control({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <Control label={label}><input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="h-8 w-full border border-border bg-background px-2 font-mono text-[9px] outline-none focus:border-primary" /></Control>; }
