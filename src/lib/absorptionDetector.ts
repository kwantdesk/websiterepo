import type { RithmicLiquiditySnapshot, RithmicOrderLifecycleEvent } from "@/lib/structureLevels";

export const ABSORPTION_DETECTOR_SETTINGS_VERSION = 1;

export type AbsorptionSide = "BID" | "ASK";
export type AbsorptionState = "DEVELOPING" | "CONFIRMED" | "RETESTING" | "HELD" | "FAILED" | "BROKEN" | "EXPIRED";
export type AbsorptionFeedMode = "LEVEL 3" | "MBP CONTEXT" | "TRADE-ONLY";
export type AbsorptionConfirmationMode = "immediate" | "price-response" | "persistence" | "replenishment" | "combined-score" | "any-enabled";
export type AbsorptionRenderMode = "cells" | "zones" | "markers" | "candle-highlights" | "active-profile" | "lower-pane" | "hybrid";

export type AbsorptionSettings = {
  version: number;
  preset: "balanced-level3" | "scalper" | "footprint-confirmation" | "replenishment-focus" | "retest-zones" | "trade-only" | "minimal" | "research" | "custom";
  useTradeStream: boolean;
  useLevel3Context: boolean;
  useFootprintAggregation: boolean;
  usePullingStackingContext: boolean;
  includeOwnOrders: boolean;
  includeImpliedOrders: boolean;
  preferSourceSide: boolean;
  useBboFallback: boolean;
  includeUnknownTrades: boolean;
  maximumBboAgeMs: number;
  aggregationMode: "rolling" | "fixed" | "chart-bar" | "footprint-bar";
  windowMs: number;
  rollingStepMs: number;
  mergeGapMs: number;
  maximumCandidateDurationMs: number;
  confirmationWindowMs: number;
  finalizationGraceMs: number;
  minimumContracts: number;
  minimumTradeCount: number;
  minimumDirectionalShare: number;
  maximumPenetrationTicks: number;
  minimumAggressionPerTick: number;
  minimumContractsPerSecond: number;
  minimumTradesPerSecond: number;
  minimumDurationMs: number;
  minimumLargestTrade: number;
  minimumExecutedToVisible: number;
  minimumRepeatCount: number;
  minimumDevelopingScore: number;
  minimumConfirmedScore: number;
  dynamicBaselineEnabled: boolean;
  baselineWindowSeconds: number;
  baselineSampleLimit: number;
  baselineMinimumSamples: number;
  baselineMedianMultiplier: number;
  baselinePercentile: number;
  baselineWarmupMs: number;
  confirmationMode: AbsorptionConfirmationMode;
  minimumResponseTicks: number;
  maximumResponseTimeMs: number;
  minimumPersistenceMs: number;
  minimumReplenishmentRatio: number;
  minimumDepthRetention: number;
  confirmationMinimumExecutedToVisible: number;
  sizeWeight: number;
  relativeSizeWeight: number;
  aggressionPerTickWeight: number;
  lowProgressWeight: number;
  directionalShareWeight: number;
  replenishmentWeight: number;
  depthRetentionWeight: number;
  executedToVisibleWeight: number;
  persistenceWeight: number;
  responseWeight: number;
  repeatWeight: number;
  renormalizeDisabledComponents: boolean;
  zoneMergeEnabled: boolean;
  zoneMergeWindowMs: number;
  zoneMaximumGapTicks: number;
  maximumZoneLevels: number;
  zoneExtensionMode: "fixed-time" | "session-end" | "until-broken" | "right-edge" | "manual";
  fixedExtensionMs: number;
  retainBrokenZones: boolean;
  maximumActiveZones: number;
  retestEnabled: boolean;
  retestMinimumDepartureTicks: number;
  retestTouchToleranceTicks: number;
  retestWindowMs: number;
  maximumRetests: number;
  retestMinimumResponseTicks: number;
  breakMode: "first-trade" | "minimum-volume" | "minimum-time" | "bar-close" | "combined";
  breakToleranceTicks: number;
  minimumBreakVolume: number;
  minimumBreakTimeMs: number;
  minimumBreakCloses: number;
  keepBrokenHistory: boolean;
  replenishmentEnabled: boolean;
  replenishmentWindowMs: number;
  replenishmentMinimumContracts: number;
  replenishmentMinimumRatio: number;
  replenishmentMinimumRefreshCount: number;
  replenishmentSamePriceRequired: boolean;
  requireReplenishmentForConfirmation: boolean;
  renderMode: AbsorptionRenderMode;
  showHeader: boolean;
  showDeveloping: boolean;
  showConfirmed: boolean;
  showRetests: boolean;
  showBroken: boolean;
  showExpired: boolean;
  showCells: boolean;
  showZones: boolean;
  showEventMarkers: boolean;
  showActiveProfile: boolean;
  showLowerPane: boolean;
  activeProfileWidth: number;
  activeProfileMaximumZones: number;
  lowerPaneHeight: number;
  opacity: number;
  markerSize: number;
  zoneBorderWidth: number;
  includeInChartAutoscale: boolean;
  useThemeColors: boolean;
  bidDevelopingColor: string;
  bidConfirmedColor: string;
  askDevelopingColor: string;
  askConfirmedColor: string;
  retestColor: string;
  brokenColor: string;
  replenishmentColor: string;
  neutralColor: string;
  showQuantity: boolean;
  showScore: boolean;
  showTradeCount: boolean;
  showAggressionPerTick: boolean;
  showReplenishment: boolean;
  showRepeatCount: boolean;
  showTooltips: boolean;
  enableAlerts: boolean;
  alertMinimumScore: number;
  alertCooldownMs: number;
  historySeconds: number;
  maximumEvents: number;
  maximumZones: number;
  staleTradeAfterMs: number;
  staleLevel3AfterMs: number;
  postSnapshotWarmupMs: number;
};

