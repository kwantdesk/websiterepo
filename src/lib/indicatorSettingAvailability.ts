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
