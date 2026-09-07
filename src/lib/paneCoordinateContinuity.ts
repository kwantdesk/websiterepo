export type PaneCoordinateCache = {
  scope: string;
  values: Map<number, number>;
};

export function createPaneCoordinateCache(scope: string): PaneCoordinateCache {
  return { scope, values: new Map() };
}

/**
 * Lightweight Charts can return null coordinates for one React paint while a
 * corrected price series/time map is being installed. Retain the last proven
 * coordinate in the same instrument/timeframe scope so dependent panes do not
 * flash blank. A scope change clears the map synchronously, preventing bars
 * from a previous chart being reused.
 */
export function resolvePaneCoordinate(
  cache: PaneCoordinateCache,
  scope: string,
  time: number,
  readCoordinate: (time: number) => number | null,
) {
  if (cache.scope !== scope) {
    cache.scope = scope;
    cache.values.clear();
  }
  const coordinate = readCoordinate(time);
  if (coordinate !== null && Number.isFinite(coordinate)) {
    cache.values.set(time, coordinate);
    return coordinate;
  }
  return cache.values.get(time) ?? null;
}