export const DEFAULT_ABSORPTION_SETTINGS: AbsorptionSettings = {
  version: ABSORPTION_DETECTOR_SETTINGS_VERSION,
  preset: "balanced-level3",
  useTradeStream: true,
  useLevel3Context: true,
  useFootprintAggregation: true,
  usePullingStackingContext: true,
  includeOwnOrders: false,
  includeImpliedOrders: false,
  preferSourceSide: true,
  useBboFallback: true,
  includeUnknownTrades: false,
  maximumBboAgeMs: 250,
  aggregationMode: "rolling",
  windowMs: 1_000,
  rollingStepMs: 100,
  mergeGapMs: 100,
  maximumCandidateDurationMs: 3_000,
  confirmationWindowMs: 2_000,
  finalizationGraceMs: 250,
  minimumContracts: 100,
  minimumTradeCount: 3,
  minimumDirectionalShare: 0.7,
  maximumPenetrationTicks: 2,
  minimumAggressionPerTick: 50,
  minimumContractsPerSecond: 0,
  minimumTradesPerSecond: 0,
  minimumDurationMs: 50,
  minimumLargestTrade: 0,
  minimumExecutedToVisible: 0,
  minimumRepeatCount: 0,
  minimumDevelopingScore: 45,
  minimumConfirmedScore: 70,
  dynamicBaselineEnabled: true,
  baselineWindowSeconds: 60,
  baselineSampleLimit: 4_000,
  baselineMinimumSamples: 30,
  baselineMedianMultiplier: 3,
  baselinePercentile: 0.9,
  baselineWarmupMs: 20_000,
  confirmationMode: "combined-score",
  minimumResponseTicks: 2,
  maximumResponseTimeMs: 2_000,
  minimumPersistenceMs: 250,
  minimumReplenishmentRatio: 0.2,
  minimumDepthRetention: 0,
  confirmationMinimumExecutedToVisible: 0,
  sizeWeight: 0.16,
  relativeSizeWeight: 0.12,
  aggressionPerTickWeight: 0.15,
  lowProgressWeight: 0.18,
  directionalShareWeight: 0.08,
  replenishmentWeight: 0.1,
  depthRetentionWeight: 0.05,
  executedToVisibleWeight: 0.05,
  persistenceWeight: 0.04,
  responseWeight: 0.05,
  repeatWeight: 0.02,
  renormalizeDisabledComponents: true,
  zoneMergeEnabled: true,
  zoneMergeWindowMs: 750,
  zoneMaximumGapTicks: 1,
  maximumZoneLevels: 8,
  zoneExtensionMode: "until-broken",
  fixedExtensionMs: 60_000,
  retainBrokenZones: true,
  maximumActiveZones: 100,
  retestEnabled: true,
  retestMinimumDepartureTicks: 3,
  retestTouchToleranceTicks: 1,
  retestWindowMs: 3_600_000,
  maximumRetests: 2,
  retestMinimumResponseTicks: 2,
  breakMode: "combined",
  breakToleranceTicks: 1,
  minimumBreakVolume: 50,
  minimumBreakTimeMs: 250,
  minimumBreakCloses: 1,
  keepBrokenHistory: true,
  replenishmentEnabled: true,
  replenishmentWindowMs: 1_000,
  replenishmentMinimumContracts: 25,
  replenishmentMinimumRatio: 0.2,
  replenishmentMinimumRefreshCount: 2,
  replenishmentSamePriceRequired: true,
  requireReplenishmentForConfirmation: false,
  renderMode: "hybrid",
  showHeader: true,
  showDeveloping: true,
  showConfirmed: true,
  showRetests: true,
  showBroken: true,
  showExpired: false,
  showCells: true,
  showZones: true,
  showEventMarkers: true,
  showActiveProfile: true,
  showLowerPane: false,
  activeProfileWidth: 120,
  activeProfileMaximumZones: 12,
  lowerPaneHeight: 160,
  opacity: 100,
  markerSize: 7,
  zoneBorderWidth: 1,
  includeInChartAutoscale: false,
  useThemeColors: true,
  bidDevelopingColor: "#22C55E",
  bidConfirmedColor: "#22C55E",
  askDevelopingColor: "#EF4444",
  askConfirmedColor: "#EF4444",
  retestColor: "#F59E0B",
  brokenColor: "#A1A1AA",
  replenishmentColor: "#38BDF8",
  neutralColor: "#71717A",
  showQuantity: true,
  showScore: true,
  showTradeCount: true,
  showAggressionPerTick: true,
  showReplenishment: true,
  showRepeatCount: true,
  showTooltips: true,
  enableAlerts: false,
  alertMinimumScore: 75,
  alertCooldownMs: 10_000,
  historySeconds: 3_600,
  maximumEvents: 2_500,
  maximumZones: 500,
  staleTradeAfterMs: 5_000,
  staleLevel3AfterMs: 5_000,
  postSnapshotWarmupMs: 3_000,
};

