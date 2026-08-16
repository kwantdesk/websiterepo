import type { BounceExposureSlice, BounceLevelsSnapshot } from "./bounceLevels.ts";
import { deduplicateDarkPoolPrints, type DarkPoolMapPayload, type MappedDarkPoolPrint } from "./darkPoolMap.ts";
import {
  calculateDarkPoolReactionAnalytics,
  type DarkPoolBreakConfirmation,
  type DarkPoolDistanceMode,
  type DarkPoolInteraction,
  type DarkPoolReactionAnalytics,
  type DarkPoolReactionGexContext,
  type DarkPoolReactionPriceSample,
  type DarkPoolReactionResolution,
  type DarkPoolReactionSession,
} from "./darkPoolReactionAnalytics.ts";

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
export type DarkPoolGexInteractionResolution = DarkPoolReactionResolution;

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
  showHoldMarkers: boolean;
  showBreakMarkers: boolean;
  showReclaimMarkers: boolean;
  showReactionTrail: boolean;
  showInteractionZone: boolean;
  reactionAnalytics: boolean;
  showReactionResearch: boolean;
  minimumResearchSamples: number;
  interactionToleranceMode: DarkPoolDistanceMode;
  interactionTolerance: number;
  resetDistanceMode: DarkPoolDistanceMode;
  resetDistance: number;
  minimumTimeOutsideMs: number;
  useIntrabarHighLow: boolean;
  interactionSession: DarkPoolReactionSession;
  reactionThresholdMode: DarkPoolDistanceMode;
  reactionThreshold: number;
  maximumConfirmationBars: number;
  requireCloseAwayFromLevel: boolean;
  minimumReactionDurationMs: number;
  breakDistanceMode: DarkPoolDistanceMode;
  breakDistance: number;
  breakConfirmation: DarkPoolBreakConfirmation;
  breakTimeBeyondMs: number;
  useVolumeConfirmation: boolean;
  volumeThreshold: number;
  enableReclaimDetection: boolean;
  reclaimConfirmationCloses: number;
  minimumTimeBeyondBeforeReclaimMs: number;
  reactionHorizonBars: number;
  reactionHorizonMs: number;
  minimumStatsSamples: number;
  activationRadiusPercent: number;
  qualityPrecisionWeight: number;
  qualityExcursionWeight: number;
  qualityEfficiencyWeight: number;
  qualitySpeedWeight: number;
  qualityFreshnessWeight: number;
  qualityGexWeight: number;
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
  showReactionMarkers: true,
  showHoldMarkers: true,
  showBreakMarkers: true,
  showReclaimMarkers: true,
  showReactionTrail: false,
  showInteractionZone: false,
  reactionAnalytics: true,
  showReactionResearch: false,
  minimumResearchSamples: 3,
  interactionToleranceMode: "percentage",
  interactionTolerance: 0.03,
  resetDistanceMode: "percentage",
  resetDistance: 0.1,
  minimumTimeOutsideMs: 0,
  useIntrabarHighLow: true,
  interactionSession: "regular-hours",
  reactionThresholdMode: "percentage",
  reactionThreshold: 0.1,
  maximumConfirmationBars: 20,
  requireCloseAwayFromLevel: false,
  minimumReactionDurationMs: 0,
  breakDistanceMode: "ticks",
  breakDistance: 2,
  breakConfirmation: "1-close",
  breakTimeBeyondMs: 60_000,
  useVolumeConfirmation: false,
  volumeThreshold: 0,
  enableReclaimDetection: true,
  reclaimConfirmationCloses: 1,
  minimumTimeBeyondBeforeReclaimMs: 0,
  reactionHorizonBars: 20,
  reactionHorizonMs: 30 * 60_000,
  minimumStatsSamples: 3,
  activationRadiusPercent: 2,
  qualityPrecisionWeight: 20,
  qualityExcursionWeight: 25,
  qualityEfficiencyWeight: 20,
  qualitySpeedWeight: 15,
  qualityFreshnessWeight: 10,
  qualityGexWeight: 10,
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

export type DarkPoolGexPriceSample = DarkPoolReactionPriceSample;
export type DarkPoolGexTouch = DarkPoolInteraction;
export type DarkPoolGexReactionAnalytics = DarkPoolReactionAnalytics;

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

