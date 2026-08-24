/**
 * Saved GEX BOX workspaces.
 *
 * The same idea as the charts workspaces, and deliberately NOT the same store.
 * A charts workspace is panes, a layout tree, chart settings and indicators; a
 * GEX BOX workspace is pages of tool panels and a palette. They share no
 * fields, so one list holding both would mean every read guessing which kind
 * it had — and applying the wrong one would empty the screen.
 *
 * Everything here reads from browser storage, so every read is defensive: a
 * hand-edited or half-written entry is skipped rather than thrown, because a
 * corrupt saved workspace must never stop the ones beside it loading.
 */

export const GEX_BOX_WORKSPACES_STORAGE_KEY = "kwantdesk:gex-box:workspaces:v1";
export const GEX_BOX_WORKSPACES_EVENT = "kwantdesk:gex-box-workspaces-changed";

/** Bounded so a runaway save loop cannot fill the quota. */
export const MAX_GEX_BOX_WORKSPACES = 60;

export type GexBoxWorkspacePreset = {
  id: string;
  name: string;
  /** The pages and their panels, exactly as the dashboard holds them. */
  pages: unknown[];
  activePageId: string;
  paletteId?: string;
  updatedAt: string;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPreset(value: unknown): GexBoxWorkspacePreset | null {
  if (!isPlainRecord(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name) return null;
  if (!Array.isArray(value.pages) || !value.pages.length) return null;
  const id = typeof value.id === "string" && value.id ? value.id : `gexbox-${name.toLowerCase()}`;
  const activePageId = typeof value.activePageId === "string" ? value.activePageId : "";
  return {
    id,
    name,
    pages: value.pages,
    activePageId,
    paletteId: typeof value.paletteId === "string" ? value.paletteId : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadGexBoxWorkspaces(): GexBoxWorkspacePreset[] {
  const store = storage();
  if (!store) return [];
  let parsed: unknown;
  try {
    const raw = store.getItem(GEX_BOX_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(readPreset)
    .filter((entry): entry is GexBoxWorkspacePreset => entry !== null)
    .slice(0, MAX_GEX_BOX_WORKSPACES)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function persist(presets: GexBoxWorkspacePreset[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(GEX_BOX_WORKSPACES_STORAGE_KEY, JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent(GEX_BOX_WORKSPACES_EVENT));
    return true;
  } catch {
    return false;
  }
}

export type GexBoxWorkspaceWrite =
  | { ok: true; preset: GexBoxWorkspacePreset; presets: GexBoxWorkspacePreset[] }
  | { ok: false; error: string };

/**
 * Save under a name, replacing any workspace already using it.
 *
 * Overwriting by name is what "Quick Save" means: a trader refining a layout
 * and saving it again wants that layout updated, not a second entry with the
 * same label they can no longer tell apart.
 */
export function saveGexBoxWorkspace(
  name: string,
  snapshot: Omit<GexBoxWorkspacePreset, "id" | "name" | "updatedAt">,
  now = new Date().toISOString(),
): GexBoxWorkspaceWrite {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name the workspace before saving it." };
  if (!Array.isArray(snapshot.pages) || !snapshot.pages.length) {
    return { ok: false, error: "There is nothing on this workspace to save." };
  }
  const existing = loadGexBoxWorkspaces();
  const match = existing.find((entry) => entry.name.toLowerCase() === trimmed.toLowerCase());
  if (!match && existing.length >= MAX_GEX_BOX_WORKSPACES) {
    return { ok: false, error: `Only ${MAX_GEX_BOX_WORKSPACES} workspaces are kept.` };
  }
  let cloned: GexBoxWorkspacePreset;
  try {
    cloned = {
      id: match?.id ?? `gexbox-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${existing.length}`,
      name: trimmed,
      updatedAt: now,
      ...(JSON.parse(JSON.stringify(snapshot)) as Omit<GexBoxWorkspacePreset, "id" | "name" | "updatedAt">),
    };
  } catch {
    return { ok: false, error: "This workspace could not be saved." };
  }
  const presets = match
    ? existing.map((entry) => (entry.id === match.id ? cloned : entry))
    : [...existing, cloned];
  if (!persist(presets)) return { ok: false, error: "Browser storage is full or unavailable." };
  return { ok: true, preset: cloned, presets: presets.sort((a, b) => a.name.localeCompare(b.name)) };
}

export function deleteGexBoxWorkspace(presetId: string): GexBoxWorkspacePreset[] {
  const presets = loadGexBoxWorkspaces().filter((entry) => entry.id !== presetId);
  persist(presets);
  return presets;
}

export function exportGexBoxWorkspace(preset: GexBoxWorkspacePreset): string {
  return JSON.stringify(
    { kind: "kwantdesk.gex-box-workspace", version: 1, ...preset },
    null,
    2,
  );
}

export type GexBoxWorkspaceImport =
  | { ok: true; preset: GexBoxWorkspacePreset }
  | { ok: false; error: string };

/**
 * Read an exported GEX BOX workspace back.
 *
 * The kind is checked because a charts workspace file has none of these
 * fields: loading one would not error, it would simply produce a dashboard
 * with no pages, which reads as the tool being broken.
 */
export function importGexBoxWorkspace(raw: string): GexBoxWorkspaceImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That file is not a saved GEX BOX workspace." };
  }
  if (!isPlainRecord(parsed) || parsed.kind !== "kwantdesk.gex-box-workspace") {
    return { ok: false, error: "That file is not a saved GEX BOX workspace." };
  }
  const preset = readPreset(parsed);
  if (!preset) return { ok: false, error: "That workspace file has no pages in it." };
  return { ok: true, preset };
}
