"use client";

import {
  Activity, BarChart3, BookOpen, ChevronDown, Copy, Download, Expand,
  FileUp, Grid2X2, Grip, Infinity as InfinityIcon, LayoutDashboard, Maximize2,
  MoreHorizontal, Move, Plus, RefreshCw, Settings2, Trash2, X,
} from "lucide-react";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToolCategory = "Options" | "Equities" | "KwantDesk";
type Tool = { id: string; label: string; category: ToolCategory; detail: string; endpoint?: (settings: PanelSettings) => string };
type PanelSettings = {
  symbol: string; date: string; aggregation: string; greek: string; expiry: string;
  strikes: number; rows: number; minimum: number; color: string; negativeColor: string;
};
type DashboardPanel = { id: string; toolId: string; title: string; settings: PanelSettings };
type DashboardPage = { id: string; name: string; layout: "grid" | "infinite"; panels: DashboardPanel[] };
type DashboardWorkspace = { schemaVersion: 2; name: string; activePageId: string; pages: DashboardPage[] };

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
};

const nativeTicker = (symbol: string) => symbol === "SPX" || symbol === "SPXW" || symbol === "SPY" ? "ES_SPX" : "NQ_NDX";
const normalizedTool = (tool: string) => (s: PanelSettings) => `/api/gex-box/tool?tool=${tool}&symbol=${s.symbol}&sessionDate=${s.date}`;
const TOOLS: Tool[] = [
  { id: "consolidated-flow", label: "Consolidated Order Flow", category: "Options", detail: "Grouped transactions, premium, sentiment and trade side", endpoint: normalizedTool("consolidated-flow") },
  { id: "contract-side-statistics", label: "Contract Side Statistics", category: "Options", detail: "Bid, ask, mid and aggressor statistics", endpoint: normalizedTool("contract-side-statistics") },
  { id: "contract-statistics", label: "Contract Statistics", category: "Options", detail: "Volume, OI, premium, trades, price and IV", endpoint: normalizedTool("contract-statistics") },
  { id: "exposure-expiration", label: "Exposure by Expiration", category: "Options", detail: "Greek exposure grouped by expiration", endpoint: normalizedTool("exposure-expiration") },
  { id: "exposure-strike", label: "Exposure by Strike", category: "Options", detail: "Signed exposure profile across strikes", endpoint: normalizedTool("exposure-strike") },
  { id: "gainers-losers", label: "Gainers / Losers", category: "Options", detail: "Bullish and bearish premium leaderboard", endpoint: normalizedTool("gainers-losers") },
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
        if (timer !== undefined) window.clearInterval(timer);
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
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const container = canvas.parentElement; if (!container) return;
    const surface = record(payload); const buckets = Array.isArray(surface?.buckets) ? surface.buckets : [];
    const draw = () => {
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
    scheduleDraw(); const observer = new ResizeObserver(scheduleDraw); observer.observe(container); return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [payload, settings.color, settings.minimum, settings.negativeColor]);
  return <canvas ref={ref} className="block h-full w-full" />;
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
  return <div className="h-full overflow-y-auto px-2 py-1">{rows.length ? rows.map((row) => <div key={row.strike} className="grid h-5 grid-cols-[1fr_58px_1fr] items-center gap-2 border-b border-border/30 text-[9px] font-mono"><div className="flex justify-end"><span className="h-2 opacity-65" title="Negative / put side" style={{ backgroundColor: settings.negativeColor, width: `${Math.max(1, Math.abs(row.negative) / peak * 100)}%` }} /></div><span className="text-center text-foreground">{row.strike}</span><span className="h-2 opacity-65" title="Positive / call side" style={{ backgroundColor: settings.color, width: `${Math.max(1, Math.abs(row.positive) / peak * 100)}%` }} /></div>) : <NoRows />}</div>;
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
  const root = record(payload); const current = record(root?.current); const historical = record(root?.latestHistorical); const combined = record(historical?.combined); const value = finite(current?.ivRank) ?? finite(combined?.ivRank);
  if (value === null) return <NoRows />;
  return <div className="flex h-full items-center justify-center"><div className="relative flex h-48 w-48 items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${Math.max(0, Math.min(100, value))}%, color-mix(in srgb, var(--border) 65%, transparent) 0)` }}><div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-background"><strong className="font-mono text-4xl text-foreground">{value.toFixed(1)}</strong><span className="mt-1 text-[9px] uppercase tracking-[.18em] text-muted">IV Rank</span></div></div></div>;
}

