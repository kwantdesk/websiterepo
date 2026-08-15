"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Eye, Lock, Settings2, Trash2, Unlock } from "lucide-react";
import { claimChartInteraction, releaseChartInteraction, subscribeChartInteractionOwner } from "@/lib/chartInteractionArbiter";
import { createDefaultConfigs } from "./defaults";
import { hitTestObjects, objectScreenAnchors } from "./hitTesting";
import { simplifyRdp, snapPrice, translateAnchors } from "./math";
import { exportPrecisionDocument, importPrecisionDocument, loadPrecisionConfigs, loadPrecisionToolbar, savePrecisionConfigs, savePrecisionToolbar } from "./persistence";
import PrecisionObjectList from "./PrecisionObjectList";
import PrecisionRail from "./PrecisionRail";
import PrecisionSettingsDrawer from "./PrecisionSettingsDrawer";
import { requiredPrecisionAnchors } from "./registry";
import { renderPrecisionCanvas, renderPrecisionInteractionCanvas } from "./renderer";
import { PrecisionToolsStore } from "./store";
import type { PrecisionAnchor, PrecisionChartAdapter, PrecisionObject, PrecisionScreenPoint, PrecisionTheme, PrecisionToolConfig, PrecisionToolId, PrecisionToolbarState } from "./types";

interface Props {
  workspaceId: string;
  chartId: string;
  adapter: PrecisionChartAdapter;
  theme: PrecisionTheme;
  enabled?: boolean;
}

type DragState = {
  objectId: string;
  kind: "body" | "anchor" | "resize";
  handleIndex?: number;
  start: PrecisionAnchor;
  original: PrecisionObject;
};

type SelectionBox = { start: PrecisionScreenPoint; end: PrecisionScreenPoint };

function activeConfig(configs: PrecisionToolConfig[], toolId: PrecisionToolId, slot: number): PrecisionToolConfig {
  return configs.find((config) => config.toolId === toolId && config.slot === slot) ?? createDefaultConfigs().find((config) => config.toolId === toolId && config.slot === slot)!;
}

function copyObject<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function normalizeAnchor(anchor: PrecisionAnchor, adapter: PrecisionChartAdapter, mode: "off" | "weak" | "strong"): PrecisionAnchor {
  if (mode === "off") return anchor;
  const nearest = adapter.candles.reduce<typeof adapter.candles[number] | null>((best, candle) => !best || Math.abs(candle.timestamp - anchor.time) < Math.abs(best.timestamp - anchor.time) ? candle : best, null);
  if (!nearest) return { ...anchor, price: snapPrice(anchor.price, adapter.minMove, adapter.precision) };
  const prices = [nearest.open, nearest.high, nearest.low, nearest.close];
  const closest = prices.reduce((best, price) => Math.abs(price - anchor.price) < Math.abs(best - anchor.price) ? price : best);
  const threshold = adapter.minMove * (mode === "strong" ? 8 : 3);
  return {
    ...anchor,
    time: mode === "strong" || Math.abs(nearest.timestamp - anchor.time) < 60_000 ? nearest.timestamp : anchor.time,
    price: Math.abs(closest - anchor.price) <= threshold ? closest : snapPrice(anchor.price, adapter.minMove, adapter.precision),
  };
}

