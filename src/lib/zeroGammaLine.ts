export type ZeroGammaLineRoot = "NQ" | "ES";
export type ZeroGammaLineSource = "NQ" | "ES" | "NDX" | "QQQ" | "SPX" | "SPXW" | "SPY";

export type ZeroGammaLinePoint = {
  timestampMs: number;
  sessionDate: string;
  value: number;
  status: "HISTORICAL" | "LIVE" | "EOD";
};

export type ZeroGammaLinePayload = {
  root: ZeroGammaLineRoot;
  sourceSymbol: ZeroGammaLineSource;
  displayInstrument: string;
  asOf: string;
  status: "LIVE" | "EOD";
  positiveAbove: boolean | null;
  points: ZeroGammaLinePoint[];
  method: "TRUE_OI_SCENARIO" | "OPTIONS_GAMMA_CROSSING";
  disclosure: string;
};

function normalizedGammaInstrument(instrument: string) {
  return instrument
    .trim()
    .toUpperCase()
    .split(":")
    .at(-1)
    ?.replace(/\.V\.0$/, "")
    .replace(/[^A-Z]/g, "") ?? "";
}

export function zeroGammaRootForInstrument(instrument: string): ZeroGammaLineRoot | null {
  const normalized = normalizedGammaInstrument(instrument);
  if (normalized === "NQ" || normalized.startsWith("MNQ") || normalized.startsWith("NQ")) return "NQ";
  if (normalized === "ES" || normalized.startsWith("MES") || normalized.startsWith("ES")) return "ES";
  if (normalized === "NDX" || normalized === "QQQ") return "NQ";
  if (["SPX", "SPXW", "SPY"].includes(normalized)) return "ES";
  return null;
}

export function zeroGammaSourceForInstrument(instrument: string): ZeroGammaLineSource | null {
  const normalized = normalizedGammaInstrument(instrument);
  if (normalized === "NDX" || normalized === "QQQ") return normalized;
  if (normalized === "SPX" || normalized === "SPXW" || normalized === "SPY") return normalized;
  const root = zeroGammaRootForInstrument(instrument);
  return root;
}

/**
 * Draws the verified Gamma observations as one continuous running line, the
 * same way GEX BOX renders its zero-Gamma trail: each observation is a point
 * and the chart connects them directly. Carrying values forward per candle
 * produced a stepped, block-like line instead of a smooth path. Live
 * observations accumulate intraday, so during the session the line runs at
 * the refresh cadence.
 */
export function paintZeroGammaLine(
  points: ZeroGammaLinePoint[],
): Array<{ time: number; value: number }> {
  const bySecond = new Map<number, number>();
  for (const point of [...points]
    .filter((item) => Number.isFinite(item.timestampMs) && Number.isFinite(item.value))
    .sort((left, right) => left.timestampMs - right.timestampMs)) {
    bySecond.set(Math.floor(point.timestampMs / 1_000), point.value);
  }
  return [...bySecond.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([time, value]) => ({ time, value }));
}

/**
 * Resamples the observation trail onto the chart's own bar times. A series
 * whose times are not existing bar times makes Lightweight Charts insert a
 * whitespace slot for every such point — with a one-minute trail on a 5m
 * chart that pushed hundreds of empty slots between candles and visibly
 * spread them apart. Each bar takes the newest observation at or before its
 * close, so the line stays a per-bar trace with zero extra time slots on any
 * timeframe.
 */
export function paintZeroGammaLineOnBars(
  points: ZeroGammaLinePoint[],
  barTimesSeconds: number[],
  barIntervalSeconds: number | null,
): Array<{ time: number; value: number }> {
  if (!barTimesSeconds.length) return paintZeroGammaLine(points);
  const trail = paintZeroGammaLine(points);
  if (!trail.length) return [];
  const interval = barIntervalSeconds !== null && barIntervalSeconds > 0
    ? barIntervalSeconds
    : barTimesSeconds.length > 1
      ? Math.max(1, barTimesSeconds[1] - barTimesSeconds[0])
      : 60;
  const painted: Array<{ time: number; value: number }> = [];
  let cursor = 0;
  for (const barTime of barTimesSeconds) {
    const barClose = barTime + interval;
    while (cursor + 1 < trail.length && trail[cursor + 1].time < barClose) cursor += 1;
    const observation = trail[cursor];
    if (observation.time >= barClose) continue;
    painted.push({ time: barTime, value: observation.value });
  }
  return painted;
}

export function isZeroGammaLinePayload(value: unknown): value is ZeroGammaLinePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ZeroGammaLinePayload>;
  return (payload.root === "NQ" || payload.root === "ES")
    && typeof payload.sourceSymbol === "string"
    && Array.isArray(payload.points)
    && payload.points.every((point) => Boolean(point)
      && typeof point.timestampMs === "number"
      && Number.isFinite(point.timestampMs)
      && typeof point.value === "number"
      && Number.isFinite(point.value));
}

/**
 * How far one bucket may sit from its neighbours before it is treated as a
 * reconstruction artifact rather than a move. 0.5% is ~147 points on NQ —
 * comfortably above the ~19-point median bucket-to-bucket variation and below
 * the isolated excursions, which measured over 150.
 */
export const ZERO_GAMMA_ARTIFACT_DEVIATION = 0.005;

/**
 * Rejects single-bucket artifacts from a reconstructed trail.
 *
 * Each minute rebuilds the whole surface, so one strike crossing a threshold
 * can throw that bucket's crossing hundreds of points and the next bucket puts
 * it straight back. Measured on an NQ session: of 64 moves over 150 points,
 * 29 were isolated round trips like that and 35 were sustained migration.
 *
 * A point is dropped when it sits too far from the median of its own
 * neighbourhood — sustained steps move the median with them and survive, while
 * a lone excursion does not. Points are DROPPED rather than smoothed: this is
 * an observation series, and replacing a reading with an average would report
 * a crossing the surface never produced.
 */
export function rejectZeroGammaArtifacts(
  points: ZeroGammaLinePoint[],
  spot: number | null,
): ZeroGammaLinePoint[] {
  if (points.length < 5 || !Number.isFinite(spot) || !(spot as number > 0)) return points;
  const bound = (spot as number) * ZERO_GAMMA_ARTIFACT_DEVIATION;
  const ordered = [...points].sort((left, right) => left.timestampMs - right.timestampMs);
  const values = ordered.map((point) => point.value);
  return ordered.filter((point, index) => {
    const window = values
      .slice(Math.max(0, index - 2), Math.min(values.length, index + 3))
      .sort((left, right) => left - right);
    const median = window[Math.floor(window.length / 2)];
    return Math.abs(point.value - median) <= bound;
  });
}
