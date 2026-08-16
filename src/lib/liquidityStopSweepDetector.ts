import type { Candle } from "@/lib/backtester";
import type { RithmicLiquiditySnapshot } from "@/lib/structureLevels";

export const LIQUIDITY_STOP_SWEEP_SETTINGS_VERSION = 1;

export type SweepDirection = "buy" | "sell";
export type SweepEvidenceLevel = "direct-execution-sweep" | "execution-group-linked" | "possible-stop-sweep" | "reference-rejection-confirmed" | "reference-continuation-confirmed";
export type SweepState = "developing" | "confirmed" | "possible-stop-sweep" | "continuing" | "rejected" | "absorbed" | "exhausted" | "invalidated" | "expired";
export type SweepReferenceType = "current-session-high" | "current-session-low" | "prior-session-high" | "prior-session-low" | "overnight-high" | "overnight-low" | "opening-range-high" | "opening-range-low" | "local-swing-high" | "local-swing-low" | "user-horizontal-level" | "custom";

export interface SweepReferenceLevel {
  id: string;
  type: SweepReferenceType;
  label: string;
  priceTick: number;
  validFromMs: number;
  validUntilMs?: number;
  side: "high" | "low" | "neutral";
  priority: number;
  isUserLevel: boolean;
}

export interface LiquidityStopSweepSettings {
  schemaVersion: number;
  preset: "balanced-futures" | "nq-scalper" | "large-sweep" | "stop-run-rejection" | "breakout-continuation" | "vacuum-assisted" | "absorbed-sweep" | "footprint-sweep" | "minimal" | "research" | "custom";
  maximumInterTradeGapMs: number;
  maximumSweepDurationMs: number;
  maximumBacktrackTicks: number;
  maximumInterTradeJumpTicks: number;
  maximumOpposingQuantityInsideCandidate: number;
  minimumDirectionalAggressorShare: number;
  minimumSweepContracts: number;
  minimumSweepTradeCount: number;
  minimumSweptLevels: number;
  minimumSweepRangeTicks: number;
  minimumContractsPerSecond: number;
  minimumContiguousCoverageRatio: number;
  minimumDirectionalProgressRatio: number;
  singleLevelBurstEnabled: boolean;
  maximumBurstLevels: number;
  minimumBurstContracts: number;
  minimumBurstTradeCount: number;
  minimumBurstContractsPerSecond: number;
  includeUnknownTrades: boolean;
  maximumBboAgeMs: number;
  dynamicBaselineEnabled: boolean;
  baselineWindowMs: number;
  baselineSampleLimit: number;
  minimumBaselineSamples: number;
  relativeQuantityMultiplier: number;
  relativeVelocityMultiplier: number;
  selectedPercentile: number;
  stopSweepInferenceEnabled: boolean;
  minimumReferenceBreachTicks: number;
  startSideToleranceTicks: number;
  minimumStopSweepContracts: number;
  minimumStopSweepLevels: number;
  minimumStopSweepVelocity: number;
  minimumStopSweepScore: number;
  maximumReferenceDistanceTicks: number;
  maximumMatchedReferences: number;
  minimumContinuationTicks: number;
  minimumAcceptanceTimeMs: number;
  continuationWindowMs: number;
  minimumRejectionTicks: number;
  rejectionWindowMs: number;
  exhaustionDetectionEnabled: boolean;
  exhaustionWindowMs: number;
  maximumPostSweepExtensionTicks: number;
  bookContextEnabled: boolean;
  bookContextLookbackMs: number;
  bookContextLookaheadMs: number;
  staleAfterMs: number;
  historySeconds: number;
  maximumConfirmedSweeps: number;
  visualizationMode: "range-brackets" | "price-time-bands" | "event-markers" | "stop-sweep-zones" | "active-event-lane" | "lower-pane" | "hybrid";
  showHeader: boolean;
  showRangeBrackets: boolean;
  showPriceTimeBands: boolean;
  showStopSweepZones: boolean;
  showMarkers: boolean;
  showLabels: boolean;
  showTooltips: boolean;
  showActiveLane: boolean;
  activeLaneWidth: number;
  maximumActiveLaneRows: number;
  minimumLaneScore: number;
  markerSize: number;
  opacity: number;
  useThemeColors: boolean;
  buyColor: string;
  sellColor: string;
  warningColor: string;
  rejectionColor: string;
  neutralColor: string;
  alertsEnabled: boolean;
  alertMinimumScore: number;
  alertMinimumQuality: number;
}

export const DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS: LiquidityStopSweepSettings = {
  schemaVersion: LIQUIDITY_STOP_SWEEP_SETTINGS_VERSION,
  preset: "balanced-futures",
  maximumInterTradeGapMs: 75,
  maximumSweepDurationMs: 1_000,
  maximumBacktrackTicks: 1,
  maximumInterTradeJumpTicks: 4,
  maximumOpposingQuantityInsideCandidate: 0,
  minimumDirectionalAggressorShare: 0.85,
  minimumSweepContracts: 100,
  minimumSweepTradeCount: 3,
  minimumSweptLevels: 3,
  minimumSweepRangeTicks: 2,
  minimumContractsPerSecond: 100,
  minimumContiguousCoverageRatio: 0.75,
  minimumDirectionalProgressRatio: 0.6,
  singleLevelBurstEnabled: false,
  maximumBurstLevels: 1,
  minimumBurstContracts: 250,
  minimumBurstTradeCount: 3,
  minimumBurstContractsPerSecond: 250,
  includeUnknownTrades: false,
  maximumBboAgeMs: 250,
  dynamicBaselineEnabled: true,
  baselineWindowMs: 120_000,
  baselineSampleLimit: 5_000,
  minimumBaselineSamples: 30,
  relativeQuantityMultiplier: 3,
  relativeVelocityMultiplier: 2,
  selectedPercentile: 0.9,
  stopSweepInferenceEnabled: true,
  minimumReferenceBreachTicks: 1,
  startSideToleranceTicks: 0,
  minimumStopSweepContracts: 100,
  minimumStopSweepLevels: 3,
  minimumStopSweepVelocity: 100,
  minimumStopSweepScore: 60,
  maximumReferenceDistanceTicks: 20,
  maximumMatchedReferences: 3,
  minimumContinuationTicks: 3,
  minimumAcceptanceTimeMs: 500,
  continuationWindowMs: 5_000,
  minimumRejectionTicks: 3,
  rejectionWindowMs: 5_000,
  exhaustionDetectionEnabled: true,
  exhaustionWindowMs: 2_000,
  maximumPostSweepExtensionTicks: 1,
  bookContextEnabled: true,
  bookContextLookbackMs: 500,
  bookContextLookaheadMs: 100,
  staleAfterMs: 5_000,
  historySeconds: 3_600,
  maximumConfirmedSweeps: 2_500,
  visualizationMode: "hybrid",
  showHeader: true,
  showRangeBrackets: true,
  showPriceTimeBands: true,
  showStopSweepZones: true,
  showMarkers: true,
  showLabels: true,
  showTooltips: true,
  showActiveLane: true,
  activeLaneWidth: 142,
  maximumActiveLaneRows: 12,
  minimumLaneScore: 60,
  markerSize: 8,
  opacity: 78,
  useThemeColors: true,
  buyColor: "#22D3A7",
  sellColor: "#FF3B78",
  warningColor: "#F59E0B",
  rejectionColor: "#FB7185",
  neutralColor: "#A1A1AA",
  alertsEnabled: false,
  alertMinimumScore: 75,
  alertMinimumQuality: 60,
};

