export type DatabentoExecutionTuple = [
  timestamp: number,
  price: number,
  size: number,
  delta: number,
  askVolume?: number,
  bidVolume?: number,
  trades?: number,
  kind?: "flow",
];

export function normalizeDatabentoExecutionTuple(row: unknown): DatabentoExecutionTuple | null {
  if (!Array.isArray(row) || row.length < 4) return null;
  const exact = [
    Number(row[0]), Number(row[1]), Number(row[2]), Number(row[3]),
  ] as DatabentoExecutionTuple;
  const normalized = row[7] === "flow"
    ? [
        exact[0], exact[1], exact[2], exact[3],
        Number(row[4]), Number(row[5]), Number(row[6]), "flow" as const,
      ] as DatabentoExecutionTuple
    : exact;
  if (!(normalized[0] > 0) || !(normalized[1] > 0) || !(normalized[2] > 0)) return null;
  if (normalized[7] === "flow" && (
    !Number.isFinite(normalized[4])
    || !Number.isFinite(normalized[5])
    || !Number.isFinite(normalized[6])
    || Number(normalized[4]) + Number(normalized[5]) <= 0
  )) return null;
  return normalized;
}
