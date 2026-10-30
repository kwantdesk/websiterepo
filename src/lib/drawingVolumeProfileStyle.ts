import type { Drawing } from "./chartDrawTools";
import type { NativeVolumeProfileStyle } from "./nativeVolumeProfilePrimitive";
import { resolveVolumeProfileGradient } from "./volumeProfileGradients";

export type DrawingProfileTheme = { upColor: string; downColor: string; borderUpColor: string; borderDownColor: string };
export function drawingVolumeProfileStyle(style: Drawing["style"], theme: DrawingProfileTheme): NativeVolumeProfileStyle {
  const volumeColor = style.profileVolumeColor ?? (style.useThemeColor === false ? style.color : theme.borderUpColor);
  const extension = style.profileLevelExtension === "none" ? "none" : style.profileLevelExtension === "window" ? "to-window-end" : "to-profile-end";
  return {
    mode: style.profileMode ?? "volume", visualStyle: style.profileVisualStyle ?? "automatic",
    widthBasis: "period-percent", widthPercent: style.profileWidthPercent ?? 32,
    opacity: (style.profileOpacity ?? 68) / 100,
    positiveDeltaColor: style.profileAskColor ?? theme.upColor,
    negativeDeltaColor: style.profileBidColor ?? theme.downColor,
    valueAreaColor: volumeColor, valueAreaLineColor: style.valueAreaColor, outsideValueAreaColor: style.outsideColor ?? theme.borderDownColor,
    pocColor: style.pocColor ?? theme.upColor, gradient: resolveVolumeProfileGradient(style.profileGradient),
    showValueArea: true, showDelta: style.profileShowDelta !== false,
    showProfileSpine: style.profileShowSpine === true,
    showPocHighlight: style.profileShowPocHighlight !== false,
    showPocLine: style.showPoc !== false, showValueAreaLines: style.showValueAreaLines !== false,
    showText: false, showLevelLabels: style.showLabels, showLevelLabelPrice: true,
    levelLabelSide: "right", showProfileOutline: false,
    automaticGrouping: style.profileAutomaticGrouping !== false, autoGroupFactor: 1,
    manualGroupTicks: style.profileGroupTicks ?? 4, valueAreaPercent: style.valueAreaPercent ?? 70,
    snapMode: "off", borderWidth: style.width,
    pocLineWidth: style.pocLineWidth ?? style.width, valueAreaLineWidth: style.valueAreaLineWidth ?? style.width,
    pocExtensionMode: extension, valueAreaExtensionMode: extension,
    levelDash: style.lineStyle === "dashed" ? [6 * style.width, 4 * style.width] : style.lineStyle === "dotted" ? [style.width, 3 * style.width] : [],
  };
}
