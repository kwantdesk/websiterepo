import type { ChartSettings } from "@/lib/chartSettings";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";
import { DEFAULT_FOOTPRINT_SETTINGS, FOOTPRINT_SETTINGS_SCHEMA_VERSION } from "@/lib/footprintSettings";
import { defaultTpoSettings, tpoSettingsToRecord, validateTpoSettings } from "@/lib/tpo/settings";
import { DEFAULT_DOM_PRO_VISIBLE_ROWS, DOM_PRO_SETTINGS_VERSION } from "@/lib/domPro";
import { DEFAULT_PULLING_STACKING_SETTINGS, normalizePullingStackingSettings, PULLING_STACKING_SETTINGS_VERSION } from "@/lib/pullingStacking";
import { ABSORPTION_DETECTOR_SETTINGS_VERSION, DEFAULT_ABSORPTION_SETTINGS, normalizeAbsorptionSettings } from "@/lib/absorptionDetector";
import { DEFAULT_STACKED_IMBALANCE_SETTINGS, STACKED_IMBALANCE_SETTINGS_VERSION, normalizeStackedImbalanceSettings } from "@/lib/stackedImbalanceSuite";
import { DEFAULT_ICEBERG_REFRESH_SETTINGS, ICEBERG_REFRESH_SETTINGS_VERSION, normalizeIcebergRefreshSettings } from "@/lib/icebergRefreshDetector";
import { DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS, LIQUIDITY_STOP_SWEEP_SETTINGS_VERSION, normalizeLiquidityStopSweepSettings } from "@/lib/liquidityStopSweepDetector";
import { DEFAULT_POC_AUCTION_SUITE_SETTINGS, POC_AUCTION_SUITE_SETTINGS_VERSION, normalizePocAuctionSuiteSettings } from "@/lib/pocAuctionSuite";
import { DEFAULT_TAPE_SPEED_SETTINGS, normalizeTapeSpeedSettings } from "@/lib/tapeSpeedOrderFlowBurst";

export const LIVE_CHART_INDICATOR_IDS = new Set([
  "gamma-environment",
  "zero-gamma-line",
  "options-delta",
  "zero-gamma-bars",
  "gamma-heatmap",
  "net-gamma-exposure-by-strike",
  "gex-interval-map",
  "bounce-levels",
  "dark-pool-map",
  "dark-pool-gex",
  "implied-volatility-rank",
  "volume",
  "delta-bar",
  "delta-highlight",
  "delta-cumulative-candlestick",
  "delta-cumulative-histogram",
  "imbalance-tracker",
  "imbalance-rejector",
  "cumulative-volume-delta",
  "cvd-divergence",
  "pulling-stacking",
  "absorption-detector",
  "stacked-imbalance-suite",
  "iceberg-refresh-detector",
  "liquidity-stop-sweep-detector",
  "poc-auction-suite",
  "tape-speed-order-flow-burst",
  "moving-average",
  "vwap",
  "vwap-envelopes",
  "rolling-vwap",
  "relative-strength-index-rsi",
  "rate-of-change-roc",
  "macd-indicator",
  "momentum-indicator",
  "commodity-channel-index-cci",
  "aroon-up-down",
  "aroon-oscillator",
  "awesome-oscillator",
  "stochastic-oscillator",
  "williams-r",
  "chaikin-accumulation-distribution",
  "standard-deviation",
  "average-true-range-atr",
  "bollinger-bands",
  "donchian-channel",
  "keltner-channel",
  "kwant-profile",
  "tpo-chart",
  "weekly-tpo",
  "weekly-volume-profile",
  "custom-draw-on-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
  "sessions",
  "session-highs-lows",
  "ib-levels",
  "big-trades",
  "deep-m-effort-nq",
  "depth-of-market",
  "deep-print-footprint",
  "kwant-stats",
  "gamma-levels",
  "classic-gex-profile",
  "tpo-levels",
  "expected-move",
  "hedge-levels",
  "divergence-detector",
  "source-code-indicator",
]);
export const VOLUME_PROFILE_INDICATOR_IDS = new Set([
  "kwant-profile",
  "weekly-volume-profile",
  "custom-draw-on-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
]);
export const DAILY_VOLUME_PROFILE_INDICATOR_IDS = new Set([
  "kwant-profile",
  "ask-bid-volume-profile",
  "delta-profile",
]);

export type IndicatorNumericSetting = {
  key: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
};

