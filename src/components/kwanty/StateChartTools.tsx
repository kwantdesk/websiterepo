"use client";

import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChartDrawLayer, { type DrawCandle } from "@/components/ChartDrawLayer";
import ChartDrawSettings from "@/components/ChartDrawSettings";
import KwantyIndicators from "./KwantyIndicators";
import { DrawingToolIcon } from "@/components/ChartDrawToolbar";
import { DRAW_TOOL_GROUPS, DRAW_TOOL_LIST, DRAW_TOOL_SPECS, createDrawing, normalizeDrawings, type Drawing, type DrawToolId, type DrawPoint } from "@/lib/chartDrawTools";
import { fetchInstitutionalFrontMonth, fetchInstitutionalVolumeProfile, isExecutionBackedVolumeProfile, type InstitutionalVolumeProfile } from "@/lib/institutionalMarketData";
import { stateDrawingCoordinates, stateDrawingSource, stateProfileWindow, type StateDrawingApi, type StateDrawingFrame, type StateDrawingMount } from "@/lib/kwantyStateDrawingAdapter";
const EmojiPicker = dynamic(() => import("@/components/ChartEmojiPicker"), {ssr:false});

type Session = {
  element: HTMLElement; api: StateDrawingApi; frame: StateDrawingFrame;
  listeners: Set<() => void>; render(): void;
  dependencies: { frontMonth: typeof fetchInstitutionalFrontMonth; profile: typeof fetchInstitutionalVolumeProfile };
};
const isProfile = (drawing: Drawing) => ["fixedRangeVolumeProfile", "anchoredVolumeProfile"].includes(drawing.tool);
const noData = (ticker: string) => ["SPX", "SPXW", "NDX", "VIX", "DJX", "RUT"].includes(ticker)
  ? "Cash index: no traded volume. Use a traded underlying."
  : "Exact volume-at-price is unavailable for this instrument.";

