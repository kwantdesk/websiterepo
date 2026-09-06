import type { Candle } from "@/lib/backtester";
import type { CalculatedIndicatorSeries, IndicatorTheme } from "@/lib/chartIndicatorEngine";
import type { GapZone } from "@/lib/gapDetector";
import type { FootprintBarModel, FootprintPriceLevel } from "@/lib/footprintTypes";

export const SHIFT_CANDLE_SETTINGS_VERSION = 1;

export const SHIFT_CANDLE_DEFAULTS = {
  maxBarsAfterReversal: 3,
  minimumTickBreakout: 1,
  minimumDeltaPercentDifference: 20,
  minimumDeltaValueDifference: 100,
  maximumTickPocDistance: 4,
  highestLowestLookback: 5,
  markerTickOffset: 2,
  plotPrice: "high-low",
  imbalanceEnabled: true,
  minimumImbalancePercent: 300,
  minimumImbalanceVolumeDifference: 20,
  freshZonesEnabled: true,
  zoneOpacity: 18,
  markerShape: "square",
  markerLineWidth: 2,
  autoCenter: true,
  alertEnabled: false,
  alertName: "Trinity Trigger",
  popupEnabled: false,
  popupMessage: "Trinity Trigger",
  useThemeColors: true,
  buyMarkerColor: "#22C55E",
  sellMarkerColor: "#EF4444",
  freshBuyZoneColor: "#22C55E",
  freshSellZoneColor: "#EF4444",
  shiftCandleSettingsVersion: SHIFT_CANDLE_SETTINGS_VERSION,
} as const;

export type ShiftCandleSettings = {
  maxBarsAfterReversal: number;
  minimumTickBreakout: number;
  minimumDeltaPercentDifference: number;
  minimumDeltaValueDifference: number;
  maximumTickPocDistance: number;
  highestLowestLookback: number;
  markerTickOffset: number;
  plotPrice: "high-low" | "open" | "close" | "poc";
  imbalanceEnabled: boolean;
  minimumImbalancePercent: number;
  minimumImbalanceVolumeDifference: number;
  freshZonesEnabled: boolean;
  zoneOpacity: number;
  markerShape: "square" | "circle" | "diamond";
  markerLineWidth: number;
  autoCenter: boolean;
  alertEnabled: boolean;
  alertName: string;
  popupEnabled: boolean;
  popupMessage: string;
  useThemeColors: boolean;
  buyMarkerColor: string;
  sellMarkerColor: string;
  freshBuyZoneColor: string;
  freshSellZoneColor: string;
  shiftCandleSettingsVersion: number;
};

export type ShiftCandleSignal = {
  direction: "buy" | "sell";
  candidateIndex: number;
  confirmationIndex: number;
  time: number;
  price: number;
  deltaDifference: number;
  deltaPercentDifference: number;
};

export type ShiftCandleResult = {
  status: "ready" | "waiting-for-executions" | "insufficient-history";
  signals: ShiftCandleSignal[];
  buyZones: GapZone[];
  sellZones: GapZone[];
  settings: ShiftCandleSettings;
};

export type ShiftCandlePrimitiveModel = {
  signals: ShiftCandleSignal[];
  shape: ShiftCandleSettings["markerShape"];
  lineWidth: number;
  buyColor: string;
  sellColor: string;
};

const finite = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, finite(value, fallback)));

export function normalizeShiftCandleSettings(raw: Record<string, unknown> = {}): ShiftCandleSettings {
  const plotPrice = ["high-low", "open", "close", "poc"].includes(String(raw.plotPrice))
    ? String(raw.plotPrice) as ShiftCandleSettings["plotPrice"] : "high-low";
  const markerShape = ["square", "circle", "diamond"].includes(String(raw.markerShape))
    ? String(raw.markerShape) as ShiftCandleSettings["markerShape"] : "square";
  return {
    maxBarsAfterReversal: Math.round(bounded(raw.maxBarsAfterReversal, 3, 1, 50)),
    minimumTickBreakout: Math.round(bounded(raw.minimumTickBreakout, 1, 0, 1_000)),
    minimumDeltaPercentDifference: bounded(raw.minimumDeltaPercentDifference, 20, 0, 200),
    minimumDeltaValueDifference: bounded(raw.minimumDeltaValueDifference, 100, 0, 10_000_000),
    maximumTickPocDistance: Math.round(bounded(raw.maximumTickPocDistance, 4, 0, 1_000)),
    highestLowestLookback: Math.round(bounded(raw.highestLowestLookback, 5, 2, 1_000)),
    markerTickOffset: bounded(raw.markerTickOffset, 2, -1_000, 1_000),
    plotPrice,
    imbalanceEnabled: raw.imbalanceEnabled !== false,
    minimumImbalancePercent: bounded(raw.minimumImbalancePercent, 300, 100, 10_000),
    minimumImbalanceVolumeDifference: bounded(raw.minimumImbalanceVolumeDifference, 20, 0, 10_000_000),
    freshZonesEnabled: raw.freshZonesEnabled !== false,
    zoneOpacity: bounded(raw.zoneOpacity, 18, 0, 100),
    markerShape,
    markerLineWidth: bounded(raw.markerLineWidth, 2, 0.5, 8),
    autoCenter: raw.autoCenter !== false,
    alertEnabled: raw.alertEnabled === true,
    alertName: String(raw.alertName ?? "Trinity Trigger").trim() || "Trinity Trigger",
    popupEnabled: raw.popupEnabled === true,
    popupMessage: String(raw.popupMessage ?? "Trinity Trigger").trim() || "Trinity Trigger",
    useThemeColors: raw.useThemeColors !== false,
    buyMarkerColor: String(raw.buyMarkerColor ?? "#22C55E"),
    sellMarkerColor: String(raw.sellMarkerColor ?? "#EF4444"),
    freshBuyZoneColor: String(raw.freshBuyZoneColor ?? "#22C55E"),
    freshSellZoneColor: String(raw.freshSellZoneColor ?? "#EF4444"),
    shiftCandleSettingsVersion: SHIFT_CANDLE_SETTINGS_VERSION,
  };
}

