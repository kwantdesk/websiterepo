import type { RithmicLiquiditySnapshot, RithmicOrderLifecycleEvent } from "@/lib/structureLevels";

export const ICEBERG_REFRESH_SETTINGS_VERSION = 1;

export type IcebergPassiveSide = "BID" | "ASK";
export type IcebergEvidenceLevel = "native-confirmed" | "order-lineage" | "price-level-aggregate" | "execution-over-display" | "trade-only-unavailable";
export type IcebergCandidateState = "WATCHING" | "REFRESHING" | "SUSPECTED" | "NATIVE" | "RETESTING" | "HELD" | "EXHAUSTED" | "PULLED" | "BROKEN" | "EXPIRED";
export type IcebergVisualizationMode = "price-time-cells" | "refresh-markers" | "zones" | "active-profile" | "footprint-cells" | "dom-highlights" | "lower-pane" | "hybrid";
export type ExcessReplenishmentTreatment = "ordinary-stack" | "candidate-replenishment" | "ignore";

export interface IcebergRefreshSettings {
  schemaVersion: number;
  preset: "balanced" | "strict" | "nq-scalper" | "research" | "native-only" | "footprint" | "exhaustion" | "minimal-zones" | "current-profile" | "custom";
  visualizationMode: IcebergVisualizationMode;
  attributionWindowMs: number;
  minimumCycleExecution: number;
  minimumCycleReplenishment: number;
  minimumCycleReplenishmentRatio: number;
  minimumWatchingExecuted: number;
  minimumWatchingReplenished: number;
  activeMinimumExecuted: number;
  activeMinimumReplenished: number;
  minimumRefreshCycles: number;
  minimumReplenishmentRatio: number;
  minimumExecutionToDisplayRatio: number;
  minimumSamePriceDurationMs: number;
  maximumPenetrationTicks: number;
  minimumSuspectedCycles: number;
  minimumSuspectedExecuted: number;
  minimumSuspectedReplenishmentRatio: number;
  minimumSuspectedTurnover: number;
  minimumSuspectedScore: number;
  minimumQuality: number;
  maximumCandidateDurationMs: number;
  excessReplenishmentTreatment: ExcessReplenishmentTreatment;
  moveIntoLevelTreatment: "exclude" | "include-low-confidence" | "include-normal";
  requireExecutionBeforeRefresh: boolean;
  allowCancelThenRepostResearchMode: boolean;
  includeUnknownTrades: boolean;
  dynamicBaselineEnabled: boolean;
  baselineWindowMs: number;
  baselineSampleLimit: number;
  minimumBaselineSamples: number;
  relativeExecutedMultiplier: number;
  relativeReplenishedMultiplier: number;
  executedFullScoreThreshold: number;
  replenishedFullScoreThreshold: number;
  replenishmentRatioFullScore: number;
  turnoverFullScoreRatio: number;
  refreshCyclesFullScore: number;
  recoveryFullScoreRatio: number;
  persistenceFullScoreMs: number;
  pullPenaltyWeight: number;
  exhaustionDetectionEnabled: boolean;
  exhaustionWindowMs: number;
  maximumExhaustionReplenishmentRatio: number;
  minimumExhaustionExecuted: number;
  pulledStateEnabled: boolean;
  minimumPulledContracts: number;
  minimumPullRatio: number;
  breakToleranceTicks: number;
  minimumBreakVolume: number;
  minimumBreakTimeMs: number;
  retestEnabled: boolean;
  minimumDepartureTicks: number;
  touchToleranceTicks: number;
  minimumResponseTicks: number;
  maximumRetestsPerCandidate: number;
  zoneMergeEnabled: boolean;
  zoneMergeWindowMs: number;
  maximumZoneGapTicks: number;
  postSnapshotWarmupMs: number;
  baselineWarmupMs: number;
  staleAfterMs: number;
  historySeconds: number;
  maximumCandidates: number;
  maximumCycles: number;
  showHeader: boolean;
  showCycleCells: boolean;
  showMarkers: boolean;
  showZones: boolean;
  showActiveProfile: boolean;
  showLabels: boolean;
  showTooltips: boolean;
  showLowerPane: boolean;
  activeProfileWidth: number;
  markerSize: number;
  opacity: number;
  useThemeColors: boolean;
  bidColor: string;
  askColor: string;
  nativeColor: string;
  exhaustedColor: string;
  pulledColor: string;
  brokenColor: string;
  neutralColor: string;
  alertsEnabled: boolean;
  alertMinimumScore: number;
  alertMinimumQuality: number;
  alertOnRefresh: boolean;
  alertOnSuspected: boolean;
  alertOnExhausted: boolean;
  alertOnPulled: boolean;
  alertOnBroken: boolean;
}

