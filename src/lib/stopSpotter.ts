import type { FootprintBar } from "./footprint.ts";
import { paperContractSpec } from "./paperTrading.ts";

export const STOP_SPOTTER_SETTINGS_VERSION = 1;

export type StopSpotterSettings = {
  schemaVersion: number;
  minimumDeltaPercent: number;
  minimumVolume: number;
  minimumVolumeIncrease: number;
  minimumBodyTicks: number;
  minimumPriceTicksIncrease: number;
  minimumHorizontalDelta: number;
  minimumImbalancePercent: number;
  minimumImbalanceCount: number;
  calculationMode: "close" | "seconds-to-close";
  secondsToClose: number;
  plotPrice: "price-slope" | "high" | "low";
  contractCalculationEnabled: boolean;
  maximumLoss: number;
  tickValueDivider: number;
  contractFontSize: number;
  contractTickOffset: number;
  contractBackgroundColor: string;
  contractBuyTextColor: string;
  contractSellTextColor: string;
  alertSoundEnabled: boolean;
  alertTone: "chime" | "bell" | "pulse";
  messagePopupEnabled: boolean;
  messageText: string;
  buyColor: string;
  sellColor: string;
  markerStyle: "square" | "circle" | "diamond" | "cross" | "triangle";
  autoColor: "none" | "direction";
  lineStyle: "solid" | "dashed" | "dotted";
  lineWidth: number;
  shortName: string;
  showNameLabel: boolean;
  showValueLabel: boolean;
  nameBackground: boolean;
  valueBackground: boolean;
  chartColorForMarker: boolean;
  includeOnAutoCenter: boolean;
  useThemeColors: boolean;
};

export type StopSpotterMarker = {
  id: string;
  timestamp: number;
  side: "buy" | "sell";
  priceTick: number;
  volume: number;
  delta: number;
  deltaPercent: number;
  volumeIncrease: number;
  bodyTicks: number;
  priceTicksIncrease: number;
  horizontalDelta: number;
  imbalanceCount: number;
  contracts: number | null;
  developing: boolean;
};

export type StopSpotterFrame = {
  instrument: string;
  tickSize: number;
  status: "LIVE" | "HISTORICAL" | "WAITING_FOR_VOLUME_AT_PRICE";
  markers: StopSpotterMarker[];
};