function qualifiesImbalance(
  rows: readonly FootprintPriceLevel[], direction: "buy" | "sell", settings: ShiftCandleSettings,
) {
  if (!settings.imbalanceEnabled) return true;
  return rows.some((row) => {
    const dominant = direction === "buy" ? row.askVolume : row.bidVolume;
    const passive = direction === "buy" ? row.bidVolume : row.askVolume;
    const flagged = direction === "buy" ? row.isAskImbalance : row.isBidImbalance;
    const ratio = passive <= 0 ? (dominant > 0 ? Number.POSITIVE_INFINITY : 0) : dominant / passive * 100;
    return flagged && ratio >= settings.minimumImbalancePercent
      && dominant - passive >= settings.minimumImbalanceVolumeDifference;
  });
}

function markerPrice(candle: Candle, footprint: FootprintBarModel, direction: "buy" | "sell", settings: ShiftCandleSettings, tickSize: number) {
  const base = settings.plotPrice === "open" ? candle.open
    : settings.plotPrice === "close" ? candle.close
      : settings.plotPrice === "poc" && footprint.pocTick !== null ? footprint.pocTick * tickSize
        : direction === "buy" ? candle.low : candle.high;
  return base + (direction === "buy" ? -1 : 1) * settings.markerTickOffset * tickSize;
}

function zoneEnd(candles: readonly Candle[], startIndex: number, direction: "buy" | "sell", low: number, high: number) {
  for (let index = startIndex + 1; index < candles.length; index += 1) {
    if (direction === "buy" ? candles[index].low <= low : candles[index].high >= high) return index;
  }
  return null;
}

/**
 * Published-contract Trinity interpretation.
 *
 * DeepCharts does not expose its protected trigger formula in readable DLL
 * metadata. This implementation therefore uses only the published knobs and
 * exact execution-derived footprint rows: a confirmed structure reversal,
 * delta divergence, POC proximity and (optionally) a real row imbalance. It
 * never reads a future bar to place the confirmation marker.
 */
