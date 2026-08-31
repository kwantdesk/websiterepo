import type { RithmicLiquiditySnapshot, RithmicOrderLifecycleEvent } from "@/lib/structureLevels";

export type PullingStackingClassificationMode = "price-level" | "individual-order";
export type PullingStackingMoveHandling = "separate-move" | "pull-and-stack" | "ignore-correlated-move";
export type PullingStackingAggregationMode = "fixed-window" | "rolling-window" | "chart-bar";
export type PullingStackingRenderMode = "hybrid" | "heat-cells" | "ribbons" | "event-markers" | "current-profile" | "lower-pane";
export type PullingStackingLowerPaneMode = "four-series" | "directional-pressure" | "net-book-change" | "churn" | "velocity" | "stack-pull-ratio";
export type PullingStackingPreset = "balanced" | "scalper" | "wall-tracker" | "liquidity-vacuum" | "pull-repost-research" | "minimal-overlay" | "current-profile" | "lower-pane" | "custom";
export type PullingStackingEventKind = "BID_STACK" | "ASK_STACK" | "BID_PULL" | "ASK_PULL" | "BID_WALL_BUILD" | "ASK_WALL_BUILD" | "BID_WALL_COLLAPSE" | "ASK_WALL_COLLAPSE" | "BID_LIQUIDITY_VACUUM" | "ASK_LIQUIDITY_VACUUM" | "PULL_REPOST";

export type PullingStackingSettings = {
  preset: PullingStackingPreset;
  classificationMode: PullingStackingClassificationMode;
  moveHandling: PullingStackingMoveHandling;
  aggregationMode: PullingStackingAggregationMode;
  renderMode: PullingStackingRenderMode;
  lowerPaneMode: PullingStackingLowerPaneMode;
  aggregationMs: number;
  rollingWindowMs: number;
  eventMergeGapMs: number;
  postSnapshotWarmupMs: number;
  baselineWarmupMs: number;
  historySeconds: number;
  baselineWindowMs: number;
  baselineSampleLimit: number;
  minimumBaselineSamples: number;
  baselineBuckets: number;
  minimumContracts: number;
  relativeThreshold: number;
  selectedPercentile: number;
  scoreThreshold: number;
  markerMinimumScore: number;
  visibleTicks: number;
  currentProfileWidth: number;
  profileWidthPercent: number;
  minimumProfileWidthPx: number;
  maximumProfileWidthPx: number;
  latestWindowMs: number;
  lowerPaneHeight: number;
  markerSize: number;
  maximumEvents: number;
  maximumBuckets: number;
  staleAfterMs: number;
  markerRetentionMs: number;
  opacity: number;
  minimumOpacity: number;
  maximumOpacity: number;
  minimumCellHeightPx: number;
  maximumCellHeightPx: number;
  includeOwnOrders: boolean;
  includeImpliedOrders: boolean;
  bidEnabled: boolean;
  askEnabled: boolean;
  showHeatCells: boolean;
  showRibbons: boolean;
  showEventMarkers: boolean;
  showCurrentProfile: boolean;
  showLiveDepth: boolean;
  showLowerPane: boolean;
  showLabels: boolean;
  showHeader: boolean;
  showTooltips: boolean;
  showWallBuild: boolean;
  showWallCollapse: boolean;
  showLiquidityVacuum: boolean;
  wallMinimumContracts: number;
  wallMinimumLevels: number;
  wallMaximumGapTicks: number;
  wallBuildWindowMs: number;
  wallMinimumRelativeMultiplier: number;
  wallMinimumScore: number;
  wallPersistenceMs: number;
  collapseMinimumPulledContracts: number;
  collapseMinimumRatio: number;
  collapseMaximumExecutedRatio: number;
  collapseWindowMs: number;
  vacuumMinimumLevels: number;
  vacuumMinimumContracts: number;
  vacuumMaximumGapTicks: number;
  vacuumWindowMs: number;
  vacuumMinimumDepthRemovalRatio: number;
  vacuumMinimumScore: number;
  pullRepostEnabled: boolean;
  repostWindowMs: number;
  repostPriceToleranceTicks: number;
  repostSizeTolerance: number;
  repostMinimumQuantity: number;
  repostMinimumScore: number;
  enableAlerts: boolean;
  alertCooldownMs: number;
  useThemeColors: boolean;
  bidStackColor: string;
  askStackColor: string;
  bidPullColor: string;
  askPullColor: string;
  moveColor: string;
  neutralColor: string;
  pullingStackingSettingsVersion: number;
};

export const PULLING_STACKING_SETTINGS_VERSION = 2;

export const DEFAULT_PULLING_STACKING_SETTINGS: PullingStackingSettings = {
  preset: "balanced", classificationMode: "price-level", moveHandling: "separate-move", aggregationMode: "fixed-window", renderMode: "hybrid", lowerPaneMode: "directional-pressure",
  aggregationMs: 250, rollingWindowMs: 10_000, eventMergeGapMs: 75, postSnapshotWarmupMs: 3_000, baselineWarmupMs: 20_000,
  historySeconds: 300, baselineWindowMs: 60_000, baselineSampleLimit: 4_000, minimumBaselineSamples: 30, baselineBuckets: 60,
  minimumContracts: 25, relativeThreshold: 3, selectedPercentile: .9, scoreThreshold: 65, markerMinimumScore: 65,
  visibleTicks: 120, currentProfileWidth: 156, profileWidthPercent: 13, minimumProfileWidthPx: 110, maximumProfileWidthPx: 280, latestWindowMs: 1_000,
  lowerPaneHeight: 160, markerSize: 7, maximumEvents: 1_000, maximumBuckets: 4_000, staleAfterMs: 5_000, markerRetentionMs: 300_000,
  opacity: 100, minimumOpacity: .025, maximumOpacity: .42, minimumCellHeightPx: 2, maximumCellHeightPx: 24,
  includeOwnOrders: false, includeImpliedOrders: false, bidEnabled: true, askEnabled: true,
  showHeatCells: true, showRibbons: false, showEventMarkers: true, showCurrentProfile: true, showLiveDepth: true, showLowerPane: false,
  showLabels: true, showHeader: true, showTooltips: true, showWallBuild: true, showWallCollapse: true, showLiquidityVacuum: true,
  wallMinimumContracts: 150, wallMinimumLevels: 1, wallMaximumGapTicks: 1, wallBuildWindowMs: 500, wallMinimumRelativeMultiplier: 3, wallMinimumScore: 65, wallPersistenceMs: 250,
  collapseMinimumPulledContracts: 100, collapseMinimumRatio: .6, collapseMaximumExecutedRatio: .25, collapseWindowMs: 1_500,
  vacuumMinimumLevels: 3, vacuumMinimumContracts: 200, vacuumMaximumGapTicks: 1, vacuumWindowMs: 300, vacuumMinimumDepthRemovalRatio: .5, vacuumMinimumScore: 70,
  pullRepostEnabled: false, repostWindowMs: 1_000, repostPriceToleranceTicks: 2, repostSizeTolerance: .3, repostMinimumQuantity: 50, repostMinimumScore: 65,
  enableAlerts: false, alertCooldownMs: 5_000, useThemeColors: true,
  bidStackColor: "#22C55E", askStackColor: "#EF4444", bidPullColor: "#F59E0B", askPullColor: "#38BDF8", moveColor: "#A78BFA", neutralColor: "#A1A1AA",
  pullingStackingSettingsVersion: PULLING_STACKING_SETTINGS_VERSION,
};

