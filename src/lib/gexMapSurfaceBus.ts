import type { GexMapPanelPayload } from "@/lib/gexMap";
// Retain no additional history when its last mounted consumer leaves.
const listeners = new Map<string, Set<(payload: GexMapPanelPayload) => void>>();
export function subscribeGexMapSurface(key: string, callback: (payload: GexMapPanelPayload) => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(callback); listeners.set(key, set);
  return () => { set.delete(callback); if (!set.size) listeners.delete(key); };
}
export function publishGexMapSurface(key: string, payload: GexMapPanelPayload) {
  for (const callback of listeners.get(key) ?? []) callback(payload);
}
