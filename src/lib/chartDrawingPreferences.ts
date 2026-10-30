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

export function readChartDrawingStore(value: string | null): Record<string, Drawing[]> | null {
  return readStore(value ?? undefined);
}

/** A chart's drawing document is shared by live and every replay date. Commit
 * the full pane, preserving other panes and independent peer additions. Empty
 * arrays are intentional clears, including drawings outside today's viewport. */
export function updateChartDrawingPane(current: Record<string, Drawing[]>, stored: string | null, pane: string, drawings: Drawing[], lastSaved?: string, renderedPane?: Drawing[]) {
  const normalized = normalizeDrawings(drawings);
  let committed = normalized;
  if (normalized.length && renderedPane && renderedPane !== current[pane]) {
    // A peer refresh can land before React updates the chart's props. Apply
    // the edit against what that callback actually saw, retaining newer tools
    // and respecting deletions instead of replacing the latest pane blindly.
    const merged = readStore(mergeChartDrawingPreferences(
      JSON.stringify({ [pane]: renderedPane }),
      JSON.stringify({ [pane]: normalized }),
      JSON.stringify({ [pane]: current[pane] ?? [] }),
    ));
    committed = merged?.[pane] ?? normalized;
  }
  const baseline = lastSaved ?? JSON.stringify(current);
  const next = { ...current, [pane]: committed };
  // The ordinary drag path does not parse/merge the whole document. Only an
  // actual external storage change needs the account-sync three-way merge.
  if (stored === null || stored === baseline) return next;
  const local = JSON.stringify(next);
  const result = readStore(mergeChartDrawingPreferences(baseline, local, stored)) ?? next;
  if (!normalized.length) result[pane] = [];
  return result;
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