export const LIQUIDITY_STOP_SWEEP_PRESETS: Record<Exclude<LiquidityStopSweepSettings["preset"], "custom">, Partial<LiquidityStopSweepSettings>> = {
  "balanced-futures": { preset: "balanced-futures" },
  "nq-scalper": { preset: "nq-scalper", maximumInterTradeGapMs: 35, minimumSweepContracts: 50, minimumSweepTradeCount: 2, minimumSweptLevels: 2, minimumSweepRangeTicks: 1, historySeconds: 600, markerSize: 6 },
  "large-sweep": { preset: "large-sweep", minimumSweepContracts: 250, minimumSweptLevels: 4, minimumContractsPerSecond: 500, minimumLaneScore: 75 },
  "stop-run-rejection": { preset: "stop-run-rejection", stopSweepInferenceEnabled: true, minimumReferenceBreachTicks: 1, rejectionWindowMs: 5_000, minimumRejectionTicks: 3, showStopSweepZones: true },
  "breakout-continuation": { preset: "breakout-continuation", stopSweepInferenceEnabled: true, minimumContinuationTicks: 4, minimumAcceptanceTimeMs: 500 },
  "vacuum-assisted": { preset: "vacuum-assisted", bookContextEnabled: true, minimumSweepContracts: 60 },
  "absorbed-sweep": { preset: "absorbed-sweep", exhaustionDetectionEnabled: true },
  "footprint-sweep": { preset: "footprint-sweep", showPriceTimeBands: false, showStopSweepZones: false, showActiveLane: false },
  minimal: { preset: "minimal", minimumLaneScore: 80, showPriceTimeBands: false, showActiveLane: false, showLabels: false, opacity: 58 },
  research: { preset: "research", singleLevelBurstEnabled: true, historySeconds: 7_200, maximumConfirmedSweeps: 5_000, showActiveLane: true },
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const quantile = (values: number[], q: number) => { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const index = (sorted.length - 1) * clamp01(q); const low = Math.floor(index); const high = Math.ceil(index); return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low); };
export const priceToSweepTick = (price: number, tickSize: number) => Math.round(price / tickSize);
export const sweepTickToPrice = (tick: number, tickSize: number) => tick * tickSize;

export function normalizeLiquidityStopSweepSettings(input?: Record<string, unknown> | null): LiquidityStopSweepSettings {
  const source = input ?? {}; const base = DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS; const result = { ...base, ...source, schemaVersion: LIQUIDITY_STOP_SWEEP_SETTINGS_VERSION } as LiquidityStopSweepSettings;
  const numbers: Array<[keyof LiquidityStopSweepSettings, number, number, boolean?]> = [
    ["maximumInterTradeGapMs", 1, 10_000, true], ["maximumSweepDurationMs", 1, 60_000, true], ["maximumBacktrackTicks", 0, 1_000, true], ["maximumInterTradeJumpTicks", 1, 10_000, true], ["maximumOpposingQuantityInsideCandidate", 0, 1_000_000, true], ["minimumDirectionalAggressorShare", 0.5, 1],
    ["minimumSweepContracts", 1, 1_000_000, true], ["minimumSweepTradeCount", 1, 10_000, true], ["minimumSweptLevels", 2, 10_000, true], ["minimumSweepRangeTicks", 1, 10_000, true], ["minimumContractsPerSecond", 0, 10_000_000], ["minimumContiguousCoverageRatio", 0, 1], ["minimumDirectionalProgressRatio", 0, 1],
    ["maximumBurstLevels", 1, 100, true], ["minimumBurstContracts", 1, 1_000_000, true], ["minimumBurstTradeCount", 1, 10_000, true], ["minimumBurstContractsPerSecond", 0, 10_000_000], ["maximumBboAgeMs", 0, 60_000, true], ["baselineWindowMs", 1_000, 86_400_000, true], ["baselineSampleLimit", 10, 100_000, true], ["minimumBaselineSamples", 1, 100_000, true],
    ["relativeQuantityMultiplier", 0.1, 50], ["relativeVelocityMultiplier", 0.1, 50], ["selectedPercentile", 0.5, 0.999], ["minimumReferenceBreachTicks", 0, 1_000, true], ["startSideToleranceTicks", 0, 1_000, true], ["minimumStopSweepContracts", 1, 1_000_000, true], ["minimumStopSweepLevels", 2, 10_000, true], ["minimumStopSweepVelocity", 0, 10_000_000], ["minimumStopSweepScore", 0, 100], ["maximumReferenceDistanceTicks", 0, 100_000, true], ["maximumMatchedReferences", 1, 100, true],
    ["minimumContinuationTicks", 1, 10_000, true], ["minimumAcceptanceTimeMs", 0, 60_000, true], ["continuationWindowMs", 1, 300_000, true], ["minimumRejectionTicks", 1, 10_000, true], ["rejectionWindowMs", 1, 300_000, true], ["exhaustionWindowMs", 1, 300_000, true], ["maximumPostSweepExtensionTicks", 0, 10_000, true], ["bookContextLookbackMs", 0, 60_000, true], ["bookContextLookaheadMs", 0, 60_000, true], ["staleAfterMs", 250, 300_000, true], ["historySeconds", 30, 86_400, true], ["maximumConfirmedSweeps", 10, 50_000, true], ["activeLaneWidth", 90, 300, true], ["maximumActiveLaneRows", 1, 100, true], ["minimumLaneScore", 0, 100], ["markerSize", 5, 17], ["opacity", 0, 100], ["alertMinimumScore", 0, 100], ["alertMinimumQuality", 0, 100],
  ];
  for (const [key, minimum, maximum, integer] of numbers) { const value = clamp(finite(source[key], Number(base[key])), minimum, maximum); (result as unknown as Record<string, unknown>)[key] = integer ? Math.round(value) : value; }
  const presets = [...Object.keys(LIQUIDITY_STOP_SWEEP_PRESETS), "custom"]; if (!presets.includes(String(result.preset))) result.preset = base.preset;
  const modes = ["range-brackets", "price-time-bands", "event-markers", "stop-sweep-zones", "active-event-lane", "lower-pane", "hybrid"]; if (!modes.includes(String(result.visualizationMode))) result.visualizationMode = base.visualizationMode;
  return result;
}

