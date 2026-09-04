import type { ChartSettings } from "@/lib/chartSettings";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { DEFAULT_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";
import { VOLUME_PROFILE_GRADIENT_OFF } from "@/lib/volumeProfileGradients";
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
import {
  DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS,
  normalizeSpeedOfTapeInstantSettings,
} from "@/lib/speedOfTapeInstant";
import { defaultIndicatorPlotColors, visibleIndicatorTheme } from "@/lib/indicatorPlotColors";
import { normalizeExpectedMoveSettings } from "@/lib/expectedMove";
import {
  DEFAULT_UNFINISHED_AUCTION_SETTINGS,
  UNFINISHED_AUCTION_SETTINGS_VERSION,
  normalizeUnfinishedAuctionSettings,
} from "@/lib/unfinishedAuction";
import {
  BAR_POC_SETTINGS_VERSION,
  DEFAULT_BAR_POC_SETTINGS,
  normalizeBarPocSettings,
} from "@/lib/barPocIndicator";
import { DEFAULT_DYNAMIC_POC_SETTINGS, DYNAMIC_POC_SETTINGS_VERSION, normalizeDynamicPocSettings } from "@/lib/dynamicPoc";
import { DEFAULT_RATIO_HIGHLIGHT_SETTINGS, normalizeRatioHighlightSettings, RATIO_HIGHLIGHT_SETTINGS_VERSION } from "@/lib/ratioHighlight";
import { DEFAULT_STOP_SPOTTER_SETTINGS, normalizeStopSpotterSettings, STOP_SPOTTER_SETTINGS_VERSION } from "@/lib/stopSpotter";
import {
  CUMULATIVE_ICEBERG_STOP_SETTINGS_VERSION,
  DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS,
  normalizeCumulativeIcebergStopSettings,
} from "@/lib/cumulativeIcebergStop";
import {
  BOOK_SPEED_SETTINGS_VERSION,
  DEFAULT_BOOK_SPEED_SETTINGS,
  normalizeBookSpeedSettings,
} from "@/lib/bookSpeed";
import {
  DEEP_DELTA_SETTINGS_VERSION,
  DEFAULT_DEEP_DELTA_SETTINGS,
  normalizeDeepDeltaSettings,
} from "@/lib/deepDelta";
import { DEEP_WALL_SETTINGS_VERSION, DEFAULT_DEEP_WALL_SETTINGS, normalizeDeepWallSettings } from "@/lib/deepWall";
import {
  DEEP_V_TRACKER_SETTINGS_VERSION,
  DEFAULT_DEEP_V_TRACKER_SETTINGS,
  normalizeDeepVTrackerSettings,
} from "@/lib/deepVTracker";
import {
  DEEP_PROFILE_SWING_SETTINGS_VERSION,
  DEFAULT_DEEP_PROFILE_SWING_SETTINGS,
  normalizeDeepProfileSwingSettings,
} from "@/lib/deepProfileSwing";
import {
  DEEP_PROFILE_VALUES_SETTINGS_VERSION,
  DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
  normalizeDeepProfileValuesSettings,
} from "@/lib/deepProfileValues";

export const LIVE_CHART_INDICATOR_IDS = new Set([
  "gamma-environment",
  "vix-environment",
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
  "unfinished-auction",
  "bar-poc-indicator",
  "dynamic-poc",
  "ratio-highlight",
  "stop-spotter",
  "cumulative-iceberg-stop",
  "book-speed",
  "deep-delta",
  "deep-wall",
  "deep-v-tracker",
  "deep-profile-swing",
  "deep-profile-values",
  "cumulative-volume-delta",
  "cvd-divergence",
  "pulling-stacking",
  "absorption-detector",
  "stacked-imbalance-suite",
  "iceberg-refresh-detector",
  "liquidity-stop-sweep-detector",
  "poc-auction-suite",
  "tape-speed-order-flow-burst",
  "speed-of-tape-instant",
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
  "composite-volume-profile",
  "custom-draw-on-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
  "sessions",
  "session-highs-lows",
  "ib-levels",
  "big-trades",
  "deep-m-effort-nq",
  "depth-of-market",
  "mini-dom",
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
  "composite-volume-profile",
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

/** The most daily profiles a chart will draw, whatever is asked for. */
export const MAXIMUM_DAILY_VOLUME_PROFILES = 12;
/** What a chart draws when the trader has not chosen, unchanged from before. */
export const DEFAULT_DAILY_VOLUME_PROFILE_COUNT = 6;

/**
 * How many daily profiles to draw - DeepChart's "Number of profile".
 *
 * The setting has been stored and migrated since the profile dialog was built
 * and read by nothing: the trading-date list was sliced to a hard six. So the
 * value persisted, survived reloads, and moved nothing on the chart.
 *
 * Zero means "the standing default" rather than "none", which is what every
 * saved chart already carries. The ceiling is real work - each profile is its
 * own request per session window - and the chart cannot draw more days than it
 * has candles for, so asking for twelve on a short history simply yields what
 * is there.
 */
export function resolveDailyVolumeProfileCount(value: unknown): number {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_DAILY_VOLUME_PROFILE_COUNT;
  return Math.min(MAXIMUM_DAILY_VOLUME_PROFILES, numeric);
}

export const INDICATOR_NUMERIC_SETTINGS: Record<string, IndicatorNumericSetting[]> = {
  "stop-spotter": [
    { key: "minimumDeltaPercent", label: "Minimum delta (%)", defaultValue: 25, min: 0, max: 100, step: 1 },
    { key: "minimumVolume", label: "Minimum volume", defaultValue: 1500, min: 0, max: 1000000, step: 50 },
    { key: "minimumVolumeIncrease", label: "Minimum volume increase", defaultValue: 500, min: 0, max: 1000000, step: 50 },
    { key: "minimumBodyTicks", label: "Minimum body ticks", defaultValue: 6, min: 2, max: 100, step: 1 },
    { key: "minimumPriceTicksIncrease", label: "Minimum price ticks increase", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "minimumHorizontalDelta", label: "Minimum horizontal delta", defaultValue: 60, min: 0, max: 100000, step: 10 },
    { key: "minimumImbalancePercent", label: "Minimum imbalance (%)", defaultValue: 200, min: 100, max: 1000, step: 25 },
    { key: "minimumImbalanceCount", label: "Minimum consecutive imbalances", defaultValue: 2, min: 1, max: 20, step: 1 },
    { key: "secondsToClose", label: "Seconds to close", defaultValue: 15, min: 0, max: 300, step: 1 },
    { key: "maximumLoss", label: "Contract calculation maximum loss", defaultValue: 500, min: 0, max: 100000, step: 50 },
    { key: "tickValueDivider", label: "Contract tick value divider", defaultValue: 1, min: 1, max: 100, step: 0.25 },
    { key: "contractFontSize", label: "Contract calculation font size", defaultValue: 10, min: 6, max: 30, step: 0.2 },
    { key: "contractTickOffset", label: "Contract calculation tick offset", defaultValue: 2, min: 0, max: 500, step: 1 },
    { key: "lineWidth", label: "Marker line width", defaultValue: 2, min: 1, max: 8, step: 1 },
  ],
  "cumulative-iceberg-stop": [
    { key: "filterMin", label: "Filter minimum", defaultValue: 1, min: 0, max: 10000000, step: 1 },
    { key: "filterMax", label: "Filter maximum (0 = no maximum)", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "displayParameter", label: "Display parameter", defaultValue: 1, min: 1, max: 86400, step: 1 },
    { key: "lineWidth", label: "Line width", defaultValue: 2, min: 1, max: 4, step: 1 },
    { key: "alertStopThreshold", label: "Stop alert threshold", defaultValue: 100, min: 0, max: 10000000, step: 1 },
    { key: "alertIcebergThreshold", label: "Iceberg alert threshold", defaultValue: 100, min: 0, max: 10000000, step: 1 },
    { key: "paneHeight", label: "Pane height", defaultValue: 190, min: 120, max: 520, step: 1 },
  ],
  "book-speed": [
    { key: "parameterValue", label: "Parameter value", defaultValue: 10, min: 1, max: 3600, step: 1 },
    { key: "averageLength", label: "Average length", defaultValue: 10, min: 1, max: 1000, step: 1 },
    { key: "markerValue", label: "Marker value", defaultValue: 10, min: 0, max: 100000, step: 1 },
    { key: "lineWidth", label: "Histogram and average width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "historyBuckets", label: "History buckets", defaultValue: 360, min: 20, max: 10000, step: 10 },
    { key: "paneHeight", label: "Pane height", defaultValue: 190, min: 120, max: 520, step: 1 },
  ],
  "deep-delta": [
    { key: "barGrouping", label: "Bars grouped", defaultValue: 4, min: 1, max: 100, step: 1 },
    { key: "range1Minimum", label: "Range 1 minimum", defaultValue: 1, min: 0, max: 10000000, step: 1 },
    { key: "range1Maximum", label: "Range 1 maximum · 0 is unlimited", defaultValue: 10, min: 0, max: 10000000, step: 1 },
    { key: "range2Minimum", label: "Range 2 minimum", defaultValue: 11, min: 0, max: 10000000, step: 1 },
    { key: "range2Maximum", label: "Range 2 maximum · 0 is unlimited", defaultValue: 20, min: 0, max: 10000000, step: 1 },
    { key: "range3Minimum", label: "Range 3 minimum", defaultValue: 21, min: 0, max: 10000000, step: 1 },
    { key: "range3Maximum", label: "Range 3 maximum · 0 is unlimited", defaultValue: 30, min: 0, max: 10000000, step: 1 },
    { key: "range4Minimum", label: "Range 4 minimum", defaultValue: 31, min: 0, max: 10000000, step: 1 },
    { key: "range4Maximum", label: "Range 4 maximum · 0 is unlimited", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "level1Value", label: "Threshold level 1", defaultValue: 1000, min: 0, max: 10000000, step: 1 },
    { key: "level1LineWidth", label: "Threshold 1 line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "level2Value", label: "Threshold level 2", defaultValue: 1500, min: 0, max: 10000000, step: 1 },
    { key: "level2LineWidth", label: "Threshold 2 line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "markerMinimumDelta", label: "Struggle marker minimum delta", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "lineWidth", label: "Delta body and shadow width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
  ],
  "deep-wall": [
    { key: "minimumTickBreakout", label: "Minimum tick breakout", defaultValue: 1, min: 0, max: 2000, step: 1 },
    { key: "minimumDeltaPercent", label: "Minimum delta (%)", defaultValue: 70, min: 0, max: 100, step: 1 },
    { key: "minimumPerBarVolume", label: "Minimum per bar volume", defaultValue: 20, min: 0, max: 10000000, step: 1 },
    { key: "minimumClusterVolume", label: "Minimum cluster volume", defaultValue: 300, min: 0, max: 10000000, step: 1 },
    { key: "tickGrouping", label: "Tick grouping", defaultValue: 1, min: 1, max: 2000, step: 1 },
    { key: "highestLowestMinimumBars", label: "Highest/lowest minimum bars", defaultValue: 2, min: 2, max: 100, step: 1 },
    { key: "highestLowestNearnessBars", label: "Highest/lowest nearness bars", defaultValue: 50, min: 1, max: 1000, step: 1 },
    { key: "markerWidthBars", label: "Marker width (bars)", defaultValue: 1.6, min: 0.25, max: 12, step: 0.25 },
    { key: "lineWidth", label: "Marker line width", defaultValue: 2, min: 0.5, max: 8, step: 0.5 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 92, min: 0, max: 100, step: 1 },
  ],
  "deep-v-tracker": [
    { key: "controlLineWidth", label: "Control level line width", defaultValue: 2, min: 0, max: 8, step: 0.5 },
    { key: "extremeLineWidth", label: "Extreme level line width", defaultValue: 1, min: 0, max: 8, step: 0.5 },
    { key: "textSize", label: "Level label size", defaultValue: 10, min: 6, max: 50, step: 0.5 },
    { key: "projectionBars", label: "Number of bars", defaultValue: 20, min: 1, max: 5000, step: 1 },
    { key: "patternOpacity", label: "Pattern fill opacity (%)", defaultValue: 32, min: 0, max: 100, step: 1 },
  ],
  "deep-profile-swing": [
    { key: "absoluteReversal", label: "Absolute reversal", defaultValue: 10, min: 0.01, max: 100000, step: 0.01 },
    { key: "reversalTicks", label: "Reversal ticks / highest-lowest lookback", defaultValue: 20, min: 1, max: 100000, step: 1 },
    { key: "leftBars", label: "Left bars", defaultValue: 3, min: 1, max: 500, step: 1 },
    { key: "rightBars", label: "Right bars", defaultValue: 3, min: 1, max: 500, step: 1 },
    { key: "stopAbsoluteReversal", label: "Stop swing absolute reversal", defaultValue: 5, min: 0.01, max: 100000, step: 0.01 },
    { key: "stopReversalTicks", label: "Stop swing reversal ticks / lookback", defaultValue: 10, min: 1, max: 100000, step: 1 },
    { key: "stopLeftBars", label: "Stop swing left bars", defaultValue: 2, min: 1, max: 500, step: 1 },
    { key: "stopRightBars", label: "Stop swing right bars", defaultValue: 2, min: 1, max: 500, step: 1 },
    { key: "swingMinTicks", label: "VWAP swing minimum ticks", defaultValue: 12, min: 1, max: 100000, step: 1 },
    { key: "swingMaxTicks", label: "VWAP swing maximum ticks", defaultValue: 240, min: 1, max: 1000000, step: 1 },
    { key: "vwapBreakTicks", label: "VWAP break ticks", defaultValue: 8, min: 1, max: 100000, step: 1 },
    { key: "filterMin", label: "Minimum execution size", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "filterMax", label: "Maximum execution size · 0 is unlimited", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "autoGroupFactor", label: "Automatic group factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "groupTicks", label: "Manual grouping ticks", defaultValue: 4, min: 1, max: 500, step: 1 },
    { key: "valueAreaPercent", label: "Value area (%)", defaultValue: 68, min: 1, max: 100, step: 1 },
    { key: "maxProfiles", label: "Profiles to show", defaultValue: 12, min: 1, max: 100, step: 1 },
    { key: "profileWidth", label: "Profile width (%)", defaultValue: 34, min: 1, max: 100, step: 1 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 68, min: 0, max: 100, step: 1 },
    { key: "lineWidth", label: "Level line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
  ],
  "deep-profile-values": [
    { key: "lengthValue", label: "Length value", defaultValue: 1, min: 1, max: 1000000, step: 1 },
    { key: "filterMin", label: "Minimum execution size", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "filterMax", label: "Maximum execution size · 0 is unlimited", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "groupTicks", label: "Manual grouping ticks", defaultValue: 4, min: 1, max: 500, step: 1 },
    { key: "numberOfProfiles", label: "Number of profiles", defaultValue: 6, min: 1, max: 250, step: 1 },
    { key: "valueAreaPercent", label: "Value area (%)", defaultValue: 68, min: 1, max: 100, step: 1 },
    { key: "sessionStartMinutes", label: "Session start · exchange minutes", defaultValue: 510, min: 0, max: 1439, step: 1 },
    { key: "sessionEndMinutes", label: "Session end · exchange minutes", defaultValue: 915, min: 0, max: 1439, step: 1 },
    { key: "developingPocStartMinutes", label: "Developing POC start · session minutes", defaultValue: 0, min: 0, max: 1439, step: 1 },
    { key: "shiftedPocTicks", label: "Shifted POC grouping ticks", defaultValue: 1, min: 1, max: 500, step: 1 },
    { key: "shiftedPocOpacity", label: "Shifted POC opacity (%)", defaultValue: 68, min: 0, max: 100, step: 1 },
    { key: "peakValleySensitivity", label: "Peak / valley sensitivity", defaultValue: 40, min: 0, max: 100, step: 1 },
    { key: "peakMinimumVolumePercent", label: "Peak minimum volume (%)", defaultValue: 0, min: 0, max: 100, step: 1 },
    { key: "valleyMaximumVolumePercent", label: "Valley maximum volume (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
    { key: "vwapBand1", label: "VWAP band 1 · standard deviations", defaultValue: 1, min: 0, max: 20, step: 0.25 },
    { key: "vwapBand2", label: "VWAP band 2 · standard deviations", defaultValue: 2, min: 0, max: 20, step: 0.25 },
    { key: "vwapBand3", label: "VWAP band 3 · standard deviations", defaultValue: 0, min: 0, max: 20, step: 0.25 },
    { key: "lineWidth", label: "Level line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
  ],
  "ratio-highlight": [
    { key: "minRatio", label: "Minimum ratio", defaultValue: 10, min: 0, max: 100, step: 0.25 },
    { key: "maxRatio", label: "Maximum ratio (0 = no maximum)", defaultValue: 20, min: 0, max: 100, step: 0.25 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 70, min: 0, max: 100, step: 1 },
  ],
  "dynamic-poc": [
    { key: "periodValue", label: "Period value", defaultValue: 20, min: 1, max: 10000, step: 1 },
    { key: "firstEnvelope", label: "First envelope deviation", defaultValue: 1, min: 0.25, max: 100, step: 0.25 },
    { key: "secondEnvelope", label: "Second envelope deviation", defaultValue: 2, min: 0.25, max: 100, step: 0.25 },
    { key: "thirdEnvelope", label: "Third envelope deviation", defaultValue: 3, min: 0.25, max: 100, step: 0.25 },
    { key: "lineWidth", label: "VPOC line width", defaultValue: 2, min: 0.5, max: 8, step: 0.5 },
    { key: "envelopeLineWidth", label: "Envelope line width", defaultValue: 1, min: 0.5, max: 8, step: 0.5 },
  ],
  "bar-poc-indicator": [
    { key: "daysToLoad", label: "Days to load", defaultValue: 5, min: 1, max: 365, step: 1 },
    { key: "filterMin", label: "Minimum execution size", defaultValue: 0, min: 0, max: 1000000, step: 1 },
    { key: "filterMax", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "autoStdDev", label: "Automatic filter standard deviations", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "manualMinimumVolume", label: "Manual minimum POC value", defaultValue: 0, min: 0, max: 10000000, step: 50 },
    { key: "rthAutoStdDev", label: "RTH automatic standard deviations", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "rthManualMinimumVolume", label: "RTH manual minimum POC value", defaultValue: 0, min: 0, max: 10000000, step: 50 },
    { key: "rthStartMinutes", label: "Custom RTH start (exchange minutes)", defaultValue: 510, min: 0, max: 1439, step: 1 },
    { key: "rectangleLineWidth", label: "POC rectangle line width", defaultValue: 1, min: 1, max: 8, step: 1 },
    { key: "backgroundOpacity", label: "POC background opacity (%)", defaultValue: 22, min: 0, max: 100, step: 1 },
    { key: "extensionLineWidth", label: "Extension line width", defaultValue: 1, min: 1, max: 8, step: 1 },
    { key: "maxBarsExtension", label: "Maximum extension bars (0 = unlimited)", defaultValue: 0, min: 0, max: 100000, step: 1 },
    { key: "tickMarginBreakout", label: "Close breakout tick margin", defaultValue: 0, min: 0, max: 10000, step: 1 },
    { key: "durationFontSize", label: "Duration text size", defaultValue: 9, min: 6, max: 50, step: 0.2 },
  ],
  "unfinished-auction": [
    { key: "daysToLoad", label: "Days to load", defaultValue: 5, min: 1, max: 365, step: 1 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 8, step: 1 },
    { key: "opacity", label: "Background opacity (%)", defaultValue: 22, min: 0, max: 100, step: 1 },
    { key: "manualMinimumVolume", label: "Manual minimum volume", defaultValue: 0, min: 0, max: 10000000, step: 1 },
    { key: "customStartMinutes", label: "Custom session start (exchange minutes)", defaultValue: 510, min: 0, max: 1439, step: 1 },
    { key: "customEndMinutes", label: "Custom session end (exchange minutes)", defaultValue: 900, min: 0, max: 1439, step: 1 },
  ],
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
    // Every divergence in the window is marked and each one stays, so the
    // lookback is simply how much history is scanned.
    { key: "lookbackBars", label: "Lookback (bars)", defaultValue: 300, min: 20, max: 2000, step: 10 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
  ],
  "speed-of-tape-instant": [
    { key: "filterMin", label: "Filter minimum", defaultValue: 1, min: 0, max: 1000000, step: 1 },
    { key: "filterMax", label: "Filter maximum · 0 is unlimited", defaultValue: 0, min: 0, max: 1000000, step: 1 },
    { key: "numberOfSeconds", label: "Number of seconds", defaultValue: 10, min: 1, max: 3600, step: 1 },
    { key: "barsToShow", label: "Bars to show", defaultValue: 3, min: 1, max: 20, step: 1 },
    { key: "scaleMinValue", label: "Scale minimum value", defaultValue: 0, min: 0, max: 1000000000, step: 1 },
    { key: "lineWidth", label: "Candle line width", defaultValue: 1, min: 0.5, max: 6, step: 0.5 },
    { key: "textSize", label: "Text size", defaultValue: 10, min: 6, max: 24, step: 1 },
    { key: "standardDeviationLookback", label: "Standard deviation lookback", defaultValue: 60, min: 10, max: 500, step: 1 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
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
    { key: "opacity", label: "Opacity", defaultValue: 100, min: 0, max: 100, step: 1 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "opacity", label: "Overlay opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "opacity", label: "Circle opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "bandOpacity", label: "Active line brightness (%)", defaultValue: 100, min: 55, max: 100, step: 1 },
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
    { key: "opacity", label: "Heat opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "barOpacity", label: "Bar opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
    { key: "borderOpacity", label: "Border opacity (%)", defaultValue: 100, min: 0, max: 100, step: 1 },
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
    { key: "opacity", label: "Map opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "lineOpacity", label: "Exposure field opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
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
    { key: "opacity", label: "Line opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
    { key: "labelFontSize", label: "Label font size", defaultValue: 10, min: 8, max: 16, step: 1 },
  ],
  "delta-highlight": [
    { key: "minValue", label: "Minimum absolute delta (%)", defaultValue: 50, min: 0, max: 100, step: 1 },
    { key: "maxValue", label: "Maximum absolute delta (%) · 0 = unlimited", defaultValue: 0, min: 0, max: 100, step: 1 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
  ],
  // Data Settings / Tick Grouping / Plot Settings, matching the reference
  // desktop tracker's fields, defaults and units one for one.
  "imbalance-tracker": [
    { key: "minimumPercent", label: "Minimum %", defaultValue: 400, min: 0, max: 10000, step: 25 },
    { key: "minimumDelta", label: "Minimum Delta Value", defaultValue: 0, min: 0, max: 1000000, step: 1 },
    { key: "minimumConsecutive", label: "Min. Num. of Consecutive", defaultValue: 3, min: 1, max: 50, step: 1 },
    { key: "tickGroupingTicks", label: "Tick grouping ticks", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "extendedBars", label: "Num. Extended Bars", defaultValue: 10, min: 1, max: 5000, step: 1 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 0.5, max: 5, step: 0.5 },
    { key: "zonesExtraTicks", label: "Zones extra ticks", defaultValue: 0, min: 0, max: 100, step: 1 },
    { key: "opacity", label: "Zone opacity (%)", defaultValue: 100, min: 5, max: 100, step: 1 },
  ],
  "imbalance-rejector": [
    { key: "minimumPercent", label: "Minimum imbalance (%)", defaultValue: 300, min: 100, max: 10000, step: 25 },
    { key: "comparisonDepth", label: "Diagonal comparison depth", defaultValue: 1, min: 1, max: 50, step: 1 },
    { key: "lookbackPeriod", label: "Swing lookback bars", defaultValue: 5, min: 1, max: 500, step: 1 },
    { key: "tickOffset", label: "Marker offset (ticks)", defaultValue: 2, min: 0, max: 100, step: 1 },
    { key: "markerSize", label: "Marker size", defaultValue: 8, min: 3, max: 24, step: 1 },
    { key: "markerThickness", label: "Marker thickness", defaultValue: 2, min: 0.5, max: 6, step: 0.5 },
    { key: "opacity", label: "Marker opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
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
  "mini-dom": [
    { key: "widthPx", label: "Ladder width (pixels)", defaultValue: 95, min: 40, max: 420, step: 2 },
    { key: "rightGapPx", label: "Gap from the price scale (px)", defaultValue: 2, min: 0, max: 60, step: 1 },
    // Band spacing, not row count. Resting size is summed into price bands so
    // the bars are thick enough to carry their contract count; asking for a
    // row per tick gives hairlines with no room for a number.
    // Granularity. Lower packs more price levels in; the bar height floor
    // keeps them readable, and the contract counts drop out on their own once
    // the rows are too tight to hold one.
    { key: "levelSpacingPx", label: "Spacing between price levels (px) · lower is finer", defaultValue: 10, min: 3, max: 60, step: 1 },
    { key: "barOpacity", label: "Bar opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
    { key: "backgroundOpacity", label: "Panel background (%) · 0 = transparent", defaultValue: 0, min: 0, max: 100, step: 1 },
    { key: "fontSize", label: "Contract text (px)", defaultValue: 8, min: 6, max: 14, step: 1 },
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
    { key: "minimumBars", label: "Minimum bars before a signal", defaultValue: 20, min: 12, max: 200, step: 1 },
    { key: "minimumDeltaPercent", label: "Minimum absolute delta (%)", defaultValue: 20, min: 0, max: 100, step: 1 },
    { key: "maximumDeltaPercent", label: "Maximum absolute delta (%)", defaultValue: 100, min: 1, max: 100, step: 1 },
    { key: "maximumDeltaEffort", label: "Maximum delta effort · 0 = unlimited", defaultValue: 0, min: 0, max: 100000, step: 1 },
    { key: "averageLength", label: "Effort average length", defaultValue: 21, min: 2, max: 200, step: 1 },
    { key: "entryZoneRangePercent", label: "Entry zone range (%)", defaultValue: 28, min: 5, max: 100, step: 1 },
    { key: "zoneBars", label: "Maximum zone extension (bars)", defaultValue: 22, min: 4, max: 120, step: 1 },
    { key: "zoneOpacity", label: "Zone opacity (%)", defaultValue: 20, min: 1, max: 100 },
    { key: "zoneLineWidth", label: "Zone border width", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "maLineWidth", label: "Moving average width", defaultValue: 2, min: 1, max: 4 },
  ],
  "big-trades": [
    { key: "daysToLoad", label: "Days to load", defaultValue: 1, min: 1, max: 30 },
    { key: "manualFilter", label: "Manual minimum trade size", defaultValue: 30, min: 1, max: 5000, step: 1 },
    { key: "maximumFilter", label: "Maximum trade size · 0 = unlimited", defaultValue: 0, min: 0, max: 1000000 },
    // Day and overnight are measured separately, so a genuinely large
    // overnight print registers instead of being buried by day-session volume.
    { key: "rthManualFilter", label: "RTH minimum trade size", defaultValue: 30, min: 1, max: 5000, step: 1 },
    { key: "rthStandardDeviation", label: "RTH marker deviation scale", defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
    { key: "cappingMaxVolume", label: "Cap size at · 0 = no cap", defaultValue: 0, min: 0, max: 1000000 },
    { key: "clusterWindowMs", label: "Cluster window (milliseconds)", defaultValue: 100, min: 0, max: 10000 },
    { key: "clusterPriceTicks", label: "Cluster price distance (ticks)", defaultValue: 0, min: 0, max: 100 },
    { key: "maxMarkersPerBar", label: "Maximum markers per chart bar", defaultValue: 50, min: 1, max: 50 },
    { key: "standardDeviation", label: "Marker standard deviation scale", defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
    { key: "minimumOpacity", label: "Minimum opacity (%)", defaultValue: 25, min: 0, max: 100 },
    { key: "maximumOpacity", label: "Maximum opacity (%)", defaultValue: 90, min: 0, max: 100 },
    { key: "minimumSize", label: "Minimum marker size", defaultValue: 6, min: 1, max: 80 },
    { key: "maximumSize", label: "Maximum marker size", defaultValue: 32, min: 1, max: 160 },
    // 1 = always. Shrinking the markers used to silently erase the contract
    // counts, so the number now stays by default and hiding it is opt-in.
    { key: "labelMinSize", label: "Show number from marker size", defaultValue: 1, min: 1, max: 160 },
    { key: "deepMinimumTradeSize", label: "Deep contracts minimum trade size", defaultValue: 30, min: 1, max: 5000, step: 1 },
    { key: "deepBoxTickRange", label: "Deep contracts box height (ticks)", defaultValue: 4, min: 1, max: 100, step: 1 },
    { key: "deepTickMargin", label: "Deep contracts cluster margin (ticks)", defaultValue: 1, min: 0, max: 100, step: 1 },
    { key: "deepProjectionBars", label: "Deep contracts projection (bars)", defaultValue: 22, min: 1, max: 600, step: 1 },
    { key: "deepOpacity", label: "Deep contracts box opacity (%)", defaultValue: 20, min: 1, max: 100, step: 1 },
    { key: "deepLineWidth", label: "Deep contracts border width", defaultValue: 1, min: 0, max: 4, step: 0.5 },
  ],
  sessions: [
    { key: "lookbackDays", label: "Lookback (days)", defaultValue: 30, min: 1, max: 365 },
    { key: "fillOpacity", label: "Background opacity (%)", defaultValue: 10, min: 0, max: 100 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 100, min: 0, max: 100 },
    { key: "borderWidth", label: "Border width", defaultValue: 1, min: 0, max: 4, step: 1 },
  ],
  "session-highs-lows": [
    { key: "lookbackDays", label: "Session search lookback (days)", defaultValue: 30, min: 7, max: 365 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 100, min: 5, max: 100 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  ],
  "ib-levels": [
    { key: "lookbackDays", label: "Lookback (days)", defaultValue: 7, min: 1, max: 30 },
    { key: "lineOpacity", label: "Line opacity (%)", defaultValue: 100, min: 5, max: 100 },
    { key: "lineWidth", label: "Line width", defaultValue: 1, min: 1, max: 4, step: 1 },
  ],
  "kwant-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
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
    { key: "minimumSinglePrintTicks", label: "Minimum Single Print height (ticks) · above ~4 this hides interior low-volume prints and leaves only the long tails", defaultValue: 1, min: 1, max: 40, step: 1 },
    { key: "singlePrintMaxTpoCount", label: "Single Print thinness (1 = strict single print, higher shows thicker low-volume shelves)", defaultValue: 1, min: 1, max: 10, step: 1 },
    { key: "singlePrintStepDown", label: "Single Print step down (marks a row this many TPOs narrower than its neighbours; 0 = strict only)", defaultValue: 3, min: 0, max: 20, step: 1 },
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
    { key: "singlePrintFillOpacity", label: "Single Print fill opacity (%)", defaultValue: 60, min: 0, max: 100, step: 1 },
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
    { key: "minimumSinglePrintTicks", label: "Minimum Single Print height (ticks) · above ~4 this hides interior low-volume prints and leaves only the long tails", defaultValue: 1, min: 1, max: 40, step: 1 },
    { key: "singlePrintMaxTpoCount", label: "Single Print thinness (1 = strict single print, higher shows thicker low-volume shelves)", defaultValue: 1, min: 1, max: 10, step: 1 },
    { key: "singlePrintStepDown", label: "Single Print step down (marks a row this many TPOs narrower than its neighbours; 0 = strict only)", defaultValue: 3, min: 0, max: 20, step: 1 },
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
    { key: "singlePrintFillOpacity", label: "Single Print fill opacity (%)", defaultValue: 60, min: 0, max: 100, step: 1 },
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
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "composite-volume-profile": [
    { key: "compositeLengthValue", label: "Composite length", defaultValue: 500, min: 1, max: 100000, step: 1 },
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "custom-draw-on-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of selected range)", defaultValue: 45, min: 0, max: 100, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "ask-bid-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 28, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "delta-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 100, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "delta-bar": [
    // Only read when the study is docked to a side; in its lower pane it is
    // still the plain per-bar histogram it has always been.
    { key: "ladderWidthPx", label: "Ladder reach (pixels)", defaultValue: 150, min: 40, max: 420, step: 2 },
    { key: "ladderEdgeGapPx", label: "Gap from the pane edge (px)", defaultValue: 2, min: 0, max: 60, step: 1 },
    { key: "ladderLevelSpacingPx", label: "Spacing between price levels (px)", defaultValue: 22, min: 8, max: 60, step: 1 },
    { key: "ladderOpacity", label: "Spike opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
    { key: "ladderFontSize", label: "Delta text (px)", defaultValue: 8, min: 6, max: 14, step: 1 },
  ],
  "cumulative-volume-delta": [
    { key: "periodValue", label: "Period value", defaultValue: 1, min: 1, max: 100000, step: 1 },
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
    { key: "lineOpacity", label: "Rail opacity (%)", defaultValue: 100, min: 15, max: 100, step: 1 },
    { key: "fillOpacity", label: "Band fill opacity (%)", defaultValue: 3, min: 0, max: 4, step: 0.5 },
  ],
  "hedge-levels": [
    { key: "fillOpacity", label: "Band opacity (%)", defaultValue: 5, min: 1, max: 10, step: 1 },
    { key: "lineOpacity", label: "Border opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
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
    { key: "borderOpacity", label: "Zone border opacity (%)", defaultValue: 100, min: 10, max: 100, step: 1 },
  ],
  "moving-average": [{ key: "length", label: "Length", defaultValue: 20, min: 1, max: 1000 }],
  "rolling-vwap": [
    { key: "periodValue", label: "Rolling period", defaultValue: 60, min: 1, max: 100000 },
    { key: "lineWidth", label: "VWAP line width", defaultValue: 2, min: 1, max: 4 },
    { key: "bandLineWidth", label: "Envelope line width", defaultValue: 1, min: 1, max: 4 },
    { key: "band1", label: "Band 1 σ", defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    { key: "band2", label: "Band 2 σ", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "band3", label: "Band 3 σ", defaultValue: 3, min: 0.1, max: 10, step: 0.1 },
    { key: "band4", label: "Band 4 σ", defaultValue: 4, min: 0.1, max: 10, step: 0.1 },
    { key: "band5", label: "Band 5 σ", defaultValue: 5, min: 0.1, max: 10, step: 0.1 },
  ],
  vwap: [
    { key: "periodValue", label: "Period value", defaultValue: 1, min: 1, max: 100000 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
    { key: "lineWidth", label: "VWAP line width", defaultValue: 2, min: 1, max: 4 },
    { key: "bandLineWidth", label: "Envelope line width", defaultValue: 1, min: 1, max: 4 },
    { key: "band1", label: "Band 1", defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    { key: "band2", label: "Band 2", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "band3", label: "Band 3", defaultValue: 3, min: 0.1, max: 10, step: 0.1 },
    { key: "band4", label: "Band 4", defaultValue: 4, min: 0.1, max: 10, step: 0.1 },
    { key: "band5", label: "Band 5", defaultValue: 5, min: 0.1, max: 10, step: 0.1 },
  ],
  "vwap-envelopes": [
    { key: "periodValue", label: "Continuous period", defaultValue: 1, min: 1, max: 100000 },
    { key: "lineWidth", label: "VWAP line width", defaultValue: 2, min: 1, max: 4 },
    { key: "bandLineWidth", label: "Envelope line width", defaultValue: 1, min: 1, max: 4 },
    { key: "band1", label: "Band 1", defaultValue: 1, min: 0.1, max: 10, step: 0.1 },
    { key: "band2", label: "Band 2", defaultValue: 2, min: 0.1, max: 10, step: 0.1 },
    { key: "band3", label: "Band 3", defaultValue: 3, min: 0.1, max: 10, step: 0.1 },
    { key: "band4", label: "Band 4", defaultValue: 4, min: 0.1, max: 10, step: 0.1 },
    { key: "band5", label: "Band 5", defaultValue: 5, min: 0.1, max: 10, step: 0.1 },
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

/**
 * The chart theme as a STUDY has to show it.
 *
 * Several palettes pair two shades of one hue for up and down - brick against
 * maroon, orange against red-orange. That reads fine on candles, where the
 * body's position carries the meaning, and not at all on a delta histogram
 * where colour is the only signal: a rising and a falling CVD bar arrive the
 * same colour and the study looks like one block.
 *
 * `visibleIndicatorTheme` already resolves this, and the plot colours spread
 * in below already went through it - but every study that declares its own
 * directional keys then overwrote them with the RAW `theme.upColor`, which is
 * how CVD ended up back at one colour on exactly those palettes.
 *
 * Separating here instead means one place decides, and every `theme?.upColor`
 * below is the separated one. A palette whose sides are already far apart is
 * returned untouched, by identity, so Solar Flare keeps its orange against
 * blue exactly as its author chose.
 */
function sidedTheme(theme?: ChartSettings): ChartSettings | undefined {
  if (!theme) return theme;
  const grid = theme.gridColor ?? "#8A8F98";
  const background = theme.backgroundColor ?? "#000000";
  const borderUp = theme.borderUpColor ?? theme.upColor ?? "#4ADE80";
  const borderDown = theme.borderDownColor ?? theme.downColor ?? "#EF4444";
  const separate = (up: string, down: string) => {
    const visible = visibleIndicatorTheme({
      upColor: up,
      downColor: down,
      borderUpColor: borderUp,
      borderDownColor: borderDown,
      gridColor: grid,
      backgroundColor: background,
    });
    return { up: visible.positive, down: visible.negative };
  };
  const body = separate(theme.upColor ?? "#22C55E", theme.downColor ?? "#EF4444");
  /*
   * The outline pair is separated too, and separately.
   *
   * Studies split across both: CVD takes its delta bars from the body colours
   * and its volume bars from the outline ones. Fixing only the body left the
   * volume half of the same study still reading as one colour on the palettes
   * that pair two shades of a hue - which is most of what "the CVD is one
   * colour" actually was.
   */
  const outline = separate(borderUp, borderDown);
  if (
    body.up === theme.upColor && body.down === theme.downColor
    && outline.up === theme.borderUpColor && outline.down === theme.borderDownColor
  ) return theme;
  return {
    ...theme,
    upColor: body.up,
    downColor: body.down,
    borderUpColor: outline.up,
    borderDownColor: outline.down,
  };
}

export const defaultIndicatorSettings = (indicatorId: string, rawTheme?: ChartSettings) =>
  indicatorSettingsFromTheme(indicatorId, sidedTheme(rawTheme));

const indicatorSettingsFromTheme = (indicatorId: string, theme?: ChartSettings) => ({
  // One picker per plotted series, seeded from the chart theme so an untouched
  // study looks exactly as it did. Spread FIRST, so any indicator that already
  // declares its own colour keys below keeps them.
  ...defaultIndicatorPlotColors(indicatorId, visibleIndicatorTheme({
    upColor: theme?.upColor ?? "#22C55E",
    downColor: theme?.downColor ?? "#EF4444",
    borderUpColor: theme?.borderUpColor ?? theme?.upColor ?? "#4ADE80",
    borderDownColor: theme?.borderDownColor ?? theme?.downColor ?? "#EF4444",
    gridColor: theme?.gridColor ?? "#8A8F98",
    backgroundColor: theme?.backgroundColor ?? "#000000",
  })),
  ...(indicatorId === "zero-gamma-line" ? {
    // AUTO follows the chart's own options family (NQ -> NDX, ES -> SPX).
    // Naming a source pins the line to that chain instead.
    sourceTicker: "AUTO",
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
  ...(["vwap", "vwap-envelopes", "rolling-vwap"].includes(indicatorId) ? {
    source: "hlc3",
    periodMode: indicatorId === "rolling-vwap" ? "bars" : "days",
    envelopeMode: "standard-deviation",
    lineStyle: "solid",
    bandLineStyle: "dotted",
    band1Enabled: indicatorId !== "vwap",
    band2Enabled: indicatorId !== "vwap",
    band3Enabled: indicatorId !== "vwap",
    band4Enabled: false,
    band5Enabled: false,
    showCurrentValue: false,
    useThemeColors: true,
    vwapSettingsVersion: 2,
  } : {}),
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
  ...(indicatorId === "vix-environment" ? {
    position: "top-left",
    sourceSymbol: "VIX",
    showChange: true,
    showRange: true,
    showRank: true,
    showPercentile: true,
    showFreshness: true,
    showSource: false,
    useThemeColors: false,
    calmColor: "#22C55E",
    normalColor: "#38BDF8",
    elevatedColor: "#F59E0B",
    highColor: "#F97316",
    extremeColor: "#EF4444",
    normalThreshold: 15,
    elevatedThreshold: 20,
    highThreshold: 25,
    extremeThreshold: 30,
    badgeScale: 1,
    vixEnvironmentSettingsVersion: 1,
  } : {}),
  ...(indicatorId === "pulling-stacking" ? {
    ...DEFAULT_PULLING_STACKING_SETTINGS,
    bidStackColor: theme?.upColor ?? DEFAULT_PULLING_STACKING_SETTINGS.bidStackColor,
    askStackColor: theme?.downColor ?? DEFAULT_PULLING_STACKING_SETTINGS.askStackColor,
    // Its partner followed the theme while this stayed a fixed amber, so on
    // any orange palette the two pull sides arrived the same colour.
    bidPullColor: theme?.borderDownColor ?? theme?.downColor ?? "#F59E0B",
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
  ...(indicatorId === "unfinished-auction" ? {
    ...DEFAULT_UNFINISHED_AUCTION_SETTINGS,
    badHighColor: theme?.downColor ?? DEFAULT_UNFINISHED_AUCTION_SETTINGS.badHighColor,
    badLowColor: theme?.upColor ?? DEFAULT_UNFINISHED_AUCTION_SETTINGS.badLowColor,
    schemaVersion: UNFINISHED_AUCTION_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "bar-poc-indicator" ? {
    ...DEFAULT_BAR_POC_SETTINGS,
    bidColor: theme?.downColor ?? DEFAULT_BAR_POC_SETTINGS.bidColor,
    askColor: theme?.upColor ?? DEFAULT_BAR_POC_SETTINGS.askColor,
    durationTextColor: theme?.borderUpColor ?? DEFAULT_BAR_POC_SETTINGS.durationTextColor,
    schemaVersion: BAR_POC_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "dynamic-poc" ? {
    ...DEFAULT_DYNAMIC_POC_SETTINGS,
    pocColor: theme?.upColor ?? DEFAULT_DYNAMIC_POC_SETTINGS.pocColor,
    firstEnvelopeColor: theme?.borderUpColor ?? DEFAULT_DYNAMIC_POC_SETTINGS.firstEnvelopeColor,
    secondEnvelopeColor: theme?.gridColor ?? DEFAULT_DYNAMIC_POC_SETTINGS.secondEnvelopeColor,
    thirdEnvelopeColor: theme?.downColor ?? DEFAULT_DYNAMIC_POC_SETTINGS.thirdEnvelopeColor,
    schemaVersion: DYNAMIC_POC_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "ratio-highlight" ? {
    ...DEFAULT_RATIO_HIGHLIGHT_SETTINGS,
    bidColor: theme?.downColor ?? DEFAULT_RATIO_HIGHLIGHT_SETTINGS.bidColor,
    askColor: theme?.upColor ?? DEFAULT_RATIO_HIGHLIGHT_SETTINGS.askColor,
    schemaVersion: RATIO_HIGHLIGHT_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "stop-spotter" ? {
    ...DEFAULT_STOP_SPOTTER_SETTINGS,
    buyColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_STOP_SPOTTER_SETTINGS.buyColor,
    sellColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_STOP_SPOTTER_SETTINGS.sellColor,
    contractBuyTextColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_STOP_SPOTTER_SETTINGS.contractBuyTextColor,
    contractSellTextColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_STOP_SPOTTER_SETTINGS.contractSellTextColor,
    contractBackgroundColor: theme?.backgroundColor ?? DEFAULT_STOP_SPOTTER_SETTINGS.contractBackgroundColor,
    schemaVersion: STOP_SPOTTER_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "cumulative-iceberg-stop" ? {
    ...DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS,
    icebergAskColor: theme?.downColor ?? DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS.icebergAskColor,
    icebergBidColor: theme?.upColor ?? DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS.icebergBidColor,
    stopBidColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS.stopBidColor,
    stopAskColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_CUMULATIVE_ICEBERG_STOP_SETTINGS.stopAskColor,
    schemaVersion: CUMULATIVE_ICEBERG_STOP_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "book-speed" ? {
    ...DEFAULT_BOOK_SPEED_SETTINGS,
    bidColor: theme?.upColor ?? DEFAULT_BOOK_SPEED_SETTINGS.bidColor,
    askColor: theme?.downColor ?? DEFAULT_BOOK_SPEED_SETTINGS.askColor,
    averageBidColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_BOOK_SPEED_SETTINGS.averageBidColor,
    averageAskColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_BOOK_SPEED_SETTINGS.averageAskColor,
    markerBidColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_BOOK_SPEED_SETTINGS.markerBidColor,
    markerAskColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_BOOK_SPEED_SETTINGS.markerAskColor,
    schemaVersion: BOOK_SPEED_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-delta" ? {
    ...DEFAULT_DEEP_DELTA_SETTINGS,
    positiveColor: theme?.upColor ?? "#C8FFC8",
    negativeColor: theme?.downColor ?? "#F2D3FF",
    range1AskColor: theme?.upColor ?? "#C8FFC8",
    range1BidColor: theme?.downColor ?? "#F2D3FF",
    range2AskColor: theme?.borderUpColor ?? theme?.upColor ?? "#77F277",
    range2BidColor: theme?.borderDownColor ?? theme?.downColor ?? "#C26DE0",
    range3AskColor: theme?.upColor ?? "#39C96A",
    range3BidColor: theme?.downColor ?? "#8B3EC1",
    range4AskColor: theme?.borderUpColor ?? theme?.upColor ?? "#00FF68",
    range4BidColor: theme?.borderDownColor ?? theme?.downColor ?? "#6D18A8",
    maximumPositiveColor: theme?.borderUpColor ?? theme?.upColor ?? "#00FF68",
    minimumNegativeColor: theme?.borderDownColor ?? theme?.downColor ?? "#7416B5",
    level1Color: theme?.borderUpColor ?? theme?.upColor ?? "#FFD600",
    level2Color: theme?.borderUpColor ?? theme?.upColor ?? "#FFD600",
    markerColor: theme?.borderDownColor ?? theme?.downColor ?? "#16106F",
    schemaVersion: DEEP_DELTA_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-wall" ? {
    ...DEFAULT_DEEP_WALL_SETTINGS,
    buyWallColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_DEEP_WALL_SETTINGS.buyWallColor,
    sellWallColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_DEEP_WALL_SETTINGS.sellWallColor,
    schemaVersion: DEEP_WALL_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-v-tracker" ? {
    ...DEFAULT_DEEP_V_TRACKER_SETTINGS,
    accelerationColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_DEEP_V_TRACKER_SETTINGS.accelerationColor,
    exhaustionColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_DEEP_V_TRACKER_SETTINGS.exhaustionColor,
    slowdownColor: theme?.gridColor ?? DEFAULT_DEEP_V_TRACKER_SETTINGS.slowdownColor,
    bidColor: theme?.downColor ?? DEFAULT_DEEP_V_TRACKER_SETTINGS.bidColor,
    askColor: theme?.upColor ?? DEFAULT_DEEP_V_TRACKER_SETTINGS.askColor,
    schemaVersion: DEEP_V_TRACKER_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-profile-swing" ? {
    ...DEFAULT_DEEP_PROFILE_SWING_SETTINGS,
    volumeColor: theme?.borderDownColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.volumeColor,
    valueAreaColor: theme?.borderUpColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.valueAreaColor,
    askColor: theme?.upColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.askColor,
    bidColor: theme?.downColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.bidColor,
    pocColor: theme?.upColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.pocColor,
    vwapColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_DEEP_PROFILE_SWING_SETTINGS.vwapColor,
    schemaVersion: DEEP_PROFILE_SWING_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "deep-profile-values" ? {
    ...DEFAULT_DEEP_PROFILE_VALUES_SETTINGS,
    pocColor: theme?.upColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.pocColor,
    valueAreaColor: theme?.borderUpColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.valueAreaColor,
    peakColor: theme?.upColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.peakColor,
    valleyColor: theme?.downColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.valleyColor,
    vwapColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.vwapColor,
    vwapBandColor: theme?.gridColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.vwapBandColor,
    summaryTextColor: theme?.borderUpColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.summaryTextColor,
    askColor: theme?.upColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.askColor,
    bidColor: theme?.downColor ?? DEFAULT_DEEP_PROFILE_VALUES_SETTINGS.bidColor,
    schemaVersion: DEEP_PROFILE_VALUES_SETTINGS_VERSION,
  } : {}),
  ...(indicatorId === "tape-speed-order-flow-burst" ? {
    ...DEFAULT_TAPE_SPEED_SETTINGS,
    buyColor: theme?.upColor ?? DEFAULT_TAPE_SPEED_SETTINGS.buyColor,
    sellColor: theme?.downColor ?? DEFAULT_TAPE_SPEED_SETTINGS.sellColor,
    totalColor: theme?.borderUpColor ?? DEFAULT_TAPE_SPEED_SETTINGS.totalColor,
    neutralColor: theme?.gridColor ?? DEFAULT_TAPE_SPEED_SETTINGS.neutralColor,
  } : {}),
  ...(indicatorId === "speed-of-tape-instant" ? {
    ...DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS,
    positiveBorderColor: theme?.borderUpColor ?? theme?.upColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.positiveBorderColor,
    positiveFillColor: theme?.upColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.positiveFillColor,
    negativeBorderColor: theme?.borderDownColor ?? theme?.downColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.negativeBorderColor,
    negativeFillColor: theme?.downColor ?? DEFAULT_SPEED_OF_TAPE_INSTANT_SETTINGS.negativeFillColor,
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
    // Plot Settings
    resetMode: "none",
    showTriggered: true,
    triggerOnlyTouch: false,
    // Alerts
    enableAlertSound: false,
    alertName: "Imbalance detected",
    enablePopup: false,
    popupMessage: "Imbalance tracker",
    // Filter Time — "none" keeps every session; "custom" honours the
    // session window below in exchange (America/Chicago) time.
    filterTime: "none",
    sessionStart: "09:30",
    sessionEnd: "16:00",
    buyColor: theme?.upColor ?? "#22C55E",
    sellColor: theme?.downColor ?? "#EF4444",
    buyTriggeredColor: theme?.borderUpColor ?? theme?.upColor ?? "#86EFAC",
    sellTriggeredColor: theme?.borderDownColor ?? theme?.downColor ?? "#FCA5A5",
    imbalanceTrackerSettingsVersion: 3,
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
    candleStyle: "candlestick",
    showAverage: false,
    averageType: "simple",
    averageLineStyle: "solid",
    showAverageDeviations: false,
    showZeroLine: true,
    showName: true,
    showValue: true,
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
    inputData: "Volumes",
    periodMode: "days",
    periodValue: 1,
    lineStyle: "solid",
    useThemeColors: true,
    cvdSettingsVersion: 5,
    showName: true,
    showValue: true,
    customName: "Cumulative Volume Delta",
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
    // Which saved scheme the five colours above came from. Empty means they
    // were set by hand, so the picker does not claim a scheme it is not on.
    statsPaletteId: "",
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
    lineOpacity: 100,
    borderWidth: 1,
    lineStyle: "dashed",
    labelSize: "small",
  } : {}),
  ...(indicatorId === "session-highs-lows" ? {
    showGlobex: true,
    showTokyo: true,
    showLondon: true,
    showNewYork: true,
    globexLabel: "Globex",
    tokyoLabel: "Asia",
    londonLabel: "London",
    newYorkLabel: "New York",
    // Exchange-time session contract, matching the established DeepChart
    // futures windows used by KwantDesk's profile studies.
    globexTimezone: "America/Chicago",
    tokyoTimezone: "America/Chicago",
    londonTimezone: "America/Chicago",
    newYorkTimezone: "America/Chicago",
    globexStart: "17:00",
    globexEnd: "16:00",
    tokyoStart: "17:00",
    tokyoEnd: "02:00",
    londonStart: "02:00",
    londonEnd: "10:00",
    newYorkStart: "08:30",
    newYorkEnd: "15:00",
    showHighs: true,
    showLows: true,
    showLabels: true,
    hideWeekends: true,
    lineStyle: "dashed",
    labelSize: "small",
    sessionHighLowSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "ib-levels" ? {
    durationMinutes: 60,
    /*
     * Each opening range is its own toggle, so a session can carry its 15, 30
     * and 60 at once and they can be read against each other. All off keeps
     * the single `durationMinutes` the study always drew, which is what every
     * saved workspace is expecting to see.
     */
    ibDuration15: false,
    ibDuration30: false,
    ibDuration45: false,
    ibDuration60: false,
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
    lineOpacity: 100,
    lineWidth: 1,
    showFib: false,
    fibDirection: "long",
    initialBalanceSettingsVersion: 2,
  } : {}),
  ...(indicatorId === "big-trades" ? {
    showBigContracts: true,
    showDeepContracts: false,
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
    // Measure the day session and the overnight session against their own
    // tape. One combined threshold is set almost entirely by the day session,
    // so the overnight hours go bare and then the open floods.
    sessionFilterEnabled: true,
    rthFilterMode: "manual",
    rthManualFilter: 30,
    rthAutomaticIntensity: "medium",
    rthStandardDeviation: 1,
    // "off" | "size" | "reject". Size keeps an outsized print but stops it
    // setting the top of the scale and flattening every other marker.
    cappingMode: "off",
    cappingMaxVolume: 0,
    markerType: "circle",
    hollowFill: false,
    informationMode: "volume",
    useThemeColors: true,
    showLabels: true,
    enableAlertSound: false,
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    /*
     * A large print leaves a level. The study marked where size traded and
     * stopped there, so the price it happened at - the thing you trade against
     * afterwards - had to be eyed off the marker. Off by default so an
     * existing workspace opens unchanged.
     */
    showProjection: false,
    projectionLineWidth: 1,
    projectionLineStyle: "dashed",
    projectionOpacity: 55,
    deepMinimumTradeSize: 30,
    deepBoxTickRange: 4,
    deepTickMargin: 1,
    deepProjectionBars: 22,
    deepOpacity: 20,
    deepLineWidth: 1,
    deepShowProjection: true,
    deepExtendTillCloseCross: true,
    bigTradesSettingsVersion: 6,
  } : {}),
  ...(indicatorId === "deep-m-effort-nq" ? {
    useThemeColors: true,
    showZones: true,
    // Big Blocks is read as a block study; the moving average sat on top of the
    // blocks and had to be switched off by hand every time. Opt-in now.
    showMovingAverage: false,
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
    minimumBars: 20,
    minimumDeltaPercent: 20,
    maximumDeltaPercent: 100,
    maximumDeltaEffort: 0,
    averageLength: 21,
    entryZoneRangePercent: 28,
    effortSettingsVersion: 5,
  } : {}),
  ...(indicatorId === "delta-bar" ? {
    // "pane" keeps the histogram every existing chart already has; the side
    // modes turn it into a per-price ladder on the chart itself.
    displayMode: "pane",
    ladderWidthPx: 150,
    ladderEdgeGapPx: 2,
    ladderLevelSpacingPx: 22,
    ladderOpacity: 100,
    ladderFontSize: 8,
    showLadderValues: true,
    useThemeColors: true,
    buyColor: theme?.upColor ?? "#22C55E",
    sellColor: theme?.downColor ?? "#EF4444",
    spineColor: theme?.gridColor ?? "#6B7280",
  } : {}),
  ...(indicatorId === "mini-dom" ? {
    widthPx: 95,
    rightGapPx: 2,
    levelSpacingPx: 10,
    barOpacity: 100,
    // No panel behind the ladder: the chart already ends at its edge, so
    // there is nothing underneath to cover.
    backgroundOpacity: 0,
    fontSize: 8,
    showBids: true,
    showAsks: true,
    // Both rails grow left off one shared baseline, so lengths compare
    // directly. Off puts them back to the liq map's mirrored pair.
    alignLeft: true,
    showSizes: true,
    useThemeColors: true,
    buyColor: theme?.upColor ?? "#14B8B0",
    sellColor: theme?.downColor ?? "#B4174B",
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
    // Theme-derived like every other directional pair in this file. They were
    // literals while the flag above said the opposite, so the study announced
    // that it followed the theme and then did not - and nothing downstream
    // could correct it, because a colour only moves with the theme if the
    // default it came from did.
    positiveColor: theme?.upColor ?? "#22C55E",
    negativeColor: theme?.downColor ?? "#EF4444",
    // Not directional: the zero-gamma line is a reference mark and stays a
    // near-white against every palette rather than sinking into the grid.
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
    // The band is not directional, so it takes the theme's own accent rather
    // than a fixed gold that belonged to one palette. It said it followed the
    // theme while being a literal, which is a flag that cannot come true.
    neutralColor: theme?.borderUpColor ?? theme?.upColor ?? "#D6A84B",
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
  /*
   * Which week the weekly profile covers. Defaults to the current one, so a
   * chart that has never been touched paints exactly what it painted before
   * this setting existed.
   */
  ...(indicatorId === "weekly-volume-profile" ? { weekSelection: "current" } : {}),
  ...(["kwant-profile", "weekly-volume-profile", "composite-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"].includes(indicatorId) ? {
    valueAreaPercent: DEFAULT_VOLUME_PROFILE_VALUE_AREA_PERCENT,
    // Data Settings — the input series, the trade-size band applied before
    // binning, and how many ticks share a profile row. Automatic derives the
    // row height from the session range; Manual pins it to groupTicks.
    inputData: "volume",
    minTradeVolume: 0,
    maxTradeVolume: 0,
    autoGroupFactor: 1,
    groupTicks: 4,
    // Point of Control
    pocLineWidth: 1,
    pocHighlightOpacity: 100,
    developingPocStartMinutes: 0,
    shiftedPocTicks: 4,
    shiftedPocOpacity: 35,
    pocLineMode: "show",
    pocExtensionMode: "to-window-end",
    // Value Area
    valueAreaLineWidth: 2,
    valueAreaDeveloping: "no",
    valueAreaExtensionMode: "to-window-end",
    // Peak and Valley: high- and low-volume nodes plus the band between the
    // outermost peaks. Off by default so existing profiles look unchanged.
    showPeaks: false,
    showValleys: false,
    pvSensitivity: 40,
    pvExcludeHighLow: true,
    peakMinVolumePercent: 1,
    valleyMaxVolumePercent: 0,
    peakOnlyOutsideValueArea: false,
    valleyOnlyOutsideValueArea: false,
    peakLineWidth: 2,
    valleyLineWidth: 2,
    peakExtensionMode: "none",
    valleyExtensionMode: "none",
    showBusinessZone: false,
    businessZoneOpacity: 3,
    businessZoneLineWidth: 0,
    // VWAP of the profile itself. `vwapEnabled` is DeepCharts' master switch;
    // the line, live developing trail, highlight and envelopes remain
    // independently selectable underneath it.
    vwapEnabled: false,
    showVwapLine: true,
    vwapHighlight: false,
    showDevelopingVwap: false,
    showVwapBands: false,
    vwapLineWidth: 1,
    vwapLineStyle: "dash",
    vwapHighlightOpacity: 18,
    vwapExtensionMode: "none",
    vwapBand1: 1,
    vwapBand2: 2,
    vwapBand3: 0,
    // Summary totals printed beside the profile.
    showSummaryVolume: true,
    showSummaryTrades: false,
    // Filter/Split Time. "none" counts the whole session, which is the
    // behaviour every existing profile already has.
    filterMode: "none",
    filterTime: "rth",
    // Plot Settings: level dash pattern and how the histogram itself is
    // painted. VAH/VAL/POC spans are structural: prior sessions finish at the
    // next profile and the newest finishes at the pane edge.
    levelLineStyle: "dash",
    // VAH / POC / VAL are named on the plot by default, the way IB levels are.
    showLevelLabels: true,
    levelLabelSide: "right",
    showLevelLabelPrice: true,
    visualStyle: "automatic",
    widthMode: "period-percent",
    borderWidth: 1,
    numberOfProfiles: 0,
    /*
     * DeepChart's Plot Width/Offset tab. Completed profiles default to the
     * current width and both offsets to none, so switching to this build
     * changes nothing until the trader asks for it.
     */
    previousProfileWidth: 24,
    currentProfileOffset: 0,
    previousProfileOffset: 0,
    sessionStartMinutes: 8 * 60 + 30,
    sessionEndMinutes: 15 * 60 + 15,
    useEndSessionAsStartDay: false,
    // A volume profile measures volume. Delta is an overlay the trader turns
    // on, not part of the standard picture — the dedicated delta and bid/ask
    // variants still open in their own mode.
    profileMode: indicatorId === "ask-bid-volume-profile"
      ? "bid-ask"
      : indicatorId === "delta-profile"
        ? "delta"
        : "volume",
    // Manual 4-tick rows are the desk standard: automatic grouping re-derived
    // the row height from each session's range, so the same instrument drew a
    // different profile granularity day to day.
    groupingMode: "manual",
    // Gradient scheme. "off" leaves the individual colours in charge; any
    // scheme id takes over the whole profile body and locks those pickers.
    gradientPreset: VOLUME_PROFILE_GRADIENT_OFF,
    // Which windows a split profile actually draws. All on reproduces the
    // untouched split; unticking one simply omits that profile.
    // False until the trader picks a session, so the first pick isolates and
    // every pick after it toggles.
    sessionSelectionArmed: false,
    sessionAsiaEnabled: true,
    sessionLondonEnabled: true,
    sessionNewYorkEnabled: true,
    snapMode: indicatorId === "custom-draw-on-volume-profile"
      ? "off"
      : indicatorId === "composite-volume-profile" ? "right" : "left",
    useThemeColors: true,
    showText: false,
    showValueArea: true,
    showPocLine: true,
    showValueAreaLines: true,
    // Draw POC/VAH/VAL extensions on the newest profile only. Off by default
    // so nothing changes for anyone who has not asked for it.
    recentLevelsOnly: false,
    showDelta: true,
    showProfileSpine: true,
    showDevelopingPoc: false,
    showPocHighlight: true,
    showProfileOutline: true,
    showSummary: false,
    profileSettingsVersion: 15,
    /*
     * `align` is gone: it was stored, migrated and read by nothing. Alignment
     * is `snapMode`, which is the live control and the one the dialog offers -
     * DeepChart's ShowOnTheRight / AlignToRight map onto it.
     */
    volumeColor: theme?.borderUpColor ?? theme?.upColor ?? "#22C55E",
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    pocColor: theme?.upColor ?? "#22C55E",
    valueAreaColor: theme?.borderUpColor ?? theme?.upColor ?? "#22C55E",
    peakColor: theme?.upColor ?? "#22C55E",
    valleyColor: theme?.downColor ?? "#EF4444",
    businessZoneColor: theme?.borderUpColor ?? theme?.upColor ?? "#22C55E",
    vwapColor: theme?.borderUpColor ?? "#F59E0B",
    vwapHighlightColor: theme?.borderUpColor ?? "#F59E0B",
    vwapBandColor: theme?.gridColor ?? "#71717A",
    summaryTextColor: theme?.upColor ?? "#22C55E",
    ...(indicatorId === "composite-volume-profile" ? {
      // DeepCharts' Composite Profile is one profile over a chosen length,
      // docked on the right as its stock presentation. Loaded range is the
      // safest default because it never implies execution history the chart
      // has not asked the gateway to restore.
      compositeRangeMode: "loaded-range",
      compositeLengthValue: 500,
      compositeCustomStartMs: "",
      compositeCustomEndMs: "",
      compositeCustomEndFollowsLatest: true,
      showProfileSpine: false,
      recentLevelsOnly: true,
    } : {}),
  } : {}),
});

export const normalizeStoredIndicator = (instance: ChartIndicatorInstance): ChartIndicatorInstance => {
  let normalizedInstance = instance.indicatorId === "deep-profile"
    ? { ...instance, indicatorId: "kwant-profile" }
    : instance.indicatorId === "deep-stats"
      ? { ...instance, indicatorId: "kwant-stats" }
      : instance.indicatorId === "deep-m-effort"
        ? { ...instance, indicatorId: "deep-m-effort-nq" }
      // "Deep Trades" was an old duplicate library entry carrying the same
      // visible Big Contracts name but no chart renderer. Preserve existing
      // saved workspaces by routing that legacy id into the real execution-
      // tape engine instead of silently dropping it in historical replay.
      : instance.indicatorId === "deep-trades"
        ? { ...instance, indicatorId: "big-trades" }
      : instance;
  if (normalizedInstance.indicatorId === "market-profile-tpo") {
    normalizedInstance = { ...normalizedInstance, indicatorId: "tpo-chart" };
  }
  if (["vwap", "vwap-envelopes", "rolling-vwap"].includes(normalizedInstance.indicatorId)) {
    const indicatorId = normalizedInstance.indicatorId;
    const persisted = normalizedInstance.settings ?? {};
    const settings: Record<string, number | string | boolean> = {
      ...defaultIndicatorSettings(indicatorId),
      ...persisted,
    };
    // Rolling VWAP previously reset each CME session and stored its bar window
    // as `length`. Preserve that chosen window while moving to the continuous
    // period contract.
    if (indicatorId === "rolling-vwap" && persisted.periodValue === undefined && persisted.length !== undefined) {
      settings.periodValue = Math.max(1, Math.round(Number(persisted.length) || 60));
    }
    settings.source = ["hlc3", "hl2", "ohlc4", "close"].includes(String(settings.source)) ? settings.source : "hlc3";
    const allowedPeriods = indicatorId === "vwap"
      ? ["days", "minutes", "seconds", "orders"]
      : indicatorId === "rolling-vwap" ? ["bars", "minutes", "days"] : ["days", "minutes"];
    settings.periodMode = allowedPeriods.includes(String(settings.periodMode))
      ? settings.periodMode
      : allowedPeriods[0];
    settings.envelopeMode = ["standard-deviation", "price-percentage"].includes(String(settings.envelopeMode))
      ? settings.envelopeMode
      : "standard-deviation";
    settings.lineStyle = ["solid", "dashed", "dotted"].includes(String(settings.lineStyle)) ? settings.lineStyle : "solid";
    settings.bandLineStyle = ["solid", "dashed", "dotted"].includes(String(settings.bandLineStyle)) ? settings.bandLineStyle : "dotted";
    for (const definition of INDICATOR_NUMERIC_SETTINGS[indicatorId] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(definition.max, Math.max(definition.min,
        Number.isFinite(parsed) ? parsed : definition.defaultValue));
    }
    for (let band = 1; band <= 5; band += 1) {
      settings[`band${band}Enabled`] = typeof settings[`band${band}Enabled`] === "boolean"
        ? settings[`band${band}Enabled`]
        : indicatorId !== "vwap" && band <= 3;
    }
    delete settings.length;
    if (indicatorId !== "vwap") delete settings.sessionStartHour;
    settings.vwapSettingsVersion = 2;
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "imbalance-tracker") {
    const storedVersion = Number(normalizedInstance.settings?.imbalanceTrackerSettingsVersion ?? 0);
    const settings: Record<string, number | string | boolean> = {
      ...defaultIndicatorSettings("imbalance-tracker"),
      ...(normalizedInstance.settings ?? {}),
    };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["imbalance-tracker"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    if (!["diagonal", "horizontal", "delta-percentage-horizontal"].includes(String(settings.calculationMode))) {
      settings.calculationMode = "diagonal";
    }
    if (!["none", "session", "week"].includes(String(settings.resetMode))) settings.resetMode = "none";
    if (!["none", "custom"].includes(String(settings.filterTime))) settings.filterTime = "none";
    // Versions before the visible-zone contract advertised opacity as 78/100
    // while the renderer silently reduced it again. Upgrade that stock value
    // to the real Deep Charts-style full-opacity default; preserve deliberate
    // custom values from current workspaces.
    if (storedVersion < 3 && Number(settings.opacity) === 78) settings.opacity = 100;
    settings.imbalanceTrackerSettingsVersion = 3;
    return { ...normalizedInstance, settings };
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
  if (normalizedInstance.indicatorId === "unfinished-auction") {
    const defaults = defaultIndicatorSettings("unfinished-auction");
    return {
      ...normalizedInstance,
      settings: {
        ...defaults,
        ...normalizeUnfinishedAuctionSettings({
          ...defaults,
          ...(normalizedInstance.settings ?? {}),
        }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "bar-poc-indicator") {
    const defaults = defaultIndicatorSettings("bar-poc-indicator");
    return {
      ...normalizedInstance,
      settings: {
        ...defaults,
        ...normalizeBarPocSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }),
      },
    };
  }
  if (normalizedInstance.indicatorId === "dynamic-poc") {
    const defaults = defaultIndicatorSettings("dynamic-poc");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDynamicPocSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "ratio-highlight") {
    const defaults = defaultIndicatorSettings("ratio-highlight");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeRatioHighlightSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "stop-spotter") {
    const defaults = defaultIndicatorSettings("stop-spotter");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeStopSpotterSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "cumulative-iceberg-stop") {
    const defaults = defaultIndicatorSettings("cumulative-iceberg-stop");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeCumulativeIcebergStopSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "book-speed") {
    const defaults = defaultIndicatorSettings("book-speed");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeBookSpeedSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "deep-delta") {
    const defaults = defaultIndicatorSettings("deep-delta");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDeepDeltaSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "deep-wall") {
    const defaults = defaultIndicatorSettings("deep-wall");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDeepWallSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "deep-v-tracker") {
    const defaults = defaultIndicatorSettings("deep-v-tracker");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDeepVTrackerSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "deep-profile-swing") {
    const defaults = defaultIndicatorSettings("deep-profile-swing");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDeepProfileSwingSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
  }
  if (normalizedInstance.indicatorId === "deep-profile-values") {
    const defaults = defaultIndicatorSettings("deep-profile-values");
    return { ...normalizedInstance, settings: { ...defaults, ...normalizeDeepProfileValuesSettings({ ...defaults, ...(normalizedInstance.settings ?? {}) }) } };
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
  if (normalizedInstance.indicatorId === "speed-of-tape-instant") {
    return {
      ...normalizedInstance,
      settings: {
        ...normalizeSpeedOfTapeInstantSettings({
          ...defaultIndicatorSettings("speed-of-tape-instant"),
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
  if (normalizedInstance.indicatorId === "gamma-heatmap") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("gamma-heatmap");
    const settings: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    for (const definition of INDICATOR_NUMERIC_SETTINGS["gamma-heatmap"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    const enumValues: Record<string, string[]> = {
      preset: ["intraday", "positioning", "flow-change", "levels"],
      metric: ["GAMMA", "DELTA", "VANNA", "CHARM"],
      viewMode: ["net", "call-put", "absolute", "change", "hedge-pressure", "levels-only"],
      sourceMode: ["hybrid", "quantdata", "databento-raw"],
      optionsSource: ["AUTO", "QQQ", "NDX", "SPY", "SPX", "SPXW"],
    };
    for (const [key, allowed] of Object.entries(enumValues)) {
      if (!allowed.includes(String(settings[key]))) settings[key] = defaults[key];
    }
    for (const key of ["showHistorical", "showLevels", "carryForwardFade", "showStatus", "useThemeColors"]) {
      settings[key] = settings[key] !== false;
    }
    for (const unsafeKey of ["apiKey", "credential", "credentials", "providerCredential", "snapshot", "snapshots", "levels", "history"]) {
      delete settings[unsafeKey];
    }
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "divergence-detector") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("divergence-detector");
    const source: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    const settings: Record<string, number | string | boolean> = {};
    for (const definition of INDICATOR_NUMERIC_SETTINGS["divergence-detector"] ?? []) {
      const parsed = Number(source[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    settings.comparisonMode = "automatic-es-nq";
    for (const key of [
      "includeNonConfirmation", "showBullish", "showBearish", "showLabels",
      "showPivotDots", "useThemeColors",
    ]) settings[key] = source[key] !== false;
    settings.dashedLines = source.dashedLines === true;
    for (const key of ["bullishColor", "bearishColor"]) {
      settings[key] = /^#[0-9a-f]{6}$/i.test(String(source[key] ?? ""))
        ? String(source[key]).toUpperCase()
        : defaults[key];
    }
    settings.divergenceDetectorSettingsVersion = 1;
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "expected-move") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("expected-move");
    const source: Record<string, number | string | boolean> = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    return { ...normalizedInstance, settings: { ...normalizeExpectedMoveSettings(source) } };
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
      preset: ["balanced-net-gex", "zero-dte-scalper", "full-chain", "call-put-breakdown", "absolute-gamma", "minimal-levels"],
      provider: ["quantdata", "databento-custom", "hybrid-validation"],
      sourceTicker: ["AUTO", "QQQ", "NDX", "NQ", "SPY", "SPX", "SPXW"],
      representation: ["per-one-percent-move"],
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
    const expirationDates = String(settings.expirationDates ?? "").split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .slice(0, 64);
    settings.expirationDates = expirationDates.join(",");
    for (const key of [
      "includeWeeklies", "includeMonthlies", "includeQuarterlies", "reverseDirections",
      "sharePositiveNegativeScale", "showZeroSpine", "showValues", "showMappedPrice",
      "showMaxPositive", "showMaxNegative", "showDominantAbsolute", "showCallWall",
      "showPutWall", "showCurrentPrice", "showHeader", "showMappingConfidence",
      "tooltipsEnabled", "fadeWhenBelowMinimum", "hideWhenBelowMinimum", "useThemeColors",
    ]) settings[key] = settings[key] === true;
    for (const key of ["positiveColor", "negativeColor", "callColor", "putColor", "absoluteColor", "zeroSpineColor", "warningColor"]) {
      if (!/^#[0-9a-f]{6}$/i.test(String(settings[key] ?? ""))) settings[key] = defaults[key];
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
      preset: ["balanced-intraday", "zero-dte-scalper", "build-unwind", "heat-ribbon", "full-chain-structure", "minimal-nodes", "historical-replay"],
      provider: ["quantdata"],
      sourceTicker: ["AUTO", "QQQ", "NDX", "NQ", "SPY", "SPX", "SPXW"],
      aggregationPeriod: ["1m", "2m", "3m", "4m", "5m", "10m", "15m", "20m", "30m", "1h", "2h", "4h"],
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
    const booleanKeys = [
      "includeWeeklies", "includeMonthlies", "includeQuarterlies", "highlightCurrentBucket",
      "showCurrentBucketOutline", "hollowBubbles", "showLevelTracks", "showUnderlyingPriceLine",
      "showMaxPositive", "showMaxNegative", "showDominantAbsolute", "showCallWall", "showPutWall",
      "mergeCoincidentLabels", "hideZeroValues", "showLevels", "showValues", "showHeader",
      "showMappingConfidence", "tooltipsEnabled", "enableAlerts", "alertNewLargePoint",
      "alertLevelApproach", "alertLevelTouch", "browserNotifications", "useThemeColors",
    ];
    for (const key of booleanKeys) if (typeof settings[key] !== "boolean") settings[key] = defaults[key];
    for (const key of ["positiveColor", "negativeColor", "callColor", "putColor", "neutralColor"]) {
      if (!/^#[0-9a-f]{6}$/i.test(String(settings[key]))) settings[key] = defaults[key];
      else settings[key] = String(settings[key]).toUpperCase();
    }
    const validCalendarDate = (value: unknown) => {
      const text = String(value ?? "");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00.000Z`) : null;
      return date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : "";
    };
    settings.sessionDate = validCalendarDate(settings.sessionDate);
    settings.expirationDates = [...new Set(String(settings.expirationDates ?? "").split(",")
      .map((value) => validCalendarDate(value.trim())).filter(Boolean))].sort().slice(0, 64).join(",");
    for (const key of ["startTime", "endTime"]) {
      const instant = Date.parse(String(settings[key] ?? ""));
      settings[key] = Number.isFinite(instant) ? new Date(instant).toISOString() : "";
    }
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
  if (normalizedInstance.indicatorId === "depth-of-market") {
    const defaults: Record<string, number | string | boolean> = defaultIndicatorSettings("depth-of-market");
    const storedVersion = Number(normalizedInstance.settings?.domSettingsVersion ?? 0);
    const settings: Record<string, number | string | boolean> = {
      ...defaults,
      ...(normalizedInstance.settings ?? {}),
    };
    if (storedVersion < DOM_PRO_SETTINGS_VERSION) {
      settings.width = Math.max(640, Number(normalizedInstance.settings?.width ?? 640));
      settings.rows = DEFAULT_DOM_PRO_VISIBLE_ROWS;
      settings.rowHeight = 24;
      settings.domPreset = "order-flow";
      settings.domColumns = String(defaults.domColumns ?? "[]");
    }
    for (const definition of INDICATOR_NUMERIC_SETTINGS["depth-of-market"] ?? []) {
      const parsed = Number(settings[definition.key]);
      const clamped = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
      settings[definition.key] = [
        "width", "rows", "rowHeight", "refreshRateMs", "recentWindowMs", "fontSize",
      ].includes(definition.key) ? Math.round(clamped) : clamped;
    }
    for (const key of [
      "showCumulative", "showOrderCount", "showPullStack", "showRecentTrades",
      "showDepthHistogram", "showHeaderStats", "showImbalance", "autoCenter",
      "compactNumbers", "useThemeColors",
    ]) {
      if (typeof settings[key] !== "boolean") settings[key] = defaults[key];
    }
    if (!["scalper", "order-flow", "minimal", "custom"].includes(String(settings.domPreset))) {
      settings.domPreset = "order-flow";
    }
    for (const key of ["bidColor", "askColor", "lastTradeColor"]) {
      settings[key] = /^#[0-9a-f]{6}$/i.test(String(settings[key] ?? ""))
        ? String(settings[key]).toUpperCase()
        : defaults[key];
    }
    const defaultColumns = [
      { id: "buy", width: 100, enabled: true },
      { id: "sell", width: 100, enabled: true },
      { id: "bid", width: 100, enabled: true },
      { id: "price", width: 100, enabled: true },
      { id: "ask", width: 100, enabled: true },
      { id: "trades", width: 100, enabled: true },
      { id: "orders", width: 82, enabled: false },
      { id: "cob", width: 82, enabled: false },
      { id: "pullStack", width: 82, enabled: false },
    ] as const;
    let storedColumns: Array<{ id?: unknown; width?: unknown; enabled?: unknown }> = [];
    const serializedColumns = String(settings.domColumns ?? "");
    if (serializedColumns.length <= 16_384) {
      try {
        const parsed = JSON.parse(serializedColumns) as unknown;
        if (Array.isArray(parsed)) storedColumns = parsed.slice(0, defaultColumns.length);
      } catch {
        storedColumns = [];
      }
    }
    settings.domColumns = JSON.stringify(defaultColumns.map((fallback) => {
      const stored = storedColumns.find((column) => column?.id === fallback.id);
      const width = Number(stored?.width);
      return {
        id: fallback.id,
        width: Math.max(54, Math.min(260, Math.round(Number.isFinite(width) ? width : fallback.width))),
        enabled: typeof stored?.enabled === "boolean" ? stored.enabled : fallback.enabled,
      };
    }));
    for (const unsafeKey of [
      "apiKey", "credential", "credentials", "providerCredential", "snapshot", "snapshots",
      "levels", "book", "orders", "trades", "executions", "history", "orderEvents",
    ]) delete settings[unsafeKey];
    return {
      ...normalizedInstance,
      settings: { ...settings, domSettingsVersion: DOM_PRO_SETTINGS_VERSION },
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
    ["kwant-profile", "weekly-volume-profile", "composite-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"]
      .includes(normalizedInstance.indicatorId)
  ) {
    // This used to overwrite valueAreaPercent on every normalize, which pinned
    // every profile to the constant and quietly discarded the trader's own
    // setting. It now only fills the value in when a saved profile has none.
    const storedValueArea = Number(normalizedInstance.settings?.valueAreaPercent);
    if (!Number.isFinite(storedValueArea) || storedValueArea <= 0 || storedValueArea > 100) {
      normalizedInstance = {
        ...normalizedInstance,
        settings: {
          ...(normalizedInstance.settings ?? {}),
          valueAreaPercent: DEFAULT_VOLUME_PROFILE_VALUE_AREA_PERCENT,
        },
      };
    }
  }
  if (
    normalizedInstance.indicatorId === "kwant-profile"
    && Number(normalizedInstance.settings?.profileSettingsVersion) < 15
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...(normalizedInstance.settings ?? {}),
        showText: false,
        showPocHighlight: true,
        showProfileOutline: true,
        vwapEnabled: normalizedInstance.settings?.vwapEnabled
          ?? (normalizedInstance.settings?.showVwapLine === true
            || normalizedInstance.settings?.showVwapBands === true),
        // Old defaults stored both VWAP children as false. Keep VWAP itself
        // disabled during migration, but prime Show line so turning the new
        // master switch on has an immediate visible result. Preserve the
        // intentional bands-only combination.
        showVwapLine: normalizedInstance.settings?.showVwapLine === true
          || normalizedInstance.settings?.showVwapBands !== true,
        vwapHighlight: normalizedInstance.settings?.vwapHighlight ?? false,
        showDevelopingVwap: normalizedInstance.settings?.showDevelopingVwap ?? false,
        showVwapBands: normalizedInstance.settings?.showVwapBands ?? false,
        vwapLineStyle: normalizedInstance.settings?.vwapLineStyle ?? "dash",
        vwapHighlightOpacity: normalizedInstance.settings?.vwapHighlightOpacity ?? 18,
        vwapHighlightColor: normalizedInstance.settings?.vwapHighlightColor
          ?? normalizedInstance.settings?.vwapColor
          ?? "#F59E0B",
        showSummary: false,
        showDelta: true,
        showProfileSpine: true,
        snapMode: normalizedInstance.settings?.snapMode === "right" ? "right" : "left",
        profileWidth: 24,
        opacity: 100,
        // Data Settings arrived in v7. Existing values always win so a
        // migration never silently re-tunes a saved profile.
        inputData: normalizedInstance.settings?.inputData ?? "volume",
        minTradeVolume: normalizedInstance.settings?.minTradeVolume ?? 0,
        maxTradeVolume: normalizedInstance.settings?.maxTradeVolume ?? 0,
        autoGroupFactor: normalizedInstance.settings?.autoGroupFactor ?? 1,
        // Structure settings arrived in v8, defaulted off so a saved profile
        // keeps the exact look it had before the upgrade.
        showPeaks: normalizedInstance.settings?.showPeaks ?? false,
        showValleys: normalizedInstance.settings?.showValleys ?? false,
        showBusinessZone: normalizedInstance.settings?.showBusinessZone ?? false,
        pvSensitivity: normalizedInstance.settings?.pvSensitivity ?? 40,
        pvExcludeHighLow: normalizedInstance.settings?.pvExcludeHighLow ?? true,
        peakMinVolumePercent: normalizedInstance.settings?.peakMinVolumePercent ?? 1,
        valleyMaxVolumePercent: normalizedInstance.settings?.valleyMaxVolumePercent ?? 0,
        showSummaryVolume: normalizedInstance.settings?.showSummaryVolume ?? true,
        showSummaryTrades: normalizedInstance.settings?.showSummaryTrades ?? false,
        filterMode: normalizedInstance.settings?.filterMode ?? "none",
        showLevelLabels: normalizedInstance.settings?.showLevelLabels ?? true,
        pocHighlightOpacity: normalizedInstance.settings?.pocHighlightOpacity ?? 55,
        developingPocStartMinutes: normalizedInstance.settings?.developingPocStartMinutes ?? 0,
        shiftedPocTicks: normalizedInstance.settings?.shiftedPocTicks ?? 4,
        shiftedPocOpacity: normalizedInstance.settings?.shiftedPocOpacity ?? 35,
        pocLineMode: normalizedInstance.settings?.pocLineMode ?? "show",
        pocExtensionMode: normalizedInstance.settings?.pocExtensionMode ?? "to-window-end",
        valueAreaDeveloping: normalizedInstance.settings?.valueAreaDeveloping ?? "no",
        valueAreaExtensionMode: normalizedInstance.settings?.valueAreaExtensionMode ?? "to-window-end",
        peakExtensionMode: normalizedInstance.settings?.peakExtensionMode ?? "none",
        valleyExtensionMode: normalizedInstance.settings?.valleyExtensionMode ?? "none",
        vwapExtensionMode: normalizedInstance.settings?.vwapExtensionMode ?? "none",
        // A profile shows volume as standard, but "Delta and total volume" is
        // a real choice in the dropdown and must survive. Coercing it back to
        // plain volume here meant the setting silently reverted every time the
        // settings version moved, so picking it appeared to do nothing.
        profileMode: normalizedInstance.settings?.profileMode ?? "volume",
        levelLabelSide: normalizedInstance.settings?.levelLabelSide ?? "right",
        showLevelLabelPrice: normalizedInstance.settings?.showLevelLabelPrice ?? true,
        levelLineStyle: normalizedInstance.settings?.levelLineStyle ?? "dash",
        visualStyle: normalizedInstance.settings?.visualStyle ?? "automatic",
        widthMode: normalizedInstance.settings?.widthMode ?? "period-percent",
        borderWidth: normalizedInstance.settings?.borderWidth ?? 1,
        numberOfProfiles: normalizedInstance.settings?.numberOfProfiles ?? 0,
        previousProfileWidth: normalizedInstance.settings?.previousProfileWidth
          ?? normalizedInstance.settings?.profileWidth ?? 24,
        currentProfileOffset: normalizedInstance.settings?.currentProfileOffset ?? 0,
        previousProfileOffset: normalizedInstance.settings?.previousProfileOffset ?? 0,
        filterTime: normalizedInstance.settings?.filterTime ?? "rth",
        sessionStartMinutes: normalizedInstance.settings?.sessionStartMinutes ?? 8 * 60 + 30,
        sessionEndMinutes: normalizedInstance.settings?.sessionEndMinutes ?? 15 * 60 + 15,
        useEndSessionAsStartDay: normalizedInstance.settings?.useEndSessionAsStartDay ?? false,
        // DeepCharts baseline. Existing trader choices always win during a
        // schema upgrade; a settings migration must never retune a profile.
        groupingMode: normalizedInstance.settings?.groupingMode ?? "manual",
        gradientPreset: normalizedInstance.settings?.gradientPreset ?? VOLUME_PROFILE_GRADIENT_OFF,
        sessionAsiaEnabled: normalizedInstance.settings?.sessionAsiaEnabled ?? true,
        sessionLondonEnabled: normalizedInstance.settings?.sessionLondonEnabled ?? true,
        sessionNewYorkEnabled: normalizedInstance.settings?.sessionNewYorkEnabled ?? true,
        groupTicks: normalizedInstance.settings?.groupTicks ?? 4,
        valueAreaPercent: normalizedInstance.settings?.valueAreaPercent ?? DEFAULT_VOLUME_PROFILE_VALUE_AREA_PERCENT,
        profileSettingsVersion: 15,
      },
    };
  }
  if (
    ["weekly-volume-profile", "composite-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"]
      .includes(normalizedInstance.indicatorId)
    && Number(normalizedInstance.settings?.profileSettingsVersion) < 15
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...(normalizedInstance.settings ?? {}),
        snapMode: normalizedInstance.indicatorId === "custom-draw-on-volume-profile"
          ? "off"
          : normalizedInstance.indicatorId === "composite-volume-profile"
            ? normalizedInstance.settings?.snapMode === "left" ? "left" : "right"
            : normalizedInstance.settings?.snapMode === "right" ? "right" : "left",
        // Data Settings arrived in v7. Existing values always win so a
        // migration never silently re-tunes a saved profile.
        inputData: normalizedInstance.settings?.inputData ?? "volume",
        minTradeVolume: normalizedInstance.settings?.minTradeVolume ?? 0,
        maxTradeVolume: normalizedInstance.settings?.maxTradeVolume ?? 0,
        autoGroupFactor: normalizedInstance.settings?.autoGroupFactor ?? 1,
        // Structure settings arrived in v8, defaulted off so a saved profile
        // keeps the exact look it had before the upgrade.
        showPeaks: normalizedInstance.settings?.showPeaks ?? false,
        showValleys: normalizedInstance.settings?.showValleys ?? false,
        showBusinessZone: normalizedInstance.settings?.showBusinessZone ?? false,
        pvSensitivity: normalizedInstance.settings?.pvSensitivity ?? 40,
        pvExcludeHighLow: normalizedInstance.settings?.pvExcludeHighLow ?? true,
        peakMinVolumePercent: normalizedInstance.settings?.peakMinVolumePercent ?? 1,
        valleyMaxVolumePercent: normalizedInstance.settings?.valleyMaxVolumePercent ?? 0,
        showSummaryVolume: normalizedInstance.settings?.showSummaryVolume ?? true,
        showSummaryTrades: normalizedInstance.settings?.showSummaryTrades ?? false,
        filterMode: normalizedInstance.settings?.filterMode ?? "none",
        showLevelLabels: normalizedInstance.settings?.showLevelLabels ?? true,
        pocHighlightOpacity: normalizedInstance.settings?.pocHighlightOpacity ?? 55,
        developingPocStartMinutes: normalizedInstance.settings?.developingPocStartMinutes ?? 0,
        shiftedPocTicks: normalizedInstance.settings?.shiftedPocTicks ?? 4,
        shiftedPocOpacity: normalizedInstance.settings?.shiftedPocOpacity ?? 35,
        pocLineMode: normalizedInstance.settings?.pocLineMode ?? "show",
        pocExtensionMode: normalizedInstance.settings?.pocExtensionMode ?? "to-window-end",
        valueAreaDeveloping: normalizedInstance.settings?.valueAreaDeveloping ?? "no",
        valueAreaExtensionMode: normalizedInstance.settings?.valueAreaExtensionMode ?? "to-window-end",
        peakExtensionMode: normalizedInstance.settings?.peakExtensionMode ?? "none",
        valleyExtensionMode: normalizedInstance.settings?.valleyExtensionMode ?? "none",
        vwapExtensionMode: normalizedInstance.settings?.vwapExtensionMode ?? "none",
        vwapEnabled: normalizedInstance.settings?.vwapEnabled
          ?? (normalizedInstance.settings?.showVwapLine === true
            || normalizedInstance.settings?.showVwapBands === true),
        showVwapLine: normalizedInstance.settings?.showVwapLine === true
          || normalizedInstance.settings?.showVwapBands !== true,
        vwapHighlight: normalizedInstance.settings?.vwapHighlight ?? false,
        showDevelopingVwap: normalizedInstance.settings?.showDevelopingVwap ?? false,
        showVwapBands: normalizedInstance.settings?.showVwapBands ?? false,
        vwapLineStyle: normalizedInstance.settings?.vwapLineStyle ?? "dash",
        vwapHighlightOpacity: normalizedInstance.settings?.vwapHighlightOpacity ?? 18,
        vwapHighlightColor: normalizedInstance.settings?.vwapHighlightColor
          ?? normalizedInstance.settings?.vwapColor
          ?? "#F59E0B",
        // A profile shows volume as standard, but "Delta and total volume" is
        // a real choice in the dropdown and must survive. Coercing it back to
        // plain volume here meant the setting silently reverted every time the
        // settings version moved, so picking it appeared to do nothing.
        profileMode: normalizedInstance.settings?.profileMode ?? "volume",
        levelLabelSide: normalizedInstance.settings?.levelLabelSide ?? "right",
        showLevelLabelPrice: normalizedInstance.settings?.showLevelLabelPrice ?? true,
        levelLineStyle: normalizedInstance.settings?.levelLineStyle ?? "dash",
        visualStyle: normalizedInstance.settings?.visualStyle ?? "automatic",
        widthMode: normalizedInstance.settings?.widthMode ?? "period-percent",
        borderWidth: normalizedInstance.settings?.borderWidth ?? 1,
        numberOfProfiles: normalizedInstance.settings?.numberOfProfiles ?? 0,
        previousProfileWidth: normalizedInstance.settings?.previousProfileWidth
          ?? normalizedInstance.settings?.profileWidth ?? 24,
        currentProfileOffset: normalizedInstance.settings?.currentProfileOffset ?? 0,
        previousProfileOffset: normalizedInstance.settings?.previousProfileOffset ?? 0,
        filterTime: normalizedInstance.settings?.filterTime ?? "rth",
        sessionStartMinutes: normalizedInstance.settings?.sessionStartMinutes ?? 8 * 60 + 30,
        sessionEndMinutes: normalizedInstance.settings?.sessionEndMinutes ?? 15 * 60 + 15,
        useEndSessionAsStartDay: normalizedInstance.settings?.useEndSessionAsStartDay ?? false,
        groupingMode: normalizedInstance.settings?.groupingMode ?? "manual",
        gradientPreset: normalizedInstance.settings?.gradientPreset ?? VOLUME_PROFILE_GRADIENT_OFF,
        sessionAsiaEnabled: normalizedInstance.settings?.sessionAsiaEnabled ?? true,
        sessionLondonEnabled: normalizedInstance.settings?.sessionLondonEnabled ?? true,
        sessionNewYorkEnabled: normalizedInstance.settings?.sessionNewYorkEnabled ?? true,
        groupTicks: normalizedInstance.settings?.groupTicks ?? 4,
        valueAreaPercent: normalizedInstance.settings?.valueAreaPercent ?? DEFAULT_VOLUME_PROFILE_VALUE_AREA_PERCENT,
        ...(normalizedInstance.indicatorId === "composite-volume-profile" ? {
          compositeRangeMode: normalizedInstance.settings?.compositeRangeMode ?? "loaded-range",
          compositeLengthValue: normalizedInstance.settings?.compositeLengthValue ?? 500,
          compositeCustomStartMs: normalizedInstance.settings?.compositeCustomStartMs ?? "",
          compositeCustomEndMs: normalizedInstance.settings?.compositeCustomEndMs ?? "",
          compositeCustomEndFollowsLatest: normalizedInstance.settings?.compositeCustomEndFollowsLatest ?? true,
          recentLevelsOnly: normalizedInstance.settings?.recentLevelsOnly ?? true,
        } : {}),
        profileSettingsVersion: 15,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "deep-m-effort-nq"
    && Number(normalizedInstance.settings?.effortSettingsVersion) < 5
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("deep-m-effort-nq"),
        ...(normalizedInstance.settings ?? {}),
        shortName: "Big Blocks",
        alertMessage: "Big Blocks directional bias changed",
        // Saved charts carry the old always-on moving average.
        showMovingAverage: false,
        effortSettingsVersion: 5,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "big-trades"
    && Number(normalizedInstance.settings?.bigTradesSettingsVersion) < 5
  ) {
    // Saved charts carry the old 14px label gate, which is why shrinking the
    // markers made the numbers disappear. Only the untouched old default is
    // lifted, so a deliberately raised gate survives the migration.
    const storedLabelMinSize = Number(normalizedInstance.settings?.labelMinSize ?? 14);
    if (storedLabelMinSize === 14) {
      normalizedInstance = {
        ...normalizedInstance,
        settings: { ...(normalizedInstance.settings ?? {}), labelMinSize: 1 },
      };
    }
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
        manualFilter: Math.min(5000, Math.max(1, Number.isFinite(storedManualFilter) ? storedManualFilter : 30)),
        combineByCandle: false,
        adaptiveTimeframeFilter: false,
        maxMarkersPerBar: 50,
        bigTradesSettingsVersion: 6,
      },
    };
  }
  if (
    normalizedInstance.indicatorId === "big-trades"
    && Number(normalizedInstance.settings?.bigTradesSettingsVersion) < 6
  ) {
    normalizedInstance = {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("big-trades"),
        ...(normalizedInstance.settings ?? {}),
        showBigContracts: normalizedInstance.settings?.showBigContracts ?? true,
        showDeepContracts: normalizedInstance.settings?.showDeepContracts ?? false,
        bigTradesSettingsVersion: 6,
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
  if (normalizedInstance.indicatorId === "vix-environment") {
    const defaults = defaultIndicatorSettings("vix-environment");
    const settings = { ...defaults, ...(normalizedInstance.settings ?? {}) };
    const allowedPositions = new Set([
      "top-left",
      "top-middle",
      "top-right",
      "bottom-left",
      "bottom-middle",
      "bottom-right",
    ]);
    if (!allowedPositions.has(String(settings.position))) settings.position = "top-left";
    if (!new Set(["VIX", "VXN", "AUTO"]).has(String(settings.sourceSymbol).toUpperCase())) settings.sourceSymbol = "VIX";
    else settings.sourceSymbol = String(settings.sourceSymbol).toUpperCase();
    const parsedScale = Number(settings.badgeScale);
    settings.badgeScale = Number.isFinite(parsedScale) ? Math.min(2, Math.max(0.6, parsedScale)) : 1;
    const normal = Math.max(5, Math.min(50, Number(settings.normalThreshold) || 15));
    const elevated = Math.max(normal + 1, Math.min(60, Number(settings.elevatedThreshold) || 20));
    const high = Math.max(elevated + 1, Math.min(70, Number(settings.highThreshold) || 25));
    const extreme = Math.max(high + 1, Math.min(100, Number(settings.extremeThreshold) || 30));
    Object.assign(settings, {
      normalThreshold: normal,
      elevatedThreshold: elevated,
      highThreshold: high,
      extremeThreshold: extreme,
      showChange: settings.showChange !== false,
      showRange: settings.showRange !== false,
      showRank: settings.showRank !== false,
      showPercentile: settings.showPercentile !== false,
      showFreshness: settings.showFreshness !== false,
      showSource: settings.showSource === true,
      useThemeColors: settings.useThemeColors === true,
      vixEnvironmentSettingsVersion: 1,
    });
    return { ...normalizedInstance, settings };
  }
  if (normalizedInstance.indicatorId === "session-highs-lows") {
    const settings: Record<string, number | string | boolean> = {
      ...defaultIndicatorSettings("session-highs-lows"),
      ...(normalizedInstance.settings ?? {}),
    };
    // This is a named four-session futures study, not a colour-linked copy of
    // the separate Sessions overlay. Force legacy workspaces onto the same
    // institutional contract so Tokyo/Sydney labels and saved random colours
    // cannot survive a theme change.
    const legacyContract = Number(normalizedInstance.settings?.sessionHighLowSettingsVersion ?? 0) < 2;
    Object.assign(settings, {
      ...(legacyContract ? {
        showGlobex: true,
        showTokyo: true,
        showLondon: true,
        showNewYork: true,
      } : {}),
      globexLabel: "Globex",
      tokyoLabel: "Asia",
      londonLabel: "London",
      newYorkLabel: "New York",
      globexTimezone: "America/Chicago",
      tokyoTimezone: "America/Chicago",
      londonTimezone: "America/Chicago",
      newYorkTimezone: "America/Chicago",
      globexStart: "17:00",
      globexEnd: "16:00",
      tokyoStart: "17:00",
      tokyoEnd: "02:00",
      londonStart: "02:00",
      londonEnd: "10:00",
      newYorkStart: "08:30",
      newYorkEnd: "15:00",
      sessionHighLowSettingsVersion: 2,
    });
    for (const obsoleteKey of [
      "showSydney", "sydneyLabel", "sydneyStart", "sydneyEnd", "sydneyColor",
      "globexColor", "tokyoColor", "londonColor", "newYorkColor",
      "highColor", "lowColor", "useThemeColors", "useSessionColors", "followSessionsStudy",
      "showPrevious1", "showPrevious2", "showPrevious3",
    ]) delete settings[obsoleteKey];
    for (const definition of INDICATOR_NUMERIC_SETTINGS["session-highs-lows"] ?? []) {
      const parsed = Number(settings[definition.key]);
      settings[definition.key] = Math.min(
        definition.max,
        Math.max(definition.min, Number.isFinite(parsed) ? parsed : definition.defaultValue),
      );
    }
    if (!["solid", "dashed", "dotted"].includes(String(settings.lineStyle))) settings.lineStyle = "dashed";
    return { ...normalizedInstance, settings };
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
    Number(settings.cvdSettingsVersion) >= 5
    && "periodMode" in settings
    && "periodValue" in settings
  ) return normalizedInstance;
  const standardSettings = { ...settings };
  // `sessionStartHour` was an older free-form reset control. DeepCharts uses
  // the configured futures session for day periods, which KwantDesk anchors
  // to the CME 17:00 Chicago boundary instead of allowing an arbitrary hour.
  delete standardSettings.sessionStartHour;
  return {
    ...normalizedInstance,
    settings: {
      ...standardSettings,
      displayStyle: typeof settings.displayStyle === "string" ? settings.displayStyle : "candles",
      inputData: typeof settings.inputData === "string" ? settings.inputData : "Volumes",
      periodMode: ["days", "minutes", "seconds"].includes(String(settings.periodMode))
        ? settings.periodMode
        : "days",
      periodValue: Math.max(1, Math.round(Number(settings.periodValue) || 1)),
      lineStyle: typeof settings.lineStyle === "string" ? settings.lineStyle : "solid",
      useThemeColors: typeof settings.useThemeColors === "boolean" ? settings.useThemeColors : true,
      cvdSettingsVersion: 5,
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
 * Choosing an account theme is a global visual action, so indicators that
 * still follow the theme are relinked to the new palette.
 *
 * An indicator carrying `useThemeColors: false` is NOT relinked. That flag is
 * only ever written when somebody picks a colour, so overriding it discards
 * deliberate work — and it did, for every study at once, every time a theme
 * was chosen. The original reasoning was that the flag might be a stale
 * snapshot rather than a choice; losing an afternoon of colouring is the worse
 * of the two failures, and anyone who wants the theme back can switch the
 * indicator to theme colours in its own settings.
 *
 * Apply this ONLY when the theme itself changes. Restoring a saved workspace
 * must not pass through here: that workspace carries the colours it was saved
 * with.
 */
export const linkPaneIndicatorStateToTheme = (state: Record<string, ChartIndicatorInstance[]>) =>
  Object.fromEntries(
    Object.entries(state).map(([paneId, instances]) => [
      paneId,
      instances.map((instance) => (
        instance.settings?.useThemeColors === false
          ? instance
          : {
            ...instance,
            settings: {
              ...(instance.settings ?? {}),
              useThemeColors: true,
            },
          }
      )),
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
