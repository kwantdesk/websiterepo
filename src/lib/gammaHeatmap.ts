import { latestGexMapStrikesFromFrames, type GexMapPanelPayload } from "@/lib/gexMap";
import type { ExposureStrike, GreekMode } from "@/lib/optionsFlow";

export const GAMMA_HEATMAP_ID = "gamma-heatmap";
export const GAMMA_HEATMAP_SCHEMA_VERSION = 1;

export type GammaHeatmapSourceMode = "quantdata" | "databento-raw" | "hybrid";
export type GammaHeatmapViewMode =
  | "net"
  | "call-put"
  | "absolute"
  | "change"
  | "hedge-pressure"
  | "levels-only";
export type GammaHeatmapMappingMethod = "direct" | "live-basis" | "live-ratio";

export type GammaHeatmapMappingSnapshot = {
  sourceInstrument: string;
  displayInstrument: string;
  method: GammaHeatmapMappingMethod;
  scale: number;
  basis: number;
  confidence: number;
  sourcePrice: number;
  displayPrice: number;
  asOf: string;
};

export type GammaHeatmapBin = {
  price: number;
  call: number;
  put: number;
  net: number;
  absolute: number;
  change: number;
};

export type GammaHeatmapSnapshot = {
  timestamp: number;
  bins: GammaHeatmapBin[];
  mapping: GammaHeatmapMappingSnapshot;
  status: GexMapPanelPayload["status"];
};

export type GammaHeatmapLevelKind =
  | "CALL_WALL"
  | "PUT_WALL"
  | "MAX_POSITIVE_GAMMA"
  | "MAX_NEGATIVE_GAMMA"
  | "GAMMA_POC"
  | "POSITIVE_CLUSTER"
  | "NEGATIVE_CLUSTER"
  | "VACUUM"
  | "LOCAL_SIGN_TRANSITION"
  | "METRIC_POSITIVE_WALL"
  | "METRIC_NEGATIVE_WALL"
  | "METRIC_POC";

export type GammaHeatmapLevel = {
  id: string;
  kind: GammaHeatmapLevelKind;
  label: string;
  price: number;
  value: number;
  confidence: number;
  isTrueGammaFlip: false;
};

export type GammaHeatmapPayload = {
  schemaVersion: 1;
  sourceMode: GammaHeatmapSourceMode;
  sourceInstrument: string;
  displayInstrument: string;
  greekMode: GreekMode;
  representation: GexMapPanelPayload["representation"];
  scope: GexMapPanelPayload["scope"];
  expiration: string;
  asOf: string;
  status: GexMapPanelPayload["status"];
  refreshAfterMs: number;
  marketClosed: boolean;
  historyPolicy: "carry-forward-faded";
  snapshots: GammaHeatmapSnapshot[];
  current: GammaHeatmapSnapshot | null;
  levels: GammaHeatmapLevel[];
  netExposure: number;
  grossExposure: number;
  provenance: string[];
  limitations: string[];
};

const DISPLAY_ROOT = /^(M?NQ|M?ES)$/;

export function normalizeGammaHeatmapInstrument(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[0-9].*$/, "");
  if (normalized.startsWith("MNQ")) return "MNQ";
  if (normalized.startsWith("NQ")) return "NQ";
  if (normalized.startsWith("MES")) return "MES";
  if (normalized.startsWith("ES")) return "ES";
  return normalized;
}

export function defaultGammaHeatmapSource(displayInstrument: string) {
  const root = normalizeGammaHeatmapInstrument(displayInstrument);
  return root === "ES" || root === "MES" ? "SPY" : "QQQ";
}

export function gammaHeatmapGreek(metric: string): GreekMode {
  const upper = metric.toUpperCase();
  if (upper === "DELTA" || upper === "DEX") return "DELTA";
  if (upper === "VANNA" || upper === "VEX") return "VANNA";
  if (upper === "CHARM" || upper === "CHEX") return "CHARM";
  return "GAMMA";
}

export function buildGammaHeatmapMapping(input: {
  sourceInstrument: string;
  displayInstrument: string;
  sourcePrice: number;
  displayPrice: number;
  asOf: string;
}): GammaHeatmapMappingSnapshot {
  const sourceInstrument = input.sourceInstrument.toUpperCase();
  const displayInstrument = normalizeGammaHeatmapInstrument(input.displayInstrument);
  const sourcePrice = Number(input.sourcePrice);
  const displayPrice = Number(input.displayPrice);
  if (!(sourcePrice > 0) || !(displayPrice > 0)) {
    throw new Error("A live source and display price are required to map the gamma surface.");
  }
  const direct = sourceInstrument === displayInstrument
    || (sourceInstrument === "NQ" && displayInstrument === "MNQ")
    || (sourceInstrument === "ES" && displayInstrument === "MES");
  if (direct) {
    return { sourceInstrument, displayInstrument, method: "direct", scale: 1, basis: 0, confidence: 1, sourcePrice, displayPrice, asOf: input.asOf };
  }
  const basisMapped = (sourceInstrument === "NDX" && /^(NQ|MNQ)$/.test(displayInstrument))
    || (/^(SPX|SPXW)$/.test(sourceInstrument) && /^(ES|MES)$/.test(displayInstrument));
  if (basisMapped) {
    return { sourceInstrument, displayInstrument, method: "live-basis", scale: 1, basis: displayPrice - sourcePrice, confidence: 0.92, sourcePrice, displayPrice, asOf: input.asOf };
  }
  return {
    sourceInstrument,
    displayInstrument,
    method: "live-ratio",
    scale: displayPrice / sourcePrice,
    basis: 0,
    confidence: 0.84,
    sourcePrice,
    displayPrice,
    asOf: input.asOf,
  };
}

