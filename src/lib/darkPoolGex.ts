import type { BounceExposureSlice, BounceLevelsSnapshot } from "./bounceLevels.ts";
import { deduplicateDarkPoolPrints, type DarkPoolMapPayload, type MappedDarkPoolPrint } from "./darkPoolMap.ts";

export const DARK_POOL_GEX_INDICATOR_ID = "dark-pool-gex";
export const DARK_POOL_GEX_WORKSPACE_TOOL_ID = "tool-dark-pool-gex";
export const DARK_POOL_GEX_SCHEMA_VERSION = 2;

export type DarkPoolGexContextMode = "current" | "event-time" | "historical-and-current";
export type DarkPoolGexDisplayMode = "raw" | "clusters" | "raw-and-clusters";
export type DarkPoolGexToleranceMode = "percentage" | "absolute" | "ticks";
export type DarkPoolGexConfluenceMode = "off" | "nearest" | "major" | "king" | "king-and-major" | "all-qualified";
export type DarkPoolGexQuality = "ultra" | "high" | "medium" | "low" | "auto";
export type DarkPoolGexLookbackMode = "calendar-days" | "trading-sessions";
export type DarkPoolGexSortMode = "notional" | "distance" | "freshness" | "reaction-quality";
export type DarkPoolGexViewPreset = "raw-dp-levels" | "dp-gex-intelligence";
export type DarkPoolGexInteractionResolution = "tick" | "1s" | "1m" | "3m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "chart";

export type DarkPoolGexSettings = {
  lookbackDays: number;
  lookbackMode: DarkPoolGexLookbackMode;
  topN: number;
  sortMode: DarkPoolGexSortMode;
  viewPreset: DarkPoolGexViewPreset;
  precisionMode: boolean;
  minimumNotional: number;
  maximumNotional: number;
  minimumShares: number;
  maximumShares: number;
  minimumSharePrice: number;
  maximumSharePrice: number;
  contextMode: DarkPoolGexContextMode;
  confluenceMode: DarkPoolGexConfluenceMode;
  toleranceMode: DarkPoolGexToleranceMode;
  tolerance: number;
  displayMode: DarkPoolGexDisplayMode;
  clusterEnabled: boolean;
  clusterDistanceMode: "percentage" | "absolute" | "ticks";
  clusterDistance: number;
  minimumClusterPrints: number;
  minimumClusterNotional: number;
  proxyMode: boolean;
  showOriginMarker: boolean;
  showForwardMemory: boolean;
  showExactLine: boolean;
  showLabels: boolean;
  labelExtended: boolean;
  showReactionMarkers: boolean;
  reactionAnalytics: boolean;
  showReactionResearch: boolean;
  minimumResearchSamples: number;
  interactionToleranceMode: "ticks" | "absolute" | "percentage";
  interactionTolerance: number;
  breakThresholdTicks: number;
  reactionThresholdTicks: number;
  reactionHorizonMs: number;
  firstTouchOnly: boolean;
  includeLateReports: boolean;
  includeCorrectedPrints: boolean;
  excludeCanceled: boolean;
  showTooltip: boolean;
  showInspector: boolean;
  showFreshness: boolean;
  ageFade: boolean;
  ageFadeHalfLifeDays: number;
  proximityEmphasis: boolean;
  proximityDistance: number;
  bandThickness: number;
  bandOpacity: number;
  originMarkerSize: number;
  haloIntensity: number;
  kingBoost: number;
  performanceQuality: DarkPoolGexQuality;
};

