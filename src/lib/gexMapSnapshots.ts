import type { ExposureStrike } from "./optionsFlow";
import { latestGexMapStrikesFromFrames, type GexMapPanelPayload } from "./gexMap";
/** Map row filtering/order also defines deterministic tied-node selection. */
export function gexMapSurfaceRows(current: ReadonlyMap<number, ExposureStrike>) {
  return [...current.values()].filter((row) => row.call !== 0 || row.put !== 0).sort((a, b) => b.strike - a.strike);
}

/** The first recorded surface is a baseline, never a future replay fallback. */
function openingSurface(payload: GexMapPanelPayload, upTo: number | null) {
  const first = payload.frames[0];
  return new Map<number, ExposureStrike>(first && (upTo === null || first.timestamp <= upTo)
    ? first.updates.map((row) => [row.strike, row]) : []);
}

export function buildGexMapSnapshots(payload: GexMapPanelPayload, timestamp: number | null, stepMinutes: number) {
  const current = new Map<number, ExposureStrike>();
  const previous = new Map<number, ExposureStrike>();
  const cutoff = timestamp ?? payload.frames.at(-1)?.timestamp ?? Date.parse(payload.asOf);
  const previousTarget = cutoff - stepMinutes * 60_000;
  for (const frame of payload.frames) {
    if (frame.timestamp > cutoff) break;
    for (const row of frame.updates) {
      current.set(row.strike, row);
      if (frame.timestamp <= previousTarget) previous.set(row.strike, row);
    }
  }
  if (timestamp === null) {
    // A live exposure-by-strike surface may be newer than interval history.
    const latest = payload.latestStrikes.length ? payload.latestStrikes : latestGexMapStrikesFromFrames(payload.frames);
    current.clear();
    for (const row of latest) current.set(row.strike, row);
  }
  return { current, previous, opening: openingSurface(payload, timestamp) };
}

export function gexMapPriceAt(payload: GexMapPanelPayload, timestamp: number | null) {
  if (timestamp === null) return payload.stockPrice;
  let value: number | null = null;
  for (const candle of payload.candles) {
    if (candle.timestamp > timestamp) break;
    value = candle.close;
  }
  // Latest spot is not evidence of a price before the first recorded candle.
  return value;
}