export function mapGammaHeatmapStrike(strike: number, mapping: GammaHeatmapMappingSnapshot) {
  return strike * mapping.scale + mapping.basis;
}

function binSurface(rows: ExposureStrike[], mapping: GammaHeatmapMappingSnapshot, binSize: number, previous?: Map<number, number>) {
  const bins = new Map<number, GammaHeatmapBin>();
  const safeBin = Math.max(0.25, binSize);
  for (const row of rows) {
    const mapped = mapGammaHeatmapStrike(row.strike, mapping);
    const price = Math.round(mapped / safeBin) * safeBin;
    const current = bins.get(price) ?? { price, call: 0, put: 0, net: 0, absolute: 0, change: 0 };
    current.call += Number(row.call) || 0;
    current.put += Number(row.put) || 0;
    current.net += Number(row.net) || 0;
    current.absolute += Math.abs(Number(row.call) || 0) + Math.abs(Number(row.put) || 0);
    bins.set(price, current);
  }
  for (const bin of bins.values()) bin.change = bin.net - (previous?.get(bin.price) ?? 0);
  return [...bins.values()].sort((left, right) => left.price - right.price);
}

function deriveLevels(bins: GammaHeatmapBin[], mappingConfidence: number, greekMode: GreekMode): GammaHeatmapLevel[] {
  if (!bins.length) return [];
  const by = (selector: (bin: GammaHeatmapBin) => number) => [...bins].sort((a, b) => selector(b) - selector(a))[0];
  const callWall = by((bin) => Math.max(0, bin.call));
  const putWall = by((bin) => Math.abs(Math.min(0, bin.put)) || Math.abs(bin.put));
  const maxPositive = by((bin) => Math.max(0, bin.net));
  const maxNegative = by((bin) => Math.abs(Math.min(0, bin.net)));
  const poc = by((bin) => bin.absolute);
  const maxAbsolute = Math.max(1, ...bins.map((bin) => bin.absolute));
  const metricName = greekMode === "DELTA" ? "DEX" : greekMode === "VANNA" ? "Vanna" : greekMode === "CHARM" ? "Charm" : "Gamma";
  const levels: GammaHeatmapLevel[] = greekMode === "GAMMA" ? [
    { id: "call-wall", kind: "CALL_WALL", label: "Call Wall", price: callWall.price, value: callWall.call, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "put-wall", kind: "PUT_WALL", label: "Put Wall", price: putWall.price, value: putWall.put, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "max-positive", kind: "MAX_POSITIVE_GAMMA", label: "Max +Gamma", price: maxPositive.price, value: maxPositive.net, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "max-negative", kind: "MAX_NEGATIVE_GAMMA", label: "Max -Gamma", price: maxNegative.price, value: maxNegative.net, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "gamma-poc", kind: "GAMMA_POC", label: "Gamma POC", price: poc.price, value: poc.absolute, confidence: mappingConfidence, isTrueGammaFlip: false },
  ] : [
    { id: "metric-positive-wall", kind: "METRIC_POSITIVE_WALL", label: `${metricName} +Wall`, price: maxPositive.price, value: maxPositive.net, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "metric-negative-wall", kind: "METRIC_NEGATIVE_WALL", label: `${metricName} -Wall`, price: maxNegative.price, value: maxNegative.net, confidence: mappingConfidence, isTrueGammaFlip: false },
    { id: "metric-poc", kind: "METRIC_POC", label: `${metricName} POC`, price: poc.price, value: poc.absolute, confidence: mappingConfidence, isTrueGammaFlip: false },
  ];
  bins.forEach((bin, index) => {
    if (bin.absolute >= maxAbsolute * 0.7) levels.push({
      id: `cluster-${bin.price}`,
      kind: bin.net >= 0 ? "POSITIVE_CLUSTER" : "NEGATIVE_CLUSTER",
      label: bin.net >= 0 ? `+${metricName} Cluster` : `-${metricName} Cluster`,
      price: bin.price,
      value: bin.net,
      confidence: mappingConfidence * 0.9,
      isTrueGammaFlip: false,
    });
    if (index > 0 && bin.net * bins[index - 1].net < 0) levels.push({
      id: `transition-${bin.price}`,
      kind: "LOCAL_SIGN_TRANSITION",
      label: "Local GEX Sign Transition",
      price: (bin.price + bins[index - 1].price) / 2,
      value: 0,
      confidence: mappingConfidence * 0.72,
      isTrueGammaFlip: false,
    });
  });
  const interior = bins.slice(1, -1).filter((bin) => bin.absolute <= maxAbsolute * 0.08);
  if (interior.length) {
    const vacuum = [...interior].sort((a, b) => a.absolute - b.absolute)[0];
    levels.push({ id: "vacuum", kind: "VACUUM", label: "Gamma Vacuum", price: vacuum.price, value: vacuum.absolute, confidence: mappingConfidence * 0.75, isTrueGammaFlip: false });
  }
  return levels.sort((a, b) => a.price - b.price);
}

