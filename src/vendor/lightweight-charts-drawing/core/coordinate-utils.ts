import type { Coordinate, Logical, Time } from 'lightweight-charts';

import type { Viewport } from './types';

type TimeLogicalReference = { time: number; logical: number };

function referencePair(viewport: Viewport, preferredLogical: number | null): [TimeLogicalReference, TimeLogicalReference] | null {
  const fallbackLogical = viewport.timeScale.coordinateToLogical(Math.max(0, viewport.width - 1));
  const origin = Number(preferredLogical ?? fallbackLogical ?? 0);
  const references: TimeLogicalReference[] = [];
  const visited = new Set<number>();

  // Empty live whitespace is usually only a handful of bars wide. Scan back
  // through logical space until two real bars establish the chart cadence.
  for (let offset = 0; offset <= 2048 && references.length < 2; offset += 1) {
    for (const logical of [Math.floor(origin) - offset, Math.ceil(origin) + offset]) {
      if (visited.has(logical)) continue;
      visited.add(logical);
      const coordinate = viewport.timeScale.logicalToCoordinate(logical as Logical);
      if (coordinate == null) continue;
      const time = viewport.timeScale.coordinateToTime(coordinate);
      if (typeof time !== 'number' || !Number.isFinite(time)) continue;
      references.push({ time, logical });
      if (references.length === 2) break;
    }
  }

  if (references.length < 2 || references[0].logical === references[1].logical) return null;
  return [references[0], references[1]];
}

function cadence(pair: [TimeLogicalReference, TimeLogicalReference]): number | null {
  const value = (pair[0].time - pair[1].time) / (pair[0].logical - pair[1].logical);
  return Number.isFinite(value) && value !== 0 ? value : null;
}

/** Resolves a numeric chart time even inside future live whitespace. */
export function coordinateToNumericTime(viewport: Viewport, x: number): number | null {
  const direct = viewport.timeScale.coordinateToTime(x);
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const logical = viewport.timeScale.coordinateToLogical(x);
  if (logical == null || !Number.isFinite(Number(logical))) return null;
  const pair = referencePair(viewport, Number(logical));
  if (!pair) return null;
  const secondsPerLogical = cadence(pair);
  if (secondsPerLogical == null) return null;
  return Math.round(pair[0].time + (Number(logical) - pair[0].logical) * secondsPerLogical);
}

/** Maps numeric future times back into the chart's empty logical space. */
export function numericTimeToCoordinate(viewport: Viewport, time: Time): Coordinate | null {
  const direct = viewport.timeScale.timeToCoordinate(time);
  if (direct != null || typeof time !== 'number' || !Number.isFinite(time)) return direct;
  const pair = referencePair(viewport, null);
  if (!pair) return null;
  const secondsPerLogical = cadence(pair);
  if (secondsPerLogical == null) return null;
  const logical = pair[0].logical + (time - pair[0].time) / secondsPerLogical;
  return viewport.timeScale.logicalToCoordinate(logical as Logical);
}
