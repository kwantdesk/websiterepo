"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { liquidityMapExecutionQuote, liquidityMapPickedPrice, liquidityMapTradeLevels, liquidityMapLevelLabel, type MapTradeLevel } from "@/lib/liquidityMapTrading";
import { normalizePaperSymbol, paperTickSize, type PaperOrder, type PaperPosition, type PaperProtectionUpdate } from "@/lib/paperTrading";
import { loadStoredChartSettings, CHART_SETTINGS_CHANGE_EVENT } from "@/lib/chartSettings";
import { legibleOn, readableTextOn } from "@/lib/readableContrast";
import { PAPER_LABEL_HEIGHT, PAPER_LABEL_FONT_PX, PAPER_LABEL_PAD_X, PAPER_LABEL_CLOSE_WIDTH, PAPER_LABEL_ICON_PX, paperLabelWidthPx } from "@/lib/paperTradeOverlay";

export type LiquidityMapTradingProps = {
  paneId: string; accountId?: string; enabled: boolean;
  positions: PaperPosition[]; orders: PaperOrder[];
  armedOrder: { side: "buy" | "sell"; type: "limit" | "stop"; quantity: number } | null;
  onOpenTicket: () => void; onPick: (price: number) => void; onCancelPick: () => void;
  onQuote: (quote: NonNullable<ReturnType<typeof liquidityMapExecutionQuote>>) => void;
  onProtection: (accountId: string, ownerId: string, update: PaperProtectionUpdate) => void;
  onOrderPrice: (accountId: string, orderId: string, price: number) => void;
  onDrag: (ownerId: string, dragging: boolean) => void;
  onClose: (accountId: string, positionId: string) => void;
  onCancelOrder: (accountId: string, orderId: string) => void;
};
type Plot = { left: number; top: number; width: number; height: number; topPrice: number; bottomPrice: number };

