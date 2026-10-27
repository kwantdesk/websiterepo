import { normalizeDrawings } from "./chartDrawTools";
import type { Drawing } from "./chartDrawTools";

export const CHART_DRAWING_PREFERENCE_KEY = "kwantdesk:chart-drawtools:v1";

function readStore(value?: string): Record<string, Drawing[]> | null {
  if (value === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed);
    if (entries.some(([, drawings]) => !Array.isArray(drawings))) return null;
    return Object.fromEntries(entries.map(([id, drawings]) => [id, normalizeDrawings(drawings)]));
  } catch { return null; }
}

/** Three-way merge by pane AND drawing identity. A peer's unrelated drawing
 * edit must not replace a whole workspace document. Baseline removals are
 * intentional deletes; objects absent from that baseline are new drawings. */
export function mergeChartDrawingPreferences(base?: string, local?: string, remote?: string) {
  const b = readStore(base), l = readStore(local), r = readStore(remote);
  if (!l) return remote;
  if (!b || !r) return local;
  const merged: Record<string, Drawing[]> = { ...r };
  for (const pane of new Set([...Object.keys(b), ...Object.keys(l)])) {
    const before = new Map((b[pane] ?? []).map(drawing => [drawing.id, drawing]));
    const localDrawings = l[pane] ?? [];
    const result = new Map((r[pane] ?? []).map(drawing => [drawing.id, drawing]));
    for (const drawing of localDrawings) {
      const old = before.get(drawing.id);
      if (old && !result.has(drawing.id)) continue;
      if (JSON.stringify(drawing) !== JSON.stringify(old)) result.set(drawing.id, drawing);
    }
    const localIds = new Set(localDrawings.map(drawing => drawing.id));
    for (const id of before.keys()) if (!localIds.has(id)) result.delete(id);
    merged[pane] = [...result.values()];
  }
  return JSON.stringify(merged);
}