export const DEFAULT_DARK_POOL_GEX_SETTINGS: DarkPoolGexSettings = {
  lookbackDays: 30,
  lookbackMode: "calendar-days",
  topN: 5,
  sortMode: "notional",
  viewPreset: "raw-dp-levels",
  precisionMode: true,
  minimumNotional: 1_000_000,
  maximumNotional: 0,
  minimumShares: 0,
  maximumShares: 0,
  minimumSharePrice: 0,
  maximumSharePrice: 0,
  contextMode: "current",
  confluenceMode: "king-and-major",
  toleranceMode: "percentage",
  tolerance: 0.15,
  displayMode: "raw",
  clusterEnabled: false,
  clusterDistanceMode: "percentage",
  clusterDistance: 0.12,
  minimumClusterPrints: 2,
  minimumClusterNotional: 5_000_000,
  proxyMode: false,
  showOriginMarker: false,
  showForwardMemory: true,
  showExactLine: true,
  showLabels: true,
  labelExtended: false,
  showReactionMarkers: false,
  reactionAnalytics: true,
  showReactionResearch: false,
  minimumResearchSamples: 10,
  interactionToleranceMode: "ticks",
  interactionTolerance: 1,
  breakThresholdTicks: 2,
  reactionThresholdTicks: 4,
  reactionHorizonMs: 30 * 60_000,
  firstTouchOnly: false,
  includeLateReports: true,
  includeCorrectedPrints: true,
  excludeCanceled: true,
  showTooltip: true,
  showInspector: false,
  showFreshness: true,
  ageFade: false,
  ageFadeHalfLifeDays: 30,
  proximityEmphasis: true,
  proximityDistance: 0.15,
  bandThickness: 2,
  bandOpacity: 12,
  originMarkerSize: 7,
  haloIntensity: 20,
  kingBoost: 30,
  performanceQuality: "auto",
};

export type DarkPoolGexNode = {
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  percentOfKing: number;
  role: string;
  distance: number;
  distancePercent: number;
  gexStrength: number;
  distanceFactor: number;
  roleWeight: number;
  confluence: number;
  snapshotTimeMs: number;
};

export type DarkPoolGexEvent = {
  id: string;
  print: MappedDarkPoolPrint;
  price: number;
  sourcePrice: number;
  notional: number;
  shares: number;
  timestampMs: number;
  executionTimestampMs: number;
  reportTimestampMs: number | null;
  observableTimestampMs: number;
  rank: number;
  direction: "UNKNOWN";
  classification: "ATS_CONFIRMED" | "TRF_REPORTED" | "OFF_EXCHANGE_REPORTED";
  dataQualityBadges: Array<"VERIFIED" | "OFF_EXCHANGE" | "LATE_REPORT" | "CORRECTED" | "ADJUSTED" | "PARTIAL_METADATA" | "STALE">;
  quality: "live" | "delayed" | "historical";
  rawStrength: number;
  visualStrength: number;
  currentConfluence: DarkPoolGexNode | null;
  eventTimeConfluence: DarkPoolGexNode | null;
  primaryConfluence: DarkPoolGexNode | null;
  combinedImportance: number;
  ageDays: number;
  ageFade: number;
  reaction: DarkPoolGexReactionAnalytics | null;
};

export type DarkPoolGexPriceSample = {
  timestampMs: number;
  price?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  resolution?: DarkPoolGexInteractionResolution;
};

export type DarkPoolGexTouch = {
  timestampMs: number;
  observedPrice: number;
  touchError: number;
  touchErrorPercent: number;
  touchErrorTicks: number;
  approach: "FROM_ABOVE" | "FROM_BELOW" | "UNKNOWN";
  outcome: "HOLD" | "BREAK" | "RECLAIM" | "TOUCH";
  reaction: number;
  mfe: number;
  mae: number;
};

export type DarkPoolGexReactionAnalytics = {
  resolution: DarkPoolGexInteractionResolution;
  supportsTickClaim: boolean;
  touches: DarkPoolGexTouch[];
  touchCount: number;
  holds: number;
  breaks: number;
  reclaims: number;
  latestOutcome: DarkPoolGexTouch["outcome"] | "NONE";
  medianTouchError: number | null;
  medianTouchErrorTicks: number | null;
  medianReaction: number | null;
  medianMfe: number | null;
  medianMae: number | null;
};

export type DarkPoolGexResearchSummary = {
  levelCount: number;
  sampleCount: number;
  touchCount: number;
  medianTouchError: number | null;
  medianTouchErrorTicks: number | null;
  holdRate: number | null;
  breakRate: number | null;
  reclaimRate: number | null;
  medianReaction: number | null;
  medianMfe: number | null;
  medianMae: number | null;
  billionPlus: { levels: number; touches: number };
  freshFirstTouch: { levels: number; touches: number };
  withKing: { levels: number; touches: number };
  withoutGex: { levels: number; touches: number };
  sufficientSample: boolean;
  disclosures: {
    touchTolerance: string;
    breakThreshold: string;
    reactionThreshold: string;
    postTouchHorizonMs: number;
    resolution: DarkPoolGexInteractionResolution | "unavailable";
    sessionFilter: "all available observations";
  };
};