/** The iframe owns price geometry; the workspace owns orders, confirmations and execution. */
export default function LiquidityMapTrading({ iframeRef, instrument, active, replay, trading, onActivate }: {
  iframeRef: RefObject<HTMLIFrameElement | null>; instrument: string; active: boolean; replay: boolean;
  trading: LiquidityMapTradingProps; onActivate?: () => void;
}) {
  const symbol = normalizePaperSymbol(instrument);
  const scope = `${trading.accountId ?? ""}:${symbol}:${replay}`;
  const [plot, setPlot] = useState<Plot | null>(null);
  const [preview, setPreview] = useState<{ id: string; price: number } | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [appearance, setAppearance] = useState(() => loadStoredChartSettings());
  const labelBackground = readableTextOn(appearance.backgroundColor);
  const labelText = readableTextOn(labelBackground);
  useEffect(() => {
    const update = () => setAppearance(loadStoredChartSettings());
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, update);
    window.addEventListener("kwantdesk:theme-change", update);
    return () => { window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, update); window.removeEventListener("kwantdesk:theme-change", update); };
  }, []);
  const levels = useMemo(() => liquidityMapTradeLevels(symbol, trading.accountId, trading.positions, trading.orders), [symbol, trading.accountId, trading.positions, trading.orders]);
  const current = useRef({ trading, levels, scope, symbol, active, replay, plot });
  useLayoutEffect(() => { current.current = { trading, levels, scope, symbol, active, replay, plot }; });
  const drag = useRef<{ id: string; ownerId: string; scope: string; price: number; pointerId: number; release: () => void } | null>(null);
  const cancelDrag = () => {
    const previous = drag.current;
    drag.current = null;
    if (previous && layer.current?.hasPointerCapture(previous.pointerId)) layer.current.releasePointerCapture(previous.pointerId);
    previous?.release();
    setPreview(null);
  };
  useEffect(() => {
    cancelDrag();
    setPlot(null);
    // Always release the engine's protection suspension, including on unmount/account changes.
    return () => { const d = drag.current; drag.current = null; d?.release(); };
  }, [scope]);
  useEffect(() => {
    if (drag.current && !levels.some(level => level.id === drag.current?.id)) cancelDrag();
  }, [levels]);
  useEffect(() => {
    if (!trading.enabled || !active || replay) cancelDrag();
  }, [trading.enabled, active, replay]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") cancelDrag(); };
    window.addEventListener("keydown", escape);
    window.addEventListener("blur", cancelDrag);
    return () => { window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancelDrag); };
  }, []);
  useEffect(() => {
    const post = () => iframeRef.current?.contentWindow?.postMessage({ type: "kwantdesk:liquidity-map-trading", symbol,
      scope, armed: active && !replay && trading.enabled ? trading.armedOrder : null }, window.location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const state = current.current;
      if (event.data?.type === "kwantdesk:liquidity-map-ready") post();
      if (event.data?.type === "kwantdesk:liquidity-map-plot") {
        const p = event.data;
        if ([p.left, p.top, p.width, p.height, p.topPrice, p.bottomPrice].every(v => typeof v === "number" && Number.isFinite(v))
          && p.width > 0 && p.height > 0 && p.topPrice > p.bottomPrice && p.symbol === state.symbol) {
          setPlot(old => old && ["left", "top", "width", "height", "topPrice", "bottomPrice"].every(k => old[k as keyof Plot] === p[k]) ? old : p);
        }
      }
      if (event.data?.type === "kwantdesk:liquidity-map-execution-quote" && !state.replay) {
        const quote = liquidityMapExecutionQuote(event.data, state.symbol, state.trading.paneId);
        if (quote) state.trading.onQuote(quote);
      }
      if (event.data?.type === "kwantdesk:liquidity-map-order-pick" && state.active && !state.replay && state.trading.enabled
        && event.data.scope === state.scope && event.data.symbol === state.symbol) {
        if (event.data.cancel) state.trading.onCancelPick();
        else {
          const price = liquidityMapPickedPrice(state.symbol, event.data.price);
          if (price !== null && state.trading.armedOrder) state.trading.onPick(price);
        }
      }
    };
    window.addEventListener("message", receive);
    iframeRef.current?.addEventListener("load", post);
    post();
    const iframe = iframeRef.current;
    return () => { window.removeEventListener("message", receive); iframe?.removeEventListener("load", post); };
  }, [iframeRef, symbol, scope, active, replay, trading.enabled, trading.armedOrder]);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, level: MapTradeLevel) => {
    if (event.button !== 0 || !trading.enabled || replay || !level.draggable || !plot) return;
    if (drag.current && drag.current.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation(); onActivate?.(); cancelDrag();
    const ownerId = level.ownerId;
    trading.onDrag(ownerId, true);
    drag.current = { id: level.id, ownerId, scope, price: level.price, pointerId: event.pointerId, release: () => trading.onDrag(ownerId, false) };
    // Capture on the stable plot, not a moving label that can leave the visible
    // range and unmount while the map recentres. Never hand the gesture to iframe pan.
    layer.current?.setPointerCapture(event.pointerId);
    setPreview({ id: level.id, price: level.price });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current, p = current.current.plot;
    const iframe = iframeRef.current;
    if (!d || d.pointerId !== event.pointerId || !p || !iframe) return;
    event.preventDefault(); event.stopPropagation();
    const rect = iframe.getBoundingClientRect();
    const scale = iframe.clientHeight > 0 ? rect.height / iframe.clientHeight : 1;
    const y = (event.clientY - rect.top) / scale - p.top;
    const price = liquidityMapPickedPrice(symbol, p.topPrice - y / p.height * (p.topPrice - p.bottomPrice));
    if (price !== null) { d.price = price; setPreview({ id: d.id, price }); }
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    moveDrag(event);
    const d = drag.current, state = current.current;
    const level = state.levels.find(l => l.id === d?.id);
    try {
      if (d && level && d.scope === state.scope && state.trading.enabled && state.active && !state.replay) {
        if (level.kind === "entry") state.trading.onOrderPrice(level.accountId, level.ownerId, d.price);
        else if (level.kind === "stop_loss") state.trading.onProtection(level.accountId, level.ownerId, { kind: "stop_loss", price: d.price });
        else state.trading.onProtection(level.accountId, level.ownerId, { kind: "take_profit", targetId: level.targetId, price: d.price });
      }
    } finally { cancelDrag(); }
  };
  return <>
    <button type="button" className="absolute right-3 top-2 z-20 inline-flex h-7 items-center justify-center rounded-[3px] border border-border/70 bg-background px-2.5 text-[10px] font-semibold uppercase leading-none tracking-[.075em] text-muted hover:border-primary/30 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      style={plot ? { right: "auto", left: plot.left + plot.width - 65, top: plot.top + 8 } : undefined}
      onClick={() => { onActivate?.(); trading.onOpenTicket(); }}>Trade</button>
    {plot && active && !replay && trading.enabled && trading.armedOrder && <span className="pointer-events-none absolute z-20 bg-panel px-2 py-1 text-xs text-foreground" style={{ left: plot.left + 8, top: plot.top + 8 }}>Click map to place {trading.armedOrder.type.toUpperCase()} · Esc to cancel</span>}
    {plot && <div ref={layer} className="pointer-events-none absolute z-20 overflow-hidden" onPointerMove={moveDrag} onPointerUp={endDrag}
      onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
      style={{ left: plot.left, top: plot.top, width: plot.width, height: plot.height }}>
      {levels.map(level => {
        const price = preview?.id === level.id ? preview.price : level.price;
        const y = (plot.topPrice - price) / (plot.topPrice - plot.bottomPrice) * plot.height;
        if (y < 0 || y > plot.height) return null;
        const color = legibleOn(level.kind === "stop_loss" || level.kind === "entry" && level.side === "sell" ? appearance.downColor : appearance.upColor, appearance.backgroundColor);
        const label = liquidityMapLevelLabel(level, symbol, price);
        const owner = level.resting ? trading.orders.find(o => o.id === level.ownerId) : trading.positions.find(p => p.id === level.ownerId);
        return <div key={level.id} className="absolute left-0 right-0 border-t" style={{ top: y, borderColor: color, borderStyle: level.kind === "entry" ? "solid" : "dashed" }}>
          <div className={`${level.kind === "entry" ? "paper-position-overlay-label" : "paper-protection-overlay-label"} pointer-events-auto absolute right-1 flex -translate-y-1/2 items-stretch overflow-hidden border font-mono font-bold`}
            style={{ borderColor: color, color: labelText, backgroundColor: labelBackground, fontSize: PAPER_LABEL_FONT_PX, height: PAPER_LABEL_HEIGHT, width: paperLabelWidthPx(label, level.kind === "entry" ? 2 : 0, true), maxWidth: "calc(100% - 8px)" }}>
            <button type="button" aria-label={`${level.label} ${symbol} at ${price}`} disabled={replay || !trading.enabled}
              className="min-w-0 flex-1 touch-none truncate text-left active:cursor-grabbing" style={{ cursor: level.draggable ? "ns-resize" : "default", paddingInline: PAPER_LABEL_PAD_X }}
              title={level.draggable ? "Drag to adjust protection" : "Filled entry price"} onPointerDown={e => startDrag(e, level)}>
              {label}
            </button>
            {level.kind !== "entry" && <button type="button" disabled={!active || replay || !trading.enabled} className="flex shrink-0 items-center justify-center border-l hover:bg-danger/15 hover:text-danger"
              style={{ borderColor: color, width: PAPER_LABEL_CLOSE_WIDTH }} aria-label={`Remove ${level.kind === "stop_loss" ? "stop loss" : "take profit"} from ${symbol} position`}
              onClick={() => trading.onProtection(level.accountId, level.ownerId, { kind: level.kind as "stop_loss" | "take_profit", targetId: level.targetId, price: null })}><X style={{ width: PAPER_LABEL_ICON_PX, height: PAPER_LABEL_ICON_PX }} /></button>}
            {level.kind === "entry" && active && !replay && trading.enabled && <>
              {owner?.stopLoss == null && <button type="button" className="border border-border px-1" title="Add stop loss" onClick={() => trading.onProtection(level.accountId, level.ownerId, { kind: "stop_loss", price: level.price + (owner?.side === "buy" ? -1 : 1) * paperTickSize(symbol) * 8 })}>+SL</button>}
              {!levels.some(l => l.ownerId === level.ownerId && l.kind === "take_profit") && <button type="button" className="border border-border px-1" title="Add take profit" onClick={() => trading.onProtection(level.accountId, level.ownerId, { kind: "take_profit", price: level.price + (owner?.side === "buy" ? 1 : -1) * paperTickSize(symbol) * 8 })}>+TP</button>}
              <button type="button" className="border border-border px-1" title={level.resting ? "Cancel working order" : "Close position"} onClick={() => level.resting ? trading.onCancelOrder(level.accountId, level.ownerId) : trading.onClose(level.accountId, level.ownerId)}>×</button>
            </>}
          </div>
        </div>;
      })}
    </div>}
  </>;
}
