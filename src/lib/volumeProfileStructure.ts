import type { VolumeProfileMathLevel } from "./volumeProfileMath.ts";

/**
 * Structural reads over a completed volume profile: high-volume nodes (peaks),
 * low-volume nodes (valleys), the band of price the market did most of its
 * business in, and volume-weighted average price with deviation envelopes.
 *
 * These are the calculations behind DeepChart's Peak and Valley and VWAP tabs.
 * Everything here is pure and works off the profile rows alone, so the same
 * numbers hold for a live session, a replayed one, and a test fixture.
 */

export type VolumeProfileNode = {
  price: number;
  volume: number;
  /** Share of the profile's busiest row, 0–100. */
  volumePercent: number;
  /** How far this row stands out from the weakest row beside it, 0–100. */
  prominence: number;
};

export type VolumeProfileStructure = {
  peaks: VolumeProfileNode[];
  valleys: VolumeProfileNode[];
  /** Price band bounded by the outermost peaks — null until two peaks exist. */
  businessZone: { low: number; high: number } | null;
};

export type PeakValleySettings = {
  /** 0–100. Higher finds smaller features; lower keeps only major structure. */
  sensitivity: number;
  /** Drop the profile's own high and low rows, which are edges rather than nodes. */
  excludeHighLow: boolean;
  /** A peak must hold at least this share of the busiest row, 0–100. */
  peakMinVolumePercent: number;
  /** A valley must sit at or below this share of the busiest row, 0–100. */
  valleyMaxVolumePercent: number;
  /** Restrict peaks to rows outside the value area. */
  peakOnlyOutsideValueArea: boolean;
  /** Restrict valleys to rows outside the value area. */
  valleyOnlyOutsideValueArea: boolean;
};

export const DEFAULT_PEAK_VALLEY_SETTINGS: PeakValleySettings = {
  sensitivity: 40,
  excludeHighLow: true,
  peakMinVolumePercent: 0,
  valleyMaxVolumePercent: 100,
  peakOnlyOutsideValueArea: false,
  valleyOnlyOutsideValueArea: false,
};

/**
 * Rows either side of a candidate that must not beat it. Sensitivity is
 * inverted deliberately: a trader raising sensitivity wants the profile to
 * surface finer structure, which means comparing against a narrower window.
 */
const MAX_COMPARISON_WINDOW = 10;

export function peakValleyWindow(sensitivity: number): number {
  const bounded = Math.min(100, Math.max(0, Number.isFinite(sensitivity) ? sensitivity : 0));
  return Math.max(1, Math.round(((100 - bounded) / 100) * MAX_COMPARISON_WINDOW) || 1);
}

/**
 * Peaks and valleys in one pass over the rows.
 *
 * A row is a peak when nothing within the comparison window trades more, and a
 * valley when nothing within it trades less. Ties resolve to the first row so
 * a flat shelf reports one node rather than a cluster of identical ones.
 * `valueArea` is optional and only needed for the outside-value-area filters.
 */