export interface SweepTradeContribution { tradeId: string; timestampMs: number; priceTick: number; quantity: number; aggressorSide: SweepDirection; classificationConfidence: number; classificationMethod: "source" | "bbo" | "tick-rule"; }
export interface SweepMatchedReference { id: string; type: SweepReferenceType; label: string; priceTick: number; breachTicks: number; distanceFromSweepStartTicks: number; priority: number; }
export interface ConfirmedSweepEvent {
  id: string; direction: SweepDirection; subtype: "multi-level-execution" | "linked-execution-group" | "depth-consuming" | "vacuum-assisted" | "replenishment-opposed" | "absorption-opposed" | "single-level-burst"; state: SweepState; evidenceLevel: SweepEvidenceLevel;
  startMs: number; endMs: number; lowTick: number; highTick: number; firstTick: number; lastTick: number; totalQuantity: number; confirmedAggressorQuantity: number; estimatedAggressorQuantity: number; opposingQuantity: number; tradeCount: number; uniqueLevelCount: number; rangeTicks: number; durationMs: number; contractsPerSecond: number; tradesPerSecond: number; levelsPerSecond: number; largestTrade: number; averageTradeSize: number; weightedAverageTick: number; slippageTicks: number; netProgressTicks: number; backtrackTicks: number; contiguousCoverageRatio: number; directionalProgressRatio: number;
  initialVisibleDepth?: number; consumedVisibleDepth?: number; remainingVisibleDepth?: number; depthConsumptionRatio?: number; executionToVisibleRatio?: number; pulledAheadQuantity?: number; stackedAheadQuantity?: number; matchedReferences: SweepMatchedReference[]; primaryReference: SweepMatchedReference | null; maximumBreachTicks: number; continuationTicks: number; rejectionTicks: number; score: number; scoreComponents: Record<string, number>; dataQualityScore: number; tradeIds: string[]; contextTags: string[]; warnings: string[];
}
export interface LiquidityStopSweepAlert { id: string; type: "NEW_BUY_SWEEP" | "NEW_SELL_SWEEP" | "POSSIBLE_BUY_STOP_SWEEP" | "POSSIBLE_SELL_STOP_SWEEP" | "BUY_CONTINUATION" | "SELL_CONTINUATION" | "BUY_REJECTION" | "SELL_REJECTION" | "TRADE_DATA_STALE" | "BOOK_CONTEXT_STALE"; event?: ConfirmedSweepEvent; }
export interface LiquidityStopSweepFrame { generatedAt: number; status: "CONNECTING" | "LIVE" | "TRADE_ONLY" | "MBP_BOOK_CONTEXT" | "HISTORICAL" | "TRADE_DATA_STALE" | "BOOK_CONTEXT_STALE" | "REBUILDING" | "UNAVAILABLE"; instrument: string; tickSize: number; lastPrice: number | null; bestBid: number | null; bestAsk: number | null; fullDepth: boolean; events: ConfirmedSweepEvent[]; alerts: LiquidityStopSweepAlert[]; limitations: string[]; }

type MutableCandidate = { id: string; instrument: string; direction: SweepDirection; startMs: number; lastUpdatedMs: number; firstTick: number; lastTick: number; lowTick: number; highTick: number; trades: SweepTradeContribution[]; volumeByTick: Map<number, number>; totalQuantity: number; opposingQuantity: number; largestTrade: number; backtrackTicks: number; furthestTick: number; initialVisibleDepth: number; consumedVisibleDepth: number; remainingVisibleDepth: number; pulledAheadQuantity: number; stackedAheadQuantity: number; matchedReferences: SweepMatchedReference[]; };

export function calculateSweepMetrics(candidate: Pick<MutableCandidate, "direction" | "startMs" | "lastUpdatedMs" | "firstTick" | "lastTick" | "lowTick" | "highTick" | "trades" | "volumeByTick" | "totalQuantity" | "largestTrade" | "backtrackTicks">) {
  const durationMs = Math.max(0, candidate.lastUpdatedMs - candidate.startMs); const seconds = Math.max(0.001, durationMs / 1_000); const rangeTicks = candidate.highTick - candidate.lowTick; const uniqueLevelCount = candidate.volumeByTick.size; const netProgressTicks = candidate.direction === "buy" ? candidate.lastTick - candidate.firstTick : candidate.firstTick - candidate.lastTick;
  const contiguousCoverageRatio = uniqueLevelCount / Math.max(1, rangeTicks + 1); const directionalProgressRatio = clamp01(netProgressTicks / Math.max(1, rangeTicks)); const weightedAverageTick = candidate.trades.reduce((sum, trade) => sum + trade.priceTick * trade.quantity, 0) / Math.max(1, candidate.totalQuantity);
  return { durationMs, rangeTicks, uniqueLevelCount, netProgressTicks, contiguousCoverageRatio, directionalProgressRatio, weightedAverageTick, contractsPerSecond: candidate.totalQuantity / seconds, tradesPerSecond: candidate.trades.length / seconds, levelsPerSecond: uniqueLevelCount / seconds, averageTradeSize: candidate.totalQuantity / Math.max(1, candidate.trades.length), slippageTicks: candidate.direction === "buy" ? candidate.highTick - candidate.firstTick : candidate.firstTick - candidate.lowTick };
}