export const DEFAULT_STOP_SPOTTER_SETTINGS: StopSpotterSettings = {
  schemaVersion: STOP_SPOTTER_SETTINGS_VERSION,
  minimumDeltaPercent: 25,
  minimumVolume: 1_500,
  minimumVolumeIncrease: 500,
  minimumBodyTicks: 6,
  minimumPriceTicksIncrease: 1,
  minimumHorizontalDelta: 60,
  minimumImbalancePercent: 200,
  minimumImbalanceCount: 2,
  calculationMode: "close",
  secondsToClose: 15,
  plotPrice: "price-slope",
  contractCalculationEnabled: false,
  maximumLoss: 500,
  tickValueDivider: 1,
  contractFontSize: 10,
  contractTickOffset: 2,
  contractBackgroundColor: "#111827",
  contractBuyTextColor: "#22C55E",
  contractSellTextColor: "#EF4444",
  alertSoundEnabled: false,
  alertTone: "chime",
  messagePopupEnabled: false,
  messageText: "Stop Run",
  buyColor: "#6EE7B7",
  sellColor: "#FCA5A5",
  markerStyle: "square",
  autoColor: "none",
  lineStyle: "solid",
  lineWidth: 2,
  shortName: "Stop Run",
  showNameLabel: true,
  showValueLabel: false,
  nameBackground: false,
  valueBackground: false,
  chartColorForMarker: false,
  includeOnAutoCenter: true,
  useThemeColors: true,
};

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function normalizeStopSpotterSettings(input?: Record<string, unknown> | null): StopSpotterSettings {
  const source = input ?? {};
  const settings = { ...DEFAULT_STOP_SPOTTER_SETTINGS, ...source } as StopSpotterSettings;
  settings.schemaVersion = STOP_SPOTTER_SETTINGS_VERSION;
  settings.minimumDeltaPercent = clamp(finite(source.minimumDeltaPercent, 25), 0, 100);
  settings.minimumVolume = Math.round(clamp(finite(source.minimumVolume, 1_500), 0, 10_000_000));
  settings.minimumVolumeIncrease = Math.round(clamp(finite(source.minimumVolumeIncrease, 500), 0, 10_000_000));
  settings.minimumBodyTicks = Math.round(clamp(finite(source.minimumBodyTicks, 6), 2, 10_000));
  settings.minimumPriceTicksIncrease = Math.round(clamp(finite(source.minimumPriceTicksIncrease, 1), 0, 10_000));
  settings.minimumHorizontalDelta = Math.round(clamp(finite(source.minimumHorizontalDelta, 60), 0, 10_000_000));
  settings.minimumImbalancePercent = clamp(finite(source.minimumImbalancePercent, 200), 100, 10_000);
  settings.minimumImbalanceCount = Math.round(clamp(finite(source.minimumImbalanceCount, 2), 1, 100));
  settings.secondsToClose = Math.round(clamp(finite(source.secondsToClose, 15), 0, 3_600));
  settings.maximumLoss = clamp(finite(source.maximumLoss, 500), 0, 10_000_000);
  settings.tickValueDivider = clamp(finite(source.tickValueDivider, 1), 1, 10_000);
  settings.contractFontSize = clamp(finite(source.contractFontSize, 10), 6, 30);
  settings.contractTickOffset = Math.round(clamp(finite(source.contractTickOffset, 2), 0, 500));
  settings.lineWidth = clamp(finite(source.lineWidth, 2), 1, 8);
  if (!(new Set(["close", "seconds-to-close"]) as Set<unknown>).has(settings.calculationMode)) settings.calculationMode = "close";
  if (!(new Set(["price-slope", "high", "low"]) as Set<unknown>).has(settings.plotPrice)) settings.plotPrice = "price-slope";
  if (!(new Set(["square", "circle", "diamond", "cross", "triangle"]) as Set<unknown>).has(settings.markerStyle)) settings.markerStyle = "square";
  if (!(new Set(["none", "direction"]) as Set<unknown>).has(settings.autoColor)) settings.autoColor = "none";
  if (!(new Set(["solid", "dashed", "dotted"]) as Set<unknown>).has(settings.lineStyle)) settings.lineStyle = "solid";
  if (!(new Set(["chime", "bell", "pulse"]) as Set<unknown>).has(settings.alertTone)) settings.alertTone = "chime";
  settings.shortName = String(source.shortName ?? "Stop Run").slice(0, 40);
  settings.messageText = String(source.messageText ?? "Stop Run").slice(0, 160);
  return settings;
}

function maximumHorizontalDelta(bar: FootprintBar, side: "buy" | "sell") {
  return bar.rows.reduce((maximum, row) => Math.max(maximum, side === "buy" ? row.askVolume - row.bidVolume : row.bidVolume - row.askVolume), 0);
}

function consecutiveDiagonalImbalances(bar: FootprintBar, side: "buy" | "sell", minimumPercent: number) {
  const rows = [...bar.rows].sort((left, right) => left.tickIndex - right.tickIndex);
  let maximum = 0;
  let run = 0;
  let previousTick: number | null = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const comparison = side === "buy" ? rows[index - 1] : rows[index + 1];
    const numerator = side === "buy" ? row.askVolume : row.bidVolume;
    const denominator = comparison ? side === "buy" ? comparison.bidVolume : comparison.askVolume : 0;
    const ratio = numerator > 0 && denominator === 0 ? Number.POSITIVE_INFINITY : denominator > 0 ? numerator / denominator * 100 : 0;
    const adjacent = previousTick === null || Math.abs(row.tickIndex - previousTick) === 1;
    if (ratio >= minimumPercent && adjacent) run += 1; else run = ratio >= minimumPercent ? 1 : 0;
    previousTick = ratio >= minimumPercent ? row.tickIndex : null;
    maximum = Math.max(maximum, run);
  }
  return maximum;
}

function markerTick(bar: FootprintBar, side: "buy" | "sell", mode: StopSpotterSettings["plotPrice"]) {
  if (mode === "high") return bar.highTick;
  if (mode === "low") return bar.lowTick;
  return side === "buy" ? bar.highTick : bar.lowTick;
}