export const ABSORPTION_PRESETS: Record<Exclude<AbsorptionSettings["preset"], "custom">, Partial<AbsorptionSettings>> = {
  "balanced-level3": { ...DEFAULT_ABSORPTION_SETTINGS, preset: "balanced-level3" },
  scalper: { preset: "scalper", windowMs: 250, minimumContracts: 50, minimumTradeCount: 2, maximumPenetrationTicks: 1, confirmationMode: "price-response", minimumResponseTicks: 1, historySeconds: 600 },
  "footprint-confirmation": { preset: "footprint-confirmation", aggregationMode: "footprint-bar", minimumContracts: 250, minimumDirectionalShare: 0.75, maximumPenetrationTicks: 2, showCells: false },
  "replenishment-focus": { preset: "replenishment-focus", replenishmentEnabled: true, replenishmentMinimumContracts: 30, replenishmentMinimumRatio: 0.3, replenishmentMinimumRefreshCount: 2, replenishmentWeight: 0.18 },
  "retest-zones": { preset: "retest-zones", showDeveloping: false, zoneExtensionMode: "until-broken", retestEnabled: true, retestMinimumDepartureTicks: 4, maximumRetests: 2 },
  "trade-only": { preset: "trade-only", useLevel3Context: false, replenishmentEnabled: false, confirmationMode: "price-response", showActiveProfile: false },
  minimal: { preset: "minimal", showDeveloping: false, showCells: false, showActiveProfile: false, showLowerPane: false, minimumConfirmedScore: 80, opacity: 45 },
  research: { preset: "research", showDeveloping: true, showCells: true, showActiveProfile: true, showLowerPane: true, historySeconds: 3_600 },
};

const number = (value: unknown, fallback: number, minimum = -Infinity, maximum = Infinity) => {
  const parsed = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
};
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;

export function normalizeAbsorptionSettings(value?: Record<string, number | string | boolean> | null): AbsorptionSettings {
  const source = value ?? {};
  const defaults = DEFAULT_ABSORPTION_SETTINGS;
  const next = { ...defaults, ...source } as AbsorptionSettings;
  const presetValues = Object.keys(ABSORPTION_PRESETS);
  next.version = ABSORPTION_DETECTOR_SETTINGS_VERSION;
  next.preset = (presetValues.includes(String(source.preset)) || source.preset === "custom" ? source.preset : defaults.preset) as AbsorptionSettings["preset"];
  next.aggregationMode = (["rolling", "fixed", "chart-bar", "footprint-bar"].includes(String(source.aggregationMode)) ? source.aggregationMode : defaults.aggregationMode) as AbsorptionSettings["aggregationMode"];
  next.confirmationMode = (["immediate", "price-response", "persistence", "replenishment", "combined-score", "any-enabled"].includes(String(source.confirmationMode)) ? source.confirmationMode : defaults.confirmationMode) as AbsorptionConfirmationMode;
  next.renderMode = (["cells", "zones", "markers", "candle-highlights", "active-profile", "lower-pane", "hybrid"].includes(String(source.renderMode)) ? source.renderMode : defaults.renderMode) as AbsorptionRenderMode;
  next.zoneExtensionMode = (["fixed-time", "session-end", "until-broken", "right-edge", "manual"].includes(String(source.zoneExtensionMode)) ? source.zoneExtensionMode : defaults.zoneExtensionMode) as AbsorptionSettings["zoneExtensionMode"];
  next.breakMode = (["first-trade", "minimum-volume", "minimum-time", "bar-close", "combined"].includes(String(source.breakMode)) ? source.breakMode : defaults.breakMode) as AbsorptionSettings["breakMode"];
  const numericBounds: Partial<Record<keyof AbsorptionSettings, [number, number]>> = {
    windowMs: [50, 60_000], rollingStepMs: [16, 5_000], mergeGapMs: [0, 5_000], maximumCandidateDurationMs: [100, 60_000], confirmationWindowMs: [50, 60_000],
    minimumContracts: [1, 1_000_000], minimumTradeCount: [1, 10_000], minimumDirectionalShare: [0.5, 1], maximumPenetrationTicks: [0, 100], minimumAggressionPerTick: [0, 1_000_000],
    minimumContractsPerSecond: [0, 1_000_000], minimumTradesPerSecond: [0, 100_000], minimumDurationMs: [0, 60_000], minimumLargestTrade: [0, 1_000_000], minimumExecutedToVisible: [0, 100],
    minimumDevelopingScore: [0, 100], minimumConfirmedScore: [0, 100], baselineWindowSeconds: [5, 3_600], baselineSampleLimit: [30, 100_000], baselineMinimumSamples: [1, 10_000], baselineMedianMultiplier: [0.1, 20], baselinePercentile: [0.5, 0.99],
    minimumResponseTicks: [0, 100], minimumPersistenceMs: [0, 60_000], minimumReplenishmentRatio: [0, 10], minimumDepthRetention: [0, 10], confirmationMinimumExecutedToVisible: [0, 100], zoneMergeWindowMs: [0, 60_000], zoneMaximumGapTicks: [0, 100], maximumZoneLevels: [1, 100], maximumActiveZones: [1, 10_000],
    retestMinimumDepartureTicks: [1, 100], retestTouchToleranceTicks: [0, 20], retestWindowMs: [1_000, 86_400_000], maximumRetests: [1, 100], breakToleranceTicks: [0, 20], minimumBreakVolume: [0, 1_000_000], minimumBreakTimeMs: [0, 60_000], minimumBreakCloses: [1, 100],
    replenishmentWindowMs: [50, 60_000], replenishmentMinimumContracts: [0, 1_000_000], replenishmentMinimumRatio: [0, 10], replenishmentMinimumRefreshCount: [0, 100], activeProfileWidth: [80, 260], activeProfileMaximumZones: [1, 100], lowerPaneHeight: [80, 500], opacity: [5, 100], markerSize: [4, 16], zoneBorderWidth: [0.5, 5], alertMinimumScore: [0, 100], alertCooldownMs: [0, 3_600_000], historySeconds: [30, 86_400], maximumEvents: [100, 50_000], maximumZones: [10, 5_000], staleTradeAfterMs: [500, 120_000], staleLevel3AfterMs: [500, 120_000], postSnapshotWarmupMs: [0, 60_000],
  };
  for (const [key, bounds] of Object.entries(numericBounds) as Array<[keyof AbsorptionSettings, [number, number]]>) {
    (next as unknown as Record<string, unknown>)[key] = number(source[key], defaults[key] as number, bounds[0], bounds[1]);
  }
  for (const key of Object.keys(defaults) as Array<keyof AbsorptionSettings>) {
    if (typeof defaults[key] === "boolean") (next as unknown as Record<string, unknown>)[key] = bool(source[key], defaults[key] as boolean);
  }
  return next;
}

