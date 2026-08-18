import type { GexIntervalProviderBucket, GexIntervalProviderRow, GexIntervalProviderSurface } from "@/lib/gexIntervalMap";

export type GexCalGreek = "GAMMA" | "VANNA" | "DELTA" | "CHARM";
export type GexCalRepresentation = "RAW" | "PER_ONE_DOLLAR_MOVE" | "PER_ONE_PERCENT_MOVE";
export type GexCalOptionSide = "NET" | "CALL" | "PUT" | "GROSS";

export type GexCalCell = {
  expiration: string;
  strike: number;
  call: number;
  put: number;
  net: number;
  gross: number;
  value: number;
  previousValue: number | null;
  change: number | null;
};

export type GexCalStar = { expiration: string; strike: number; value: number; magnitude: number };

export type GexCalMatrix = {
  source: string;
  sessionDate: string;
  status: GexIntervalProviderSurface["status"];
  asOf: string;
  selectedTimestamp: number;
  baselineTimestamp: number | null;
  spot: number | null;
  expirations: string[];
  strikes: number[];
  cells: GexCalCell[];
  globalStar: GexCalStar | null;
  expirationStars: GexCalStar[];
  strikeStars: GexCalStar[];
  totalsByExpiration: Array<{ expiration: string; value: number; magnitude: number }>;
  availableTimestamps: number[];
  refreshAfterMs: number;
  limitations: string[];
};

const valueFor = (row: GexIntervalProviderRow | undefined, side: GexCalOptionSide) => {
  if (!row) return 0;
  if (side === "CALL") return row.callExposure;
  if (side === "PUT") return row.putExposure;
  if (side === "GROSS") return Math.abs(row.callExposure) + Math.abs(row.putExposure);
  return row.callExposure + row.putExposure;
};

function bucketAtOrBefore(buckets: GexIntervalProviderBucket[], timestamp?: number | null) {
  if (!buckets.length) return null;
  const sorted = [...buckets].sort((a, b) => a.timestamp - b.timestamp);
  if (!timestamp) return sorted.at(-1) ?? null;
  let selected: GexIntervalProviderBucket | null = null;
  for (const bucket of sorted) {
    if (bucket.timestamp > timestamp) break;
    selected = bucket;
  }
  return selected;
}

const rowKey = (row: Pick<GexIntervalProviderRow, "expirationDate" | "sourceStrike">) => `${row.expirationDate}:${row.sourceStrike}`;

export function buildGexCalMatrix(input: {
  surface: GexIntervalProviderSurface;
  asOfTimestamp?: number | null;
  baselineTimestamp?: number | null;
  baselineSurface?: GexIntervalProviderSurface | null;
  disableAutomaticBaseline?: boolean;
  side?: GexCalOptionSide;
}): GexCalMatrix {
  const side = input.side ?? "NET";
  const selected = bucketAtOrBefore(input.surface.buckets, input.asOfTimestamp);
  if (!selected) throw new Error("No exposure bucket exists at or before the selected time.");
  const baselineSource = input.baselineSurface ?? input.surface;
  let baseline = input.disableAutomaticBaseline
    ? null
    : bucketAtOrBefore(baselineSource.buckets, input.baselineTimestamp);
  if (!input.disableAutomaticBaseline && !input.baselineTimestamp && !input.baselineSurface) {
    const sorted = [...input.surface.buckets].sort((a, b) => a.timestamp - b.timestamp);
    const index = sorted.findIndex((bucket) => bucket.timestamp === selected.timestamp);
    baseline = index > 0 ? sorted[index - 1] : null;
  }
  const baselineRows = new Map((baseline?.rows ?? []).map((row) => [rowKey(row), row]));
  const cells = selected.rows.map((row): GexCalCell => {
    const current = valueFor(row, side);
    const previousRow = baselineRows.get(rowKey(row));
    const previous = previousRow ? valueFor(previousRow, side) : null;
    return {
      expiration: row.expirationDate,
      strike: row.sourceStrike,
      call: row.callExposure,
      put: row.putExposure,
      net: row.callExposure + row.putExposure,
      gross: Math.abs(row.callExposure) + Math.abs(row.putExposure),
      value: current,
      previousValue: previous,
      change: previous === null ? null : current - previous,
    };
  });
  const expirations = [...new Set(cells.map((cell) => cell.expiration))].sort();
  const strikes = [...new Set(cells.map((cell) => cell.strike))].sort((a, b) => b - a);
  const globalCell = cells.reduce<GexCalCell | null>((star, cell) => !star || Math.abs(cell.value) > Math.abs(star.value) ? cell : star, null);
  const starOf = (group: GexCalCell[]) => group.reduce<GexCalCell | null>((star, cell) => !star || Math.abs(cell.value) > Math.abs(star.value) ? cell : star, null);
  const toStar = (cell: GexCalCell): GexCalStar => ({ expiration: cell.expiration, strike: cell.strike, value: cell.value, magnitude: Math.abs(cell.value) });
  const expirationStars = expirations.flatMap((expiration) => {
    const star = starOf(cells.filter((cell) => cell.expiration === expiration));
    return star ? [toStar(star)] : [];
  });
  const strikeStars = strikes.flatMap((strike) => {
    const star = starOf(cells.filter((cell) => cell.strike === strike));
    return star ? [toStar(star)] : [];
  });
  const totalsByExpiration = expirations.map((expiration) => {
    const group = cells.filter((cell) => cell.expiration === expiration);
    return { expiration, value: group.reduce((sum, cell) => sum + cell.value, 0), magnitude: group.reduce((sum, cell) => sum + Math.abs(cell.value), 0) };
  });
  return {
    source: input.surface.sourceTicker,
    sessionDate: input.surface.sessionDate,
    status: input.surface.status,
    asOf: new Date(selected.timestamp).toISOString(),
    selectedTimestamp: selected.timestamp,
    baselineTimestamp: baseline?.timestamp ?? null,
    spot: selected.sourcePrice,
    expirations,
    strikes,
    cells,
    globalStar: globalCell ? toStar(globalCell) : null,
    expirationStars,
    strikeStars,
    totalsByExpiration,
    availableTimestamps: input.surface.buckets.map((bucket) => bucket.timestamp).sort((a, b) => a - b),
    refreshAfterMs: input.surface.refreshAfterMs,
    limitations: input.surface.limitations,
  };
}

export function scaleGexCalValue(value: number, mode: "GLOBAL" | "COLUMN" | "ROW" | "PERCENTILE", matrix: GexCalMatrix) {
  const absolute = Math.abs(value);
  if (!absolute) return 0;
  const values = matrix.cells.map((cell) => Math.abs(cell.value)).filter((entry) => entry > 0).sort((a, b) => a - b);
  if (!values.length) return 0;
  if (mode === "PERCENTILE") {
    let index = 0;
    while (index < values.length && values[index] <= absolute) index += 1;
    return index / values.length;
  }
  return Math.min(1, absolute / (values.at(-1) ?? absolute));
}