function NoRows() { return <div className="flex h-full items-center justify-center text-center"><div><BarChart3 className="mx-auto h-5 w-5 text-muted" /><p className="mt-2 text-[9px] uppercase tracking-[.15em] text-muted">No rows in this verified frame</p></div></div>; }

const ToolSurface = memo(function ToolSurface({ panel }: { panel: DashboardPanel }) {
  const tool = toolById.get(panel.toolId); const url = tool?.endpoint?.(panel.settings) ?? null; const feed = useSharedFeed(url);
  if (!tool?.endpoint) return <div className="flex h-full items-center justify-center px-8 text-center"><div><BookOpen className="mx-auto h-5 w-5 text-primary" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.16em]">Tool unavailable</p><p className="mt-2 max-w-md text-[9px] leading-5 text-muted">This saved panel no longer has an authoritative licensed source. Remove it and choose a verified tool.</p></div></div>;
  if (!feed.data && feed.loading) return <div className="flex h-full items-center justify-center"><RefreshCw className="h-5 w-5 animate-spin text-primary" /><span className="ml-3 text-[9px] uppercase tracking-[.15em] text-muted">Restoring verified session</span></div>;
  if (!feed.data && feed.error) return <div className="flex h-full items-center justify-center px-8 text-center"><div><p className="text-[10px] font-semibold uppercase text-danger">Data unavailable</p><p className="mt-2 max-w-md text-[9px] text-muted">{feed.error}</p><button onClick={() => void feed.refresh()} className="mt-4 border border-primary/30 px-3 py-2 text-[9px] uppercase text-primary">Try again</button></div></div>;
  if (panel.toolId === "interval-map" || panel.toolId === "heat-map") return <IntervalCanvas payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "dark-pool-levels") return <DarkPoolLevelsPanel payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "equity-prints") return <EquityPrintsPanel payload={feed.data} settings={panel.settings} />;
  if (["exposure-strike", "oi-strike", "classic-gex", "state-profile"].includes(panel.toolId)) return <ProfileBars payload={feed.data} settings={panel.settings} />;
  if (panel.toolId === "iv-rank") return <IvRank payload={feed.data} />;
  return <DataTable payload={feed.data} limit={panel.settings.rows} />;
});

