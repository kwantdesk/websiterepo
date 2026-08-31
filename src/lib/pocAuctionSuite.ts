import { cmeSessionDateKey } from "./chartHistoryWindow.ts";
import type { FootprintBar, FootprintRow } from "./footprint.ts";

export const POC_AUCTION_SUITE_SETTINGS_VERSION = 1;

export type PocMetric = "total-volume" | "bid-volume" | "ask-volume" | "absolute-delta" | "trade-count";
export type PocTieBreakMode = "follow-shared-profile-engine" | "closest-to-volume-weighted-price" | "closest-to-close" | "highest-price" | "lowest-price" | "first-achieved" | "last-achieved";
export type PocScope = "bar" | "session" | "rolling-bars" | "rolling-time" | "anchored" | "composite";
export type PocLifecycleState = "developing" | "frozen" | "naked" | "testing" | "tested" | "accepted" | "rejected" | "retired" | "expired";
export type AuctionCompletionState = "finished" | "unfinished" | "zero-side" | "excess" | "inconclusive";
export type AuctionLifecycleState = "developing" | "confirmed" | "active-level" | "revisiting" | "revisited" | "resolved" | "traded-through" | "expired";
export type AuctionResolutionMode = "first-touch" | "trade-through" | "minimum-volume-at-level" | "new-finished-extreme" | "combined";

export interface PocAuctionSuiteSettings {
  schemaVersion: number;
  preset: "balanced-auction" | "footprint-professional" | "naked-poc-tracker" | "session-control" | "auction-completion" | "excess-research" | "poc-migration" | "minimal-levels" | "research" | "custom";
  groupingMode: "follow-footprint" | "raw-exchange-tick" | "custom-ticks" | "automatic";
  customGroupSizeTicks: number;
  automaticTargetRows: number;
  auctionExtremeSource: "raw-exchange-tick" | "displayed-group";
  allowGroupedExtremeApproximation: boolean;
  metric: PocMetric;
  tieBreakMode: PocTieBreakMode;
  pocBandMode: "single-price-group" | "percentage-of-maximum" | "top-n-contiguous-groups" | "custom-ticks";
  percentageOfMaximum: number;
  topNContiguousGroups: number;
  customBandTicks: number;
  minimumPocVolume: number;
  minimumPocTradeCount: number;
  showBarPoc: boolean;
  showSessionPoc: boolean;
  showPriorSessionPoc: boolean;
  showRollingPoc: boolean;
  showAnchoredPoc: boolean;
  showCompositePoc: boolean;
  rollingMode: "bars" | "time";
  rollingBars: number;
  rollingDurationMs: number;
  anchorStartMs: number;
  anchorEndMs: number;
  anchorFollowLive: boolean;
  compositeStartMs: number;
  compositeEndMs: number;
  minimumMigrationTicks: number;
  minimumNewPocDwellMs: number;
  minimumMetricLead: number;
  minimumMetricLeadPercent: number;
  nakedPocEnabled: boolean;
  touchToleranceTicks: number;
  minimumTouchVolume: number;
  minimumAcceptanceVolume: number;
  minimumAcceptanceTimeMs: number;
  minimumRejectionTicks: number;
  responseWindowMs: number;
  showFinishedHigh: boolean;
  showFinishedLow: boolean;
  showUnfinishedHigh: boolean;
  showUnfinishedLow: boolean;
  showZeroSide: boolean;
  developingAuctionVisuals: boolean;
  maximumOppositeExtremeVolume: number;
  minimumAggressiveExtremeVolume: number;
  minimumAggressiveExtremeTradeCount: number;
  maximumUnknownExtremeVolume: number;
  minimumOppositeUnfinishedVolume: number;
  minimumAggressiveUnfinishedVolume: number;
  minimumOppositeUnfinishedTrades: number;
  minimumAggressiveUnfinishedTrades: number;
  minimumTotalExtremeVolume: number;
  excessEnabled: boolean;
  excessLookbackTicks: number;
  minimumTaperSteps: number;
  maximumTaperRatio: number;
  requireFinishedExtremeForExcess: boolean;
  maximumExtremeVolumeRelativeToLocalMedian: number;
  minimumInteriorReferenceVolume: number;
  minimumExcessScore: number;
  auctionTouchToleranceTicks: number;
  auctionResolutionMode: AuctionResolutionMode;
  minimumTradeThroughTicks: number;
  minimumResolutionVolume: number;
  showHeader: boolean;
  showBarPocMarkers: boolean;
  showDynamicPocLine: boolean;
  showExtendedLevels: boolean;
  showAuctionMarkers: boolean;
  showActiveLane: boolean;
  activeLaneWidth: number;
  maximumActiveLaneRows: number;
  showLowerPane: boolean;
  markerSize: number;
  lineWidth: number;
  opacity: number;
  useThemeColors: boolean;
  barPocColor: string;
  sessionPocColor: string;
  nakedPocColor: string;
  finishedColor: string;
  unfinishedColor: string;
  excessHighColor: string;
  excessLowColor: string;
  neutralColor: string;
  showLabels: boolean;
  showTooltips: boolean;
  alertsEnabled: boolean;
  alertOnMigration: boolean;
  alertOnNewNakedPoc: boolean;
  alertOnAuctionClose: boolean;
  historyBars: number;
  maximumActivePocs: number;
  maximumAuctionLevels: number;
}

