export type ZeroGammaLineRoot = "NQ" | "ES";

export type ZeroGammaLinePoint = {
  timestampMs: number;
  sessionDate: string;
  value: number;
  status: "HISTORICAL" | "LIVE" | "EOD";
};

export type ZeroGammaLinePayload = {
  root: ZeroGammaLineRoot;
  displayInstrument: string;
  asOf: string;
  status: "LIVE" | "EOD";
  positiveAbove: boolean | null;
  points: ZeroGammaLinePoint[];
  method: "TRUE_OI_SCENARIO";
  disclosure: string;
};

export function zeroGammaRootForInstrument(instrument: string): ZeroGammaLineRoot | null {
  const normalized = instrument.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (normalized === "NQ" || normalized.startsWith("MNQ") || normalized.startsWith("NQ")) return "NQ";
  if (normalized === "ES" || normalized.startsWith("MES") || normalized.startsWith("ES")) return "ES";
  return null;
}

export function isZeroGammaLinePayload(value: unknown): value is ZeroGammaLinePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ZeroGammaLinePayload>;
  return (payload.root === "NQ" || payload.root === "ES")
    && Array.isArray(payload.points)
    && payload.points.every((point) => Boolean(point)
      && typeof point.timestampMs === "number"
      && Number.isFinite(point.timestampMs)
      && typeof point.value === "number"
      && Number.isFinite(point.value));
}
