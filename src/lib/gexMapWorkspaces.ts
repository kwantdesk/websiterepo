import type { GexMapEmbedState } from "@/components/gex-map/GexMapWorkspace";
import { writeProtectedItem } from "@/lib/browserStorageQuota";
import { normalizeLinkedGexMapSettings } from "@/lib/gexMapLinkedSettings";
import { normalizeGexMapPalette, type GexMapPalette } from "@/lib/gexMapPalette";
import { GEX_MAP_REPLAY_WINDOWS, type GexMapReplayWindowId } from "@/lib/gexMapReplayWindow";
import { OPTIONS_FLOW_INSTRUMENTS } from "@/lib/optionsFlow";
import { WORKSPACE_PRESET_DELETIONS_KEY, isWorkspacePresetDeleted, markWorkspacePresetDeleted } from "@/lib/workspacePresetPreferences";

export const GEX_MAP_ZOOM_MIN = 0.5;
export const GEX_MAP_ZOOM_MAX = 2;
/** The Future matrix retains its existing zoom calibration. */
export const GEX_MAP_FUTURE_ZOOM_BASE_SCALE = 1.3;

export const GEX_MAP_WORKSPACES_KEY = "kwantdesk:gex-map-workspaces:v1";
const ACTIVE_KEY = "kwantdesk:gex-map-active-workspace:v1";
const FILE_KIND = "kwantdesk.gex-map-workspaces";
const LIMIT = 60;
const symbols = new Set<string>(OPTIONS_FLOW_INSTRUMENTS.map(({ symbol }) => symbol));
export const GEX_MAP_FUTURE_SETTINGS_KEY = "kwantdesk:gex-map-future:v1";
export const GEX_MAP_FUTURE_LOOKAHEADS = [7, 14, 21, 30, 60];

export type GexMapFutureSettings = {
  symbol: string;
  greek: "GAMMA" | "VANNA";
  lookaheadDays: number;
  valueMode: "star-percent" | "signed";
  highlightPercent: number;
};

export function normalizeGexMapFutureSettings(value: unknown): GexMapFutureSettings {
  const settings = record(value);
  const number = (value: unknown) => typeof value === "number" || typeof value === "string" ? Number(value) : 0;
  const lookaheadDays = number(settings.lookaheadDays);
  return {
    symbol: typeof settings.symbol === "string" && symbols.has(settings.symbol) ? settings.symbol : "SPX",
    greek: settings.greek === "VANNA" ? "VANNA" : "GAMMA",
    lookaheadDays: GEX_MAP_FUTURE_LOOKAHEADS.includes(lookaheadDays) ? lookaheadDays : 14,
    valueMode: settings.valueMode === "signed" ? "signed" : "star-percent",
    highlightPercent: Math.min(90, Math.max(0, number(settings.highlightPercent) || 0)),
  };
}

export function loadFutureSettings(): GexMapFutureSettings {
  try {
    return normalizeGexMapFutureSettings(JSON.parse(window.localStorage.getItem(GEX_MAP_FUTURE_SETTINGS_KEY) ?? "null"));
  } catch {
    return normalizeGexMapFutureSettings(null);
  }
}

export function saveFutureSettings(settings: GexMapFutureSettings) {
  try {
    writeProtectedItem(GEX_MAP_FUTURE_SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* Preferences can still be edited for this session. */ }
}

export type GexMapWorkspaceSnapshot = {
  view: GexMapEmbedState;
  starSettings: ReturnType<typeof normalizeLinkedGexMapSettings>["starSettings"];
  palette: GexMapPalette;
  ladderZoom: number;
  futureZoom: number;
  priceLocked: boolean;
  replayWindow: GexMapReplayWindowId;
  futureSettings: GexMapFutureSettings;
};

export type GexMapWorkspacePreset = {
  id: string;
  name: string;
  updatedAt: string;
  snapshot: GexMapWorkspaceSnapshot;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function zoom(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(GEX_MAP_ZOOM_MAX, Math.max(GEX_MAP_ZOOM_MIN, value)) : 1;
}

function normalizeSnapshot(value: unknown): GexMapWorkspaceSnapshot | null {
  const snapshot = record(value);
  const view = record(snapshot.view);
  if (view.surfaceVersion !== 2 || !Array.isArray(view.panels) || view.panels.length < 1 || view.panels.length > 4) return null;
  const settings = normalizeLinkedGexMapSettings({ ...view, starSettings: snapshot.starSettings });
  const ids = new Set<string>();
  for (const panel of view.panels) {
    const { id, symbol, greekMode } = record(panel);
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || ids.has(id)
      || typeof symbol !== "string" || !symbols.has(symbol) || !["GAMMA", "DELTA", "VANNA", "CHARM"].includes(String(greekMode))) return null;
    ids.add(id);
  }
  const { panels, viewMode, stepMinutes, expiryScope, representation, exposureModel, starSettings } = settings;
  return {
    view: { surfaceVersion: 2, panels, viewMode, stepMinutes, expiryScope, representation, exposureModel,
      timeHorizon: view.timeHorizon === "future" ? "future" : "present" },
    starSettings,
    palette: normalizeGexMapPalette(snapshot.palette),
    ladderZoom: zoom(snapshot.ladderZoom),
    futureZoom: zoom(snapshot.futureZoom),
    priceLocked: snapshot.priceLocked === true,
    replayWindow: GEX_MAP_REPLAY_WINDOWS.find(({ id }) => id === snapshot.replayWindow)?.id ?? "rth",
    futureSettings: normalizeGexMapFutureSettings(snapshot.futureSettings),
  };
}

function normalizePreset(value: unknown): GexMapWorkspacePreset | null {
  const { id, name, updatedAt, snapshot } = record(value);
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized || typeof id !== "string" || !/^[\w-]{1,80}$/.test(id)
    || typeof name !== "string" || !name.trim() || name.length > 80) return null;
  return { id, name: name.trim(), updatedAt: typeof updatedAt === "string" ? updatedAt : "", snapshot: normalized };
}

