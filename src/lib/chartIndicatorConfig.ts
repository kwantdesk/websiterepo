import type { ChartSettings } from "@/lib/chartSettings";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } from "@/lib/volumeProfileMath";

export const LIVE_CHART_INDICATOR_IDS = new Set([
  "volume",
  "delta-bar",
  "delta-highlight",
  "delta-cumulative-candlestick",
  "delta-cumulative-histogram",
  "imbalance-tracker",
  "imbalance-rejector",
  "cumulative-volume-delta",
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
  "daily-volume-profile",
  "weekly-volume-profile",
  "custom-draw-on-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
  "sessions",
  "session-highs-lows",
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
  "source-code-indicator",
]);
export const VOLUME_PROFILE_INDICATOR_IDS = new Set([
  "kwant-profile",
  "daily-volume-profile",
  "weekly-volume-profile",
  "custom-draw-on-volume-profile",
  "ask-bid-volume-profile",
  "delta-profile",
]);
export const DAILY_VOLUME_PROFILE_INDICATOR_IDS = new Set([
  "kwant-profile",
  "daily-volume-profile",
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
    { key: "width", label: "Dock width (pixels)", defaultValue: 440, min: 196, max: 640 },
    { key: "rows", label: "Maximum visible price rows", defaultValue: 41, min: 11, max: 101, step: 2 },
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 100 },
    { key: "refreshRateMs", label: "Display refresh rate (milliseconds)", defaultValue: 50, min: 16, max: 1000, step: 1 },
    { key: "recentWindowMs", label: "Recent traded volume retention (milliseconds)", defaultValue: 8000, min: 250, max: 60000, step: 250 },
    { key: "depthScaleCap", label: "Depth histogram cap · 0 = automatic", defaultValue: 0, min: 0, max: 100000, step: 10 },
    { key: "highlightThreshold", label: "High-liquidity threshold · 0 = automatic", defaultValue: 0, min: 0, max: 100000, step: 10 },
    { key: "fontSize", label: "Ladder font size", defaultValue: 9, min: 7, max: 13, step: 1 },
  ],
  "deep-print-footprint": [
    { key: "barWidth", label: "Footprint bar width (pixels)", defaultValue: 88, min: 44, max: 180, step: 2 },
    { key: "autoGroupFactor", label: "Automatic tick grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "manualTicks", label: "Manual ticks per row", defaultValue: 1, min: 1, max: 100, step: 1 },
    { key: "minimumTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000, step: 1 },
    { key: "maximumTradeVolume", label: "Maximum execution size · 0 = unlimited", defaultValue: 0, min: 0, max: 1000000, step: 1 },
    { key: "minimumImbalancePercent", label: "Minimum imbalance (%)", defaultValue: 300, min: 100, max: 10000, step: 25 },
    { key: "minimumDelta", label: "Minimum volume difference", defaultValue: 10, min: 0, max: 100000, step: 1 },
    { key: "backgroundOpacity", label: "Cell background opacity (%)", defaultValue: 74, min: 0, max: 100, step: 1 },
    { key: "borderWidth", label: "Cell and outline width", defaultValue: 1, min: 0.5, max: 4, step: 0.5 },
    { key: "fontSize", label: "Footprint text size", defaultValue: 10, min: 6, max: 16, step: 1 },
    { key: "dynamicTextIncrease", label: "Dynamic text emphasis", defaultValue: 1, min: 0, max: 2, step: 0.1 },
    { key: "singlePrintMaximum", label: "Single-print maximum volume", defaultValue: 1, min: 1, max: 1000, step: 1 },
    { key: "minimumRatio", label: "Minimum displayed ask/bid ratio", defaultValue: 1.5, min: 0, max: 100, step: 0.1 },
    { key: "maximumRatio", label: "Maximum displayed ask/bid ratio", defaultValue: 100, min: 1, max: 1000, step: 1 },
    { key: "clusterMinimumVolume", label: "Volume-cluster minimum", defaultValue: 100, min: 1, max: 100000, step: 1 },
  ],
  "deep-m-effort-nq": [
    { key: "zoneOpacity", label: "Zone opacity (%)", defaultValue: 20, min: 1, max: 100 },
    { key: "zoneLineWidth", label: "Zone border width", defaultValue: 1, min: 0, max: 4, step: 0.5 },
    { key: "maLineWidth", label: "Moving average width", defaultValue: 2, min: 1, max: 4 },
  ],
  "big-trades": [
    { key: "daysToLoad", label: "Days to load", defaultValue: 10, min: 1, max: 90 },
    { key: "manualFilter", label: "Manual minimum trade size", defaultValue: 30, min: 1, max: 100000 },
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
  "kwant-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 72, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "daily-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "profileWidth", label: "Profile width (% of session)", defaultValue: 9, min: 0, max: 24, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 68, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
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
  ...Object.fromEntries(
    (INDICATOR_NUMERIC_SETTINGS[indicatorId] ?? []).map((setting) => [setting.key, setting.defaultValue]),
  ),
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
  ...(indicatorId === "big-trades" ? {
    filterMode: "automatic",
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
    bigTradesSettingsVersion: 3,
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
    shortName: "KWANT Effort",
    showNameLabel: false,
    showValueLabel: true,
    nameBackground: false,
    valueBackground: true,
    enableAlertSound: false,
    enableMessage: false,
    alertMessage: "KWANT Effort directional bias changed",
    zoneBars: 22,
    effortSettingsVersion: 2,
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
    domSettingsVersion: 3,
  } : {}),
  ...(indicatorId === "deep-print-footprint" ? {
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
    askColor: theme?.upColor ?? "#22C55E",
    bidColor: theme?.downColor ?? "#EF4444",
    neutralColor: theme?.gridColor ?? "#3F3F46",
    textColor: "#F5F5F5",
    pocColor: theme?.borderUpColor ?? theme?.upColor ?? "#FDE047",
    deltaPocColor: theme?.borderDownColor ?? theme?.downColor ?? "#60A5FA",
    clusterColor: "#F59E0B",
    singlePrintColor: "#F4F4F5",
    footprintSettingsVersion: 1,
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
  ...(["kwant-profile", "daily-volume-profile", "weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"].includes(indicatorId) ? {
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
    align: ["daily-volume-profile", "kwant-profile"].includes(indicatorId)
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
  if (
    normalizedInstance.indicatorId === "depth-of-market"
    && Number(normalizedInstance.settings?.domSettingsVersion) < 3
  ) {
    normalizedInstance = {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("depth-of-market"),
        ...(normalizedInstance.settings ?? {}),
        width: Math.max(440, Number(normalizedInstance.settings?.width ?? 440)),
        domSettingsVersion: 3,
      },
    };
  }
  if (
    ["kwant-profile", "daily-volume-profile", "weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"]
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
    ["daily-volume-profile", "kwant-profile"].includes(normalizedInstance.indicatorId)
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
        profileWidth: normalizedInstance.indicatorId === "kwant-profile" ? 24 : 9,
        opacity: normalizedInstance.indicatorId === "kwant-profile" ? 72 : 68,
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
    normalizedInstance.indicatorId === "big-trades"
    && Number(normalizedInstance.settings?.bigTradesSettingsVersion) < 3
  ) {
    return {
      ...normalizedInstance,
      settings: {
        ...defaultIndicatorSettings("big-trades"),
        ...(normalizedInstance.settings ?? {}),
        combineByCandle: false,
        adaptiveTimeframeFilter: false,
        maxMarkersPerBar: 50,
        bigTradesSettingsVersion: 3,
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
      instances.map((instance) => ({
        ...instance,
        settings: {
          ...(instance.settings ?? {}),
          useThemeColors: true,
        },
      })),
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