export type DarkPoolGexCluster = {
  id: string;
  events: DarkPoolGexEvent[];
  weightedPrice: number;
  totalNotional: number;
  totalShares: number;
  firstTimestampMs: number;
  lastTimestampMs: number;
  visualStrength: number;
  primaryConfluence: DarkPoolGexNode | null;
};

export type DarkPoolGexFrame = {
  schemaVersion: 2;
  sourceTicker: string;
  displayInstrument: string;
  generatedAtMs: number;
  status: "LIVE" | "MARKET_CLOSED" | "DELAYED" | "HISTORICAL" | "STALE" | "NO_OFF_EXCHANGE_DATA" | "NO_GEX_DATA" | "PROXY_MODE";
  rawEvents: DarkPoolGexEvent[];
  eligibleEventCount: number;
  clusters: DarkPoolGexCluster[];
  gexSnapshotTimeMs: number | null;
  tickSize: number;
  lookbackMode: DarkPoolGexLookbackMode;
  interactionResolution: DarkPoolGexInteractionResolution | null;
  lastValidSnapshotMs: number;
  settings: DarkPoolGexSettings;
  limitations: string[];
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function observableTimestamp(print: MappedDarkPoolPrint) {
  return print.observableTimestampMs ?? print.reportTimestampMs ?? print.executionTimestampMs ?? print.tradeTimeMs;
}

function executionTimestamp(print: MappedDarkPoolPrint) {
  return print.executionTimestampMs ?? print.tradeTimeMs;
}

function validatedClassification(print: MappedDarkPoolPrint): DarkPoolGexEvent["classification"] | null {
  if (print.offExchangeClassification === "ATS_CONFIRMED") return "ATS_CONFIRMED";
  if (print.offExchangeClassification === "TRF_REPORTED") return "TRF_REPORTED";
  if (print.offExchangeClassification === "OFF_EXCHANGE_REPORTED" || print.printType === "DARK_POOL") return "OFF_EXCHANGE_REPORTED";
  return null;
}

function lookbackStartMs(asOfMs: number, days: number, mode: DarkPoolGexLookbackMode) {
  if (mode === "calendar-days") return asOfMs - Math.max(1, days) * 86_400_000;
  const cursor = new Date(asOfMs);
  let remaining = Math.max(1, Math.round(days));
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return cursor.getTime();
}

function interactionTolerance(price: number, tickSize: number, settings: DarkPoolGexSettings) {
  if (settings.interactionToleranceMode === "absolute") return Math.max(0, settings.interactionTolerance);
  if (settings.interactionToleranceMode === "percentage") return Math.max(0, price * settings.interactionTolerance / 100);
  return Math.max(0, settings.interactionTolerance * tickSize);
}

function samplePrice(sample: DarkPoolGexPriceSample) {
  return sample.price ?? sample.close ?? sample.open ?? sample.high ?? sample.low ?? null;
}

function sampleDistance(sample: DarkPoolGexPriceSample, level: number) {
  const high = sample.high;
  const low = sample.low;
  if (typeof high === "number" && typeof low === "number") {
    if (level >= low && level <= high) return { distance: 0, observed: level };
    if (level > high) return { distance: level - high, observed: high };
    return { distance: low - level, observed: low };
  }
  const price = samplePrice(sample);
  return price === null ? { distance: Number.POSITIVE_INFINITY, observed: level } : { distance: Math.abs(price - level), observed: price };
}

export function calculateDarkPoolGexReaction(
  levelPrice: number,
  observableAtMs: number,
  samplesInput: DarkPoolGexPriceSample[],
  tickSize: number,
  settingsInput: Partial<DarkPoolGexSettings> = {},
  asOfMs = Date.now(),
): DarkPoolGexReactionAnalytics | null {
  const settings = { ...DEFAULT_DARK_POOL_GEX_SETTINGS, ...settingsInput };
  const samples = samplesInput
    .filter((sample) => sample.timestampMs >= observableAtMs && sample.timestampMs <= asOfMs && samplePrice(sample) !== null)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  if (!samples.length) return null;
  const resolution = samples.find((sample) => sample.resolution)?.resolution ?? "chart";
  const tolerance = interactionTolerance(levelPrice, tickSize, settings);
  const breakDistance = Math.max(tickSize, settings.breakThresholdTicks * tickSize);
  const reactionDistance = Math.max(tickSize, settings.reactionThresholdTicks * tickSize);
  const touches: DarkPoolGexTouch[] = [];
  let inside = false;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const exact = sampleDistance(sample, levelPrice);
    const qualifies = exact.distance <= tolerance + 1e-12;
    if (!qualifies) { inside = false; continue; }
    if (inside) continue;
    inside = true;
    const previous = index > 0 ? samplePrice(samples[index - 1]) : null;
    const approach = previous === null ? "UNKNOWN" : previous > levelPrice ? "FROM_ABOVE" : previous < levelPrice ? "FROM_BELOW" : "UNKNOWN";
    const horizonEnd = sample.timestampMs + Math.max(1_000, settings.reactionHorizonMs);
    const future = samples.slice(index + 1).filter((candidate) => candidate.timestampMs <= horizonEnd);
    const futurePrices = future.map(samplePrice).filter((price): price is number => price !== null);
    const max = futurePrices.length ? Math.max(...futurePrices) : exact.observed;
    const min = futurePrices.length ? Math.min(...futurePrices) : exact.observed;
    const bullish = approach === "FROM_ABOVE";
    const bearish = approach === "FROM_BELOW";
    const mfe = bullish ? Math.max(0, max - levelPrice) : bearish ? Math.max(0, levelPrice - min) : Math.max(Math.abs(max - levelPrice), Math.abs(min - levelPrice));
    const mae = bullish ? Math.max(0, levelPrice - min) : bearish ? Math.max(0, max - levelPrice) : Math.min(Math.abs(max - levelPrice), Math.abs(min - levelPrice));
    const broke = bullish ? min < levelPrice - breakDistance : bearish ? max > levelPrice + breakDistance : min < levelPrice - breakDistance || max > levelPrice + breakDistance;
    const reclaimed = broke && futurePrices.some((price) => bullish ? price >= levelPrice : bearish ? price <= levelPrice : Math.abs(price - levelPrice) <= tolerance);
    const held = !broke && mfe >= reactionDistance;
    touches.push({
      timestampMs: sample.timestampMs,
      observedPrice: exact.observed,
      touchError: exact.distance,
      touchErrorPercent: 100 * exact.distance / Math.max(1e-12, levelPrice),
      touchErrorTicks: exact.distance / Math.max(1e-12, tickSize),
      approach,
      outcome: reclaimed ? "RECLAIM" : broke ? "BREAK" : held ? "HOLD" : "TOUCH",
      reaction: bullish ? max - levelPrice : bearish ? levelPrice - min : Math.max(Math.abs(max - levelPrice), Math.abs(min - levelPrice)),
      mfe,
      mae,
    });
    if (settings.firstTouchOnly) break;
  }
  return {
    resolution,
    supportsTickClaim: resolution === "tick",
    touches,
    touchCount: touches.length,
    holds: touches.filter((touch) => touch.outcome === "HOLD").length,
    breaks: touches.filter((touch) => touch.outcome === "BREAK").length,
    reclaims: touches.filter((touch) => touch.outcome === "RECLAIM").length,
    latestOutcome: touches.at(-1)?.outcome ?? "NONE",
    medianTouchError: median(touches.map((touch) => touch.touchError)),
    medianTouchErrorTicks: median(touches.map((touch) => touch.touchErrorTicks)),
    medianReaction: median(touches.map((touch) => touch.reaction)),
    medianMfe: median(touches.map((touch) => touch.mfe)),
    medianMae: median(touches.map((touch) => touch.mae)),
  };
}

