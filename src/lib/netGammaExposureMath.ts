export type GammaExposureValues = {
  callExposure: number;
  putExposure: number;
  netExposure: number;
  absoluteCallExposure: number;
  absolutePutExposure: number;
  absoluteTotalExposure: number;
};

export function calculateGammaExposure(callValue: unknown, putValue: unknown): GammaExposureValues {
  const callExposure = Number(callValue) || 0;
  const putExposure = Number(putValue) || 0;
  return {
    callExposure,
    putExposure,
    netExposure: callExposure + putExposure,
    absoluteCallExposure: Math.abs(callExposure),
    absolutePutExposure: Math.abs(putExposure),
    absoluteTotalExposure: Math.abs(callExposure) + Math.abs(putExposure),
  };
}

export function roundMappedPriceToTick(price: number, tickSize: number) {
  const safeTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.01;
  const mappedDisplayTick = Math.round(price / safeTick);
  return { mappedDisplayTick, mappedDisplayPrice: mappedDisplayTick * safeTick };
}

export function resolveMappedBinTicks(input: {
  mode: "exact-display-tick" | "auto-bin" | "custom-bin";
  tickSize: number;
  mappedSpacings: number[];
  customBinSizePoints?: number;
}) {
  const tickSize = input.tickSize > 0 ? input.tickSize : 0.01;
  const sorted = input.mappedSpacings.filter((value) => value > 0).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = !sorted.length ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const rawSize = input.mode === "exact-display-tick"
    ? tickSize
    : input.mode === "custom-bin"
      ? Math.max(tickSize, Number(input.customBinSizePoints) || tickSize)
      : Math.max(tickSize, median * 0.25);
  return Math.max(1, Math.round(rawSize / tickSize));
}

export type GammaExpirationFilterLike = {
  mode: "zero-dte" | "zero-to-one-dte" | "zero-to-seven-dte" | "front-expiration" | "all-expirations" | "custom-dte-range" | "specific-expirations";
  minimumDte?: number;
  maximumDte?: number;
  expirationDates?: string[];
  includeWeeklies: boolean;
  includeMonthlies: boolean;
  includeQuarterlies: boolean;
};

export function expirationDte(expiration: string, sessionDate: string) {
  const value = Math.round((Date.parse(`${expiration}T00:00:00.000Z`) - Date.parse(`${sessionDate}T00:00:00.000Z`)) / 86_400_000);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function thirdFriday(expiration: string) {
  const date = new Date(`${expiration}T12:00:00.000Z`);
  return date.getUTCDay() === 5 && date.getUTCDate() >= 15 && date.getUTCDate() <= 21;
}

function quarterlyExpiration(expiration: string) {
  const date = new Date(`${expiration}T12:00:00.000Z`);
  return [2, 5, 8, 11].includes(date.getUTCMonth()) && thirdFriday(expiration);
}

export function expirationMatchesFilter(expiration: string, sessionDate: string, filter: GammaExpirationFilterLike, frontExpiration: string | null) {
  const dte = expirationDte(expiration, sessionDate);
  const quarterly = quarterlyExpiration(expiration);
  const monthly = thirdFriday(expiration) && !quarterly;
  const weekly = !monthly && !quarterly;
  if ((weekly && !filter.includeWeeklies) || (monthly && !filter.includeMonthlies) || (quarterly && !filter.includeQuarterlies)) return false;
  if (filter.mode === "zero-dte") return dte === 0;
  if (filter.mode === "zero-to-one-dte") return dte >= 0 && dte <= 1;
  if (filter.mode === "zero-to-seven-dte") return dte >= 0 && dte <= 7;
  if (filter.mode === "front-expiration") return expiration === frontExpiration;
  if (filter.mode === "custom-dte-range") return dte >= (filter.minimumDte ?? 0) && dte <= (filter.maximumDte ?? 7);
  if (filter.mode === "specific-expirations") return filter.expirationDates?.includes(expiration) ?? false;
  return true;
}

export type GammaSummaryRow = GammaExposureValues & { id: string };

export function summarizeGammaRows<T extends GammaSummaryRow>(rows: T[]) {
  const maximumBy = (values: T[], select: (value: T) => number) => values.length
    ? values.reduce((best, value) => select(value) > select(best) ? value : best)
    : null;
  const minimumBy = (values: T[], select: (value: T) => number) => values.length
    ? values.reduce((best, value) => select(value) < select(best) ? value : best)
    : null;
  const totalCallExposure = rows.reduce((sum, row) => sum + row.callExposure, 0);
  const totalPutExposure = rows.reduce((sum, row) => sum + row.putExposure, 0);
  const totalNetExposure = rows.reduce((sum, row) => sum + row.netExposure, 0);
  const totalAbsoluteExposure = rows.reduce((sum, row) => sum + row.absoluteTotalExposure, 0);
  return {
    totalCallExposure,
    totalPutExposure,
    totalNetExposure,
    totalAbsoluteExposure,
    totalRegime: totalNetExposure > 0 ? "positive" as const : totalNetExposure < 0 ? "negative" as const : "neutral" as const,
    maxPositiveRow: maximumBy(rows.filter((row) => row.netExposure > 0), (row) => row.netExposure),
    maxNegativeRow: minimumBy(rows.filter((row) => row.netExposure < 0), (row) => row.netExposure),
    dominantAbsoluteRow: maximumBy(rows, (row) => Math.abs(row.netExposure)),
    callWallRow: maximumBy(rows, (row) => row.callExposure),
    putWallRow: minimumBy(rows, (row) => row.putExposure),
  };
}
