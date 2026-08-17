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
 * Expands sparse verified Gamma observations onto the chart's own timestamps.
 * Values are only carried forward, never backward, so the overlay behaves like
 * a running VWAP while preserving the no-lookahead boundary of each snapshot.
 */
export function paintZeroGammaLine(
  points: ZeroGammaLinePoint[],
  timestampsMs: number[],
): Array<{ time: number; value: number }> {
  const observations = [...points]
    .filter((point) => Number.isFinite(point.timestampMs) && Number.isFinite(point.value))
    .sort((left, right) => left.timestampMs - right.timestampMs);
  const timestamps = [...new Set(timestampsMs.filter(Number.isFinite))].sort((left, right) => left - right);
  if (!observations.length || !timestamps.length) return [];

  const result: Array<{ time: number; value: number }> = [];
  let observationIndex = 0;
  let active: ZeroGammaLinePoint | null = null;
  for (const timestamp of timestamps) {
    while (observationIndex < observations.length && observations[observationIndex].timestampMs <= timestamp) {
      active = observations[observationIndex];
      observationIndex += 1;
    }
    if (active) result.push({ time: Math.floor(timestamp / 1_000), value: active.value });
  }

  // A newly observed live value may be newer than the latest completed candle.
  // Append it explicitly so the line reaches the live edge immediately.
  const latest = observations.at(-1);
  if (latest && (!result.length || Math.floor(latest.timestampMs / 1_000) > (result.at(-1)?.time ?? 0))) {
    result.push({ time: Math.floor(latest.timestampMs / 1_000), value: latest.value });
  }
  return result;
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
