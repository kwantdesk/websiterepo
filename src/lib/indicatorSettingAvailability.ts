import { VOLUME_PROFILE_INDICATOR_IDS } from "@/lib/chartIndicatorConfig";
import { resolveVolumeProfileMode } from "@/lib/volumeProfileMath";
import { isVolumeProfileGradientActive } from "@/lib/volumeProfileGradients";

/** Explain a real dependency instead of offering an apparently inert control. */
export function indicatorSettingDisabledReason(
  id: string,
  key: string,
  settings: Record<string, unknown> = {},
): string | undefined {
  if (key === "useThemeColors" && isVolumeProfileGradientActive(settings.gradientPreset)) {
    return "Turn the colour scheme Off to use theme colours.";
  }
  if (id === "book-speed") {
    if ((key === "averageLength" || /^average(?:Bid|Ask)Color$/.test(key)) && settings.showAverage === false) {
      return "Enable Show Average to adjust the average plot.";
    }
    if (/^marker(?:Value|BidColor|AskColor)$/.test(key) && settings.showMarker !== true) {
      return "Enable Show Marker to adjust the threshold.";
    }
  }
  if (id === "big-trades") {
    if (["rthManualFilter", "rthFilterMode", "rthAutomaticIntensity", "rthStandardDeviation"].includes(key) && settings.sessionFilterEnabled === false) {
      return "Enable the separate regular-hours filter to adjust these values.";
    }
    if (key === "automaticIntensity" && settings.filterMode !== "automatic"
      || key === "rthAutomaticIntensity" && settings.rthFilterMode !== "automatic") {
      return "Select Automatic filter mode to adjust its intensity.";
    }
    if (key === "adaptiveTimeframeFilter" && settings.combineByCandle !== true) {
      return "Enable Combine By Candle to filter the combined markers.";
    }
    if (["clusterWindowMs", "clusterPriceTicks"].includes(key) && settings.enableClustering === false) {
      return "Enable clustering to adjust how prints are grouped.";
    }
    if (["projectionLineWidth", "projectionOpacity", "projectionLineStyle"].includes(key) && settings.showProjection !== true) {
      return "Enable price projections to adjust their appearance.";
    }
    if (key.startsWith("deep") && settings.showDeepContracts !== true) {
      return "Enable Deep Contracts to adjust its boxes.";
    }
  }
  if (id === "deep-m-effort-nq") {
    if (["maAboveColor", "maBelowColor", "maLineWidth", "showValueLabel"].includes(key) && settings.showMovingAverage !== true) {
      return "Enable the moving average to adjust its appearance.";
    }
    if (key === "maBelowColor" && settings.maAutoColor === "none") {
      return "Select price-relative colours to use a separate below-average colour.";
    }
    if (["askColor", "bidColor", "zoneOpacity", "zoneLineWidth", "zoneBars", "entryZoneRangePercent"].includes(key) && settings.showZones === false) {
      return "Enable zones to adjust their appearance.";
    }
  }
  if (VOLUME_PROFILE_INDICATOR_IDS.has(id)) {
    const mode = resolveVolumeProfileMode(id, settings.profileMode);
    if (key === "showDelta" && (mode === "volume" || mode === "bid-ask")) {
      return "Select a Delta profile type to show or hide the delta plot.";
    }
    if (key === "showValueArea" && mode !== "volume" && mode !== "delta-volume") {
      return "Select a profile type with a total-volume plot to shade its value area. Value-area lines can still be shown.";
    }
    if (key === "showProfileOutline" && settings.visualStyle === "line") {
      return "Line appearance draws the profile contour. Choose another appearance to outline each row.";
    }
  }
  if (["cumulative-volume-delta", "delta-cumulative-candlestick", "delta-cumulative-histogram"].includes(id)) {
    const style = settings.displayStyle ?? (id === "delta-cumulative-histogram" ? "bars" : "candles");
    if (key === "plotColor" && style !== "line") return "Select Line display style to adjust its colour; bars and candles use Ask/Bid colours.";
    if (["deltaAskColor", "deltaBidColor"].includes(key) && style === "line") return "Select Bars or Candles to use separate Ask/Bid colours.";
  }
  if (id === "cumulative-volume-delta" && ["volumeAskColor", "volumeBidColor"].includes(key) && settings.showBidAskVolumes !== true) {
    return "Enable Show Bid/Ask Volumes to adjust these plots.";
  }
  if (id === "cumulative-volume-delta" && ["filteredAskColor", "filteredBidColor"].includes(key) && settings.filteredEnabled !== true) {
    return "Enable Filtered CVD to adjust its colours.";
  }
  if (["parabolic-sar", "linear-regression"].includes(id) && key === "secondaryColor" && settings.secondaryColorEnabled !== true) {
    return "Enable Secondary Colour to colour both directions separately.";
  }
  if (id === "volume-delta-sprint" && ((key === "bidColor" && settings.showBid !== true) || (key === "askColor" && settings.showAsk !== true))) {
    return "Enable the corresponding Bid/Ask plot to adjust its colour.";
  }
  if (id === "cumulative-volume-delta" && ["filterMinVolume", "filterMaxVolume", "filteredSeparateAxis"].includes(key) && settings.filteredEnabled !== true) {
    return "Enable Filtered CVD to adjust its filter and scale.";
  }
  if (id === "delta-cumulative-candlestick" && /^average(?:Length|Type|LineWidth|LineStyle|Color|Deviation)$/.test(key) && settings.showAverage !== true) {
    return "Enable Show Average to adjust the average plot.";
  }
  if (id === "delta-cumulative-candlestick" && key === "averageDeviation" && settings.showAverageDeviations !== true) {
    return "Enable average deviations to adjust their multiplier.";
  }
  if (id === "volume-delta-sprint" && ["smoothingLength", "smoothingType"].includes(key) && settings.smoothingEnabled !== true) {
    return "Enable Smoothing to adjust its length and calculation.";
  }
  if (id === "regression-channel" && key.startsWith("zigZag") && settings.mode !== "zig-zag") {
    return "Select Zig Zag mode to adjust swing-based regression.";
  }
  if (id === "regression-channel" && key === "zigZagAbsoluteReversal" && settings.zigZagMode === "highest-lowest") {
    return "Select Tick reversal to use an absolute reversal threshold.";
  }
  if (id === "zig-zag" && key === "absoluteReversalPercent" && settings.zigZagMode !== "absolute-reversal") {
    return "Select Absolute reversal to adjust the reversal percentage.";
  }
  return undefined;
}