export const INDICATOR_NUMERIC_SETTINGS: Record<string, IndicatorNumericSetting[]> = {
  "zero-gamma-line": [
    { key: "historySessions", label: "Trading sessions of history", defaultValue: 5, min: 1, max: 5, step: 1 },
    // The crossing moves slowly; refreshing faster than ~30s multiplied the
    // shared provider quota across panes and machines for identical values.
    { key: "refreshSeconds", label: "Live refresh (seconds)", defaultValue: 30, min: 15, max: 120, step: 5 },
    { key: "opacity", label: "Line visibility (%)", defaultValue: 72, min: 5, max: 100, step: 1 },
    { key: "lineWidth", label: "Line width", defaultValue: 2, min: 1, max: 4, step: 1 },
  ],
  "options-delta": [
    { key: "refreshSeconds", label: "Live refresh (seconds)", defaultValue: 60, min: 15, max: 300, step: 5 },
  ],
  "zero-gamma-bars": [
    { key: "refreshSeconds", label: "Live refresh (seconds)", defaultValue: 60, min: 15, max: 300, step: 5 },
  ],
  "cvd-divergence": [
    { key: "pivotStrength", label: "Swing pivot strength (bars)", defaultValue: 2, min: 1, max: 5, step: 1 },
    { key: "lookbackBars", label: "Lookback (bars)", defaultValue: 80, min: 20, max: 300, step: 5 },
    { key: "recentBars", label: "Recent anchor window (bars)", defaultValue: 12, min: 3, max: 60, step: 1 },
    { key: "lineWidth", label: "Divergence line width", defaultValue: 2, min: 1, max: 4, step: 1 },
  ],
  "tape-speed-order-flow-burst": [
    { key: "rollingWindowMs", label: "Rolling window (ms)", defaultValue: 1000, min: 50, max: 60000, step: 50 },
    { key: "updateStepMs", label: "Update step (ms)", defaultValue: 100, min: 16, max: 10000, step: 10 },
    { key: "fixedBucketMs", label: "Fixed bucket (ms)", defaultValue: 1000, min: 50, max: 60000, step: 50 },
    { key: "maximumInterTradeGapMs", label: "Maximum inter-trade gap (ms)", defaultValue: 75, min: 1, max: 10000, step: 1 },
    { key: "maximumEventDurationMs", label: "Maximum event duration (ms)", defaultValue: 2000, min: 50, max: 60000, step: 50 },
    { key: "baselineWindowMs", label: "Dynamic baseline window (ms)", defaultValue: 120000, min: 1000, max: 3600000, step: 1000 },
    { key: "minimumBaselineSamples", label: "Minimum baseline samples", defaultValue: 30, min: 1, max: 10000, step: 1 },
    { key: "selectedPercentile", label: "Baseline percentile", defaultValue: 0.9, min: 0.5, max: 0.999, step: 0.01 },
    { key: "relativeSpeedMultiplier", label: "Relative speed multiplier", defaultValue: 2, min: 0.1, max: 50, step: 0.1 },
    { key: "relativeDeltaMultiplier", label: "Relative delta multiplier", defaultValue: 2, min: 0.1, max: 50, step: 0.1 },
    { key: "minimumContractsPerSecond", label: "Minimum contracts / second", defaultValue: 100, min: 0, max: 10000000, step: 10 },
    { key: "minimumTradesPerSecond", label: "Minimum trades / second", defaultValue: 5, min: 0, max: 1000000, step: 1 },
    { key: "minimumAbsoluteDeltaPerSecond", label: "Minimum absolute delta / second", defaultValue: 50, min: 0, max: 10000000, step: 10 },
    { key: "minimumQuantity", label: "Minimum window quantity", defaultValue: 100, min: 1, max: 10000000, step: 1 },
    { key: "minimumTradeCount", label: "Minimum window trades", defaultValue: 3, min: 1, max: 1000000, step: 1 },
    { key: "minimumDirectionalShare", label: "Minimum directional share", defaultValue: 0.7, min: 0.5, max: 1, step: 0.01 },
    { key: "minimumDirectionalDelta", label: "Minimum directional delta", defaultValue: 25, min: 0, max: 10000000, step: 1 },
    { key: "minimumQualityScore", label: "Minimum data quality", defaultValue: 60, min: 0, max: 100, step: 1 },
    { key: "minimumMarkerScore", label: "Minimum marker score", defaultValue: 70, min: 0, max: 100, step: 1 },
    { key: "largeTradeThreshold", label: "Large trade threshold", defaultValue: 100, min: 1, max: 10000000, step: 1 },
    { key: "continuationWindowMs", label: "Response window (ms)", defaultValue: 3000, min: 100, max: 300000, step: 100 },
    { key: "historySeconds", label: "Visible history (seconds)", defaultValue: 3600, min: 30, max: 86400, step: 30 },
    { key: "paneHeight", label: "Lower pane height", defaultValue: 190, min: 120, max: 520, step: 5 },
    { key: "markerSize", label: "Marker size", defaultValue: 7, min: 4, max: 18, step: 1 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 78, min: 0, max: 100, step: 1 },
  ],
  "poc-auction-suite": [
    { key: "customGroupSizeTicks", label: "Custom grouping (ticks)", defaultValue: 1, min: 1, max: 1000, step: 1 },
    { key: "automaticTargetRows", label: "Automatic target rows", defaultValue: 80, min: 20, max: 500, step: 1 },
    { key: "percentageOfMaximum", label: "POC band percentage", defaultValue: 0.95, min: 0.01, max: 1, step: 0.01 },
    { key: "topNContiguousGroups", label: "POC band contiguous rows", defaultValue: 3, min: 1, max: 100, step: 1 },
    { key: "minimumPocVolume", label: "Minimum POC volume", defaultValue: 1, min: 0, max: 1000000000, step: 1 },
    { key: "minimumPocTradeCount", label: "Minimum POC trades", defaultValue: 1, min: 0, max: 1000000, step: 1 },
    { key: "rollingBars", label: "Rolling POC bars", defaultValue: 20, min: 2, max: 10000, step: 1 },
    { key: "minimumMigrationTicks", label: "Migration threshold (ticks)", defaultValue: 1, min: 0, max: 10000, step: 1 },
    { key: "touchToleranceTicks", label: "Naked POC touch tolerance", defaultValue: 0, min: 0, max: 1000, step: 1 },
    { key: "minimumAcceptanceVolume", label: "Acceptance volume", defaultValue: 100, min: 0, max: 1000000000, step: 1 },
    { key: "minimumRejectionTicks", label: "Rejection response (ticks)", defaultValue: 4, min: 1, max: 10000, step: 1 },
    { key: "excessLookbackTicks", label: "Excess lookback (ticks)", defaultValue: 4, min: 2, max: 100, step: 1 },
    { key: "minimumTaperSteps", label: "Minimum taper steps", defaultValue: 2, min: 1, max: 99, step: 1 },
    { key: "maximumTaperRatio", label: "Maximum taper ratio", defaultValue: 0.75, min: 0.01, max: 1, step: 0.01 },
    { key: "minimumExcessScore", label: "Minimum excess score", defaultValue: 35, min: 0, max: 100, step: 1 },
    { key: "activeLaneWidth", label: "Active level lane width", defaultValue: 150, min: 90, max: 320, step: 1 },
    { key: "maximumActiveLaneRows", label: "Maximum active lane rows", defaultValue: 14, min: 1, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 7, min: 4, max: 14, step: 1 },
    { key: "lineWidth", label: "Line width", defaultValue: 1.5, min: 0.5, max: 4, step: 0.5 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 82, min: 0, max: 100, step: 1 },
    { key: "historyBars", label: "History bars", defaultValue: 1500, min: 50, max: 10000, step: 50 },
  ],
  "liquidity-stop-sweep-detector": [
    { key: "maximumInterTradeGapMs", label: "Maximum inter-trade gap (ms)", defaultValue: 75, min: 1, max: 10000, step: 1 },
    { key: "maximumSweepDurationMs", label: "Maximum sweep duration (ms)", defaultValue: 1000, min: 1, max: 60000, step: 10 },
    { key: "maximumBacktrackTicks", label: "Maximum backtrack (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "maximumInterTradeJumpTicks", label: "Maximum price jump (ticks)", defaultValue: 4, min: 1, max: 1000, step: 1 },
    { key: "minimumSweepContracts", label: "Minimum sweep contracts", defaultValue: 100, min: 1, max: 1000000, step: 1 },
    { key: "minimumSweepTradeCount", label: "Minimum sweep trades", defaultValue: 3, min: 1, max: 10000, step: 1 },
    { key: "minimumSweptLevels", label: "Minimum swept levels", defaultValue: 3, min: 2, max: 1000, step: 1 },
    { key: "minimumSweepRangeTicks", label: "Minimum sweep range (ticks)", defaultValue: 2, min: 1, max: 1000, step: 1 },
    { key: "minimumContractsPerSecond", label: "Minimum contracts / second", defaultValue: 100, min: 0, max: 10000000, step: 10 },
    { key: "minimumContiguousCoverageRatio", label: "Minimum contiguous coverage", defaultValue: 0.75, min: 0, max: 1, step: 0.01 },
    { key: "minimumDirectionalProgressRatio", label: "Minimum directional progress", defaultValue: 0.6, min: 0, max: 1, step: 0.01 },
    { key: "minimumReferenceBreachTicks", label: "Minimum reference breach (ticks)", defaultValue: 1, min: 0, max: 1000, step: 1 },
    { key: "maximumReferenceDistanceTicks", label: "Maximum reference distance", defaultValue: 20, min: 0, max: 10000, step: 1 },
    { key: "minimumContinuationTicks", label: "Continuation confirmation (ticks)", defaultValue: 3, min: 1, max: 1000, step: 1 },
    { key: "minimumRejectionTicks", label: "Rejection confirmation (ticks)", defaultValue: 3, min: 1, max: 1000, step: 1 },
    { key: "historySeconds", label: "Visible history (seconds)", defaultValue: 3600, min: 30, max: 86400, step: 30 },
    { key: "activeLaneWidth", label: "Active event lane width", defaultValue: 142, min: 90, max: 300, step: 1 },
    { key: "minimumLaneScore", label: "Lane minimum score", defaultValue: 60, min: 0, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 8, min: 5, max: 17, step: 1 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 78, min: 0, max: 100, step: 1 },
    { key: "alertMinimumScore", label: "Alert minimum score", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "alertMinimumQuality", label: "Alert minimum quality", defaultValue: 60, min: 0, max: 100, step: 1 },
  ],
  "iceberg-refresh-detector": [
    { key: "attributionWindowMs", label: "Refresh attribution window (ms)", defaultValue: 250, min: 10, max: 10000, step: 10 },
    { key: "minimumCycleExecution", label: "Minimum cycle execution", defaultValue: 10, min: 1, max: 1000000, step: 1 },
    { key: "minimumCycleReplenishment", label: "Minimum cycle replenishment", defaultValue: 10, min: 1, max: 1000000, step: 1 },
    { key: "minimumCycleReplenishmentRatio", label: "Minimum cycle refresh ratio", defaultValue: 0.5, min: 0, max: 10, step: 0.05 },
    { key: "activeMinimumExecuted", label: "Active minimum executed", defaultValue: 100, min: 1, max: 1000000, step: 1 },
    { key: "activeMinimumReplenished", label: "Active minimum replenished", defaultValue: 50, min: 1, max: 1000000, step: 1 },
    { key: "minimumRefreshCycles", label: "Minimum refresh cycles", defaultValue: 2, min: 1, max: 100, step: 1 },
    { key: "minimumReplenishmentRatio", label: "Minimum replenishment ratio", defaultValue: 0.5, min: 0, max: 10, step: 0.05 },
    { key: "minimumExecutionToDisplayRatio", label: "Executed / displayed ratio", defaultValue: 1.25, min: 0, max: 100, step: 0.05 },
    { key: "minimumSuspectedCycles", label: "Suspected minimum cycles", defaultValue: 3, min: 1, max: 100, step: 1 },
    { key: "minimumSuspectedExecuted", label: "Suspected minimum executed", defaultValue: 200, min: 1, max: 1000000, step: 1 },
    { key: "minimumSuspectedScore", label: "Suspected minimum score", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "minimumQuality", label: "Minimum data quality", defaultValue: 45, min: 0, max: 100, step: 1 },
    { key: "maximumPenetrationTicks", label: "Maximum penetration (ticks)", defaultValue: 1, min: 0, max: 1000, step: 1 },
    { key: "minimumPulledContracts", label: "Pulled minimum contracts", defaultValue: 50, min: 1, max: 1000000, step: 1 },
    { key: "minimumPullRatio", label: "Pulled minimum ratio", defaultValue: 0.5, min: 0, max: 10, step: 0.05 },
    { key: "historySeconds", label: "Visible history (seconds)", defaultValue: 3600, min: 30, max: 86400, step: 30 },
    { key: "activeProfileWidth", label: "Active profile width", defaultValue: 140, min: 90, max: 300, step: 2 },
    { key: "markerSize", label: "Marker size", defaultValue: 8, min: 5, max: 17, step: 1 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 72, min: 0, max: 100, step: 1 },
    { key: "alertMinimumScore", label: "Alert minimum score", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "alertMinimumQuality", label: "Alert minimum quality", defaultValue: 45, min: 0, max: 100, step: 1 },
  ],
  "stacked-imbalance-suite": [
    { key: "customOffsetGroups", label: "Comparison offset (groups)", defaultValue: 1, min: 1, max: 20, step: 1 },
    { key: "ratioThreshold", label: "Ratio threshold", defaultValue: 3, min: 1.01, max: 100, step: 0.1 },
    { key: "minimumAbsoluteDifference", label: "Minimum absolute difference", defaultValue: 100, min: 0, max: 1000000, step: 1 },
    { key: "minimumDominanceShare", label: "Minimum dominance share", defaultValue: 0.75, min: 0.5, max: 1, step: 0.01 },
    { key: "minimumNumeratorVolume", label: "Minimum dominant volume", defaultValue: 50, min: 0, max: 1000000, step: 1 },
    { key: "minimumCombinedVolume", label: "Minimum combined volume", defaultValue: 75, min: 0, max: 1000000, step: 1 },
    { key: "minimumStackedLevels", label: "Minimum stacked levels", defaultValue: 3, min: 2, max: 20, step: 1 },
    { key: "maximumGapGroups", label: "Maximum gap groups", defaultValue: 0, min: 0, max: 10, step: 1 },
    { key: "minimumStackedTotalNumerator", label: "Minimum stacked dominant volume", defaultValue: 150, min: 0, max: 1000000, step: 1 },
    { key: "minimumStackedScore", label: "Minimum stack score", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "rollingBars", label: "Rolling bars", defaultValue: 5, min: 2, max: 100, step: 1 },
    { key: "minimumDepartureGroups", label: "Retest departure (groups)", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "minimumResponseGroups", label: "Held response (groups)", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "maximumRetestsPerZone", label: "Maximum retests", defaultValue: 3, min: 0, max: 20, step: 1 },
    { key: "opacity", label: "Opacity", defaultValue: 74, min: 0, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 6, min: 4, max: 18, step: 1 },
    { key: "activeLaneWidth", label: "Active lane width", defaultValue: 96, min: 86, max: 240, step: 1 },
    { key: "alertMinimumScore", label: "Alert minimum score", defaultValue: 65, min: 0, max: 100, step: 1 },
  ],
  "absorption-detector": [
    { key: "windowMs", label: "Rolling window (ms)", defaultValue: 1000, min: 50, max: 60000, step: 50 },
    { key: "rollingStepMs", label: "Rolling step (ms)", defaultValue: 100, min: 16, max: 5000, step: 16 },
    { key: "mergeGapMs", label: "Event merge gap (ms)", defaultValue: 100, min: 0, max: 5000, step: 25 },
    { key: "maximumCandidateDurationMs", label: "Maximum candidate duration (ms)", defaultValue: 3000, min: 100, max: 60000, step: 100 },
    { key: "confirmationWindowMs", label: "Confirmation window (ms)", defaultValue: 2000, min: 50, max: 60000, step: 50 },
    { key: "minimumContracts", label: "Absolute minimum contracts", defaultValue: 100, min: 1, max: 1000000, step: 1 },
    { key: "minimumTradeCount", label: "Minimum trade count", defaultValue: 3, min: 1, max: 1000, step: 1 },
    { key: "minimumDirectionalShare", label: "Minimum directional share", defaultValue: 0.7, min: 0.5, max: 1, step: 0.01 },
    { key: "maximumPenetrationTicks", label: "Maximum penetration (ticks)", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "minimumAggressionPerTick", label: "Minimum aggression per tick", defaultValue: 50, min: 0, max: 1000000, step: 1 },
    { key: "minimumDevelopingScore", label: "Minimum developing score", defaultValue: 45, min: 0, max: 100, step: 1 },
    { key: "minimumConfirmedScore", label: "Minimum confirmed score", defaultValue: 70, min: 0, max: 100, step: 1 },
    { key: "baselineWindowSeconds", label: "Dynamic baseline window (seconds)", defaultValue: 60, min: 5, max: 3600, step: 5 },
    { key: "baselineSampleLimit", label: "Baseline sample limit", defaultValue: 4000, min: 30, max: 100000, step: 10 },
    { key: "baselineMinimumSamples", label: "Minimum baseline samples", defaultValue: 30, min: 1, max: 10000, step: 1 },
    { key: "baselineMedianMultiplier", label: "Baseline median multiplier", defaultValue: 3, min: 0.1, max: 20, step: 0.1 },
    { key: "minimumResponseTicks", label: "Minimum response (ticks)", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "minimumPersistenceMs", label: "Minimum persistence (ms)", defaultValue: 250, min: 0, max: 60000, step: 25 },
    { key: "minimumReplenishmentRatio", label: "Minimum replenishment ratio", defaultValue: 0.2, min: 0, max: 10, step: 0.05 },
    { key: "zoneMergeWindowMs", label: "Zone merge window (ms)", defaultValue: 750, min: 0, max: 60000, step: 50 },
    { key: "zoneMaximumGapTicks", label: "Zone maximum gap (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "retestMinimumDepartureTicks", label: "Retest departure (ticks)", defaultValue: 3, min: 1, max: 100, step: 1 },
    { key: "retestTouchToleranceTicks", label: "Retest tolerance (ticks)", defaultValue: 1, min: 0, max: 20, step: 1 },
    { key: "breakToleranceTicks", label: "Break tolerance (ticks)", defaultValue: 1, min: 0, max: 20, step: 1 },
    { key: "minimumBreakVolume", label: "Minimum break volume", defaultValue: 50, min: 0, max: 1000000, step: 1 },
    { key: "minimumBreakTimeMs", label: "Minimum break time (ms)", defaultValue: 250, min: 0, max: 60000, step: 25 },
    { key: "replenishmentWindowMs", label: "Replenishment window (ms)", defaultValue: 1000, min: 50, max: 60000, step: 50 },
    { key: "replenishmentMinimumContracts", label: "Minimum replenishment contracts", defaultValue: 25, min: 0, max: 1000000, step: 1 },
    { key: "replenishmentMinimumRatio", label: "Replenishment ratio", defaultValue: 0.2, min: 0, max: 10, step: 0.05 },
    { key: "replenishmentMinimumRefreshCount", label: "Minimum refresh count", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "activeProfileWidth", label: "Active profile width", defaultValue: 120, min: 80, max: 260, step: 2 },
    { key: "lowerPaneHeight", label: "Lower pane height", defaultValue: 160, min: 80, max: 500, step: 5 },
    { key: "markerSize", label: "Marker size", defaultValue: 7, min: 4, max: 16, step: 1 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 72, min: 5, max: 100, step: 1 },
    { key: "historySeconds", label: "Visible history (seconds)", defaultValue: 3600, min: 30, max: 86400, step: 30 },
    { key: "maximumEvents", label: "Maximum retained events", defaultValue: 2500, min: 100, max: 50000, step: 100 },
  ],
  "pulling-stacking": [
    { key: "aggregationMs", label: "Aggregation bucket (ms)", defaultValue: 250, min: 25, max: 60000, step: 25 },
    { key: "rollingWindowMs", label: "Rolling pressure window (ms)", defaultValue: 10000, min: 500, max: 300000, step: 500 },
    { key: "eventMergeGapMs", label: "Event merge gap (ms)", defaultValue: 75, min: 0, max: 10000, step: 25 },
    { key: "postSnapshotWarmupMs", label: "Post-snapshot warm-up (ms)", defaultValue: 3000, min: 0, max: 60000, step: 250 },
    { key: "baselineWarmupMs", label: "Baseline warm-up (ms)", defaultValue: 20000, min: 0, max: 300000, step: 1000 },
    { key: "historySeconds", label: "Visible history (seconds)", defaultValue: 300, min: 30, max: 3600, step: 30 },
    { key: "baselineWindowMs", label: "Baseline window (ms)", defaultValue: 60000, min: 1000, max: 3600000, step: 1000 },
    { key: "baselineSampleLimit", label: "Baseline sample limit", defaultValue: 4000, min: 30, max: 50000, step: 100 },
    { key: "minimumBaselineSamples", label: "Minimum baseline samples", defaultValue: 30, min: 1, max: 10000, step: 1 },
    { key: "minimumContracts", label: "Absolute minimum contracts", defaultValue: 25, min: 1, max: 1000000, step: 1 },
    { key: "relativeThreshold", label: "Median multiplier", defaultValue: 3, min: 0.1, max: 100, step: 0.1 },
    { key: "selectedPercentile", label: "Selected percentile", defaultValue: 0.9, min: 0.5, max: 0.99, step: 0.01 },
    { key: "scoreThreshold", label: "Minimum event score", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "markerMinimumScore", label: "Marker minimum score", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "visibleTicks", label: "Visible ticks around price", defaultValue: 120, min: 10, max: 2000, step: 10 },
    { key: "profileWidthPercent", label: "Current profile width (%)", defaultValue: 13, min: 4, max: 40, step: 1 },
    { key: "minimumProfileWidthPx", label: "Minimum profile width (px)", defaultValue: 110, min: 40, max: 600, step: 5 },
    { key: "maximumProfileWidthPx", label: "Maximum profile width (px)", defaultValue: 280, min: 80, max: 1200, step: 5 },
    { key: "latestWindowMs", label: "Latest activity window (ms)", defaultValue: 1000, min: 25, max: 60000, step: 25 },
    { key: "lowerPaneHeight", label: "Lower pane height", defaultValue: 160, min: 80, max: 500, step: 5 },
    { key: "markerSize", label: "Marker size", defaultValue: 7, min: 4, max: 16, step: 1 },
    { key: "maximumEvents", label: "Maximum retained events", defaultValue: 1000, min: 100, max: 50000, step: 100 },
    { key: "maximumBuckets", label: "Maximum retained buckets", defaultValue: 4000, min: 100, max: 50000, step: 100 },
    { key: "staleAfterMs", label: "Stale feed threshold (ms)", defaultValue: 5000, min: 500, max: 120000, step: 500 },
    { key: "markerRetentionMs", label: "Marker retention (ms)", defaultValue: 300000, min: 1000, max: 3600000, step: 1000 },
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 42, min: 5, max: 100, step: 1 },
    { key: "minimumOpacity", label: "Minimum cell opacity", defaultValue: 0.025, min: 0, max: 1, step: 0.005 },
    { key: "maximumOpacity", label: "Maximum cell opacity", defaultValue: 0.42, min: 0.01, max: 1, step: 0.01 },
    { key: "minimumCellHeightPx", label: "Minimum cell height (px)", defaultValue: 2, min: 1, max: 24, step: 1 },
    { key: "maximumCellHeightPx", label: "Maximum cell height (px)", defaultValue: 24, min: 2, max: 48, step: 1 },
    { key: "wallMinimumContracts", label: "Wall minimum contracts", defaultValue: 150, min: 1, max: 1000000, step: 1 },
    { key: "wallMinimumLevels", label: "Wall minimum levels", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "wallMaximumGapTicks", label: "Wall maximum gap (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "wallBuildWindowMs", label: "Wall build window (ms)", defaultValue: 500, min: 25, max: 60000, step: 25 },
    { key: "wallMinimumRelativeMultiplier", label: "Wall relative multiplier", defaultValue: 3, min: 0.1, max: 100, step: 0.1 },
    { key: "wallMinimumScore", label: "Wall minimum score", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "wallPersistenceMs", label: "Wall persistence (ms)", defaultValue: 250, min: 0, max: 60000, step: 25 },
    { key: "collapseWindowMs", label: "Collapse window (ms)", defaultValue: 1500, min: 25, max: 60000, step: 25 },
    { key: "collapseMinimumPulledContracts", label: "Collapse minimum pulled", defaultValue: 100, min: 1, max: 1000000, step: 1 },
    { key: "collapseMinimumRatio", label: "Collapse removal ratio", defaultValue: 0.6, min: 0, max: 1, step: 0.05 },
    { key: "collapseMaximumExecutedRatio", label: "Collapse maximum execution ratio", defaultValue: 0.25, min: 0, max: 1, step: 0.05 },
    { key: "vacuumMinimumLevels", label: "Vacuum minimum levels", defaultValue: 3, min: 1, max: 100, step: 1 },
    { key: "vacuumMinimumContracts", label: "Vacuum minimum contracts", defaultValue: 200, min: 1, max: 1000000, step: 1 },
    { key: "vacuumMaximumGapTicks", label: "Vacuum maximum gap (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "vacuumWindowMs", label: "Vacuum window (ms)", defaultValue: 300, min: 25, max: 60000, step: 25 },
    { key: "vacuumMinimumDepthRemovalRatio", label: "Vacuum depth-removal ratio", defaultValue: 0.5, min: 0, max: 1, step: 0.05 },
    { key: "vacuumMinimumScore", label: "Vacuum minimum score", defaultValue: 70, min: 0, max: 100, step: 1 },
    { key: "repostWindowMs", label: "Pull/repost window (ms)", defaultValue: 1000, min: 25, max: 60000, step: 25 },
    { key: "repostPriceToleranceTicks", label: "Repost price tolerance (ticks)", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "repostSizeTolerance", label: "Repost size tolerance", defaultValue: 0.3, min: 0, max: 1, step: 0.05 },
    { key: "repostMinimumQuantity", label: "Repost minimum quantity", defaultValue: 50, min: 1, max: 1000000, step: 1 },
    { key: "repostMinimumScore", label: "Repost minimum score", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "alertCooldownMs", label: "Alert cooldown (ms)", defaultValue: 5000, min: 0, max: 3600000, step: 1000 },
  ],
  "implied-volatility-rank": [
    { key: "lookBackPeriodDays", label: "Lookback sessions", defaultValue: 252, min: 2, max: 365, step: 1 },
    { key: "targetMaturityDays", label: "Target maturity (days)", defaultValue: 30, min: 1, max: 365, step: 1 },
    { key: "refreshSeconds", label: "Refresh interval (seconds)", defaultValue: 15, min: 5, max: 300, step: 5 },
    { key: "staleAfterSeconds", label: "Stale after (seconds)", defaultValue: 90, min: 15, max: 900, step: 15 },
    { key: "maximumForwardFillMinutes", label: "Maximum live IV age (minutes)", defaultValue: 5, min: 1, max: 60, step: 1 },
    { key: "paneHeight", label: "Pane height", defaultValue: 220, min: 120, max: 520, step: 1 },
    { key: "lineWidth", label: "IV Rank line width", defaultValue: 2, min: 1, max: 5, step: 0.25 },
    { key: "priceLineWidth", label: "Price line width", defaultValue: 1.5, min: 0.5, max: 4, step: 0.25 },
    { key: "decimalPrecision", label: "Decimal precision", defaultValue: 2, min: 0, max: 4, step: 1 },
    { key: "lowThreshold", label: "Low / normal boundary", defaultValue: 20, min: 0, max: 98, step: 1 },
    { key: "middleThreshold", label: "Normal / elevated boundary", defaultValue: 50, min: 1, max: 99, step: 1 },
    { key: "highThreshold", label: "Elevated / extreme boundary", defaultValue: 80, min: 2, max: 100, step: 1 },
  ],
  "dark-pool-map": [
    { key: "historyDays", label: "History (equity sessions)", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "pollSeconds", label: "Live poll (seconds)", defaultValue: 2, min: 1, max: 30, step: 1 },
    { key: "minimumPrintNotional", label: "Minimum print notional", defaultValue: 100000, min: 0, max: 10000000, step: 50000 },
    { key: "maximumPrintNotional", label: "Maximum print notional · 0 unlimited", defaultValue: 0, min: 0, max: 100000000, step: 100000 },
    { key: "minimumPrintShares", label: "Minimum print shares", defaultValue: 0, min: 0, max: 1000000, step: 100 },
    { key: "maximumPrintShares", label: "Maximum print shares · 0 unlimited", defaultValue: 0, min: 0, max: 10000000, step: 100 },
    { key: "minimumLevelNotional", label: "Minimum level notional", defaultValue: 5000000, min: 0, max: 250000000, step: 1000000 },
    { key: "minimumLevelShares", label: "Minimum level shares", defaultValue: 0, min: 0, max: 10000000, step: 100 },
    { key: "minimumTradeCount", label: "Minimum prints per level", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "topLevels", label: "Top levels", defaultValue: 50, min: 1, max: 200, step: 1 },
    { key: "minimumStrengthScore", label: "Minimum strength score", defaultValue: 30, min: 0, max: 100, step: 1 },
    { key: "mappedBinPoints", label: "Mapped bin (points)", defaultValue: 2, min: 0.25, max: 50, step: 0.25 },
    { key: "sourceBinCents", label: "Source bin (cents)", defaultValue: 5, min: 1, max: 500, step: 1 },
    { key: "displayTickMultiple", label: "Display tick multiple", defaultValue: 4, min: 1, max: 100, step: 1 },
    { key: "mergeTolerancePoints", label: "Zone merge tolerance", defaultValue: 3, min: 0, max: 50, step: 0.25 },
    { key: "maximumZoneWidthPoints", label: "Maximum zone width", defaultValue: 20, min: 0.25, max: 200, step: 0.25 },
    { key: "recencyHalfLifeHours", label: "Recency half-life (hours)", defaultValue: 24, min: 0.25, max: 240, step: 0.25 },
    { key: "sessionsForFullPersistenceScore", label: "Sessions for full persistence", defaultValue: 5, min: 1, max: 20, step: 1 },
    { key: "maximumHistoricalPrints", label: "Maximum retained prints", defaultValue: 100000, min: 1000, max: 100000, step: 1000 },
    { key: "maximumVisibleCircles", label: "Maximum visible circles", defaultValue: 2000, min: 50, max: 5000, step: 50 },
    { key: "maximumVisibleZones", label: "Maximum visible zones", defaultValue: 100, min: 1, max: 200, step: 1 },
    { key: "minimumRadius", label: "Minimum circle radius", defaultValue: 3, min: 1, max: 12, step: 0.5 },
    { key: "maximumRadius", label: "Maximum circle radius", defaultValue: 18, min: 4, max: 40, step: 0.5 },
    { key: "opacity", label: "Circle opacity (%)", defaultValue: 58, min: 5, max: 100, step: 1 },
    { key: "zoneOpacity", label: "Zone opacity (%)", defaultValue: 16, min: 0, max: 80, step: 1 },
    { key: "manualAlpha", label: "Manual mapping alpha", defaultValue: 0, min: -100000, max: 100000, step: 0.01 },
    { key: "manualBeta", label: "Manual mapping beta", defaultValue: 1, min: 0.01, max: 1000, step: 0.01 },
    { key: "minimumMappingR2", label: "Minimum mapping R²", defaultValue: 0.95, min: 0, max: 1, step: 0.01 },
    { key: "mappingWindowMinutes", label: "Mapping window (minutes)", defaultValue: 60, min: 5, max: 240, step: 5 },
    { key: "minimumMappingSamples", label: "Minimum mapping samples", defaultValue: 120, min: 2, max: 1000, step: 1 },
    { key: "staleAllowanceSeconds", label: "Mapping stale allowance", defaultValue: 30, min: 5, max: 300, step: 5 },
    { key: "alertPrintNotional", label: "Alert · print notional", defaultValue: 5000000, min: 0, max: 250000000, step: 1000000 },
    { key: "alertLevelNotional", label: "Alert · level notional", defaultValue: 25000000, min: 0, max: 1000000000, step: 1000000 },
    { key: "alertScore", label: "Alert · score threshold", defaultValue: 80, min: 0, max: 100, step: 1 },
    { key: "alertDistancePoints", label: "Alert · price distance", defaultValue: 5, min: 0.25, max: 100, step: 0.25 },
    { key: "alertCooldownSeconds", label: "Alert cooldown (seconds)", defaultValue: 60, min: 5, max: 3600, step: 5 },
  ],
  "dark-pool-gex": [
    { key: "lookbackDays", label: "Lookback", defaultValue: 30, min: 1, max: 365, step: 1 },
    { key: "topN", label: "Raw Top-N prints", defaultValue: 5, min: 1, max: 100, step: 1 },
    { key: "minimumNotional", label: "Minimum print notional", defaultValue: 1000000, min: 0, max: 10000000000, step: 100000 },
    { key: "maximumNotional", label: "Maximum print notional · 0 unlimited", defaultValue: 0, min: 0, max: 10000000000, step: 100000 },
    { key: "minimumShares", label: "Minimum shares", defaultValue: 0, min: 0, max: 100000000, step: 100 },
    { key: "maximumShares", label: "Maximum shares · 0 unlimited", defaultValue: 0, min: 0, max: 100000000, step: 100 },
    { key: "minimumSharePrice", label: "Minimum share price", defaultValue: 0, min: 0, max: 100000, step: 0.01 },
    { key: "maximumSharePrice", label: "Maximum share price · 0 unlimited", defaultValue: 0, min: 0, max: 100000, step: 0.01 },
    { key: "tolerance", label: "GEX confluence tolerance", defaultValue: 0.15, min: 0.01, max: 100, step: 0.01 },
    { key: "interactionTolerance", label: "Touch distance", defaultValue: 0.03, min: 0, max: 100, step: 0.01 },
    { key: "resetDistance", label: "Reset / departure distance", defaultValue: 0.1, min: 0, max: 100, step: 0.01 },
    { key: "minimumTimeOutsideMs", label: "Minimum time outside (ms)", defaultValue: 0, min: 0, max: 3600000, step: 1000 },
    { key: "reactionThreshold", label: "Hold reaction threshold", defaultValue: 0.1, min: 0, max: 100, step: 0.01 },
    { key: "maximumConfirmationBars", label: "Maximum confirmation bars", defaultValue: 20, min: 1, max: 500, step: 1 },
    { key: "minimumReactionDurationMs", label: "Minimum reaction duration (ms)", defaultValue: 0, min: 0, max: 3600000, step: 1000 },
    { key: "breakDistance", label: "Confirmed break distance", defaultValue: 2, min: 0, max: 500, step: 0.01 },
    { key: "breakTimeBeyondMs", label: "Break time beyond level (ms)", defaultValue: 60000, min: 1000, max: 3600000, step: 1000 },
    { key: "volumeThreshold", label: "Break volume threshold", defaultValue: 0, min: 0, max: 1000000000, step: 1000 },
    { key: "reclaimConfirmationCloses", label: "Reclaim confirmation closes", defaultValue: 1, min: 1, max: 10, step: 1 },
    { key: "minimumTimeBeyondBeforeReclaimMs", label: "Minimum time beyond before reclaim (ms)", defaultValue: 0, min: 0, max: 3600000, step: 1000 },
    { key: "reactionHorizonBars", label: "Post-touch horizon (bars)", defaultValue: 20, min: 1, max: 1000, step: 1 },
    { key: "reactionHorizonMs", label: "Post-touch horizon (ms)", defaultValue: 1800000, min: 1000, max: 86400000, step: 1000 },
    { key: "minimumResearchSamples", label: "Minimum research touches", defaultValue: 3, min: 1, max: 1000, step: 1 },
    { key: "minimumStatsSamples", label: "Minimum samples for rates", defaultValue: 3, min: 1, max: 1000, step: 1 },
    { key: "activationRadiusPercent", label: "Live activation radius (%)", defaultValue: 2, min: 0.1, max: 25, step: 0.1 },
    { key: "qualityPrecisionWeight", label: "Quality · touch precision weight", defaultValue: 20, min: 0, max: 100, step: 1 },
    { key: "qualityExcursionWeight", label: "Quality · excursion weight", defaultValue: 25, min: 0, max: 100, step: 1 },
    { key: "qualityEfficiencyWeight", label: "Quality · MFE/MAE weight", defaultValue: 20, min: 0, max: 100, step: 1 },
    { key: "qualitySpeedWeight", label: "Quality · speed weight", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "qualityFreshnessWeight", label: "Quality · freshness weight", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "qualityGexWeight", label: "Quality · GEX weight", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "clusterDistance", label: "Cluster distance", defaultValue: 0.12, min: 0.01, max: 100, step: 0.01 },
    { key: "minimumClusterPrints", label: "Minimum prints per cluster", defaultValue: 2, min: 2, max: 50, step: 1 },
    { key: "minimumClusterNotional", label: "Minimum cluster notional", defaultValue: 5000000, min: 0, max: 10000000000, step: 100000 },
    { key: "bandThickness", label: "Dotted line thickness", defaultValue: 2, min: 1, max: 3, step: 0.25 },
    { key: "bandOpacity", label: "Active line brightness (%)", defaultValue: 90, min: 55, max: 100, step: 1 },
    { key: "originMarkerSize", label: "Origin marker size", defaultValue: 7, min: 2, max: 24, step: 0.5 },
    { key: "haloIntensity", label: "Invalidated line brightness (%)", defaultValue: 18, min: 5, max: 45, step: 1 },
    { key: "kingBoost", label: "KING confluence boost (%)", defaultValue: 30, min: 0, max: 100, step: 1 },
    { key: "ageFadeHalfLifeDays", label: "Age fade half-life (days)", defaultValue: 30, min: 0.25, max: 365, step: 0.25 },
    { key: "proximityDistance", label: "Price proximity distance", defaultValue: 0.15, min: 0.01, max: 100, step: 0.01 },
    { key: "refreshSeconds", label: "Live refresh (seconds)", defaultValue: 5, min: 2, max: 60, step: 1 },
    { key: "alertPrintNotional", label: "Alert · new print notional", defaultValue: 5000000, min: 0, max: 10000000000, step: 100000 },
    { key: "alertConfluence", label: "Alert · confluence threshold (%)", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "alertCooldownSeconds", label: "Alert cooldown (seconds)", defaultValue: 60, min: 5, max: 3600, step: 5 },
  ],
  "gamma-heatmap": [
    { key: "historyHours", label: "History window (hours)", defaultValue: 24, min: 1, max: 120, step: 1 },
    { key: "binSize", label: "Display price bin", defaultValue: 5, min: 0.25, max: 100, step: 0.25 },
    { key: "opacity", label: "Heat opacity (%)", defaultValue: 68, min: 5, max: 100, step: 1 },
    { key: "intensity", label: "Heat intensity", defaultValue: 1, min: 0.25, max: 4, step: 0.05 },
    // The exposure surface gains a new historical column once a minute and the
    // payload is several megabytes. Re-downloading it every few seconds parsed
    // 30MB+/min of JSON per workspace, which was a primary browser OOM driver.
    { key: "refreshSeconds", label: "Refresh interval (seconds)", defaultValue: 30, min: 15, max: 120, step: 5 },
  ],
  "net-gamma-exposure-by-strike": [
    { key: "refreshSeconds", label: "Refresh interval (seconds)", defaultValue: 5, min: 2, max: 60, step: 1 },
    { key: "minimumDte", label: "Minimum DTE", defaultValue: 0, min: 0, max: 365, step: 1 },
    { key: "maximumDte", label: "Maximum DTE", defaultValue: 7, min: 0, max: 365, step: 1 },
    { key: "customBinSizePoints", label: "Custom mapped bin (points)", defaultValue: 1, min: 0.25, max: 100, step: 0.25 },
    { key: "minimumAbsoluteExposure", label: "Minimum absolute exposure", defaultValue: 0, min: 0, max: 100000000000, step: 1000000 },
    { key: "maximumDistanceFromSourceSpot", label: "Maximum distance from source spot · 0 = all", defaultValue: 0, min: 0, max: 10000, step: 1 },
    { key: "laneWidthPercent", label: "Profile lane width (%)", defaultValue: 24, min: 8, max: 60, step: 1 },
    { key: "minimumLaneWidthPx", label: "Minimum lane width (pixels)", defaultValue: 220, min: 80, max: 600, step: 5 },
    { key: "maximumLaneWidthPx", label: "Maximum lane width (pixels)", defaultValue: 420, min: 120, max: 900, step: 5 },
    { key: "floatingXPercent", label: "Floating lane X (%)", defaultValue: 72, min: 5, max: 95, step: 1 },
    { key: "zeroSpinePercent", label: "Zero spine position (%)", defaultValue: 50, min: 5, max: 95, step: 1 },
    { key: "fixedBarHeightPx", label: "Fixed bar height", defaultValue: 9, min: 3, max: 30, step: 1 },
    { key: "minimumBarHeightPx", label: "Minimum bar height", defaultValue: 3, min: 1, max: 20, step: 1 },
    { key: "maximumBarHeightPx", label: "Maximum bar height", defaultValue: 24, min: 4, max: 40, step: 1 },
    { key: "barGapPx", label: "Bar gap", defaultValue: 1, min: 0, max: 8, step: 1 },
    { key: "horizontalPaddingPx", label: "Lane padding", defaultValue: 8, min: 0, max: 40, step: 1 },
    { key: "scalePercentile", label: "Visible scale percentile", defaultValue: 98, min: 50, max: 100, step: 1 },
    { key: "fixedMaximum", label: "Fixed maximum · 0 = automatic", defaultValue: 0, min: 0, max: 100000000000, step: 1000000 },
    { key: "logarithmicStrength", label: "Logarithmic strength", defaultValue: 9, min: 1, max: 30, step: 1 },
    { key: "maximumDisplayedRows", label: "Maximum displayed rows", defaultValue: 80, min: 5, max: 250, step: 5 },
    { key: "minimumPercentageOfTotal", label: "Minimum total contribution (%)", defaultValue: 0.1, min: 0, max: 100, step: 0.05 },
    { key: "barOpacity", label: "Bar opacity (%)", defaultValue: 52, min: 5, max: 100, step: 1 },
    { key: "borderOpacity", label: "Border opacity (%)", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "borderWidth", label: "Border width", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "gradientStrength", label: "Gradient strength (%)", defaultValue: 25, min: 0, max: 100, step: 1 },
    { key: "minimumMappingConfidence", label: "Minimum mapping confidence", defaultValue: 70, min: 0, max: 100, step: 1 },
  ],
  "gex-interval-map": [
    { key: "refreshSeconds", label: "Refresh interval (seconds)", defaultValue: 5, min: 2, max: 60, step: 1 },
    { key: "rollingBuckets", label: "Difference rolling buckets", defaultValue: 5, min: 2, max: 60, step: 1 },
    { key: "minimumDte", label: "Minimum DTE", defaultValue: 0, min: 0, max: 365, step: 1 },
    { key: "maximumDte", label: "Maximum DTE", defaultValue: 7, min: 0, max: 365, step: 1 },
    { key: "customBinSizePoints", label: "Custom mapped bin (points)", defaultValue: 1, min: 0.25, max: 100, step: 0.25 },
    { key: "minimumAbsoluteExposure", label: "Minimum absolute exposure", defaultValue: 0, min: 0, max: 100000000000, step: 1000000 },
    { key: "maximumDistancePoints", label: "Maximum distance from price · 0 = all", defaultValue: 0, min: 0, max: 10000, step: 1 },
    { key: "maximumPoints", label: "Maximum retained map points", defaultValue: 40000, min: 500, max: 75000, step: 500 },
    { key: "maximumStrikesPerBucket", label: "Visible strikes per interval · 0 = all", defaultValue: 80, min: 0, max: 500, step: 5 },
    { key: "opacity", label: "Map opacity (%)", defaultValue: 68, min: 5, max: 100, step: 1 },
    { key: "intensity", label: "Intensity", defaultValue: 1, min: 0.25, max: 4, step: 0.05 },
    { key: "minimumRadius", label: "Minimum bubble radius", defaultValue: 3, min: 1, max: 12, step: 0.5 },
    { key: "maximumRadius", label: "Maximum bubble radius", defaultValue: 18, min: 3, max: 40, step: 0.5 },
    { key: "bubbleStrokeWidth", label: "Bubble outline width", defaultValue: 1.25, min: 0.5, max: 4, step: 0.25 },
    { key: "bubbleFillStrength", label: "Bubble fill strength (%)", defaultValue: 12, min: 0, max: 100, step: 1 },
    { key: "trackWidth", label: "Max GEX track width", defaultValue: 1.5, min: 0.5, max: 5, step: 0.25 },
    { key: "cellWidth", label: "Heat cell width", defaultValue: 10, min: 2, max: 40, step: 1 },
    { key: "fixedDotRadius", label: "Fixed-dot radius", defaultValue: 3, min: 1, max: 20, step: 0.5 },
    { key: "minimumOpacity", label: "Minimum opacity (%)", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "maximumOpacity", label: "Maximum opacity (%)", defaultValue: 72, min: 1, max: 100, step: 1 },
    { key: "scalePercentile", label: "Scale percentile (%)", defaultValue: 98, min: 50, max: 100, step: 0.5 },
    { key: "fixedMaximum", label: "Fixed scale maximum", defaultValue: 1000000000, min: 1, max: 1000000000000, step: 1000000 },
    { key: "logStrength", label: "Logarithmic strength", defaultValue: 9, min: 1, max: 100, step: 1 },
    { key: "currentBucketScaleMultiplier", label: "Current bucket size (%)", defaultValue: 115, min: 50, max: 200, step: 1 },
    { key: "currentBucketOpacityMultiplier", label: "Current bucket opacity (%)", defaultValue: 115, min: 50, max: 200, step: 1 },
    { key: "mergeTolerancePoints", label: "Coincident level tolerance", defaultValue: 1, min: 0, max: 100, step: 0.25 },
    { key: "alertExposureThreshold", label: "Alert exposure threshold", defaultValue: 50000000, min: 0, max: 100000000000, step: 1000000 },
    { key: "alertDistancePoints", label: "Level approach distance", defaultValue: 5, min: 0.25, max: 500, step: 0.25 },
    { key: "alertCooldownSeconds", label: "Alert cooldown (seconds)", defaultValue: 60, min: 5, max: 3600, step: 5 },
  ],
  "bounce-levels": [
    { key: "minimumDte", label: "Minimum DTE", defaultValue: 0, min: 0, max: 365, step: 1 },
    { key: "maximumDte", label: "Maximum DTE", defaultValue: 7, min: 0, max: 365, step: 1 },
    { key: "maximumLevels", label: "Maximum active levels", defaultValue: 8, min: 1, max: 24, step: 1 },
    { key: "topExposurePercent", label: "Strongest exposure shown (%)", defaultValue: 10, min: 1, max: 100, step: 1 },
    { key: "minimumPercentOfKing", label: "Minimum KING magnitude (%)", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "minimumRelevanceScore", label: "Minimum relevance score", defaultValue: 55, min: 0, max: 100, step: 1 },
    { key: "maximumDistancePoints", label: "Maximum distance from price · 0 = all", defaultValue: 0, min: 0, max: 10000, step: 1 },
    { key: "clusterDistancePoints", label: "Cluster distance (points)", defaultValue: 25, min: 0.25, max: 500, step: 0.25 },
    { key: "airPocketRatio", label: "Air-pocket maximum density (%)", defaultValue: 20, min: 0, max: 100, step: 1 },
    { key: "maximumNodesPerSlice", label: "Maximum nodes per time slice", defaultValue: 24, min: 4, max: 64, step: 1 },
    { key: "activeEnterThreshold", label: "Node activation · % of King", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "activeExitThreshold", label: "Node retention · % of King", defaultValue: 8, min: 0, max: 100, step: 1 },
    { key: "retirementConfirmationSnapshots", label: "Retirement confirmation snapshots", defaultValue: 3, min: 1, max: 20, step: 1 },
    { key: "absoluteExposureScale", label: "Absolute exposure visual scale", defaultValue: 1000000000, min: 1000000, max: 1000000000000, step: 1000000 },
    { key: "rollWeakeningThreshold", label: "Roll weakening threshold (%)", defaultValue: 40, min: 1, max: 500, step: 1 },
    { key: "rollBuildingThreshold", label: "Roll building threshold (%)", defaultValue: 40, min: 1, max: 500, step: 1 },
    { key: "maxRollDistance", label: "Maximum roll distance (strikes)", defaultValue: 5, min: 0.25, max: 100, step: 0.25 },
    { key: "rollWindowSeconds", label: "Roll detection window (seconds)", defaultValue: 120, min: 5, max: 3600, step: 5 },
    { key: "maximumGatekeepers", label: "Maximum Gatekeepers", defaultValue: 2, min: 0, max: 8, step: 1 },
    { key: "maximumMajorNodes", label: "Maximum Major Nodes", defaultValue: 4, min: 0, max: 16, step: 1 },
    { key: "minimumGatekeeperRelevance", label: "Minimum Gatekeeper relevance", defaultValue: 60, min: 0, max: 100, step: 1 },
    { key: "minimumGatekeeperPercentOfKing", label: "Minimum Gatekeeper KING magnitude (%)", defaultValue: 20, min: 0, max: 100, step: 1 },
    { key: "minimumClusterNodes", label: "Minimum cluster nodes", defaultValue: 2, min: 2, max: 10, step: 1 },
    { key: "minimumAirPocketWidthPercent", label: "Minimum Air Pocket width (%)", defaultValue: 0.3, min: 0.01, max: 10, step: 0.01 },
    { key: "magnitudeWeight", label: "Magnitude weight (%)", defaultValue: 45, min: 0, max: 100, step: 1 },
    { key: "proximityWeight", label: "Proximity weight (%)", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "accumulationWeight", label: "Accumulation weight (%)", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "persistenceWeight", label: "Persistence weight (%)", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "freshnessWeight", label: "Freshness weight (%)", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "clusterWeight", label: "Cluster weight (%)", defaultValue: 5, min: 0, max: 100, step: 1 },
    { key: "proximityDecayPercent", label: "Proximity decay (%)", defaultValue: 3, min: 0.01, max: 25, step: 0.01 },
    { key: "developingMinimumPercentile", label: "Developing exposure percentile (%)", defaultValue: 75, min: 0, max: 100, step: 1 },
    { key: "developingMinimumGrowthPercent", label: "Developing growth (%)", defaultValue: 10, min: 0, max: 500, step: 1 },
    { key: "weakeningThresholdPercent", label: "Weakening threshold (%)", defaultValue: -10, min: -500, max: 0, step: 1 },
    { key: "weakeningRelevanceThreshold", label: "Weakening relevance", defaultValue: 45, min: 0, max: 100, step: 1 },
    { key: "retirementRelevanceThreshold", label: "Retirement relevance", defaultValue: 30, min: 0, max: 100, step: 1 },
    { key: "retirementExposurePercentile", label: "Retirement exposure percentile (%)", defaultValue: 65, min: 0, max: 100, step: 1 },
    { key: "touchTolerancePercent", label: "Touch tolerance (%)", defaultValue: 0.05, min: 0.001, max: 2, step: 0.001 },
    { key: "touchDecayFactor", label: "Touch freshness retention (%)", defaultValue: 85, min: 0, max: 100, step: 1 },
    { key: "minimumNodeThickness", label: "Minimum exposure thickness", defaultValue: 2, min: 0.5, max: 12, step: 0.5 },
    { key: "maximumNodeThickness", label: "Maximum exposure thickness", defaultValue: 18, min: 4, max: 48, step: 1 },
    { key: "lineOpacity", label: "Exposure field opacity (%)", defaultValue: 78, min: 5, max: 100, step: 1 },
    { key: "minimumNodeOpacity", label: "Minimum exposure opacity (%)", defaultValue: 8, min: 0, max: 60, step: 1 },
    { key: "exposureIntensity", label: "Exposure intensity", defaultValue: 1, min: 0.25, max: 4, step: 0.05 },
    { key: "glowStrength", label: "Glow strength", defaultValue: 5, min: 0, max: 20, step: 1 },
    { key: "alertDistancePoints", label: "Approach alert distance", defaultValue: 5, min: 0.25, max: 500, step: 0.25 },
    { key: "alertMinimumRelevance", label: "Alert minimum relevance", defaultValue: 55, min: 0, max: 100, step: 1 },
    { key: "alertMinimumPercentOfKing", label: "Alert minimum KING magnitude (%)", defaultValue: 15, min: 0, max: 100, step: 1 },
    { key: "alertMinimumExposure", label: "Alert minimum absolute exposure", defaultValue: 0, min: 0, max: 1000000000000, step: 1000000 },
    { key: "alertMinimumRoc", label: "Alert minimum absolute ROC (%)", defaultValue: 0, min: 0, max: 1000, step: 1 },
    { key: "alertCooldownSeconds", label: "Alert cooldown (seconds)", defaultValue: 60, min: 5, max: 3600, step: 5 },
  ],
  "divergence-detector": [
    { key: "pivotStrength", label: "Pivot confirmation bars", defaultValue: 3, min: 1, max: 12, step: 1 },
    { key: "synchronizationBars", label: "ES / NQ synchronization window (bars)", defaultValue: 3, min: 1, max: 12, step: 1 },
    { key: "minimumSwingBars", label: "Minimum bars between pivots", defaultValue: 3, min: 1, max: 100, step: 1 },
    { key: "maximumLookbackBars", label: "Historical lookback bars", defaultValue: 1200, min: 100, max: 5000, step: 100 },
    { key: "minimumMoveTicks", label: "Minimum structural break (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "maximumSignals", label: "Maximum visible divergences", defaultValue: 24, min: 1, max: 100, step: 1 },
    { key: "lineWidth", label: "Divergence line width", defaultValue: 2, min: 1, max: 5, step: 0.5 },
    { key: "opacity", label: "Line opacity (%)", defaultValue: 92, min: 10, max: 100, step: 1 },
    { key: "labelFontSize", label: "Label font size", defaultValue: 10, min: 8, max: 16, step: 1 },
  ],
  "delta-highlight": [
    { key: "minValue", label: "Minimum absolute delta (%)", defaultValue: 50, min: 0, max: 100, step: 1 },
    { key: "maxValue", label: "Maximum absolute delta (%) · 0 = unlimited", defaultValue: 0, min: 0, max: 100, step: 1 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 82, min: 5, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
  ],
  "imbalance-tracker": [
    { key: "minimumPercent", label: "Minimum imbalance (%)", defaultValue: 300, min: 0, max: 10000, step: 25 },
    { key: "minimumDelta", label: "Minimum delta value", defaultValue: 10, min: 0, max: 1000000, step: 1 },
    { key: "minimumConsecutive", label: "Minimum consecutive levels", defaultValue: 3, min: 1, max: 50, step: 1 },
    { key: "extendedBars", label: "Extended bars", defaultValue: 40, min: 1, max: 5000, step: 1 },
    { key: "lineWidth", label: "Zone line width", defaultValue: 1.5, min: 0.5, max: 5, step: 0.5 },
    { key: "opacity", label: "Zone opacity (%)", defaultValue: 78, min: 5, max: 100, step: 1 },
  ],
  "imbalance-rejector": [
    { key: "minimumPercent", label: "Minimum imbalance (%)", defaultValue: 300, min: 100, max: 10000, step: 25 },
    { key: "comparisonDepth", label: "Diagonal comparison depth", defaultValue: 1, min: 1, max: 50, step: 1 },
    { key: "lookbackPeriod", label: "Swing lookback bars", defaultValue: 5, min: 1, max: 500, step: 1 },
    { key: "tickOffset", label: "Marker offset (ticks)", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 8, min: 3, max: 24, step: 1 },
    { key: "markerThickness", label: "Marker thickness", defaultValue: 2, min: 0.5, max: 6, step: 0.5 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 90, min: 10, max: 100, step: 1 },
  ],
  "delta-cumulative-candlestick": [
    { key: "filterMinVolume", label: "Minimum input value", defaultValue: 0, min: 0, max: 10000000 },
    { key: "filterMaxVolume", label: "Maximum input value · 0 = unlimited", defaultValue: 0, min: 0, max: 10000000 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
    { key: "lineWidth", label: "Candlestick width", defaultValue: 2, min: 1, max: 4 },
    { key: "averageLength", label: "Average length", defaultValue: 20, min: 1, max: 1000 },
    { key: "averageLineWidth", label: "Average width", defaultValue: 2, min: 1, max: 4 },
    { key: "averageDeviation", label: "Average deviation multiplier", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "zeroLineWidth", label: "Zero-line width", defaultValue: 1, min: 1, max: 4 },
  ],
  "delta-cumulative-histogram": [
    { key: "filterMinVolume", label: "Minimum input value", defaultValue: 0, min: 0, max: 10000000 },
    { key: "filterMaxVolume", label: "Maximum input value · 0 = unlimited", defaultValue: 0, min: 0, max: 10000000 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
    { key: "lineWidth", label: "Bars / line width", defaultValue: 2, min: 1, max: 4 },
    { key: "zeroLineWidth", label: "Zero-line width", defaultValue: 1, min: 1, max: 4 },
  ],
  "depth-of-market": [
    { key: "width", label: "Dock width (pixels)", defaultValue: 640, min: 240, max: 1100 },
    { key: "rows", label: "Maximum visible price rows", defaultValue: DEFAULT_DOM_PRO_VISIBLE_ROWS, min: 10, max: 120, step: 1 },
    { key: "rowHeight", label: "Price row height", defaultValue: 24, min: 16, max: 42, step: 1 },
    { key: "refreshRateMs", label: "Display refresh rate (milliseconds)", defaultValue: 32, min: 16, max: 1000, step: 1 },
    { key: "recentWindowMs", label: "Recent traded volume retention (milliseconds)", defaultValue: 8000, min: 250, max: 60000, step: 250 },
    { key: "depthScaleCap", label: "Depth histogram cap · 0 = automatic", defaultValue: 0, min: 0, max: 100000, step: 10 },
    { key: "highlightThreshold", label: "High-liquidity threshold · 0 = automatic", defaultValue: 0, min: 0, max: 100000, step: 10 },
    { key: "fontSize", label: "Ladder font size", defaultValue: 9, min: 7, max: 13, step: 1 },
  ],
  "deep-print-footprint": [
    { key: "barWidth", label: "Footprint bar width (pixels)", defaultValue: 92, min: 28, max: 180, step: 2 },
    { key: "candleSpacing", label: "Candle spacing (pixels)", defaultValue: 6, min: 1, max: 24, step: 1 },
    { key: "autoGroupFactor", label: "Automatic tick grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "manualTicks", label: "Manual ticks per row", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "minimumTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000, step: 1 },
    { key: "maximumTradeVolume", label: "Maximum execution size · 0 = unlimited", defaultValue: 0, min: 0, max: 1000000, step: 1 },
    { key: "minimumImbalancePercent", label: "Minimum imbalance (%)", defaultValue: 300, min: 100, max: 10000, step: 25 },
    { key: "minimumDominantVolume", label: "Minimum dominant volume", defaultValue: 10, min: 0, max: 100000, step: 1 },
    { key: "minimumDelta", label: "Minimum volume difference", defaultValue: 0, min: 0, max: 100000, step: 1 },
    { key: "stackedImbalanceLevels", label: "Stacked imbalance rows", defaultValue: 3, min: 2, max: 10, step: 1 },
    { key: "unfinishedAuctionMinimumVolume", label: "Unfinished auction minimum", defaultValue: 1, min: 0, max: 100000, step: 1 },
    { key: "valueAreaPercent", label: "Value area (decimal)", defaultValue: 0.7, min: 0.5, max: 1, step: 0.01 },
    { key: "backgroundOpacity", label: "Fixed background opacity (%)", defaultValue: 72, min: 0, max: 100, step: 1 },
    { key: "minimumOpacity", label: "Minimum heat opacity (%)", defaultValue: 8, min: 0, max: 100, step: 1 },
    { key: "maximumOpacity", label: "Maximum heat opacity (%)", defaultValue: 72, min: 0, max: 100, step: 1 },
    { key: "gradientExponent", label: "Heat gradient exponent", defaultValue: 0.72, min: 0.1, max: 3, step: 0.01 },
    { key: "visibleRegionPercentile", label: "Visible scale percentile", defaultValue: 0.95, min: 0.5, max: 1, step: 0.01 },
    { key: "fixedMaximum", label: "Fixed scale maximum · 0 = automatic", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "borderWidth", label: "Cell and outline width", defaultValue: 1, min: 0.5, max: 4, step: 0.5 },
    { key: "fontSize", label: "Footprint text size", defaultValue: 11, min: 9, max: 15, step: 1 },
    { key: "fontWeight", label: "Footprint font weight", defaultValue: 500, min: 400, max: 800, step: 100 },
    { key: "minimumWidthToShowText", label: "Full Bid × Ask width", defaultValue: 32, min: 18, max: 180, step: 1 },
    { key: "minimumRowHeightToShowText", label: "Full Bid × Ask row height", defaultValue: 9, min: 7, max: 34, step: 1 },
    { key: "dynamicTextIncrease", label: "Dynamic text emphasis", defaultValue: 1, min: 0, max: 2, step: 0.1 },
    { key: "singlePrintMaximum", label: "Single-print maximum volume", defaultValue: 1, min: 1, max: 1000, step: 1 },
    { key: "minimumRatio", label: "Minimum displayed ask/bid ratio", defaultValue: 1.5, min: 0, max: 100, step: 0.1 },
    { key: "maximumRatio", label: "Maximum displayed ask/bid ratio", defaultValue: 100, min: 1, max: 1000, step: 1 },
    { key: "clusterMinimumVolume", label: "Volume-cluster minimum", defaultValue: 100, min: 1, max: 100000, step: 1 },
    { key: "maximumRetainedBars", label: "Maximum retained footprint bars", defaultValue: 5000, min: 100, max: 5000, step: 100 },
    { key: "maximumDetailedVisibleBars", label: "Maximum bars with cell text", defaultValue: 180, min: 20, max: 350, step: 10 },
  ],
  "deep-m-effort-nq": [
    { key: "zoneOpacity", label: "Zone opacity (%)", defaultValue: 20, min: 1, max: 100 },
    { key: "zoneLineWidth", label: "Zone border width", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "maLineWidth", label: "Moving average width", defaultValue: 2, min: 1, max: 4 },
  ],
  "big-trades": [
    { key: "daysToLoad", label: "Days to load", defaultValue: 1, min: 1, max: 90 },
    { key: "manualFilter", label: "Manual minimum trade size", defaultValue: 30, min: 1, max: 100, step: 1 },
    { key: "maximumFilter", label: "Maximum trade size · 0 = unlimited", defaultValue: 0, min: 0, max: 1000000 },
    { key: "clusterWindowMs", label: "Cluster window (milliseconds)", defaultValue: 100, min: 0, max: 10000 },
    { key: "clusterPriceTicks", label: "Cluster price distance (ticks)", defaultValue: 0, min: 0, max: 100 },
    { key: "maxMarkersPerBar", label: "Maximum markers per chart bar", defaultValue: 50, min: 1, max: 50 },
    { key: "standardDeviation", label: "Marker standard deviation scale", defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
    { key: "minimumOpacity", label: "Minimum opacity (%)", defaultValue: 25, min: 0, max: 100 },
    { key: "maximumOpacity", label: "Maximum opacity (%)", defaultValue: 90, min: 0, max: 100 },
    { key: "minimumSize", label: "Minimum marker size", defaultValue: 6, min: 1, max: 80 },
    { key: "maximumSize", label: "Maximum marker size", defaultValue: 32, min: 1, max: 160 },
    { key: "labelMinSize", label: "Show number from marker size", defaultValue: 14, min: 1, max: 160 },
  ],
  sessions: [
    { key: "lookbackDays", label: "Lookback (days)", defaultValue: 30, min: 1, max: 365 },
    { key: "fillOpacity", label: "Background opacity (%)", defaultValue: 10, min: 0, max: 100 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 65, min: 0, max: 100 },
    { key: "borderWidth", label: "Border width", defaultValue: 1, min: 0, max: 4, step: 1 },
  ],
  "session-highs-lows": [
    { key: "lookbackDays", label: "Session search lookback (days)", defaultValue: 30, min: 7, max: 365 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 82, min: 5, max: 100 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  ],
  "ib-levels": [
    { key: "lookbackDays", label: "Lookback (days)", defaultValue: 7, min: 1, max: 30 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 88, min: 5, max: 100 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  ],
  "kwant-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 72, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "tpo-chart": [
    { key: "lengthValue", label: "Generic period length", defaultValue: 1, min: 1, max: 1800000, step: 1 },
    { key: "subperiodMinutes", label: "TPO subperiod (minutes)", defaultValue: 30, min: 1, max: 1440, step: 1 },
    { key: "profileCount", label: "Profiles · 0 = all", defaultValue: 10, min: 0, max: 500, step: 1 },
    { key: "ticksPerRow", label: "Manual ticks per row", defaultValue: 1, min: 1, max: 600, step: 1 },
    { key: "autoTargetRows", label: "Automatic target rows", defaultValue: 90, min: 20, max: 400, step: 1 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.25, max: 8, step: 0.25 },
    { key: "valueAreaPercent", label: "Value Area (%)", defaultValue: 70, min: 1, max: 100, step: 1 },
    { key: "initialBalanceSubperiods", label: "Initial Balance subperiods", defaultValue: 2, min: 1, max: 48, step: 1 },
    { key: "initialBalanceStartSubperiod", label: "Initial Balance start subperiod", defaultValue: 0, min: 0, max: 48, step: 1 },
    { key: "initialBalanceLineWidth", label: "Initial Balance line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "minimumSinglePrintTicks", label: "Minimum Single Print ticks", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "singlePrintQuality", label: "Single Print quality (0 all - 100 best only)", defaultValue: 0, min: 0, max: 100, step: 5 },
    { key: "singlePrintVolumeSensitivity", label: "Single Print low-volume sensitivity (0 all - 100 lowest-volume only)", defaultValue: 0, min: 0, max: 100, step: 5 },
    { key: "blockSize", label: "Block size", defaultValue: 8, min: 2, max: 24, step: 0.5 },
    { key: "blockGap", label: "Block gap", defaultValue: 1, min: 0, max: 6, step: 0.25 },
    { key: "opacityPercent", label: "Profile opacity (%)", defaultValue: 72, min: 0, max: 100, step: 1 },
    { key: "borderWidth", label: "Block border width", defaultValue: 0.75, min: 0, max: 6, step: 0.25 },
    { key: "barMarkerWidth", label: "Subperiod OHLC marker width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "range1Minimum", label: "Colour range 1 minimum", defaultValue: 0, min: -1000000, max: 1000000, step: 1 },
    { key: "range2Minimum", label: "Colour range 2 minimum", defaultValue: 25, min: -1000000, max: 1000000, step: 1 },
    { key: "range3Minimum", label: "Colour range 3 minimum", defaultValue: 50, min: -1000000, max: 1000000, step: 1 },
    { key: "range4Minimum", label: "Colour range 4 minimum", defaultValue: 75, min: -1000000, max: 1000000, step: 1 },
    { key: "pocLineWidth", label: "POC line width", defaultValue: 1.5, min: 0.5, max: 6, step: 0.5 },
    { key: "developingPocStartOffset", label: "Developing POC start offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "shiftedPocTicks", label: "Shifted POC threshold (ticks)", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "pocGroupingOpacity", label: "POC grouping opacity (%)", defaultValue: 18, min: 0, max: 100, step: 1 },
    { key: "valueAreaBackgroundOpacity", label: "Value Area background opacity (%)", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "valueAreaLineWidth", label: "Value Area line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "singlePrintLineWidth", label: "Single Print line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "singlePrintFillOpacity", label: "Single Print fill opacity (%)", defaultValue: 9, min: 0, max: 100, step: 1 },
    { key: "summaryBackgroundOpacity", label: "Summary background opacity (%)", defaultValue: 86, min: 0, max: 100, step: 1 },
    { key: "summaryFontSize", label: "Summary font size", defaultValue: 8, min: 6, max: 16, step: 1 },
    { key: "currentWidth", label: "Current profile width", defaultValue: 100, min: 0, max: 500, step: 1 },
    { key: "currentOffset", label: "Current profile offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "previousWidth", label: "Previous profile width", defaultValue: 80, min: 0, max: 500, step: 1 },
    { key: "previousOffset", label: "Previous profile offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "peakValleyRadius", label: "Peak / Valley radius", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "peakMinimumProminence", label: "Peak / Valley prominence", defaultValue: 2, min: 0, max: 10000, step: 1 },
    { key: "maximumMergeMembers", label: "Maximum profiles per composite", defaultValue: 30, min: 2, max: 100, step: 1 },
    { key: "maximumRenderedBlocks", label: "Maximum rendered blocks", defaultValue: 50000, min: 1000, max: 250000, step: 1000 },
    { key: "fpsCap", label: "Render FPS cap", defaultValue: 60, min: 15, max: 144, step: 1 },
  ],
  "weekly-tpo": [
    { key: "lengthValue", label: "Generic period length", defaultValue: 1, min: 1, max: 1800000, step: 1 },
    { key: "subperiodMinutes", label: "TPO subperiod (minutes)", defaultValue: 30, min: 1, max: 1440, step: 1 },
    { key: "profileCount", label: "Weekly profiles · 0 = all", defaultValue: 8, min: 0, max: 100, step: 1 },
    { key: "ticksPerRow", label: "Manual ticks per row", defaultValue: 1, min: 1, max: 600, step: 1 },
    { key: "autoTargetRows", label: "Automatic target rows", defaultValue: 90, min: 20, max: 400, step: 1 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.25, max: 8, step: 0.25 },
    { key: "valueAreaPercent", label: "Value Area (%)", defaultValue: 70, min: 1, max: 100, step: 1 },
    { key: "initialBalanceSubperiods", label: "Initial Balance subperiods", defaultValue: 2, min: 1, max: 48, step: 1 },
    { key: "initialBalanceStartSubperiod", label: "Initial Balance start subperiod", defaultValue: 0, min: 0, max: 48, step: 1 },
    { key: "initialBalanceLineWidth", label: "Initial Balance line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "minimumSinglePrintTicks", label: "Minimum Single Print ticks", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "singlePrintQuality", label: "Single Print quality (0 all - 100 best only)", defaultValue: 0, min: 0, max: 100, step: 5 },
    { key: "singlePrintVolumeSensitivity", label: "Single Print low-volume sensitivity (0 all - 100 lowest-volume only)", defaultValue: 0, min: 0, max: 100, step: 5 },
    { key: "blockSize", label: "Block size", defaultValue: 8, min: 2, max: 24, step: 0.5 },
    { key: "blockGap", label: "Block gap", defaultValue: 1, min: 0, max: 6, step: 0.25 },
    { key: "opacityPercent", label: "Profile opacity (%)", defaultValue: 72, min: 0, max: 100, step: 1 },
    { key: "borderWidth", label: "Block border width", defaultValue: 0.75, min: 0, max: 6, step: 0.25 },
    { key: "barMarkerWidth", label: "Subperiod OHLC marker width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "range1Minimum", label: "Colour range 1 minimum", defaultValue: 0, min: -1000000, max: 1000000, step: 1 },
    { key: "range2Minimum", label: "Colour range 2 minimum", defaultValue: 25, min: -1000000, max: 1000000, step: 1 },
    { key: "range3Minimum", label: "Colour range 3 minimum", defaultValue: 50, min: -1000000, max: 1000000, step: 1 },
    { key: "range4Minimum", label: "Colour range 4 minimum", defaultValue: 75, min: -1000000, max: 1000000, step: 1 },
    { key: "pocLineWidth", label: "POC line width", defaultValue: 1.5, min: 0.5, max: 6, step: 0.5 },
    { key: "developingPocStartOffset", label: "Developing POC start offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "shiftedPocTicks", label: "Shifted POC threshold (ticks)", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "pocGroupingOpacity", label: "POC grouping opacity (%)", defaultValue: 18, min: 0, max: 100, step: 1 },
    { key: "valueAreaBackgroundOpacity", label: "Value Area background opacity (%)", defaultValue: 10, min: 0, max: 100, step: 1 },
    { key: "valueAreaLineWidth", label: "Value Area line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "singlePrintLineWidth", label: "Single Print line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "singlePrintFillOpacity", label: "Single Print fill opacity (%)", defaultValue: 9, min: 0, max: 100, step: 1 },
    { key: "summaryBackgroundOpacity", label: "Summary background opacity (%)", defaultValue: 86, min: 0, max: 100, step: 1 },
    { key: "summaryFontSize", label: "Summary font size", defaultValue: 8, min: 6, max: 16, step: 1 },
    { key: "currentWidth", label: "Current profile width", defaultValue: 100, min: 0, max: 500, step: 1 },
    { key: "currentOffset", label: "Current profile offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "previousWidth", label: "Previous profile width", defaultValue: 80, min: 0, max: 500, step: 1 },
    { key: "previousOffset", label: "Previous profile offset", defaultValue: 0, min: 0, max: 500, step: 1 },
    { key: "peakValleyRadius", label: "Peak / Valley radius", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "peakMinimumProminence", label: "Peak / Valley prominence", defaultValue: 2, min: 0, max: 10000, step: 1 },
    { key: "maximumMergeMembers", label: "Maximum profiles per composite", defaultValue: 30, min: 2, max: 100, step: 1 },
    { key: "maximumRenderedBlocks", label: "Maximum rendered blocks", defaultValue: 50000, min: 1000, max: 250000, step: 1000 },
    { key: "fpsCap", label: "Render FPS cap", defaultValue: 60, min: 15, max: 144, step: 1 },
  ],
  "weekly-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 18, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 42, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "custom-draw-on-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of selected range)", defaultValue: 45, min: 0, max: 100, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 76, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "ask-bid-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 28, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 78, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "delta-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 78, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "cumulative-volume-delta": [
    { key: "lineWidth", label: "Line width", defaultValue: 2, min: 1, max: 4 },
    { key: "filterMinVolume", label: "Filtered CVD minimum bar volume", defaultValue: 0, min: 0, max: 10000000 },
    { key: "filterMaxVolume", label: "Filtered CVD maximum bar volume (0 = no maximum)", defaultValue: 0, min: 0, max: 10000000 },
    { key: "zeroLineWidth", label: "Zero-line width", defaultValue: 1, min: 1, max: 4 },
  ],
  "kwant-stats": [
    { key: "filterMin", label: "Minimum input filter", defaultValue: 0, min: 0, max: 10000000 },
    { key: "filterMax", label: "Maximum input filter · 0 = unlimited", defaultValue: 0, min: 0, max: 10000000 },
    { key: "coloringDeviation", label: "Standard deviations for cell coloring", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
  ],
  "gamma-levels": [
    { key: "maxLevels", label: "Maximum displayed levels", defaultValue: 14, min: 4, max: 24, step: 1 },
    { key: "lineWidth", label: "Base line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  ],
  "classic-gex-profile": [
    { key: "refreshIntervalMs", label: "Refresh interval (milliseconds)", defaultValue: 1000, min: 1000, max: 10000, step: 250 },
    { key: "manualMultiplier", label: "Manual mapping multiplier", defaultValue: 1, min: 0.000001, max: 100, step: 0.01 },
    { key: "premiumOffset", label: "Manual premium offset", defaultValue: 0, min: -5000, max: 5000, step: 0.25 },
    { key: "profileWidth", label: "Maximum profile width (% of chart)", defaultValue: 24, min: 8, max: 45, step: 1 },
    { key: "minBarWidth", label: "Minimum visible bar width (pixels)", defaultValue: 5, min: 1, max: 20, step: 1 },
    { key: "contrast", label: "Profile contrast (%)", defaultValue: 70, min: 15, max: 100, step: 1 },
  ],
  "expected-move": [
    { key: "lineOpacity", label: "Rail opacity (%)", defaultValue: 72, min: 15, max: 100, step: 1 },
    { key: "fillOpacity", label: "Band fill opacity (%)", defaultValue: 3, min: 0, max: 4, step: 0.5 },
  ],
  "hedge-levels": [
    { key: "fillOpacity", label: "Band opacity (%)", defaultValue: 5, min: 1, max: 10, step: 1 },
    { key: "lineOpacity", label: "Border opacity (%)", defaultValue: 62, min: 10, max: 100, step: 1 },
  ],
  "tpo-levels": [
    { key: "rowSize", label: "NQ row size (points)", defaultValue: 1, min: 0.25, max: 10, step: 0.25 },
    { key: "minimumTrades", label: "Minimum trades per session", defaultValue: 500, min: 100, max: 10000, step: 100 },
    { key: "tailMinimumRows", label: "Tail minimum rows", defaultValue: 3, min: 2, max: 20, step: 1 },
    { key: "singlePrintMinimumRows", label: "Single-print minimum rows", defaultValue: 4, min: 2, max: 30, step: 1 },
    { key: "ledgeMinimumBrackets", label: "Ledge minimum bracket extremes", defaultValue: 3, min: 2, max: 13, step: 1 },
    { key: "ledgeToleranceRows", label: "Ledge tolerance (rows)", defaultValue: 1, min: 0, max: 5, step: 1 },
    { key: "failedAuctionMinimumRows", label: "Failed-auction extension (rows)", defaultValue: 5, min: 2, max: 30, step: 1 },
    { key: "failedAuctionMaximumTpo", label: "Failed-auction maximum TPO", defaultValue: 2, min: 1, max: 5, step: 1 },
    { key: "edgeSmoothingRows", label: "Profile-edge smoothing rows", defaultValue: 5, min: 3, max: 11, step: 2 },
    { key: "edgeDropPercent", label: "Profile-edge drop (%)", defaultValue: 50, min: 20, max: 80, step: 5 },
    { key: "edgeMaximumWidthRows", label: "Profile-edge maximum width", defaultValue: 3, min: 1, max: 10, step: 1 },
    { key: "acceptedBasePercent", label: "Accepted-base threshold (%)", defaultValue: 60, min: 30, max: 90, step: 5 },
    { key: "seamTroughPercent", label: "Low-time seam trough (%)", defaultValue: 50, min: 20, max: 80, step: 5 },
    { key: "volumeLvnPercent", label: "Volume LVN threshold (%)", defaultValue: 50, min: 10, max: 90, step: 5 },
    { key: "acceptanceBrackets", label: "Acceptance brackets", defaultValue: 2, min: 1, max: 5, step: 1 },
    { key: "partialFillPercent", label: "Partial-fill threshold (%)", defaultValue: 50, min: 10, max: 90, step: 5 },
    { key: "expireAfterSessions", label: "Expire after completed sessions", defaultValue: 10, min: 5, max: 30, step: 1 },
    { key: "expireStrength", label: "Expire below effective strength", defaultValue: 20, min: 0, max: 60, step: 1 },
    { key: "fillOpacity", label: "Maximum zone opacity (%)", defaultValue: 15, min: 3, max: 35, step: 1 },
    { key: "borderOpacity", label: "Zone border opacity (%)", defaultValue: 58, min: 10, max: 100, step: 1 },
  ],
  "moving-average": [{ key: "length", label: "Length", defaultValue: 20, min: 1, max: 1000 }],
  "rolling-vwap": [
    { key: "length", label: "Rolling window (bars)", defaultValue: 60, min: 2, max: 1000 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
    { key: "band1", label: "Band 1 σ", defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    { key: "band2", label: "Band 2 σ", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "band3", label: "Band 3 σ", defaultValue: 3, min: 0.1, max: 10, step: 0.1 },
  ],
  vwap: [{ key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 }],
  "vwap-envelopes": [
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
    { key: "band1", label: "Band 1 σ", defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    { key: "band2", label: "Band 2 σ", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "band3", label: "Band 3 σ", defaultValue: 3, min: 0.1, max: 10, step: 0.1 },
  ],
  "relative-strength-index-rsi": [{ key: "length", label: "Length", defaultValue: 14, min: 2, max: 500 }],
  "rate-of-change-roc": [{ key: "length", label: "Length", defaultValue: 12, min: 1, max: 500 }],
  "momentum-indicator": [{ key: "length", label: "Length", defaultValue: 10, min: 1, max: 500 }],
  "commodity-channel-index-cci": [{ key: "length", label: "Length", defaultValue: 20, min: 2, max: 500 }],
  "aroon-up-down": [{ key: "length", label: "Length", defaultValue: 25, min: 2, max: 500 }],
  "aroon-oscillator": [{ key: "length", label: "Length", defaultValue: 25, min: 2, max: 500 }],
  "standard-deviation": [{ key: "length", label: "Length", defaultValue: 20, min: 2, max: 500 }],
  "average-true-range-atr": [{ key: "length", label: "Length", defaultValue: 14, min: 1, max: 500 }],
  "donchian-channel": [{ key: "length", label: "Length", defaultValue: 20, min: 2, max: 500 }],
  "williams-r": [{ key: "length", label: "Length", defaultValue: 14, min: 2, max: 500 }],
  "chaikin-accumulation-distribution": [],
  "macd-indicator": [
    { key: "fastLength", label: "Fast length", defaultValue: 12, min: 1, max: 500 },
    { key: "slowLength", label: "Slow length", defaultValue: 26, min: 2, max: 1000 },
    { key: "signalLength", label: "Signal length", defaultValue: 9, min: 1, max: 500 },
  ],
  "awesome-oscillator": [
    { key: "fastLength", label: "Fast length", defaultValue: 5, min: 1, max: 500 },
    { key: "slowLength", label: "Slow length", defaultValue: 34, min: 2, max: 1000 },
  ],
  "stochastic-oscillator": [
    { key: "length", label: "%K length", defaultValue: 14, min: 2, max: 500 },
    { key: "smooth", label: "Smoothing", defaultValue: 3, min: 1, max: 100 },
  ],
  "bollinger-bands": [
    { key: "length", label: "Length", defaultValue: 20, min: 2, max: 500 },
    { key: "multiplier", label: "Standard deviations", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
  ],
  "keltner-channel": [
    { key: "length", label: "EMA length", defaultValue: 20, min: 2, max: 500 },
    { key: "atrLength", label: "ATR length", defaultValue: 10, min: 1, max: 500 },
    { key: "multiplier", label: "ATR multiplier", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
  ],
};

export const KWANT_STATS_COMPACT_VISIBILITY = {
  showTotalVolume: true,
  showBidVolume: false,
  showAskVolume: false,
  showDeltaVolume: true,
  showMaxDeltaVolume: false,
  showMinDeltaVolume: false,
  showTotalTrades: false,
  showDeltaTrades: false,
  showRangeTicks: false,
  showDeltaPercent: true,
  showSessionCvd: false,
  showVolumePerSecond: false,
  showCotHigh: false,
  showCotLow: false,
  showCotBar: false,
  showDuration: false,
  showBarRatio: false,
  showHighRatio: false,
  showLowRatio: false,
  showTotalEffort: false,
  showDeltaEffort: false,
} as const;

export const defaultIndicatorSettings = (indicatorId: string, theme?: ChartSettings) => ({
  ...(indicatorId === "zero-gamma-line" ? {
    historySessions: 5,
    refreshSeconds: 30,
      opacity: 72,
      lineWidth: 2,
      lineStyle: "solid",
    useThemeColors: true,
    lineColor: theme?.borderUpColor ?? theme?.upColor ?? "#A3FF12",
    showCurrentValue: true,
    showRegimeHint: true,
  } : {}),
  ...(indicatorId === "options-delta" || indicatorId === "zero-gamma-bars" ? {
    refreshSeconds: 60,
    useThemeColors: true,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
  } : {}),
  ...(indicatorId === "cvd-divergence" ? {
    useThemeColors: true,
    bullishColor: theme?.upColor ?? "#22C55E",
    bearishColor: theme?.downColor ?? "#EF4444",
  } : {}),
  ...Object.fromEntries(
    (INDICATOR_NUMERIC_SETTINGS[indicatorId] ?? []).map((setting) => [setting.key, setting.defaultValue]),
  ),
  ...(indicatorId === "gamma-environment" ? {
    position: "top-right",
    showFreshness: true,
    showSource: false,
    // Semantic green/red by default so positive vs negative gamma is always
    // distinguishable (theme candle colours are monochrome on some themes).
    useThemeColors: false,
    positiveColor: "#22C55E",
    negativeColor: "#EF4444",
    badgeScale: 1,
    gammaEnvironmentSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "pulling-stacking" ? {
    ...DEFAULT_PULLING_STACKING_SETTINGS,
    bidStackColor: theme?.upColor ?? DEFAULT_PULLING_STACKING_SETTINGS.bidStackColor,
    askStackColor: theme?.downColor ?? DEFAULT_PULLING_STACKING_SETTINGS.askStackColor,
    bidPullColor: "#F59E0B",
    askPullColor: theme?.borderUpColor ?? "#38BDF8",
    neutralColor: theme?.gridColor ?? DEFAULT_PULLING_STACKING_SETTINGS.neutralColor,
    pullingStackingSettingsVersion: PULLING_STACKING_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "absorption-detector" ? {
    ...DEFAULT_ABSORPTION_SETTINGS,
    bidDevelopingColor: theme?.upColor ?? DEFAULT_ABSORPTION_SETTINGS.bidDevelopingColor,
    bidConfirmedColor: theme?.upColor ?? DEFAULT_ABSORPTION_SETTINGS.bidConfirmedColor,
    askDevelopingColor: theme?.downColor ?? DEFAULT_ABSORPTION_SETTINGS.askDevelopingColor,
    askConfirmedColor: theme?.downColor ?? DEFAULT_ABSORPTION_SETTINGS.askConfirmedColor,
    neutralColor: theme?.gridColor ?? DEFAULT_ABSORPTION_SETTINGS.neutralColor,
    version: ABSORPTION_DETECTOR_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "stacked-imbalance-suite" ? {
    ...DEFAULT_STACKED_IMBALANCE_SETTINGS,
    askColor: theme?.upColor ?? DEFAULT_STACKED_IMBALANCE_SETTINGS.askColor,
    bidColor: theme?.downColor ?? DEFAULT_STACKED_IMBALANCE_SETTINGS.bidColor,
    neutralColor: theme?.gridColor ?? DEFAULT_STACKED_IMBALANCE_SETTINGS.neutralColor,
    version: STACKED_IMBALANCE_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "iceberg-refresh-detector" ? {
    ...DEFAULT_ICEBERG_REFRESH_SETTINGS,
    bidColor: theme?.upColor ?? DEFAULT_ICEBERG_REFRESH_SETTINGS.bidColor,
    askColor: theme?.downColor ?? DEFAULT_ICEBERG_REFRESH_SETTINGS.askColor,
    neutralColor: theme?.gridColor ?? DEFAULT_ICEBERG_REFRESH_SETTINGS.neutralColor,
    schemaVersion: ICEBERG_REFRESH_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "liquidity-stop-sweep-detector" ? {
    ...DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS,
    buyColor: theme?.upColor ?? DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS.buyColor,
    sellColor: theme?.downColor ?? DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS.sellColor,
    neutralColor: theme?.gridColor ?? DEFAULT_LIQUIDITY_STOP_SWEEP_SETTINGS.neutralColor,
    schemaVersion: LIQUIDITY_STOP_SWEEP_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "poc-auction-suite" ? {
    ...DEFAULT_POC_AUCTION_SUITE_SETTINGS,
    barPocColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.barPocColor,
    sessionPocColor: theme?.upColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.sessionPocColor,
    nakedPocColor: theme?.borderDownColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.nakedPocColor,
    excessHighColor: theme?.downColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.excessHighColor,
    excessLowColor: theme?.upColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.excessLowColor,
    neutralColor: theme?.gridColor ?? DEFAULT_POC_AUCTION_SUITE_SETTINGS.neutralColor,
    schemaVersion: POC_AUCTION_SUITE_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "tape-speed-order-flow-burst" ? {
    ...DEFAULT_TAPE_SPEED_SETTINGS,
    buyColor: theme?.upColor ?? DEFAULT_TAPE_SPEED_SETTINGS.buyColor,
    sellColor: theme?.downColor ?? DEFAULT_TAPE_SPEED_SETTINGS.sellColor,
    totalColor: theme?.borderUpColor ?? DEFAULT_TAPE_SPEED_SETTINGS.totalColor,
    neutralColor: theme?.gridColor ?? DEFAULT_TAPE_SPEED_SETTINGS.neutralColor,
  } : {}),
  ...(indicatorId === "gamma-heatmap" ? {
    preset: "intraday",
    metric: "GAMMA",
    viewMode: "net",
    sourceMode: "hybrid",
    optionsSource: "AUTO",
    showHistorical: true,
    showLevels: true,
    carryForwardFade: true,
    showStatus: true,
    useThemeColors: true,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    neutralColor: theme?.gridColor ?? "#A1A1AA",
    gammaHeatmapSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "implied-volatility-rank" ? {
    preset: "balanced-30d",
    provider: "quantdata",
    sourceTicker: "AUTO",
    contractMode: "average-call-put",
    placement: "separate-pane",
    showIvRank: true,
    showIvPercentile: false,
    showRawIv: false,
    showPriceOverlay: true,
    showRegimeBands: true,
    showHeader: true,
    showLegend: true,
    showCurrentBadge: true,
    breakAtMissingData: true,
    carryLastValid: true,
    useLiveIntradayIv: true,
    useThemeColors: true,
    rankColor: theme?.upColor ?? "#22C55E",
    percentileColor: theme?.borderUpColor ?? theme?.upColor ?? "#8B5CF6",
    callColor: theme?.upColor ?? "#22C55E",
    putColor: theme?.downColor ?? "#EF4444",
    priceColor: "#E5E7EB",
    lowBandColor: theme?.downColor ?? "#EF4444",
    middleBandColor: theme?.gridColor ?? "#71717A",
    highBandColor: theme?.upColor ?? "#22C55E",
    paneHeight: 220,
    maximumForwardFillMinutes: 5,
    priceLineWidth: 1.5,
    decimalPrecision: 2,
    middleThreshold: 50,
    ivRankSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "net-gamma-exposure-by-strike" ? {
    preset: "balanced-net-gex",
    provider: "quantdata",
    sourceTicker: "AUTO",
    representation: "per-one-percent-move",
    expirationMode: "zero-to-one-dte",
    minimumDte: 0,
    maximumDte: 7,
    expirationDates: "",
    includeWeeklies: true,
    includeMonthlies: true,
    includeQuarterlies: true,
    aggregationMode: "auto-bin",
    placement: "floating",
    spaceMode: "overlay",
    reverseDirections: false,
    barHeightMode: "automatic",
    scaleMode: "visible-percentile",
    scaleTransform: "square-root",
    sharePositiveNegativeScale: true,
    contentMode: "net",
    visualMode: "gradient",
    showZeroSpine: true,
    showValues: false,
    showMappedPrice: false,
    showMaxPositive: true,
    showMaxNegative: true,
    showDominantAbsolute: false,
    showCallWall: false,
    showPutWall: false,
    showCurrentPrice: true,
    showHeader: true,
    showMappingConfidence: true,
    tooltipsEnabled: true,
    fadeWhenBelowMinimum: true,
    hideWhenBelowMinimum: false,
    useThemeColors: true,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    callColor: theme?.upColor ?? "#22C55E",
    putColor: theme?.downColor ?? "#EF4444",
    absoluteColor: theme?.borderUpColor ?? theme?.upColor ?? "#8B5CF6",
    zeroSpineColor: theme?.gridColor ?? "#71717A",
    warningColor: "#F59E0B",
    floatingXPercent: 50,
    netGammaSettingsVersion: 3,
  } : {}),
  ...(indicatorId === "gex-interval-map" ? {
    preset: "balanced-intraday",
    provider: "quantdata",
    sourceTicker: "AUTO",
    aggregationPeriod: "1m",
    historyMode: "current-session",
    sessionDate: "",
    startTime: "",
    endTime: "",
    mode: "raw",
    baseline: "previous-bucket",
    expirationMode: "zero-to-one-dte",
    expirationDates: "",
    includeWeeklies: true,
    includeMonthlies: true,
    includeQuarterlies: true,
    aggregationMode: "auto-bin",
    contentMode: "net",
    visualMode: "bubbles",
    scaleMode: "visible-percentile",
    scalePercentile: 98,
    scaleTransform: "square-root",
    highlightCurrentBucket: true,
    showCurrentBucketOutline: true,
    hollowBubbles: true,
    showLevelTracks: true,
    showUnderlyingPriceLine: false,
    showMaxPositive: true,
    showMaxNegative: true,
    showDominantAbsolute: false,
    showCallWall: false,
    showPutWall: false,
    mergeCoincidentLabels: true,
    hideZeroValues: true,
    showLevels: true,
    showValues: false,
    showHeader: true,
    showMappingConfidence: true,
    tooltipsEnabled: true,
    enableAlerts: false,
    alertNewLargePoint: true,
    alertLevelApproach: false,
    alertLevelTouch: false,
    browserNotifications: false,
    useThemeColors: true,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    callColor: theme?.upColor ?? "#22C55E",
    putColor: theme?.downColor ?? "#EF4444",
    neutralColor: "#A1A1AA",
    negativeExposurePalette: "neutral",
    gexIntervalMapSettingsVersion: 3,
  } : {}),
  ...(indicatorId === "bounce-levels" ? {
    preset: "balanced-intraday",
    provider: "quantdata",
    sourceTicker: "AUTO",
    // "live" tracks the current session; "eod" pins the previous completed
    // session's levels exactly as they closed, converted to the chart.
    priceMode: "live",
    extendRight: false,
    greekMode: "GAMMA",
    expirationMode: "zero-to-one-dte",
    minimumDte: 0,
    maximumDte: 7,
    expirationDates: "",
    historyBuckets: 1440,
    includeWeeklies: true,
    includeMonthlies: true,
    includeQuarterlies: true,
    showHeader: false,
    showLabels: false,
    showValues: false,
    showAirPockets: false,
    showKing: true,
    showFloor: true,
    showCeiling: true,
    showGatekeepers: true,
    showMajorNodes: true,
    showClusters: true,
    showDevelopingNodes: true,
    showWeakeningNodes: true,
    showRetiredHistory: true,
    showTouchCount: true,
    microOrbTexture: true,
    visualStrengthBasis: "percent-of-king",
    rollDetectionEnabled: true,
    rollVisualizationEnabled: false,
    tooltipsEnabled: true,
    enableAlerts: false,
    alertLevelApproach: true,
    alertLevelTouch: true,
    alertFreshNodesOnly: false,
    alertFirstTouchOnly: false,
    alertMapReshuffle: true,
    alertStructuralChanges: true,
    alertNodeTransitions: true,
    inAppSound: false,
    chartMarkers: true,
    browserNotifications: false,
    useThemeColors: true,
    // Paints every level with the exact colour its strike shows on the GEX
    // Map surface (live palette, signed-exposure heat scale) instead of the
    // role colours below.
    syncGexMapColors: false,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    kingColor: theme?.borderUpColor ?? "#F59E0B",
    developingColor: theme?.upColor ?? "#22C55E",
    weakeningColor: theme?.downColor ?? "#EF4444",
    airPocketColor: theme?.gridColor ?? "#71717A",
    bounceLevelsSettingsVersion: 5,
  } : {}),
  ...(indicatorId === "dark-pool-map" ? {
    preset: "balanced",
    sourceTicker: "AUTO",
    mappingMode: "rolling-affine",
    visualMode: "circles-and-zones",
    priceBinMode: "mapped-points",
    mergeNearbyLevels: true,
    showDelayedPrints: true,
    includeDelayedInLevels: true,
    includeAskSide: true,
    includeBidSide: true,
    includeMid: true,
    includeUnknown: true,
    showLevelLabels: true,
    showMappingBadge: true,
    showMappingConfidence: true,
    showLevelTable: false,
    enableAlerts: false,
    alertNewLargePrint: true,
    alertNewLargeLevel: true,
    alertScoreThreshold: true,
    alertPriceApproach: false,
    alertPriceTouch: false,
    browserNotifications: false,
    useThemeColors: true,
    neutralColor: theme?.gridColor ?? "#A1A1AA",
    askSideColor: theme?.upColor ?? "#22C55E",
    bidSideColor: theme?.downColor ?? "#EF4444",
    midColor: theme?.gridColor ?? "#A1A1AA",
    delayedColor: "#F59E0B",
    darkPoolMapSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "dark-pool-gex" ? {
    useThemeColors: true,
    lookbackMode: "calendar-days",
    sortMode: "notional",
    viewPreset: "raw-dp-levels",
    precisionMode: true,
    contextMode: "current",
    confluenceMode: "king-and-major",
    toleranceMode: "percentage",
    displayMode: "raw",
    clusterEnabled: false,
    clusterDistanceMode: "percentage",
    // Indexes and futures automatically use their documented tradable ETF
    // source (QQQ or SPY). This remains configurable for directly traded
    // equities, but a fresh futures indicator must work immediately.
    proxyMode: true,
    showOriginMarker: false,
    showForwardMemory: false,
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
    minimumStatsSamples: 3,
    interactionToleranceMode: "percentage",
    resetDistanceMode: "percentage",
    reactionThresholdMode: "percentage",
    breakDistanceMode: "ticks",
    breakConfirmation: "1-close",
    interactionSession: "regular-hours",
    useIntrabarHighLow: true,
    requireCloseAwayFromLevel: false,
    useVolumeConfirmation: false,
    enableReclaimDetection: true,
    firstTouchOnly: false,
    includeLateReports: true,
    includeCorrectedPrints: true,
    excludeCanceled: true,
    showTooltip: true,
    showInspector: false,
    showFreshness: true,
    ageFade: false,
    proximityEmphasis: true,
    performanceQuality: "auto",
    enableAlerts: false,
    alertNewPrint: true,
    alertPriceApproach: false,
    alertPriceTouch: false,
    alertHoldConfirmed: true,
    alertBreakConfirmed: true,
    alertReclaimConfirmed: true,
    alertGexConfluence: true,
    browserNotifications: false,
    neutralColor: theme?.gridColor ?? "#A1A1AA",
    positiveGexColor: theme?.upColor ?? "#22C55E",
    negativeGexColor: theme?.downColor ?? "#EF4444",
    darkPoolGexSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "divergence-detector" ? {
    comparisonMode: "automatic-es-nq",
    includeNonConfirmation: true,
    showBullish: true,
    showBearish: true,
    showLabels: true,
    showPivotDots: true,
    dashedLines: false,
    useThemeColors: true,
    bullishColor: theme?.upColor ?? "#22C55E",
    bearishColor: theme?.downColor ?? "#EF4444",
    divergenceDetectorSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "delta-highlight" ? {
    useThemeColors: true,
    showAsk: true,
    showBid: true,
    showValue: true,
    markerShape: "square",
    markerPosition: "inBar",
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    deltaHighlightSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "imbalance-tracker" ? {
    calculationMode: "diagonal",
    includeZero: false,
    useThemeColors: true,
    showTriggered: true,
    triggerOnlyTouch: false,
    enableAlertSound: false,
    alertName: "Imbalance detected",
    popupMessage: "A new stacked imbalance zone was detected.",
    buyColor: theme?.upColor ?? "#22C55E",
    sellColor: theme?.downColor ?? "#EF4444",
    buyTriggeredColor: theme?.borderUpColor ?? theme?.upColor ?? "#86EFAC",
    sellTriggeredColor: theme?.borderDownColor ?? theme?.downColor ?? "#FCA5A5",
    imbalanceTrackerSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "imbalance-rejector" ? {
    includeZero: false,
    confirmedOnly: true,
    useThemeColors: true,
    markerType: "triangle",
    bullishColor: theme?.upColor ?? "#22C55E",
    bearishColor: theme?.downColor ?? "#EF4444",
    imbalanceRejectorSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "delta-cumulative-candlestick" ? {
    inputData: "Volumes",
    resetToSession: true,
    displayStyle: "candles",
    showAverage: false,
    showAverageDeviations: false,
    showZeroLine: true,
    useThemeColors: true,
    deltaAskColor: theme?.upColor ?? "#22C55E",
    deltaBidColor: theme?.downColor ?? "#EF4444",
    averageColor: theme?.borderUpColor ?? theme?.upColor ?? "#60A5FA",
    deviationColor: theme?.gridColor ?? "#71717A",
    zeroLineColor: theme?.gridColor ?? "#52525B",
    cumulativeCandlestickSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "delta-cumulative-histogram" ? {
    inputData: "Volumes",
    resetToSession: true,
    displayStyle: "bars",
    lineStyle: "solid",
    showName: true,
    showValue: true,
    showZeroLine: true,
    useThemeColors: true,
    customName: "Cumulative Delta Histogram",
    deltaAskColor: theme?.upColor ?? "#22C55E",
    deltaBidColor: theme?.downColor ?? "#EF4444",
    lineColor: theme?.borderUpColor ?? theme?.upColor ?? "#60A5FA",
    zeroLineColor: theme?.gridColor ?? "#52525B",
    cumulativeHistogramSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "cumulative-volume-delta" ? {
    displayStyle: "candles",
    useThemeColors: true,
    cvdSettingsVersion: 4,
    showBidAskVolumes: false,
    filteredEnabled: false,
    filteredSeparateAxis: false,
    showZeroLine: true,
    deltaAskColor: theme?.upColor ?? "#22C55E",
    deltaBidColor: theme?.downColor ?? "#EF4444",
    volumeAskColor: theme?.borderUpColor ?? theme?.upColor ?? "#34D399",
    volumeBidColor: theme?.borderDownColor ?? theme?.downColor ?? "#F87171",
    filteredAskColor: theme?.upColor ?? "#22C55E",
    filteredBidColor: theme?.downColor ?? "#EF4444",
    zeroLineColor: theme?.gridColor ?? "#52525B",
  } : {}),
  ...(indicatorId === "kwant-stats" ? {
    inputData: "Volume",
    autoFormat: true,
    invertRows: false,
    showHeader: true,
    useThemeColors: true,
    ...KWANT_STATS_COMPACT_VISIBILITY,
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    neutralColor: theme?.borderUpColor ?? theme?.upColor ?? "#94A3B8",
    textColor: "#E5E7EB",
    headerColor: theme?.gridColor ?? "#27272A",
    statsSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "sessions" ? {
    showTokyo: true,
    showLondon: true,
    showNewYork: true,
    showSydney: false,
    tokyoLabel: "Tokyo",
    londonLabel: "London",
    newYorkLabel: "New York",
    sydneyLabel: "Sydney",
    tokyoStart: "09:00",
    tokyoEnd: "18:00",
    londonStart: "08:00",
    londonEnd: "17:00",
    newYorkStart: "09:00",
    newYorkEnd: "18:00",
    sydneyStart: "08:00",
    sydneyEnd: "17:00",
    tokyoColor: "#FF9900",
    londonColor: "#4CAF50",
    newYorkColor: "#2196F3",
    sydneyColor: "#A461BB",
    showLabels: true,
    showBackground: true,
    showBorders: true,
    showOpenClose: true,
    showMidline: false,
    showPercentChange: false,
    showPointChange: false,
    hideWeekends: true,
    lookbackDays: 30,
    fillOpacity: 10,
    lineOpacity: 65,
    borderWidth: 1,
    lineStyle: "dashed",
    labelSize: "small",
  } : {}),
  ...(indicatorId === "session-highs-lows" ? {
    showTokyo: true,
    showLondon: true,
    showNewYork: true,
    showSydney: false,
    tokyoLabel: "Tokyo",
    londonLabel: "London",
    newYorkLabel: "New York",
    sydneyLabel: "Sydney",
    tokyoStart: "09:00",
    tokyoEnd: "18:00",
    londonStart: "08:00",
    londonEnd: "17:00",
    newYorkStart: "09:00",
    newYorkEnd: "18:00",
    sydneyStart: "08:00",
    sydneyEnd: "17:00",
    tokyoColor: "#FF9900",
    londonColor: "#4CAF50",
    newYorkColor: "#2196F3",
    sydneyColor: "#A461BB",
    followSessionsStudy: true,
    showPrevious1: true,
    showPrevious2: true,
    showPrevious3: true,
    showHighs: true,
    showLows: true,
    showLabels: true,
    hideWeekends: true,
    useSessionColors: true,
    highColor: theme?.upColor ?? "#22C55E",
    lowColor: theme?.downColor ?? "#EF4444",
    lineStyle: "dashed",
    labelSize: "small",
    sessionHighLowSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "ib-levels" ? {
    durationMinutes: 60,
    showGlobex: true,
    showTokyo: true,
    showLondon: true,
    showNewYork: true,
    globexLabel: "Globex",
    tokyoLabel: "Asia",
    londonLabel: "London",
    newYorkLabel: "New York",
    globexStart: "18:00",
    globexEnd: "17:00",
    tokyoStart: "09:00",
    tokyoEnd: "18:00",
    londonStart: "08:00",
    londonEnd: "17:00",
    newYorkStart: "09:30",
    newYorkEnd: "16:00",
    globexColor: "#A461BB",
    tokyoColor: "#FF9900",
    londonColor: "#4CAF50",
    newYorkColor: "#2196F3",
    followSessionsStudy: false,
    showHighs: true,
    showLows: true,
    showLabels: true,
    hideWeekends: true,
    useSessionColors: false,
    useThemeColors: true,
    highColor: theme?.upColor ?? "#22C55E",
    lowColor: theme?.downColor ?? "#EF4444",
    developingLineStyle: "solid",
    fixedLineStyle: "dashed",
    labelSize: "small",
    lookbackDays: 7,
    lineOpacity: 88,
    lineWidth: 1,
    showFib: false,
    fibDirection: "long",
    initialBalanceSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "big-trades" ? {
    daysToLoad: 1,
    filterMode: "manual",
    automaticIntensity: "medium",
    enableClustering: true,
    clusterWindowMs: 100,
    clusterPriceTicks: 0,
    maxMarkersPerBar: 50,
    combineByCandle: false,
    adaptiveTimeframeFilter: false,
    maximumFilter: 0,
    markerType: "circle",
    hollowFill: false,
    informationMode: "volume",
    useThemeColors: true,
    showLabels: true,
    enableAlertSound: false,
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    bigTradesSettingsVersion: 4,
  } : {}),
  ...(indicatorId === "deep-m-effort-nq" ? {
    useThemeColors: true,
    showZones: true,
    showMovingAverage: true,
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#7C3AED",
    maAboveColor: theme?.upColor ?? "#22C55E",
    maBelowColor: theme?.downColor ?? "#7C3AED",
    maAutoColor: "price",
    maLineStyle: "solid",
    shortName: "Big Blocks",
    showNameLabel: false,
    showValueLabel: true,
    nameBackground: false,
    valueBackground: true,
    enableAlertSound: false,
    enableMessage: false,
    alertMessage: "Big Blocks directional bias changed",
    zoneBars: 22,
    effortSettingsVersion: 3,
  } : {}),
  ...(indicatorId === "depth-of-market" ? {
    showCumulative: false,
    showOrderCount: false,
    showPullStack: true,
    showRecentTrades: true,
    showDepthHistogram: true,
    showHeaderStats: true,
    showImbalance: true,
    autoCenter: true,
    compactNumbers: true,
    useThemeColors: true,
    bidColor: theme?.upColor ?? "#22C55E",
    askColor: theme?.downColor ?? "#EF4444",
    lastTradeColor: theme?.borderUpColor ?? theme?.upColor ?? "#FDE047",
    domPreset: "order-flow",
    domColumns: JSON.stringify([
      { id: "buy", width: 100, enabled: true },
      { id: "sell", width: 100, enabled: true },
      { id: "bid", width: 100, enabled: true },
      { id: "price", width: 100, enabled: true },
      { id: "ask", width: 100, enabled: true },
      { id: "trades", width: 100, enabled: true },
      { id: "orders", width: 82, enabled: false },
      { id: "cob", width: 82, enabled: false },
      { id: "pullStack", width: 82, enabled: false },
    ]),
    rowHeight: 24,
    domSettingsVersion: DOM_PRO_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-print-footprint" ? {
    ...DEFAULT_FOOTPRINT_SETTINGS,
    type: "ask-bid",
    mode: "profile",
    inputType: "volume",
    groupingMode: "automatic",
    groupMode: "fixed",
    outsideBarStyle: "bar",
    markerAlignment: "center",
    colorMode: "fading",
    colorCalculation: "imbalance",
    imbalanceMode: "diagonal",
    textFormat: "automatic",
    useThemeColors: true,
    includeZero: false,
    showZeros: false,
    colorOnlyDominantSide: false,
    dynamicTextSize: true,
    outerEdgeMode: true,
    showVolumePoc: true,
    showDeltaPoc: false,
    showValueArea: true,
    showSinglePrints: false,
    singlePrintExtremesOnly: true,
    showRatio: false,
    showVolumeClusters: false,
    showBarDelta: true,
    showBetweenVolume: false,
    showVwap: false,
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    betweenColor: "#A1A1AA",
    neutralColor: theme?.gridColor ?? "#3F3F46",
    textColor: "#F5F5F5",
    pocColor: theme?.borderUpColor ?? theme?.upColor ?? "#FDE047",
    deltaPocColor: theme?.borderDownColor ?? theme?.downColor ?? "#60A5FA",
    clusterColor: "#F59E0B",
    singlePrintColor: "#F4F4F5",
    vwapColor: "#22D3EE",
    footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
  } : {}),
  ...(indicatorId === "gamma-levels" ? {
    conversion: "AUTO",
    showLabels: true,
    showEnvironment: true,
    useThemeColors: true,
    lineStyle: "dashed",
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    magnetColor: "#8B5CF6",
    centreColor: "#06B6D4",
    gammaSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "classic-gex-profile" ? {
    mappingSource: "QQQ",
    profileMode: "CLASSIC_GEX",
    expiry: "ZERO_DTE",
    profileSource: "VOLUME",
    panelPosition: "RIGHT",
    mappingMode: "AUTO",
    logarithmicScaling: false,
    showLookbackDots: true,
    showMajorPositiveVolume: true,
    showMajorNegativeVolume: true,
    showMajorPositiveOpenInterest: true,
    showMajorNegativeOpenInterest: true,
    showZeroGamma: true,
    showLabels: true,
    useThemeColors: true,
    positiveColor: "#22C55E",
    negativeColor: "#EF4444",
    zeroGammaColor: "#F4F4F5",
    classicGexSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "expected-move" ? {
    mode: "SESSION",
    mappingSource: "QQQ",
    showTwoSigma: false,
    showBandFill: false,
    showLabels: true,
    useThemeColors: true,
    neutralColor: "#D6A84B",
    expectedMoveSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "hedge-levels" ? {
    showBelowFlip: true,
    showLabels: true,
    hedgeLevelsSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "tpo-levels" ? {
    useThemeColors: true,
    showLabels: true,
    supportColor: theme?.upColor ?? "#22C55E",
    resistanceColor: theme?.downColor ?? "#EF4444",
    neutralColor: theme?.borderUpColor ?? "#94A3B8",
    tpoLevelsSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "tpo-chart" ? tpoSettingsToRecord(defaultTpoSettings("daily-tpo", theme)) : {}),
  ...(indicatorId === "weekly-tpo" ? tpoSettingsToRecord(defaultTpoSettings("weekly-tpo", theme)) : {}),
  ...(["kwant-profile", "weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"].includes(indicatorId) ? {
    valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    profileMode: indicatorId === "ask-bid-volume-profile"
      ? "bid-ask"
      : indicatorId === "delta-profile"
        ? "delta"
        : "delta-volume",
    groupingMode: "automatic",
    snapMode: indicatorId === "custom-draw-on-volume-profile" ? "off" : "left",
    useThemeColors: true,
    showText: false,
    showValueArea: true,
    showPocLine: true,
    showValueAreaLines: true,
    showDelta: true,
    showProfileSpine: true,
    showDevelopingPoc: false,
    showPocHighlight: true,
    showProfileOutline: true,
    showVwapLine: false,
    showVwapBands: false,
    showSummary: false,
    profileSettingsVersion: 6,
    align: indicatorId === "kwant-profile"
      ? "session"
      : indicatorId === "weekly-volume-profile" ? "left" : "right",
    volumeColor: theme?.borderUpColor ?? theme?.upColor ?? "#22C55E",
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    pocColor: theme?.upColor ?? "#22C55E",
    valueAreaColor: theme?.borderUpColor ?? theme?.upColor ?? "#22C55E",
  } : {}),
});

export const normalizeStoredIndicator = (instance: ChartIndicatorInstance): ChartIndicatorInstance => {
  let normalizedInstance = instance.indicatorId === "deep-profile"
    ? { ...instance, indicatorId: "kwant-profile" }
    : instance.indicatorId === "deep-stats"
      ? { ...instance, indicatorId: "kwant-stats" }
      : instance.indicatorId === "deep-m-effort"
        ? { ...instance, indicatorId: "deep-m-effort-nq" }
      : instance;
  if (normalizedInstance.indicatorId === "market-profile-tpo") {
    normalizedInstance = { ...normalizedInstance, indicatorId: "tpo-chart" };
  }
  if (normalizedInstance.indicatorId === "tpo-chart" || normalizedInstance.indicatorId === "weekly-tpo") {
    const variant = normalizedInstance.indicatorId === "weekly-tpo" ? "weekly-tpo" : "daily-tpo";
    normalizedInstance = {
      ...normalizedInstance,
      settings: tpoSettingsToRecord(validateTpoSettings(normalizedInstance.settings, variant)),
    };
  }
  if (normalizedInstance.indicatorId === "pulling-stacking") {
    const settings = normalizePullingStackingSettings({
      ...defaultIndicatorSettings("pulling-stacking"),
      ...(normalizedInstance.settings ?? {}),
    });
    return {
      ...normalizedInstance,
      settings: { ...settings },
    };
  }
  if (normalizedInstance.indicatorId === "absorption-detector" || normalizedInstance.indicatorId === "absorption") {
    return {
      ...normalizedInstance,
      indicatorId: "absorption-detector",
      settings: {
        ...normalizeAbsorptionSettings({
          ...defaultIndicatorSettings("absorption-detector"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "stacked-imbalance-suite") {
    return {
      ...normalizedInstance,
      settings: {
        ...normalizeStackedImbalanceSettings({
          ...defaultIndicatorSettings("stacked-imbalance-suite"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "iceberg-refresh-detector") {
    return {
      ...normalizedInstance,
      settings: {
        ...normalizeIcebergRefreshSettings({
          ...defaultIndicatorSettings("iceberg-refresh-detector"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "liquidity-stop-sweep-detector" || normalizedInstance.indicatorId === "stop-run") {
    return {
      ...normalizedInstance,
      indicatorId: "liquidity-stop-sweep-detector",
      settings: {
        ...normalizeLiquidityStopSweepSettings({
          ...defaultIndicatorSettings("liquidity-stop-sweep-detector"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "poc-auction-suite") {
    return {
      ...normalizedInstance,
      settings: {
        ...normalizePocAuctionSuiteSettings({
          ...defaultIndicatorSettings("poc-auction-suite"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "tape-speed-order-flow-burst") {
    return {
      ...normalizedInstance,
      settings: {
        ...normalizeTapeSpeedSettings({
          ...defaultIndicatorSettings("tape-speed-order-flow-burst"),
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "zero-gamma-line") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("zero-gamma-line");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["zero-gamma-line"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
      if (!["solid", "dashed", "dotted"].includes(String(settings.lineStyle))) settings.lineStyle = "solid";
    for (const unsafeKey of ["apiKey", "credential", "credentials", "snapshot", "points", "history"]) delete settings[unsafeKey];
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "options-delta" || normalizedInstance.indicatorId === "zero-gamma-bars") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings(normalizedInstance.indicatorId);
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS[normalizedInstance.indicatorId] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
    settings.useThemeColors = settings.useThemeColors !== false;
    for (const unsafeKey of ["apiKey", "credential", "credentials", "snapshot", "points", "history"]) delete settings[unsafeKey];
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "cvd-divergence") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("cvd-divergence");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["cvd-divergence"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
    settings.useThemeColors = settings.useThemeColors !== false;
    for (const unsafeKey of ["apiKey", "credential", "credentials", "snapshot", "points", "history"]) delete settings[unsafeKey];
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "implied-volatility-rank") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("implied-volatility-rank");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["implied-volatility-rank"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
    if (!["AUTO", "QQQ", "SPY", "NDX", "SPX", "SPXW", "IWM", "DIA"].includes(String(settings.sourceTicker))) settings.sourceTicker = "AUTO";
    if (!["combined", "average-call-put", "call", "put", "call-put-split"].includes(String(settings.contractMode))) settings.contractMode = "average-call-put";
    if (!["separate-pane", "main-chart-overlay"].includes(String(settings.placement))) settings.placement = "separate-pane";
    const lowThreshold = Number(settings.lowThreshold);
    const middleThreshold = Number(settings.middleThreshold);
    const highThreshold = Number(settings.highThreshold);
    if (!(lowThreshold < middleThreshold && middleThreshold < highThreshold)) {
      settings.lowThreshold = 20;
      settings.middleThreshold = 50;
      settings.highThreshold = 80;
    }
    for (const unsafeKey of ["apiKey", "credential", "credentials", "providerCredential", "snapshot", "history", "observations"]) delete settings[unsafeKey];
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "net-gamma-exposure-by-strike") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("net-gamma-exposure-by-strike");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["net-gamma-exposure-by-strike"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    const enumValues: Record<string, string[]> = {
      provider: ["quantdata", "databento-custom", "hybrid-validation"],
      expirationMode: ["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"],
      aggregationMode: ["exact-display-tick", "auto-bin", "custom-bin"],
      placement: ["right", "left", "floating"],
      spaceMode: ["overlay", "reserved"],
      barHeightMode: ["automatic", "fixed-pixels", "mapped-price-bin"],
      scaleMode: ["visible-maximum", "visible-percentile", "all-loaded-maximum", "fixed-maximum"],
      scaleTransform: ["linear", "square-root", "logarithmic"],
      contentMode: ["net", "net-with-call-put-detail", "call-put-split", "absolute-concentration", "net-change"],
      visualMode: ["solid", "gradient", "outline", "heat", "compact-line"],
    };
    for (const [key, allowed] of Object.entries(enumValues)) {
      if (!allowed.includes(String(settings[key]))) settings[key] = defaults[key];
    }
    // Version 3 intentionally moves the profile from the chart edge into a
    // centered overlay. This also migrates already-saved workspaces that used
    // the former right-lane default.
    if (Number(settings.netGammaSettingsVersion ?? 0) < 3) {
      settings.placement = "floating";
      settings.floatingXPercent = 50;
      settings.spaceMode = "overlay";
    }
    for (const unsafeKey of ["apiKey", "credential", "credentials", "providerCredential", "liveSnapshot", "snapshotData", "rows"]) {
      delete settings[unsafeKey];
    }
    return {
      ...normalizedInstance,
      settings: { ...settings, netGammaSettingsVersion: 3 },
    };
  }
  if (normalizedInstance.indicatorId === "gex-interval-map") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("gex-interval-map");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["gex-interval-map"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
    const enumValues: Record<string, string[]> = {
      sourceTicker: ["AUTO", "QQQ", "NDX", "NQ", "SPY", "SPX", "SPXW"],
      aggregationPeriod: ["1m", "2m", "3m", "4m", "5m", "10m", "15m", "30m", "1h"],
      historyMode: ["current-session", "session-date", "custom-range"],
      mode: ["raw", "difference"],
      baseline: ["previous-bucket", "session-open", "rolling-average"],
      expirationMode: ["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"],
      aggregationMode: ["exact-display-tick", "auto-bin", "custom-bin"],
      contentMode: ["net", "call", "put", "gross", "call-put-split"],
      visualMode: ["bubbles", "fixed-dots", "heat-cells", "horizontal-ribbons", "hybrid"],
      scaleMode: ["visible-maximum", "visible-percentile", "session-maximum", "fixed-maximum"],
      scaleTransform: ["linear", "square-root", "logarithmic"],
      negativeExposurePalette: ["neutral", "bearish"],
    };
    for (const [key, allowed] of Object.entries(enumValues)) if (!allowed.includes(String(settings[key]))) settings[key] = defaults[key];
    if (Number(settings.gexIntervalMapSettingsVersion ?? 0) < 2) {
      settings.visualMode = "bubbles";
      settings.maximumPoints = Math.max(20_000, Number(settings.maximumPoints ?? 0));
      settings.minimumRadius = Math.max(3, Number(settings.minimumRadius ?? 0));
      settings.maximumRadius = Math.max(18, Number(settings.maximumRadius ?? 0));
      settings.hollowBubbles = true;
      settings.showLevelTracks = true;
      settings.showUnderlyingPriceLine = false;
    }
    if (Number(settings.gexIntervalMapSettingsVersion ?? 0) < 3) {
      settings.negativeExposurePalette = "neutral";
      settings.neutralColor = "#A1A1AA";
      settings.maximumPoints = Math.max(40_000, Number(settings.maximumPoints ?? 0));
    }
    for (const unsafeKey of ["apiKey", "credential", "credentials", "providerCredential", "liveSnapshot", "snapshotData", "buckets", "points"]) delete settings[unsafeKey];
    return { ...normalizedInstance, settings: { ...settings, gexIntervalMapSettingsVersion: 3 } };
  }
  if (normalizedInstance.indicatorId === "bounce-levels") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("bounce-levels");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    delete settings.showRocArrows;
    if (normalizedInstance.settings?.topExposurePercent === undefined) {
      const legacyMinimumPercentile = Number(normalizedInstance.settings?.minimumExposurePercentile ?? 90);
      settings.topExposurePercent = Math.max(1, Math.min(100, 100 - legacyMinimumPercentile));
    }
    delete settings.minimumExposurePercentile;
    for (const definition of INDICATOR_NUMERIC_SETTINGS["bounce-levels"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    const enumValues: Record<string, string[]> = {
      provider: ["quantdata"],
      sourceTicker: ["AUTO", "QQQ", "NDX", "SPY", "SPX", "SPXW", "IWM"],
      greekMode: ["GAMMA", "DELTA", "VANNA", "CHARM"],
      expirationMode: ["zero-dte", "zero-to-one-dte", "zero-to-seven-dte", "front-expiration", "all-expirations", "custom-dte-range", "specific-expirations"],
      visualStrengthBasis: ["absolute-exposure", "percent-of-king", "hybrid"],
      preset: ["balanced-intraday", "zero-dte-scalper", "major-nodes-only", "fresh-bounce-levels", "node-momentum", "clean-chart", "research"],
      priceMode: ["live", "eod"],
    };
    for (const [key, allowed] of Object.entries(enumValues)) {
      if (!allowed.includes(String(settings[key]))) settings[key] = defaults[key];
    }
    // Version 3 makes the rolling week part of the indicator contract. Older
    // saved workspaces retained only 120–720 intraday buckets and therefore
    // silently discarded prior sessions.
    settings.historyBuckets = 1440;
    for (const unsafeKey of ["apiKey", "credential", "credentials", "providerCredential", "liveSnapshot", "snapshotData", "levels", "history"]) {
      delete settings[unsafeKey];
    }
    if (Number(settings.maximumDte) < Number(settings.minimumDte)) settings.maximumDte = settings.minimumDte;
    if (Number(settings.maximumNodeThickness) < Number(settings.minimumNodeThickness)) settings.maximumNodeThickness = settings.minimumNodeThickness;
    if (Number(settings.activeEnterThreshold) < Number(settings.activeExitThreshold)) settings.activeEnterThreshold = settings.activeExitThreshold;
    return { ...normalizedInstance, settings: { ...settings, bounceLevelsSettingsVersion: 5 } };
  }
  if (
    normalizedInstance.indicatorId === "depth-of-market"
    && Number(normalizedInstance.settings?.domSettingsVersion) < DOM_PRO_SETTINGS_VERSION
  ) {
    normalizedInstance = {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("depth-of-market"),
        ...(normalizedInstance.settings ?? {}),
        width: Math.max(640, Number(normalizedInstance.settings?.width ?? 640)),
        rows: DEFAULT_DOM_PRO_VISIBLE_ROWS,
        rowHeight: 24,
        domPreset: "order-flow",
        domColumns: String(defaultIndicatorSettings("depth-of-market").domColumns ?? "[]"),
        domSettingsVersion: DOM_PRO_SETTINGS_VERSION,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "deep-print-footprint"
    && Number(normalizedInstance.settings?.footprintSettingsVersion) < FOOTPRINT_SETTINGS_SCHEMA_VERSION
  ) {
    normalizedInstance = {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("deep-print-footprint"),
        ...(normalizedInstance.settings ?? {}),
        footprintSettingsVersion: FOOTPRINT_SETTINGS_SCHEMA_VERSION,
      },
    };
  }
  if (
    ["kwant-profile", "weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"]
      .includes(normalizedInstance.indicatorId)
  ) {
    normalizedInstance = {
      ...normalizedInstance,
      settings: {
        ...(normalizedInstance.settings ?? {}),
        valueAreaPercent: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "kwant-profile"
    && Number(normalizedInstance.settings?.profileSettingsVersion) < 6
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...(normalizedInstance.settings ?? {}),
        profileMode: "delta-volume",
        align: "session",
        showText: false,
        showPocHighlight: true,
        showProfileOutline: true,
        showVwapLine: false,
        showVwapBands: false,
        showSummary: false,
        showDelta: true,
        showProfileSpine: true,
        snapMode: normalizedInstance.settings?.snapMode === "right" ? "right" : "left",
        profileWidth: 24,
        opacity: 72,
        profileSettingsVersion: 6,
      },
    };
  }
  if (
    ["weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"]
      .includes(normalizedInstance.indicatorId)
    && Number(normalizedInstance.settings?.profileSettingsVersion) < 6
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...(normalizedInstance.settings ?? {}),
        snapMode: normalizedInstance.indicatorId === "custom-draw-on-volume-profile"
          ? "off"
          : normalizedInstance.settings?.snapMode === "right" ? "right" : "left",
        profileSettingsVersion: 6,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "deep-m-effort-nq"
    && Number(normalizedInstance.settings?.effortSettingsVersion) < 3
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("deep-m-effort-nq"),
        ...(normalizedInstance.settings ?? {}),
        shortName: "Big Blocks",
        alertMessage: "Big Blocks directional bias changed",
        effortSettingsVersion: 3,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "big-trades"
    && Number(normalizedInstance.settings?.bigTradesSettingsVersion) < 4
  ) {
    const storedManualFilter = Number(normalizedInstance.settings?.manualFilter ?? 30);
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("big-trades"),
        ...(normalizedInstance.settings ?? {}),
        filterMode: "manual",
        manualFilter: Math.min(100, Math.max(1, Number.isFinite(storedManualFilter) ? storedManualFilter : 30)),
        combineByCandle: false,
        adaptiveTimeframeFilter: false,
        maxMarkersPerBar: 50,
        bigTradesSettingsVersion: 4,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "kwant-stats"
    && Number(normalizedInstance.settings?.statsSettingsVersion) < 2
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("kwant-stats"),
        ...(normalizedInstance.settings ?? {}),
        ...KWANT_STATS_COMPACT_VISIBILITY,
        statsSettingsVersion: 2,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "gamma-levels"
    && Number(normalizedInstance.settings?.gammaSettingsVersion) < 2
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("gamma-levels"),
        ...(normalizedInstance.settings ?? {}),
        gammaSettingsVersion: 2,
      },
    };
  }
  if (normalizedInstance.indicatorId === "gamma-environment") {
    const defaults = defaultIndicatorSettings("gamma-environment");
    const settings = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    const allowedPositions = new Set([
      "top-left",
      "top-middle",
      "top-right",
      "bottom-left",
      "bottom-middle",
      "bottom-right",
    ]);
    if (!allowedPositions.has(String(settings.position))) settings.position = "top-right";
    const parsedScale = Number(settings.badgeScale);
    settings.badgeScale = Number.isFinite(parsedScale) ? Math.min(2, Math.max(0.6, parsedScale)) : 1;
    // v2 migration: positive/negative gamma is a semantic signal, so default to
    // green/red rather than the theme candle colours (which were white/grey on
    // monochrome themes, making the regime indistinguishable). Migrate once;
    // then respect the user's explicit choices.
    const savedVersion = Number(normalizedInstance.settings?.gammaEnvironmentSettingsVersion);
    if (!(savedVersion >= 2)) {
      settings.useThemeColors = false;
      settings.positiveColor = "#22C55E";
      settings.negativeColor = "#EF4444";
    } else {
      settings.useThemeColors = settings.useThemeColors === true;
    }
    return {
      ...normalizedInstance,
      settings: { ...settings, gammaEnvironmentSettingsVersion: 2 },
    };
  }
  if (normalizedInstance.indicatorId === "ib-levels") {
    const defaults = defaultIndicatorSettings("ib-levels");
    const persistedSettings = normalizedInstance.settings ?? {};
    const settings: Record<string, number | string | boolean> = {
      ...defaults,
      ...persistedSettings,
    };
    // Sydney was removed from the IB study: Globex IS the 18:00 New York
    // reopen, so a separate Sydney range double-labelled the same idea.
    for (const sydneyKey of ["showSydney", "sydneyLabel", "sydneyStart", "sydneyEnd", "sydneyColor"]) {
      delete settings[sydneyKey];
    }
    if (Number(persistedSettings.initialBalanceSettingsVersion ?? 0) < 2) {
      // Migrate the old Tokyo/Sydney layout to the intended futures sessions.
      // Globex is a real 18:00 New York opening range; Sydney is not relabelled
      // because that would make the line mathematically incorrect.
      settings.showGlobex = true;
      settings.globexLabel = "Globex";
      settings.globexStart = "18:00";
      settings.globexEnd = "17:00";
      settings.globexColor = "#A461BB";
      settings.showSydney = false;
      if (persistedSettings.tokyoLabel === undefined || persistedSettings.tokyoLabel === "Tokyo") {
        settings.tokyoLabel = "Asia";
      }
    }
    const requestedDuration = Number(settings.durationMinutes);
    settings.durationMinutes = [15, 30, 45, 60].includes(requestedDuration)
      ? requestedDuration
      : 60;
    for (const definition of INDICATOR_NUMERIC_SETTINGS["ib-levels"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    if (!["solid", "dashed", "dotted"].includes(String(settings.developingLineStyle))) {
      settings.developingLineStyle = "solid";
    }
    if (!["solid", "dashed", "dotted"].includes(String(settings.fixedLineStyle))) {
      settings.fixedLineStyle = "dashed";
    }
    return {
      ...normalizedInstance,
      settings: { ...settings, initialBalanceSettingsVersion: 2 },
    };
  }
  if (normalizedInstance.indicatorId !== "cumulative-volume-delta") return normalizedInstance;
  const settings = normalizedInstance.settings ?? {};
  if (
    Number(settings.cvdSettingsVersion) >= 4
    && !("periodMode" in settings)
    && !("periodValue" in settings)
    && !("sessionStartHour" in settings)
  ) return normalizedInstance;
  const standardSettings = { ...settings };
  delete standardSettings.periodMode;
  delete standardSettings.periodValue;
  delete standardSettings.sessionStartHour;
  return {
    ...normalizedInstance,
    settings: {
      ...standardSettings,
      displayStyle: typeof settings.displayStyle === "string" ? settings.displayStyle : "candles",
      useThemeColors: typeof settings.useThemeColors === "boolean" ? settings.useThemeColors : true,
      cvdSettingsVersion: 4,
    },
  };
};

export const clonePaneIndicatorState = (state: Record<string, ChartIndicatorInstance[]>) =>
  Object.fromEntries(
    Object.entries(state).map(([paneId, instances]) => [
      paneId,
      instances.map((instance) => ({
        ...instance,
        settings: instance.settings ? { ...instance.settings } : undefined,
      })),
    ]),
  );

/**
 * Selecting an account theme is a global visual action. Existing indicator
 * instances may contain a historic `useThemeColors: false` snapshot, so link
 * them back to the active palette at the moment the theme changes. Users can
 * still customise an indicator again afterwards.
 */
export const linkPaneIndicatorStateToTheme = (state: Record<string, ChartIndicatorInstance[]>) =>
  Object.fromEntries(
    Object.entries(state).map(([paneId, instances]) => [
      paneId,
      instances.map((instance) => {
        const preserveBounceOverride = instance.indicatorId === "bounce-levels"
          && instance.settings?.useThemeColors === false;
        return {
          ...instance,
          settings: {
            ...(instance.settings ?? {}),
            useThemeColors: preserveBounceOverride ? false : true,
          },
        };
      }),
    ]),
  );

export function linkStoredPaneIndicatorsToTheme() {
  if (typeof window === "undefined") return;
  for (const key of ["kwantdesk-chart-indicators", "olisa-chart-pane-indicators"]) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      const linked = linkPaneIndicatorStateToTheme(normalizePaneIndicatorState(JSON.parse(raw)));
      window.localStorage.setItem(key, JSON.stringify(linked));
    } catch {
      // A malformed legacy indicator snapshot is ignored by the normal loader too.
    }
  }
}

export const normalizePaneIndicatorState = (value: unknown): Record<string, ChartIndicatorInstance[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([paneId, instances]) => [
      paneId,
      Array.isArray(instances)
        ? instances
          .filter((instance): instance is ChartIndicatorInstance =>
            Boolean(
              instance
              && typeof instance === "object"
              && "indicatorId" in instance,
            ))
          .map(normalizeStoredIndicator)
          .filter((instance) => LIVE_CHART_INDICATOR_IDS.has(instance.indicatorId))
        : [],
    ]),
  );
};