export const DEFAULT_POC_AUCTION_SUITE_SETTINGS: PocAuctionSuiteSettings = {
  schemaVersion: POC_AUCTION_SUITE_SETTINGS_VERSION,
  preset: "balanced-auction",
  groupingMode: "follow-footprint", customGroupSizeTicks: 1, automaticTargetRows: 80,
  auctionExtremeSource: "raw-exchange-tick", allowGroupedExtremeApproximation: false,
  metric: "total-volume", tieBreakMode: "follow-shared-profile-engine",
  pocBandMode: "single-price-group", percentageOfMaximum: 0.95, topNContiguousGroups: 3, customBandTicks: 1,
  minimumPocVolume: 1, minimumPocTradeCount: 1,
  showBarPoc: true, showSessionPoc: true, showPriorSessionPoc: true, showRollingPoc: false, showAnchoredPoc: false, showCompositePoc: false,
  rollingMode: "bars", rollingBars: 20, rollingDurationMs: 3_600_000,
  anchorStartMs: 0, anchorEndMs: 0, anchorFollowLive: true, compositeStartMs: 0, compositeEndMs: 0,
  minimumMigrationTicks: 1, minimumNewPocDwellMs: 250, minimumMetricLead: 1, minimumMetricLeadPercent: 0,
  nakedPocEnabled: true, touchToleranceTicks: 0, minimumTouchVolume: 1,
  minimumAcceptanceVolume: 100, minimumAcceptanceTimeMs: 2_000, minimumRejectionTicks: 4, responseWindowMs: 10_000,
  showFinishedHigh: true, showFinishedLow: true, showUnfinishedHigh: true, showUnfinishedLow: true, showZeroSide: true, developingAuctionVisuals: true,
  maximumOppositeExtremeVolume: 0, minimumAggressiveExtremeVolume: 1, minimumAggressiveExtremeTradeCount: 1, maximumUnknownExtremeVolume: 0,
  minimumOppositeUnfinishedVolume: 1, minimumAggressiveUnfinishedVolume: 1, minimumOppositeUnfinishedTrades: 1, minimumAggressiveUnfinishedTrades: 1, minimumTotalExtremeVolume: 1,
  excessEnabled: true, excessLookbackTicks: 4, minimumTaperSteps: 2, maximumTaperRatio: 0.75,
  requireFinishedExtremeForExcess: true, maximumExtremeVolumeRelativeToLocalMedian: 0.5, minimumInteriorReferenceVolume: 10, minimumExcessScore: 35,
  auctionTouchToleranceTicks: 0, auctionResolutionMode: "first-touch", minimumTradeThroughTicks: 1, minimumResolutionVolume: 25,
  showHeader: true, showBarPocMarkers: true, showDynamicPocLine: true, showExtendedLevels: true, showAuctionMarkers: true,
  showActiveLane: true, activeLaneWidth: 150, maximumActiveLaneRows: 14, showLowerPane: false,
  markerSize: 7, lineWidth: 1.5, opacity: 100, useThemeColors: true,
  barPocColor: "#22D3EE", sessionPocColor: "#A3E635", nakedPocColor: "#F59E0B", finishedColor: "#A1A1AA",
  unfinishedColor: "#F59E0B", excessHighColor: "#FB7185", excessLowColor: "#22D3A7", neutralColor: "#71717A",
  showLabels: true, showTooltips: true, alertsEnabled: false, alertOnMigration: true, alertOnNewNakedPoc: true, alertOnAuctionClose: true,
  historyBars: 1_500, maximumActivePocs: 250, maximumAuctionLevels: 500,
};

