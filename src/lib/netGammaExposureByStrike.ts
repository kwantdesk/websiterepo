import {
  buildGammaHeatmapMapping,
  mapGammaHeatmapStrike,
  normalizeGammaHeatmapInstrument,
} from "@/lib/gammaHeatmap";
import type { ExposureStrike } from "@/lib/optionsFlow";

export const NET_GAMMA_EXPOSURE_BY_STRIKE_ID = "net-gamma-exposure-by-strike";
export const NET_GAMMA_EXPOSURE_SCHEMA_VERSION = 1;

export type NetGammaProviderMode = "quantdata" | "databento-custom" | "hybrid-validation";
export type GammaRepresentation = "per-one-percent-move" | "per-one-dollar-move" | "raw";
export type GammaExpirationMode =
  | "zero-dte"
  | "zero-to-one-dte"
  | "zero-to-seven-dte"
  | "front-expiration"
  | "all-expirations"
  | "custom-dte-range"
  | "specific-expirations";
export type MappedStrikeAggregationMode = "exact-display-tick" | "auto-bin" | "custom-bin";
export type GammaProfileContentMode = "net" | "net-with-call-put-detail" | "call-put-split" | "absolute-concentration" | "net-change";
export type GammaProfilePlacement = "right" | "left" | "floating";
export type GammaScaleMode = "visible-maximum" | "visible-percentile" | "all-loaded-maximum" | "fixed-maximum";
export type GammaScaleTransform = "linear" | "square-root" | "logarithmic";
export type GammaBarVisualMode = "solid" | "gradient" | "outline" | "heat" | "compact-line";

export type GammaExpirationFilter = {
  mode: GammaExpirationMode;
  minimumDte?: number;
  maximumDte?: number;
  expirationDates?: string[];
  includeWeeklies: boolean;
  includeMonthlies: boolean;
  includeQuarterlies: boolean;
};

export type GammaStrikeContribution = {
  expirationDate: string;
  sourceStrike: number;
  callExposure: number;
  putExposure: number;
  netExposure: number;
  daysToExpiration: number;
};

export type StrikeMappingSnapshot = {
  method: "same-underlying-direct" | "rolling-affine-regression" | "live-ratio" | "spot-futures-basis" | "futures-calendar-spread";
  sourceTicker: string;
  displayInstrument: string;
  alpha: number;
  beta: number;
  sourceSpotPrice: number;
  displayMidPrice: number;
  mappedSourceSpotPrice: number;
  rSquared?: number;
  sampleCount?: number;
  mappingConfidence: number;
  calculatedAtMs: number;
  dataAgeMs: number;
};

export type NetGammaStrikeRow = {
  id: string;
  sourceTicker: string;
  displayInstrument: string;
  sourceStrike: number;
  sourceStrikes: number[];
  mappedDisplayPrice: number;
  mappedDisplayTick: number;
  callExposure: number;
  putExposure: number;
  netExposure: number;
  absoluteCallExposure: number;
  absolutePutExposure: number;
  absoluteTotalExposure: number;
  percentageOfTotalAbsoluteExposure: number;
  percentageOfVisibleAbsoluteExposure: number;
  expirationContributions: GammaStrikeContribution[];
  mapping: StrikeMappingSnapshot;
  sourceSnapshotTimeMs: number;
  receivedTimeMs: number;
};

export type NetGammaProfileSnapshot = {
  schemaVersion: 1;
  id: string;
  provider: NetGammaProviderMode;
  sourceTicker: string;
  sourceSpotPrice: number;
  displayInstrument: string;
  displayPrice: number;
  representation: GammaRepresentation;
  expirationLabel: string;
  expirationDates: string[];
  rows: NetGammaStrikeRow[];
  totalCallExposure: number;
  totalPutExposure: number;
  totalNetExposure: number;
  totalAbsoluteExposure: number;
  maxPositiveRow: NetGammaStrikeRow | null;
  maxNegativeRow: NetGammaStrikeRow | null;
  dominantAbsoluteRow: NetGammaStrikeRow | null;
  callWallRow: NetGammaStrikeRow | null;
  putWallRow: NetGammaStrikeRow | null;
  mapping: StrikeMappingSnapshot;
  snapshotTimeMs: number;
  receivedTimeMs: number;
  refreshAfterMs: number;
  status: "live" | "prior-session" | "delayed" | "stale" | "loading" | "unavailable";
  limitations: string[];
};