export function calculateShiftCandle(
  candles: readonly Candle[], footprintBars: readonly FootprintBarModel[], raw: Record<string, unknown> = {}, tickSize = 0.25,
): ShiftCandleResult {
  const settings = normalizeShiftCandleSettings(raw);
  const minimumTick = Number.isFinite(tickSize) && tickSize > 0 ? tickSize : 0.25;
  const count = Math.min(candles.length, footprintBars.length);
  if (count <= settings.highestLowestLookback) return { status: "insufficient-history", signals: [], buyZones: [], sellZones: [], settings };
  const bars = footprintBars.slice(0, count);
  if (!bars.some((bar) => bar.hasPriceLevelFlow && bar.pocTick !== null)) {
    return { status: "waiting-for-executions", signals: [], buyZones: [], sellZones: [], settings };
  }
  const signals: ShiftCandleSignal[] = [];
  const buyZones: GapZone[] = [];
  const sellZones: GapZone[] = [];
  let lastConfirmation = -1;

  for (let candidateIndex = settings.highestLowestLookback; candidateIndex < count - 1; candidateIndex += 1) {
    const candidate = candles[candidateIndex];
    const candidateFlow = bars[candidateIndex];
    if (!candidateFlow?.hasPriceLevelFlow || candidateFlow.pocTick === null) continue;
    const prior = candles.slice(candidateIndex - settings.highestLowestLookback, candidateIndex);
    const swingLow = candidate.low <= Math.min(...prior.map((bar) => bar.low));
    const swingHigh = candidate.high >= Math.max(...prior.map((bar) => bar.high));
    if (!swingLow && !swingHigh) continue;

    for (const direction of (["buy", "sell"] as const)) {
      if ((direction === "buy" && !swingLow) || (direction === "sell" && !swingHigh)) continue;
      const extreme = direction === "buy" ? candidate.low : candidate.high;
      if (Math.abs(candidateFlow.pocTick * minimumTick - extreme) / minimumTick > settings.maximumTickPocDistance) continue;
      const finalIndex = Math.min(count - 1, candidateIndex + settings.maxBarsAfterReversal);
      for (let confirmationIndex = candidateIndex + 1; confirmationIndex <= finalIndex; confirmationIndex += 1) {
        if (confirmationIndex <= lastConfirmation) continue;
        const confirmation = candles[confirmationIndex];
        const flow = bars[confirmationIndex];
        if (!flow?.hasPriceLevelFlow) continue;
        const breakout = direction === "buy"
          ? confirmation.close >= candidate.high + settings.minimumTickBreakout * minimumTick
          : confirmation.close <= candidate.low - settings.minimumTickBreakout * minimumTick;
        if (!breakout || !qualifiesImbalance(flow.rows, direction, settings)) continue;
        const deltaDifference = direction === "buy" ? flow.delta - candidateFlow.delta : candidateFlow.delta - flow.delta;
        const deltaPercentDifference = direction === "buy"
          ? flow.deltaPercent - candidateFlow.deltaPercent : candidateFlow.deltaPercent - flow.deltaPercent;
        if (deltaDifference < settings.minimumDeltaValueDifference || deltaPercentDifference < settings.minimumDeltaPercentDifference) continue;
        signals.push({ direction, candidateIndex, confirmationIndex, time: confirmation.timestamp / 1_000,
          price: markerPrice(confirmation, flow, direction, settings, minimumTick), deltaDifference, deltaPercentDifference });
        lastConfirmation = confirmationIndex;
        if (settings.freshZonesEnabled) {
          const low = direction === "buy" ? candidate.low : Math.min(candidate.open, candidate.close);
          const high = direction === "buy" ? Math.max(candidate.open, candidate.close) : candidate.high;
          const endIndex = zoneEnd(candles, confirmationIndex, direction, low, high);
          const zone: GapZone = { direction: direction === "buy" ? "up" : "down", startTime: confirmation.timestamp / 1_000,
            endTime: endIndex === null ? candles[count - 1].timestamp / 1_000 : candles[endIndex].timestamp / 1_000,
            low, high, extendToRight: endIndex === null };
          (direction === "buy" ? buyZones : sellZones).push(zone);
        }
        break;
      }
    }
  }
  return { status: "ready", signals, buyZones, sellZones, settings };
}

export function calculateShiftCandleSeries(
  candles: readonly Candle[], footprintBars: readonly FootprintBarModel[], raw: Record<string, unknown>, theme: IndicatorTheme, tickSize = 0.25,
): CalculatedIndicatorSeries[] {
  const result = calculateShiftCandle(candles, footprintBars, raw, tickSize);
  if (result.status !== "ready") return [];
  const buyColor = result.settings.useThemeColors ? theme.positive : result.settings.buyMarkerColor;
  const sellColor = result.settings.useThemeColors ? theme.negative : result.settings.sellMarkerColor;
  const buyZoneColor = result.settings.useThemeColors ? theme.positive : result.settings.freshBuyZoneColor;
  const sellZoneColor = result.settings.useThemeColors ? theme.negative : result.settings.freshSellZoneColor;
  const base = (direction: "buy" | "sell", color: string): CalculatedIndicatorSeries => ({
    key: `shift-candle-${direction}`, label: direction === "buy" ? "Shift Buy" : "Shift Sell",
    kind: "line", placement: "overlay", color, lineVisible: false, pointMarkersVisible: false,
    lineWidth: Math.max(1, Math.min(4, Math.round(result.settings.markerLineWidth))) as 1 | 2 | 3 | 4,
    lastValueVisible: false, excludeFromAutoScale: !result.settings.autoCenter,
    data: result.signals.filter((signal) => signal.direction === direction).map((signal) => ({ time: signal.time, value: signal.price })),
  });
  const series = [base("buy", buyColor), base("sell", sellColor)];
  series[0].shiftCandle = { signals: result.signals.filter((signal) => signal.direction === "buy"), shape: result.settings.markerShape, lineWidth: result.settings.markerLineWidth, buyColor, sellColor };
  series[1].shiftCandle = { signals: result.signals.filter((signal) => signal.direction === "sell"), shape: result.settings.markerShape, lineWidth: result.settings.markerLineWidth, buyColor, sellColor };
  if (result.buyZones.length) { series[0].color = buyZoneColor; series[0].gapZones = { zones: result.buyZones, opacity: result.settings.zoneOpacity / 100, borderWidth: 1 }; }
  if (result.sellZones.length) { series[1].color = sellZoneColor; series[1].gapZones = { zones: result.sellZones, opacity: result.settings.zoneOpacity / 100, borderWidth: 1 }; }
  return series;
}