export function summarizeDarkPoolGexResearch(frame: DarkPoolGexFrame): DarkPoolGexResearchSummary {
  const reactions = frame.rawEvents.map((event) => event.reaction).filter((reaction): reaction is DarkPoolGexReactionAnalytics => reaction !== null);
  const touches = reactions.flatMap((reaction) => reaction.touches);
  const touchDenominator = Math.max(1, touches.length);
  const subset = (predicate: (event: DarkPoolGexEvent) => boolean) => {
    const events = frame.rawEvents.filter(predicate);
    return { levels: events.length, touches: events.reduce((sum, event) => sum + (event.reaction?.touchCount ?? 0), 0) };
  };
  return {
    levelCount: frame.rawEvents.length,
    sampleCount: reactions.length,
    touchCount: touches.length,
    medianTouchError: median(touches.map((touch) => touch.touchError)),
    medianTouchErrorTicks: median(touches.map((touch) => touch.touchErrorTicks)),
    holdRate: touches.length ? touches.filter((touch) => touch.outcome === "HOLD").length / touchDenominator : null,
    breakRate: touches.length ? touches.filter((touch) => touch.outcome === "BREAK").length / touchDenominator : null,
    reclaimRate: touches.length ? touches.filter((touch) => touch.outcome === "RECLAIM").length / touchDenominator : null,
    medianReaction: median(touches.map((touch) => touch.reaction)),
    medianMfe: median(touches.map((touch) => touch.mfe)),
    medianMae: median(touches.map((touch) => touch.mae)),
    billionPlus: subset((event) => event.notional >= 1_000_000_000),
    freshFirstTouch: subset((event) => (event.reaction?.touchCount ?? 0) === 1),
    withKing: subset((event) => event.primaryConfluence?.role === "KING"),
    withoutGex: subset((event) => event.primaryConfluence === null),
    sufficientSample: touches.length >= frame.settings.minimumResearchSamples,
    disclosures: {
      touchTolerance: `${frame.settings.interactionTolerance} ${frame.settings.interactionToleranceMode}`,
      breakThreshold: `${frame.settings.breakThresholdTicks} ticks`,
      reactionThreshold: `${frame.settings.reactionThresholdTicks} ticks`,
      postTouchHorizonMs: frame.settings.reactionHorizonMs,
      resolution: reactions[0]?.resolution ?? frame.interactionResolution ?? "unavailable",
      sessionFilter: "all available observations",
    },
  };
}

