export const WORKSPACE_PRESET_DELETIONS_KEY = 'kwantdesk:workspace-preset-deletions:v1';
const PRESET_KEY = 'kwantdesk-chart-workspace-presets';
const libraryKeys = [PRESET_KEY, `kwantdesk:gamma-charting:${PRESET_KEY}`, `kwantdesk:algo-charting:${PRESET_KEY}`];
type Values = Record<string, string>;
type SavedPreset = { id: string; updatedAt?: string; [key: string]: unknown };
function records(raw?: string): SavedPreset[] {
  try {
    const value = JSON.parse(raw ?? 'null');
    return Array.isArray(value) ? value.filter((item): item is SavedPreset => Boolean(item && typeof item.id === 'string')) : [];
  } catch { return []; }
}
function deletions(raw?: string): Record<string, string[]> {
  try {
    const value = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(libraryKeys.filter(key => Array.isArray(value[key]))
      .map(key => [key, value[key].filter((id: unknown): id is string => typeof id === 'string')]));
  } catch { return {}; }
}
export function markWorkspacePresetDeleted(raw: string | undefined, libraryKey: string, id: string) {
  const removed = deletions(raw);
  removed[libraryKey] = [...new Set([...(removed[libraryKey] ?? []), id])].sort();
  return JSON.stringify(removed);
}
export function isWorkspacePresetDeleted(raw: string | undefined, libraryKey: string, id: string) {
  return deletions(raw)[libraryKey]?.includes(id) ?? false;
}

/** Absence in an old/default list is not a user deletion. Only Delete records one. */
export function mergeWorkspacePresetPreferences(base: Values, local: Values, remote: Values, output: Values): Values {
  const values = { ...output };
  const removed: Record<string, string[]> = {};
  for (const source of [base, remote, local]) {
    for (const [key, ids] of Object.entries(deletions(source[WORKSPACE_PRESET_DELETIONS_KEY]))) {
      removed[key] = [...new Set([...(removed[key] ?? []), ...ids])].sort();
    }
  }
  if (Object.keys(removed).length) values[WORKSPACE_PRESET_DELETIONS_KEY] = JSON.stringify(
    Object.fromEntries(libraryKeys.filter(key => key in removed).map(key => [key, removed[key]])));
  for (const key of libraryKeys) {
    if (![base, local, remote].some(source => key in source)) continue;
    const original = new Map(records(base[key]).map(preset => [preset.id, preset]));
    const peers = new Map(records(remote[key]).map(preset => [preset.id, preset]));
    const result = new Map([...original, ...peers]);
    for (const preset of records(local[key])) {
      const old = original.get(preset.id), peer = peers.get(preset.id);
      if (!peer) { result.set(preset.id, preset); continue; }
      if (JSON.stringify(preset) === JSON.stringify(old)) continue;
      if (!old || JSON.stringify(peer) !== JSON.stringify(old)) {
        const localTime = Date.parse(preset.updatedAt ?? '') || 0;
        const peerTime = Date.parse(peer.updatedAt ?? '') || 0;
        if (peerTime > localTime || (peerTime === localTime && JSON.stringify(peer) > JSON.stringify(preset))) continue;
      }
      result.set(preset.id, preset);
    }
    const deleted = new Set(removed[key] ?? []);
    values[key] = JSON.stringify([...result.values()].filter(preset => !deleted.has(preset.id))
      .sort((a, b) => a.id.localeCompare(b.id)));
  }
  return values;
}