/** Browser-authoritative exports used by the native parity fixture. */
export const buildGammaHeatmapBins = binSurface;
export const deriveGammaHeatmapLevels = deriveLevels;

export function buildGammaHeatmapPayload(input: {
  panel: GexMapPanelPayload;
  displayInstrument: string;
  displayPrice: number;
  sourceMode?: GammaHeatmapSourceMode;
  historyHours?: number;
  binSize?: number;
}): GammaHeatmapPayload {
  const { panel } = input;
  if (!DISPLAY_ROOT.test(normalizeGammaHeatmapInstrument(input.displayInstrument))) {
    throw new Error("Gamma Heatmap currently supports NQ, MNQ, ES and MES chart scales.");
  }
  if (!(panel.stockPrice && panel.stockPrice > 0)) throw new Error("The options source price is unavailable.");
  if (!panel.expiration) throw new Error("Gamma Heatmap requires a front-expiry options surface.");
  const asOf = panel.asOf || new Date().toISOString();
  const mapping = buildGammaHeatmapMapping({
    sourceInstrument: panel.symbol,
    displayInstrument: input.displayInstrument,
    sourcePrice: panel.stockPrice,
    displayPrice: input.displayPrice,
    asOf,
  });
  const surface = new Map<number, ExposureStrike>();
  const historyHours = Math.max(1, Math.min(120, input.historyHours ?? 24));
  const cutoff = Date.parse(asOf) - historyHours * 60 * 60_000;
  const snapshots: GammaHeatmapSnapshot[] = [];
  let previous = new Map<number, number>();
  for (const frame of panel.frames) {
    for (const update of frame.updates) surface.set(update.strike, { ...update });
    if (frame.timestamp < cutoff || !surface.size) continue;
    const bins = binSurface([...surface.values()], mapping, input.binSize ?? 5, previous);
    previous = new Map(bins.map((bin) => [bin.price, bin.net]));
    snapshots.push({ timestamp: frame.timestamp, bins, mapping: { ...mapping }, status: panel.status });
  }
  const latestRows = panel.latestStrikes.length ? panel.latestStrikes : latestGexMapStrikesFromFrames(panel.frames);
  const currentBins = binSurface(latestRows, mapping, input.binSize ?? 5, previous);
  const current: GammaHeatmapSnapshot | null = currentBins.length
    ? { timestamp: Date.parse(asOf), bins: currentBins, mapping, status: panel.status }
    : snapshots.at(-1) ?? null;
  if (current && snapshots.at(-1)?.timestamp !== current.timestamp) snapshots.push(current);
  const limitedSnapshots = snapshots.slice(-720);
  const sourceMode = input.sourceMode ?? "hybrid";
  return {
    schemaVersion: GAMMA_HEATMAP_SCHEMA_VERSION,
    sourceMode,
    sourceInstrument: panel.symbol,
    displayInstrument: normalizeGammaHeatmapInstrument(input.displayInstrument),
    greekMode: panel.greekMode,
    representation: panel.representation,
    scope: panel.scope,
    expiration: panel.expiration,
    asOf,
    status: panel.status,
    refreshAfterMs: panel.refreshAfterMs,
    marketClosed: panel.status !== "LIVE",
    historyPolicy: "carry-forward-faded",
    snapshots: limitedSnapshots,
    current,
    levels: deriveLevels(current?.bins ?? [], mapping.confidence, panel.greekMode),
    netExposure: panel.netExposure,
    grossExposure: panel.grossExposure,
    provenance: [
      `${panel.source} ${panel.scope.toLowerCase().replace("_", " ")}`,
      `${mapping.method} ${panel.symbol}→${mapping.displayInstrument} mapping`,
      sourceMode === "hybrid" ? "Databento futures spot + QuantData exposure surface" : sourceMode,
    ],
    limitations: [
      "The current adapter is front-expiry and per-one-dollar-move.",
      "A local strike sign transition is not a true repriced gamma flip.",
      ...(sourceMode === "databento-raw" ? ["Native raw historical chain surfaces are not available through this interval-map response."] : []),
    ],
  };
}

export function isGammaHeatmapPayload(value: unknown): value is GammaHeatmapPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GammaHeatmapPayload>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.snapshots) && Array.isArray(candidate.levels);
}
