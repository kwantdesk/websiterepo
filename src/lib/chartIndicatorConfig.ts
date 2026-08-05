import type { ChartSettings } from "@/lib/chartSettings";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";

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
  "kwant-stats",
  "gamma-levels",
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
    { key: "width", label: "Ladder width (pixels)", defaultValue: 244, min: 176, max: 420 },
    { key: "rows", label: "Maximum visible price rows", defaultValue: 41, min: 11, max: 101, step: 2 },
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 100 },
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
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 82, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "daily-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of session)", defaultValue: 18, min: 0, max: 36, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 82, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "weekly-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 4, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 18, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 42, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "custom-draw-on-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of selected range)", defaultValue: 45, min: 0, max: 100, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 76, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "ask-bid-volume-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 28, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 78, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "delta-profile": [
    { key: "groupTicks", label: "Price grouping (ticks)", defaultValue: 1, min: 1, max: 500 },
    { key: "autoGroupFactor", label: "Automatic grouping factor", defaultValue: 1, min: 0.5, max: 4, step: 0.25 },
    { key: "valueAreaPercent", label: "Value area", defaultValue: 70, min: 1, max: 100 },
    { key: "profileWidth", label: "Profile width (% of chart)", defaultValue: 24, min: 0, max: 60, step: 0.5 },
    { key: "opacity", label: "Profile opacity (%)", defaultValue: 78, min: 10, max: 100 },
    { key: "minTradeVolume", label: "Minimum execution size", defaultValue: 0, min: 0, max: 100000 },
    { key: "maxTradeVolume", label: "Maximum execution size (0 = no maximum)", defaultValue: 0, min: 0, max: 1000000 },
  ],
  "cumulative-volume-delta": [
    { key: "periodValue", label: "Rolling bars / period value", defaultValue: 100, min: 1, max: 100000 },
    { key: "sessionStartHour", label: "Futures session start hour (America/Chicago)", defaultValue: 17, min: 0, max: 23 },
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
    periodMode: "Days",
    periodValue: 1,
    displayStyle: "candles",
    useThemeColors: true,
    cvdSettingsVersion: 3,
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
    useThemeColors: true,
    bidColor: theme?.upColor ?? "#22C55E",
    askColor: theme?.downColor ?? "#EF4444",
    domSettingsVersion: 1,
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
  ...(["kwant-profile", "daily-volume-profile", "weekly-volume-profile", "custom-draw-on-volume-profile", "ask-bid-volume-profile", "delta-profile"].includes(indicatorId) ? {
    profileMode: indicatorId === "ask-bid-volume-profile"
      ? "bid-ask"
      : indicatorId === "delta-profile"
        ? "delta"
        : "delta-volume",
    groupingMode: "automatic",
    snapMode: indicatorId === "weekly-volume-profile" ? "left" : "off",
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
    profileSettingsVersion: 4,
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
  const normalizedInstance = instance.indicatorId === "deep-profile"
    ? { ...instance, indicatorId: "kwant-profile" }
    : instance.indicatorId === "deep-stats"
      ? { ...instance, indicatorId: "kwant-stats" }
      : instance.indicatorId === "deep-m-effort"
        ? { ...instance, indicatorId: "deep-m-effort-nq" }
        : instance;
  if (
    ["daily-volume-profile", "kwant-profile"].includes(normalizedInstance.indicatorId)
    && Number(normalizedInstance.settings?.profileSettingsVersion) < 4
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
        profileWidth: normalizedInstance.indicatorId === "kwant-profile" ? 24 : 18,
        opacity: 82,
        profileSettingsVersion: 4,
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
  if (Number(settings.cvdSettingsVersion) >= 3) return normalizedInstance;
  return {
    ...normalizedInstance,
    settings: {
      ...settings,
      periodMode: "Days",
      periodValue: 1,
      displayStyle: "candles",
      useThemeColors: true,
      cvdSettingsVersion: 3,
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