export const POC_AUCTION_PRESETS: Record<Exclude<PocAuctionSuiteSettings["preset"], "custom">, Partial<PocAuctionSuiteSettings>> = {
  "balanced-auction": { preset: "balanced-auction" },
  "footprint-professional": { preset: "footprint-professional", showActiveLane: false, showExtendedLevels: false, showBarPocMarkers: true, auctionExtremeSource: "raw-exchange-tick" },
  "naked-poc-tracker": { preset: "naked-poc-tracker", showBarPocMarkers: false, showDynamicPocLine: false, showAuctionMarkers: false, showExtendedLevels: true, nakedPocEnabled: true },
  "session-control": { preset: "session-control", showBarPocMarkers: false, showSessionPoc: true, showPriorSessionPoc: true, showRollingPoc: false },
  "auction-completion": { preset: "auction-completion", showBarPocMarkers: false, showDynamicPocLine: false, showAuctionMarkers: true, showExtendedLevels: true, auctionExtremeSource: "raw-exchange-tick" },
  "excess-research": { preset: "excess-research", showBarPocMarkers: false, excessEnabled: true, excessLookbackTicks: 4, minimumTaperSteps: 2, showActiveLane: true },
  "poc-migration": { preset: "poc-migration", showBarPocMarkers: false, showSessionPoc: true, showRollingPoc: true, showLowerPane: true, alertOnMigration: true },
  "minimal-levels": { preset: "minimal-levels", showBarPocMarkers: false, showFinishedHigh: false, showFinishedLow: false, showActiveLane: false, opacity: 58 },
  research: { preset: "research", showBarPoc: true, showSessionPoc: true, showPriorSessionPoc: true, showRollingPoc: true, showCompositePoc: true, showLowerPane: true, historyBars: 5_000, maximumAuctionLevels: 2_000 },
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const integer = (value: unknown, fallback: number, minimum: number, maximum: number) => Math.round(clamp(finite(value, fallback), minimum, maximum));

export function normalizePocAuctionSuiteSettings(input?: Record<string, unknown> | null): PocAuctionSuiteSettings {
  const source = input ?? {};
  const result = { ...DEFAULT_POC_AUCTION_SUITE_SETTINGS, ...source, schemaVersion: POC_AUCTION_SUITE_SETTINGS_VERSION } as PocAuctionSuiteSettings;
  result.customGroupSizeTicks = integer(source.customGroupSizeTicks, 1, 1, 1_000);
  result.automaticTargetRows = integer(source.automaticTargetRows, 80, 20, 500);
  result.percentageOfMaximum = clamp(finite(source.percentageOfMaximum, 0.95), 0.01, 1);
  result.topNContiguousGroups = integer(source.topNContiguousGroups, 3, 1, 100);
  result.customBandTicks = integer(source.customBandTicks, 1, 0, 1_000);
  result.minimumPocVolume = clamp(finite(source.minimumPocVolume, 1), 0, 1_000_000_000);
  result.minimumPocTradeCount = integer(source.minimumPocTradeCount, 1, 0, 1_000_000);
  result.rollingBars = integer(source.rollingBars, 20, 2, 10_000);
  result.rollingDurationMs = integer(source.rollingDurationMs, 3_600_000, 1_000, 31_536_000_000);
  result.minimumMigrationTicks = integer(source.minimumMigrationTicks, 1, 0, 10_000);
  result.minimumNewPocDwellMs = integer(source.minimumNewPocDwellMs, 250, 0, 300_000);
  result.touchToleranceTicks = integer(source.touchToleranceTicks, 0, 0, 1_000);
  result.minimumTouchVolume = clamp(finite(source.minimumTouchVolume, 1), 0, 1_000_000_000);
  result.minimumAcceptanceVolume = clamp(finite(source.minimumAcceptanceVolume, 100), 0, 1_000_000_000);
  result.minimumAcceptanceTimeMs = integer(source.minimumAcceptanceTimeMs, 2_000, 0, 86_400_000);
  result.minimumRejectionTicks = integer(source.minimumRejectionTicks, 4, 1, 10_000);
  result.responseWindowMs = integer(source.responseWindowMs, 10_000, 1, 86_400_000);
  result.maximumOppositeExtremeVolume = clamp(finite(source.maximumOppositeExtremeVolume, 0), 0, 1_000_000_000);
  result.minimumAggressiveExtremeVolume = clamp(finite(source.minimumAggressiveExtremeVolume, 1), 0, 1_000_000_000);
  result.minimumAggressiveExtremeTradeCount = integer(source.minimumAggressiveExtremeTradeCount, 1, 0, 1_000_000);
  result.maximumUnknownExtremeVolume = clamp(finite(source.maximumUnknownExtremeVolume, 0), 0, 1_000_000_000);
  result.minimumOppositeUnfinishedVolume = clamp(finite(source.minimumOppositeUnfinishedVolume, 1), 0, 1_000_000_000);
  result.minimumAggressiveUnfinishedVolume = clamp(finite(source.minimumAggressiveUnfinishedVolume, 1), 0, 1_000_000_000);
  result.minimumOppositeUnfinishedTrades = integer(source.minimumOppositeUnfinishedTrades, 1, 0, 1_000_000);
  result.minimumAggressiveUnfinishedTrades = integer(source.minimumAggressiveUnfinishedTrades, 1, 0, 1_000_000);
  result.excessLookbackTicks = integer(source.excessLookbackTicks, 4, 2, 100);
  result.minimumTaperSteps = integer(source.minimumTaperSteps, 2, 1, 99);
  result.maximumTaperRatio = clamp(finite(source.maximumTaperRatio, 0.75), 0.01, 1);
  result.maximumExtremeVolumeRelativeToLocalMedian = clamp(finite(source.maximumExtremeVolumeRelativeToLocalMedian, 0.5), 0, 10);
  result.minimumInteriorReferenceVolume = clamp(finite(source.minimumInteriorReferenceVolume, 10), 0, 1_000_000_000);
  result.minimumExcessScore = clamp(finite(source.minimumExcessScore, 35), 0, 100);
  result.auctionTouchToleranceTicks = integer(source.auctionTouchToleranceTicks, 0, 0, 1_000);
  result.minimumTradeThroughTicks = integer(source.minimumTradeThroughTicks, 1, 1, 1_000);
  result.minimumResolutionVolume = clamp(finite(source.minimumResolutionVolume, 25), 0, 1_000_000_000);
  result.activeLaneWidth = integer(source.activeLaneWidth, 150, 90, 320);
  result.maximumActiveLaneRows = integer(source.maximumActiveLaneRows, 14, 1, 100);
  result.markerSize = clamp(finite(source.markerSize, 7), 4, 14);
  result.lineWidth = clamp(finite(source.lineWidth, 1.5), 0.5, 4);
  result.opacity = clamp(finite(source.opacity, 82), 0, 100);
  result.historyBars = integer(source.historyBars, 1_500, 50, 10_000);
  result.maximumActivePocs = integer(source.maximumActivePocs, 250, 10, 5_000);
  result.maximumAuctionLevels = integer(source.maximumAuctionLevels, 500, 10, 10_000);
  const metrics: PocMetric[] = ["total-volume", "bid-volume", "ask-volume", "absolute-delta", "trade-count"];
  if (!metrics.includes(result.metric)) result.metric = "total-volume";
  const ties: PocTieBreakMode[] = ["follow-shared-profile-engine", "closest-to-volume-weighted-price", "closest-to-close", "highest-price", "lowest-price", "first-achieved", "last-achieved"];
  if (!ties.includes(result.tieBreakMode)) result.tieBreakMode = "follow-shared-profile-engine";
  return result;
}

export interface PocAuctionCell {
  lowTick: number;
  highTick: number;
  centreTick: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  totalVolume: number;
  delta: number;
  absoluteDelta: number;
  bidTradeCount: number;
  askTradeCount: number;
  totalTradeCount: number;
}

export interface PocResult {
  id: string;
  scope: PocScope;
  scopeId: string;
  state: PocLifecycleState;
  metric: PocMetric;
  lowTick: number;
  highTick: number;
  centreTick: number;
  metricValue: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  delta: number;
  absoluteDelta: number;
  tradeCount: number;
  tieCount: number;
  tieBreakMode: PocTieBreakMode;
  startTimeMs: number;
  endTimeMs: number;
  previousCentreTick?: number;
  migrationTicks: number;
  migrationVelocityTicksPerMinute: number;
  touchCount: number;
  firstTouchMs?: number;
  acceptedVolumeAfterTouch: number;
  responseTicksAfterTouch: number;
  sourceBarIds: string[];
  calculationSignature: string;
}

export interface AuctionResult {
  id: string;
  barId: string;
  extremeSide: "high" | "low";
  completionState: AuctionCompletionState;
  lifecycleState: AuctionLifecycleState;
  extremeTick: number;
  bidVolume: number;
  askVolume: number;
  unknownVolume: number;
  bidTradeCount: number;
  askTradeCount: number;
  totalVolume: number;
  exactZeroSide: boolean;
  taperVolumes: number[];
  taperStepCount: number;
  taperRatioMedian?: number;
  score: number;
  sourceStartMs: number;
  sourceEndMs: number;
  firstTouchMs?: number;
  revisitCount: number;
  resolvedMs?: number;
  resolutionMode?: AuctionResolutionMode;
  calculationSignature: string;
  warnings: string[];
}

export interface PocAuctionAlert {
  id: string;
  type: "bar-poc-created" | "bar-poc-migrated" | "session-poc-migrated" | "new-naked-poc" | "naked-poc-tested" | "finished-auction-high" | "finished-auction-low" | "unfinished-auction-high" | "unfinished-auction-low" | "excess-high" | "excess-low" | "auction-revisited" | "auction-resolved" | "auction-traded-through" | "trade-data-stale";
  poc?: PocResult;
  auction?: AuctionResult;
}

export interface PocAuctionFrame {
  generatedAt: number;
  status: "LIVE" | "HISTORICAL" | "GROUPED_EXTREMES" | "TRADE_DATA_STALE" | "WAITING_FOR_VOLUME_AT_PRICE" | "UNAVAILABLE";
  instrument: string;
  tickSize: number;
  groupTicks: number;
  lastPrice: number | null;
  barPocs: PocResult[];
  dynamicPocs: PocResult[];
  activePocs: PocResult[];
  auctions: AuctionResult[];
  alerts: PocAuctionAlert[];
  calculationSignature: string;
  limitations: string[];
}

export const priceToPocTick = (price: number, tickSize: number) => Math.round(price / Math.max(0.000000001, tickSize));
export const pocTickToPrice = (tick: number, tickSize: number) => tick * tickSize;

export function footprintRowToPocCell(row: FootprintRow, groupTicks = 1): PocAuctionCell {
  return {
    lowTick: row.tickIndex,
    highTick: row.tickIndex + Math.max(1, groupTicks) - 1,
    centreTick: row.tickIndex + (Math.max(1, groupTicks) - 1) / 2,
    bidVolume: row.bidVolume,
    askVolume: row.askVolume,
    unknownVolume: row.unknownVolume,
    totalVolume: row.bidVolume + row.askVolume,
    delta: row.askVolume - row.bidVolume,
    absoluteDelta: Math.abs(row.askVolume - row.bidVolume),
    bidTradeCount: row.bidTrades,
    askTradeCount: row.askTrades,
    totalTradeCount: row.bidTrades + row.askTrades,
  };
}

export function getPocMetricValue(cell: PocAuctionCell, metric: PocMetric) {
  if (metric === "bid-volume") return cell.bidVolume;
  if (metric === "ask-volume") return cell.askVolume;
  if (metric === "absolute-delta") return cell.absoluteDelta;
  if (metric === "trade-count") return cell.totalTradeCount;
  return cell.totalVolume;
}

function weightedCentre(cells: PocAuctionCell[]) {
  const volume = cells.reduce((sum, cell) => sum + cell.totalVolume, 0);
  return volume > 0 ? cells.reduce((sum, cell) => sum + cell.centreTick * cell.totalVolume, 0) / volume : 0;
}

export function choosePocCell(cells: PocAuctionCell[], metric: PocMetric, tieBreakMode: PocTieBreakMode, closeTick: number) {
  const valid = cells.filter((cell) => getPocMetricValue(cell, metric) > 0);
  if (!valid.length) return null;
  const maximum = Math.max(...valid.map((cell) => getPocMetricValue(cell, metric)));
  const candidates = valid.filter((cell) => getPocMetricValue(cell, metric) === maximum);
  const vwapTick = weightedCentre(valid);
  const mode = tieBreakMode === "follow-shared-profile-engine" ? "closest-to-volume-weighted-price" : tieBreakMode;
  candidates.sort((left, right) => {
    if (mode === "highest-price") return right.centreTick - left.centreTick;
    if (mode === "lowest-price") return left.centreTick - right.centreTick;
    if (mode === "closest-to-close") return Math.abs(left.centreTick - closeTick) - Math.abs(right.centreTick - closeTick) || left.centreTick - right.centreTick;
    if (mode === "first-achieved") return left.lowTick - right.lowTick;
    if (mode === "last-achieved") return right.lowTick - left.lowTick;
    return Math.abs(left.centreTick - vwapTick) - Math.abs(right.centreTick - vwapTick)
      || Math.abs(left.centreTick - closeTick) - Math.abs(right.centreTick - closeTick)
      || left.centreTick - right.centreTick;
  });
  return { cell: candidates[0], metricValue: maximum, tieCount: candidates.length };
}

function mergeCells(bars: FootprintBar[], groupTicks: number) {
  const merged = new Map<number, PocAuctionCell>();
  for (const bar of bars) for (const row of bar.rows) {
    const groupedTick = Math.floor(row.tickIndex / groupTicks) * groupTicks;
    const existing = merged.get(groupedTick) ?? {
      lowTick: groupedTick, highTick: groupedTick + groupTicks - 1, centreTick: groupedTick + (groupTicks - 1) / 2,
      bidVolume: 0, askVolume: 0, unknownVolume: 0, totalVolume: 0, delta: 0, absoluteDelta: 0,
      bidTradeCount: 0, askTradeCount: 0, totalTradeCount: 0,
    };
    existing.bidVolume += row.bidVolume; existing.askVolume += row.askVolume; existing.unknownVolume += row.unknownVolume;
    existing.totalVolume = existing.bidVolume + existing.askVolume; existing.delta = existing.askVolume - existing.bidVolume; existing.absoluteDelta = Math.abs(existing.delta);
    existing.bidTradeCount += row.bidTrades; existing.askTradeCount += row.askTrades; existing.totalTradeCount = existing.bidTradeCount + existing.askTradeCount;
    merged.set(groupedTick, existing);
  }
  return [...merged.values()];
}

function makePoc(scope: PocScope, scopeId: string, bars: FootprintBar[], groupTicks: number, settings: PocAuctionSuiteSettings, state: PocLifecycleState): PocResult | null {
  if (!bars.length) return null;
  const cells = mergeCells(bars, groupTicks);
  const selected = choosePocCell(cells, settings.metric, settings.tieBreakMode, bars.at(-1)!.closeTick);
  if (!selected || selected.cell.totalVolume < settings.minimumPocVolume || selected.cell.totalTradeCount < settings.minimumPocTradeCount) return null;
  const startTimeMs = bars[0].startTime; const endTimeMs = bars.at(-1)!.endTime;
  const signature = `${settings.metric}:${settings.tieBreakMode}:${groupTicks}`;
  return {
    id: `poc:${scope}:${scopeId}:${signature}`, scope, scopeId, state, metric: settings.metric,
    lowTick: selected.cell.lowTick, highTick: selected.cell.highTick, centreTick: selected.cell.centreTick,
    metricValue: selected.metricValue, bidVolume: selected.cell.bidVolume, askVolume: selected.cell.askVolume, totalVolume: selected.cell.totalVolume,
    delta: selected.cell.delta, absoluteDelta: selected.cell.absoluteDelta, tradeCount: selected.cell.totalTradeCount,
    tieCount: selected.tieCount, tieBreakMode: settings.tieBreakMode, startTimeMs, endTimeMs,
    migrationTicks: 0, migrationVelocityTicksPerMinute: 0, touchCount: 0, acceptedVolumeAfterTouch: 0, responseTicksAfterTouch: 0,
    sourceBarIds: bars.map((bar) => bar.id), calculationSignature: signature,
  };
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function classifyAuction(bar: FootprintBar, rawBar: FootprintBar | undefined, side: "high" | "low", settings: PocAuctionSuiteSettings): AuctionResult {
  const source = settings.auctionExtremeSource === "raw-exchange-tick" ? rawBar : bar;
  const rawAvailable = Boolean(rawBar?.hasPriceLevelFlow);
  const extremeTick = side === "high" ? source?.highTick ?? bar.highTick : source?.lowTick ?? bar.lowTick;
  const row = source?.rows.find((item) => item.tickIndex === extremeTick);
  const bid = row?.bidVolume ?? 0; const ask = row?.askVolume ?? 0; const unknown = row?.unknownVolume ?? 0;
  const bidTrades = row?.bidTrades ?? 0; const askTrades = row?.askTrades ?? 0; const total = bid + ask;
  const aggressive = side === "high" ? ask : bid; const opposite = side === "high" ? bid : ask;
  const aggressiveTrades = side === "high" ? askTrades : bidTrades; const oppositeTrades = side === "high" ? bidTrades : askTrades;
  const exactZeroSide = opposite === 0 && aggressive > 0;
  let completionState: AuctionCompletionState = "inconclusive";
  const warnings: string[] = [];
  if (settings.auctionExtremeSource === "raw-exchange-tick" && !rawAvailable) warnings.push("RAW AUCTION EXTREMES UNAVAILABLE");
  if (settings.auctionExtremeSource === "displayed-group") warnings.push("GROUPED EXTREME APPROXIMATION");
  if (row && total > 0 && unknown <= settings.maximumUnknownExtremeVolume) {
    if (opposite <= settings.maximumOppositeExtremeVolume && aggressive >= settings.minimumAggressiveExtremeVolume && aggressiveTrades >= settings.minimumAggressiveExtremeTradeCount) completionState = exactZeroSide ? "zero-side" : "finished";
    else if (opposite >= settings.minimumOppositeUnfinishedVolume && aggressive >= settings.minimumAggressiveUnfinishedVolume && oppositeTrades >= settings.minimumOppositeUnfinishedTrades && aggressiveTrades >= settings.minimumAggressiveUnfinishedTrades && total >= settings.minimumTotalExtremeVolume) completionState = "unfinished";
  }
  const direction = side === "high" ? -1 : 1;
  const taperVolumes: number[] = [];
  for (let offset = settings.excessLookbackTicks - 1; offset >= 0; offset -= 1) {
    const tick = extremeTick + direction * offset;
    const level = source?.rows.find((item) => item.tickIndex === tick);
    taperVolumes.push(level ? level.bidVolume + level.askVolume : 0);
  }
  let taperStepCount = 0; const ratios: number[] = [];
  for (let index = 1; index < taperVolumes.length; index += 1) {
    const previous = taperVolumes[index - 1]; const next = taperVolumes[index];
    if (previous > 0) { const ratio = next / previous; ratios.push(ratio); if (ratio <= settings.maximumTaperRatio) taperStepCount += 1; }
  }
  const interiorMedian = median(taperVolumes.slice(0, -1).filter((value) => value > 0));
  const extremeThinness = interiorMedian > 0 ? 1 - clamp(total / interiorMedian, 0, 1) : 0;
  const taperStrength = 1 - clamp(median(ratios) / settings.maximumTaperRatio, 0, 1);
  const score = Math.round(100 * (clamp(taperStepCount / Math.max(1, settings.minimumTaperSteps), 0, 1) * 0.35 + taperStrength * 0.25 + extremeThinness * 0.25 + (exactZeroSide ? 0.15 : 0)));
  const finishedLike = completionState === "finished" || completionState === "zero-side";
  const excess = settings.excessEnabled && taperStepCount >= settings.minimumTaperSteps && interiorMedian >= settings.minimumInteriorReferenceVolume && total <= interiorMedian * settings.maximumExtremeVolumeRelativeToLocalMedian && (!settings.requireFinishedExtremeForExcess || finishedLike) && score >= settings.minimumExcessScore;
  if (excess) completionState = "excess";
  return {
    id: `auction:${bar.id}:${side}:${extremeTick}:${settings.auctionExtremeSource}`,
    barId: bar.id, extremeSide: side, completionState,
    lifecycleState: bar.isClosed ? (completionState === "unfinished" ? "active-level" : "confirmed") : "developing",
    extremeTick, bidVolume: bid, askVolume: ask, unknownVolume: unknown, bidTradeCount: bidTrades, askTradeCount: askTrades,
    totalVolume: total, exactZeroSide, taperVolumes, taperStepCount, taperRatioMedian: ratios.length ? median(ratios) : undefined,
    score, sourceStartMs: bar.startTime, sourceEndMs: bar.endTime, revisitCount: 0,
    calculationSignature: `${settings.auctionExtremeSource}:${settings.maximumOppositeExtremeVolume}:${settings.minimumOppositeUnfinishedVolume}:${settings.excessLookbackTicks}`,
    warnings,
  };
}

function applyPocLifecycle(poc: PocResult, bars: FootprintBar[], settings: PocAuctionSuiteSettings) {
  if (poc.state === "developing") return poc;
  const later = bars.filter((bar) => bar.startTime >= poc.endTimeMs);
  let touches = 0; let firstTouchMs: number | undefined; let touchVolume = 0; let response = 0;
  for (const bar of later) for (const row of bar.rows) {
    if (row.tickIndex < poc.lowTick - settings.touchToleranceTicks || row.tickIndex > poc.highTick + settings.touchToleranceTicks) continue;
    const volume = row.bidVolume + row.askVolume;
    if (volume <= 0) continue;
    touches += 1; touchVolume += volume; firstTouchMs ??= bar.startTime;
  }
  if (!touches) return { ...poc, state: settings.nakedPocEnabled ? "naked" as const : "frozen" as const };
  const afterTouch = firstTouchMs === undefined ? [] : later.filter((bar) => bar.startTime >= firstTouchMs && bar.startTime <= firstTouchMs + settings.responseWindowMs);
  const maxAbove = Math.max(0, ...afterTouch.map((bar) => bar.highTick - poc.highTick));
  const maxBelow = Math.max(0, ...afterTouch.map((bar) => poc.lowTick - bar.lowTick));
  response = Math.max(maxAbove, maxBelow);
  const accepted = touchVolume >= settings.minimumAcceptanceVolume;
  const rejected = response >= settings.minimumRejectionTicks;
  return { ...poc, state: accepted ? "accepted" as const : rejected ? "rejected" as const : "tested" as const, touchCount: touches, firstTouchMs, acceptedVolumeAfterTouch: touchVolume, responseTicksAfterTouch: response };
}

function applyAuctionLifecycle(auction: AuctionResult, bars: FootprintBar[], settings: PocAuctionSuiteSettings) {
  if (auction.completionState !== "unfinished" || auction.lifecycleState === "developing") return auction;
  const later = bars.filter((bar) => bar.startTime >= auction.sourceEndMs); let revisitCount = 0; let volume = 0; let firstTouchMs: number | undefined; let tradedThrough = false;
  for (const bar of later) {
    for (const row of bar.rows) {
      if (Math.abs(row.tickIndex - auction.extremeTick) <= settings.auctionTouchToleranceTicks) { const next = row.bidVolume + row.askVolume; if (next > 0) { revisitCount += 1; volume += next; firstTouchMs ??= bar.startTime; } }
    }
    if (auction.extremeSide === "high" ? bar.highTick >= auction.extremeTick + settings.minimumTradeThroughTicks : bar.lowTick <= auction.extremeTick - settings.minimumTradeThroughTicks) tradedThrough = true;
  }
  const firstTouchResolved = settings.auctionResolutionMode === "first-touch" && revisitCount > 0;
  const tradeThroughResolved = settings.auctionResolutionMode === "trade-through" && tradedThrough;
  const volumeResolved = settings.auctionResolutionMode === "minimum-volume-at-level" && volume >= settings.minimumResolutionVolume;
  const combinedResolved = settings.auctionResolutionMode === "combined" && revisitCount > 0 && tradedThrough && volume >= settings.minimumResolutionVolume;
  const resolved = firstTouchResolved || tradeThroughResolved || volumeResolved || combinedResolved;
  return { ...auction, lifecycleState: tradedThrough ? "traded-through" as const : resolved ? "resolved" as const : revisitCount > 0 ? "revisited" as const : "active-level" as const, revisitCount, firstTouchMs, resolvedMs: resolved ? firstTouchMs : undefined, resolutionMode: resolved ? settings.auctionResolutionMode : undefined };
}

export class PocAuctionSuiteEngine {
  private previousById = new Map<string, PocResult>();
  private emitted = new Set<string>();

  reset() { this.previousById.clear(); this.emitted.clear(); }

  update(displayBarsInput: FootprintBar[], rawBarsInput: FootprintBar[], instrument: string, tickSize: number, displayedGroupTicks: number, settingsInput?: Partial<PocAuctionSuiteSettings>): PocAuctionFrame {
    const settings = normalizePocAuctionSuiteSettings(settingsInput as Record<string, unknown>);
    const displayBars = displayBarsInput.slice(-settings.historyBars);
    const rawBars = rawBarsInput.slice(-settings.historyBars);
    const rawById = new Map(rawBars.map((bar) => [bar.id, bar]));
    const groupTicks = settings.groupingMode === "raw-exchange-tick" ? 1 : settings.groupingMode === "custom-ticks" ? settings.customGroupSizeTicks : Math.max(1, displayedGroupTicks);
    const signature = `${instrument}:${tickSize}:${groupTicks}:${settings.metric}:${settings.tieBreakMode}`;
    const hasFlow = displayBars.some((bar) => bar.hasPriceLevelFlow);
    if (!hasFlow) return { generatedAt: Date.now(), status: "WAITING_FOR_VOLUME_AT_PRICE", instrument, tickSize, groupTicks, lastPrice: displayBars.at(-1)?.close ?? null, barPocs: [], dynamicPocs: [], activePocs: [], auctions: [], alerts: [], calculationSignature: signature, limitations: ["POC & Auction requires volume-at-price data."] };

    const barPocs = settings.showBarPoc ? displayBars.flatMap((bar) => {
      const poc = makePoc("bar", bar.id, [bar], groupTicks, settings, bar.isClosed ? "frozen" : "developing");
      return poc ? [applyPocLifecycle(poc, displayBars, settings)] : [];
    }) : [];

    const bySession = new Map<string, FootprintBar[]>();
    for (const bar of displayBars) { const session = cmeSessionDateKey(bar.startTime) ?? new Date(bar.startTime).toISOString().slice(0, 10); const rows = bySession.get(session) ?? []; rows.push(bar); bySession.set(session, rows); }
    const sessions = [...bySession.entries()].sort((a, b) => a[1][0].startTime - b[1][0].startTime);
    const dynamicPocs: PocResult[] = [];
    if (settings.showSessionPoc) { const current = sessions.at(-1); if (current) { const poc = makePoc("session", current[0], current[1], groupTicks, settings, "developing"); if (poc) dynamicPocs.push(poc); } }
    if (settings.showPriorSessionPoc && sessions.length > 1) { const prior = sessions.at(-2)!; const poc = makePoc("session", prior[0], prior[1], groupTicks, settings, "frozen"); if (poc) dynamicPocs.push(applyPocLifecycle(poc, displayBars, settings)); }
    if (settings.showRollingPoc && displayBars.length) {
      const end = displayBars.at(-1)!.endTime; const rolling = settings.rollingMode === "time" ? displayBars.filter((bar) => bar.endTime >= end - settings.rollingDurationMs) : displayBars.slice(-settings.rollingBars);
      const poc = makePoc(settings.rollingMode === "time" ? "rolling-time" : "rolling-bars", settings.rollingMode === "time" ? `${end - settings.rollingDurationMs}:${end}` : `${settings.rollingBars}:${end}`, rolling, groupTicks, settings, "developing"); if (poc) dynamicPocs.push(poc);
    }
    if (settings.showAnchoredPoc && settings.anchorStartMs > 0) { const selected = displayBars.filter((bar) => bar.endTime >= settings.anchorStartMs && (settings.anchorFollowLive || settings.anchorEndMs <= 0 || bar.startTime <= settings.anchorEndMs)); const poc = makePoc("anchored", `${settings.anchorStartMs}:${settings.anchorFollowLive ? "live" : settings.anchorEndMs}`, selected, groupTicks, settings, settings.anchorFollowLive ? "developing" : "frozen"); if (poc) dynamicPocs.push(applyPocLifecycle(poc, displayBars, settings)); }
    if (settings.showCompositePoc) { const selected = displayBars.filter((bar) => (settings.compositeStartMs <= 0 || bar.endTime >= settings.compositeStartMs) && (settings.compositeEndMs <= 0 || bar.startTime <= settings.compositeEndMs)); const poc = makePoc("composite", `${settings.compositeStartMs}:${settings.compositeEndMs}`, selected, groupTicks, settings, "frozen"); if (poc) dynamicPocs.push(applyPocLifecycle(poc, displayBars, settings)); }

    const allPocs = [...barPocs, ...dynamicPocs];
    for (const poc of allPocs) { const previous = this.previousById.get(poc.id); if (previous && previous.centreTick !== poc.centreTick) { const elapsed = Math.max(1 / 60, (poc.endTimeMs - previous.endTimeMs) / 60_000); poc.previousCentreTick = previous.centreTick; poc.migrationTicks = poc.centreTick - previous.centreTick; poc.migrationVelocityTicksPerMinute = poc.migrationTicks / elapsed; } this.previousById.set(poc.id, { ...poc }); }

    let auctions = displayBars.flatMap((bar) => [classifyAuction(bar, rawById.get(bar.id), "high", settings), classifyAuction(bar, rawById.get(bar.id), "low", settings)])
      .map((auction) => applyAuctionLifecycle(auction, displayBars, settings))
      .filter((auction) => auction.completionState !== "inconclusive" || settings.preset === "research")
      .slice(-settings.maximumAuctionLevels);
    auctions = auctions.filter((auction) => auction.extremeSide === "high" ? (auction.completionState === "unfinished" ? settings.showUnfinishedHigh : auction.completionState === "excess" ? settings.excessEnabled : settings.showFinishedHigh) : (auction.completionState === "unfinished" ? settings.showUnfinishedLow : auction.completionState === "excess" ? settings.excessEnabled : settings.showFinishedLow));

    const activePocs = allPocs.filter((poc) => ["naked", "testing", "tested", "accepted", "rejected", "developing"].includes(poc.state)).slice(-settings.maximumActivePocs);
    const alerts: PocAuctionAlert[] = [];
    const emit = (alert: PocAuctionAlert) => { if (!this.emitted.has(alert.id)) { this.emitted.add(alert.id); alerts.push(alert); } };
    if (settings.alertsEnabled) {
      for (const poc of allPocs) {
        if (settings.alertOnMigration && Math.abs(poc.migrationTicks) >= settings.minimumMigrationTicks) emit({ id: `${poc.id}:migrate:${poc.centreTick}`, type: poc.scope === "session" ? "session-poc-migrated" : "bar-poc-migrated", poc });
        if (settings.alertOnNewNakedPoc && poc.state === "naked") emit({ id: `${poc.id}:naked`, type: "new-naked-poc", poc });
      }
      if (settings.alertOnAuctionClose) for (const auction of auctions.filter((item) => item.lifecycleState !== "developing")) {
        const type: PocAuctionAlert["type"] = auction.completionState === "excess" ? (auction.extremeSide === "high" ? "excess-high" : "excess-low") : auction.completionState === "unfinished" ? (auction.extremeSide === "high" ? "unfinished-auction-high" : "unfinished-auction-low") : (auction.extremeSide === "high" ? "finished-auction-high" : "finished-auction-low");
        emit({ id: `${auction.id}:${type}`, type, auction });
      }
    }

    const rawAvailable = rawBars.some((bar) => bar.hasPriceLevelFlow);
    const latest = displayBars.at(-1); const generatedAt = Date.now(); const dataAge = latest ? generatedAt - latest.endTime : Infinity;
    const status: PocAuctionFrame["status"] = settings.auctionExtremeSource === "raw-exchange-tick" && !rawAvailable ? "GROUPED_EXTREMES" : latest && !latest.isClosed ? "LIVE" : "HISTORICAL";
    const limitations: string[] = [];
    if (!rawAvailable) limitations.push("RAW AUCTION EXTREMES UNAVAILABLE");
    if (settings.auctionExtremeSource === "displayed-group") limitations.push("GROUPED EXTREME APPROXIMATION");
    if (dataAge > 120_000 && latest && !latest.isClosed) limitations.push("TRADE DATA STALE");
    return { generatedAt, status: dataAge > 120_000 && latest && !latest.isClosed ? "TRADE_DATA_STALE" : status, instrument, tickSize, groupTicks, lastPrice: latest?.close ?? null, barPocs, dynamicPocs, activePocs, auctions, alerts, calculationSignature: signature, limitations };
  }
}