function PanelSettingsDialog({ panel, onChange, onClose }: { panel: DashboardPanel; onChange: (panel: DashboardPanel) => void; onClose: () => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 }); const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const update = (key: keyof PanelSettings, value: string | number) => onChange({ ...panel, settings: { ...panel.settings, [key]: value } });
  return <div className="fixed inset-0 z-[180] pointer-events-none"><div className="pointer-events-auto absolute left-1/2 top-1/2 w-[430px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 border border-border bg-panel shadow-2xl" style={{ marginLeft: position.x, marginTop: position.y }}>
    <div className="flex h-10 cursor-move items-center justify-between border-b border-border px-3" onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, px: position.x, py: position.y }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!drag.current) return; setPosition({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }}><span className="text-[10px] font-semibold uppercase tracking-[.16em]">{panel.title} settings</span><button onClick={onClose}><X className="h-4 w-4 text-muted" /></button></div>
    <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto p-4 text-[9px]">
      <Field label="Symbol"><select value={panel.settings.symbol} onChange={(e) => update("symbol", e.target.value)}>{["SPX", "SPXW", "SPY", "NDX", "QQQ"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      <Field label="Session date"><input type="date" value={panel.settings.date} onChange={(e) => update("date", e.target.value)} /></Field>
      <Field label="Aggregation"><select value={panel.settings.aggregation} onChange={(e) => update("aggregation", e.target.value)}>{["1m", "2m", "3m", "4m", "5m", "10m", "15m", "20m", "30m", "1h", "2h", "4h"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      <Field label="Greek"><select value={panel.settings.greek} onChange={(e) => update("greek", e.target.value)}>{["GEX", "DEX", "VEX", "CHEX"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      <Field label="Expiration"><select value={panel.settings.expiry} onChange={(e) => update("expiry", e.target.value)}>{["0DTE", "FRONT", "0-7DTE", "ALL"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      <Field label={`Strike padding · ${panel.settings.strikes}`}><input type="range" min="5" max="100" value={panel.settings.strikes} onChange={(e) => update("strikes", Number(e.target.value))} /></Field>
      <Field label={`Table rows · ${panel.settings.rows}`}><input type="range" min="10" max="200" step="10" value={panel.settings.rows} onChange={(e) => update("rows", Number(e.target.value))} /></Field>
      <Field label="Minimum magnitude"><input type="number" min="0" value={panel.settings.minimum} onChange={(e) => update("minimum", Number(e.target.value))} /></Field>
      <Field label="Positive color"><input type="color" value={panel.settings.color.startsWith("#") ? panel.settings.color : "#aaff00"} onChange={(e) => update("color", e.target.value)} /></Field>
      <Field label="Negative color"><input type="color" value={panel.settings.negativeColor.startsWith("#") ? panel.settings.negativeColor : "#ff3366"} onChange={(e) => update("negativeColor", e.target.value)} /></Field>
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

const DashboardPanelView = memo(function DashboardPanelView({ panel, onChange, onDuplicate, onDelete }: { panel: DashboardPanel; onChange: (panel: DashboardPanel) => void; onDuplicate: (panel: DashboardPanel) => void; onDelete: (panelId: string) => void }) {
  const [settings, setSettings] = useState(false); const [menu, setMenu] = useState(false); const [maximized, setMaximized] = useState(false);
  return <article className={`${maximized ? "fixed inset-3 z-[150]" : "relative min-h-[310px]"} flex min-w-0 flex-col overflow-hidden border border-border bg-background shadow-[inset_2px_0_0_color-mix(in_srgb,var(--primary)_65%,transparent)]`}>
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-panel px-3"><div className="flex min-w-0 items-center gap-2"><Grip className="h-3.5 w-3.5 text-primary" /><span className="truncate text-[10px] font-semibold uppercase tracking-[.14em]">{panel.title}</span><span className="font-mono text-[8px] text-muted">{panel.settings.symbol} · {panel.settings.aggregation}</span></div><div className="relative flex items-center gap-1"><button onClick={() => setSettings(true)} className="p-1.5 text-muted hover:text-primary" aria-label="Panel settings"><Settings2 className="h-3.5 w-3.5" /></button><button onClick={() => setMaximized((v) => !v)} className="p-1.5 text-muted hover:text-primary" aria-label="Maximize panel"><Maximize2 className="h-3.5 w-3.5" /></button><button onClick={() => setMenu((v) => !v)} className="p-1.5 text-muted hover:text-primary"><MoreHorizontal className="h-4 w-4" /></button>{menu ? <div className="absolute right-0 top-8 z-30 w-40 border border-border bg-panel p-1 shadow-xl"><MenuButton icon={Copy} label="Duplicate Tab" onClick={() => { setMenu(false); onDuplicate(panel); }} /><MenuButton icon={Expand} label="Maximize" onClick={() => { setMenu(false); setMaximized(true); }} /><MenuButton icon={Move} label="Pop Out Tool" onClick={() => { setMenu(false); setMaximized(true); }} /><MenuButton icon={Trash2} label="Delete Tab" danger onClick={() => { setMenu(false); onDelete(panel.id); }} /></div> : null}</div></header>
    <div className="relative min-h-0 flex-1"><ToolSurface panel={panel} /></div>
    {settings ? <PanelSettingsDialog panel={panel} onChange={onChange} onClose={() => setSettings(false)} /> : null}
  </article>;
});

function MenuButton({ icon: Icon, label, onClick, danger = false }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) { return <button onClick={onClick} className={`flex h-8 w-full items-center gap-2 px-2 text-left text-[9px] ${danger ? "text-danger" : "text-muted hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>; }

export default function GexBoxDashboard() {
  const [workspace, setWorkspace] = useState<DashboardWorkspace>(() => defaultWorkspace()); const [hydrated, setHydrated] = useState(false); const [showTools, setShowTools] = useState(false); const [workspaceMenu, setWorkspaceMenu] = useState(false); const importRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw) as DashboardWorkspace; if (parsed.schemaVersion === 2 && parsed.pages?.length) setWorkspace(parsed); } } catch {} setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)), 250);
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
  const addPage = (layout: "grid" | "infinite") => { const id = makeId("page"); setWorkspace((current) => ({ ...current, activePageId: id, pages: [...current.pages, { id, name: layout === "grid" ? `Page ${current.pages.length + 1}` : `Infinite ${current.pages.length + 1}`, layout, panels: [] }] })); };
  const exportWorkspace = () => { const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `kwantdesk-gex-box-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); };
  const importWorkspace = async (file: File) => { try { const parsed = JSON.parse(await file.text()) as DashboardWorkspace; if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.pages) || !parsed.pages.length || parsed.pages.some((page) => !page.id || !Array.isArray(page.panels) || page.panels.some((panel) => !toolById.has(panel.toolId)))) throw new Error("Invalid GEX BOX workspace file."); setWorkspace(parsed); } catch (error) { window.alert(error instanceof Error ? error.message : "Invalid workspace file."); } };
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
    <header className="shrink-0 border-b border-border bg-panel"><div className="flex h-11 items-center justify-between gap-3 px-3"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center border border-primary/25 bg-primary/10"><LayoutDashboard className="h-4 w-4 text-primary" /></div><div><h1 className="text-[11px] font-semibold uppercase tracking-[.18em]">GEX BOX</h1><p className="text-[8px] text-muted">QuantData tools · KwantDesk workspace engine</p></div></div><div className="flex items-center gap-1"><button onClick={() => setShowTools(true)} className="flex h-8 items-center gap-2 border border-primary/30 bg-primary/10 px-3 text-[9px] font-semibold uppercase tracking-[.12em] text-primary"><Plus className="h-3.5 w-3.5" />Add Tool</button><button onClick={() => addPage("grid")} className="flex h-8 items-center gap-2 border border-border px-3 text-[9px] uppercase text-muted hover:text-foreground"><Grid2X2 className="h-3.5 w-3.5" />Grid</button><button onClick={() => addPage("infinite")} className="flex h-8 items-center gap-2 border border-border px-3 text-[9px] uppercase text-muted hover:text-foreground"><InfinityIcon className="h-3.5 w-3.5" />Infinite</button><div className="relative"><button onClick={() => setWorkspaceMenu((v) => !v)} className="flex h-8 items-center gap-2 border border-border px-3 text-[9px] font-semibold uppercase tracking-[.12em]"><Download className="h-3.5 w-3.5 text-primary" />Workspaces<ChevronDown className="h-3 w-3 text-muted" /></button>{workspaceMenu ? <div className="absolute right-0 top-9 z-40 w-52 border border-border bg-panel p-1 shadow-xl"><MenuButton icon={Download} label="Export workspace" onClick={() => { setWorkspaceMenu(false); exportWorkspace(); }} /><MenuButton icon={FileUp} label="Import workspace" onClick={() => { setWorkspaceMenu(false); importRef.current?.click(); }} /><MenuButton icon={RefreshCw} label="Reset to standard" onClick={() => { setWorkspaceMenu(false); setWorkspace(defaultWorkspace()); }} /></div> : null}</div></div></div>
      <div className="flex h-10 items-end gap-1 overflow-x-auto px-3">{workspace.pages.map((page) => <div key={page.id} className={`group flex h-9 shrink-0 items-center border-b-2 px-3 ${page.id === active.id ? "border-primary bg-primary/[.035] text-primary" : "border-transparent text-muted"}`}><button onClick={() => setWorkspace((current) => ({ ...current, activePageId: page.id }))} className="text-[9px] font-semibold uppercase tracking-[.13em]">{page.name}</button>{workspace.pages.length > 1 ? <button onClick={() => setWorkspace((current) => { const pages = current.pages.filter((item) => item.id !== page.id); return { ...current, pages, activePageId: current.activePageId === page.id ? pages[0].id : current.activePageId }; })} className="ml-2 opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button> : null}</div>)}<button onClick={() => addPage("grid")} className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-primary"><Plus className="h-3.5 w-3.5" /></button></div></header>
    <main className={`min-h-0 flex-1 overflow-auto p-2 ${active.layout === "grid" ? "grid auto-rows-[minmax(310px,1fr)] grid-cols-1 gap-2 xl:grid-cols-2" : "relative min-w-[1600px] grid auto-rows-[420px] grid-cols-3 gap-2"}`}>
      {active.panels.length ? active.panels.map((panel) => <DashboardPanelView key={panel.id} panel={panel} onChange={changePanel} onDuplicate={duplicatePanel} onDelete={deletePanel} />) : <button onClick={() => setShowTools(true)} className="col-span-full flex min-h-[420px] items-center justify-center border border-dashed border-border text-muted hover:border-primary/40 hover:text-primary"><Plus className="mr-2 h-4 w-4" /><span className="text-[10px] uppercase tracking-[.15em]">Add the first tool</span></button>}
    </main>
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-panel px-3 text-[8px] uppercase tracking-[.12em] text-muted"><span>{active.layout} page · {active.panels.length} panels · shared VPS feeds</span><span>Prior completed New York RTH · live during session</span></footer>
    {showTools ? <AddToolDialog onAdd={addTool} onClose={() => setShowTools(false)} /> : null}
    <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkspace(file); event.target.value = ""; }} />
  </div>;
}