export function calculateVolumeProfileStructure(
  levels: readonly VolumeProfileMathLevel[],
  settings: PeakValleySettings = DEFAULT_PEAK_VALLEY_SETTINGS,
  valueArea?: { vah: number | null; val: number | null },
): VolumeProfileStructure {
  const rows = [...levels]
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.volume))
    .sort((left, right) => left.price - right.price);
  if (rows.length < 3) return { peaks: [], valleys: [], businessZone: null };

  const maxVolume = rows.reduce((best, row) => (row.volume > best ? row.volume : best), 0);
  if (!(maxVolume > 0)) return { peaks: [], valleys: [], businessZone: null };

  const window = peakValleyWindow(settings.sensitivity);
  const firstIndex = settings.excludeHighLow ? 1 : 0;
  const lastIndex = rows.length - 1 - (settings.excludeHighLow ? 1 : 0);

  const outsideValueArea = (price: number) => {
    const high = valueArea?.vah ?? null;
    const low = valueArea?.val ?? null;
    if (high === null || low === null) return true;
    return price > high || price < low;
  };

  const peaks: VolumeProfileNode[] = [];
  const valleys: VolumeProfileNode[] = [];

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const row = rows[index];
    const start = Math.max(0, index - window);
    const end = Math.min(rows.length - 1, index + window);

    let neighbourMax = Number.NEGATIVE_INFINITY;
    let neighbourMin = Number.POSITIVE_INFINITY;
    let strictlyHighest = true;
    let strictlyLowest = true;
    for (let scan = start; scan <= end; scan += 1) {
      if (scan === index) continue;
      const other = rows[scan].volume;
      if (other > neighbourMax) neighbourMax = other;
      if (other < neighbourMin) neighbourMin = other;
      // An earlier equal row already claimed this shelf.
      if (other > row.volume || (other === row.volume && scan < index)) strictlyHighest = false;
      if (other < row.volume || (other === row.volume && scan < index)) strictlyLowest = false;
    }

    const volumePercent = (row.volume / maxVolume) * 100;

    if (strictlyHighest && volumePercent >= settings.peakMinVolumePercent) {
      if (!settings.peakOnlyOutsideValueArea || outsideValueArea(row.price)) {
        const prominence = neighbourMin === Number.POSITIVE_INFINITY
          ? 100
          : ((row.volume - neighbourMin) / maxVolume) * 100;
        peaks.push({ price: row.price, volume: row.volume, volumePercent, prominence });
      }
    }

    if (strictlyLowest && volumePercent <= settings.valleyMaxVolumePercent) {
      if (!settings.valleyOnlyOutsideValueArea || outsideValueArea(row.price)) {
        const prominence = neighbourMax === Number.NEGATIVE_INFINITY
          ? 100
          : ((neighbourMax - row.volume) / maxVolume) * 100;
        valleys.push({ price: row.price, volume: row.volume, volumePercent, prominence });
      }
    }
  }

  // The band the market actually did business in: bounded by the outermost
  // high-volume nodes, not by the profile's extremes, which are usually a
  // single rejected print.
  const businessZone = peaks.length >= 2
    ? {
      low: Math.min(...peaks.map((peak) => peak.price)),
      high: Math.max(...peaks.map((peak) => peak.price)),
    }
    : null;

  return { peaks, valleys, businessZone };
}

export type VolumeProfileVwapBand = {
  /** Standard deviations from VWAP. */
  deviations: number;
  upper: number;
  lower: number;
};

export type VolumeProfileVwap = {
  vwap: number | null;
  /** Volume-weighted standard deviation of price, in price units. */
  standardDeviation: number;
  bands: VolumeProfileVwapBand[];
};

/**
 * Volume-weighted average price and its deviation envelopes, derived from the
 * profile's own rows.
 *
 * This is the profile's VWAP — the average price of the volume in THIS
 * profile — which is what DeepChart draws on the profile and is not the same
 * series as a session VWAP plotted bar by bar across the chart.
 */
export function calculateVolumeProfileVwap(
  levels: readonly VolumeProfileMathLevel[],
  bandDeviations: readonly number[] = [],
): VolumeProfileVwap {
  let totalVolume = 0;
  let priceVolume = 0;
  for (const level of levels) {
    if (!Number.isFinite(level.price) || !Number.isFinite(level.volume) || level.volume <= 0) continue;
    totalVolume += level.volume;
    priceVolume += level.price * level.volume;
  }
  if (!(totalVolume > 0)) return { vwap: null, standardDeviation: 0, bands: [] };

  const vwap = priceVolume / totalVolume;
  let variance = 0;
  for (const level of levels) {
    if (!Number.isFinite(level.price) || !Number.isFinite(level.volume) || level.volume <= 0) continue;
    const difference = level.price - vwap;
    variance += level.volume * difference * difference;
  }
  const standardDeviation = Math.sqrt(variance / totalVolume);

  const bands = bandDeviations
    .filter((deviations) => Number.isFinite(deviations) && deviations > 0)
    .map((deviations) => ({
      deviations,
      upper: vwap + standardDeviation * deviations,
      lower: vwap - standardDeviation * deviations,
    }));

  return { vwap, standardDeviation, bands };
}

export type VolumeProfileSummary = {
  totalVolume: number;
  bidVolume: number;
  askVolume: number;
  delta: number;
  trades: number;
};

/** Totals for the Summary block printed beside a profile. */
export function summarizeVolumeProfile(
  levels: readonly { volume: number; bidVolume: number; askVolume: number; trades: number }[],
): VolumeProfileSummary {
  const summary: VolumeProfileSummary = {
    totalVolume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0,
  };
  for (const level of levels) {
    summary.totalVolume += Math.max(0, level.volume) || 0;
    summary.bidVolume += Math.max(0, level.bidVolume) || 0;
    summary.askVolume += Math.max(0, level.askVolume) || 0;
    summary.trades += Math.max(0, level.trades) || 0;
  }
  summary.delta = summary.askVolume - summary.bidVolume;
  return summary;
}