export default function PrecisionToolsLayer({ workspaceId, chartId, adapter, theme, enabled = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storeRef = useRef<PrecisionToolsStore | null>(null);
  const storeIdentityRef = useRef("");
  const [revision, setRevision] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const pointerRef = useRef<PrecisionScreenPoint | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const snapDisabledRef = useRef(false);
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [configs, setConfigs] = useState<PrecisionToolConfig[]>(() => createDefaultConfigs(theme.primary, theme.bullish, theme.bearish));
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placedCountRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const pencilScreenPathRef = useRef<PrecisionScreenPoint[]>([]);
  const clipboardRef = useRef<PrecisionObject[]>([]);
  const previousPriceRef = useRef<number | null>(null);
  const zoomStartRef = useRef<PrecisionAnchor | null>(null);
  const lassoRef = useRef<SelectionBox | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const identity = `${workspaceId}:${chartId}`;
  if (!storeRef.current || storeIdentityRef.current !== identity) {
    storeIdentityRef.current = identity;
    storeRef.current = new PrecisionToolsStore(workspaceId, chartId, loadPrecisionToolbar(workspaceId));
  }
  const store = storeRef.current;
  const snapshot = store.getSnapshot();
  const selectedObject = snapshot.objects.find((object) => snapshot.selectedIds.includes(object.id)) ?? null;

  useEffect(() => store.subscribe(() => setRevision((value) => value + 1)), [store]);
  useEffect(() => () => { if (interactionFrameRef.current != null) cancelAnimationFrame(interactionFrameRef.current); }, []);
  useEffect(() => {
    const host = canvasRef.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { adapter.requestChartRender(); setRevision((value) => value + 1); });
    observer.observe(host);
    return () => observer.disconnect();
  }, [adapter]);
  useEffect(() => { setConfigs(loadPrecisionConfigs(workspaceId, { primary: theme.primary, bullish: theme.bullish, bearish: theme.bearish })); }, [theme.bearish, theme.bullish, theme.primary, workspaceId]);
  useEffect(() => { savePrecisionToolbar(workspaceId, snapshot.toolbar); }, [revision, snapshot.toolbar, workspaceId]);
  useEffect(() => {
    const controller = new AbortController();
    setCloudHydrated(false);
    void fetch(`/api/precision-tools?workspaceId=${encodeURIComponent(workspaceId)}&chartId=${encodeURIComponent(chartId)}`, { cache: "no-store", credentials: "include", signal: controller.signal })
      .then(async (response) => response.ok ? await response.json() as { configured?: boolean; objects?: PrecisionObject[]; configs?: PrecisionToolConfig[]; toolbar?: PrecisionToolbarState } : null)
      .then((payload) => {
        if (!payload?.configured) return;
        if (Array.isArray(payload.objects) && payload.objects.length) store.replaceDocument({ schemaVersion: 1, workspaceId, chartId, objects: payload.objects, savedAt: Date.now() });
        if (Array.isArray(payload.configs) && payload.configs.length) { setConfigs(payload.configs); savePrecisionConfigs(workspaceId, payload.configs); }
        if (payload.toolbar) store.setToolbar((toolbar) => ({ ...toolbar, ...payload.toolbar, activeTool: null, mode: "select" }));
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setCloudHydrated(true); });
    return () => controller.abort();
  }, [chartId, store, workspaceId]);
  useEffect(() => {
    if (!cloudHydrated) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/precision-tools", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, chartId, objects: snapshot.objects, configs, toolbar: snapshot.toolbar }) }).catch(() => undefined);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [chartId, cloudHydrated, configs, snapshot.objects, snapshot.toolbar, workspaceId]);
  useEffect(() => subscribeChartInteractionOwner((owner) => {
    if (owner !== "precision-tools") {
      setEngaged(false);
      placedCountRef.current = 0;
      store.cancelDraft();
    }
  }), [store]);
  const resizeCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return null;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(adapter.width * dpr));
    const pixelHeight = Math.max(1, Math.round(adapter.height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; canvas.style.width = `${adapter.width}px`; canvas.style.height = `${adapter.height}px`; }
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
  }, [adapter.height, adapter.width]);

  useEffect(() => {
    const handleGlobalCrosshair = (event: Event) => {
      const detail = (event as CustomEvent<{ chartId: string; time: number; price: number }>).detail;
      if (!detail || detail.chartId === chartId || snapshot.toolbar.mode !== "global-crosshair") return;
      const x = adapter.timeToX(detail.time);
      const y = adapter.priceToY(detail.price);
      if (x != null && y != null) {
        pointerRef.current = { x, y };
        const interaction = resizeCanvas(interactionCanvasRef.current);
        if (interaction) renderPrecisionInteractionCanvas(interaction, adapter, pointerRef.current, engaged, theme);
      }
    };
    window.addEventListener("kwantdesk:precision-global-crosshair", handleGlobalCrosshair);
    return () => window.removeEventListener("kwantdesk:precision-global-crosshair", handleGlobalCrosshair);
  }, [adapter, chartId, engaged, resizeCanvas, snapshot.toolbar.mode, theme]);

  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      const context = resizeCanvas(canvasRef.current);
      if (context) renderPrecisionCanvas(context, snapshot.toolbar.hidden ? [] : snapshot.objects, snapshot.toolbar.hidden ? null : snapshot.draft, snapshot.selectedIds, adapter, theme);
      const interaction = resizeCanvas(interactionCanvasRef.current);
      if (interaction) renderPrecisionInteractionCanvas(interaction, adapter, pointerRef.current, engaged && (snapshot.toolbar.mode === "crosshair" || snapshot.toolbar.mode === "global-crosshair" || snapshot.toolbar.mode === "place"), theme);
    });
    return () => cancelAnimationFrame(frame);
  }, [adapter, engaged, resizeCanvas, revision, snapshot.draft, snapshot.objects, snapshot.selectedIds, snapshot.toolbar.hidden, snapshot.toolbar.mode, theme]);

  useEffect(() => {
    const latest = adapter.candles.at(-1)?.close ?? null;
    const previous = previousPriceRef.current;
    previousPriceRef.current = latest;
    if (latest == null || previous == null || latest === previous) return;
    snapshot.objects.forEach((object) => {
      const alert = object.alert;
      const target = object.anchors[0]?.price;
      if (!alert?.enabled || target == null) return;
      const crossedUp = previous < target && latest >= target;
      const crossedDown = previous > target && latest <= target;
      const range = object.anchors.length >= 2
        ? { low: Math.min(object.anchors[0].price, object.anchors[1].price), high: Math.max(object.anchors[0].price, object.anchors[1].price) }
        : null;
      const wasInside = range ? previous >= range.low && previous <= range.high : false;
      const isInside = range ? latest >= range.low && latest <= range.high : false;
      const matches = alert.condition === "cross"
        ? crossedUp || crossedDown
        : alert.condition === "cross-up"
          ? crossedUp
          : alert.condition === "cross-down"
            ? crossedDown
            : alert.condition === "enter"
              ? !wasInside && isInside
              : wasInside && !isInside;
      if (!matches) return;
      window.dispatchEvent(new CustomEvent("kwantdesk:precision-alert", { detail: { objectId: object.id, message: alert.message, price: latest, target, condition: alert.condition } }));
      store.updateAlertRuntime(object.id, Date.now(), alert.once);
    });
  }, [adapter.candles, snapshot.objects, store]);

  const claim = useCallback(() => { claimChartInteraction("precision-tools"); setEngaged(true); }, []);
  const release = useCallback(() => { releaseChartInteraction("precision-tools"); setEngaged(false); store.cancelDraft(); store.select([]); placedCountRef.current = 0; }, [store]);

  const setMode = (mode: typeof snapshot.toolbar.mode) => {
    if (mode === "hand") {
      store.cancelDraft(); placedCountRef.current = 0;
      store.setToolbar((toolbar) => ({ ...toolbar, mode, activeTool: null, activeGroup: null }));
      releaseChartInteraction("precision-tools"); setEngaged(false);
      return;
    }
    claim();
    if (mode === "place") {
      store.setToolbar((toolbar) => ({ ...toolbar, snapMode: toolbar.snapMode === "off" ? "weak" : toolbar.snapMode === "weak" ? "strong" : "off" }));
      return;
    }
    store.cancelDraft(); placedCountRef.current = 0;
    store.setToolbar((toolbar) => ({ ...toolbar, mode, activeTool: null, activeGroup: null }));
  };

  const selectTool = (toolId: PrecisionToolId) => {
    claim(); store.cancelDraft(); placedCountRef.current = 0;
    store.setToolbar((toolbar) => ({ ...toolbar, mode: "place", activeTool: toolId, activeGroup: null, activeConfigSlot: toolbar.activeConfigSlots[toolId] ?? toolbar.activeConfigSlot }));
  };

  const setActiveConfigSlot = useCallback((slot: number) => {
    const toolId = store.getSnapshot().toolbar.activeTool ?? selectedObject?.toolId ?? null;
    store.setToolbar((toolbar) => ({ ...toolbar, activeConfigSlot: slot, activeConfigSlots: toolId ? { ...toolbar.activeConfigSlots, [toolId]: slot } : toolbar.activeConfigSlots }));
  }, [selectedObject?.toolId, store]);

  const pointerAnchor = (event: React.PointerEvent<HTMLCanvasElement>): PrecisionAnchor | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    if (event.shiftKey && snapshot.draft?.anchors[0] && placedCountRef.current > 0) {
      const startX = adapter.timeToX(snapshot.draft.anchors[0].time, snapshot.draft.anchors[0].logicalIndex);
      const startY = adapter.priceToY(snapshot.draft.anchors[0].price);
      if (startX != null && startY != null) {
        const dx = x - startX, dy = y - startY, length = Math.hypot(dx, dy);
        const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        x = startX + Math.cos(angle) * length; y = startY + Math.sin(angle) * length;
      }
    }
    const raw = adapter.xToAnchor(x, y);
    return raw ? normalizeAnchor(raw, adapter, snapDisabledRef.current ? "off" : snapshot.toolbar.snapMode) : null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!engaged || event.button !== 0) return;
    const anchor = pointerAnchor(event); if (!anchor) return;
    const point = { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY };
    if (snapshot.toolbar.mode === "zoom-range") {
      zoomStartRef.current = anchor;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (snapshot.toolbar.mode === "select") {
      const hit = hitTestObjects(snapshot.objects, point, adapter);
      if (!hit) {
        store.select([]);
        lassoRef.current = { start: point, end: point };
        setSelectionBox(lassoRef.current);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      let target = snapshot.objects.find((object) => object.id === hit.objectId); if (!target) return;
      if (event.altKey && !target.visibility.locked) {
        store.duplicate([target.id]);
        const copiedId = store.getSnapshot().selectedIds[0];
        target = store.getSnapshot().objects.find((object) => object.id === copiedId) ?? target;
      }
      store.select(event.shiftKey ? [...new Set([...snapshot.selectedIds, target.id])] : [target.id]);
      if (!target.visibility.locked) { store.beginObjectEdit(); dragRef.current = { objectId: hit.objectId, kind: hit.kind, handleIndex: hit.handleIndex, start: anchor, original: copyObject(target) }; event.currentTarget.setPointerCapture(event.pointerId); }
      return;
    }
    const toolId = snapshot.toolbar.activeTool;
    if (snapshot.toolbar.mode !== "place" || !toolId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (toolId === "precision-pencil") {
      const config = activeConfig(configs, toolId, snapshot.toolbar.activeConfigSlot);
      store.createDraft(toolId, config, anchor);
      pencilScreenPathRef.current = [point];
      store.updateDraft((draft) => ({ ...draft, path: [anchor] }));
      return;
    }
    if (!snapshot.draft) {
      const config = activeConfig(configs, toolId, snapshot.toolbar.activeConfigSlot);
      store.createDraft(toolId, config, anchor);
      placedCountRef.current = 1;
      if (requiredPrecisionAnchors(toolId) === 1) {
        if (toolId === "precision-text") {
          const text = window.prompt("Text", "Text")?.trim();
          if (text) store.updateDraft((draft) => ({ ...draft, text }));
        }
        store.commitDraft(); placedCountRef.current = 0;
      }
      return;
    }
    const count = placedCountRef.current + 1;
    store.updateDraft((draft) => ({ ...draft, anchors: [...draft.anchors.slice(0, placedCountRef.current), anchor] }));
    placedCountRef.current = count;
    if (count >= requiredPrecisionAnchors(toolId)) { store.commitDraft(); placedCountRef.current = 0; }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointerRef.current = point;
    if (interactionFrameRef.current == null) interactionFrameRef.current = requestAnimationFrame(() => {
      interactionFrameRef.current = null;
      const live = store.getSnapshot();
      const staticContext = resizeCanvas(canvasRef.current);
      if (staticContext) renderPrecisionCanvas(staticContext, live.toolbar.hidden ? [] : live.objects, live.toolbar.hidden ? null : live.draft, live.selectedIds, adapter, theme);
      const interaction = resizeCanvas(interactionCanvasRef.current);
      if (interaction) renderPrecisionInteractionCanvas(interaction, adapter, pointerRef.current, engaged && (live.toolbar.mode === "crosshair" || live.toolbar.mode === "global-crosshair" || live.toolbar.mode === "place"), theme);
    });
    const anchor = pointerAnchor(event); if (!anchor) return;
    if (snapshot.toolbar.mode === "global-crosshair") window.dispatchEvent(new CustomEvent("kwantdesk:precision-global-crosshair", { detail: { chartId, time: anchor.time, price: anchor.price } }));
    if (lassoRef.current) {
      lassoRef.current = { ...lassoRef.current, end: point };
      setSelectionBox(lassoRef.current);
      return;
    }
    if (dragRef.current) {
      const drag = dragRef.current;
      if (drag.kind === "anchor") {
        store.updateObjectLive(drag.objectId, (object) => ({ ...object, anchors: object.anchors.map((candidate, index) => index === drag.handleIndex ? anchor : candidate) }));
      } else if (drag.kind === "resize" && drag.original.anchors.length >= 2) {
        const [a, b] = drag.original.anchors; let left = a.time < b.time ? a : b; let right = a.time < b.time ? b : a;
        let minTime = left.time, maxTime = right.time, maxPrice = Math.max(a.price, b.price), minPrice = Math.min(a.price, b.price);
        const index = drag.handleIndex ?? 0;
        if ([0, 6, 7].includes(index)) minTime = anchor.time;
        if ([2, 3, 4].includes(index)) maxTime = anchor.time;
        if ([0, 1, 2].includes(index)) maxPrice = anchor.price;
        if ([4, 5, 6].includes(index)) minPrice = anchor.price;
        const leftLogical = index === 0 || index === 6 || index === 7 ? anchor.logicalIndex : left.logicalIndex;
        const rightLogical = index === 2 || index === 3 || index === 4 ? anchor.logicalIndex : right.logicalIndex;
        store.updateObjectLive(drag.objectId, (object) => ({ ...object, anchors: [{ time: minTime, logicalIndex: leftLogical, price: maxPrice }, { time: maxTime, logicalIndex: rightLogical, price: minPrice }] }));
      } else {
        store.updateObjectLive(drag.objectId, (object) => ({ ...object, anchors: translateAnchors(drag.original.anchors, anchor.time - drag.start.time, anchor.logicalIndex - drag.start.logicalIndex, anchor.price - drag.start.price), path: drag.original.path ? translateAnchors(drag.original.path, anchor.time - drag.start.time, anchor.logicalIndex - drag.start.logicalIndex, anchor.price - drag.start.price) : undefined }));
      }
      return;
    }
    if (snapshot.draft?.toolId === "precision-pencil" && event.buttons === 1) {
      const previous = pencilScreenPathRef.current.at(-1); if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) { pencilScreenPathRef.current.push(point); store.updateDraft((draft) => ({ ...draft, path: [...(draft.path ?? []), anchor] })); }
      return;
    }
    if (snapshot.draft && placedCountRef.current > 0) store.updateDraft((draft) => ({ ...draft, anchors: [...draft.anchors.slice(0, placedCountRef.current), anchor] }));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (lassoRef.current) {
      const box = lassoRef.current;
      const left = Math.min(box.start.x, box.end.x), right = Math.max(box.start.x, box.end.x);
      const top = Math.min(box.start.y, box.end.y), bottom = Math.max(box.start.y, box.end.y);
      const dragged = right - left >= 4 || bottom - top >= 4;
      if (dragged) {
        const selected = snapshot.objects.filter((object) => {
          if (!object.visibility.visible) return false;
          const points = [
            ...objectScreenAnchors(object, adapter),
            ...(object.path ?? []).map((candidate) => ({ x: adapter.timeToX(candidate.time, candidate.logicalIndex) ?? NaN, y: adapter.priceToY(candidate.price) ?? NaN })).filter((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y)),
          ];
          return points.some((candidate) => candidate.x >= left && candidate.x <= right && candidate.y >= top && candidate.y <= bottom);
        }).map((object) => object.id);
        store.select(selected);
      }
      lassoRef.current = null;
      setSelectionBox(null);
    }
    if (zoomStartRef.current) {
      const end = pointerAnchor(event);
      if (end && Math.abs(end.time - zoomStartRef.current.time) > 1_000) adapter.setVisibleTimeRange(zoomStartRef.current.time, end.time);
      zoomStartRef.current = null;
    }
    if (dragRef.current) { dragRef.current = null; store.finishObjectEdit(); }
    if (snapshot.draft?.toolId === "precision-pencil") {
      const path = snapshot.draft.path ?? [];
      const screen = pencilScreenPathRef.current;
      const simplifiedScreen = simplifyRdp(screen, Number(snapshot.draft.options.simplifyTolerance ?? 1.5));
      const retained = new Set(simplifiedScreen.map((item) => `${Math.round(item.x)}:${Math.round(item.y)}`));
      store.updateDraft((draft) => ({ ...draft, path: path.filter((_, index) => retained.has(`${Math.round(screen[index]?.x ?? 0)}:${Math.round(screen[index]?.y ?? 0)}`)) }));
      store.commitDraft(); pencilScreenPathRef.current = []; placedCountRef.current = 0;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (!engaged || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const meta = event.ctrlKey || event.metaKey;
      if (event.key === "Escape") { release(); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && snapshot.selectedIds.length) { event.preventDefault(); store.remove(); }
      if (meta && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? store.redo() : store.undo(); }
      if (meta && event.key.toLowerCase() === "d") { event.preventDefault(); store.duplicate(); }
      if (meta && event.key.toLowerCase() === "l" && snapshot.selectedIds.length) { event.preventDefault(); snapshot.selectedIds.forEach((id) => store.toggleObjectLock(id)); }
      if (meta && event.key.toLowerCase() === "c") { clipboardRef.current = snapshot.objects.filter((object) => snapshot.selectedIds.includes(object.id)).map(copyObject); }
      if (meta && event.key.toLowerCase() === "v" && clipboardRef.current.length) {
        event.preventDefault();
        const document = { schemaVersion: 1 as const, workspaceId, chartId, savedAt: Date.now(), objects: [...snapshot.objects, ...clipboardRef.current.map((object, index) => ({ ...copyObject(object), id: `precision-paste-${Date.now()}-${index}`, anchors: object.anchors.map((anchor) => ({ ...anchor, logicalIndex: anchor.logicalIndex + 2 })) }))] };
        store.replaceDocument(document);
      }
      if (event.altKey && /^[1-9]$/.test(event.key)) { event.preventDefault(); setActiveConfigSlot(Number(event.key)); }
      if (event.key === "Alt") snapDisabledRef.current = true;
      if (event.code === "Space" && interactionCanvasRef.current) interactionCanvasRef.current.style.pointerEvents = "none";
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "Alt") snapDisabledRef.current = false;
      if (event.code === "Space" && interactionCanvasRef.current) interactionCanvasRef.current.style.pointerEvents = engaged ? "auto" : "none";
    };
    window.addEventListener("keydown", handle); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", handle); window.removeEventListener("keyup", up); };
  }, [chartId, engaged, release, setActiveConfigSlot, snapshot.objects, snapshot.selectedIds, store, workspaceId]);

  const exportObjects = () => {
    const serialized = exportPrecisionDocument({ schemaVersion: 1, workspaceId, chartId, objects: snapshot.objects, savedAt: Date.now() }, adapter.instrument);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([serialized], { type: "application/json" })); link.download = `kwantdesk-precision-${chartId}.json`; link.click(); URL.revokeObjectURL(link.href);
  };
  const importObjects = async (file: File | undefined) => { if (!file) return; try { store.replaceDocument(importPrecisionDocument(await file.text(), workspaceId, chartId, "merge", snapshot.objects)); setError(null); } catch (value) { setError(value instanceof Error ? value.message : "Precision import failed."); } };
  const updateSelected = (updater: (object: PrecisionObject) => PrecisionObject) => { if (selectedObject) store.updateObject(selectedObject.id, updater); };
  const saveConfig = () => { if (!selectedObject) return; const next = configs.map((config) => config.toolId === selectedObject.toolId && config.slot === snapshot.toolbar.activeConfigSlot ? { ...config, style: copyObject(selectedObject.style), labels: copyObject(selectedObject.labels), options: copyObject(selectedObject.options), updatedAt: Date.now() } : config); setConfigs(next); savePrecisionConfigs(workspaceId, next); };
  const resetConfig = () => { const defaults = createDefaultConfigs(theme.primary, theme.bullish, theme.bearish); const next = configs.map((config) => config.slot === snapshot.toolbar.activeConfigSlot ? defaults.find((candidate) => candidate.toolId === config.toolId && candidate.slot === config.slot) ?? config : config); setConfigs(next); savePrecisionConfigs(workspaceId, next); };

  if (!enabled) return null;
  return <div className="pointer-events-none absolute inset-0 z-[66] overflow-hidden" data-precision-tools-root data-revision={revision}>
    <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-label="Precision Tools rendering layer" />
    <canvas ref={interactionCanvasRef} className="absolute inset-0 touch-none" style={{ pointerEvents: engaged ? "auto" : "none", cursor: snapshot.toolbar.mode === "select" ? "default" : snapshot.toolbar.mode === "hand" ? "grab" : "crosshair" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={() => { pointerRef.current = null; const interaction = resizeCanvas(interactionCanvasRef.current); if (interaction) renderPrecisionInteractionCanvas(interaction, adapter, null, false, theme); }} aria-label="Precision Tools interaction layer" />
    <PrecisionRail snapshot={snapshot} engaged={engaged} onMode={setMode} onTool={selectTool} onGroup={(activeGroup) => store.setToolbar((toolbar) => ({ ...toolbar, activeGroup }))} onCollapse={() => store.setToolbar((toolbar) => ({ ...toolbar, collapsed: !toolbar.collapsed }))} onToggleHidden={() => { const hidden = !snapshot.toolbar.hidden; store.setToolbar((toolbar) => ({ ...toolbar, hidden })); store.setAllVisible(!hidden); }} onToggleLocked={() => { const locked = !snapshot.toolbar.locked; store.setToolbar((toolbar) => ({ ...toolbar, locked })); store.setAllLocked(locked); }} onObjects={() => setObjectsOpen((value) => !value)} onSettings={() => setSettingsOpen(true)} onImport={() => fileInputRef.current?.click()} onExport={exportObjects} onClear={() => setClearOpen(true)} onDismiss={release} />
    <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importObjects(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    {selectionBox ? <div className="pointer-events-none absolute z-[72] border border-dashed border-[#78b1ff] bg-[#4f91e9]/10" style={{ left: Math.min(selectionBox.start.x, selectionBox.end.x), top: Math.min(selectionBox.start.y, selectionBox.end.y), width: Math.abs(selectionBox.end.x - selectionBox.start.x), height: Math.abs(selectionBox.end.y - selectionBox.start.y) }} /> : null}
    {objectsOpen ? <PrecisionObjectList snapshot={snapshot} onClose={() => setObjectsOpen(false)} onSelect={(id) => { claim(); store.select([id]); }} onVisibility={(id) => store.toggleObjectVisibility(id)} onLock={(id) => store.toggleObjectLock(id)} onDuplicate={(id) => store.duplicate([id])} onDelete={(id) => store.remove([id])} onLayer={(id, direction) => store.moveObjectLayer(id, direction)} onRename={(id, name) => store.updateObject(id, (object) => ({ ...object, name }))} onSettings={(id) => { store.select([id]); setSettingsOpen(true); }} onAllVisible={(visible) => store.setAllVisible(visible)} onAllLocked={(locked) => store.setAllLocked(locked)} onClear={() => setClearOpen(true)} /> : null}
    {settingsOpen ? <PrecisionSettingsDrawer object={selectedObject} configs={configs} activeSlot={snapshot.toolbar.activeConfigSlot} onSlot={setActiveConfigSlot} onClose={() => setSettingsOpen(false)} onUpdate={updateSelected} onSaveConfig={saveConfig} onResetConfig={resetConfig} /> : null}
    {engaged && selectedObject && !settingsOpen ? <div className="pointer-events-auto absolute left-1/2 top-[72px] z-[73] flex -translate-x-1/2 items-center border border-[#34475e] bg-[#09111b]/95 p-1 shadow-xl"><button type="button" onClick={() => store.toggleObjectLock(selectedObject.id)} className="grid h-7 w-7 place-items-center text-[#8192a8] hover:text-[#9ec9ff]">{selectedObject.visibility.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</button><button type="button" onClick={() => store.duplicate([selectedObject.id])} className="grid h-7 w-7 place-items-center text-[#8192a8] hover:text-[#9ec9ff]"><Copy className="h-3.5 w-3.5" /></button><button type="button" onClick={() => store.toggleObjectVisibility(selectedObject.id)} className="grid h-7 w-7 place-items-center text-[#8192a8] hover:text-[#9ec9ff]"><Eye className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setSettingsOpen(true)} className="grid h-7 w-7 place-items-center text-[#8192a8] hover:text-[#9ec9ff]"><Settings2 className="h-3.5 w-3.5" /></button><button type="button" onClick={() => store.remove([selectedObject.id])} className="grid h-7 w-7 place-items-center text-[#8192a8] hover:text-[#ff6a85]"><Trash2 className="h-3.5 w-3.5" /></button><div className="ml-1 flex border-l border-[#2d3d52] pl-1">{Array.from({ length: 9 }, (_, index) => index + 1).map((slot) => <button key={slot} type="button" onClick={() => setActiveConfigSlot(slot)} className={`h-7 w-7 font-mono text-[7px] font-bold ${snapshot.toolbar.activeConfigSlot === slot ? "bg-[#18283d] text-[#9dc9ff]" : "text-[#5f7188] hover:text-white"}`}>TC{slot}</button>)}</div></div> : null}
    {clearOpen ? <div className="pointer-events-auto absolute inset-0 z-[80] grid place-items-center bg-black/55"><div className="w-[340px] border border-[#4a3540] bg-[#0b111a] p-5 shadow-2xl"><div className="font-mono text-[11px] font-bold uppercase text-[#e7edf5]">Clear Precision objects?</div><p className="mt-2 font-mono text-[9px] leading-5 text-[#8796a9]">This affects only the independent Precision Tools document. Legacy drawings remain untouched. Undo remains available.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setClearOpen(false)} className="h-9 border border-[#36475c] font-mono text-[9px] text-[#9aa9ba]">Cancel</button><button type="button" onClick={() => { store.clear(); setClearOpen(false); }} className="h-9 border border-[#784052] bg-[#32141e] font-mono text-[9px] font-bold text-[#ff718b]">Clear all</button></div></div></div> : null}
    {error ? <button type="button" onClick={() => setError(null)} className="pointer-events-auto absolute bottom-8 left-1/2 z-[82] -translate-x-1/2 border border-[#7b3e50] bg-[#2d111a] px-3 py-2 font-mono text-[9px] text-[#ff859a]">{error}</button> : null}
  </div>;
}