function StateTools({ session }: { session: Session }) {
  const { api, frame } = session;
  const [tool, setTool] = useState<DrawToolId>("cursor"), [selected, setSelected] = useState<string | null>(null);
  const [drawings, setDrawings] = useState(() => normalizeDrawings(api.read(frame.ticker)));
  const [stay, setStay] = useState(false), [magnet, setMagnet] = useState(false), [strong, setStrong] = useState(false);
  const [group, setGroup] = useState<string | null>(null), [editing, setEditing] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("🧲"), [emojiPicker, setEmojiPicker] = useState(false), [quickEmojis, setQuickEmojis] = useState<string[]>([]);
  const [textRequest, setTextRequest] = useState<{ points: DrawPoint[]; tool: DrawToolId } | null>(null), [text, setText] = useState("");
  const [profiles, setProfiles] = useState<Record<string, InstitutionalVolumeProfile>>({});
  const [profileStatus, setProfileStatus] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Drawing[][]>([]), [future, setFuture] = useState<Drawing[][]>([]);
  const editingGesture = useRef(false), drawingsRef = useRef(drawings), overlayRef = useRef<HTMLDivElement>(null); drawingsRef.current = drawings;
  const profileSignatures = useRef<Record<string, string>>({}), completedSignatures = useRef<Record<string, string>>({});
  const coordinates = useRef(stateDrawingCoordinates(() => session.frame)).current;
  useEffect(() => {
    const sync = () => { try { setEmoji(localStorage.getItem("kwantdesk:chart-emoji:v1") || "🧲"); } catch {} };
    sync();window.addEventListener("kwantdesk:chart-emoji-quick-picks-changed",sync);
    return () => window.removeEventListener("kwantdesk:chart-emoji-quick-picks-changed",sync);
  }, []);
  const openEmojis = async () => {
    const catalog = await import("@/lib/chartEmojiCatalog");
    let recent: unknown = [];try {recent=JSON.parse(localStorage.getItem(catalog.CHART_QUICK_EMOJI_STORAGE_KEY)||"[]");}catch {}
    setQuickEmojis(catalog.normalizeChartQuickEmojis(recent));setEmojiPicker(true);
  };
  const subscribe = useCallback((listener: () => void) => { session.listeners.add(listener); return () => { session.listeners.delete(listener); }; }, [session]);
  const commit = (next: Drawing[], record = true) => {
    if (record) { setHistory(previous => [...previous.slice(-29), structuredClone(drawingsRef.current)]); setFuture([]); }
    api.write(next, frame.ticker); drawingsRef.current = next; setDrawings(next);
  };
  const update = (drawing: Drawing) => {
    const start = !editingGesture.current;
    editingGesture.current = true;
    commit(drawingsRef.current.map(row => row.id === drawing.id ? drawing : row), start);
  };
  const remove = (id: string) => { commit(drawingsRef.current.filter(row => row.id !== id)); setSelected(null); };
  const undo = () => {
    if (!history.length) return;
    setFuture(next => [...next, structuredClone(drawingsRef.current)]);
    const previous = history.at(-1)!; setHistory(next => next.slice(0, -1)); commit(previous, false);
  };
  const redo = () => {
    if (!future.length) return;
    setHistory(next => [...next, structuredClone(drawingsRef.current)]);
    const next = future.at(-1)!; setFuture(rows => rows.slice(0, -1)); commit(next, false);
  };
  useEffect(() => {
    const element = overlayRef.current;
    if (!element) return;
    const zoom = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation();
      const rect = element.getBoundingClientRect();
      api.zoom({ x: event.clientX - rect.left, y: event.clientY - rect.top, deltaY: event.deltaY, deltaMode: event.deltaMode, ctrlKey: event.ctrlKey });
    };
    element.addEventListener("wheel", zoom, {passive: false});
    return () => element.removeEventListener("wheel", zoom);
  }, [api]);
  useEffect(() => {
    const doc = session.element.ownerDocument, view = doc.defaultView!;
    const finish = () => { editingGesture.current = false; };
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest("input,textarea,select,[contenteditable]")) return;
      if (event.key === "Escape") { setTool("cursor"); setSelected(null); setGroup(null); setTextRequest(null); setEditing(null); setEmojiPicker(false); }
      if (event.key === "Delete" && selected) { event.preventDefault(); remove(selected); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
    };
    doc.addEventListener("keydown", key); view.addEventListener("pointerup", finish); view.addEventListener("pointercancel", finish);
    return () => { doc.removeEventListener("keydown", key); view.removeEventListener("pointerup", finish); view.removeEventListener("pointercancel", finish); };
  });
  // Exact profiles use the existing coalesced gateway client, only on committed
  // ranges/settings (300ms debounce). No timer/polling or GEX-as-volume fallback.
  const ranges = drawings.filter(isProfile);
  const signatures = Object.fromEntries(ranges.map(drawing => [drawing.id, JSON.stringify([stateProfileWindow(drawing, frame), drawing.style.profileGroupTicks, drawing.style.valueAreaPercent, drawing.style.profileMinTradeVolume, drawing.style.profileMaxTradeVolume])]));
  const profileKey = JSON.stringify(signatures);
  const visibleProfiles = Object.fromEntries(Object.entries(profiles).filter(([id]) => signatures[id] === completedSignatures.current[id]));
  useEffect(() => {
    let cancelled = false;
    const previousSignatures = profileSignatures.current;
    setProfiles(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => signatures[id] && signatures[id] === previousSignatures[id])));
    profileSignatures.current = signatures;
    if (frame.active === false || !frame.geometry) return;
    const source = stateDrawingSource(frame.ticker);
    if (!["ES", "NQ"].includes(source)) {
      setProfileStatus(Object.fromEntries(ranges.map(drawing => [drawing.id, noData(frame.ticker)]))); return;
    }
    setProfileStatus(Object.fromEntries(ranges.map(drawing => [drawing.id, "Loading exact traded volume…"])));
    const timer = setTimeout(() => { void (async () => {
      const contract = ranges.length ? await session.dependencies.frontMonth(source) : null;
      // Sequential to avoid request storms after workspace restore.
      for (const drawing of ranges) {
        if (cancelled || session.frame.active === false) return;
        const window = stateProfileWindow(drawing, frame);
        const profile = contract && window ? await session.dependencies.profile({
          symbol: source, contractSymbol: contract.contractSymbol, period: "custom", ...window,
          groupTicks: drawing.style.profileGroupTicks ?? 4, valueAreaPercent: drawing.style.valueAreaPercent ?? 68,
          minTradeVolume: drawing.style.profileMinTradeVolume ?? 0, maxTradeVolume: drawing.style.profileMaxTradeVolume ?? 0,
        }) : null;
        if (cancelled) return;
        const valid = isExecutionBackedVolumeProfile(profile);
        if (valid) { completedSignatures.current[drawing.id] = signatures[drawing.id]; setProfiles(previous => ({ ...previous, [drawing.id]: profile })); }
        setProfileStatus(previous => ({ ...previous, [drawing.id]: valid ? "" : "Exact range history unavailable." }));
      }
    })().catch(() => { if (!cancelled) setProfileStatus(Object.fromEntries(ranges.map(drawing => [drawing.id, "Exact range history unavailable."]))); }); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  // Key contains all committed range inputs; panning/crosshairs do not fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileKey, frame.ticker, frame.active, Boolean(frame.geometry)]);
  const candles: DrawCandle[] = useMemo(() => frame.candles.map(candle => ({ ...candle, time: candle.time / 1000, volume: candle.volume ?? NaN })), [frame.candles]);
  const choose = (id: DrawToolId) => { api.activate(); setTool(id); setGroup(null); setSelected(null); };
  const styleDrawing = drawings.find(drawing => drawing.id === editing) ?? null;
  const panelWindow = session.element.ownerDocument.defaultView!;
  return <>
    <KwantyIndicators element={session.element} api={api} getFrame={() => session.frame} subscribe={subscribe} />
    <div className="state-draw-rail" role="toolbar" aria-label={"Drawing tools for " + frame.ticker}>
      {DRAW_TOOL_GROUPS.map(entry => {
        const tools = DRAW_TOOL_LIST.filter(spec => spec.group === entry.id);
        const chosen = tools.find(spec => spec.id === tool) ?? tools[0];
        return <div key={entry.id} className="state-draw-group">
          <button title={chosen.label} aria-label={chosen.label} aria-pressed={chosen.id === tool} onClick={() => chosen.id === "emoji" ? void openEmojis() : choose(chosen.id)}>{chosen.id === "emoji" ? emoji : <DrawingToolIcon tool={chosen.id} />}</button>
          {tools.length > 1 && <button className="state-draw-expand" aria-label={entry.label + " tools"} aria-expanded={group === entry.id} onClick={() => setGroup(group === entry.id ? null : entry.id)}>›</button>}
        </div>;
      })}
      <button title="Snap to real candle OHLC" aria-label="Magnet" aria-pressed={magnet} onClick={() => setMagnet(!magnet)}>∩</button>
      <button title="Magnet strength" aria-pressed={strong} onClick={() => setStrong(!strong)}>{strong ? "STR" : "STD"}</button>
      <button title="Keep drawing" aria-pressed={stay} onClick={() => setStay(!stay)}>STAY</button>
      <button title="Drawing settings" disabled={!selected} onClick={() => { editingGesture.current = false; setEditing(selected); }}>STY</button>
      <button title="Delete selected drawing" disabled={!selected} onClick={() => selected && remove(selected)}>DEL</button>
      <button title="Undo drawing edit" disabled={!history.length} onClick={undo}>↶</button>
      <button title="Redo drawing edit" disabled={!future.length} onClick={redo}>↷</button>
      <button title="Clear drawings on this panel and ticker" disabled={!drawings.length} onClick={() => { commit([]); setSelected(null); }}>CLR</button>
    </div>
    {group && <div className="state-draw-menu" role="menu" aria-label={group + " drawing tools"}>
      {DRAW_TOOL_LIST.filter(spec => spec.group === group).map(spec => <button role="menuitem" key={spec.id}
        disabled={spec.id === "anchoredVwap" && !candles.some(candle => candle.volume > 0)}
        title={spec.id === "anchoredVwap" && !candles.some(candle => candle.volume > 0) ? "Requires reported traded bar volume; not supplied by a cash index." : spec.label}
        onClick={() => choose(spec.id)}><DrawingToolIcon tool={spec.id} />{spec.label}</button>)}
    </div>}
    <div ref={overlayRef} className="state-draw-overlay" onPointerDownCapture={() => { api.activate(); }}>
      <ChartDrawLayer width={frame.width} height={frame.height} priceScaleWidth={frame.width - (frame.geometry?.right ?? frame.width)}
        plotTopInset={frame.geometry?.top ?? 0} plotBottomInset={frame.height - (frame.geometry?.bottom ?? frame.height)}
        activeTool={frame.geometry ? tool : "cursor"} emoji={emoji} keepDrawing={stay} drawings={drawings} selectedId={selected}
        {...coordinates} candles={candles} volumeProfiles={visibleProfiles} volumeProfileMessages={profileStatus} requireExactVolumeProfiles
        magnet={magnet} magnetStrength={strong ? "strong" : "weak"} viewportVersion={0} chartReady={1} subscribeViewport={subscribe}
        onCommit={drawing => { commit([...drawingsRef.current, drawing]); setSelected(drawing.id); }}
        onUpdate={update} onDelete={remove} onSelect={setSelected} onToolConsumed={() => { if (!stay) setTool("cursor"); }}
        onRequestText={(points, kind) => { setText(""); setTextRequest({ points, tool: kind }); }}
        onOpenSettings={id => { editingGesture.current = false; setEditing(id); }}
        themeColor={frame.bullish} themeBearColor={frame.bearish} currentPrice={frame.lastPrice} />
    </div>
    {textRequest && <form className="state-draw-text" onSubmit={event => { event.preventDefault(); if (!text.trim()) return;
      const drawing = createDrawing(textRequest.tool, textRequest.points, text.trim()); commit([...drawingsRef.current, drawing]); setSelected(drawing.id); setTextRequest(null); if (!stay) setTool("cursor");
    }}><label>Annotation<input autoFocus value={text} maxLength={1000} onChange={event => setText(event.target.value)} /></label><button type="submit">Add</button><button type="button" onClick={() => setTextRequest(null)}>Cancel</button></form>}
    <ChartDrawSettings drawing={styleDrawing} onChange={update} onClose={() => { setEditing(null); editingGesture.current = false; panelWindow.focus(); }} themeColor={frame.bullish} themeBearColor={frame.bearish} />
    {emojiPicker && createPortal(<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30" onClick={() => setEmojiPicker(false)}>
      <div className="flex h-[560px] max-h-[90vh] w-[340px] flex-col rounded border border-border bg-panel p-2" onClick={event => event.stopPropagation()}>
        <button className="self-end px-2 text-xs text-muted" onClick={() => setEmojiPicker(false)}>Close</button>
        <EmojiPicker emoji={emoji} quickEmojis={quickEmojis} onSelect={value => { void import("@/lib/chartEmojiCatalog").then(catalog => {
          const next=catalog.promoteChartQuickEmoji(quickEmojis,value);setEmoji(value);setQuickEmojis(next);
          try {localStorage.setItem(catalog.CHART_QUICK_EMOJI_STORAGE_KEY,JSON.stringify(next));localStorage.setItem("kwantdesk:chart-emoji:v1",value);window.dispatchEvent(new Event(catalog.CHART_QUICK_EMOJI_EVENT));window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));}catch {}
          setEmojiPicker(false);choose("emoji");panelWindow.focus();
        });}} />
      </div>
    </div>,document.body)}
  </>;
}