export function calculateDarkPoolGexReaction(
  levelPrice: number,
  observableAtMs: number,
  samplesInput: DarkPoolGexPriceSample[],
  tickSize: number,
  settingsInput: Partial<DarkPoolGexSettings> = {},
  asOfMs = Date.now(),
): DarkPoolGexReactionAnalytics | null {
  const settings = { ...DEFAULT_DARK_POOL_GEX_SETTINGS, ...settingsInput };
  return calculateDarkPoolReactionAnalytics({
    darkPoolPrintId: "standalone",
    levelPrice,
    observableAtMs,
    samples: samplesInput,
    tickSize,
    settings,
    asOfMs,
  });
}

export function summarizeDarkPoolGexResearch(frame: DarkPoolGexFrame): DarkPoolGexResearchSummary {
  const reactions = frame.rawEvents.map((event) => event.reaction).filter((reaction): reaction is DarkPoolGexReactionAnalytics => reaction !== null);
  const touches = reactions.flatMap((reaction) => reaction.touches);
  const touchDenominator = Math.max(1, touches.length);
  const sufficientSample = touches.length >= frame.settings.minimumResearchSamples;
  const totalHolds = reactions.reduce((sum, reaction) => sum + reaction.holdCount, 0);
  const totalBreaks = reactions.reduce((sum, reaction) => sum + reaction.breakCount, 0);
  const totalReclaims = reactions.reduce((sum, reaction) => sum + reaction.reclaimCount, 0);
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
    holdRate: sufficientSample ? totalHolds / touchDenominator : null,
    breakRate: sufficientSample ? totalBreaks / touchDenominator : null,
    reclaimRate: sufficientSample ? totalReclaims / touchDenominator : null,
    medianReaction: median(touches.map((touch) => touch.reaction)),
    medianMfe: median(touches.map((touch) => touch.mfe)),
    medianMae: median(touches.map((touch) => touch.mae)),
    billionPlus: subset((event) => event.notional >= 1_000_000_000),
    freshFirstTouch: subset((event) => (event.reaction?.touchCount ?? 0) === 1),
    withKing: subset((event) => event.primaryConfluence?.role === "KING"),
    withoutGex: subset((event) => event.primaryConfluence === null),
    sufficientSample,
    disclosures: {
      touchTolerance: `${frame.settings.interactionTolerance} ${frame.settings.interactionToleranceMode}`,
      breakThreshold: `${frame.settings.breakDistance} ${frame.settings.breakDistanceMode} · ${frame.settings.breakConfirmation}`,
      reactionThreshold: `${frame.settings.reactionThreshold} ${frame.settings.reactionThresholdMode}`,
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

function reactionGexContext(
  price: number,
  nodes: DarkPoolGexConfluenceCandidate[],
  tickSize: number,
  settings: DarkPoolGexSettings,
): DarkPoolReactionGexContext | undefined {
  if (!nodes.length) return undefined;
  const confluence = makeConfluence(price, nodes, tickSize, settings);
  const king = [...nodes].sort((left, right) => Math.abs(right.signedExposure) - Math.abs(left.signedExposure))[0] ?? null;
  return {
    nearestNodePrice: confluence?.mappedPrice ?? null,
    nearestNodeRole: confluence?.role ?? null,
    signedExposure: confluence?.signedExposure ?? null,
    absoluteExposure: confluence?.absoluteExposure ?? null,
    percentOfKing: confluence?.percentOfKing ?? null,
    distanceToNode: confluence?.distance ?? null,
    distanceToNodePct: confluence?.distancePercent ?? null,
    kingPrice: king?.mappedPrice ?? null,
    kingDistancePct: king ? Math.abs(king.mappedPrice - price) / Math.max(1e-9, price) * 100 : null,
    dataTimestampMs: confluence?.snapshotTimeMs ?? king?.snapshotTimeMs ?? king?.timestamp ?? null,
  };
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

type ReactionCacheEntry = {
  sampleCount: number;
  firstTimestampMs: number | null;
  lastTimestampMs: number | null;
  analytics: DarkPoolReactionAnalytics | null;
};

const reactionAnalyticsCache = new Map<string, ReactionCacheEntry>();

function trimReactionAnalyticsCache() {
  if (reactionAnalyticsCache.size <= 2_000) return;
  const removeCount = reactionAnalyticsCache.size - 1_500;
  for (const key of reactionAnalyticsCache.keys()) {
    reactionAnalyticsCache.delete(key);
    if (reactionAnalyticsCache.size <= 2_000 - removeCount) break;
  }
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
  const priceSamples = (input.priceSamples ?? []).filter((sample) => sample.timestampMs <= nowMs);
  const latestPriceSample = priceSamples.at(-1);
  const currentPrice = latestPriceSample?.price ?? latestPriceSample?.close ?? latestPriceSample?.open ?? null;
  const settingsCacheKey = JSON.stringify({
    interactionToleranceMode: settings.interactionToleranceMode,
    interactionTolerance: settings.interactionTolerance,
    resetDistanceMode: settings.resetDistanceMode,
    resetDistance: settings.resetDistance,
    minimumTimeOutsideMs: settings.minimumTimeOutsideMs,
    useIntrabarHighLow: settings.useIntrabarHighLow,
    interactionSession: settings.interactionSession,
    reactionThresholdMode: settings.reactionThresholdMode,
    reactionThreshold: settings.reactionThreshold,
    maximumConfirmationBars: settings.maximumConfirmationBars,
    requireCloseAwayFromLevel: settings.requireCloseAwayFromLevel,
    minimumReactionDurationMs: settings.minimumReactionDurationMs,
    breakDistanceMode: settings.breakDistanceMode,
    breakDistance: settings.breakDistance,
    breakConfirmation: settings.breakConfirmation,
    breakTimeBeyondMs: settings.breakTimeBeyondMs,
    useVolumeConfirmation: settings.useVolumeConfirmation,
    volumeThreshold: settings.volumeThreshold,
    enableReclaimDetection: settings.enableReclaimDetection,
    reclaimConfirmationCloses: settings.reclaimConfirmationCloses,
    minimumTimeBeyondBeforeReclaimMs: settings.minimumTimeBeyondBeforeReclaimMs,
    reactionHorizonBars: settings.reactionHorizonBars,
    reactionHorizonMs: settings.reactionHorizonMs,
    minimumStatsSamples: settings.minimumStatsSamples,
    firstTouchOnly: settings.firstTouchOnly,
    qualityPrecisionWeight: settings.qualityPrecisionWeight,
    qualityExcursionWeight: settings.qualityExcursionWeight,
    qualityEfficiencyWeight: settings.qualityEfficiencyWeight,
    qualitySpeedWeight: settings.qualitySpeedWeight,
    qualityFreshnessWeight: settings.qualityFreshnessWeight,
    qualityGexWeight: settings.qualityGexWeight,
  });
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
      reaction: null,
    };
  });
  // Raw Top-N is always chosen by raw individual print notional. Inspector
  // sorting is a presentation concern and cannot change membership.
  const topEvents = [...eventsUnranked]
    .sort((a, b) => b.notional - a.notional || a.observableTimestampMs - b.observableTimestampMs)
    .slice(0, Math.max(1, settings.topN))
    .map((event, index): DarkPoolGexEvent => {
      if (!settings.reactionAnalytics) return { ...event, rank: index + 1 };
      const latestLow = latestPriceSample?.low ?? currentPrice;
      const latestHigh = latestPriceSample?.high ?? currentPrice;
      const activationDistance = event.price * Math.max(0.001, settings.activationRadiusPercent) / 100;
      const withinActivationRadius = currentPrice !== null && (
        Math.abs(currentPrice - event.price) <= activationDistance
        || (latestLow !== null && latestHigh !== null && event.price >= latestLow - activationDistance && event.price <= latestHigh + activationDistance)
      );
      const cacheKey = `${event.id}:${event.price}:${tickSize}:${input.gex?.snapshotTimeMs ?? 0}:${settingsCacheKey}`;
      const cached = reactionAnalyticsCache.get(cacheKey);
      const cacheMatches = cached
        && cached.sampleCount === priceSamples.length
        && cached.firstTimestampMs === (priceSamples[0]?.timestampMs ?? null)
        && cached.lastTimestampMs === (latestPriceSample?.timestampMs ?? null);
      let reaction = settings.contextMode === "current" && !withinActivationRadius && cacheMatches
        ? cached.analytics
        : calculateDarkPoolReactionAnalytics({
            darkPoolPrintId: event.print.id,
            levelPrice: event.price,
            observableAtMs: event.observableTimestampMs,
            samples: priceSamples,
            tickSize,
            settings,
            asOfMs: nowMs,
            currentPrice,
            gexAtTouch: (timestampMs) => {
              const historicalSlice = input.gex ? latestSliceAt(input.gex.exposureField, timestampMs) : null;
              return historicalSlice ? reactionGexContext(event.price, historicalSlice.nodes, tickSize, settings) : undefined;
            },
          });
      if (settings.contextMode === "current") {
        reactionAnalyticsCache.set(cacheKey, {
          sampleCount: priceSamples.length,
          firstTimestampMs: priceSamples[0]?.timestampMs ?? null,
          lastTimestampMs: latestPriceSample?.timestampMs ?? null,
          analytics: reaction,
        });
        trimReactionAnalyticsCache();
      }
      return { ...event, rank: index + 1, reaction };
    });
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