export const PULLING_STACKING_PRESETS: Record<Exclude<PullingStackingPreset, "custom">, Partial<PullingStackingSettings>> = {
  balanced: { preset: "balanced", aggregationMs: 250, renderMode: "hybrid", showHeatCells: true, showRibbons: false, showCurrentProfile: true, showLowerPane: false },
  scalper: { preset: "scalper", aggregationMs: 100, rollingWindowMs: 3_000, minimumContracts: 10, scoreThreshold: 55, markerMinimumScore: 60, historySeconds: 120 },
  "wall-tracker": { preset: "wall-tracker", showHeatCells: true, showRibbons: true, showWallBuild: true, showWallCollapse: true },
  "liquidity-vacuum": { preset: "liquidity-vacuum", showHeatCells: true, showLiquidityVacuum: true, vacuumMinimumScore: 65 },
  "pull-repost-research": { preset: "pull-repost-research", pullRepostEnabled: true, showEventMarkers: true, markerMinimumScore: 55 },
  "minimal-overlay": { preset: "minimal-overlay", renderMode: "heat-cells", showHeatCells: true, showRibbons: false, showEventMarkers: false, showCurrentProfile: false, showLowerPane: false },
  "current-profile": { preset: "current-profile", renderMode: "current-profile", showHeatCells: false, showRibbons: false, showEventMarkers: false, showCurrentProfile: true, showLowerPane: false },
  "lower-pane": { preset: "lower-pane", renderMode: "lower-pane", showHeatCells: false, showRibbons: false, showEventMarkers: false, showCurrentProfile: false, showLowerPane: true },
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(String(value) as T) ? String(value) as T : fallback;

export function normalizePullingStackingSettings(value: Record<string, unknown> | null | undefined): PullingStackingSettings {
  const source = value ?? {}; const defaults = DEFAULT_PULLING_STACKING_SETTINGS;
  const n = (key: keyof PullingStackingSettings, lo: number, hi: number, integer = false) => { const result = clamp(finite(source[key], defaults[key] as number), lo, hi); return integer ? Math.round(result) : result; };
  return {
    ...defaults, ...source,
    preset: choice(source.preset, [...Object.keys(PULLING_STACKING_PRESETS), "custom"] as PullingStackingPreset[], "balanced"),
    classificationMode: choice(source.classificationMode, ["price-level", "individual-order"] as const, "price-level"),
    moveHandling: choice(source.moveHandling, ["separate-move", "pull-and-stack", "ignore-correlated-move"] as const, "separate-move"),
    aggregationMode: choice(source.aggregationMode, ["fixed-window", "rolling-window", "chart-bar"] as const, "fixed-window"),
    renderMode: choice(source.renderMode, ["hybrid", "heat-cells", "ribbons", "event-markers", "current-profile", "lower-pane"] as const, "hybrid"),
    lowerPaneMode: choice(source.lowerPaneMode, ["four-series", "directional-pressure", "net-book-change", "churn", "velocity", "stack-pull-ratio"] as const, "directional-pressure"),
    aggregationMs: n("aggregationMs", 25, 60_000, true), rollingWindowMs: n("rollingWindowMs", 100, 300_000, true), eventMergeGapMs: n("eventMergeGapMs", 0, 10_000, true),
    postSnapshotWarmupMs: n("postSnapshotWarmupMs", 0, 60_000, true), baselineWarmupMs: n("baselineWarmupMs", 0, 300_000, true), historySeconds: n("historySeconds", 30, 86_400, true),
    baselineWindowMs: n("baselineWindowMs", 1_000, 3_600_000, true), baselineSampleLimit: n("baselineSampleLimit", 30, 50_000, true), minimumBaselineSamples: n("minimumBaselineSamples", 1, 10_000, true), baselineBuckets: n("baselineBuckets", 5, 1_000, true),
    minimumContracts: n("minimumContracts", 1, 1_000_000, true), relativeThreshold: n("relativeThreshold", .1, 100), selectedPercentile: n("selectedPercentile", .5, .99), scoreThreshold: n("scoreThreshold", 0, 100, true), markerMinimumScore: n("markerMinimumScore", 0, 100, true),
    visibleTicks: n("visibleTicks", 10, 10_000, true), currentProfileWidth: n("currentProfileWidth", 24, 600, true), profileWidthPercent: n("profileWidthPercent", 4, 40), minimumProfileWidthPx: n("minimumProfileWidthPx", 40, 600, true), maximumProfileWidthPx: n("maximumProfileWidthPx", 80, 1_200, true), latestWindowMs: n("latestWindowMs", 25, 60_000, true),
    lowerPaneHeight: n("lowerPaneHeight", 80, 500, true), markerSize: n("markerSize", 4, 16), maximumEvents: n("maximumEvents", 100, 50_000, true), maximumBuckets: n("maximumBuckets", 100, 50_000, true), staleAfterMs: n("staleAfterMs", 500, 120_000, true), markerRetentionMs: n("markerRetentionMs", 1_000, 3_600_000, true),
    opacity: n("opacity", 5, 100), minimumOpacity: n("minimumOpacity", 0, 1), maximumOpacity: n("maximumOpacity", .01, 1), minimumCellHeightPx: n("minimumCellHeightPx", 1, 24), maximumCellHeightPx: n("maximumCellHeightPx", 2, 48),
    includeOwnOrders: false, includeImpliedOrders: false, bidEnabled: bool(source.bidEnabled, true), askEnabled: bool(source.askEnabled, true),
    showHeatCells: bool(source.showHeatCells, true), showRibbons: bool(source.showRibbons, false), showEventMarkers: bool(source.showEventMarkers, true), showCurrentProfile: bool(source.showCurrentProfile, true), showLiveDepth: bool(source.showLiveDepth, true), showLowerPane: bool(source.showLowerPane, false), showLabels: bool(source.showLabels, true), showHeader: bool(source.showHeader, true), showTooltips: bool(source.showTooltips, true), showWallBuild: bool(source.showWallBuild, true), showWallCollapse: bool(source.showWallCollapse, true), showLiquidityVacuum: bool(source.showLiquidityVacuum, true),
    wallMinimumContracts: n("wallMinimumContracts", 1, 1_000_000, true), wallMinimumLevels: n("wallMinimumLevels", 1, 100, true), wallMaximumGapTicks: n("wallMaximumGapTicks", 0, 100, true), wallBuildWindowMs: n("wallBuildWindowMs", 25, 60_000, true), wallMinimumRelativeMultiplier: n("wallMinimumRelativeMultiplier", .1, 100), wallMinimumScore: n("wallMinimumScore", 0, 100, true), wallPersistenceMs: n("wallPersistenceMs", 0, 60_000, true),
    collapseMinimumPulledContracts: n("collapseMinimumPulledContracts", 1, 1_000_000, true), collapseMinimumRatio: n("collapseMinimumRatio", 0, 1), collapseMaximumExecutedRatio: n("collapseMaximumExecutedRatio", 0, 1), collapseWindowMs: n("collapseWindowMs", 25, 60_000, true),
    vacuumMinimumLevels: n("vacuumMinimumLevels", 1, 100, true), vacuumMinimumContracts: n("vacuumMinimumContracts", 1, 1_000_000, true), vacuumMaximumGapTicks: n("vacuumMaximumGapTicks", 0, 100, true), vacuumWindowMs: n("vacuumWindowMs", 25, 60_000, true), vacuumMinimumDepthRemovalRatio: n("vacuumMinimumDepthRemovalRatio", 0, 1), vacuumMinimumScore: n("vacuumMinimumScore", 0, 100, true),
    pullRepostEnabled: bool(source.pullRepostEnabled, false), repostWindowMs: n("repostWindowMs", 25, 60_000, true), repostPriceToleranceTicks: n("repostPriceToleranceTicks", 0, 100, true), repostSizeTolerance: n("repostSizeTolerance", 0, 1), repostMinimumQuantity: n("repostMinimumQuantity", 1, 1_000_000, true), repostMinimumScore: n("repostMinimumScore", 0, 100, true),
    enableAlerts: bool(source.enableAlerts, false), alertCooldownMs: n("alertCooldownMs", 0, 3_600_000, true), useThemeColors: bool(source.useThemeColors, true),
    bidStackColor: String(source.bidStackColor ?? defaults.bidStackColor), askStackColor: String(source.askStackColor ?? defaults.askStackColor), bidPullColor: String(source.bidPullColor ?? defaults.bidPullColor), askPullColor: String(source.askPullColor ?? defaults.askPullColor), moveColor: String(source.moveColor ?? defaults.moveColor), neutralColor: String(source.neutralColor ?? defaults.neutralColor),
    pullingStackingSettingsVersion: PULLING_STACKING_SETTINGS_VERSION,
  } as PullingStackingSettings;
}

export type PullingStackingScoreBreakdown = { size: number; relative: number; velocity: number; proximity: number; depthImpact: number; repetition: number };
export type PullingStackingMetrics = {
  bidStack: number; askStack: number; bidPull: number; askPull: number; bidExecution: number; askExecution: number; bidMovedIn: number; askMovedIn: number; bidMovedOut: number; askMovedOut: number;
  netBidDisplayedChange: number; netAskDisplayedChange: number; bullishPressure: number; bearishPressure: number; pressure: number; churn: number; pullRatio: number; stackPullRatio: number; velocity: number; ordersPerSecond: number; relativeChange: number;
  baselineMedian: number | null; baselinePercentile: number | null; baselineMad: number | null; dynamicThreshold: number; score: number; scoreBreakdown: PullingStackingScoreBreakdown;
};
export type PullingStackingRow = PullingStackingMetrics & { tick: number; price: number; bidSize: number; askSize: number; bidOrders: number; askOrders: number; largestBidOrder: number | null; largestAskOrder: number | null; depthBefore: number; distanceFromTouchTicks: number | null };
export type PullingStackingBucket = { timestamp: number; endTimestamp: number; rows: PullingStackingRow[]; totals: PullingStackingMetrics; boundaryBefore?: boolean };
export type PullingStackingEvent = { id: string; timestamp: number; endTimestamp: number; tick: number; price: number; kind: PullingStackingEventKind; side: "BID" | "ASK"; quantity: number; executedQuantity: number; movedQuantity: number; score: number; scoreBreakdown: PullingStackingScoreBreakdown; wallBuild: boolean; wallCollapse: boolean; liquidityVacuum: boolean; pullRepost: boolean; levels: number; durationMs: number; depthBefore: number; endingDepth: number; collapseRatio: number | null; feedSequence: number | null; exchangeTimestamp: number; receiveTimestamp: number; warnings: string[] };
export type PullingStackingFrameStatus = "SNAPSHOT" | "WARM-UP" | "LIVE" | "STALE" | "MBP APPROXIMATION" | "UNAVAILABLE";
export type PullingStackingFrame = { timestamp: number; tickSize: number; contractSymbol: string; lastPrice: number | null; bestBid: number | null; bestAsk: number | null; fullDepth: boolean; bookValid: boolean; individualOrders: boolean; warmup: boolean; baselineReady: boolean; stale: boolean; sequenceGap: boolean; status: PullingStackingFrameStatus; statusMessage: string; rows: PullingStackingRow[]; buckets: PullingStackingBucket[]; events: PullingStackingEvent[]; totals: PullingStackingMetrics; limitations: string[] };

type MutableRow = { bidStack: number; askStack: number; bidPull: number; askPull: number; bidExecution: number; askExecution: number; bidMovedIn: number; askMovedIn: number; bidMovedOut: number; askMovedOut: number; depthBefore: number; orderEventCount: number; distanceFromTouchTicks: number | null };
type BookRow = { bidSize: number; askSize: number; bidOrders: number; askOrders: number; largestBidOrder: number | null; largestAskOrder: number | null };
type BaselineSample = { timestamp: number; side: "BID" | "ASK"; action: "STACK" | "PULL"; distance: string; quantity: number };
type PullCandidate = { timestamp: number; tick: number; side: "BID" | "ASK"; quantity: number; score: number };
type WallState = { side: "BID" | "ASK"; ticks: number[]; startedAt: number; peakQuantity: number; confirmed: boolean; lastSeenAt: number };

const emptyMutable = (): MutableRow => ({ bidStack: 0, askStack: 0, bidPull: 0, askPull: 0, bidExecution: 0, askExecution: 0, bidMovedIn: 0, askMovedIn: 0, bidMovedOut: 0, askMovedOut: 0, depthBefore: 0, orderEventCount: 0, distanceFromTouchTicks: null });
const zeroBreakdown = (): PullingStackingScoreBreakdown => ({ size: 0, relative: 0, velocity: 0, proximity: 0, depthImpact: 0, repetition: 0 });
const emptyMetrics = (): PullingStackingMetrics => ({ ...emptyMutable(), netBidDisplayedChange: 0, netAskDisplayedChange: 0, bullishPressure: 0, bearishPressure: 0, pressure: 0, churn: 0, pullRatio: 0, stackPullRatio: 0, velocity: 0, ordersPerSecond: 0, relativeChange: 0, baselineMedian: null, baselinePercentile: null, baselineMad: null, dynamicThreshold: 0, score: 0, scoreBreakdown: zeroBreakdown() });
const keyFor = (side: "BID" | "ASK", tick: number) => `${side}:${tick}`;
const sideDepth = (row: BookRow, side: "BID" | "ASK") => side === "BID" ? row.bidSize : row.askSize;
const quantile = (values: number[], q: number) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const p = (sorted.length - 1) * q; const lo = Math.floor(p); const hi = Math.ceil(p); return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo); };
const distanceBand = (distance: number | null) => distance === null ? "unknown" : distance <= 0 ? "touch" : distance <= 2 ? "near" : distance <= 5 ? "close" : distance <= 10 ? "medium" : distance <= 20 ? "far" : "very-far";
const eventDistance = (side: "BID" | "ASK", tick: number, bid: number | null | undefined, ask: number | null | undefined, tickSize: number) => { const touch = side === "BID" ? bid : ask; return touch == null ? null : Math.max(0, Math.abs(tick - Math.round(touch / tickSize))); };
const blankBookRow = (): BookRow => ({ bidSize: 0, askSize: 0, bidOrders: 0, askOrders: 0, largestBidOrder: null, largestAskOrder: null });