export const DEFAULT_ICEBERG_REFRESH_SETTINGS: IcebergRefreshSettings = {
  schemaVersion: ICEBERG_REFRESH_SETTINGS_VERSION,
  preset: "balanced", visualizationMode: "hybrid",
  attributionWindowMs: 250, minimumCycleExecution: 10, minimumCycleReplenishment: 10, minimumCycleReplenishmentRatio: 0.5,
  minimumWatchingExecuted: 25, minimumWatchingReplenished: 10,
  activeMinimumExecuted: 100, activeMinimumReplenished: 50, minimumRefreshCycles: 2,
  minimumReplenishmentRatio: 0.5, minimumExecutionToDisplayRatio: 1.25, minimumSamePriceDurationMs: 100, maximumPenetrationTicks: 1,
  minimumSuspectedCycles: 3, minimumSuspectedExecuted: 200, minimumSuspectedReplenishmentRatio: 0.65, minimumSuspectedTurnover: 2, minimumSuspectedScore: 75, minimumQuality: 45,
  maximumCandidateDurationMs: 300_000, excessReplenishmentTreatment: "ordinary-stack", moveIntoLevelTreatment: "exclude", requireExecutionBeforeRefresh: true, allowCancelThenRepostResearchMode: false, includeUnknownTrades: false,
  dynamicBaselineEnabled: true, baselineWindowMs: 120_000, baselineSampleLimit: 4_000, minimumBaselineSamples: 30, relativeExecutedMultiplier: 3, relativeReplenishedMultiplier: 3,
  executedFullScoreThreshold: 300, replenishedFullScoreThreshold: 300, replenishmentRatioFullScore: 1, turnoverFullScoreRatio: 3, refreshCyclesFullScore: 4, recoveryFullScoreRatio: 1, persistenceFullScoreMs: 2_000, pullPenaltyWeight: 0.25,
  exhaustionDetectionEnabled: true, exhaustionWindowMs: 1_000, maximumExhaustionReplenishmentRatio: 0.2, minimumExhaustionExecuted: 50,
  pulledStateEnabled: true, minimumPulledContracts: 50, minimumPullRatio: 0.5,
  breakToleranceTicks: 1, minimumBreakVolume: 50, minimumBreakTimeMs: 250,
  retestEnabled: true, minimumDepartureTicks: 3, touchToleranceTicks: 1, minimumResponseTicks: 2, maximumRetestsPerCandidate: 3,
  zoneMergeEnabled: true, zoneMergeWindowMs: 1_000, maximumZoneGapTicks: 1,
  postSnapshotWarmupMs: 3_000, baselineWarmupMs: 20_000, staleAfterMs: 5_000, historySeconds: 3_600, maximumCandidates: 1_000, maximumCycles: 5_000,
  showHeader: true, showCycleCells: true, showMarkers: true, showZones: true, showActiveProfile: true, showLabels: true, showTooltips: true, showLowerPane: false,
  activeProfileWidth: 140, markerSize: 8, opacity: 100, useThemeColors: true,
  bidColor: "#22D3A7", askColor: "#FF3B78", nativeColor: "#A78BFA", exhaustedColor: "#F59E0B", pulledColor: "#FB7185", brokenColor: "#71717A", neutralColor: "#A1A1AA",
  alertsEnabled: false, alertMinimumScore: 75, alertMinimumQuality: 45, alertOnRefresh: false, alertOnSuspected: true, alertOnExhausted: true, alertOnPulled: true, alertOnBroken: true,
};

export const ICEBERG_REFRESH_PRESETS: Record<Exclude<IcebergRefreshSettings["preset"], "custom">, Partial<IcebergRefreshSettings>> = {
  balanced: { preset: "balanced", attributionWindowMs: 250, activeMinimumExecuted: 100, activeMinimumReplenished: 50, minimumRefreshCycles: 2, minimumReplenishmentRatio: 0.5, minimumExecutionToDisplayRatio: 1.25, minimumSuspectedCycles: 3, minimumSuspectedTurnover: 2, minimumSuspectedScore: 75, visualizationMode: "hybrid", showActiveProfile: true },
  strict: { preset: "strict", activeMinimumExecuted: 200, activeMinimumReplenished: 100, minimumRefreshCycles: 3, minimumReplenishmentRatio: 0.7, minimumExecutionToDisplayRatio: 2, minimumSuspectedScore: 82, minimumQuality: 75 },
  "nq-scalper": { preset: "nq-scalper", attributionWindowMs: 100, activeMinimumExecuted: 50, activeMinimumReplenished: 25, minimumRefreshCycles: 2, minimumExecutionToDisplayRatio: 1.25, historySeconds: 300, markerSize: 6 },
  research: { preset: "research", excessReplenishmentTreatment: "candidate-replenishment", visualizationMode: "price-time-cells", showCycleCells: true, showLabels: true, historySeconds: 7_200 },
  "native-only": { preset: "native-only" },
  footprint: { preset: "footprint", visualizationMode: "footprint-cells", showZones: false, showActiveProfile: false },
  exhaustion: { preset: "exhaustion", exhaustionDetectionEnabled: true, showCycleCells: true, alertOnExhausted: true },
  "minimal-zones": { preset: "minimal-zones", visualizationMode: "zones", showCycleCells: false, showMarkers: false, showActiveProfile: false, showLabels: false, minimumSuspectedScore: 80, opacity: 42 },
  "current-profile": { preset: "current-profile", visualizationMode: "active-profile", showCycleCells: false, showZones: false, showMarkers: false, showActiveProfile: true },
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T) => values.includes(String(value) as T) ? String(value) as T : fallback;

