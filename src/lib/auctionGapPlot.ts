import type { Candle } from "./backtester.ts";
import type { AuctionGapZone } from "./auctionGapLifecycle.ts";
import { auctionGapThemeColors, normalizeAuctionGapSettings } from "./auctionGapSettings.ts";

export type AuctionGapPlotModel = {
  id: string; startLogical: number; endLogical: number;
  high: number; low: number; markerPrice: number;
  color: string; opacity: number; lineWidth: number; markerSize: number;
  showZone: boolean; showMarker: boolean;
};
/** Actual chart indices avoid duplicate-time ambiguity. Offset is the audited
 * source window's position in the plotted candle series, never a time estimate.
 * Bands cover full tick cells. Bar-direction marker placement is our explicit
 * low-on-rising/high-on-falling convention, not protected native-formula proof.
 */
export function buildAuctionGapPlotModels(zones: readonly AuctionGapZone[], candles: readonly Candle[],
  raw: Record<string, unknown>, tickSize: number, theme: Parameters<typeof auctionGapThemeColors>[0],
  logicalOffset = 0): AuctionGapPlotModel[] {
  if (!(tickSize > 0) || !Number.isFinite(tickSize) || !Number.isSafeInteger(logicalOffset) || logicalOffset < 0) return [];
  const settings = normalizeAuctionGapSettings(raw);
  const colors = settings.useThemeColors ? auctionGapThemeColors(theme) : settings;
  return zones.flatMap(zone => {
    const candle = candles[zone.sourceIndex];
    if (!candle || !Number.isSafeInteger(zone.sourceIndex) || zone.sourceIndex < 0
      || !Number.isSafeInteger(zone.endIndex) || zone.endIndex < zone.sourceIndex
      || !Number.isSafeInteger(zone.lowTick) || !Number.isSafeInteger(zone.highTick) || zone.lowTick > zone.highTick
      || ![candle.open, candle.close, candle.high, candle.low].every(Number.isFinite)) return [];
    if (zone.state === "triggered" ? !settings.showTriggered : settings.onlyTriggered) return [];
    const prefix = zone.side === "buy" ? "buy" : "sell";
    const key = `${prefix}${zone.state === "triggered" ? "Triggered" : ""}Color`;
    const markerLow = settings.markerPlacement === "low"
      || (settings.markerPlacement === "bar-direction" && candle.close >= candle.open);
    const end = zone.stoppedBy ? zone.endIndex : zone.sourceIndex + Number(settings.extendedBars);
    return [{ id: zone.id, startLogical: logicalOffset + zone.sourceIndex, endLogical: logicalOffset + end,
      high: (zone.highTick + .5) * tickSize, low: (zone.lowTick - .5) * tickSize,
      markerPrice: markerLow ? candle.low : candle.high,
      color: String(colors[key as keyof typeof colors]), opacity: Number(settings.opacity) / 100,
      lineWidth: Number(settings.lineWidth), markerSize: Number(settings.markerSize),
      showZone: settings.plotMode !== "marker", showMarker: settings.plotMode !== "zones" }];
  });
}