function snapshotBook(snapshot: RithmicLiquiditySnapshot, tickSize: number) {
  const book = new Map<number, BookRow>();
  for (const level of snapshot.levels) {
    const tick = Math.round(level.price / tickSize); const row = book.get(tick) ?? blankBookRow(); const largest = level.largestOrder == null ? null : Math.max(0, level.largestOrder);
    if (level.side === "BID") { row.bidSize += Math.max(0, level.size); row.bidOrders += Math.max(0, level.orders); row.largestBidOrder = largest; }
    else { row.askSize += Math.max(0, level.size); row.askOrders += Math.max(0, level.orders); row.largestAskOrder = largest; }
    book.set(tick, row);
  }
  return book;
}
function accumulate(target: MutableRow, value: MutableRow) {
  target.bidStack += value.bidStack; target.askStack += value.askStack; target.bidPull += value.bidPull; target.askPull += value.askPull; target.bidExecution += value.bidExecution; target.askExecution += value.askExecution;
  target.bidMovedIn += value.bidMovedIn; target.askMovedIn += value.askMovedIn; target.bidMovedOut += value.bidMovedOut; target.askMovedOut += value.askMovedOut; target.depthBefore += value.depthBefore; target.orderEventCount += value.orderEventCount;
  return target;
}

export class PullingStackingEngine {
  private book = new Map<number, BookRow>(); private active = new Map<number, MutableRow>(); private readonly buckets: PullingStackingBucket[] = []; private events: PullingStackingEvent[] = [];
  private samples: BaselineSample[] = []; private pulls: PullCandidate[] = []; private readonly walls = new Map<string, WallState>();
  private readonly seenTrades = new Set<string>(); private readonly tradeQueue: string[] = []; private readonly seenEvents = new Set<string>(); private readonly eventQueue: string[] = [];
  private bucketTimestamp = 0; private lastTimestamp = 0; private lastSequence = 0; private sequenceGap = false; private awaitingSnapshot = false; private hasSnapshot = false; private validSince = 0; private symbol = ""; private tickSize = .25; private dataKey = ""; private boundary = false;

