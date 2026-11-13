import { workspaceScopeStorageKey } from "./chartWorkspaceScope.ts";

export const CHART_INDICATORS_STORAGE_KEY = "kwantdesk-chart-indicators";
export const WORKSPACE_INDICATOR_KEYS = (["charts", "gamma", "algo"] as const)
  .map(scope => workspaceScopeStorageKey(scope, CHART_INDICATORS_STORAGE_KEY));

type Indicator = { instanceId: string; enabled?: boolean; [key: string]: unknown };
type IndicatorState = Record<string, Indicator[]>;

function parseState(raw: string | undefined): IndicatorState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return Object.values(value).every(list => Array.isArray(list)
      && list.every(item => item && typeof item.instanceId === "string")) ? value as IndicatorState : null;
  } catch {
    return null;
  }
}

/** A removed instance stays removed even if a peer edited its settings. */
export function mergeWorkspaceIndicatorState(baseRaw?: string, localRaw?: string, remoteRaw?: string): string | undefined {
  // Older accounts may have no indicator key until their first edit.
  // An absent baseline has no instances that either device could delete.
  const base = baseRaw === undefined ? {} : parseState(baseRaw);
  const local = parseState(localRaw);
  const remote = parseState(remoteRaw);
  if (!base || !local || !remote) return undefined;
  if (localRaw === baseRaw) return remoteRaw;
  if (remoteRaw === baseRaw || remoteRaw === localRaw) return localRaw;

  const index = (items: Indicator[]) => new Map(items.map(item => [item.instanceId, item]));
  const merged = Object.fromEntries(
    [...new Set([...Object.keys(remote), ...Object.keys(local)])].map(paneId => {
      const before = index(base[paneId] ?? []);
      const edits = index(local[paneId] ?? []);
      const received = index(remote[paneId] ?? []);
      const localOrderChanged = JSON.stringify([...before.keys()]) !== JSON.stringify([...edits.keys()]);
      const primary = localOrderChanged ? edits : received;
      const secondary = localOrderChanged ? received : edits;
      const indicators: Indicator[] = [];
      for (const id of new Set([...primary.keys(), ...secondary.keys()])) {
        const original = before.get(id);
        const edited = edits.get(id);
        const incoming = received.get(id);
        if (original && (!edited || !incoming)) continue;
        if (!edited || !incoming || !original) {
          const added = edited ?? incoming;
          if (added) indicators.push(added);
          continue;
        }
        // Merge visibility independently so a peer settings edit cannot
        // re-enable a hidden indicator or erase its updated settings.
        const { enabled: beforeEnabled, ...beforeFields } = original;
        const { enabled: localEnabled, ...localFields } = edited;
        const fields = JSON.stringify(localFields) !== JSON.stringify(beforeFields) ? localFields : incoming;
        const enabled = localEnabled !== beforeEnabled ? localEnabled : incoming.enabled;
        indicators.push({ ...fields, enabled });
      }
      return [paneId, indicators];
    }),
  );
  return JSON.stringify(merged);
}

export function retainInitialIndicatorEdits<T extends { values: Record<string, string> }>(
  base: T, sent: T, received: T,
): T {
  const values = { ...received.values };
  for (const key of WORKSPACE_INDICATOR_KEYS) {
    const edited = sent.values[key];
    if (edited === undefined || edited === base.values[key]) continue;
    values[key] = mergeWorkspaceIndicatorState(base.values[key], edited, values[key]) ?? edited;
  }
  return { ...received, values };
}