export const priceToTick = (price: number, tickSize: number) => Math.round(price / tickSize);
export const tickToPrice = (tick: number, tickSize: number) => tick * tickSize;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const percentile = (values: number[], quantile: number) => {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * clamp01(quantile);
  const low = Math.floor(position); const high = Math.ceil(position);
  return ordered[low] + (ordered[high] - ordered[low]) * (position - low);
};
export const median = (values: number[]) => percentile(values, 0.5);
export const mad = (values: number[]) => { const centre = median(values); return median(values.map((value) => Math.abs(value - centre))); };

export type AbsorptionMetrics = {
  aggressiveQuantity: number;
  opposingQuantity: number;
  directionalShare: number;
  penetrationTicks: number;
  aggressionPerTick: number;
  contractsPerSecond: number;
  tradesPerSecond: number;
  tradeCount: number;
  largestTrade: number;
  durationMs: number;
  startingDepth: number;
  endingDepth: number;
  replenishmentQuantity: number;
  replenishmentRatio: number;
  refreshCount: number;
  depthRetention: number;
  executedToVisible: number;
  responseTicks: number;
  repeatCount: number;
  score: number;
  scoreComponents: Record<string, number>;
};

export type AbsorptionEvent = AbsorptionMetrics & {
  id: string;
  side: AbsorptionSide;
  state: AbsorptionState;
  startTimestamp: number;
  endTimestamp: number;
  anchorTick: number;
  lowTick: number;
  highTick: number;
  dominantTick: number;
  weightedCentreTick: number;
  feedMode: AbsorptionFeedMode;
  suspectedHiddenLiquidity: boolean;
};

export type AbsorptionZone = AbsorptionEvent & {
  zoneId: string;
  createdAt: number;
  updatedAt: number;
  extendedUntil: number | null;
  retestCount: number;
  departureReached: boolean;
  lastRetestAt: number | null;
  brokenAt: number | null;
  breakVolume: number;
  breakStartedAt: number | null;
};

export type AbsorptionCandidate = AbsorptionEvent & { confirmed: boolean };

export type AbsorptionFrame = {
  timestamp: number;
  tickSize: number;
  contractSymbol: string;
  lastPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  feedMode: AbsorptionFeedMode;
  status: "CONNECTING" | "BUILDING" | "CALIBRATING" | "LIVE" | "TRADE DATA STALE" | "LEVEL 3 CONTEXT STALE — RESYNCING";
  bookValid: boolean;
  fullDepth: boolean;
  individualOrders: boolean;
  sequenceGap: boolean;
  tradeStale: boolean;
  level3Stale: boolean;
  candidates: AbsorptionCandidate[];
  events: AbsorptionEvent[];
  zones: AbsorptionZone[];
  limitations: string[];
};

type Trade = NonNullable<RithmicLiquiditySnapshot["trades"]>[number] & { tick: number };
type MutableCandidate = {
  side: AbsorptionSide;
  trades: Trade[];
  startedAt: number;
  updatedAt: number;
  anchorTick: number;
  lowTick: number;
  highTick: number;
  startingDepth: number;
  endingDepth: number;
  replenishmentQuantity: number;
  refreshCount: number;
  confirmed: boolean;
  eventId: string | null;
};

export function calculateAbsorptionScore(args: {
  metrics: Omit<AbsorptionMetrics, "score" | "scoreComponents">;
  settings: AbsorptionSettings;
  dynamicQuantityThreshold: number;
  dynamicPerTickThreshold: number;
  level3Available: boolean;
}) {
  const { metrics, settings, level3Available } = args;
  const components: Record<string, number> = {
    size: clamp01(metrics.aggressiveQuantity / Math.max(1, args.dynamicQuantityThreshold * 2)),
    relativeSize: clamp01(metrics.aggressiveQuantity / Math.max(1, args.dynamicQuantityThreshold)),
    aggressionPerTick: clamp01(metrics.aggressionPerTick / Math.max(1, args.dynamicPerTickThreshold * 2)),
    lowProgress: clamp01(1 - metrics.penetrationTicks / Math.max(1, settings.maximumPenetrationTicks + 1)),
    directionalShare: clamp01((metrics.directionalShare - 0.5) / 0.5),
    replenishment: clamp01(metrics.replenishmentRatio / Math.max(0.01, settings.replenishmentMinimumRatio * 2)),
    depthRetention: clamp01(metrics.depthRetention),
    executedToVisible: clamp01(metrics.executedToVisible / 3),
    persistence: clamp01(metrics.durationMs / Math.max(1, settings.minimumPersistenceMs * 2)),
    response: clamp01(metrics.responseTicks / Math.max(1, settings.minimumResponseTicks * 2)),
    repeat: clamp01(metrics.repeatCount / 3),
  };
  const weights: Record<string, number> = {
    size: settings.sizeWeight, relativeSize: settings.relativeSizeWeight, aggressionPerTick: settings.aggressionPerTickWeight,
    lowProgress: settings.lowProgressWeight, directionalShare: settings.directionalShareWeight,
    replenishment: settings.replenishmentWeight, depthRetention: settings.depthRetentionWeight,
    executedToVisible: settings.executedToVisibleWeight, persistence: settings.persistenceWeight,
    response: settings.responseWeight, repeat: settings.repeatWeight,
  };
  if (!level3Available) { weights.replenishment = 0; weights.depthRetention = 0; weights.executedToVisible = 0; }
  const denominator = Math.max(0.0001, Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0));
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + components[key] * Math.max(0, weight), 0) / denominator;
  return { score: Math.round(clamp01(score) * 100), scoreComponents: components };
}