export type NetGammaProviderSurface = {
  sourceTicker: string;
  sourceSpotPrice: number;
  displayPrice: number;
  displayInstrument: string;
  sessionDate: string;
  marketOpen: boolean;
  checkedAt: string;
  status: "LIVE" | "LAST_SESSION" | "DELAYED";
  refreshAfterMs: number;
  strikes: ExposureStrike[];
  expiryStrikes: Array<ExposureStrike & { expiration: string }>;
};

export type BuildNetGammaProfileOptions = {
  provider?: NetGammaProviderMode;
  representation?: GammaRepresentation;
  expiration?: Partial<GammaExpirationFilter> & { mode?: GammaExpirationMode };
  aggregationMode?: MappedStrikeAggregationMode;
  customBinSizePoints?: number;
  minimumAbsoluteExposure?: number;
  sourceStrikeMinimum?: number | null;
  sourceStrikeMaximum?: number | null;
  maximumDistanceFromSourceSpot?: number | null;
};

const DEFAULT_EXPIRATION: GammaExpirationFilter = {
  mode: "zero-to-one-dte",
  includeWeeklies: true,
  includeMonthlies: true,
  includeQuarterlies: true,
};

export function defaultNetGammaSource(displayInstrument: string) {
  return /^(ES|MES)$/.test(normalizeGammaHeatmapInstrument(displayInstrument)) ? "SPY" : "QQQ";
}

export function netGammaDisplayTickSize(displayInstrument: string) {
  const root = normalizeGammaHeatmapInstrument(displayInstrument);
  return /^(NQ|MNQ|ES|MES)$/.test(root) ? 0.25 : 0.01;
}

