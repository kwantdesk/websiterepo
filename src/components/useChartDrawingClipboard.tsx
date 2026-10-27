"use client";

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { copyChartDrawing, hasChartDrawingClipboard, isDrawingClipboardTextTarget, pasteChartDrawing } from '@/lib/chartDrawingClipboard';
import type { Drawing, DrawPoint } from '@/lib/chartDrawTools';

export type ChartDrawingContextActions = { copy: (() => boolean) | null; paste: (() => boolean) | null };
const chartContextActions = new WeakMap<MouseEvent, ChartDrawingContextActions>();
export const getChartDrawingContextActions = (event: MouseEvent) => chartContextActions.get(event);

const activeLayers = new WeakMap<Document, string>();
const layerHits = new WeakMap<Element, Map<string, (event: MouseEvent) => string | null>>();

export function useChartDrawingClipboard(args: {
  svgRef: RefObject<SVGSVGElement | HTMLCanvasElement | null>;
  drawings?: Drawing[]; selectedId: string | null;
  toX?: (time: number) => number | null; toY?: (price: number) => number | null;
  fromXY?: (x: number, y: number) => DrawPoint | null;
  onCommit?: (drawing: Drawing) => void; onSelect: (id: string | null) => void;
  clipboard?: { copy: (id: string | null) => boolean; paste: () => boolean; has: () => boolean };
  findAt?: (event: MouseEvent) => string | null;
}) {
  const id = useId();
  const live = useRef(args); live.current = args;
  const [menu, setMenu] = useState<{ x: number; y: number; drawingId: string | null } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const copy = (drawingId: string | null) => {
    if (live.current.clipboard) return live.current.clipboard.copy(drawingId);
    const drawing = live.current.drawings?.find(row => row.id === drawingId);
    if (!drawing) return false;
    copyChartDrawing(drawing); return true;
  };
  const paste = () => {
    const current = live.current;
    if (current.clipboard) return current.clipboard.paste();
    const drawing = pasteChartDrawing((source, ordinal) => {
      const anchor = source.points[0];
      if (!anchor) return NaN;
      const x = current.toX?.(anchor.time), y = current.toY?.(anchor.price);
      if (x == null || y == null) return NaN;
      const translated = current.fromXY?.(x + 24 * ordinal, y);
      return translated ? translated.time - anchor.time : NaN;
    });
    if (!drawing) return false;
    current.onCommit?.(drawing); current.onSelect(drawing.id); return true;
  };
  const actions = useRef({ copy, paste }); actions.current = { copy, paste };

  useEffect(() => {
    const svg = live.current.svgRef.current;
    const container = (svg?.closest?.('[data-chart-instance-id]') ?? svg?.parentElement) as HTMLElement | null;
    if (!svg || !container) return;
    const doc = svg.ownerDocument;
    const hasClipboard = () => live.current.clipboard?.has() ?? hasChartDrawingClipboard();
    const findAt = (event: MouseEvent) => {
      if (live.current.findAt) return live.current.findAt(event);
      const hit = (event.target as Element | null)?.closest?.('[data-chart-drawing-id]');
      return hit && svg.contains(hit) ? hit.getAttribute('data-chart-drawing-id') : null;
    };
    const hits = layerHits.get(container) ?? new Map();
    hits.set(id, findAt); layerHits.set(container, hits);
    let rightPress: { x: number; y: number; moved: boolean } | null = null;
    const focus = (event: PointerEvent) => {
      if (!container.contains(event.target as Node)) return;
      const otherDrawing = (event.target as Element | null)?.closest?.('[data-chart-drawing-id]');
      if (!live.current.findAt || findAt(event) || !otherDrawing && hasClipboard()) activeLayers.set(doc, id);
      rightPress = event.button === 2 ? { x: event.clientX, y: event.clientY, moved: false } : null;
    };
    const move = (event: PointerEvent) => {
      if (rightPress && Math.hypot(event.clientX - rightPress.x, event.clientY - rightPress.y) > 4) rightPress.moved = true;
    };
    const context = (event: MouseEvent) => {
      if (isDrawingClipboardTextTarget(event.target)) return;
      if ((event.target as Element | null)?.closest?.('button,a,[data-chart-drawing-ui]')) return;
      if (rightPress?.moved) { rightPress = null; return; }
      const drawingId = findAt(event);
      // A transparent older layer may own the actual object under this click.
      // Prefer that hit to a different layer's blank-space Paste menu.
      if (!drawingId && [...hits].some(([key, hit]) => key !== id && hit(event))) return;
      if (!drawingId && !hasClipboard()) return;
      activeLayers.set(doc, id);
      if (drawingId) live.current.onSelect(drawingId);
      // The normal chart owns its complete menu. Contribute drawing actions
      // during capture, then let its existing bubble listener open that menu.
      if (container.getAttribute?.('data-chart-context-menu') === 'full') {
        chartContextActions.set(event, {
          copy: drawingId ? () => actions.current.copy(drawingId) : null,
          paste: hasClipboard() ? () => actions.current.paste() : null,
        });
        setMenu(null);
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      setMenu({ x: Math.max(8, Math.min(event.clientX, (doc.defaultView?.innerWidth ?? 1000) - 230)),
        y: Math.max(8, Math.min(event.clientY, (doc.defaultView?.innerHeight ?? 800) - 110)), drawingId });
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || activeLayers.get(doc) !== id || isDrawingClipboardTextTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const command = event.key.toLowerCase();
      if (command !== 'c' && command !== 'v') return;
      if (event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const handled = command === 'c' ? actions.current.copy(live.current.selectedId) : actions.current.paste();
      if (handled) { event.preventDefault(); event.stopImmediatePropagation(); setMenu(null); }
    };
    const dismiss = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    doc.addEventListener('pointerdown', focus, true);
    container.addEventListener('contextmenu', context, true);
    doc.addEventListener('keydown', key, true);
    doc.addEventListener('pointermove', move, true);
    doc.addEventListener('keydown', escape);
    doc.addEventListener('pointerdown', dismiss, true);
    doc.defaultView?.addEventListener('blur', dismiss);
    return () => {
      doc.removeEventListener('pointerdown', focus, true);
      container.removeEventListener('contextmenu', context, true);
      doc.removeEventListener('keydown', key, true);
      doc.removeEventListener('pointermove', move, true);
      doc.removeEventListener('keydown', escape);
      doc.removeEventListener('pointerdown', dismiss, true);
      doc.defaultView?.removeEventListener('blur', dismiss);
      if (activeLayers.get(doc) === id) activeLayers.delete(doc);
      hits.delete(id);
      if (!hits.size) layerHits.delete(container);
    };
  }, [id]);

  const doc = args.svgRef.current?.ownerDocument;
  return menu && doc ? createPortal(
    <div ref={menuRef} role="menu" aria-label="Drawing actions" data-chart-drawing-ui
      className="fixed z-[10000] w-[220px] rounded-xl border border-border bg-panel p-1.5 text-xs text-foreground shadow-xl"
      style={{ left: menu.x, top: menu.y }} onContextMenu={event => event.preventDefault()}>
      <button role="menuitem" disabled={!menu.drawingId} className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-surface disabled:opacity-40"
        onClick={() => { actions.current.copy(menu.drawingId); setMenu(null); }}>Copy drawing <span className="text-muted">Ctrl/⌘ C</span></button>
      <button role="menuitem" disabled={!(args.clipboard?.has() ?? hasChartDrawingClipboard())} className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-surface disabled:opacity-40"
        onClick={() => { actions.current.paste(); setMenu(null); }}>Paste drawing <span className="text-muted">Ctrl/⌘ V</span></button>
    </div>, doc.body) : null;
}