export function readGexMapWorkspaces(): GexMapWorkspacePreset[] {
  try {
    const presets: unknown = JSON.parse(window.localStorage.getItem(GEX_MAP_WORKSPACES_KEY) ?? "[]");
    const deletions = window.localStorage.getItem(WORKSPACE_PRESET_DELETIONS_KEY) ?? undefined;
    return Array.isArray(presets) ? presets.map(normalizePreset)
      .filter((preset): preset is GexMapWorkspacePreset => preset !== null
        && !isWorkspacePresetDeleted(deletions, GEX_MAP_WORKSPACES_KEY, preset.id))
      .sort((a, b) => a.name.localeCompare(b.name)) : [];
  } catch { return []; }
}

export function readActiveGexMapWorkspace() {
  try {
    const id = window.localStorage.getItem(ACTIVE_KEY);
    return id ? readGexMapWorkspaces().find((preset) => preset.id === id) ?? null : null;
  } catch { return null; }
}

export function rememberActiveGexMapWorkspace(id: string | null) {
  try { writeProtectedItem(ACTIVE_KEY, id ?? ""); } catch { /* Selection is still active in memory. */ }
}

function persist(presets: GexMapWorkspacePreset[]) {
  if (!writeProtectedItem(GEX_MAP_WORKSPACES_KEY, JSON.stringify(presets)).ok) {
    throw new Error("Browser storage is full or unavailable.");
  }
}

export function saveGexMapWorkspace(name: string, snapshot: GexMapWorkspaceSnapshot, activeId?: string) {
  const presets = readGexMapWorkspaces();
  const active = presets.find(({ id }) => id === activeId);
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error("Enter a workspace name of up to 80 characters.");
  if (presets.some((preset) => preset.id !== active?.id && preset.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("A GEX Map workspace already uses that name.");
  }
  if (!active && presets.length >= LIMIT) throw new Error("GEX Map can keep up to 60 saved workspaces.");
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) throw new Error("This map configuration could not be saved.");
  const next = { id: active?.id ?? crypto.randomUUID(), name: trimmed, updatedAt: new Date().toISOString(), snapshot: normalized };
  persist([...presets.filter(({ id }) => id !== next.id), next]);
  return next;
}

export function deleteGexMapWorkspace(id: string) {
  const key = WORKSPACE_PRESET_DELETIONS_KEY;
  const current = window.localStorage.getItem(key) ?? undefined;
  if (!writeProtectedItem(key, markWorkspacePresetDeleted(current, GEX_MAP_WORKSPACES_KEY, id)).ok) {
    throw new Error("Could not record the workspace deletion.");
  }
  // The tombstone owns the deletion even if compacting the library fails.
  writeProtectedItem(GEX_MAP_WORKSPACES_KEY, JSON.stringify(readGexMapWorkspaces()));
}

export function exportGexMapWorkspaces(presets: readonly GexMapWorkspacePreset[]) {
  return JSON.stringify({ kind: FILE_KIND, version: 1, presets }, null, 2);
}

export function importGexMapWorkspaces(raw: string): GexMapWorkspacePreset[] {
  let file: Record<string, unknown>;
  try { file = record(JSON.parse(raw)); } catch { throw new Error("This file is not valid JSON."); }
  if (file.kind !== FILE_KIND || file.version !== 1 || !Array.isArray(file.presets) || !file.presets.length) {
    throw new Error("Choose a GEX Map workspace export.");
  }
  const existing = readGexMapWorkspaces();
  if (existing.length + file.presets.length > LIMIT) throw new Error("This import would exceed 60 GEX Map workspaces.");
  const names = new Set(existing.map(({ name }) => name.toLowerCase()));
  const imported = file.presets.map((value) => {
    const preset = normalizePreset(value);
    if (!preset) throw new Error("The file contains an invalid GEX Map workspace.");
    const base = preset.name;
    let suffix = 2;
    while (names.has(preset.name.toLowerCase())) {
      const ending = " (" + suffix++ + ")";
      preset.name = base.slice(0, 80 - ending.length) + ending;
    }
    names.add(preset.name.toLowerCase());
    return { ...preset, id: crypto.randomUUID(), updatedAt: new Date().toISOString() };
  });
  persist([...existing, ...imported]);
  return imported;
}