function utcDateMs(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export function expirationDte(expiration: string, sessionDate: string) {
  const value = Math.round((utcDateMs(expiration) - utcDateMs(sessionDate)) / 86_400_000);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function thirdFriday(expiration: string) {
  const date = new Date(`${expiration}T12:00:00.000Z`);
  if (date.getUTCDay() !== 5) return false;
  const day = date.getUTCDate();
  return day >= 15 && day <= 21;
}

function quarterlyExpiration(expiration: string) {
  const date = new Date(`${expiration}T12:00:00.000Z`);
  return [2, 5, 8, 11].includes(date.getUTCMonth()) && thirdFriday(expiration);
}

export function expirationMatchesFilter(expiration: string, sessionDate: string, filter: GammaExpirationFilter, frontExpiration: string | null) {
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

export function normalizeNetGammaMapping(surface: NetGammaProviderSurface): StrikeMappingSnapshot {
  const shared = buildGammaHeatmapMapping({
    sourceInstrument: surface.sourceTicker,
    displayInstrument: surface.displayInstrument,
    sourcePrice: surface.sourceSpotPrice,
    displayPrice: surface.displayPrice,
    asOf: surface.checkedAt,
  });
  const method: StrikeMappingSnapshot["method"] = shared.method === "direct"
    ? "same-underlying-direct"
    : shared.method === "live-basis"
      ? "spot-futures-basis"
      : "live-ratio";
  const calculatedAtMs = Date.parse(shared.asOf) || Date.now();
  return {
    method,
    sourceTicker: surface.sourceTicker,
    displayInstrument: normalizeGammaHeatmapInstrument(surface.displayInstrument),
    alpha: shared.basis,
    beta: shared.scale,
    sourceSpotPrice: shared.sourcePrice,
    displayMidPrice: shared.displayPrice,
    mappedSourceSpotPrice: mapGammaHeatmapStrike(shared.sourcePrice, shared),
    mappingConfidence: Math.min(
      shared.method === "live-ratio" ? 75 : 100,
      Math.round(Math.max(0, Math.min(1, shared.confidence)) * 100),
    ),
    calculatedAtMs,
    dataAgeMs: Math.max(0, Date.now() - calculatedAtMs),
  };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function expirationLabel(filter: GammaExpirationFilter) {
  if (filter.mode === "zero-dte") return "0DTE";
  if (filter.mode === "zero-to-one-dte") return "0–1 DTE";
  if (filter.mode === "zero-to-seven-dte") return "0–7 DTE";
  if (filter.mode === "front-expiration") return "FRONT EXPIRY";
  if (filter.mode === "all-expirations") return "ALL EXPIRIES";
  if (filter.mode === "specific-expirations") return "SELECTED EXPIRIES";
  return `${filter.minimumDte ?? 0}–${filter.maximumDte ?? 7} DTE`;
}

export function buildNetGammaProfile(surface: NetGammaProviderSurface, options: BuildNetGammaProfileOptions = {}): NetGammaProfileSnapshot {
  const provider = options.provider ?? "quantdata";
  if (provider !== "quantdata") throw new Error(`${provider} is not enabled because the required validated option-chain fields are unavailable.`);
  const representation = options.representation ?? "per-one-percent-move";
  if (representation !== "per-one-percent-move") throw new Error("The shared KwantData surface currently provides Gamma per one-percent move only.");
  const expiration: GammaExpirationFilter = { ...DEFAULT_EXPIRATION, ...options.expiration };
  const frontExpiration = surface.expiryStrikes.map((row) => row.expiration).sort()[0] ?? null;
  const selected = surface.expiryStrikes.filter((row) => expirationMatchesFilter(row.expiration, surface.sessionDate, expiration, frontExpiration));
  const fallbackRows = selected.length || surface.expiryStrikes.length ? selected : surface.strikes.map((row) => ({ ...row, expiration: frontExpiration ?? surface.sessionDate }));
  const byStrike = new Map<number, { call: number; put: number; contributions: GammaStrikeContribution[] }>();
  for (const row of fallbackRows) {
    if (options.sourceStrikeMinimum != null && row.strike < options.sourceStrikeMinimum) continue;
    if (options.sourceStrikeMaximum != null && row.strike > options.sourceStrikeMaximum) continue;
    if (options.maximumDistanceFromSourceSpot != null && Math.abs(row.strike - surface.sourceSpotPrice) > options.maximumDistanceFromSourceSpot) continue;
    const current = byStrike.get(row.strike) ?? { call: 0, put: 0, contributions: [] };
    current.call += Number(row.call) || 0;
    current.put += Number(row.put) || 0;
    current.contributions.push({
      expirationDate: row.expiration,
      sourceStrike: row.strike,
      callExposure: Number(row.call) || 0,
      putExposure: Number(row.put) || 0,
      netExposure: (Number(row.call) || 0) + (Number(row.put) || 0),
      daysToExpiration: expirationDte(row.expiration, surface.sessionDate),
    });
    byStrike.set(row.strike, current);
  }

  const mapping = normalizeNetGammaMapping(surface);
  const tickSize = netGammaDisplayTickSize(surface.displayInstrument);
  const mapped = [...byStrike.entries()].map(([sourceStrike, row]) => {
    const raw = mapping.alpha + mapping.beta * sourceStrike;
    const mappedDisplayTick = Math.round(raw / tickSize);
    return { sourceStrike, mappedDisplayTick, mappedDisplayPrice: mappedDisplayTick * tickSize, ...row };
  });
  const spacings = mapped.slice(1).map((row, index) => Math.abs(row.mappedDisplayPrice - mapped[index].mappedDisplayPrice)).filter((value) => value > 0);
  const aggregationMode = options.aggregationMode ?? "auto-bin";
  const rawBinSize = aggregationMode === "exact-display-tick"
    ? tickSize
    : aggregationMode === "custom-bin"
      ? Math.max(tickSize, options.customBinSizePoints ?? tickSize)
      : Math.max(tickSize, median(spacings) * 0.25);
  const binTicks = Math.max(1, Math.round(rawBinSize / tickSize));
  const bins = new Map<number, typeof mapped[number] & { sourceStrikes: number[] }>();
  for (const row of mapped) {
    const binTick = Math.round(row.mappedDisplayTick / binTicks) * binTicks;
    const existing = bins.get(binTick);
    if (existing) {
      existing.call += row.call;
      existing.put += row.put;
      existing.contributions.push(...row.contributions);
      existing.sourceStrikes.push(row.sourceStrike);
    } else {
      bins.set(binTick, { ...row, mappedDisplayTick: binTick, mappedDisplayPrice: binTick * tickSize, sourceStrikes: [row.sourceStrike] });
    }
  }
  const snapshotTimeMs = Date.parse(surface.checkedAt) || Date.now();
  const receivedTimeMs = Date.now();
  const preliminary = [...bins.values()].map((row) => {
    const netExposure = row.call + row.put;
    return {
      id: `${surface.sourceTicker}:${surface.displayInstrument}:${row.mappedDisplayTick}`,
      sourceTicker: surface.sourceTicker,
      displayInstrument: normalizeGammaHeatmapInstrument(surface.displayInstrument),
      sourceStrike: row.sourceStrikes.reduce((sum, value) => sum + value, 0) / row.sourceStrikes.length,
      sourceStrikes: [...row.sourceStrikes].sort((a, b) => a - b),
      mappedDisplayPrice: row.mappedDisplayPrice,
      mappedDisplayTick: row.mappedDisplayTick,
      callExposure: row.call,
      putExposure: row.put,
      netExposure,
      absoluteCallExposure: Math.abs(row.call),
      absolutePutExposure: Math.abs(row.put),
      absoluteTotalExposure: Math.abs(row.call) + Math.abs(row.put),
      percentageOfTotalAbsoluteExposure: 0,
      percentageOfVisibleAbsoluteExposure: 0,
      expirationContributions: row.contributions,
      mapping: { ...mapping },
      sourceSnapshotTimeMs: snapshotTimeMs,
      receivedTimeMs,
    } satisfies NetGammaStrikeRow;
  }).filter((row) => row.absoluteTotalExposure >= Math.max(0, options.minimumAbsoluteExposure ?? 0));
  const totalAbsoluteExposure = preliminary.reduce((sum, row) => sum + row.absoluteTotalExposure, 0);
  const rows = preliminary.map((row) => ({
    ...row,
    percentageOfTotalAbsoluteExposure: totalAbsoluteExposure > 0 ? row.absoluteTotalExposure / totalAbsoluteExposure : 0,
    percentageOfVisibleAbsoluteExposure: totalAbsoluteExposure > 0 ? row.absoluteTotalExposure / totalAbsoluteExposure : 0,
  })).sort((a, b) => a.mappedDisplayPrice - b.mappedDisplayPrice);
  const positive = rows.filter((row) => row.netExposure > 0);
  const negative = rows.filter((row) => row.netExposure < 0);
  const maxBy = (values: NetGammaStrikeRow[], select: (row: NetGammaStrikeRow) => number) => values.length
    ? [...values].sort((a, b) => select(b) - select(a))[0]
    : null;
  const status = surface.status === "LIVE" ? "live" : surface.status === "DELAYED" ? "delayed" : "prior-session";
  const expirationDates = [...new Set(fallbackRows.map((row) => row.expiration))].sort();
  return {
    schemaVersion: NET_GAMMA_EXPOSURE_SCHEMA_VERSION,
    id: `${surface.sourceTicker}:${surface.displayInstrument}:${snapshotTimeMs}`,
    provider,
    sourceTicker: surface.sourceTicker,
    sourceSpotPrice: surface.sourceSpotPrice,
    displayInstrument: normalizeGammaHeatmapInstrument(surface.displayInstrument),
    displayPrice: surface.displayPrice,
    representation,
    expirationLabel: expirationLabel(expiration),
    expirationDates,
    rows,
    totalCallExposure: rows.reduce((sum, row) => sum + row.callExposure, 0),
    totalPutExposure: rows.reduce((sum, row) => sum + row.putExposure, 0),
    totalNetExposure: rows.reduce((sum, row) => sum + row.netExposure, 0),
    totalAbsoluteExposure,
    maxPositiveRow: maxBy(positive, (row) => row.netExposure),
    maxNegativeRow: maxBy(negative, (row) => Math.abs(row.netExposure)),
    dominantAbsoluteRow: maxBy(rows, (row) => Math.abs(row.netExposure)),
    callWallRow: maxBy(rows, (row) => row.callExposure),
    putWallRow: maxBy(rows, (row) => Math.abs(Math.min(0, row.putExposure)) || Math.abs(row.putExposure)),
    mapping,
    snapshotTimeMs,
    receivedTimeMs,
    refreshAfterMs: surface.refreshAfterMs,
    status,
    limitations: [
      "KwantData exposure is provider-signed; put exposure is not signed a second time.",
      "This is a current by-strike distribution, not the historical Gamma Heatmap and not a repriced Gamma Flip.",
      ...(mapping.method === "live-ratio" ? ["Mapping uses the shared live-ratio fallback; it is not regression."] : []),
    ],
  };
}

export function isNetGammaProfileSnapshot(value: unknown): value is NetGammaProfileSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NetGammaProfileSnapshot>;
  return candidate.schemaVersion === 1
    && candidate.id !== undefined
    && Array.isArray(candidate.rows)
    && typeof candidate.totalNetExposure === "number"
    && Boolean(candidate.mapping);
}

export function formatGammaValue(value: number, representation: GammaRepresentation, compact = true) {
  const absolute = Math.abs(value);
  const formatted = compact
    ? Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(absolute)
    : Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(absolute);
  const suffix = representation === "per-one-percent-move" ? " / 1%" : representation === "per-one-dollar-move" ? " / $1" : "";
  return `${value < 0 ? "-" : value > 0 ? "+" : ""}$${formatted}${suffix}`;
}