export function normalizeIcebergRefreshSettings(input?: Record<string, unknown> | null): IcebergRefreshSettings {
  const source = input ?? {}; const base = DEFAULT_ICEBERG_REFRESH_SETTINGS;
  const numeric: Array<[keyof IcebergRefreshSettings, number, number]> = [
    ["attributionWindowMs", 10, 10_000], ["minimumCycleExecution", 1, 1_000_000], ["minimumCycleReplenishment", 1, 1_000_000], ["minimumCycleReplenishmentRatio", 0, 10],
    ["minimumWatchingExecuted", 1, 1_000_000], ["minimumWatchingReplenished", 1, 1_000_000], ["activeMinimumExecuted", 1, 1_000_000], ["activeMinimumReplenished", 1, 1_000_000], ["minimumRefreshCycles", 1, 100],
    ["minimumReplenishmentRatio", 0, 10], ["minimumExecutionToDisplayRatio", 0, 100], ["minimumSamePriceDurationMs", 0, 300_000], ["maximumPenetrationTicks", 0, 1_000],
    ["minimumSuspectedCycles", 1, 100], ["minimumSuspectedExecuted", 1, 1_000_000], ["minimumSuspectedReplenishmentRatio", 0, 10], ["minimumSuspectedTurnover", 0, 100], ["minimumSuspectedScore", 0, 100], ["minimumQuality", 0, 100],
    ["maximumCandidateDurationMs", 1_000, 86_400_000], ["baselineWindowMs", 1_000, 86_400_000], ["baselineSampleLimit", 10, 100_000], ["minimumBaselineSamples", 1, 100_000], ["relativeExecutedMultiplier", 0.1, 50], ["relativeReplenishedMultiplier", 0.1, 50],
    ["executedFullScoreThreshold", 1, 1_000_000], ["replenishedFullScoreThreshold", 1, 1_000_000], ["replenishmentRatioFullScore", 0.01, 10], ["turnoverFullScoreRatio", 0.01, 100], ["refreshCyclesFullScore", 1, 100], ["recoveryFullScoreRatio", 0.01, 10], ["persistenceFullScoreMs", 1, 300_000], ["pullPenaltyWeight", 0, 1],
    ["exhaustionWindowMs", 10, 300_000], ["maximumExhaustionReplenishmentRatio", 0, 10], ["minimumExhaustionExecuted", 1, 1_000_000], ["minimumPulledContracts", 1, 1_000_000], ["minimumPullRatio", 0, 10],
    ["breakToleranceTicks", 0, 1_000], ["minimumBreakVolume", 0, 1_000_000], ["minimumBreakTimeMs", 0, 300_000], ["minimumDepartureTicks", 1, 1_000], ["touchToleranceTicks", 0, 100], ["minimumResponseTicks", 1, 1_000], ["maximumRetestsPerCandidate", 0, 100],
    ["zoneMergeWindowMs", 0, 300_000], ["maximumZoneGapTicks", 0, 100], ["postSnapshotWarmupMs", 0, 60_000], ["baselineWarmupMs", 0, 300_000], ["staleAfterMs", 250, 300_000], ["historySeconds", 30, 86_400], ["maximumCandidates", 10, 10_000], ["maximumCycles", 100, 50_000],
    ["activeProfileWidth", 90, 300], ["markerSize", 5, 17], ["opacity", 0, 100], ["alertMinimumScore", 0, 100], ["alertMinimumQuality", 0, 100],
  ];
  const result = { ...base, ...source, schemaVersion: ICEBERG_REFRESH_SETTINGS_VERSION } as IcebergRefreshSettings;
  for (const [key, minimum, maximum] of numeric) (result as unknown as Record<string, unknown>)[key] = clamp(finite(source[key], Number(base[key])), minimum, maximum);
  result.preset = oneOf(source.preset, ["balanced", "strict", "nq-scalper", "research", "native-only", "footprint", "exhaustion", "minimal-zones", "current-profile", "custom"], base.preset);
  result.visualizationMode = oneOf(source.visualizationMode, ["price-time-cells", "refresh-markers", "zones", "active-profile", "footprint-cells", "dom-highlights", "lower-pane", "hybrid"], base.visualizationMode);
  result.excessReplenishmentTreatment = oneOf(source.excessReplenishmentTreatment, ["ordinary-stack", "candidate-replenishment", "ignore"], base.excessReplenishmentTreatment);
  result.moveIntoLevelTreatment = oneOf(source.moveIntoLevelTreatment, ["exclude", "include-low-confidence", "include-normal"], base.moveIntoLevelTreatment);
  return result;
}

export interface IcebergRefreshCycle { id: string; candidateId: string; side: IcebergPassiveSide; priceTick: number; executionStartMs: number; replenishmentEndMs: number; executed: number; replenished: number; ordinaryStack: number; replenishmentRatio: number; displayedRecovery: number; evidenceLevel: IcebergEvidenceLevel; }
export interface IcebergCandidate { id: string; instrumentId: string; passiveSide: IcebergPassiveSide; priceTick: number; evidenceLevel: IcebergEvidenceLevel; state: IcebergCandidateState; startMs: number; lastUpdatedMs: number; confirmedMs?: number; initialDisplayedQuantity: number; peakDisplayedQuantity: number; minimumDisplayedQuantity: number; currentDisplayedQuantity: number; cumulativeAggressiveExecuted: number; cumulativeAttributedReplenishment: number; cumulativeOrdinaryStack: number; cumulativePulled: number; refreshCycleCount: number; completedRefreshCycleCount: number; largestCycleExecution: number; largestCycleReplenishment: number; replenishmentRatio: number; executionToPeakDisplayRatio: number; displayedRecoveryRatio: number; samePriceDurationMs: number; maximumPenetrationTicks: number; responseTicks: number; uniqueMakerOrderCount: number; nativeIcebergFlag: boolean; inferredReloadedQuantity: number; score: number; scoreComponents: Record<string, number>; quality: number; qualityWarnings: string[]; retestCount: number; departed: boolean; endCause?: string; }
export interface IcebergZone { id: string; side: IcebergPassiveSide; lowTick: number; highTick: number; centreTick: number; startMs: number; endMs: number | null; state: IcebergCandidateState; candidateIds: string[]; executed: number; replenished: number; cycles: number; score: number; }
export interface IcebergRefreshAlert { id: string; type: "REFRESH" | "SUSPECTED" | "EXHAUSTED" | "PULLED" | "BROKEN" | "RETEST" | "HELD" | "SEQUENCE_GAP"; candidate?: IcebergCandidate; }
export interface IcebergRefreshFrame { generatedAt: number; status: "CONNECTING" | "BUILDING_BOOK" | "CALIBRATING" | "LIVE" | "MBP_APPROXIMATION" | "STALE" | "BOOK_UPDATES_REQUIRED"; instrument: string; tickSize: number; lastPrice: number | null; bestBid: number | null; bestAsk: number | null; feedMode: "MBO_PRICE_LEVEL" | "MBP_APPROXIMATION" | "TRADE_ONLY"; nativeSupport: false; makerOrderSupport: false; replaceLineageSupport: false; candidates: IcebergCandidate[]; cycles: IcebergRefreshCycle[]; zones: IcebergZone[]; alerts: IcebergRefreshAlert[]; limitations: string[]; }

