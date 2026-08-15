"use client";

import { defaultPrecisionLabels, defaultPrecisionStyle, defaultPrecisionToolbarState, defaultToolOptions } from "./defaults";
import { getPrecisionTool } from "./registry";
import { loadPrecisionDocument, savePrecisionDocument } from "./persistence";
import type { PrecisionAnchor, PrecisionDocument, PrecisionObject, PrecisionStoreSnapshot, PrecisionStyle, PrecisionToolConfig, PrecisionToolId, PrecisionToolbarState } from "./types";

type Listener = () => void;

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneObjects(objects: PrecisionObject[]): PrecisionObject[] {
  return typeof structuredClone === "function" ? structuredClone(objects) : JSON.parse(JSON.stringify(objects)) as PrecisionObject[];
}

export class PrecisionToolsStore {
  private workspaceId: string;
  private chartId: string;
  private listeners = new Set<Listener>();
  private objects: PrecisionObject[] = [];
  private selectedIds: string[] = [];
  private draft: PrecisionObject | null = null;
  private toolbar: PrecisionToolbarState = defaultPrecisionToolbarState();
  private undoStack: PrecisionObject[][] = [];
  private redoStack: PrecisionObject[][] = [];
  private revision = 0;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(workspaceId: string, chartId: string, toolbar?: PrecisionToolbarState) {
    this.workspaceId = workspaceId;
    this.chartId = chartId;
    this.toolbar = toolbar ?? defaultPrecisionToolbarState();
    this.objects = loadPrecisionDocument(workspaceId, chartId).objects;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PrecisionStoreSnapshot => ({
    objects: this.objects,
    selectedIds: this.selectedIds,
    draft: this.draft,
    toolbar: this.toolbar,
    revision: this.revision,
  });

  private emit(persist = true): void {
    this.revision += 1;
    this.listeners.forEach((listener) => listener());
    if (!persist) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      savePrecisionDocument({ schemaVersion: 1, workspaceId: this.workspaceId, chartId: this.chartId, objects: this.objects, savedAt: Date.now() });
    }, 140);
  }

  private checkpoint(): void {
    this.undoStack.push(cloneObjects(this.objects));
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  createDraft(toolId: PrecisionToolId, config: PrecisionToolConfig, anchor?: PrecisionAnchor): PrecisionObject {
    const now = Date.now();
    const draft: PrecisionObject = {
      schemaVersion: 1,
      id: id("precision"),
      toolId,
      name: getPrecisionTool(toolId).label,
      anchors: anchor ? [anchor] : [],
      path: toolId === "precision-pencil" ? [] : undefined,
      text: toolId === "precision-text" ? "Text" : undefined,
      style: { ...defaultPrecisionStyle(), ...config.style },
      labels: { ...defaultPrecisionLabels(), ...config.labels },
      visibility: { visible: true, locked: false, timeframes: [], minZoom: null, maxZoom: null },
      alert: null,
      configSlot: config.slot,
      options: { ...defaultToolOptions(toolId), ...config.options },
      createdAt: now,
      updatedAt: now,
      zIndex: this.objects.length,
    };
    this.draft = draft;
    this.emit(false);
    return draft;
  }

  updateDraft(updater: (draft: PrecisionObject) => PrecisionObject): void {
    if (!this.draft) return;
    this.draft = updater(this.draft);
  }

  commitDraft(): PrecisionObject | null {
    if (!this.draft) return null;
    this.checkpoint();
    const object = { ...this.draft, updatedAt: Date.now() };
    this.objects = [...this.objects, object];
    this.selectedIds = [object.id];
    this.draft = null;
    this.emit();
    return object;
  }

  cancelDraft(): void {
    if (!this.draft) return;
    this.draft = null;
    this.emit(false);
  }

  select(ids: string[]): void {
    this.selectedIds = ids.filter((objectId) => this.objects.some((object) => object.id === objectId));
    this.emit(false);
  }

  updateObject(objectId: string, updater: (object: PrecisionObject) => PrecisionObject, checkpoint = true): void {
    const target = this.objects.find((object) => object.id === objectId);
    if (!target || target.visibility.locked) return;
    if (checkpoint) this.checkpoint();
    this.objects = this.objects.map((object) => object.id === objectId ? { ...updater(object), updatedAt: Date.now() } : object);
    this.emit();
  }

  updateObjectLive(objectId: string, updater: (object: PrecisionObject) => PrecisionObject): void {
    this.objects = this.objects.map((object) => object.id === objectId ? { ...updater(object), updatedAt: Date.now() } : object);
  }

  beginObjectEdit(): void { this.checkpoint(); }
  finishObjectEdit(): void { this.emit(); }

  updateAlertRuntime(objectId: string, triggeredAt: number, disable: boolean): void {
    this.objects = this.objects.map((object) => object.id === objectId && object.alert
      ? { ...object, alert: { ...object.alert, lastTriggeredAt: triggeredAt, enabled: disable ? false : object.alert.enabled }, updatedAt: Date.now() }
      : object);
    this.emit();
  }

  remove(ids = this.selectedIds): void {
    if (!ids.length) return;
    this.checkpoint();
    const selected = new Set(ids);
    this.objects = this.objects.filter((object) => !selected.has(object.id));
    this.selectedIds = this.selectedIds.filter((objectId) => !selected.has(objectId));
    this.emit();
  }

  duplicate(ids = this.selectedIds): void {
    const selected = this.objects.filter((object) => ids.includes(object.id));
    if (!selected.length) return;
    this.checkpoint();
    const copies = selected.map((object, index) => ({ ...cloneObjects([object])[0], id: id("precision-copy"), name: `${object.name} copy`, anchors: object.anchors.map((anchor) => ({ ...anchor, logicalIndex: anchor.logicalIndex + 2, time: anchor.time + 1, price: anchor.price })), createdAt: Date.now(), updatedAt: Date.now(), zIndex: this.objects.length + index }));
    this.objects = [...this.objects, ...copies];
    this.selectedIds = copies.map((copy) => copy.id);
    this.emit();
  }

  toggleObjectVisibility(objectId: string): void {
    const target = this.objects.find((object) => object.id === objectId);
    if (!target) return;
    this.checkpoint();
    this.objects = this.objects.map((object) => object.id === objectId ? { ...object, visibility: { ...object.visibility, visible: !object.visibility.visible } } : object);
    this.emit();
  }

  toggleObjectLock(objectId: string): void {
    const target = this.objects.find((object) => object.id === objectId);
    if (!target) return;
    this.checkpoint();
    this.objects = this.objects.map((object) => object.id === objectId ? { ...object, visibility: { ...object.visibility, locked: !object.visibility.locked } } : object);
    this.emit();
  }

  moveObjectLayer(objectId: string, direction: "forward" | "backward"): void {
    const ordered = [...this.objects].sort((a, b) => a.zIndex - b.zIndex);
    const currentIndex = ordered.findIndex((object) => object.id === objectId);
    if (currentIndex < 0) return;
    const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) return;
    this.checkpoint();
    [ordered[currentIndex], ordered[nextIndex]] = [ordered[nextIndex], ordered[currentIndex]];
    const zById = new Map(ordered.map((object, index) => [object.id, index]));
    this.objects = this.objects.map((object) => ({ ...object, zIndex: zById.get(object.id) ?? object.zIndex, updatedAt: Date.now() }));
    this.emit();
  }

  setAllVisible(visible: boolean): void {
    this.checkpoint();
    this.objects = this.objects.map((object) => ({ ...object, visibility: { ...object.visibility, visible } }));
    this.emit();
  }

  setAllLocked(locked: boolean): void {
    this.checkpoint();
    this.objects = this.objects.map((object) => ({ ...object, visibility: { ...object.visibility, locked } }));
    this.emit();
  }

  clear(): void {
    if (!this.objects.length) return;
    this.checkpoint();
    this.objects = [];
    this.selectedIds = [];
    this.emit();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneObjects(this.objects));
    this.objects = previous;
    this.selectedIds = [];
    this.draft = null;
    this.emit();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneObjects(this.objects));
    this.objects = next;
    this.selectedIds = [];
    this.draft = null;
    this.emit();
  }

  replaceDocument(document: PrecisionDocument): void {
    this.checkpoint();
    this.objects = cloneObjects(document.objects);
    this.selectedIds = [];
    this.draft = null;
    this.emit();
  }

  setToolbar(updater: PrecisionToolbarState | ((toolbar: PrecisionToolbarState) => PrecisionToolbarState)): void {
    this.toolbar = typeof updater === "function" ? updater(this.toolbar) : updater;
    this.emit(false);
  }

  updateSelectedStyle(style: Partial<PrecisionStyle>): void {
    if (!this.selectedIds.length) return;
    this.checkpoint();
    const selected = new Set(this.selectedIds);
    this.objects = this.objects.map((object) => selected.has(object.id) && !object.visibility.locked ? { ...object, style: { ...object.style, ...style }, updatedAt: Date.now() } : object);
    this.emit();
  }
}