export function qualifiesDirectSweep(candidate: MutableCandidate, settings: LiquidityStopSweepSettings) { const m = calculateSweepMetrics(candidate); const directionalShare = candidate.totalQuantity / Math.max(1, candidate.totalQuantity + candidate.opposingQuantity); return candidate.totalQuantity >= settings.minimumSweepContracts && candidate.trades.length >= settings.minimumSweepTradeCount && m.uniqueLevelCount >= settings.minimumSweptLevels && m.rangeTicks >= settings.minimumSweepRangeTicks && m.durationMs <= settings.maximumSweepDurationMs && m.contractsPerSecond >= settings.minimumContractsPerSecond && m.contiguousCoverageRatio >= settings.minimumContiguousCoverageRatio && m.directionalProgressRatio >= settings.minimumDirectionalProgressRatio && directionalShare >= settings.minimumDirectionalAggressorShare; }
export function qualifiesSingleLevelBurst(candidate: MutableCandidate, settings: LiquidityStopSweepSettings) { const m = calculateSweepMetrics(candidate); return settings.singleLevelBurstEnabled && m.uniqueLevelCount <= settings.maximumBurstLevels && candidate.totalQuantity >= settings.minimumBurstContracts && candidate.trades.length >= settings.minimumBurstTradeCount && m.contractsPerSecond >= settings.minimumBurstContractsPerSecond; }

export function matchSweepReferences(candidate: Pick<MutableCandidate, "direction" | "firstTick" | "lowTick" | "highTick">, references: SweepReferenceLevel[], settings: LiquidityStopSweepSettings): SweepMatchedReference[] {
  if (!settings.stopSweepInferenceEnabled) return [];
  return references.filter((reference) => {
    const distance = Math.abs(reference.priceTick - candidate.firstTick); if (distance > settings.maximumReferenceDistanceTicks) return false;
    return candidate.direction === "buy" ? reference.side === "high" && candidate.firstTick < reference.priceTick - settings.startSideToleranceTicks && candidate.highTick >= reference.priceTick + settings.minimumReferenceBreachTicks : reference.side === "low" && candidate.firstTick > reference.priceTick + settings.startSideToleranceTicks && candidate.lowTick <= reference.priceTick - settings.minimumReferenceBreachTicks;
  }).map((reference) => ({ id: reference.id, type: reference.type, label: reference.label, priceTick: reference.priceTick, breachTicks: candidate.direction === "buy" ? candidate.highTick - reference.priceTick : reference.priceTick - candidate.lowTick, distanceFromSweepStartTicks: Math.abs(reference.priceTick - candidate.firstTick), priority: reference.priority })).sort((a, b) => b.priority - a.priority || a.distanceFromSweepStartTicks - b.distanceFromSweepStartTicks || a.id.localeCompare(b.id)).slice(0, settings.maximumMatchedReferences);
}

function scoreCandidate(candidate: MutableCandidate, settings: LiquidityStopSweepSettings, dynamicQuantityFloor: number, dynamicVelocityFloor: number, possibleStop: boolean) {
  const m = calculateSweepMetrics(candidate); const depthRatio = candidate.initialVisibleDepth > 0 ? candidate.consumedVisibleDepth / candidate.initialVisibleDepth : null; const executionRatio = candidate.initialVisibleDepth > 0 ? candidate.totalQuantity / candidate.initialVisibleDepth : null; const pulledRatio = candidate.pulledAheadQuantity / Math.max(1, candidate.initialVisibleDepth + candidate.pulledAheadQuantity);
  const components: Record<string, number> = { quantity: clamp01(candidate.totalQuantity / 500), relativeQuantity: clamp01(candidate.totalQuantity / Math.max(1, dynamicQuantityFloor) - 1), levels: clamp01(m.uniqueLevelCount / 6), range: clamp01(m.rangeTicks / 8), velocity: clamp01(m.contractsPerSecond / 2_000), tradeRate: clamp01(m.tradesPerSecond / 40), coverage: m.contiguousCoverageRatio, progress: m.directionalProgressRatio, depthConsumption: depthRatio === null ? -1 : clamp01(depthRatio), executionVisible: executionRatio === null ? -1 : clamp01(executionRatio / 1.5), vacuum: candidate.initialVisibleDepth > 0 ? clamp01(pulledRatio / 0.5) : -1, reference: possibleStop ? clamp01(Math.max(...candidate.matchedReferences.map((item) => item.breachTicks), 0) / 5) : 0 };
  const weights: Record<string, number> = { quantity: 0.16, relativeQuantity: 0.08, levels: 0.12, range: 0.08, velocity: 0.16, tradeRate: 0.05, coverage: 0.09, progress: 0.1, depthConsumption: 0.07, executionVisible: 0.04, vacuum: 0.03, reference: 0.02 }; let numerator = 0; let denominator = 0; for (const [key, weight] of Object.entries(weights)) if (components[key] >= 0) { numerator += components[key] * weight; denominator += weight; }
  return { score: Math.round(100 * numerator / Math.max(0.001, denominator)), components, dynamicVelocityFloor };
}

export function calculateDepthConsumption(initialVisibleDepth: number, consumedVisibleDepth: number, totalExecution: number) { return { depthConsumptionRatio: consumedVisibleDepth / Math.max(1, initialVisibleDepth), executionToVisibleRatio: totalExecution / Math.max(1, initialVisibleDepth) }; }