  reset() {
    this.book.clear(); this.active.clear(); this.buckets.length = 0; this.events = []; this.samples = []; this.pulls = []; this.walls.clear(); this.seenTrades.clear(); this.tradeQueue.length = 0; this.seenEvents.clear(); this.eventQueue.length = 0;
    this.bucketTimestamp = 0; this.lastTimestamp = 0; this.lastSequence = 0; this.sequenceGap = false; this.awaitingSnapshot = false; this.hasSnapshot = false; this.validSince = 0; this.symbol = ""; this.dataKey = ""; this.boundary = false;
  }

  apply(snapshot: RithmicLiquiditySnapshot, raw?: Partial<PullingStackingSettings>): PullingStackingFrame {
    const settings = normalizePullingStackingSettings(raw as Record<string, unknown> | undefined); const parsed = Date.parse(snapshot.asOf); const now = Number.isFinite(parsed) ? parsed : Date.now(); this.tickSize = snapshot.tickSize > 0 ? snapshot.tickSize : this.tickSize;
    if (this.symbol && this.symbol !== snapshot.contractSymbol) this.reset(); this.symbol = snapshot.contractSymbol;
    if (this.lastTimestamp && now < this.lastTimestamp) return this.makeFrame(snapshot, settings, this.lastTimestamp); this.lastTimestamp = now;
    const nextKey = [settings.classificationMode, settings.moveHandling, settings.aggregationMode, settings.aggregationMs, settings.rollingWindowMs, settings.eventMergeGapMs, settings.bidEnabled, settings.askEnabled].join("|");
    if (this.dataKey && nextKey !== this.dataKey) { this.active.clear(); this.buckets.length = 0; this.events = []; this.samples = []; this.pulls = []; this.walls.clear(); this.bucketTimestamp = 0; this.validSince = now; this.boundary = true; } this.dataKey = nextKey;
    if (!snapshot.bookValid) { this.book.clear(); this.active.clear(); this.awaitingSnapshot = true; this.hasSnapshot = false; this.sequenceGap = false; this.bucketTimestamp = 0; this.boundary = true; return this.makeFrame(snapshot, settings, now); }
    const nextBook = snapshotBook(snapshot, this.tickSize);
    if (!this.hasSnapshot || this.awaitingSnapshot) { this.book = nextBook; this.active.clear(); this.bucketTimestamp = this.bucketStart(now, settings); this.hasSnapshot = true; this.awaitingSnapshot = false; this.sequenceGap = false; this.lastSequence = 0; this.validSince = now; this.boundary = true; return this.makeFrame(snapshot, settings, now); }
    const lifecycle = this.uniqueEvents(snapshot.orderEvents ?? []);
    if (this.hasGap(lifecycle)) { this.sequenceGap = true; this.awaitingSnapshot = true; this.active.clear(); this.book = nextBook; this.boundary = true; return this.makeFrame(snapshot, settings, now); }
    this.roll(now, settings, snapshot);
    const executions = this.executions(snapshot); const maps = this.lifecycleMaps(lifecycle, settings.moveHandling); const useMbo = settings.classificationMode === "individual-order" && snapshot.individualOrders === true && lifecycle.length > 0;
    if (now - this.validSince >= settings.postSnapshotWarmupMs) {
      const ticks = new Set([...this.book.keys(), ...nextBook.keys(), ...maps.ticks]);
      for (const tick of ticks) {
        const before = this.book.get(tick) ?? blankBookRow(); const after = nextBook.get(tick) ?? blankBookRow(); const row = this.active.get(tick) ?? emptyMutable();
        for (const side of ["BID", "ASK"] as const) {
          if ((side === "BID" && !settings.bidEnabled) || (side === "ASK" && !settings.askEnabled)) continue;
          const key = keyFor(side, tick); const oldDepth = sideDepth(before, side); const newDepth = sideDepth(after, side); const executed = executions.get(key) ?? 0;
          const stack = useMbo ? maps.adds.get(key) ?? 0 : Math.max(0, newDepth - oldDepth); const reduction = useMbo ? maps.removes.get(key) ?? 0 : Math.max(0, oldDepth - newDepth); const pull = Math.max(0, reduction - executed);
          if (side === "BID") { row.bidStack += stack; row.bidPull += pull; row.bidExecution += executed; row.bidMovedIn += maps.movedIn.get(key) ?? 0; row.bidMovedOut += maps.movedOut.get(key) ?? 0; }
          else { row.askStack += stack; row.askPull += pull; row.askExecution += executed; row.askMovedIn += maps.movedIn.get(key) ?? 0; row.askMovedOut += maps.movedOut.get(key) ?? 0; }
          row.depthBefore += oldDepth; row.orderEventCount += maps.counts.get(key) ?? (stack || pull || executed ? 1 : 0); const distance = eventDistance(side, tick, snapshot.bestBid, snapshot.bestAsk, this.tickSize); row.distanceFromTouchTicks = row.distanceFromTouchTicks === null ? distance : distance === null ? row.distanceFromTouchTicks : Math.min(row.distanceFromTouchTicks, distance);
        }
        if (this.magnitude(row) > 0) this.active.set(tick, row);
      }
    }
    this.book = nextBook; this.prune(settings, now); return this.makeFrame(snapshot, settings, now);
  }