function lifecycleReplenishment(
  events: RithmicOrderLifecycleEvent[] | undefined,
  side: AbsorptionSide,
  ticks: Set<number>,
  tickSize: number,
  seen: Set<string>,
  startedAt: number,
  now: number,
  windowMs: number,
) {
  let quantity = 0; let refreshCount = 0;
  for (const event of events ?? []) {
    const key = `${event.sequence}:${event.orderId}:${event.action}:${event.timestamp}:${event.size}`;
    if (event.timestamp < startedAt || event.timestamp > Math.min(now, startedAt + windowMs)) continue;
    if (event.side !== side || !ticks.has(priceToTick(event.price, tickSize))) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const added = event.action === "ADD" ? event.size : event.action === "MODIFY" ? Math.max(0, event.size - event.previousSize) : 0;
    if (added > 0) { quantity += added; refreshCount += 1; }
  }
  return { quantity, refreshCount };
}

export class AbsorptionDetectorEngine {
  private seenTrades = new Set<number>();
  private seenOrderEvents = new Set<string>();
  private candidates = new Map<AbsorptionSide, MutableCandidate>();
  private events: AbsorptionEvent[] = [];
  private zones: AbsorptionZone[] = [];
  private baselines: Record<AbsorptionSide, Array<{ timestamp: number; quantity: number; perTick: number }>> = { BID: [], ASK: [] };
  private lastSequence = 0;
  private sequenceGap = false;
  private lastTradeAt = 0;
  private firstBookAt = 0;

  reset() {
    this.seenTrades.clear(); this.seenOrderEvents.clear(); this.candidates.clear(); this.events = []; this.zones = [];
    this.baselines = { BID: [], ASK: [] }; this.lastSequence = 0; this.sequenceGap = false; this.lastTradeAt = 0; this.firstBookAt = 0;
  }

  apply(snapshot: RithmicLiquiditySnapshot, rawSettings?: Partial<AbsorptionSettings>): AbsorptionFrame {
    const settings = normalizeAbsorptionSettings(rawSettings as Record<string, number | string | boolean> | undefined);
    const parsed = Date.parse(snapshot.asOf); const timestamp = Number.isFinite(parsed) ? parsed : Date.now();
    const tickSize = snapshot.tickSize > 0 ? snapshot.tickSize : 0.25;
    const level3Available = settings.useLevel3Context && snapshot.bookValid;
    if (snapshot.bookValid && !this.firstBookAt) this.firstBookAt = timestamp;
    let gapThisFrame = false;
    const sequences = (snapshot.orderEvents ?? []).map((event) => event.sequence).filter((value) => value > 0).sort((a, b) => a - b);
    for (const sequence of sequences) {
      if (this.lastSequence && sequence > this.lastSequence + 1) gapThisFrame = true;
      this.lastSequence = Math.max(this.lastSequence, sequence);
    }
    if (gapThisFrame) this.sequenceGap = true;
    else if (snapshot.bookValid && sequences.length) this.sequenceGap = false;
    const depth = new Map<string, { size: number; orders: number }>();
    for (const level of snapshot.levels) depth.set(`${level.side}:${priceToTick(level.price, tickSize)}`, { size: level.size, orders: level.orders });
    const newTrades: Trade[] = [];
    for (const trade of snapshot.trades ?? []) {
      if (this.seenTrades.has(trade.id)) continue;
      this.seenTrades.add(trade.id); this.lastTradeAt = Math.max(this.lastTradeAt, trade.timestamp);
      newTrades.push({ ...trade, tick: priceToTick(trade.price, tickSize) });
    }
    newTrades.sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
    for (const trade of newTrades) this.consumeTrade(trade, timestamp, depth, settings);
    for (const side of ["BID", "ASK"] as const) {
      const candidate = this.candidates.get(side);
      if (!candidate) continue;
      const tickSet = new Set(candidate.trades.map((trade) => trade.tick));
      const replenishment = level3Available && !this.sequenceGap
        ? lifecycleReplenishment(
            snapshot.orderEvents,
            side,
            tickSet,
            tickSize,
            this.seenOrderEvents,
            candidate.startedAt,
            timestamp,
            settings.replenishmentWindowMs,
          )
        : { quantity: 0, refreshCount: 0 };
      candidate.replenishmentQuantity += replenishment.quantity;
      candidate.refreshCount += replenishment.refreshCount;
      candidate.endingDepth = [...tickSet].reduce((sum, tick) => sum + (depth.get(`${side}:${tick}`)?.size ?? 0), 0);
      this.evaluateCandidate(candidate, snapshot, timestamp, tickSize, settings, level3Available && !this.sequenceGap);
      if (timestamp - candidate.updatedAt > settings.maximumCandidateDurationMs + settings.finalizationGraceMs) this.finalizeCandidate(side, timestamp, settings);
    }
    this.updateZones(snapshot, timestamp, tickSize, settings, newTrades);
    this.prune(timestamp, settings);
    if (this.seenTrades.size > 100_000) this.seenTrades.clear();
    if (this.seenOrderEvents.size > 200_000) this.seenOrderEvents.clear();
    const feedMode: AbsorptionFeedMode = !level3Available ? "TRADE-ONLY" : snapshot.individualOrders ? "LEVEL 3" : "MBP CONTEXT";
    const tradeStale = this.lastTradeAt > 0 && timestamp - this.lastTradeAt > settings.staleTradeAfterMs;
    const level3Stale = level3Available && ((snapshot.ageMs ?? 0) > settings.staleLevel3AfterMs || this.sequenceGap);
    const baselineReady = this.baselines.BID.length + this.baselines.ASK.length >= settings.baselineMinimumSamples;
    const warmingBook = level3Available && timestamp - this.firstBookAt < settings.postSnapshotWarmupMs;
    const status: AbsorptionFrame["status"] = tradeStale ? "TRADE DATA STALE"
      : level3Stale ? "LEVEL 3 CONTEXT STALE — RESYNCING"
        : warmingBook ? "BUILDING"
          : settings.dynamicBaselineEnabled && !baselineReady ? "CALIBRATING" : "LIVE";
    return {
      timestamp, tickSize, contractSymbol: snapshot.contractSymbol, lastPrice: snapshot.lastPrice ?? snapshot.microPrice ?? null,
      bestBid: snapshot.bestBid ?? null, bestAsk: snapshot.bestAsk ?? null, feedMode, status,
      bookValid: snapshot.bookValid, fullDepth: snapshot.fullDepth, individualOrders: snapshot.individualOrders === true,
      sequenceGap: this.sequenceGap, tradeStale, level3Stale,
      candidates: [...this.candidates.values()].map((candidate) => this.toEvent(candidate, snapshot, timestamp, tickSize, settings, level3Available && !this.sequenceGap)),
      events: [...this.events], zones: this.zones.map((zone) => ({ ...zone })),
      limitations: [
        ...(snapshot.individualOrders ? [] : ["Individual maker IDs are unavailable; replenishment uses price-level aggregate context."]),
        ...(level3Available ? [] : ["Level 3 context is unavailable; score weights are renormalized and hidden-liquidity context is disabled."]),
        ...(["chart-bar", "footprint-bar"].includes(settings.aggregationMode) ? ["Chart and footprint aggregation use the configured fixed window because the shared execution stream does not expose stable bar IDs."] : []),
        "This tool flags suspicious absorption patterns; it does not identify participants or establish intent.",
      ],
    };
  }