export class LiquidityStopSweepDetectorEngine {
  private instrument = ""; private tickSize = 0.25; private open: MutableCandidate | null = null; private events = new Map<string, ConfirmedSweepEvent>(); private seenTrades = new Set<string>(); private lastTradeTick: number | null = null; private lastSequence = 0; private sequenceGap = false; private baselines: Array<{ timestamp: number; quantity: number; velocity: number; levels: number }> = []; private lastAlertState = new Map<string, SweepState>();
  reset() { this.instrument = ""; this.open = null; this.events.clear(); this.seenTrades.clear(); this.lastTradeTick = null; this.lastSequence = 0; this.sequenceGap = false; this.baselines = []; this.lastAlertState.clear(); }
  private newCandidate(instrument: string, direction: SweepDirection, trade: SweepTradeContribution) { return { id: `${instrument}:${direction}:${trade.tradeId}:${trade.timestampMs}`, instrument, direction, startMs: trade.timestampMs, lastUpdatedMs: trade.timestampMs, firstTick: trade.priceTick, lastTick: trade.priceTick, lowTick: trade.priceTick, highTick: trade.priceTick, trades: [trade], volumeByTick: new Map([[trade.priceTick, trade.quantity]]), totalQuantity: trade.quantity, opposingQuantity: 0, largestTrade: trade.quantity, backtrackTicks: 0, furthestTick: trade.priceTick, initialVisibleDepth: 0, consumedVisibleDepth: 0, remainingVisibleDepth: 0, pulledAheadQuantity: 0, stackedAheadQuantity: 0, matchedReferences: [] } satisfies MutableCandidate; }
  private append(candidate: MutableCandidate, trade: SweepTradeContribution) { candidate.trades.push(trade); candidate.lastUpdatedMs = trade.timestampMs; candidate.lastTick = trade.priceTick; candidate.lowTick = Math.min(candidate.lowTick, trade.priceTick); candidate.highTick = Math.max(candidate.highTick, trade.priceTick); candidate.totalQuantity += trade.quantity; candidate.largestTrade = Math.max(candidate.largestTrade, trade.quantity); candidate.volumeByTick.set(trade.priceTick, (candidate.volumeByTick.get(trade.priceTick) ?? 0) + trade.quantity); if (candidate.direction === "buy") { candidate.furthestTick = Math.max(candidate.furthestTick, trade.priceTick); candidate.backtrackTicks = Math.max(candidate.backtrackTicks, candidate.furthestTick - trade.priceTick); } else { candidate.furthestTick = Math.min(candidate.furthestTick, trade.priceTick); candidate.backtrackTicks = Math.max(candidate.backtrackTicks, trade.priceTick - candidate.furthestTick); } }
  private canJoin(candidate: MutableCandidate, trade: SweepTradeContribution, settings: LiquidityStopSweepSettings) { const gap = trade.timestampMs - candidate.lastUpdatedMs; const duration = trade.timestampMs - candidate.startMs; const jump = Math.abs(trade.priceTick - candidate.lastTick); const progression = candidate.direction === "buy" ? trade.priceTick >= candidate.lastTick - settings.maximumBacktrackTicks : trade.priceTick <= candidate.lastTick + settings.maximumBacktrackTicks; return gap <= settings.maximumInterTradeGapMs && duration <= settings.maximumSweepDurationMs && jump <= settings.maximumInterTradeJumpTicks && progression; }
  private eventFrom(candidate: MutableCandidate, settings: LiquidityStopSweepSettings, now: number, lastPriceTick: number | null, fullDepth: boolean) {
    const m = calculateSweepMetrics(candidate); const quantityValues = this.baselines.map((item) => item.quantity); const velocityValues = this.baselines.map((item) => item.velocity); const dynamicQuantityFloor = settings.dynamicBaselineEnabled && this.baselines.length >= settings.minimumBaselineSamples ? Math.max(settings.minimumSweepContracts, quantile(quantityValues, settings.selectedPercentile), quantile(quantityValues, 0.5) * settings.relativeQuantityMultiplier) : settings.minimumSweepContracts; const dynamicVelocityFloor = settings.dynamicBaselineEnabled && this.baselines.length >= settings.minimumBaselineSamples ? Math.max(settings.minimumContractsPerSecond, quantile(velocityValues, settings.selectedPercentile), quantile(velocityValues, 0.5) * settings.relativeVelocityMultiplier) : settings.minimumContractsPerSecond;
    const direct = qualifiesDirectSweep(candidate, { ...settings, minimumSweepContracts: dynamicQuantityFloor, minimumContractsPerSecond: dynamicVelocityFloor }); const burst = !direct && qualifiesSingleLevelBurst(candidate, settings); if (!direct && !burst) return null;
    const possibleStop = direct && candidate.matchedReferences.length > 0 && candidate.totalQuantity >= settings.minimumStopSweepContracts && m.uniqueLevelCount >= settings.minimumStopSweepLevels && m.contractsPerSecond >= settings.minimumStopSweepVelocity; const scoreResult = scoreCandidate(candidate, settings, dynamicQuantityFloor, dynamicVelocityFloor, possibleStop); const primary = candidate.matchedReferences[0] ?? null; let state: SweepState = possibleStop && scoreResult.score >= settings.minimumStopSweepScore ? "possible-stop-sweep" : "confirmed"; let evidence: SweepEvidenceLevel = state === "possible-stop-sweep" ? "possible-stop-sweep" : "direct-execution-sweep"; let continuationTicks = 0; let rejectionTicks = 0;
    if (primary && lastPriceTick !== null && now - candidate.lastUpdatedMs <= Math.max(settings.continuationWindowMs, settings.rejectionWindowMs)) { if (candidate.direction === "buy") { continuationTicks = Math.max(0, lastPriceTick - candidate.highTick); rejectionTicks = Math.max(0, candidate.highTick - lastPriceTick); if (now - candidate.lastUpdatedMs >= settings.minimumAcceptanceTimeMs && continuationTicks >= settings.minimumContinuationTicks && lastPriceTick > primary.priceTick) { state = "continuing"; evidence = "reference-continuation-confirmed"; } else if (lastPriceTick <= primary.priceTick && rejectionTicks >= settings.minimumRejectionTicks) { state = "rejected"; evidence = "reference-rejection-confirmed"; } } else { continuationTicks = Math.max(0, candidate.lowTick - lastPriceTick); rejectionTicks = Math.max(0, lastPriceTick - candidate.lowTick); if (now - candidate.lastUpdatedMs >= settings.minimumAcceptanceTimeMs && continuationTicks >= settings.minimumContinuationTicks && lastPriceTick < primary.priceTick) { state = "continuing"; evidence = "reference-continuation-confirmed"; } else if (lastPriceTick >= primary.priceTick && rejectionTicks >= settings.minimumRejectionTicks) { state = "rejected"; evidence = "reference-rejection-confirmed"; } } }
    if (settings.exhaustionDetectionEnabled && state === "confirmed" && now - candidate.lastUpdatedMs >= settings.exhaustionWindowMs && (candidate.direction === "buy" ? Math.max(0, (lastPriceTick ?? candidate.highTick) - candidate.highTick) : Math.max(0, candidate.lowTick - (lastPriceTick ?? candidate.lowTick))) <= settings.maximumPostSweepExtensionTicks) state = "exhausted";
    const depth: { depthConsumptionRatio?: number; executionToVisibleRatio?: number } = candidate.initialVisibleDepth > 0 ? calculateDepthConsumption(candidate.initialVisibleDepth, candidate.consumedVisibleDepth, candidate.totalQuantity) : {}; const quality = clamp(35 + (fullDepth ? 25 : 10) + (this.sequenceGap ? 0 : 20) + (candidate.trades.every((trade) => trade.classificationMethod === "source") ? 20 : 8), 0, 100); const tags: string[] = []; if (candidate.pulledAheadQuantity > 0) tags.push("VACUUM ASSISTED"); if ((depth.depthConsumptionRatio ?? 0) >= 0.75) tags.push("DEPTH CONSUMING");
    return { id: candidate.id, direction: candidate.direction, subtype: burst ? "single-level-burst" : candidate.pulledAheadQuantity > 0 ? "vacuum-assisted" : (depth.depthConsumptionRatio ?? 0) >= 0.75 ? "depth-consuming" : "multi-level-execution", state, evidenceLevel: evidence, startMs: candidate.startMs, endMs: candidate.lastUpdatedMs, lowTick: candidate.lowTick, highTick: candidate.highTick, firstTick: candidate.firstTick, lastTick: candidate.lastTick, totalQuantity: candidate.totalQuantity, confirmedAggressorQuantity: candidate.trades.filter((trade) => trade.classificationConfidence >= 1).reduce((sum, trade) => sum + trade.quantity, 0), estimatedAggressorQuantity: candidate.trades.filter((trade) => trade.classificationConfidence < 1).reduce((sum, trade) => sum + trade.quantity, 0), opposingQuantity: candidate.opposingQuantity, tradeCount: candidate.trades.length, uniqueLevelCount: m.uniqueLevelCount, rangeTicks: m.rangeTicks, durationMs: m.durationMs, contractsPerSecond: m.contractsPerSecond, tradesPerSecond: m.tradesPerSecond, levelsPerSecond: m.levelsPerSecond, largestTrade: candidate.largestTrade, averageTradeSize: m.averageTradeSize, weightedAverageTick: m.weightedAverageTick, slippageTicks: m.slippageTicks, netProgressTicks: m.netProgressTicks, backtrackTicks: candidate.backtrackTicks, contiguousCoverageRatio: m.contiguousCoverageRatio, directionalProgressRatio: m.directionalProgressRatio, initialVisibleDepth: candidate.initialVisibleDepth || undefined, consumedVisibleDepth: candidate.initialVisibleDepth ? candidate.consumedVisibleDepth : undefined, remainingVisibleDepth: candidate.initialVisibleDepth ? candidate.remainingVisibleDepth : undefined, ...depth, pulledAheadQuantity: candidate.pulledAheadQuantity || undefined, stackedAheadQuantity: candidate.stackedAheadQuantity || undefined, matchedReferences: candidate.matchedReferences, primaryReference: primary, maximumBreachTicks: Math.max(0, ...candidate.matchedReferences.map((item) => item.breachTicks)), continuationTicks, rejectionTicks, score: scoreResult.score, scoreComponents: scoreResult.components, dataQualityScore: quality, tradeIds: candidate.trades.map((trade) => trade.tradeId), contextTags: tags, warnings: [this.sequenceGap ? "Trade or book sequence gap detected." : "", !fullDepth ? "Full Level 3 depth context unavailable." : "", "Stop-sweep labels are inferred from reference crossing; stop orders are not directly visible."].filter(Boolean) } satisfies ConfirmedSweepEvent;
  }
  private captureBook(candidate: MutableCandidate, snapshot: RithmicLiquiditySnapshot, trade: SweepTradeContribution) { const passiveSide = candidate.direction === "buy" ? "ASK" : "BID"; const row = snapshot.levels.find((level) => level.side === passiveSide && priceToSweepTick(level.price, snapshot.tickSize) === trade.priceTick); const post = Math.max(0, row?.size ?? 0); if (!candidate.volumeByTick.has(trade.priceTick) || candidate.volumeByTick.get(trade.priceTick) === trade.quantity) candidate.initialVisibleDepth += post + trade.quantity; candidate.consumedVisibleDepth += Math.min(trade.quantity, post + trade.quantity); candidate.remainingVisibleDepth += post; }
  private finalizeOpen(settings: LiquidityStopSweepSettings, now: number, lastPriceTick: number | null, fullDepth: boolean) { if (!this.open) return; const event = this.eventFrom(this.open, settings, now, lastPriceTick, fullDepth); if (event) { this.events.set(event.id, event); this.baselines.push({ timestamp: event.endMs, quantity: event.totalQuantity, velocity: event.contractsPerSecond, levels: event.uniqueLevelCount }); } this.open = null; }
  apply(snapshot: RithmicLiquiditySnapshot, rawSettings?: LiquidityStopSweepSettings | Record<string, unknown>, references: SweepReferenceLevel[] = []): LiquidityStopSweepFrame {
    const settings = normalizeLiquidityStopSweepSettings(rawSettings as Record<string, unknown>); const timestamp = Date.parse(snapshot.asOf) || Date.now(); const instrument = snapshot.contractSymbol || "UNKNOWN"; if (this.instrument && this.instrument !== instrument) this.reset(); this.instrument = instrument; this.tickSize = snapshot.tickSize || this.tickSize;
    for (const orderEvent of snapshot.orderEvents ?? []) { if (this.lastSequence && orderEvent.sequence > this.lastSequence + 1) this.sequenceGap = true; this.lastSequence = Math.max(this.lastSequence, orderEvent.sequence); }
    const trades = [...(snapshot.trades ?? [])].sort((a, b) => a.timestamp - b.timestamp || String(a.id).localeCompare(String(b.id))); const tradeVolumeByKey = new Map<string, number>(); for (const trade of trades) tradeVolumeByKey.set(`${trade.side === "BUY" ? "ASK" : "BID"}:${priceToSweepTick(trade.price, this.tickSize)}`, (tradeVolumeByKey.get(`${trade.side === "BUY" ? "ASK" : "BID"}:${priceToSweepTick(trade.price, this.tickSize)}`) ?? 0) + trade.size);
    if (this.open && settings.bookContextEnabled) for (const event of snapshot.orderEvents ?? []) { const tick = priceToSweepTick(event.previousPrice ?? event.price, this.tickSize); const passive = this.open.direction === "buy" ? "ASK" : "BID"; if (event.side !== passive) continue; const ahead = this.open.direction === "buy" ? tick >= this.open.lastTick : tick <= this.open.lastTick; if (!ahead) continue; const reduction = event.action === "REMOVE" ? event.previousSize : event.action === "MODIFY" && event.previousPrice === event.price ? Math.max(0, event.previousSize - event.size) : 0; const addition = event.action === "ADD" ? event.size : event.action === "MODIFY" && event.previousPrice === event.price ? Math.max(0, event.size - event.previousSize) : 0; const execution = tradeVolumeByKey.get(`${passive}:${tick}`) ?? 0; this.open.pulledAheadQuantity += Math.max(0, reduction - execution); this.open.stackedAheadQuantity += addition; }
    for (const raw of trades) { const tradeId = String(raw.id ?? `${raw.timestamp}:${raw.price}:${raw.size}:${raw.side}`); if (this.seenTrades.has(tradeId)) continue; this.seenTrades.add(tradeId); const direction: SweepDirection = raw.side === "BUY" ? "buy" : "sell"; const trade: SweepTradeContribution = { tradeId, timestampMs: raw.timestamp, priceTick: priceToSweepTick(raw.price, this.tickSize), quantity: raw.size, aggressorSide: direction, classificationConfidence: 1, classificationMethod: "source" };
      if (this.open && this.open.direction !== direction) { if (trade.quantity <= settings.maximumOpposingQuantityInsideCandidate) { this.open.opposingQuantity += trade.quantity; continue; } this.finalizeOpen(settings, trade.timestampMs, this.lastTradeTick, snapshot.fullDepth && snapshot.bookValid); }
      if (this.open && !this.canJoin(this.open, trade, settings)) this.finalizeOpen(settings, trade.timestampMs, this.lastTradeTick, snapshot.fullDepth && snapshot.bookValid);
      if (!this.open) this.open = this.newCandidate(instrument, direction, trade); else this.append(this.open, trade); if (!this.open.matchedReferences.length) this.open.matchedReferences = matchSweepReferences(this.open, references.filter((reference) => reference.validFromMs <= trade.timestampMs && (!reference.validUntilMs || reference.validUntilMs >= trade.timestampMs)), settings); if (settings.bookContextEnabled && snapshot.bookValid) this.captureBook(this.open, snapshot, trade); this.lastTradeTick = trade.priceTick;
    }
    const lastPriceTick = snapshot.lastPrice == null ? this.lastTradeTick : priceToSweepTick(snapshot.lastPrice, this.tickSize); if (this.open && timestamp - this.open.lastUpdatedMs > settings.maximumInterTradeGapMs) this.finalizeOpen(settings, timestamp, lastPriceTick, snapshot.fullDepth && snapshot.bookValid);
    if (this.open) { const event = this.eventFrom(this.open, settings, timestamp, lastPriceTick, snapshot.fullDepth && snapshot.bookValid); if (event) this.events.set(event.id, event); }
    const retentionStart = timestamp - settings.historySeconds * 1_000; for (const [id, event] of this.events) if (event.endMs < retentionStart) this.events.delete(id); this.baselines = this.baselines.filter((item) => item.timestamp >= timestamp - settings.baselineWindowMs).slice(-settings.baselineSampleLimit);
    const events = [...this.events.values()].sort((a, b) => a.endMs - b.endMs).slice(-settings.maximumConfirmedSweeps); const alerts: LiquidityStopSweepAlert[] = []; for (const event of events) { const previous = this.lastAlertState.get(event.id); if (previous === event.state) continue; this.lastAlertState.set(event.id, event.state); const type = event.state === "possible-stop-sweep" ? event.direction === "buy" ? "POSSIBLE_BUY_STOP_SWEEP" : "POSSIBLE_SELL_STOP_SWEEP" : event.state === "continuing" ? event.direction === "buy" ? "BUY_CONTINUATION" : "SELL_CONTINUATION" : event.state === "rejected" ? event.direction === "buy" ? "BUY_REJECTION" : "SELL_REJECTION" : event.direction === "buy" ? "NEW_BUY_SWEEP" : "NEW_SELL_SWEEP"; alerts.push({ id: `${event.id}:${event.state}`, type, event }); }
    const historical = timestamp < Date.now() - 60_000; const tradeStale = snapshot.ageMs != null && snapshot.ageMs > settings.staleAfterMs && !historical; const bookStale = !snapshot.bookValid || (snapshot.ageMs != null && snapshot.ageMs > settings.staleAfterMs); const status: LiquidityStopSweepFrame["status"] = tradeStale ? "TRADE_DATA_STALE" : historical ? "HISTORICAL" : bookStale ? (trades.length ? "TRADE_ONLY" : "BOOK_CONTEXT_STALE") : snapshot.fullDepth ? "LIVE" : "MBP_BOOK_CONTEXT";
    return { generatedAt: timestamp, status, instrument, tickSize: this.tickSize, lastPrice: snapshot.lastPrice ?? null, bestBid: snapshot.bestBid ?? null, bestAsk: snapshot.bestAsk ?? null, fullDepth: snapshot.fullDepth, events, alerts, limitations: ["Execution sweeps are directly observed aggressive trades through liquidity. Stop-sweep labels are inferred from configured reference crossings.", ...(snapshot.fullDepth ? [] : ["Full Level 3 depth context is unavailable; direct trade sweeps remain active."]), "The normalized feed does not expose execution-group IDs or trade-correction messages."] };
  }
}