  private bucketStart(now: number, settings: PullingStackingSettings) { const width = settings.aggregationMode === "rolling-window" ? Math.min(settings.aggregationMs, settings.rollingWindowMs) : settings.aggregationMs; return now - now % Math.max(1, width); }
  private roll(now: number, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot) { const next = this.bucketStart(now, settings); if (!this.bucketTimestamp) { this.bucketTimestamp = next; return; } if (next <= this.bucketTimestamp) return; this.commit(this.bucketTimestamp, next, settings, snapshot); this.bucketTimestamp = next; this.active = new Map(); }
  private uniqueEvents(events: RithmicOrderLifecycleEvent[]) { const result: RithmicOrderLifecycleEvent[] = []; for (const event of [...events].sort((a, b) => a.sequence - b.sequence || a.timestamp - b.timestamp)) { const id = event.sequence > 0 ? `s:${event.sequence}` : `${event.timestamp}:${event.orderId}:${event.action}:${event.side}:${event.previousPrice}:${event.price}:${event.previousSize}:${event.size}`; if (this.seenEvents.has(id)) continue; this.seenEvents.add(id); this.eventQueue.push(id); result.push(event); } while (this.eventQueue.length > 100_000) this.seenEvents.delete(this.eventQueue.shift()!); return result; }
  private hasGap(events: RithmicOrderLifecycleEvent[]) { for (const event of events) { if (event.sequence <= 0) continue; if (this.lastSequence > 0 && event.sequence !== this.lastSequence + 1) return true; this.lastSequence = event.sequence; } return false; }
  private executions(snapshot: RithmicLiquiditySnapshot) { const result = new Map<string, number>(); for (const trade of snapshot.trades ?? []) { const id = `${trade.id}:${trade.timestamp}:${trade.price}:${trade.size}:${trade.side}`; if (this.seenTrades.has(id)) continue; this.seenTrades.add(id); this.tradeQueue.push(id); const side = trade.side === "BUY" ? "ASK" : "BID"; const key = keyFor(side, Math.round(trade.price / this.tickSize)); result.set(key, (result.get(key) ?? 0) + Math.max(0, trade.size)); } while (this.tradeQueue.length > 50_000) this.seenTrades.delete(this.tradeQueue.shift()!); return result; }
  private lifecycleMaps(events: RithmicOrderLifecycleEvent[], mode: PullingStackingMoveHandling) { const adds = new Map<string, number>(); const removes = new Map<string, number>(); const movedIn = new Map<string, number>(); const movedOut = new Map<string, number>(); const counts = new Map<string, number>(); const ticks = new Set<number>(); const add = (map: Map<string, number>, key: string, qty: number) => map.set(key, (map.get(key) ?? 0) + Math.max(0, qty));
    for (const event of events) { const nextTick = Math.round(event.price / this.tickSize); const oldTick = Math.round((event.previousPrice ?? event.price) / this.tickSize); const nextKey = keyFor(event.side, nextTick); const oldKey = keyFor(event.side, oldTick); ticks.add(nextTick); ticks.add(oldTick); counts.set(nextKey, (counts.get(nextKey) ?? 0) + 1);
      if (event.action === "ADD") add(adds, nextKey, event.size);
      else if (event.action === "MODIFY" && nextTick !== oldTick) { add(movedOut, oldKey, event.previousSize); add(movedIn, nextKey, event.size); if (mode === "pull-and-stack") { add(removes, oldKey, event.previousSize); add(adds, nextKey, event.size); } }
      else if (event.action === "REMOVE") add(removes, oldKey, event.previousSize);
      else { const delta = event.size - event.previousSize; if (delta > 0) add(adds, nextKey, delta); else if (delta < 0) add(removes, oldKey, -delta); }
    } return { adds, removes, movedIn, movedOut, counts, ticks }; }
  private magnitude(row: MutableRow) { return row.bidStack + row.askStack + row.bidPull + row.askPull + row.bidExecution + row.askExecution + row.bidMovedIn + row.askMovedIn + row.bidMovedOut + row.askMovedOut; }
  private baseline(side: "BID" | "ASK", action: "STACK" | "PULL", distance: number | null, now: number, settings: PullingStackingSettings) { const values = this.samples.filter((sample) => sample.timestamp >= now - settings.baselineWindowMs && sample.side === side && sample.action === action && sample.distance === distanceBand(distance)).map((sample) => sample.quantity); const median = quantile(values, .5); const selected = quantile(values, settings.selectedPercentile); const mad = median === null ? null : quantile(values.map((value) => Math.abs(value - median)), .5); return { count: values.length, median, selected, mad, threshold: Math.max(settings.minimumContracts, (median ?? 0) * settings.relativeThreshold, selected ?? 0) }; }
  private score(quantity: number, depth: number, duration: number, distance: number | null, baseline: ReturnType<PullingStackingEngine["baseline"]>, repeat: number) { const parts = { size: clamp(quantity / Math.max(1, baseline.threshold), 0, 1), relative: clamp(quantity / Math.max(1, (baseline.median ?? quantity) * 3), 0, 1), velocity: clamp((quantity / Math.max(.001, duration / 1_000)) / Math.max(1, baseline.threshold * 4), 0, 1), proximity: distance === null ? 0 : clamp(1 - distance / 21, 0, 1), depthImpact: clamp(quantity / Math.max(1, depth), 0, 1), repetition: clamp(repeat / 3, 0, 1) }; const score = Math.round((parts.size * .24 + parts.relative * .18 + parts.velocity * .18 + parts.proximity * .12 + parts.depthImpact * .16 + parts.repetition * .12) * 100); return { score: clamp(score, 0, 100), parts }; }
  private metrics(row: MutableRow, duration: number, now: number, settings: PullingStackingSettings): PullingStackingMetrics { const stack = row.bidStack + row.askStack; const pull = row.bidPull + row.askPull; const churn = stack + pull; const dominant = ([["BID", "STACK", row.bidStack], ["ASK", "STACK", row.askStack], ["BID", "PULL", row.bidPull], ["ASK", "PULL", row.askPull]] as Array<["BID" | "ASK", "STACK" | "PULL", number]>).sort((a, b) => b[2] - a[2])[0]; const baseline = this.baseline(dominant[0], dominant[1], row.distanceFromTouchTicks, now, settings); const repeat = this.samples.filter((sample) => sample.timestamp >= now - 5_000 && sample.side === dominant[0] && sample.action === dominant[1]).length; const scored = this.score(dominant[2], row.depthBefore, duration, row.distanceFromTouchTicks, baseline, repeat); const bullish = row.bidStack + row.askPull; const bearish = row.askStack + row.bidPull;
    return { bidStack: row.bidStack, askStack: row.askStack, bidPull: row.bidPull, askPull: row.askPull, bidExecution: row.bidExecution, askExecution: row.askExecution, bidMovedIn: row.bidMovedIn, askMovedIn: row.askMovedIn, bidMovedOut: row.bidMovedOut, askMovedOut: row.askMovedOut, netBidDisplayedChange: row.bidStack - row.bidPull, netAskDisplayedChange: row.askStack - row.askPull, bullishPressure: bullish, bearishPressure: bearish, pressure: bullish - bearish, churn, pullRatio: pull / Math.max(1, churn), stackPullRatio: stack / Math.max(1, pull), velocity: churn / Math.max(.001, duration / 1_000), ordersPerSecond: row.orderEventCount / Math.max(.001, duration / 1_000), relativeChange: churn / Math.max(1, row.depthBefore), baselineMedian: baseline.median, baselinePercentile: baseline.selected, baselineMad: baseline.mad, dynamicThreshold: baseline.threshold, score: scored.score, scoreBreakdown: scored.parts };
  }
  private commit(start: number, end: number, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot) { const duration = Math.max(1, end - start); const rows: PullingStackingRow[] = []; const totals = emptyMutable(); for (const [tick, mutable] of this.active) { const metric = this.metrics(mutable, duration, start, settings); const book = this.book.get(tick) ?? blankBookRow(); rows.push({ tick, price: tick * this.tickSize, ...book, ...metric, depthBefore: mutable.depthBefore, distanceFromTouchTicks: mutable.distanceFromTouchTicks }); accumulate(totals, mutable); this.baseEvents(start, end, tick, mutable, book, metric, settings, snapshot); for (const [side, action, quantity] of [["BID", "STACK", mutable.bidStack], ["ASK", "STACK", mutable.askStack], ["BID", "PULL", mutable.bidPull], ["ASK", "PULL", mutable.askPull]] as const) if (quantity > 0) this.samples.push({ timestamp: start, side, action, distance: distanceBand(mutable.distanceFromTouchTicks), quantity }); } const bucket = { timestamp: start, endTimestamp: end, rows, totals: this.metrics(totals, duration, start, settings), boundaryBefore: this.boundary }; this.boundary = false; this.buckets.push(bucket); this.detectStructures(bucket, settings, snapshot); }
  private makeEvent(kind: PullingStackingEventKind, side: "BID" | "ASK", start: number, end: number, tick: number, quantity: number, score: number, parts: PullingStackingScoreBreakdown, depth: number, ending: number, snapshot: RithmicLiquiditySnapshot, extra: Partial<PullingStackingEvent> = {}): PullingStackingEvent { return { id: `${kind}:${tick}:${start}`, timestamp: start, endTimestamp: end, tick, price: tick * this.tickSize, kind, side, quantity, executedQuantity: 0, movedQuantity: 0, score, scoreBreakdown: parts, wallBuild: kind.endsWith("WALL_BUILD"), wallCollapse: kind.endsWith("WALL_COLLAPSE"), liquidityVacuum: kind.includes("LIQUIDITY_VACUUM"), pullRepost: kind === "PULL_REPOST", levels: 1, durationMs: end - start, depthBefore: depth, endingDepth: ending, collapseRatio: null, feedSequence: this.lastSequence || null, exchangeTimestamp: start, receiveTimestamp: this.lastTimestamp, warnings: snapshot.individualOrders ? [] : ["Price-level classification; order lineage unavailable"], ...extra }; }
  private baseEvents(start: number, end: number, tick: number, mutable: MutableRow, book: BookRow, metric: PullingStackingMetrics, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot) { const values: Array<[PullingStackingEventKind, "BID" | "ASK", number]> = [["BID_STACK", "BID", mutable.bidStack], ["ASK_STACK", "ASK", mutable.askStack], ["BID_PULL", "BID", mutable.bidPull], ["ASK_PULL", "ASK", mutable.askPull]]; for (const [kind, side, quantity] of values) { const baseline = this.baseline(side, kind.endsWith("STACK") ? "STACK" : "PULL", mutable.distanceFromTouchTicks, start, settings); if (quantity < baseline.threshold || metric.score < settings.markerMinimumScore) continue; const event = this.makeEvent(kind, side, start, end, tick, quantity, metric.score, metric.scoreBreakdown, mutable.depthBefore, sideDepth(book, side), snapshot, { executedQuantity: side === "BID" ? mutable.bidExecution : mutable.askExecution, movedQuantity: side === "BID" ? mutable.bidMovedIn + mutable.bidMovedOut : mutable.askMovedIn + mutable.askMovedOut }); this.events.push(event); if (kind.endsWith("PULL")) this.pulls.push({ timestamp: start, tick, side, quantity, score: metric.score }); else if (settings.pullRepostEnabled) this.detectRepost(start, end, tick, side, quantity, metric, book, settings, snapshot); } }
  private groups(rows: PullingStackingRow[], select: (row: PullingStackingRow) => number, gap: number) { const sorted = rows.filter((row) => select(row) > 0).sort((a, b) => a.tick - b.tick); const result: PullingStackingRow[][] = []; for (const row of sorted) { const last = result[result.length - 1]; if (!last || row.tick - last[last.length - 1].tick > gap + 1) result.push([row]); else last.push(row); } return result; }
  private detectStructures(bucket: PullingStackingBucket, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot) { for (const side of ["BID", "ASK"] as const) { const stack = (row: PullingStackingRow) => side === "BID" ? row.bidStack : row.askStack; const pull = (row: PullingStackingRow) => side === "BID" ? row.bidPull : row.askPull;
      const wallRows = bucket.rows.filter((row) => stack(row) >= Math.max(1, (row.baselineMedian ?? 0) * settings.wallMinimumRelativeMultiplier));
      for (const group of this.groups(wallRows, stack, settings.wallMaximumGapTicks)) { const qty = group.reduce((sum, row) => sum + stack(row), 0); const score = Math.max(...group.map((row) => row.score)); if (bucket.endTimestamp - bucket.timestamp > settings.wallBuildWindowMs || qty < settings.wallMinimumContracts || group.length < settings.wallMinimumLevels || score < settings.wallMinimumScore) continue; const key = `${side}:${group.map((row) => row.tick).join(",")}`; const state = this.walls.get(key) ?? { side, ticks: group.map((row) => row.tick), startedAt: bucket.timestamp, peakQuantity: 0, confirmed: false, lastSeenAt: bucket.endTimestamp }; state.peakQuantity = Math.max(state.peakQuantity, qty + group.reduce((sum, row) => sum + (side === "BID" ? row.bidSize : row.askSize), 0)); state.lastSeenAt = bucket.endTimestamp; if (!state.confirmed && bucket.endTimestamp - state.startedAt >= settings.wallPersistenceMs) { state.confirmed = true; const anchor = group[Math.floor(group.length / 2)]; this.events.push(this.makeEvent(side === "BID" ? "BID_WALL_BUILD" : "ASK_WALL_BUILD", side, state.startedAt, bucket.endTimestamp, anchor.tick, qty, score, anchor.scoreBreakdown, anchor.depthBefore, side === "BID" ? anchor.bidSize : anchor.askSize, snapshot, { levels: group.length, durationMs: bucket.endTimestamp - state.startedAt })); } this.walls.set(key, state); }
      for (const [key, wall] of this.walls) { if (wall.side !== side || !wall.confirmed || bucket.endTimestamp - wall.lastSeenAt > settings.collapseWindowMs) continue; const affected = bucket.rows.filter((row) => wall.ticks.some((tick) => Math.abs(tick - row.tick) <= settings.wallMaximumGapTicks)); const removed = affected.reduce((sum, row) => sum + pull(row), 0); const executed = affected.reduce((sum, row) => sum + (side === "BID" ? row.bidExecution : row.askExecution), 0); const collapse = removed / Math.max(1, wall.peakQuantity); const execRatio = executed / Math.max(1, wall.peakQuantity); const anchor = affected[0]; if (anchor && removed >= settings.collapseMinimumPulledContracts && collapse >= settings.collapseMinimumRatio && execRatio <= settings.collapseMaximumExecutedRatio) { this.events.push(this.makeEvent(side === "BID" ? "BID_WALL_COLLAPSE" : "ASK_WALL_COLLAPSE", side, bucket.timestamp, bucket.endTimestamp, anchor.tick, removed, anchor.score, anchor.scoreBreakdown, anchor.depthBefore, side === "BID" ? anchor.bidSize : anchor.askSize, snapshot, { executedQuantity: executed, collapseRatio: collapse, levels: affected.length })); this.walls.delete(key); } }
      for (const group of this.groups(bucket.rows, pull, settings.vacuumMaximumGapTicks)) { const qty = group.reduce((sum, row) => sum + pull(row), 0); const depth = group.reduce((sum, row) => sum + row.depthBefore, 0); const score = Math.max(...group.map((row) => row.score)); if (group.length < settings.vacuumMinimumLevels || qty < settings.vacuumMinimumContracts || qty / Math.max(1, depth) < settings.vacuumMinimumDepthRemovalRatio || score < settings.vacuumMinimumScore || bucket.endTimestamp - bucket.timestamp > settings.vacuumWindowMs) continue; const anchor = group[Math.floor(group.length / 2)]; this.events.push(this.makeEvent(side === "BID" ? "BID_LIQUIDITY_VACUUM" : "ASK_LIQUIDITY_VACUUM", side, bucket.timestamp, bucket.endTimestamp, anchor.tick, qty, score, anchor.scoreBreakdown, depth, group.reduce((sum, row) => sum + (side === "BID" ? row.bidSize : row.askSize), 0), snapshot, { levels: group.length })); }
    } }
  private detectRepost(start: number, end: number, tick: number, side: "BID" | "ASK", quantity: number, metric: PullingStackingMetrics, book: BookRow, settings: PullingStackingSettings, snapshot: RithmicLiquiditySnapshot) { const candidate = [...this.pulls].reverse().find((pull) => pull.side === side && start - pull.timestamp <= settings.repostWindowMs && Math.abs(tick - pull.tick) <= settings.repostPriceToleranceTicks && Math.abs(quantity - pull.quantity) / Math.max(1, pull.quantity) <= settings.repostSizeTolerance && Math.min(quantity, pull.quantity) >= settings.repostMinimumQuantity); if (!candidate || Math.max(candidate.score, metric.score) < settings.repostMinimumScore) return; this.events.push(this.makeEvent("PULL_REPOST", side, candidate.timestamp, end, tick, Math.min(quantity, candidate.quantity), Math.max(candidate.score, metric.score), metric.scoreBreakdown, metric.churn, sideDepth(book, side), snapshot, { durationMs: start - candidate.timestamp, warnings: ["Similar same-side quantity reposted nearby; participant ownership is not known"] })); }
  private currentRows(settings: PullingStackingSettings, now: number) { const duration = Math.max(1, now - this.bucketTimestamp); return [...this.book.entries()].map(([tick, book]) => { const mutable = this.active.get(tick) ?? emptyMutable(); return { tick, price: tick * this.tickSize, ...book, ...this.metrics(mutable, duration, now, settings), depthBefore: mutable.depthBefore, distanceFromTouchTicks: mutable.distanceFromTouchTicks }; }); }
  private frameTotal(settings: PullingStackingSettings, now: number) {
    const total = [...this.active.values()].reduce((sum, row) => accumulate(sum, row), emptyMutable());
    if (settings.aggregationMode !== "rolling-window") return { total, duration: Math.max(1, now - this.bucketTimestamp) };
    const cutoff = now - settings.rollingWindowMs;
    for (const bucket of this.buckets) {
      if (bucket.endTimestamp < cutoff) continue;
      const durationSeconds = Math.max(.001, (bucket.endTimestamp - bucket.timestamp) / 1_000);
      for (const row of bucket.rows) {
        total.bidStack += row.bidStack; total.askStack += row.askStack; total.bidPull += row.bidPull; total.askPull += row.askPull;
        total.bidExecution += row.bidExecution; total.askExecution += row.askExecution; total.bidMovedIn += row.bidMovedIn; total.askMovedIn += row.askMovedIn;
        total.bidMovedOut += row.bidMovedOut; total.askMovedOut += row.askMovedOut; total.depthBefore += row.depthBefore; total.orderEventCount += row.ordersPerSecond * durationSeconds;
      }
    }
    return { total, duration: settings.rollingWindowMs };
  }
  private makeFrame(snapshot: RithmicLiquiditySnapshot, settings: PullingStackingSettings, now: number): PullingStackingFrame { const warm = this.hasSnapshot && now - this.validSince < settings.postSnapshotWarmupMs; const baselineReady = this.hasSnapshot && now - this.validSince >= settings.baselineWarmupMs && this.samples.length >= settings.minimumBaselineSamples; const stale = this.sequenceGap || this.awaitingSnapshot || (snapshot.ageMs ?? 0) > settings.staleAfterMs; const status: PullingStackingFrameStatus = !snapshot.bookValid ? "SNAPSHOT" : stale ? "STALE" : warm || !baselineReady ? "WARM-UP" : !snapshot.fullDepth ? "MBP APPROXIMATION" : "LIVE"; const { total, duration } = this.frameTotal(settings, now); return { timestamp: now, tickSize: this.tickSize, contractSymbol: snapshot.contractSymbol, lastPrice: snapshot.lastPrice ?? snapshot.microPrice ?? null, bestBid: snapshot.bestBid ?? null, bestAsk: snapshot.bestAsk ?? null, fullDepth: snapshot.fullDepth, bookValid: snapshot.bookValid, individualOrders: snapshot.individualOrders === true, warmup: status === "WARM-UP", baselineReady, stale, sequenceGap: this.sequenceGap, status, statusMessage: this.sequenceGap ? "LEVEL 3 DATA STALE — RESYNCING" : status === "SNAPSHOT" ? "REBUILDING ORDER BOOK" : status === "WARM-UP" ? "BASELINE WARM-UP" : status, rows: this.currentRows(settings, now), buckets: [...this.buckets], events: [...this.events], totals: this.metrics(total, duration, now, settings), limitations: ["Executions are reconciled before non-executed reductions are classified as pulls.", ...(snapshot.individualOrders ? [] : ["MBP price-level approximation: individual queue lineage is unavailable."]), "Own-order, implied-order, hidden-liquidity and participant-intent fields are not supplied by this browser stream."] }; }
  private prune(settings: PullingStackingSettings, now: number) { while (this.buckets.length && (this.buckets[0].timestamp < now - settings.historySeconds * 1_000 || this.buckets.length > settings.maximumBuckets)) this.buckets.shift(); this.events = this.events.filter((event) => now - event.timestamp <= settings.markerRetentionMs).slice(-settings.maximumEvents); this.samples = this.samples.filter((sample) => sample.timestamp >= now - settings.baselineWindowMs).slice(-settings.baselineSampleLimit); this.pulls = this.pulls.filter((pull) => now - pull.timestamp <= settings.repostWindowMs).slice(-1_000); for (const [key, wall] of this.walls) if (now - wall.lastSeenAt > Math.max(settings.collapseWindowMs, settings.wallBuildWindowMs)) this.walls.delete(key); }
}