export function resolveDarkPoolGexCoordinate(price: number, transform: (value: number) => number | null, devicePixelRatio = 1) {
  const media = transform(price);
  return media === null ? null : { media, bitmap: media * Math.max(1, devicePixelRatio) };
}

export function formatDarkPoolNotional(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(absolute >= 10_000_000_000 ? 1 : 2).replace(/\.0+$/, "")}B`;
  if (absolute >= 1_000_000) return `$${(value / 1_000_000).toFixed(absolute >= 100_000_000 ? 1 : 2).replace(/\.0+$/, "")}M`;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function isUsEquityMarketOpen(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestampMs));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (value.weekday === "Sat" || value.weekday === "Sun") return false;
  const minutes = Number(value.hour) * 60 + Number(value.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

function roleWeight(role: string) {
  if (role === "KING") return 1;
  if (role === "GATEKEEPER") return 0.9;
  if (role === "FLOOR" || role === "CEILING") return 0.85;
  if (role === "MAJOR") return 0.75;
  return 0.6;
}

function toleranceAt(price: number, tickSize: number, settings: DarkPoolGexSettings) {
  if (settings.toleranceMode === "absolute") return Math.max(1e-9, settings.tolerance);
  if (settings.toleranceMode === "ticks") return Math.max(1e-9, settings.tolerance * tickSize);
  return Math.max(1e-9, price * settings.tolerance / 100);
}

function confluenceAllowed(node: { role: string }, mode: DarkPoolGexConfluenceMode) {
  if (mode === "off") return false;
  if (mode === "nearest" || mode === "all-qualified") return true;
  if (mode === "king") return node.role === "KING";
  if (mode === "major") return ["MAJOR", "GATEKEEPER", "FLOOR", "CEILING"].includes(node.role);
  return node.role === "KING" || ["MAJOR", "GATEKEEPER", "FLOOR", "CEILING"].includes(node.role);
}

type DarkPoolGexConfluenceCandidate = {
  sourceStrike: number;
  mappedPrice: number;
  signedExposure: number;
  absoluteExposure: number;
  role?: string;
  percentOfKing?: number;
  percentOfKingAbsolute?: number;
  snapshotTimeMs?: number;
  timestamp?: number;
};

function makeConfluence(
  price: number,
  nodes: DarkPoolGexConfluenceCandidate[],
  tickSize: number,
  settings: DarkPoolGexSettings,
) {
  if (settings.confluenceMode === "off" || !nodes.length) return null;
  const kingMagnitude = Math.max(...nodes.map((node) => Math.abs(node.signedExposure)), 0);
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    // The restored Bounce exposure field predates per-slice role labels. Preserve
    // current-level roles and derive the historical KING/MAJOR role from raw size.
    role: node.role ?? (Math.abs(node.signedExposure) === kingMagnitude ? "KING" : "MAJOR"),
  }));
  const nearest = normalizedNodes
    .filter((node) => confluenceAllowed(node, settings.confluenceMode))
    .map((node) => ({ node, distance: Math.abs(node.mappedPrice - price) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) return null;
  const tolerance = toleranceAt(price, tickSize, settings);
  if (nearest.distance > tolerance) return null;
  const magnitude = Math.abs(nearest.node.signedExposure);
  const gexStrength = kingMagnitude > 0 ? clamp01(magnitude / kingMagnitude) : 0;
  const distanceFactor = clamp01(1 - nearest.distance / tolerance);
  const weight = roleWeight(nearest.node.role);
  return {
    sourceStrike: nearest.node.sourceStrike,
    mappedPrice: nearest.node.mappedPrice,
    signedExposure: nearest.node.signedExposure,
    absoluteExposure: magnitude,
    percentOfKing: (nearest.node.percentOfKing ?? ((nearest.node.percentOfKingAbsolute ?? gexStrength) * 100)),
    role: nearest.node.role,
    distance: nearest.distance,
    distancePercent: nearest.distance / Math.max(1e-9, price) * 100,
    gexStrength,
    distanceFactor,
    roleWeight: weight,
    confluence: clamp01(0.60 * gexStrength + 0.25 * distanceFactor + 0.15 * weight),
    snapshotTimeMs: nearest.node.snapshotTimeMs ?? nearest.node.timestamp ?? 0,
  } satisfies DarkPoolGexNode;
}

function latestSliceAt(slices: BounceExposureSlice[], timestampMs: number) {
  let match: BounceExposureSlice | null = null;
  for (const slice of slices) {
    if (slice.timestamp <= timestampMs && (!match || slice.timestamp > match.timestamp)) match = slice;
  }
  return match;
}

function clusterThreshold(price: number, tickSize: number, settings: DarkPoolGexSettings) {
  if (settings.clusterDistanceMode === "absolute") return Math.max(1e-9, settings.clusterDistance);
  if (settings.clusterDistanceMode === "ticks") return Math.max(1e-9, settings.clusterDistance * tickSize);
  return Math.max(1e-9, price * settings.clusterDistance / 100);
}

function buildClusters(events: DarkPoolGexEvent[], tickSize: number, settings: DarkPoolGexSettings) {
  if (!settings.clusterEnabled) return [];
  const sorted = [...events].sort((a, b) => a.price - b.price);
  const groups: DarkPoolGexEvent[][] = [];
  for (const event of sorted) {
    const group = groups.at(-1);
    const weighted = group
      ? group.reduce((sum, item) => sum + item.price * item.notional, 0) / Math.max(1, group.reduce((sum, item) => sum + item.notional, 0))
      : event.price;
    if (group && Math.abs(event.price - weighted) <= clusterThreshold(weighted, tickSize, settings)) group.push(event);
    else groups.push([event]);
  }
  const maximumNotional = Math.max(...groups.map((group) => group.reduce((sum, event) => sum + event.notional, 0)), 1);
  return groups.flatMap((group, index): DarkPoolGexCluster[] => {
    const totalNotional = group.reduce((sum, event) => sum + event.notional, 0);
    if (group.length < settings.minimumClusterPrints || totalNotional < settings.minimumClusterNotional) return [];
    return [{
      id: `dark-pool-gex-cluster:${index}:${group.map((event) => event.id).join("|")}`,
      events: group,
      weightedPrice: group.reduce((sum, event) => sum + event.price * event.notional, 0) / totalNotional,
      totalNotional,
      totalShares: group.reduce((sum, event) => sum + event.shares, 0),
      firstTimestampMs: Math.min(...group.map((event) => event.timestampMs)),
      lastTimestampMs: Math.max(...group.map((event) => event.timestampMs)),
      visualStrength: Math.sqrt(clamp01(totalNotional / maximumNotional)),
      primaryConfluence: [...group].sort((a, b) => b.combinedImportance - a.combinedImportance)[0]?.primaryConfluence ?? null,
    }];
  });
}

export function buildDarkPoolGexFrame(input: {
  darkPool: DarkPoolMapPayload;
  gex: BounceLevelsSnapshot | null;
  settings?: Partial<DarkPoolGexSettings>;
  asOfMs?: number;
  tickSize?: number;
  priceSamples?: DarkPoolGexPriceSample[];
}) {
  const settings = { ...DEFAULT_DARK_POOL_GEX_SETTINGS, ...(input.settings ?? {}) };
  const nowMs = input.asOfMs ?? Date.now();
  const tickSize = Math.max(1e-9, input.tickSize ?? 0.01);
  const lookbackStart = lookbackStartMs(nowMs, settings.lookbackDays, settings.lookbackMode);
  const eligible = deduplicateDarkPoolPrints(input.darkPool.prints)
    .filter((print) => observableTimestamp(print) <= nowMs && observableTimestamp(print) >= lookbackStart)
    .filter((print) => validatedClassification(print) !== null)
    .filter((print) => !settings.excludeCanceled || print.cancellationState !== "CANCELED")
    .filter((print) => settings.includeCorrectedPrints || print.correctionState !== "CORRECTED")
    .filter((print) => settings.includeLateReports || !print.isDelayedPrint)
    .filter((print) => print.notionalValue >= settings.minimumNotional)
    .filter((print) => !settings.maximumNotional || print.notionalValue <= settings.maximumNotional)
    .filter((print) => print.size >= settings.minimumShares)
    .filter((print) => !settings.maximumShares || print.size <= settings.maximumShares)
    .filter((print) => print.price >= settings.minimumSharePrice)
    .filter((print) => !settings.maximumSharePrice || print.price <= settings.maximumSharePrice);
  const maximumNotional = Math.max(...eligible.map((print) => print.notionalValue), 1);
  const currentGexIsObservable = Boolean(input.gex && input.gex.snapshotTimeMs <= nowMs);
  const eventsUnranked = eligible.map((print): Omit<DarkPoolGexEvent, "rank"> => {
    const exactPrice = input.darkPool.direct ? (print.adjustedChartPrice ?? print.price) : print.mappedPrice;
    const observedAt = observableTimestamp(print);
    const executedAt = executionTimestamp(print);
    const current = input.gex && currentGexIsObservable ? makeConfluence(exactPrice, input.gex.levels, tickSize, settings) : null;
    const eventSlice = input.gex ? latestSliceAt(input.gex.exposureField, observedAt) : null;
    const eventTime = eventSlice ? makeConfluence(exactPrice, eventSlice.nodes, tickSize, settings) : null;
    const primary = settings.contextMode === "event-time" ? eventTime : current;
    const rawStrength = clamp01(print.notionalValue / maximumNotional);
    const visualStrength = Math.sqrt(rawStrength);
    const combinedImportance = clamp01(0.65 * visualStrength + 0.35 * (primary?.confluence ?? 0));
    const ageDays = Math.max(0, nowMs - observedAt) / 86_400_000;
    const classification = validatedClassification(print) ?? "OFF_EXCHANGE_REPORTED";
    const dataQualityBadges: DarkPoolGexEvent["dataQualityBadges"] = ["VERIFIED", "OFF_EXCHANGE"];
    if (print.isDelayedPrint || (print.reportTimestampMs && print.reportTimestampMs > executedAt)) dataQualityBadges.push("LATE_REPORT");
    if (print.correctionState === "CORRECTED") dataQualityBadges.push("CORRECTED");
    if ((print.corporateActionAdjustmentFactor ?? 1) !== 1) dataQualityBadges.push("ADJUSTED");
    if (!print.reportTimestampMs || !print.venue) dataQualityBadges.push("PARTIAL_METADATA");
    if (input.darkPool.status !== "LIVE") dataQualityBadges.push("STALE");
    return {
      id: `dark-pool-gex:${print.id}`,
      print,
      price: exactPrice,
      sourcePrice: print.price,
      notional: print.notionalValue,
      shares: print.size,
      timestampMs: observedAt,
      executionTimestampMs: executedAt,
      reportTimestampMs: print.reportTimestampMs ?? null,
      observableTimestampMs: observedAt,
      direction: "UNKNOWN",
      classification,
      dataQualityBadges,
      quality: print.isDelayedPrint ? "delayed" : nowMs - print.tradeTimeMs <= 15 * 60_000 ? "live" : "historical",
      rawStrength,
      visualStrength,
      currentConfluence: current,
      eventTimeConfluence: eventTime,
      primaryConfluence: primary,
      combinedImportance,
      ageDays,
      ageFade: settings.ageFade ? Math.exp(-ageDays / Math.max(0.25, settings.ageFadeHalfLifeDays)) : 1,
      reaction: settings.reactionAnalytics
        ? calculateDarkPoolGexReaction(exactPrice, observedAt, input.priceSamples ?? [], tickSize, settings, nowMs)
        : null,
    };
  });
  // Raw Top-N is always chosen by raw individual print notional. Inspector
  // sorting is a presentation concern and cannot change membership.
  const topEvents = [...eventsUnranked]
    .sort((a, b) => b.notional - a.notional || a.observableTimestampMs - b.observableTimestampMs)
    .slice(0, Math.max(1, settings.topN))
    .map((event, index): DarkPoolGexEvent => ({ ...event, rank: index + 1 }));
  const clusters = buildClusters(eventsUnranked.map((event, index) => ({ ...event, rank: index + 1 })), tickSize, settings);
  const proxy = !input.darkPool.direct;
  const marketClosed = !isUsEquityMarketOpen(nowMs);
  const status: DarkPoolGexFrame["status"] = !eventsUnranked.length
    ? "NO_OFF_EXCHANGE_DATA"
    : proxy
      ? "PROXY_MODE"
      : marketClosed
        ? "MARKET_CLOSED"
        : !input.gex
          ? "NO_GEX_DATA"
        : input.darkPool.status === "LIVE"
          ? "LIVE"
          : input.darkPool.status === "DELAYED" || input.darkPool.status === "CACHED"
            ? "DELAYED"
            : input.darkPool.status === "UNAVAILABLE" || input.darkPool.status === "RATE_LIMITED"
              ? "STALE"
              : "HISTORICAL";
  return {
    schemaVersion: DARK_POOL_GEX_SCHEMA_VERSION,
    sourceTicker: input.darkPool.sourceTicker,
    displayInstrument: input.darkPool.displayInstrument,
    generatedAtMs: nowMs,
    status,
    rawEvents: topEvents,
    eligibleEventCount: eventsUnranked.length,
    clusters,
    gexSnapshotTimeMs: currentGexIsObservable ? input.gex?.snapshotTimeMs ?? null : null,
    tickSize,
    lookbackMode: settings.lookbackMode,
    interactionResolution: topEvents.find((event) => event.reaction)?.reaction?.resolution ?? null,
    lastValidSnapshotMs: input.darkPool.checkedAtMs,
    settings,
    limitations: [
      "QuantData's endpoint validates off-exchange reported prints. A specific ATS is identified only when venue metadata is supplied; otherwise ATS identity is not claimed.",
      "Dark-pool transactions are directionless unless a validated provider side field exists; this indicator always reports Direction: Unknown.",
      "Gamma sign is separate options-positioning context and never assigns a buy or sell side to a dark-pool print.",
      ...(marketClosed ? ["MARKET CLOSED · LAST VALID SNAPSHOT. Price and reaction state remain frozen until new valid observations arrive."] : []),
      ...(!input.priceSamples?.length ? ["Reaction analytics require timestamped price observations. No touch precision is inferred from missing price history."] : []),
      ...input.darkPool.limitations,
    ],
  } satisfies DarkPoolGexFrame;
}

export function isDarkPoolGexFrame(value: unknown): value is DarkPoolGexFrame {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const frame = value as Partial<DarkPoolGexFrame>;
  return frame.schemaVersion === 2 && Array.isArray(frame.rawEvents) && Array.isArray(frame.clusters);
}