function contractQuantity(instrument: string, tickSize: number, marker: Pick<StopSpotterMarker, "bodyTicks" | "priceTicksIncrease">, settings: StopSpotterSettings) {
  if (!settings.contractCalculationEnabled || settings.maximumLoss <= 0) return null;
  const contract = paperContractSpec(instrument);
  const nativeTickValue = contract.isFutures ? contract.tickValue : contract.pointValue * tickSize;
  const riskTicks = Math.max(1, marker.bodyTicks, marker.priceTicksIncrease) + settings.contractTickOffset;
  const riskPerContract = riskTicks * nativeTickValue / settings.tickValueDivider;
  return riskPerContract > 0 ? Math.max(0, Math.floor(settings.maximumLoss / riskPerContract)) : null;
}

/**
 * The protected DeepCharts formula body is unavailable. This is the explicit,
 * testable conjunction described by its current help and exposed settings:
 * directional delta, total/incremental volume, body and continuation, maximum
 * same-row horizontal delta, and consecutive diagonal imbalances. Nothing is
 * inferred from candle OHLC when classified price-level executions are absent.
 */
export function buildStopSpotterFrame(
  barsInput: FootprintBar[],
  instrument: string,
  tickSize: number,
  input?: Record<string, unknown> | null,
  nowMs = Date.now(),
  clockBarDurationMs: number | null = null,
): StopSpotterFrame {
  const settings = normalizeStopSpotterSettings(input);
  const bars = [...barsInput].sort((left, right) => left.startTime - right.startTime);
  if (!bars.some((bar) => bar.hasPriceLevelFlow)) return { instrument, tickSize, status: "WAITING_FOR_VOLUME_AT_PRICE", markers: [] };
  const markers: StopSpotterMarker[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const bar = bars[index];
    const previous = bars[index - 1];
    if (!bar.hasPriceLevelFlow || !previous.hasPriceLevelFlow) continue;
    const developing = !bar.isClosed;
    if (developing) {
      if (settings.calculationMode === "close") continue;
      if (clockBarDurationMs === null) continue;
      const closeAt = bar.startTime + clockBarDurationMs;
      if (nowMs < closeAt - settings.secondsToClose * 1_000 || nowMs >= closeAt) continue;
    }
    const side = bar.closeTick > bar.openTick && bar.delta > 0 ? "buy" : bar.closeTick < bar.openTick && bar.delta < 0 ? "sell" : null;
    if (!side) continue;
    const deltaPercent = Math.abs(bar.deltaPercent) * 100;
    const volumeIncrease = bar.totalVolume - previous.totalVolume;
    const bodyTicks = Math.abs(bar.closeTick - bar.openTick);
    const priceTicksIncrease = side === "buy" ? bar.closeTick - previous.closeTick : previous.closeTick - bar.closeTick;
    const horizontalDelta = maximumHorizontalDelta(bar, side);
    const imbalanceCount = consecutiveDiagonalImbalances(bar, side, settings.minimumImbalancePercent);
    if (deltaPercent < settings.minimumDeltaPercent
      || bar.totalVolume < settings.minimumVolume
      || volumeIncrease < settings.minimumVolumeIncrease
      || bodyTicks < settings.minimumBodyTicks
      || priceTicksIncrease < settings.minimumPriceTicksIncrease
      || horizontalDelta < settings.minimumHorizontalDelta
      || imbalanceCount < settings.minimumImbalanceCount) continue;
    const provisional: StopSpotterMarker = {
      id: `stop-spotter:${bar.id}:${side}`,
      timestamp: bar.startTime,
      side,
      priceTick: markerTick(bar, side, settings.plotPrice),
      volume: bar.totalVolume,
      delta: bar.delta,
      deltaPercent,
      volumeIncrease,
      bodyTicks,
      priceTicksIncrease,
      horizontalDelta,
      imbalanceCount,
      contracts: null,
      developing,
    };
    provisional.contracts = contractQuantity(instrument, tickSize, provisional, settings);
    markers.push(provisional);
  }
  const latest = bars.at(-1);
  return { instrument, tickSize, status: latest && !latest.isClosed ? "LIVE" : "HISTORICAL", markers };
}
