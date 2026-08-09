"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  DatabaseZap,
  LocateFixed,
  Minus,
  Plus,
} from "lucide-react";

import { buildDepthLadder } from "@/lib/depthOfMarket";
import {
  subscribeRithmicLiquidity,
  type RithmicLiquidityStatus,
} from "@/lib/rithmicLiquidityStream";
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
};

type RecentAtPrice = {
  bid: number;
  ask: number;
  lastAt: number;
  lastSize: number;
  lastSide: "BUY" | "SELL";
};

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function finite(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function decimalPlaces(tickSize: number) {
  if (tickSize >= 1) return 0;
  if (tickSize >= 0.1) return 1;
  if (tickSize >= 0.01) return 2;
  return 3;
}

function statusLabel(status: RithmicLiquidityStatus, snapshot: RithmicLiquiditySnapshot | null) {
  if (status === "connected" && snapshot?.bookValid && snapshot.fullDepth) return "LIVE";
  if (snapshot?.bookValid) return "FROZEN";
  if (status === "checking") return "SYNCING";
  return "OFFLINE";
}

function compact(value: number, enabled: boolean) {
  if (!value) return "";
  if (!enabled || Math.abs(value) < 1_000) return integerFormatter.format(Math.round(value));
  if (Math.abs(value) < 1_000_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
}

function signed(value: number, compactNumbers: boolean) {
  if (!value) return "";
  return `${value > 0 ? "+" : "−"}${compact(Math.abs(value), compactNumbers)}`;
}

export default function DepthOfMarketPanel({
  instrument,
  contractSymbol,
  latestPrice,
  indicator,
  chartSettings,
  onUpdateSetting,
}: Props) {
  const settings = indicator.settings ?? {};
  const configuredWidth = Math.max(196, Math.min(560, finite(settings.width, 360)));
  const [runtimeWidth, setRuntimeWidth] = useState(configuredWidth);
  const [collapsed, setCollapsed] = useState(false);
  const [centreOffsetTicks, setCentreOffsetTicks] = useState(0);
  const [snapshot, setSnapshot] = useState<RithmicLiquiditySnapshot | null>(null);
  const [status, setStatus] = useState<RithmicLiquidityStatus>("checking");
  const recentAtPriceRef = useRef(new Map<number, RecentAtPrice>());
  const pendingSnapshotRef = useRef<RithmicLiquiditySnapshot | null>(null);
  const publishTimerRef = useRef<number | null>(null);
  const lastPublishedAtRef = useRef(0);
  const dragRef = useRef<{ startX: number; startWidth: number; currentWidth: number } | null>(null);

  const requestedRows = Math.max(11, Math.min(101, Math.round(finite(settings.rows, 41))));
  const rowCount = requestedRows % 2 === 0 ? requestedRows + 1 : requestedRows;
  const groupTicks = Math.max(1, Math.min(100, Math.round(finite(settings.groupTicks, 1))));
  const refreshRateMs = Math.max(16, Math.min(1_000, Math.round(finite(settings.refreshRateMs, 50))));
  const recentWindowMs = Math.max(250, Math.min(60_000, Math.round(finite(settings.recentWindowMs, 8_000))));
  const depthScaleCap = Math.max(0, finite(settings.depthScaleCap, 0));
  const highlightThreshold = Math.max(0, finite(settings.highlightThreshold, 0));
  const fontSize = Math.max(7, Math.min(13, finite(settings.fontSize, 9)));
  const showCumulative = settings.showCumulative === true;
  const showOrderCount = settings.showOrderCount === true;
  const showPullStack = settings.showPullStack !== false;
  const showRecentTrades = settings.showRecentTrades !== false;
  const showDepthHistogram = settings.showDepthHistogram !== false;
  const showHeaderStats = settings.showHeaderStats !== false;
  const showImbalance = settings.showImbalance !== false;
  const autoCenter = settings.autoCenter !== false;
  const compactNumbers = settings.compactNumbers !== false;
  const useThemeColors = settings.useThemeColors !== false;
  const bidColor = useThemeColors ? chartSettings.upColor : String(settings.bidColor ?? chartSettings.upColor);
  const askColor = useThemeColors ? chartSettings.downColor : String(settings.askColor ?? chartSettings.downColor);
  const lastTradeColor = useThemeColors ? "var(--primary)" : String(settings.lastTradeColor ?? "#FDE047");

  useEffect(() => setRuntimeWidth(configuredWidth), [configuredWidth]);

  const commitSnapshot = useCallback((next: RithmicLiquiditySnapshot) => {
    const now = Date.now();
    for (const trade of next.trades ?? []) {
      const key = Math.round(trade.price / Math.max(next.tickSize, 0.000_001));
      const current = recentAtPriceRef.current.get(key) ?? {
        bid: 0,
        ask: 0,
        lastAt: trade.timestamp,
        lastSize: trade.size,
        lastSide: trade.side,
      };
      if (trade.side === "BUY") current.ask += trade.size;
      else current.bid += trade.size;
      current.lastAt = trade.timestamp;
      current.lastSize = trade.size;
      current.lastSide = trade.side;
      recentAtPriceRef.current.set(key, current);
    }
    for (const [key, recent] of recentAtPriceRef.current) {
      if (now - recent.lastAt > recentWindowMs) recentAtPriceRef.current.delete(key);
    }
    setSnapshot(next);
    lastPublishedAtRef.current = now;
  }, [recentWindowMs]);

  useEffect(() => {
    const unsubscribe = subscribeRithmicLiquidity({
      root: instrument,
      contractSymbol,
      exchange: "CME",
      onSnapshot: (next) => {
        pendingSnapshotRef.current = next;
        const remaining = refreshRateMs - (Date.now() - lastPublishedAtRef.current);
        if (remaining <= 0) {
          if (publishTimerRef.current !== null) window.clearTimeout(publishTimerRef.current);
          publishTimerRef.current = null;
          commitSnapshot(next);
          return;
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
      unsubscribe();
      pendingSnapshotRef.current = null;
      if (publishTimerRef.current !== null) window.clearTimeout(publishTimerRef.current);
      publishTimerRef.current = null;
    };
  }, [commitSnapshot, contractSymbol, instrument, refreshRateMs]);

  useEffect(() => {
    if (!autoCenter) return;
    setCentreOffsetTicks(0);
  }, [autoCenter, contractSymbol, instrument]);

  const model = useMemo(() => buildDepthLadder({
    levels: snapshot?.levels ?? [],
    tickSize: snapshot?.tickSize ?? 0.25,
    groupTicks,
    rowCount,
    centrePrice: snapshot?.lastPrice ?? latestPrice,
    centreOffsetTicks,
  }), [centreOffsetTicks, groupTicks, latestPrice, rowCount, snapshot]);

  const tickSize = snapshot?.tickSize && snapshot.tickSize > 0 ? snapshot.tickSize : 0.25;
  const precision = decimalPlaces(tickSize);
  const displayDepthMax = depthScaleCap > 0 ? depthScaleCap : model.maxDepth;
  const displayCumulativeMax = depthScaleCap > 0 ? depthScaleCap : model.maxCumulative;
  const threshold = highlightThreshold > 0 ? highlightThreshold : model.maxDepth * 0.72;
  const lastPrice = snapshot?.lastPrice ?? latestPrice ?? null;
  const spreadTicks = model.bestBid !== null && model.bestAsk !== null
    ? Math.max(0, Math.round((model.bestAsk - model.bestBid) / tickSize))
    : null;
  const connected = status === "connected" && Boolean(snapshot?.bookValid && snapshot.fullDepth);
  const imbalancePercent = model.imbalance * 100;

  const recentForRow = (price: number) => {
    let bid = 0;
    let ask = 0;
    let lastSize = 0;
    let lastSide: "BUY" | "SELL" = "BUY";
    let latestAt = 0;
    for (let offset = 0; offset < groupTicks; offset += 1) {
      const key = Math.round(price / tickSize) - Math.floor(groupTicks / 2) + offset;
      const recent = recentAtPriceRef.current.get(key);
      if (!recent) continue;
      bid += recent.bid;
      ask += recent.ask;
      if (recent.lastAt >= latestAt) {
        latestAt = recent.lastAt;
        lastSize = recent.lastSize;
        lastSide = recent.lastSide;
      }
    }
    return { bid, ask, lastSize, lastSide };
  };

  const persistWidth = useCallback((nextWidth: number) => {
    const width = Math.max(196, Math.min(560, Math.round(nextWidth)));
    setRuntimeWidth(width);
    onUpdateSetting?.("width", width);
  }, [onUpdateSetting]);

  const beginResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { startX: event.clientX, startWidth: runtimeWidth, currentWidth: runtimeWidth };
    const onMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const nextWidth = dragRef.current.startWidth + (dragRef.current.startX - moveEvent.clientX);
      const width = Math.max(196, Math.min(560, Math.round(nextWidth)));
      dragRef.current.currentWidth = width;
      setRuntimeWidth(width);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const width = dragRef.current?.currentWidth ?? runtimeWidth;
      dragRef.current = null;
      onUpdateSetting?.("width", width);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  if (collapsed) {
    return (
      <aside className="relative flex h-full w-11 shrink-0 flex-col items-center border-l border-border bg-background/96 py-2 shadow-[-12px_0_30px_rgba(0,0,0,.2)]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface/60 text-primary hover:border-primary/40"
          title="Expand Depth of Market"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <DatabaseZap className="mt-3 h-3.5 w-3.5 text-primary" />
        <span className="mt-3 [writing-mode:vertical-rl] font-mono text-[8px] font-bold tracking-[0.18em] text-muted">DEPTH OF MARKET</span>
        <span className={`mt-auto h-2 w-2 rounded-full ${connected ? "animate-pulse bg-primary" : "bg-muted"}`} />
      </aside>
    );
  }

  // Preserve a usable three-column ladder when the user narrows the dock.
  // Optional professional columns progressively appear as horizontal room grows.
  const renderPullStack = showPullStack && runtimeWidth >= 420;
  const renderRecentTrades = showRecentTrades && runtimeWidth >= 320;
  const renderOrderCount = showOrderCount && runtimeWidth >= 360;
  const gridTemplateColumns = `${renderPullStack ? "42px " : ""}${renderRecentTrades ? "40px " : ""}minmax(48px,1fr) 82px minmax(48px,1fr)${renderRecentTrades ? " 40px" : ""}${renderPullStack ? " 42px" : ""}`;

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background/97 shadow-[-18px_0_45px_rgba(0,0,0,.28)] backdrop-blur-xl"
      style={{ width: runtimeWidth }}
      aria-label="Rithmic depth of market"
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const step = Math.max(1, Math.min(12, Math.round(Math.abs(event.deltaY) / 80) || 1));
        setCentreOffsetTicks((current) => current + (event.deltaY > 0 ? -step : step));
      }}
    >
      <button
        type="button"
        onPointerDown={beginResize}
        className="absolute inset-y-0 left-0 z-30 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/45"
        aria-label="Resize Depth of Market"
        title="Drag to resize"
      />

      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-2.5">
        <DatabaseZap className="h-3.5 w-3.5 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] font-bold tracking-[0.11em] text-foreground">DEPTH OF MARKET</div>
          <div className="truncate font-mono text-[8px] text-muted">{snapshot?.contractSymbol || contractSymbol || instrument} · RITHMIC FULL BOOK</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => persistWidth(runtimeWidth - 36)} className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:text-foreground" title="Narrower"><Minus className="h-3 w-3" /></button>
          <button type="button" onClick={() => persistWidth(runtimeWidth + 36)} className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:text-foreground" title="Wider"><Plus className="h-3 w-3" /></button>
          <button type="button" onClick={() => setCollapsed(true)} className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:text-foreground" title="Collapse DOM"><ChevronsRight className="h-3 w-3" /></button>
        </div>
      </header>

      {showHeaderStats ? (
        <div className="grid h-9 shrink-0 grid-cols-4 border-b border-border/70 bg-surface/25 font-mono">
          <div className="flex flex-col justify-center border-r border-border/50 px-2"><span className="text-[6px] tracking-[0.12em] text-muted">SPREAD</span><strong className="text-[9px] text-foreground">{spreadTicks ?? "—"} T</strong></div>
          <div className="flex flex-col justify-center border-r border-border/50 px-2"><span className="text-[6px] tracking-[0.12em] text-muted">BID DEPTH</span><strong className="text-[9px]" style={{ color: bidColor }}>{compact(model.bidTotal, true) || "0"}</strong></div>
          <div className="flex flex-col justify-center border-r border-border/50 px-2"><span className="text-[6px] tracking-[0.12em] text-muted">ASK DEPTH</span><strong className="text-[9px]" style={{ color: askColor }}>{compact(model.askTotal, true) || "0"}</strong></div>
          <div className="flex flex-col justify-center px-2"><span className="text-[6px] tracking-[0.12em] text-muted">IMBALANCE</span><strong className="text-[9px]" style={{ color: imbalancePercent >= 0 ? bidColor : askColor }}>{imbalancePercent >= 0 ? "+" : ""}{imbalancePercent.toFixed(1)}%</strong></div>
        </div>
      ) : null}

      <div
        className="grid h-7 shrink-0 items-center border-b border-border bg-surface/40 px-1 font-mono text-[6px] font-bold tracking-[0.09em] text-muted"
        style={{ gridTemplateColumns }}
      >
        {renderPullStack ? <span className="text-center">P/S</span> : null}
        {renderRecentTrades ? <span className="text-right">HIT</span> : null}
        <span className="pr-1 text-right">BID {showCumulative ? "CUM" : "DEPTH"}</span>
        <button type="button" onClick={() => setCentreOffsetTicks(0)} className="flex items-center justify-center gap-1 text-center text-foreground hover:text-primary" title="Recenter ladder"><LocateFixed className="h-2.5 w-2.5" /> PRICE</button>
        <span className="pl-1">ASK {showCumulative ? "CUM" : "DEPTH"}</span>
        {renderRecentTrades ? <span>LIFT</span> : null}
        {renderPullStack ? <span className="text-center">P/S</span> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {model.rows.map((row) => {
          const bidValue = showCumulative ? row.bidCumulative : row.bidSize;
          const askValue = showCumulative ? row.askCumulative : row.askSize;
          const recent = recentForRow(row.price);
          const atBid = model.bestBid !== null && Math.abs(row.price - model.bestBid) < model.increment / 2;
          const atAsk = model.bestAsk !== null && Math.abs(row.price - model.bestAsk) < model.increment / 2;
          const atLast = lastPrice !== null && Math.abs(row.price - lastPrice) < model.increment / 2;
          const bidScale = showCumulative ? displayCumulativeMax : displayDepthMax;
          const askScale = showCumulative ? displayCumulativeMax : displayDepthMax;
          const bidPercent = Math.min(100, bidValue / Math.max(1, bidScale) * 100);
          const askPercent = Math.min(100, askValue / Math.max(1, askScale) * 100);
          const bidHighlighted = row.bidSize >= threshold && row.bidSize > 0;
          const askHighlighted = row.askSize >= threshold && row.askSize > 0;
          return (
            <div
              key={row.price}
              className={`relative grid items-center border-b border-border/[0.18] px-1 font-mono ${atLast ? "z-10" : ""}`}
              style={{
                gridTemplateColumns,
                height: `${100 / rowCount}%`,
                minHeight: Math.max(11, fontSize + 4),
                fontSize,
                background: atLast ? "color-mix(in srgb, var(--primary) 10%, transparent)" : undefined,
                boxShadow: atLast ? "inset 0 1px color-mix(in srgb, var(--primary) 45%, transparent), inset 0 -1px color-mix(in srgb, var(--primary) 45%, transparent)" : undefined,
              }}
            >
              {renderPullStack ? <span className="truncate text-center text-[0.8em]" style={{ color: row.bidPullStack >= 0 ? bidColor : askColor }}>{signed(row.bidPullStack, compactNumbers)}</span> : null}
              {renderRecentTrades ? <span className="truncate pr-1 text-right font-semibold" style={{ color: askColor }}>{compact(recent.bid, compactNumbers)}</span> : null}
              <div className={`relative flex h-full items-center justify-end overflow-hidden pr-1.5 ${bidHighlighted ? "ring-1 ring-inset" : ""}`} style={{ boxShadow: bidHighlighted ? `inset 0 0 14px color-mix(in srgb, ${bidColor} 24%, transparent)` : undefined }}>
                {showDepthHistogram && bidValue > 0 ? <span className="absolute inset-y-[1px] right-0 rounded-l-sm" style={{ width: `${bidPercent}%`, background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${bidColor} 44%, transparent))` }} /> : null}
                <span className="relative font-semibold" style={{ color: bidValue ? bidColor : "var(--muted)" }}>
                  {bidValue ? compact(bidValue, compactNumbers) : ""}{renderOrderCount && row.bidOrders ? <small className="ml-1 text-[0.72em] opacity-65">{row.bidOrders}</small> : null}
                </span>
              </div>
              <div className={`relative flex h-full items-center justify-center border-x font-semibold ${atLast ? "text-primary" : "text-foreground"}`} style={{ borderColor: atLast ? lastTradeColor : "var(--border)" }}>
                {row.price.toFixed(precision)}
                {atBid ? <span className="absolute left-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bidColor, boxShadow: `0 0 8px ${bidColor}` }} /> : null}
                {atAsk ? <span className="absolute right-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: askColor, boxShadow: `0 0 8px ${askColor}` }} /> : null}
                {atLast && recent.lastSize ? <span className="absolute right-0.5 top-0 text-[0.62em]" style={{ color: recent.lastSide === "BUY" ? bidColor : askColor }}>{compact(recent.lastSize, true)}</span> : null}
              </div>
              <div className={`relative flex h-full items-center overflow-hidden pl-1.5 ${askHighlighted ? "ring-1 ring-inset" : ""}`} style={{ boxShadow: askHighlighted ? `inset 0 0 14px color-mix(in srgb, ${askColor} 24%, transparent)` : undefined }}>
                {showDepthHistogram && askValue > 0 ? <span className="absolute inset-y-[1px] left-0 rounded-r-sm" style={{ width: `${askPercent}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${askColor} 44%, transparent), transparent)` }} /> : null}
                <span className="relative font-semibold" style={{ color: askValue ? askColor : "var(--muted)" }}>
                  {renderOrderCount && row.askOrders ? <small className="mr-1 text-[0.72em] opacity-65">{row.askOrders}</small> : null}{askValue ? compact(askValue, compactNumbers) : ""}
                </span>
              </div>
              {renderRecentTrades ? <span className="truncate pl-1 font-semibold" style={{ color: bidColor }}>{compact(recent.ask, compactNumbers)}</span> : null}
              {renderPullStack ? <span className="truncate text-center text-[0.8em]" style={{ color: row.askPullStack >= 0 ? askColor : bidColor }}>{signed(row.askPullStack, compactNumbers)}</span> : null}
            </div>
          );
        })}
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-1.5 border-t border-border bg-surface/35 px-2 font-mono text-[7px] text-muted">
        <Activity className={`h-3 w-3 ${connected ? "text-primary" : "text-muted"}`} />
        <span>{snapshot?.fullDepth ? "FULL DEPTH" : "WAITING FOR RITHMIC FULL DEPTH"}</span>
        {showImbalance ? <span className="ml-auto" style={{ color: imbalancePercent >= 0 ? bidColor : askColor }}>{imbalancePercent >= 0 ? "BID" : "ASK"} {Math.abs(imbalancePercent).toFixed(0)}%</span> : null}
        <span className={`rounded-full border px-1.5 py-0.5 font-bold ${connected ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-background text-muted"}`}>
          {statusLabel(status, snapshot)}
        </span>
      </footer>
    </aside>
  );
}