function nyParts(timestamp: number) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp)); const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00"; return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")), minute: Number(get("minute")) }; }
export function buildSweepReferencesFromCandles(candles: Candle[], tickSize: number): SweepReferenceLevel[] {
  if (!candles.length || tickSize <= 0) return [];
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  const byDate = new Map<string, Candle[]>();
  for (const candle of sorted) {
    const key = nyParts(candle.timestamp).date;
    const rows = byDate.get(key) ?? [];
    rows.push(candle);
    byDate.set(key, rows);
  }
  const dates = [...byDate.keys()].sort();
  const currentDate = dates.at(-1);
  const priorDate = dates.at(-2);
  const refs: SweepReferenceLevel[] = [];
  const addPair = (date: string | undefined, prefix: "current-session" | "prior-session", priority: number) => {
    if (!date) return;
    const rows = byDate.get(date) ?? [];
    if (!rows.length) return;
    const high = Math.max(...rows.map((row) => row.high));
    const low = Math.min(...rows.map((row) => row.low));
    refs.push(
      { id: `${prefix}-high:${date}`, type: `${prefix}-high`, label: prefix === "current-session" ? "Session High" : "Prior Session High", priceTick: priceToSweepTick(high, tickSize), validFromMs: rows[0].timestamp, side: "high", priority, isUserLevel: false },
      { id: `${prefix}-low:${date}`, type: `${prefix}-low`, label: prefix === "current-session" ? "Session Low" : "Prior Session Low", priceTick: priceToSweepTick(low, tickSize), validFromMs: rows[0].timestamp, side: "low", priority, isUserLevel: false },
    );
  };
  addPair(currentDate, "current-session", 100);
  addPair(priorDate, "prior-session", 95);
  if (currentDate) {
    const currentRows = byDate.get(currentDate) ?? [];
    const opening = currentRows.filter((row) => {
      const part = nyParts(row.timestamp);
      return part.hour === 9 && part.minute >= 30 && part.minute < 60;
    });
    if (opening.length) {
      const frozenAt = opening.at(-1)?.timestamp ?? opening[0].timestamp;
      refs.push(
        { id: `opening-range-high:${currentDate}`, type: "opening-range-high", label: "Opening Range High", priceTick: priceToSweepTick(Math.max(...opening.map((row) => row.high)), tickSize), validFromMs: frozenAt, side: "high", priority: 90, isUserLevel: false },
        { id: `opening-range-low:${currentDate}`, type: "opening-range-low", label: "Opening Range Low", priceTick: priceToSweepTick(Math.min(...opening.map((row) => row.low)), tickSize), validFromMs: frozenAt, side: "low", priority: 90, isUserLevel: false },
      );
    }
    const overnight = [
      ...(priorDate ? (byDate.get(priorDate) ?? []).filter((row) => nyParts(row.timestamp).hour >= 18) : []),
      ...currentRows.filter((row) => { const part = nyParts(row.timestamp); return part.hour < 9 || (part.hour === 9 && part.minute < 30); }),
    ];
    if (overnight.length) {
      const frozenAt = currentRows.find((row) => { const part = nyParts(row.timestamp); return part.hour > 9 || (part.hour === 9 && part.minute >= 30); })?.timestamp ?? overnight.at(-1)?.timestamp ?? overnight[0].timestamp;
      refs.push(
        { id: `overnight-high:${currentDate}`, type: "overnight-high", label: "Overnight High", priceTick: priceToSweepTick(Math.max(...overnight.map((row) => row.high)), tickSize), validFromMs: frozenAt, side: "high", priority: 92, isUserLevel: false },
        { id: `overnight-low:${currentDate}`, type: "overnight-low", label: "Overnight Low", priceTick: priceToSweepTick(Math.min(...overnight.map((row) => row.low)), tickSize), validFromMs: frozenAt, side: "low", priority: 92, isUserLevel: false },
      );
    }
  }
  const pivotStrength = 3;
  const pivotRows = sorted.slice(-500);
  for (let index = pivotStrength; index < pivotRows.length - pivotStrength; index += 1) {
    const row = pivotRows[index];
    const window = pivotRows.slice(index - pivotStrength, index + pivotStrength + 1);
    const validFromMs = pivotRows[index + pivotStrength].timestamp;
    if (window.every((candidate) => row.high >= candidate.high)) refs.push({ id: `swing-high:${row.timestamp}`, type: "local-swing-high", label: "Local Swing High", priceTick: priceToSweepTick(row.high, tickSize), validFromMs, side: "high", priority: 65, isUserLevel: false });
    if (window.every((candidate) => row.low <= candidate.low)) refs.push({ id: `swing-low:${row.timestamp}`, type: "local-swing-low", label: "Local Swing Low", priceTick: priceToSweepTick(row.low, tickSize), validFromMs, side: "low", priority: 65, isUserLevel: false });
  }
  return refs.sort((a, b) => b.priority - a.priority || b.validFromMs - a.validFromMs || a.id.localeCompare(b.id)).slice(0, 200);
}