  private consumeTrade(trade: Trade, timestamp: number, depth: Map<string, { size: number; orders: number }>, settings: AbsorptionSettings) {
    const side: AbsorptionSide = trade.side === "SELL" ? "BID" : "ASK";
    let candidate = this.candidates.get(side);
    const usesFixedWindow = settings.aggregationMode !== "rolling";
    const sameFixedWindow = candidate
      ? Math.floor(candidate.startedAt / settings.windowMs) === Math.floor(trade.timestamp / settings.windowMs)
      : false;
    if (
      !candidate
      || trade.timestamp - candidate.updatedAt > settings.mergeGapMs
      || trade.timestamp - candidate.startedAt > settings.maximumCandidateDurationMs
      || (usesFixedWindow && !sameFixedWindow)
    ) {
      if (candidate) this.finalizeCandidate(side, timestamp, settings);
      candidate = { side, trades: [], startedAt: trade.timestamp, updatedAt: trade.timestamp, anchorTick: trade.tick, lowTick: trade.tick, highTick: trade.tick, startingDepth: depth.get(`${side}:${trade.tick}`)?.size ?? 0, endingDepth: 0, replenishmentQuantity: 0, refreshCount: 0, confirmed: false, eventId: null };
      this.candidates.set(side, candidate);
    }
    candidate.trades.push(trade); candidate.updatedAt = trade.timestamp;
    if (settings.aggregationMode === "rolling") {
      const cutoff = trade.timestamp - settings.windowMs;
      candidate.trades = candidate.trades.filter((row) => row.timestamp >= cutoff);
      candidate.startedAt = candidate.trades[0]?.timestamp ?? trade.timestamp;
      candidate.anchorTick = candidate.trades[0]?.tick ?? trade.tick;
      candidate.lowTick = Math.min(...candidate.trades.map((row) => row.tick));
      candidate.highTick = Math.max(...candidate.trades.map((row) => row.tick));
    }
    candidate.lowTick = Math.min(candidate.lowTick, trade.tick); candidate.highTick = Math.max(candidate.highTick, trade.tick);
  }

  private thresholds(side: AbsorptionSide, timestamp: number, settings: AbsorptionSettings) {
    const cutoff = timestamp - settings.baselineWindowSeconds * 1_000;
    const samples = this.baselines[side].filter((sample) => sample.timestamp >= cutoff).slice(-settings.baselineSampleLimit);
    this.baselines[side] = samples;
    const quantities = samples.map((sample) => sample.quantity); const perTick = samples.map((sample) => sample.perTick);
    return {
      quantity: samples.length >= settings.baselineMinimumSamples && settings.dynamicBaselineEnabled
        ? Math.max(settings.minimumContracts, median(quantities) * settings.baselineMedianMultiplier, percentile(quantities, settings.baselinePercentile))
        : settings.minimumContracts,
      perTick: samples.length >= settings.baselineMinimumSamples && settings.dynamicBaselineEnabled
        ? Math.max(settings.minimumAggressionPerTick, median(perTick) * 2)
        : settings.minimumAggressionPerTick,
    };
  }