export function mountStateChartTools(element: HTMLElement, api: StateDrawingApi, dependencies = { frontMonth: fetchInstitutionalFrontMonth, profile: fetchInstitutionalVolumeProfile }): StateDrawingMount {
  // Reuse the site's actual component stylesheet inside the same-origin canvas
  // frame; copy links once, not styles or network requests on every paint.
  const doc = element.ownerDocument;
  if (doc !== document) for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    if ([...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].some(candidate => candidate.href === link.href)) continue;
    const copy = doc.createElement("link"); copy.rel = "stylesheet"; copy.href = link.href; doc.head.prepend(copy);
  }
  const root = createRoot(element);
  let disposed = false, scheduled: number | null = null, key = "", lastCandles: StateDrawingFrame["candles"] | null = null;
  const session: Session = { element, api, dependencies, listeners: new Set(), frame: null!, render: () => {
    if (disposed || scheduled !== null) return;
    scheduled = requestAnimationFrame(() => { scheduled = null; if (!disposed) root.render(<StateTools key={session.frame.ticker} session={session} />); });
  } };
  return {
    update(frame) {
      if (disposed) return;
      const nextKey = [frame.ticker, frame.width, frame.height, !!frame.geometry, frame.multiplier, frame.offset, frame.bullish, frame.bearish, frame.lastPrice, frame.active, frame.candlesVisible].join(":");
      session.frame = frame;
      if (nextKey !== key || frame.candles !== lastCandles) { key = nextKey; lastCandles = frame.candles; session.render(); }
      for (const listener of session.listeners) listener();
    },
    dispose() { disposed = true; if (scheduled !== null) cancelAnimationFrame(scheduled); session.listeners.clear(); root.unmount(); },
  };
}