type Deficit = { id: string; candidateId: string; side: IcebergPassiveSide; tick: number; createdAt: number; expiresAt: number; executed: number; remaining: number; replenished: number; ordinaryStack: number; preDisplay: number; };
const levelKey = (side: IcebergPassiveSide, tick: number) => `${side}:${tick}`;
const clamp01 = (value: number) => clamp(value, 0, 1);
const median = (values: number[]) => { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
const priceToTick = (price: number, tickSize: number) => Math.round(price / tickSize);

function candidateScore(candidate: IcebergCandidate, settings: IcebergRefreshSettings, dynamicExecutedFloor: number) {
  const components = {
    executed: clamp01(candidate.cumulativeAggressiveExecuted / settings.executedFullScoreThreshold),
    relativeExecuted: clamp01(candidate.cumulativeAggressiveExecuted / Math.max(1, dynamicExecutedFloor) - 1),
    replenished: clamp01(candidate.cumulativeAttributedReplenishment / settings.replenishedFullScoreThreshold),
    ratio: clamp01(candidate.replenishmentRatio / settings.replenishmentRatioFullScore),
    turnover: clamp01(candidate.executionToPeakDisplayRatio / settings.turnoverFullScoreRatio),
    cycles: clamp01(candidate.completedRefreshCycleCount / settings.refreshCyclesFullScore),
    recovery: clamp01(candidate.displayedRecoveryRatio / settings.recoveryFullScoreRatio),
    persistence: clamp01(candidate.samePriceDurationMs / settings.persistenceFullScoreMs),
    lowPenetration: 1 - clamp01(candidate.maximumPenetrationTicks / Math.max(1, settings.maximumPenetrationTicks)),
  };
  const weights: Record<keyof typeof components, number> = { executed: 0.15, relativeExecuted: 0.09, replenished: 0.14, ratio: 0.15, turnover: 0.16, cycles: 0.14, recovery: 0.08, persistence: 0.04, lowPenetration: 0.05 };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const positive = (Object.keys(components) as Array<keyof typeof components>).reduce((sum, key) => sum + components[key] * weights[key], 0) / total;
  const pullPenalty = clamp01(candidate.cumulativePulled / Math.max(1, candidate.cumulativeAttributedReplenishment + candidate.cumulativePulled));
  return { score: Math.round(100 * positive * (1 - settings.pullPenaltyWeight * pullPenalty)), components };
}

export class IcebergRefreshDetectorEngine {
  private instrument = "";
  private levels = new Map<string, number>();
  private candidates = new Map<string, IcebergCandidate>();
  private deficits = new Map<string, Deficit[]>();
  private cycles: IcebergRefreshCycle[] = [];
  private seenTrades = new Set<string>();
  private seenEvents = new Set<string>();
  private lastSequence = 0;
  private sequenceGap = false;
  private snapshotReadyAt = 0;
  private baseline: Array<{ timestamp: number; executed: number; replenished: number }> = [];

  reset() { this.instrument = ""; this.levels.clear(); this.candidates.clear(); this.deficits.clear(); this.cycles = []; this.seenTrades.clear(); this.seenEvents.clear(); this.lastSequence = 0; this.sequenceGap = false; this.snapshotReadyAt = 0; this.baseline = []; }

  private ensureCandidate(instrument: string, side: IcebergPassiveSide, tick: number, timestamp: number, displayed: number) {
    const key = levelKey(side, tick); const existing = this.candidates.get(key);
    if (existing && !["EXPIRED", "BROKEN"].includes(existing.state)) return existing;
    const candidate: IcebergCandidate = { id: `${instrument}:${key}:${Math.floor(timestamp / 1_000)}`, instrumentId: instrument, passiveSide: side, priceTick: tick, evidenceLevel: "price-level-aggregate", state: "WATCHING", startMs: timestamp, lastUpdatedMs: timestamp, initialDisplayedQuantity: displayed, peakDisplayedQuantity: displayed, minimumDisplayedQuantity: displayed, currentDisplayedQuantity: displayed, cumulativeAggressiveExecuted: 0, cumulativeAttributedReplenishment: 0, cumulativeOrdinaryStack: 0, cumulativePulled: 0, refreshCycleCount: 0, completedRefreshCycleCount: 0, largestCycleExecution: 0, largestCycleReplenishment: 0, replenishmentRatio: 0, executionToPeakDisplayRatio: 0, displayedRecoveryRatio: 0, samePriceDurationMs: 0, maximumPenetrationTicks: 0, responseTicks: 0, uniqueMakerOrderCount: 0, nativeIcebergFlag: false, inferredReloadedQuantity: 0, score: 0, scoreComponents: {}, quality: 0, qualityWarnings: ["Maker-order IDs are not exposed on trades.", "Native iceberg and reserve fields are not exposed by the current feed."], retestCount: 0, departed: false };
    this.candidates.set(key, candidate); return candidate;
  }

  private eventAddition(event: RithmicOrderLifecycleEvent) { if (event.action === "ADD") return event.size; if (event.action === "MODIFY" && event.previousPrice === event.price) return Math.max(0, event.size - event.previousSize); return 0; }
  private eventReduction(event: RithmicOrderLifecycleEvent) { if (event.action === "REMOVE") return event.previousSize; if (event.action === "MODIFY" && event.previousPrice === event.price) return Math.max(0, event.previousSize - event.size); return 0; }

  apply(snapshot: RithmicLiquiditySnapshot, settingsInput?: IcebergRefreshSettings): IcebergRefreshFrame {
    const settings = normalizeIcebergRefreshSettings(settingsInput as unknown as Record<string, unknown>); const timestamp = Date.parse(snapshot.asOf) || Date.now(); const tickSize = snapshot.tickSize || 0.25; const instrument = snapshot.contractSymbol || "UNKNOWN"; const alerts: IcebergRefreshAlert[] = [];
    if (this.instrument && this.instrument !== instrument) this.reset(); this.instrument = instrument;
    const currentLevels = new Map<string, number>();
    for (const level of snapshot.levels) currentLevels.set(levelKey(level.side, priceToTick(level.price, tickSize)), Math.max(0, level.size));
    if (!snapshot.bookValid) return this.frame(snapshot, settings, timestamp, "BUILDING_BOOK", alerts);
    if (!this.snapshotReadyAt) {
      this.snapshotReadyAt = timestamp;
      this.levels = currentLevels;
      for (const trade of snapshot.trades ?? []) this.seenTrades.add(`${trade.id}:${trade.timestamp}:${trade.price}:${trade.size}:${trade.side}`);
      for (const event of snapshot.orderEvents ?? []) {
        this.seenEvents.add(`${event.sequence}:${event.timestamp}:${event.orderId}:${event.action}:${event.side}:${event.previousPrice}:${event.price}:${event.previousSize}:${event.size}`);
        if (event.sequence > this.lastSequence) this.lastSequence = event.sequence;
      }
      return this.frame(snapshot, settings, timestamp, "CALIBRATING", alerts);
    }

    // A fresh snapshot is a depth baseline, not evidence. Consume identifiers
    // during warmup so buffered history cannot be mistaken for a live refresh.
    if (timestamp - this.snapshotReadyAt < settings.postSnapshotWarmupMs) {
      for (const trade of snapshot.trades ?? []) this.seenTrades.add(`${trade.id}:${trade.timestamp}:${trade.price}:${trade.size}:${trade.side}`);
      for (const event of snapshot.orderEvents ?? []) {
        this.seenEvents.add(`${event.sequence}:${event.timestamp}:${event.orderId}:${event.action}:${event.side}:${event.previousPrice}:${event.price}:${event.previousSize}:${event.size}`);
        if (event.sequence > this.lastSequence) this.lastSequence = event.sequence;
      }
      this.levels = currentLevels;
      return this.frame(snapshot, settings, timestamp, "CALIBRATING", alerts);
    }

    const events = [...(snapshot.orderEvents ?? [])].sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp);
    for (const event of events) {
      if (event.sequence > 0 && event.sequence <= this.lastSequence) continue;
      if (event.sequence > 0 && this.lastSequence > 0 && event.sequence > this.lastSequence + 1) { this.sequenceGap = true; alerts.push({ id: `sequence-gap:${instrument}:${event.sequence}`, type: "SEQUENCE_GAP" }); }
      if (event.sequence > 0) this.lastSequence = event.sequence;
    }
    if (this.sequenceGap) {
      // A complete valid snapshot is the resynchronisation boundary exposed by
      // the current gateway. Rebaseline depth and suppress this frame.
      this.levels = currentLevels; this.deficits.clear(); this.sequenceGap = false; this.snapshotReadyAt = timestamp;
      return this.frame(snapshot, settings, timestamp, "CALIBRATING", alerts);
    }

    const batchExecuted = new Map<string, number>();
    const newTrades = [...(snapshot.trades ?? [])].sort((a, b) => a.timestamp - b.timestamp).filter((trade) => {
      const identity = `${trade.id}:${trade.timestamp}:${trade.price}:${trade.size}:${trade.side}`; if (this.seenTrades.has(identity)) return false; this.seenTrades.add(identity); return true;
    });
    for (const trade of newTrades) {
      const side: IcebergPassiveSide = trade.side === "SELL" ? "BID" : "ASK"; const tick = priceToTick(trade.price, tickSize); const key = levelKey(side, tick); const displayed = Math.max(0, this.levels.get(key) ?? currentLevels.get(key) ?? 0);
      if (trade.size < settings.minimumCycleExecution || displayed <= 0) continue;
      const candidate = this.ensureCandidate(instrument, side, tick, trade.timestamp, displayed); candidate.cumulativeAggressiveExecuted += trade.size; candidate.largestCycleExecution = Math.max(candidate.largestCycleExecution, trade.size); candidate.peakDisplayedQuantity = Math.max(candidate.peakDisplayedQuantity, displayed); candidate.minimumDisplayedQuantity = Math.min(candidate.minimumDisplayedQuantity, Math.max(0, displayed - trade.size)); candidate.lastUpdatedMs = trade.timestamp; candidate.refreshCycleCount += 1;
      const deficit: Deficit = { id: `${candidate.id}:D:${trade.id}:${trade.timestamp}`, candidateId: candidate.id, side, tick, createdAt: trade.timestamp, expiresAt: trade.timestamp + settings.attributionWindowMs, executed: trade.size, remaining: Math.min(trade.size, displayed), replenished: 0, ordinaryStack: 0, preDisplay: displayed };
      this.deficits.set(key, [...(this.deficits.get(key) ?? []), deficit]); batchExecuted.set(key, (batchExecuted.get(key) ?? 0) + trade.size);
    }

    for (const event of events) {
      const identity = `${event.sequence}:${event.timestamp}:${event.orderId}:${event.action}:${event.side}:${event.previousPrice}:${event.price}:${event.previousSize}:${event.size}`; if (this.seenEvents.has(identity)) continue; this.seenEvents.add(identity);
      const side = event.side; const tick = priceToTick(event.price, tickSize); const key = levelKey(side, tick); const moved = event.previousPrice != null && priceToTick(event.previousPrice, tickSize) !== tick;
      const addition = moved ? event.size : this.eventAddition(event);
      if (addition > 0 && (!moved || settings.moveIntoLevelTreatment !== "exclude")) {
        let remainingAdd = addition; const queue = this.deficits.get(key) ?? [];
        for (const deficit of queue) {
          if (remainingAdd <= 0 || event.timestamp < deficit.createdAt || event.timestamp > deficit.expiresAt || deficit.remaining <= 0) continue;
          const attributed = settings.excessReplenishmentTreatment === "candidate-replenishment" ? remainingAdd : Math.min(remainingAdd, deficit.remaining);
          deficit.replenished += attributed; deficit.remaining = Math.max(0, deficit.remaining - attributed); remainingAdd -= attributed;
          const candidate = [...this.candidates.values()].find((item) => item.id === deficit.candidateId); if (!candidate) continue;
          candidate.cumulativeAttributedReplenishment += attributed; candidate.largestCycleReplenishment = Math.max(candidate.largestCycleReplenishment, attributed); candidate.lastUpdatedMs = event.timestamp;
          const ratio = deficit.replenished / Math.max(1, deficit.executed);
          if (deficit.replenished >= settings.minimumCycleReplenishment && ratio >= settings.minimumCycleReplenishmentRatio && !this.cycles.some((cycle) => cycle.id === deficit.id)) {
            const displayedAfter = currentLevels.get(key) ?? Math.max(0, deficit.preDisplay - deficit.executed + deficit.replenished);
            const cycle: IcebergRefreshCycle = { id: deficit.id, candidateId: candidate.id, side, priceTick: tick, executionStartMs: deficit.createdAt, replenishmentEndMs: event.timestamp, executed: deficit.executed, replenished: deficit.replenished, ordinaryStack: 0, replenishmentRatio: ratio, displayedRecovery: displayedAfter / Math.max(1, deficit.preDisplay), evidenceLevel: "price-level-aggregate" };
            this.cycles.push(cycle); candidate.completedRefreshCycleCount += 1; alerts.push({ id: `${candidate.id}:REFRESH:${candidate.completedRefreshCycleCount}`, type: "REFRESH", candidate: { ...candidate } });
          }
        }
        if (remainingAdd > 0) { const candidate = this.candidates.get(key); if (candidate) candidate.cumulativeOrdinaryStack += remainingAdd; }
      }
      const reduction = this.eventReduction(event);
      if (reduction > 0) {
        const executed = batchExecuted.get(key) ?? 0; const nonExecuted = Math.max(0, reduction - executed); batchExecuted.set(key, Math.max(0, executed - reduction)); const candidate = this.candidates.get(key);
        if (candidate && nonExecuted > 0) { candidate.cumulativePulled += nonExecuted; candidate.lastUpdatedMs = event.timestamp; }
      }
    }

    const recoveryByCandidate = new Map<string, number[]>();
    for (const cycle of this.cycles) { const values = recoveryByCandidate.get(cycle.candidateId) ?? []; values.push(cycle.displayedRecovery); recoveryByCandidate.set(cycle.candidateId, values); }
    const lastTick = snapshot.lastPrice == null ? null : priceToTick(snapshot.lastPrice, tickSize);
    for (const [key, candidate] of this.candidates) {
      const oldState = candidate.state; candidate.currentDisplayedQuantity = currentLevels.get(key) ?? 0; candidate.peakDisplayedQuantity = Math.max(candidate.peakDisplayedQuantity, candidate.currentDisplayedQuantity); candidate.minimumDisplayedQuantity = Math.min(candidate.minimumDisplayedQuantity, candidate.currentDisplayedQuantity); candidate.replenishmentRatio = candidate.cumulativeAttributedReplenishment / Math.max(1, candidate.cumulativeAggressiveExecuted); candidate.executionToPeakDisplayRatio = candidate.cumulativeAggressiveExecuted / Math.max(1, candidate.peakDisplayedQuantity); candidate.displayedRecoveryRatio = median(recoveryByCandidate.get(candidate.id) ?? []); candidate.inferredReloadedQuantity = candidate.cumulativeAttributedReplenishment; candidate.samePriceDurationMs = Math.max(0, timestamp - candidate.startMs);
      if (lastTick != null) { const penetration = candidate.passiveSide === "BID" ? Math.max(0, candidate.priceTick - lastTick) : Math.max(0, lastTick - candidate.priceTick); candidate.maximumPenetrationTicks = Math.max(candidate.maximumPenetrationTicks, penetration); const departure = candidate.passiveSide === "BID" ? lastTick - candidate.priceTick : candidate.priceTick - lastTick; if (departure >= settings.minimumDepartureTicks) candidate.departed = true; if (candidate.departed && Math.abs(lastTick - candidate.priceTick) <= settings.touchToleranceTicks && settings.retestEnabled && candidate.retestCount < settings.maximumRetestsPerCandidate && !["BROKEN", "EXPIRED"].includes(candidate.state)) { candidate.state = "RETESTING"; candidate.retestCount += 1; alerts.push({ id: `${candidate.id}:RETEST:${candidate.retestCount}`, type: "RETEST", candidate: { ...candidate } }); } if (candidate.state === "RETESTING" && departure >= settings.minimumResponseTicks) { candidate.state = "HELD"; alerts.push({ id: `${candidate.id}:HELD:${candidate.retestCount}`, type: "HELD", candidate: { ...candidate } }); } }
      const dynamicExecutedFloor = this.dynamicFloor(settings, "executed", timestamp); const scored = candidateScore(candidate, settings, dynamicExecutedFloor); candidate.score = scored.score; candidate.scoreComponents = scored.components; candidate.quality = Math.round(100 * (0.2 + 0.2 + (snapshot.bookValid ? 0.2 : 0) + 0 + (snapshot.ageMs != null && snapshot.ageMs <= settings.staleAfterMs ? 0.1 : 0) + (snapshot.fullDepth ? 0.05 : 0)) / 0.75);
      const active = candidate.cumulativeAggressiveExecuted >= Math.max(settings.activeMinimumExecuted, dynamicExecutedFloor) && candidate.cumulativeAttributedReplenishment >= settings.activeMinimumReplenished && candidate.completedRefreshCycleCount >= settings.minimumRefreshCycles && candidate.replenishmentRatio >= settings.minimumReplenishmentRatio && candidate.executionToPeakDisplayRatio >= settings.minimumExecutionToDisplayRatio && candidate.samePriceDurationMs >= settings.minimumSamePriceDurationMs && candidate.maximumPenetrationTicks <= settings.maximumPenetrationTicks;
      if (active && !["SUSPECTED", "HELD", "RETESTING", "EXHAUSTED", "PULLED", "BROKEN"].includes(candidate.state)) candidate.state = "REFRESHING";
      if (candidate.state === "REFRESHING" && candidate.completedRefreshCycleCount >= settings.minimumSuspectedCycles && candidate.cumulativeAggressiveExecuted >= settings.minimumSuspectedExecuted && candidate.replenishmentRatio >= settings.minimumSuspectedReplenishmentRatio && candidate.executionToPeakDisplayRatio >= settings.minimumSuspectedTurnover && candidate.score >= settings.minimumSuspectedScore && candidate.quality >= settings.minimumQuality) { candidate.state = "SUSPECTED"; candidate.confirmedMs ??= timestamp; }
      const pullRatio = candidate.cumulativePulled / Math.max(1, candidate.peakDisplayedQuantity + candidate.cumulativeAttributedReplenishment); if (settings.pulledStateEnabled && candidate.cumulativePulled >= settings.minimumPulledContracts && pullRatio >= settings.minimumPullRatio) { candidate.state = "PULLED"; candidate.endCause = "Significant non-executed displayed quantity was removed."; }
      if (lastTick != null && candidate.cumulativeAggressiveExecuted >= settings.minimumBreakVolume && ((candidate.passiveSide === "BID" && lastTick < candidate.priceTick - settings.breakToleranceTicks) || (candidate.passiveSide === "ASK" && lastTick > candidate.priceTick + settings.breakToleranceTicks)) && timestamp - candidate.lastUpdatedMs >= settings.minimumBreakTimeMs) { candidate.state = "BROKEN"; candidate.endCause = candidate.cumulativePulled > 0 ? "Broken after pull or execution; final cause is not identifiable." : "Broken after execution; no participant intent is inferred."; }
      if (timestamp - candidate.startMs > settings.maximumCandidateDurationMs && !["BROKEN", "PULLED"].includes(candidate.state)) candidate.state = "EXPIRED";
      if (oldState !== candidate.state && ["SUSPECTED", "PULLED", "BROKEN"].includes(candidate.state)) alerts.push({ id: `${candidate.id}:${candidate.state}`, type: candidate.state, candidate: { ...candidate } } as IcebergRefreshAlert);
      if (candidate.completedRefreshCycleCount && oldState !== candidate.state) this.baseline.push({ timestamp, executed: candidate.cumulativeAggressiveExecuted, replenished: candidate.cumulativeAttributedReplenishment });
    }
    for (const [key, queue] of this.deficits) {
      const active: Deficit[] = [];
      for (const deficit of queue) { if (timestamp <= deficit.expiresAt) { active.push(deficit); continue; } const candidate = [...this.candidates.values()].find((item) => item.id === deficit.candidateId); const ratio = deficit.replenished / Math.max(1, deficit.executed); if (candidate && settings.exhaustionDetectionEnabled && candidate.completedRefreshCycleCount > 0 && deficit.executed >= settings.minimumExhaustionExecuted && ratio <= settings.maximumExhaustionReplenishmentRatio && timestamp - deficit.expiresAt >= settings.exhaustionWindowMs && !["BROKEN", "PULLED"].includes(candidate.state)) { candidate.state = "EXHAUSTED"; candidate.endCause = "Aggressive execution continued while displayed replenishment weakened."; alerts.push({ id: `${candidate.id}:EXHAUSTED:${deficit.id}`, type: "EXHAUSTED", candidate: { ...candidate } }); } } this.deficits.set(key, active);
    }
    this.levels = currentLevels; this.prune(timestamp, settings);
    const status = timestamp - this.snapshotReadyAt < settings.postSnapshotWarmupMs ? "CALIBRATING" : snapshot.ageMs != null && snapshot.ageMs > settings.staleAfterMs ? "STALE" : snapshot.individualOrders ? "LIVE" : "MBP_APPROXIMATION";
    return this.frame(snapshot, settings, timestamp, status, alerts);
  }

  private dynamicFloor(settings: IcebergRefreshSettings, metric: "executed" | "replenished", now: number) { this.baseline = this.baseline.filter((sample) => now - sample.timestamp <= settings.baselineWindowMs).slice(-settings.baselineSampleLimit); if (!settings.dynamicBaselineEnabled || this.baseline.length < settings.minimumBaselineSamples) return metric === "executed" ? settings.activeMinimumExecuted : settings.activeMinimumReplenished; const values = this.baseline.map((sample) => sample[metric]).sort((a, b) => a - b); const p90 = values[Math.floor((values.length - 1) * 0.9)] ?? 0; return Math.max(metric === "executed" ? settings.activeMinimumExecuted : settings.activeMinimumReplenished, median(values) * (metric === "executed" ? settings.relativeExecutedMultiplier : settings.relativeReplenishedMultiplier), p90); }
  private prune(timestamp: number, settings: IcebergRefreshSettings) { const cutoff = timestamp - settings.historySeconds * 1_000; this.cycles = this.cycles.filter((cycle) => cycle.replenishmentEndMs >= cutoff).slice(-settings.maximumCycles); const candidates = [...this.candidates.entries()].filter(([, candidate]) => candidate.lastUpdatedMs >= cutoff || !["BROKEN", "EXPIRED"].includes(candidate.state)).slice(-settings.maximumCandidates); this.candidates = new Map(candidates); if (this.seenTrades.size > 100_000) this.seenTrades.clear(); if (this.seenEvents.size > 100_000) this.seenEvents.clear(); }
  private zones(settings: IcebergRefreshSettings, timestamp: number): IcebergZone[] { const source = [...this.candidates.values()].filter((candidate) => ["REFRESHING", "SUSPECTED", "NATIVE", "RETESTING", "HELD", "EXHAUSTED", "PULLED", "BROKEN"].includes(candidate.state)).sort((a, b) => a.passiveSide.localeCompare(b.passiveSide) || a.priceTick - b.priceTick); const zones: IcebergZone[] = []; for (const candidate of source) { const previous = zones.at(-1); if (settings.zoneMergeEnabled && previous && previous.side === candidate.passiveSide && candidate.priceTick - previous.highTick <= settings.maximumZoneGapTicks && candidate.startMs - previous.startMs <= settings.zoneMergeWindowMs) { previous.highTick = Math.max(previous.highTick, candidate.priceTick); previous.lowTick = Math.min(previous.lowTick, candidate.priceTick); previous.candidateIds.push(candidate.id); previous.executed += candidate.cumulativeAggressiveExecuted; previous.replenished += candidate.cumulativeAttributedReplenishment; previous.cycles += candidate.completedRefreshCycleCount; previous.score = Math.max(previous.score, candidate.score); previous.centreTick = Math.round((previous.centreTick * Math.max(1, previous.executed - candidate.cumulativeAggressiveExecuted) + candidate.priceTick * candidate.cumulativeAggressiveExecuted) / Math.max(1, previous.executed)); previous.state = candidate.state; continue; } zones.push({ id: `IZ:${candidate.id}`, side: candidate.passiveSide, lowTick: candidate.priceTick, highTick: candidate.priceTick, centreTick: candidate.priceTick, startMs: candidate.startMs, endMs: ["BROKEN", "EXPIRED"].includes(candidate.state) ? candidate.lastUpdatedMs : null, state: candidate.state, candidateIds: [candidate.id], executed: candidate.cumulativeAggressiveExecuted, replenished: candidate.cumulativeAttributedReplenishment, cycles: candidate.completedRefreshCycleCount, score: candidate.score }); } return zones; }
  private frame(snapshot: RithmicLiquiditySnapshot, settings: IcebergRefreshSettings, timestamp: number, status: IcebergRefreshFrame["status"], alerts: IcebergRefreshAlert[]): IcebergRefreshFrame { return { generatedAt: timestamp, status, instrument: snapshot.contractSymbol, tickSize: snapshot.tickSize, lastPrice: snapshot.lastPrice ?? snapshot.microPrice ?? null, bestBid: snapshot.bestBid ?? null, bestAsk: snapshot.bestAsk ?? null, feedMode: snapshot.individualOrders ? "MBO_PRICE_LEVEL" : snapshot.fullDepth ? "MBP_APPROXIMATION" : "TRADE_ONLY", nativeSupport: false, makerOrderSupport: false, replaceLineageSupport: false, candidates: [...this.candidates.values()], cycles: [...this.cycles], zones: this.zones(settings, timestamp), alerts, limitations: ["Trade events do not expose maker-order IDs, so refresh evidence is price-level aggregate.", "Replace/parent chains and native iceberg, displayed-total and reserve fields are not exposed by the current normalized feed.", "Suspected Iceberg is an inference; identity and intent are not established."] }; }
}
