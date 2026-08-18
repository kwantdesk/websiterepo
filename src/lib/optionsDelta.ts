import type { GexMapPanelPayload } from "./gexMap.ts";

export type OptionsDeltaSource = "NDX" | "QQQ" | "SPX" | "SPXW" | "SPY";

export type OptionsDeltaPoint = {
  timestampMs: number;
  net: number;
};

/**
 * The Options Delta pane always reflects the chart's own options family:
 * an options underlying uses its exact chain, a futures chart uses its
 * canonical cash source.
 */
export function optionsDeltaSourceForInstrument(instrument: string): OptionsDeltaSource | null {
  const normalized = instrument
    .trim()
    .toUpperCase()
    .split(":")
    .at(-1)
    ?.replace(/\.V\.0$/, "")
    .replace(/[^A-Z]/g, "") ?? "";
  if (["NDX", "QQQ", "SPX", "SPXW", "SPY"].includes(normalized)) return normalized as OptionsDeltaSource;
  if (normalized.startsWith("MNQ") || normalized.startsWith("NQ")) return "NDX";
  if (normalized.startsWith("MES") || normalized.startsWith("ES")) return "SPX";
  return null;
}

/**
 * Reduces the recorded strike frames to one signed net-Delta value per frame.
 * Frames carry per-strike surface updates, so the walk maintains the full
 * cumulative surface exactly like the GEX Map ladder does and sums it after
 * each frame — no interpolation and no lookahead.
 */
export function buildOptionsDeltaSeries(payload: Pick<GexMapPanelPayload, "frames">): OptionsDeltaPoint[] {
  const surface = new Map<number, number>();
  const points: OptionsDeltaPoint[] = [];
  const frames = [...payload.frames].sort((left, right) => left.timestamp - right.timestamp);
  for (const frame of frames) {
    if (!Number.isFinite(frame.timestamp)) continue;
    for (const update of frame.updates) {
      if (Number.isFinite(update.strike) && Number.isFinite(update.net)) {
        surface.set(update.strike, update.net);
      }
    }
    if (!surface.size) continue;
    let net = 0;
    for (const value of surface.values()) net += value;
    const previous = points.at(-1);
    if (previous && previous.timestampMs === frame.timestamp) {
      previous.net = net;
    } else {
      points.push({ timestampMs: frame.timestamp, net });
    }
  }
  return points;
}