  private toEvent(candidate: MutableCandidate, snapshot: RithmicLiquiditySnapshot, timestamp: number, tickSize: number, settings: AbsorptionSettings, level3Available: boolean): AbsorptionCandidate {
    const aggressiveQuantity = candidate.trades.reduce((sum, trade) => sum + trade.size, 0);
    const tradeCount = candidate.trades.length; const durationMs = Math.max(1, candidate.updatedAt - candidate.startedAt);
    const penetrationTicks = candidate.side === "BID" ? candidate.anchorTick - candidate.lowTick : candidate.highTick - candidate.anchorTick;
    const aggressionPerTick = aggressiveQuantity / Math.max(1, penetrationTicks + 1);
    const opposingSide = candidate.side === "BID" ? "BUY" : "SELL";
    const opposingQuantity = (snapshot.trades ?? []).reduce((sum, trade) => {
      if (trade.side !== opposingSide || trade.timestamp < candidate.startedAt || trade.timestamp > candidate.updatedAt) return sum;
      const tick = priceToTick(trade.price, tickSize);
      return tick >= candidate.lowTick - 1 && tick <= candidate.highTick + 1 ? sum + trade.size : sum;
    }, 0);
    const directionalShare = aggressiveQuantity / Math.max(1, aggressiveQuantity + opposingQuantity);
    const responseReference = candidate.side === "BID" ? candidate.lowTick : candidate.highTick;
    const currentTick = snapshot.lastPrice == null ? responseReference : priceToTick(snapshot.lastPrice, tickSize);
    const responseTicks = candidate.side === "BID" ? Math.max(0, currentTick - responseReference) : Math.max(0, responseReference - currentTick);
    const replenishmentRatio = candidate.replenishmentQuantity / Math.max(1, aggressiveQuantity);
    const depthRetention = candidate.endingDepth / Math.max(1, candidate.startingDepth);
    const executedToVisible = aggressiveQuantity / Math.max(1, candidate.startingDepth);
    const repeatCount = this.events.filter((event) => event.side === candidate.side && timestamp - event.endTimestamp <= settings.zoneMergeWindowMs && Math.abs(event.dominantTick - candidate.anchorTick) <= settings.zoneMaximumGapTicks).length;
    const baseMetrics = { aggressiveQuantity, opposingQuantity, directionalShare, penetrationTicks, aggressionPerTick, contractsPerSecond: aggressiveQuantity / Math.max(0.001, durationMs / 1_000), tradesPerSecond: tradeCount / Math.max(0.001, durationMs / 1_000), tradeCount, largestTrade: Math.max(0, ...candidate.trades.map((trade) => trade.size)), durationMs, startingDepth: candidate.startingDepth, endingDepth: candidate.endingDepth, replenishmentQuantity: candidate.replenishmentQuantity, replenishmentRatio, refreshCount: candidate.refreshCount, depthRetention, executedToVisible, responseTicks, repeatCount };
    const threshold = this.thresholds(candidate.side, timestamp, settings);
    const scoreResult = calculateAbsorptionScore({ metrics: baseMetrics, settings, dynamicQuantityThreshold: threshold.quantity, dynamicPerTickThreshold: threshold.perTick, level3Available });
    const volumeByTick = new Map<number, number>(); candidate.trades.forEach((trade) => volumeByTick.set(trade.tick, (volumeByTick.get(trade.tick) ?? 0) + trade.size));
    const dominantTick = [...volumeByTick.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? candidate.anchorTick;
    const weightedCentreTick = Math.round([...volumeByTick.entries()].reduce((sum, [tick, quantity]) => sum + tick * quantity, 0) / Math.max(1, aggressiveQuantity));
    return {
      id: candidate.eventId ?? `abs:${candidate.side}:${candidate.startedAt}:${candidate.anchorTick}`,
      side: candidate.side, state: candidate.confirmed ? "CONFIRMED" : "DEVELOPING", startTimestamp: candidate.startedAt, endTimestamp: candidate.updatedAt,
      anchorTick: candidate.anchorTick, lowTick: candidate.lowTick, highTick: candidate.highTick, dominantTick, weightedCentreTick,
      feedMode: level3Available ? snapshot.individualOrders ? "LEVEL 3" : "MBP CONTEXT" : "TRADE-ONLY",
      suspectedHiddenLiquidity: level3Available && candidate.replenishmentQuantity >= settings.replenishmentMinimumContracts && replenishmentRatio >= settings.replenishmentMinimumRatio && candidate.refreshCount >= settings.replenishmentMinimumRefreshCount,
      ...baseMetrics, ...scoreResult, confirmed: candidate.confirmed,
    };
  }

  private evaluateCandidate(candidate: MutableCandidate, snapshot: RithmicLiquiditySnapshot, timestamp: number, tickSize: number, settings: AbsorptionSettings, level3Available: boolean) {
    if (candidate.confirmed) return;
    const event = this.toEvent(candidate, snapshot, timestamp, tickSize, settings, level3Available);
    const threshold = this.thresholds(candidate.side, timestamp, settings);
    const gates = event.aggressiveQuantity >= threshold.quantity && event.tradeCount >= settings.minimumTradeCount && event.directionalShare >= settings.minimumDirectionalShare && event.penetrationTicks <= settings.maximumPenetrationTicks && event.aggressionPerTick >= threshold.perTick && event.durationMs >= settings.minimumDurationMs && event.durationMs <= settings.maximumCandidateDurationMs && event.largestTrade >= settings.minimumLargestTrade && event.contractsPerSecond >= settings.minimumContractsPerSecond && event.tradesPerSecond >= settings.minimumTradesPerSecond;
    if (!gates || event.score < settings.minimumDevelopingScore) return;
    const response = event.responseTicks >= settings.minimumResponseTicks && timestamp - candidate.updatedAt <= settings.maximumResponseTimeMs;
    const persistence = timestamp - candidate.startedAt >= settings.minimumPersistenceMs;
    const replenishment = level3Available && event.replenishmentRatio >= settings.minimumReplenishmentRatio;
    const combined = event.score >= settings.minimumConfirmedScore && (!settings.requireReplenishmentForConfirmation || replenishment);
    const confirmed = settings.confirmationMode === "immediate" ? true : settings.confirmationMode === "price-response" ? response : settings.confirmationMode === "persistence" ? persistence : settings.confirmationMode === "replenishment" ? replenishment : settings.confirmationMode === "any-enabled" ? response || persistence || replenishment || combined : combined;
    if (!confirmed) return;
    candidate.confirmed = true; candidate.eventId = event.id;
    const confirmedEvent = { ...event, state: "CONFIRMED" as const, confirmed: undefined };
    delete (confirmedEvent as Partial<AbsorptionCandidate>).confirmed;
    this.events.push(confirmedEvent as AbsorptionEvent);
    this.mergeZone(confirmedEvent as AbsorptionEvent, timestamp, settings);
  }

  private finalizeCandidate(side: AbsorptionSide, timestamp: number, settings: AbsorptionSettings) {
    const candidate = this.candidates.get(side); if (!candidate) return;
    if (!candidate.confirmed && candidate.trades.length) {
      const quantity = candidate.trades.reduce((sum, trade) => sum + trade.size, 0);
      const penetration = side === "BID" ? candidate.anchorTick - candidate.lowTick : candidate.highTick - candidate.anchorTick;
      this.baselines[side].push({ timestamp, quantity, perTick: quantity / Math.max(1, penetration + 1) });
    }
    this.candidates.delete(side);
  }

  private mergeZone(event: AbsorptionEvent, timestamp: number, settings: AbsorptionSettings) {
    const matching = settings.zoneMergeEnabled ? [...this.zones].reverse().find((zone) => zone.side === event.side && zone.state !== "BROKEN" && timestamp - zone.updatedAt <= settings.zoneMergeWindowMs && event.lowTick <= zone.highTick + settings.zoneMaximumGapTicks && event.highTick >= zone.lowTick - settings.zoneMaximumGapTicks) : null;
    if (matching) {
      matching.lowTick = Math.min(matching.lowTick, event.lowTick); matching.highTick = Math.max(matching.highTick, event.highTick);
      matching.updatedAt = timestamp; matching.endTimestamp = event.endTimestamp; matching.aggressiveQuantity += event.aggressiveQuantity;
      matching.tradeCount += event.tradeCount; matching.repeatCount += 1; matching.score = Math.max(matching.score, event.score);
      matching.replenishmentQuantity += event.replenishmentQuantity; matching.replenishmentRatio = matching.replenishmentQuantity / Math.max(1, matching.aggressiveQuantity);
      return;
    }
    this.zones.push({ ...event, zoneId: `zone:${event.id}`, createdAt: timestamp, updatedAt: timestamp, extendedUntil: settings.zoneExtensionMode === "fixed-time" ? timestamp + settings.fixedExtensionMs : null, retestCount: 0, departureReached: false, lastRetestAt: null, brokenAt: null, breakVolume: 0, breakStartedAt: null });
  }

  private updateZones(snapshot: RithmicLiquiditySnapshot, timestamp: number, tickSize: number, settings: AbsorptionSettings, trades: Trade[]) {
    if (snapshot.lastPrice == null) return; const tick = priceToTick(snapshot.lastPrice, tickSize);
    for (const zone of this.zones) {
      if (["BROKEN", "EXPIRED"].includes(zone.state)) continue;
      const favourableDeparture = zone.side === "BID" ? tick - zone.highTick : zone.lowTick - tick;
      if (favourableDeparture >= settings.retestMinimumDepartureTicks) zone.departureReached = true;
      const insideRetest = tick >= zone.lowTick - settings.retestTouchToleranceTicks && tick <= zone.highTick + settings.retestTouchToleranceTicks;
      if (settings.retestEnabled && zone.departureReached && insideRetest && zone.retestCount < settings.maximumRetests && timestamp - zone.createdAt <= settings.retestWindowMs) {
        if (zone.state !== "RETESTING") { zone.state = "RETESTING"; zone.retestCount += 1; zone.lastRetestAt = timestamp; }
      } else if (zone.state === "RETESTING" && favourableDeparture >= settings.retestMinimumResponseTicks) zone.state = "HELD";
      const through = zone.side === "BID" ? tick < zone.lowTick - settings.breakToleranceTicks : tick > zone.highTick + settings.breakToleranceTicks;
      const throughTrades = trades.filter((trade) => zone.side === "BID" ? trade.tick < zone.lowTick - settings.breakToleranceTicks : trade.tick > zone.highTick + settings.breakToleranceTicks);
      if (through) {
        zone.breakStartedAt ??= timestamp; zone.breakVolume += throughTrades.reduce((sum, trade) => sum + trade.size, 0);
        const timeGate = timestamp - zone.breakStartedAt >= settings.minimumBreakTimeMs; const volumeGate = zone.breakVolume >= settings.minimumBreakVolume;
        const broken = settings.breakMode === "first-trade" ? throughTrades.length > 0 : settings.breakMode === "minimum-volume" ? volumeGate : settings.breakMode === "minimum-time" ? timeGate : settings.breakMode === "bar-close" ? timeGate : timeGate && volumeGate;
        if (broken) { zone.state = "BROKEN"; zone.brokenAt = timestamp; }
      } else { zone.breakStartedAt = null; zone.breakVolume = 0; }
    }
  }

  private prune(timestamp: number, settings: AbsorptionSettings) {
    const cutoff = timestamp - settings.historySeconds * 1_000;
    this.events = this.events.filter((event) => event.endTimestamp >= cutoff).slice(-settings.maximumEvents);
    this.zones = this.zones.filter((zone) => (settings.keepBrokenHistory || zone.state !== "BROKEN") && (zone.updatedAt >= cutoff || zone.state !== "BROKEN")).slice(-settings.maximumZones);
    for (const side of ["BID", "ASK"] as const) this.baselines[side] = this.baselines[side].filter((sample) => sample.timestamp >= timestamp - settings.baselineWindowSeconds * 1_000).slice(-settings.baselineSampleLimit);
  }
}
