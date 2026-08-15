"use client";

import { PRECISION_TOOL_IDS, type PrecisionDocument, type PrecisionObject, type PrecisionToolConfig, type PrecisionToolbarState } from "./types";
import { createDefaultConfigs, defaultPrecisionToolbarState } from "./defaults";

const objectPrefix = "kwantdesk:precision-tools:v1";
const configPrefix = "kwantdesk:precision-tool-configs:v1";
const toolbarPrefix = "kwantdesk:precision-toolbar:v1";

export function precisionObjectStorageKey(workspaceId: string, chartId: string): string {
  return `${objectPrefix}:${workspaceId}:${chartId}`;
}

export function precisionConfigStorageKey(userOrWorkspaceId: string): string {
  return `${configPrefix}:${userOrWorkspaceId}`;
}

export function precisionToolbarStorageKey(workspaceId: string): string {
  return `${toolbarPrefix}:${workspaceId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePrecisionObject(value: unknown): value is PrecisionObject {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1 || typeof value.id !== "string" || !PRECISION_TOOL_IDS.includes(value.toolId as never)) return false;
  if (!Array.isArray(value.anchors) || !isRecord(value.style) || !isRecord(value.visibility) || !isRecord(value.options)) return false;
  return value.anchors.every((anchor) => isRecord(anchor) && Number.isFinite(anchor.time) && Number.isFinite(anchor.logicalIndex) && Number.isFinite(anchor.price));
}

export function migratePrecisionDocument(value: unknown, workspaceId: string, chartId: string): PrecisionDocument {
  if (!isRecord(value)) return { schemaVersion: 1, workspaceId, chartId, objects: [], savedAt: Date.now() };
  const objects = Array.isArray(value.objects) ? value.objects.filter(validatePrecisionObject) : [];
  return { schemaVersion: 1, workspaceId, chartId, objects, savedAt: Number(value.savedAt) || Date.now() };
}

export function loadPrecisionDocument(workspaceId: string, chartId: string): PrecisionDocument {
  if (typeof window === "undefined") return migratePrecisionDocument(null, workspaceId, chartId);
  try {
    const raw = window.localStorage.getItem(precisionObjectStorageKey(workspaceId, chartId));
    return migratePrecisionDocument(raw ? JSON.parse(raw) : null, workspaceId, chartId);
  } catch {
    return migratePrecisionDocument(null, workspaceId, chartId);
  }
}

export function savePrecisionDocument(document: PrecisionDocument): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(precisionObjectStorageKey(document.workspaceId, document.chartId), JSON.stringify({ ...document, savedAt: Date.now() }));
}

export function loadPrecisionConfigs(identity: string, colors?: { primary?: string; bullish?: string; bearish?: string }): PrecisionToolConfig[] {
  const defaults = createDefaultConfigs(colors?.primary, colors?.bullish, colors?.bearish);
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(precisionConfigStorageKey(identity));
    if (!raw) return defaults;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaults;
    const valid = parsed.filter((candidate): candidate is PrecisionToolConfig => isRecord(candidate) && candidate.schemaVersion === 1 && PRECISION_TOOL_IDS.includes(candidate.toolId as never) && Number(candidate.slot) >= 1 && Number(candidate.slot) <= 9);
    const keyed = new Map(valid.map((config) => [`${config.toolId}:${config.slot}`, config]));
    return defaults.map((config) => keyed.get(`${config.toolId}:${config.slot}`) ?? config);
  } catch {
    return defaults;
  }
}

export function savePrecisionConfigs(identity: string, configs: PrecisionToolConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(precisionConfigStorageKey(identity), JSON.stringify(configs));
}

export function loadPrecisionToolbar(workspaceId: string): PrecisionToolbarState {
  const fallback = defaultPrecisionToolbarState();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(precisionToolbarStorageKey(workspaceId));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    return { ...fallback, ...parsed, activeTool: null, mode: "select" } as PrecisionToolbarState;
  } catch {
    return fallback;
  }
}

export function savePrecisionToolbar(workspaceId: string, toolbar: PrecisionToolbarState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(precisionToolbarStorageKey(workspaceId), JSON.stringify({ ...toolbar, activeTool: null, mode: "select" }));
}

export function exportPrecisionDocument(document: PrecisionDocument, instrumentId = ""): string {
  return JSON.stringify({
    kind: "kwantdesk-precision-drawings",
    schemaVersion: 1,
    exportedAt: Date.now(),
    instrumentId,
    drawings: document.objects,
  }, null, 2);
}

export function importPrecisionDocument(serialized: string, workspaceId: string, chartId: string, mode: "merge" | "replace" = "merge", existing: PrecisionObject[] = []): PrecisionDocument {
  const parsed: unknown = JSON.parse(serialized);
  if (!isRecord(parsed)) throw new Error("The Precision drawing file is invalid.");
  if (parsed.schemaVersion !== 1) throw new Error("This Precision drawing schema version is not supported.");
  const source = parsed.kind === "kwantdesk-precision-drawings" ? parsed.drawings : parsed.objects;
  if (!Array.isArray(source)) throw new Error("The file is not a KwantDesk Precision drawing export.");
  const validated = source.filter(validatePrecisionObject);
  if (!validated.length && source.length) {
    throw new Error("The file contains no valid Precision Tool objects.");
  }
  const imported = mode === "replace" ? validated : validated.map((object, index) => ({ ...object, id: `precision-import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now(), updatedAt: Date.now(), zIndex: existing.length + index }));
  return { schemaVersion: 1, workspaceId, chartId, objects: mode === "replace" ? imported : [...existing, ...imported], savedAt: Date.now() };
}
