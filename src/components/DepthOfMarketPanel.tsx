"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ChevronsLeft, ChevronsRight, CircleHelp, DatabaseZap,
  LocateFixed, Minus, Plus, Settings2,
} from "lucide-react";

import FloatingSettingsWindow from "@/components/ui/FloatingSettingsWindow";
import {
  applyDomProSnapshot, createDomProState, domProPreset, domProSettingsFromRecord,
  visibleDomProRows, type DomProColumn, type DomProSettings, type DomProState,
} from "@/lib/domPro";
import { subscribeRithmicLiquidity, type RithmicLiquidityStatus } from "@/lib/rithmicLiquidityStream";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import type { ChartSettings } from "@/lib/chartSettings";
import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";

type Props = {
  instrument: string;
  contractSymbol?: string | null;
  latestPrice?: number | null;
  indicator: ChartIndicatorInstance;
  chartSettings: ChartSettings;
  onUpdateSetting?: (key: string, value: number | string | boolean) => void;
  standalone?: boolean;
  settingsOpenRequest?: number;
};

type CanvasPalette = {
  background: string; surface: string; border: string; foreground: string;
  muted: string; primary: string; bid: string; ask: string;
};

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function compact(value: number, enabled: boolean) {
  if (!value) return "";
  if (!enabled || Math.abs(value) < 1_000) return integerFormatter.format(Math.round(value));
  if (Math.abs(value) < 1_000_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
}

function decimalPlaces(tickSize: number) {
  if (tickSize >= 1) return 0;
  if (tickSize >= 0.1) return 1;
  if (tickSize >= 0.01) return 2;
  return 3;
}

function cssColor(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

function alpha(color: string, opacity: number) {
  if (color.startsWith("#")) {
    const source = color.slice(1);
    const hex = source.length === 3 ? source.split("").map((part) => part + part).join("") : source;
    if (hex.length === 6) {
      const value = Number.parseInt(hex, 16);
      return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
    }
  }
  return color;
}

function statusLabel(status: RithmicLiquidityStatus, state: DomProState) {
  if (state.staleReason) return "STALE";
  if (status === "connected" && state.snapshotComplete) return state.capabilities.mbo ? "LIVE MBO" : "LIVE L2";
  if (status === "checking") return "SYNCING";
  return "OFFLINE";
}

function serializeColumns(columns: DomProColumn[]) {
  return JSON.stringify(columns.map(({ id, width, enabled }) => ({ id, width, enabled })));
}

function drawDom(args: {
  canvas: HTMLCanvasElement; state: DomProState; settings: DomProSettings;
  palette: CanvasPalette; offsetTicks: number; width: number; height: number; dpr: number;
}) {
  const { canvas, state, settings, palette, offsetTicks, width, height, dpr } = args;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || width <= 0 || height <= 0) return;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const columns = settings.columns.filter((column) => column.enabled);
  const preferredWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = Math.min(1, width / Math.max(1, preferredWidth));
  const widths = columns.map((column) => Math.max(34, column.width * scale));
  const totalWidth = widths.reduce((sum, value) => sum + value, 0);
  const xStart = Math.max(0, width - totalWidth);
  const headerHeight = 25;
  const availableRows = Math.max(1, Math.floor((height - headerHeight) / settings.rowHeight));
  const rows = visibleDomProRows({
    state, rowCount: Math.min(settings.rows, availableRows), offsetTicks,
    recentWindowMs: settings.recentWindowMs,
  });
  const maxDepth = Math.max(1, settings.depthScaleCap, ...rows.flatMap((row) => [row.bidSize, row.askSize]));
  const maxTrade = Math.max(1, ...rows.flatMap((row) => [row.buyVolume, row.sellVolume]));
  const precision = decimalPlaces(state.tickSize);

  ctx.fillStyle = palette.surface;
  ctx.fillRect(xStart, 0, totalWidth, headerHeight);
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(8, settings.fontSize - 1)}px monospace`;
  let x = xStart;
  columns.forEach((column, index) => {
    const columnWidth = widths[index];
    ctx.strokeStyle = palette.border;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, height); ctx.stroke();
    ctx.fillStyle = column.id === "bid" || column.id === "buy" ? palette.bid
      : column.id === "ask" || column.id === "sell" ? palette.ask : palette.muted;
    ctx.textAlign = "center";
    ctx.fillText(column.label, x + columnWidth / 2, headerHeight / 2);
    x += columnWidth;
  });
  ctx.strokeStyle = palette.border;
  ctx.beginPath(); ctx.moveTo(xStart, headerHeight + 0.5); ctx.lineTo(width, headerHeight + 0.5); ctx.stroke();

  rows.forEach((row, rowIndex) => {
    const y = headerHeight + rowIndex * settings.rowHeight;
    if (row.atLast) {
      ctx.fillStyle = alpha(palette.primary, 0.13); ctx.fillRect(xStart, y, totalWidth, settings.rowHeight);
      ctx.strokeStyle = alpha(palette.primary, 0.72); ctx.strokeRect(xStart + 0.5, y + 0.5, totalWidth - 1, settings.rowHeight - 1);
    } else if (row.atBid || row.atAsk) {
      ctx.fillStyle = alpha(row.atBid ? palette.bid : palette.ask, 0.055);
      ctx.fillRect(xStart, y, totalWidth, settings.rowHeight);
    }
    ctx.strokeStyle = alpha(palette.border, 0.55);
    ctx.beginPath(); ctx.moveTo(xStart, y + settings.rowHeight + 0.5); ctx.lineTo(width, y + settings.rowHeight + 0.5); ctx.stroke();
    x = xStart;
    columns.forEach((column, index) => {
      const columnWidth = widths[index];
      let value = "";
      let numeric = 0;
      let color = palette.foreground;
      if (column.id === "buy") { numeric = row.buyVolume; value = compact(numeric, settings.compactNumbers); color = palette.bid; }
      else if (column.id === "sell") { numeric = row.sellVolume; value = compact(numeric, settings.compactNumbers); color = palette.ask; }
      else if (column.id === "bid") { numeric = row.bidSize; value = compact(numeric, settings.compactNumbers); color = palette.bid; }
      else if (column.id === "ask") { numeric = row.askSize; value = compact(numeric, settings.compactNumbers); color = palette.ask; }
      else if (column.id === "price") { value = row.price.toFixed(precision); color = row.atLast ? palette.primary : palette.foreground; }
      else if (column.id === "trades") { numeric = row.buyVolume + row.sellVolume; value = compact(numeric, settings.compactNumbers); color = row.buyVolume >= row.sellVolume ? palette.bid : palette.ask; }
      else if (column.id === "orders") value = row.bidOrders || row.askOrders ? `${row.bidOrders} / ${row.askOrders}` : "";
      else if (column.id === "cob") { numeric = row.bidSize + row.askSize; value = compact(numeric, settings.compactNumbers); }
      else if (column.id === "pullStack") {
        numeric = (row.bidAdded - row.bidRemoved) - (row.askAdded - row.askRemoved);
        value = numeric ? `${numeric > 0 ? "+" : ""}${compact(numeric, settings.compactNumbers)}` : "";
        color = numeric >= 0 ? palette.bid : palette.ask;
      }
      if (settings.showHistogram && numeric > 0 && ["buy", "sell", "bid", "ask", "trades"].includes(column.id)) {
        const denominator = column.id === "bid" || column.id === "ask" ? maxDepth : maxTrade;
        const barWidth = Math.max(1, (columnWidth - 4) * Math.min(1, numeric / denominator));
        ctx.fillStyle = alpha(color, 0.22);
        const rightAligned = column.id === "buy" || column.id === "bid";
        ctx.fillRect(rightAligned ? x + columnWidth - barWidth - 2 : x + 2, y + 2, barWidth, settings.rowHeight - 4);
      }
      if (value) {
        ctx.font = `${column.id === "price" ? 650 : 560} ${settings.fontSize}px monospace`;
        ctx.fillStyle = color; ctx.textAlign = "center";
        ctx.fillText(value, x + columnWidth / 2, y + settings.rowHeight / 2 + 0.5, columnWidth - 6);
      }
      x += columnWidth;
    });
  });
}

export default function DepthOfMarketPanel({
  instrument, contractSymbol, latestPrice, indicator, chartSettings, onUpdateSetting, standalone = false,
  settingsOpenRequest = 0,
}: Props) {
  const settings = useMemo(() => domProSettingsFromRecord(indicator.settings), [indicator.settings]);
  const configuredWidth = Math.max(240, Math.min(1_100, finite(indicator.settings?.width, 640)));
  const [runtimeWidth, setRuntimeWidth] = useState(configuredWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [offsetTicks, setOffsetTicks] = useState(0);
  const [followingLive, setFollowingLive] = useState(true);
  const [status, setStatus] = useState<RithmicLiquidityStatus>("checking");
  const [bookState, setBookState] = useState<DomProState>(() => createDomProState());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widthDragRef = useRef<{ startX: number; startWidth: number; latest: number } | null>(null);
  const panRef = useRef<{ startY: number; startOffset: number } | null>(null);
  const lastFrameAtRef = useRef(0);
  const pendingSnapshotRef = useRef<RithmicLiquiditySnapshot | null>(null);
  const publishTimerRef = useRef<number | null>(null);
  const previousLastTickRef = useRef<number | null>(null);
  const previousSettingsOpenRequestRef = useRef(settingsOpenRequest);

  useEffect(() => setRuntimeWidth(configuredWidth), [configuredWidth]);
  useEffect(() => {
    if (settingsOpenRequest === previousSettingsOpenRequestRef.current) return;
    previousSettingsOpenRequestRef.current = settingsOpenRequest;
    setSettingsOpen(true);
  }, [settingsOpenRequest]);
  const commitSnapshot = useCallback((snapshot: RithmicLiquiditySnapshot) => {
    setBookState((current) => applyDomProSnapshot(current, snapshot));
    lastFrameAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeRithmicLiquidity({
      root: instrument, contractSymbol, exchange: "CME",
      onSnapshot: (snapshot) => {
        pendingSnapshotRef.current = snapshot;
        const remaining = settings.refreshRateMs - (Date.now() - lastFrameAtRef.current);
        if (remaining <= 0) {
          if (publishTimerRef.current !== null) window.clearTimeout(publishTimerRef.current);
          publishTimerRef.current = null; commitSnapshot(snapshot); return;
        }
        if (publishTimerRef.current !== null) return;
        publishTimerRef.current = window.setTimeout(() => {
          publishTimerRef.current = null;
          if (pendingSnapshotRef.current) commitSnapshot(pendingSnapshotRef.current);
        }, remaining);
      },
      onStatus: setStatus,
    });
    return () => {
      unsubscribe(); pendingSnapshotRef.current = null;
      if (publishTimerRef.current !== null) window.clearTimeout(publishTimerRef.current);
      publishTimerRef.current = null;
    };
  }, [commitSnapshot, contractSymbol, instrument, settings.refreshRateMs]);

  useEffect(() => {
    const fallbackTick = latestPrice == null ? null : Math.round(latestPrice / bookState.tickSize);
    const nextTick = bookState.lastTick ?? fallbackTick;
    if (followingLive && nextTick !== previousLastTickRef.current) setOffsetTicks(0);
    previousLastTickRef.current = nextTick;
  }, [bookState.lastTick, bookState.tickSize, followingLive, latestPrice]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const host = canvasHostRef.current;
    if (!canvas || !host) return;
    const bounds = host.getBoundingClientRect();
    const styles = getComputedStyle(host);
    drawDom({
      canvas, state: bookState, settings, offsetTicks,
      width: Math.floor(bounds.width), height: Math.floor(bounds.height), dpr: Math.min(2.5, window.devicePixelRatio || 1),
      palette: {
        background: cssColor(styles, "--background", "#050607"), surface: cssColor(styles, "--surface", "#0b0d0f"),
        border: cssColor(styles, "--border", "#20242a"), foreground: cssColor(styles, "--foreground", "#f5f7fa"),
        muted: cssColor(styles, "--muted", "#7b8490"), primary: cssColor(styles, "--primary", chartSettings.upColor),
        bid: settings.useThemeColors ? chartSettings.upColor : String(indicator.settings?.bidColor ?? chartSettings.upColor),
        ask: settings.useThemeColors ? chartSettings.downColor : String(indicator.settings?.askColor ?? chartSettings.downColor),
      },
    });
  }, [bookState, chartSettings.downColor, chartSettings.upColor, indicator.settings, offsetTicks, settings]);

  useEffect(() => {
    draw(); const host = canvasHostRef.current; if (!host) return;
    const observer = new ResizeObserver(draw); observer.observe(host); return () => observer.disconnect();
  }, [draw]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "End") return; setFollowingLive(true); setOffsetTicks(0);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const persist = useCallback((key: string, value: number | string | boolean) => onUpdateSetting?.(key, value), [onUpdateSetting]);
  const saveSettings = useCallback((next: DomProSettings) => {
    persist("domSettingsVersion", next.version); persist("domPreset", next.preset);
    persist("rows", next.rows); persist("rowHeight", next.rowHeight); persist("fontSize", next.fontSize);
    persist("refreshRateMs", next.refreshRateMs); persist("recentWindowMs", next.recentWindowMs);
    persist("autoCenter", next.autoCenter); persist("compactNumbers", next.compactNumbers);
    persist("useThemeColors", next.useThemeColors); persist("showDepthHistogram", next.showHistogram);
    persist("showHeaderStats", next.showHeaderStats); persist("showImbalance", next.showImbalance);
    persist("domColumns", serializeColumns(next.columns));
  }, [persist]);
  const recenter = () => { setFollowingLive(true); setOffsetTicks(0); };
  const allLevels = [...bookState.levels.values()];
  const depthTotal = allLevels.reduce((sum, level) => sum + level.bidSize + level.askSize, 0);
  const bidTotal = allLevels.reduce((sum, level) => sum + level.bidSize, 0);
  const imbalance = depthTotal > 0 ? (bidTotal / depthTotal - 0.5) * 200 : 0;
  const spread = bookState.bestBidTick !== null && bookState.bestAskTick !== null ? Math.max(0, bookState.bestAskTick - bookState.bestBidTick) : null;

  if (collapsed && !standalone) return (
    <aside className="relative flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-background py-2">
      <button type="button" onClick={() => setCollapsed(false)} className="flex h-7 w-7 items-center justify-center border border-border text-primary" title="Expand DOM Pro"><ChevronsLeft className="h-3.5 w-3.5" /></button>
      <DatabaseZap className="mt-3 h-3.5 w-3.5 text-primary" />
      <span className="mt-3 [writing-mode:vertical-rl] font-mono text-[8px] font-bold tracking-[0.18em] text-muted">DOM PRO</span>
    </aside>
  );

  return (
    <aside
      className={standalone
        ? "relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
        : "relative flex h-full min-w-[240px] shrink-0 flex-col overflow-hidden border-l border-border bg-background shadow-[-18px_0_45px_rgba(0,0,0,.24)]"}
      style={standalone ? undefined : { width: runtimeWidth }}
      aria-label="DOM Pro Rithmic depth of market"
    >
      {!standalone ? <button type="button" className="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize bg-transparent hover:bg-primary/50" aria-label="Resize DOM Pro" onPointerDown={(event) => {
        event.preventDefault(); widthDragRef.current = { startX: event.clientX, startWidth: runtimeWidth, latest: runtimeWidth };
        const move = (next: PointerEvent) => {
          if (!widthDragRef.current) return;
          const width = Math.max(240, Math.min(1_100, widthDragRef.current.startWidth + widthDragRef.current.startX - next.clientX));
          widthDragRef.current.latest = width; setRuntimeWidth(width);
        };
        const up = () => {
          document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
          const width = widthDragRef.current?.latest ?? runtimeWidth; widthDragRef.current = null; persist("width", Math.round(width));
        };
        document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
      }} /> : null}
      {!standalone ? <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <DatabaseZap className="h-3.5 w-3.5 text-primary" />
        <div className="min-w-0"><div className="truncate font-mono text-[10px] font-bold tracking-[0.12em] text-foreground">DOM PRO</div><div className="truncate font-mono text-[7px] uppercase tracking-[0.08em] text-muted">{bookState.capabilities.mbo ? "MBO · exact order count" : bookState.capabilities.fullDepth ? "Full depth · L2 fallback" : "Waiting for exchange book"}</div></div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={recenter} className={`flex h-6 items-center gap-1 border px-2 font-mono text-[7px] ${followingLive ? "border-primary/45 bg-primary/10 text-primary" : "border-border text-muted"}`} title="Return to live price"><LocateFixed className="h-3 w-3" />LIVE</button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="flex h-6 w-6 items-center justify-center border border-border text-muted" title="DOM Pro settings"><Settings2 className="h-3 w-3" /></button>
          {!standalone ? <>
            <button type="button" onClick={() => setRuntimeWidth((value) => Math.max(240, value - 50))} className="flex h-6 w-6 items-center justify-center border border-border text-muted" title="Narrower"><Minus className="h-3 w-3" /></button>
            <button type="button" onClick={() => setRuntimeWidth((value) => Math.min(1_100, value + 50))} className="flex h-6 w-6 items-center justify-center border border-border text-muted" title="Wider"><Plus className="h-3 w-3" /></button>
            <button type="button" onClick={() => setCollapsed(true)} className="flex h-6 w-6 items-center justify-center border border-border text-muted" title="Collapse"><ChevronsRight className="h-3 w-3" /></button>
          </> : null}
        </div>
      </header> : null}
      {settings.showHeaderStats ? <div className="grid h-8 shrink-0 grid-cols-4 border-b border-border bg-surface/25 font-mono">
        <div className="flex items-center justify-between border-r border-border px-2 text-[7px]"><span className="text-muted">SPREAD</span><b>{spread ?? "—"}T</b></div>
        <div className="flex items-center justify-between border-r border-border px-2 text-[7px]"><span className="text-muted">ROWS</span><b>{settings.rows}</b></div>
        <div className="flex items-center justify-between border-r border-border px-2 text-[7px]"><span className="text-muted">BOOK</span><b>{compact(depthTotal, true) || "0"}</b></div>
        <div className="flex items-center justify-between px-2 text-[7px]"><span className="text-muted">IMB</span><b style={{ color: imbalance >= 0 ? chartSettings.upColor : chartSettings.downColor }}>{imbalance >= 0 ? "+" : ""}{imbalance.toFixed(0)}%</b></div>
      </div> : null}
      <div ref={canvasHostRef} className="relative min-h-0 flex-1 cursor-ns-resize touch-none select-none overflow-hidden" onWheel={(event) => {
        event.preventDefault(); event.stopPropagation(); setFollowingLive(false);
        const step = Math.max(1, Math.round(Math.abs(event.deltaY) / 75)); setOffsetTicks((current) => current + (event.deltaY > 0 ? -step : step));
      }} onPointerDown={(event) => { panRef.current = { startY: event.clientY, startOffset: offsetTicks }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => {
        if (!panRef.current) return; setFollowingLive(false); setOffsetTicks(panRef.current.startOffset + Math.round((event.clientY - panRef.current.startY) / settings.rowHeight));
      }} onPointerUp={(event) => { panRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onDoubleClick={recenter}>
        <canvas ref={canvasRef} className="block h-full w-full" />
        {!bookState.snapshotComplete ? <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]"><div className="flex flex-col items-center gap-2 font-mono"><DatabaseZap className={`h-5 w-5 ${status === "unavailable" ? "text-danger" : "animate-pulse text-primary"}`} /><span className="text-[9px] font-semibold tracking-[0.12em] text-foreground">{status === "unavailable" ? "DOM FEED UNAVAILABLE" : "LOADING DOM PRO"}</span><span className="text-[7px] text-muted">{status === "unavailable" ? "Waiting for the authenticated Rithmic book to reconnect" : bookState.staleReason || "Restoring the authenticated Rithmic book"}</span></div></div> : null}
        {!followingLive ? <button type="button" onClick={recenter} className="absolute bottom-3 right-3 flex h-7 items-center gap-1.5 border border-primary/50 bg-background px-2 font-mono text-[8px] font-semibold text-primary shadow-lg"><LocateFixed className="h-3 w-3" />GO LIVE</button> : null}
      </div>
      <footer className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-surface/25 px-2 font-mono text-[7px] text-muted">
        <Activity className={`h-3 w-3 ${status === "connected" ? "text-primary" : "text-muted"}`} /><span>{contractSymbol || instrument}</span>
        <span className="ml-auto">{bookState.capabilities.mbo ? "MBO" : bookState.capabilities.fullDepth ? "L2 FALLBACK" : "NO BOOK"}</span>
        <span className={`border px-1.5 py-0.5 font-bold ${bookState.staleReason ? "border-danger/40 text-danger" : status === "connected" ? "border-primary/35 text-primary" : "border-border"}`}>{statusLabel(status, bookState)}</span>
      </footer>
      <FloatingSettingsWindow
        open={settingsOpen}
        title="DOM Pro Settings"
        subtitle="Live ladder preview · drag this window anywhere"
        onClose={() => setSettingsOpen(false)}
        widthClassName="w-[min(460px,calc(100vw-24px))]"
        contentClassName="space-y-4 p-3"
      >
          <section><div className="mb-2 font-mono text-[8px] uppercase tracking-[0.13em] text-muted">Preset</div><div className="grid grid-cols-3 gap-1.5">{(["scalper", "order-flow", "minimal"] as const).map((preset) => <button key={preset} type="button" onClick={() => saveSettings(domProPreset(preset, settings))} className={`h-8 border font-mono text-[8px] uppercase ${settings.preset === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted"}`}>{preset}</button>)}</div></section>
          <section className="space-y-2"><div className="font-mono text-[8px] uppercase tracking-[0.13em] text-muted">Ladder</div>{[
            ["Visible rows", "rows", settings.rows, 10, 120, 1], ["Row height", "rowHeight", settings.rowHeight, 16, 42, 1],
            ["Text size", "fontSize", settings.fontSize, 7, 13, 1], ["Refresh ms", "refreshRateMs", settings.refreshRateMs, 16, 1000, 1],
          ].map(([label, key, value, min, max, step]) => <label key={String(key)} className="grid grid-cols-[90px_1fr_42px] items-center gap-2 text-[8px] text-muted"><span>{String(label)}</span><input type="range" min={Number(min)} max={Number(max)} step={Number(step)} value={Number(value)} onChange={(event) => persist(String(key), Number(event.target.value))} className="accent-primary" /><span className="text-right font-mono text-foreground">{String(value)}</span></label>)}</section>
          <section className="space-y-1.5"><div className="font-mono text-[8px] uppercase tracking-[0.13em] text-muted">Columns</div>{settings.columns.map((column) => <div key={column.id} className="grid grid-cols-[1fr_42px_120px] items-center gap-2 border border-border bg-background px-2 py-1.5"><label className="flex items-center gap-2 font-mono text-[8px] text-foreground"><input type="checkbox" checked={column.enabled} onChange={(event) => saveSettings({ ...settings, preset: "custom", columns: settings.columns.map((item) => item.id === column.id ? { ...item, enabled: event.target.checked } : item) })} className="accent-primary" />{column.label}</label><span className="text-right font-mono text-[7px] text-muted">{column.width}px</span><input type="range" min="54" max="260" value={column.width} onChange={(event) => saveSettings({ ...settings, preset: "custom", columns: settings.columns.map((item) => item.id === column.id ? { ...item, width: Number(event.target.value) } : item) })} className="accent-primary" /></div>)}</section>
          <section className="space-y-1.5">{[
            { key: "showDepthHistogram", label: "Depth histograms", value: settings.showHistogram }, { key: "showHeaderStats", label: "Header statistics", value: settings.showHeaderStats },
            { key: "showImbalance", label: "Book imbalance", value: settings.showImbalance }, { key: "compactNumbers", label: "Compact large numbers", value: settings.compactNumbers },
            { key: "useThemeColors", label: "Use KwantDesk theme colours", value: settings.useThemeColors },
          ].map((item) => <label key={item.key} className="flex items-center justify-between border border-border bg-background px-2.5 py-2 text-[8px] text-muted"><span>{item.label}</span><input type="checkbox" checked={item.value} onChange={(event) => persist(item.key, event.target.checked)} className="accent-primary" /></label>)}</section>
          <div className="flex gap-2 border border-border bg-background p-2 text-[7px] leading-4 text-muted"><CircleHelp className="mt-0.5 h-3 w-3 shrink-0 text-primary" /><span>Order entry is read-only until KwantDesk&apos;s authenticated order service explicitly grants trading capability. The browser never opens a second Rithmic session.</span></div>
      </FloatingSettingsWindow>
    </aside>
  );
}
